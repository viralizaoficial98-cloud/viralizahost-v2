#!/usr/bin/env node
/**
 * ViralizaHost — gerador do schema MariaDB a partir do PostgreSQL (Supabase).
 *
 * Lê o catálogo do schema `viralizahost` numa base PostgreSQL (produção ou
 * réplica reconstruída a partir de supabase/migrations) e gera:
 *   - database/mariadb/schema.sql          (DDL MariaDB 10.11, utf8mb4, phpMyAdmin)
 *   - src/lib/db/schema.generated.ts       (metadados usados pela camada de dados)
 *
 * Uso:
 *   SOURCE_DATABASE_URL=postgres://... node scripts/mariadb/generate-schema.mjs [--check]
 *
 * --check  não escreve ficheiros; compara o schema de origem com os ficheiros
 *          commitados e termina com código 1 se houver diferenças (útil para
 *          detectar alterações feitas em produção fora das migrações).
 */
import pg from 'pg'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCHEMA = process.env.SOURCE_SCHEMA || 'viralizahost'
const CHECK = process.argv.includes('--check')
const url = process.env.SOURCE_DATABASE_URL
if (!url) {
  console.error('Defina SOURCE_DATABASE_URL (ligação PostgreSQL de origem).')
  process.exit(2)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

// ── Catálogo ─────────────────────────────────────────────────────────────────
const tables = (await q(
  `select c.relname as name from pg_class c
   where c.relnamespace = $1::regnamespace and c.relkind = 'r' order by c.relname`, [SCHEMA]
)).map(r => r.name)

const columns = await q(
  `select c.relname as table, a.attname as name, a.attnum as num,
          format_type(a.atttypid, a.atttypmod) as type, t.typname, t.typtype,
          et.typname as elemtype, a.attnotnull as notnull,
          pg_get_expr(d.adbin, d.adrelid) as def, a.attgenerated as generated
   from pg_attribute a
   join pg_class c on c.oid = a.attrelid
   join pg_type t on t.oid = a.atttypid
   left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
   left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
   where c.relnamespace = $1::regnamespace and c.relkind = 'r'
     and a.attnum > 0 and not a.attisdropped
   order by c.relname, a.attnum`, [SCHEMA])

const enums = Object.fromEntries((await q(
  `select t.typname, array_agg(e.enumlabel::text order by e.enumsortorder) as labels
   from pg_type t join pg_enum e on e.enumtypid = t.oid group by t.typname`
)).map(r => [r.typname, r.labels]))

const constraints = await q(
  `select c.relname as table, k.conname as name, k.contype as type,
          pg_get_constraintdef(k.oid) as def,
          (select array_agg(a.attname::text order by x.ord) from unnest(k.conkey) with ordinality x(n, ord)
             join pg_attribute a on a.attrelid = k.conrelid and a.attnum = x.n) as cols,
          fc.relname as ftable, fn.nspname as fschema,
          (select array_agg(a.attname::text order by x.ord) from unnest(k.confkey) with ordinality x(n, ord)
             join pg_attribute a on a.attrelid = k.confrelid and a.attnum = x.n) as fcols,
          k.confdeltype as ondelete
   from pg_constraint k
   join pg_class c on c.oid = k.conrelid
   left join pg_class fc on fc.oid = k.confrelid
   left join pg_namespace fn on fn.oid = fc.relnamespace
   where c.relnamespace = $1::regnamespace
   order by c.relname, k.contype, k.conname`, [SCHEMA])

const indexes = await q(
  `select t.relname as table, i.relname as name, ix.indisunique as unique,
          pg_get_expr(ix.indpred, ix.indrelid) as predicate, ix.indexprs is not null as has_expr,
          (select array_agg(a.attname::text || case when (ix.indoption[x.ord - 1] & 1) = 1 then ' DESC' else '' end order by x.ord)
             from unnest(ix.indkey) with ordinality x(n, ord)
             join pg_attribute a on a.attrelid = t.oid and a.attnum = x.n) as cols
   from pg_index ix
   join pg_class i on i.oid = ix.indexrelid
   join pg_class t on t.oid = ix.indrelid
   where t.relnamespace = $1::regnamespace
     and not exists (select 1 from pg_constraint k where k.conindid = ix.indexrelid)
   order by t.relname, i.relname`, [SCHEMA])

const updatedAtTriggers = new Set((await q(
  `select distinct c.relname from pg_trigger tg
   join pg_class c on c.oid = tg.tgrelid
   join pg_proc p on p.oid = tg.tgfoid
   where c.relnamespace = $1::regnamespace and not tg.tgisinternal
     and pg_get_functiondef(p.oid) ~* 'NEW\\.updated_at\\s*=\\s*now\\(\\)'`, [SCHEMA]
)).map(r => r.relname))

await client.end()

// ── Conversão ────────────────────────────────────────────────────────────────
const warnings = []
const ident = s => '`' + s.replace(/`/g, '``') + '`'
const sqlStr = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'"

const pkCols = {}
const uniqueCols = {}
const indexedCols = {}
for (const k of constraints) {
  const cols = k.cols ?? []
  if (k.type === 'p') pkCols[k.table] = cols
  if (k.type === 'u') (uniqueCols[k.table] ??= []).push(cols)
  if (['p', 'u', 'f'].includes(k.type)) for (const c of cols) (indexedCols[k.table] ??= new Set()).add(c)
}
for (const ix of indexes) for (const c of ix.cols ?? []) (indexedCols[ix.table] ??= new Set()).add(c.replace(/ DESC$/, ''))
// colunas referenciadas por FKs de outras tabelas também precisam de ser indexáveis
for (const k of constraints) if (k.type === 'f' && k.fschema === SCHEMA) for (const c of k.fcols ?? []) (indexedCols[k.ftable] ??= new Set()).add(c)

/** Tipo lógico usado pela camada de dados para converter valores lidos. */
function kindOf(col) {
  if (col.typtype === 'e') return 'enum'
  if (col.elemtype) return 'array'
  switch (col.typname) {
    case 'uuid': return 'uuid'
    case 'bool': return 'bool'
    case 'int2': case 'int4': case 'int8': return 'int'
    case 'numeric': case 'float4': case 'float8': return 'number'
    case 'json': case 'jsonb': return 'json'
    case 'timestamptz': case 'timestamp': return 'timestamp'
    case 'date': return 'date'
    default: return 'text'
  }
}

function mariaType(col) {
  const indexed = indexedCols[col.table]?.has(col.name)
  if (col.typtype === 'e') return `ENUM(${enums[col.typname].map(sqlStr).join(',')})`
  if (col.elemtype) return 'JSON'
  switch (col.typname) {
    case 'uuid': return 'CHAR(36)'
    case 'bool': return 'TINYINT(1)'
    case 'int2': return 'SMALLINT'
    case 'int4': return 'INT'
    case 'int8': return 'BIGINT'
    case 'float4': return 'FLOAT'
    case 'float8': return 'DOUBLE'
    case 'numeric': {
      const m = col.type.match(/numeric\((\d+),(\d+)\)/)
      if (m) return `DECIMAL(${m[1]},${m[2]})`
      warnings.push(`${col.table}.${col.name}: numeric sem precisão → DECIMAL(20,6)`)
      return 'DECIMAL(20,6)'
    }
    case 'json': case 'jsonb': return 'JSON'
    case 'timestamptz': case 'timestamp': return 'DATETIME(6)'
    case 'date': return 'DATE'
    case 'inet': return 'VARCHAR(45)'
    case 'varchar': {
      const m = col.type.match(/\((\d+)\)/)
      return `VARCHAR(${m ? m[1] : 255})`
    }
    case 'text': return indexed ? 'VARCHAR(255)' : 'MEDIUMTEXT'
    default:
      warnings.push(`${col.table}.${col.name}: tipo ${col.type} convertido em MEDIUMTEXT`)
      return 'MEDIUMTEXT'
  }
}

/** Converte um DEFAULT PostgreSQL. Devolve null quando o valor é gerado pela aplicação. */
function mariaDefault(col) {
  const d = col.def
  if (d == null) return null
  if (/^(gen_random_uuid|uuid_generate_v4|extensions\.uuid_generate_v4)\(\)$/.test(d)) return '(UUID())'
  if (/^now\(\)$|^CURRENT_TIMESTAMP$/i.test(d)) return col.typname === 'date' ? '(CURRENT_DATE)' : 'CURRENT_TIMESTAMP(6)'
  if (/^CURRENT_DATE$/i.test(d)) return '(CURRENT_DATE)'
  let m
  if ((m = d.match(/^\(now\(\) \+ '(\d+) days?'::interval\)$/))) return `(CURRENT_TIMESTAMP(6) + INTERVAL ${m[1]} DAY)`
  if ((m = d.match(/^\(CURRENT_DATE \+ '(\d+) days?'::interval\)$/))) return `(CURRENT_DATE + INTERVAL ${m[1]} DAY)`
  if (d === 'true') return '1'
  if (d === 'false') return '0'
  if (/^-?\d+(\.\d+)?$/.test(d)) return d
  if ((m = d.match(/^'((?:[^']|'')*)'::(?:text|character varying|bpchar|[a-z_.]*\.?[a-z_]+)(?:\[\])?$/s))) {
    const v = m[1].replace(/''/g, "'")
    if (col.typname === 'jsonb' || col.typname === 'json') return `(${sqlStr(v)})`
    if (col.elemtype) {
      // '{}'::text[] → JSON '[]'
      const inner = v.replace(/^\{|\}$/g, '')
      const arr = inner === '' ? [] : inner.split(',').map(s => s.replace(/^"|"$/g, ''))
      return `(${sqlStr(JSON.stringify(arr))})`
    }
    return sqlStr(v)
  }
  // concatenações de literais: ('a'::text || 'b'::text)
  if (/^\(*'/.test(d) && /\|\|/.test(d) && !/now\(\)|random\(\)/.test(d)) {
    const parts = [...d.matchAll(/'((?:[^']|'')*)'::text/g)].map(x => x[1].replace(/''/g, "'"))
    return sqlStr(parts.join(''))
  }
  warnings.push(`${col.table}.${col.name}: DEFAULT ${d} não convertido — gerado pela aplicação`)
  return null
}

const ON_DELETE = { a: '', r: ' ON DELETE RESTRICT', c: ' ON DELETE CASCADE', n: ' ON DELETE SET NULL', d: ' ON DELETE SET DEFAULT' }

/** Traduz CHECK simples (IN lists, intervalos). Outros são reportados. */
function mariaCheck(def) {
  let m
  let body = def.replace(/^CHECK \((.*)\)$/s, '$1')
  body = body.replace(/::(text|numeric|integer|viralizahost\.[a-z_]+)/g, '')
  body = body.replace(/\((\w+) = ANY \(ARRAY\[([^\]]+)\]\)\)/g, (_, c, list) => `(\`${c}\` IN (${list}))`)
  body = body.replace(/length\(TRIM\(BOTH FROM (\w+)\)\)/g, 'CHAR_LENGTH(TRIM($1))')
  body = body.replace(/\(0\)/g, '0').replace(/\(1\)/g, '1')
  if (/ANY|ARRAY|~|::/.test(body)) return null
  if ((m = body.match(/^\((.*)\)$/s))) body = m[1]
  return body
}

const meta = {}
const ddl = []
ddl.push(`-- ============================================================================
-- ViralizaHost — schema MariaDB 10.11 (gerado por scripts/mariadb/generate-schema.mjs)
-- Origem: PostgreSQL schema \`${SCHEMA}\` (${tables.length} tabelas)
-- Importável pelo phpMyAdmin: seleccione a base \`viralizahost_viralizaHost\` e
-- importe este ficheiro. Não cria a base nem utilizadores.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS (não apaga dados existentes).
-- ============================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
`)

// Tabelas próprias (Auth e Storage substituem os serviços do Supabase)
ddl.push(readFileSync(join(ROOT, 'scripts/mariadb/platform-tables.sql'), 'utf8').trim() + '\n')

const fkDdl = []
for (const t of tables) {
  const cols = columns.filter(c => c.table === t)
  const lines = []
  const tmeta = { pk: pkCols[t] ?? [], unique: (uniqueCols[t] ?? []).map(c => [...c]), columns: {}, relations: [] }
  for (const c of cols) {
    const kind = kindOf(c)
    const cm = { kind }
    if (kind === 'enum') cm.values = enums[c.typname]
    if (c.generated === 's') {
      const expr = c.def.replace(/\|\|/g, ',')
      lines.push(`  ${ident(c.name)} VARCHAR(255) AS (CONCAT(${expr.replace(/^\(|\)$/g, '')})) STORED`)
      cm.generated = true
      tmeta.columns[c.name] = cm
      continue
    }
    const type = mariaType(c)
    let line = `  ${ident(c.name)} ${type}${c.notnull ? ' NOT NULL' : ' NULL'}`
    const def = mariaDefault(c)
    if (def != null) line += ` DEFAULT ${def}`
    else if (c.def != null) cm.appDefault = c.def
    if (c.def && /uuid/.test(c.def)) cm.defaultUuid = true
    if (c.name === 'updated_at' && updatedAtTriggers.has(t) && kind === 'timestamp') {
      line += ' ON UPDATE CURRENT_TIMESTAMP(6)'
      cm.autoUpdate = true
    }
    if (kind === 'json' || kind === 'array') line += ` CHECK (json_valid(${ident(c.name)}))`
    if (c.def != null) cm.hasDefault = true
    if (!c.notnull) cm.nullable = true
    lines.push(line)
    tmeta.columns[c.name] = cm
  }
  if (pkCols[t]) lines.push(`  PRIMARY KEY (${pkCols[t].map(ident).join(', ')})`)
  const seen = new Set()
  for (const k of constraints.filter(k => k.table === t)) {
    if (k.type === 'u') {
      const key = 'U:' + k.cols.join(',')
      if (seen.has(key)) continue
      seen.add(key)
      lines.push(`  UNIQUE KEY ${ident(k.name.slice(0, 64))} (${k.cols.map(ident).join(', ')})`)
    } else if (k.type === 'c') {
      const chk = mariaCheck(k.def)
      if (chk) lines.push(`  CONSTRAINT ${ident(k.name.slice(0, 64))} CHECK (${chk})`)
      else warnings.push(`${t}: CHECK não convertido (${k.def}) — validado pela aplicação`)
    } else if (k.type === 'f') {
      const ft = k.fschema === 'auth' && k.ftable === 'users' ? 'auth_users' : k.fschema === SCHEMA ? k.ftable : null
      if (!ft) { warnings.push(`${t}.${k.cols}: FK para ${k.fschema}.${k.ftable} ignorada`); continue }
      const fkKey = `F:${k.cols.join(',')}>${ft}(${k.fcols.join(',')})`
      if (seen.has(fkKey)) { warnings.push(`${t}: FK duplicada ${k.name} (mesmas colunas) omitida`); continue }
      seen.add(fkKey)
      fkDdl.push(`ALTER TABLE ${ident(t)} ADD CONSTRAINT ${ident(k.name.slice(0, 64))} FOREIGN KEY IF NOT EXISTS (${k.cols.map(ident).join(', ')}) REFERENCES ${ident(ft)} (${k.fcols.map(ident).join(', ')})${ON_DELETE[k.ondelete] ?? ''};`)
      if (ft !== 'auth_users') tmeta.relations.push({ columns: k.cols, table: ft, refColumns: k.fcols, name: k.name })
    }
  }
  for (const ix of indexes.filter(i => i.table === t)) {
    if (ix.has_expr) { warnings.push(`${t}.${ix.name}: índice de expressão ignorado`); continue }
    const plainCols = ix.cols.map(c => c.replace(/ DESC$/, ''))
    if (ix.unique && ix.predicate) {
      // UNIQUE parcial: em MariaDB, NULL não colide em UNIQUE
      if (/^\((\w+) IS NOT NULL\)$/.test(ix.predicate) && plainCols.length === 1) {
        const key = 'U:' + plainCols.join(',')
        if (!seen.has(key)) { seen.add(key); lines.push(`  UNIQUE KEY ${ident(ix.name)} (${plainCols.map(ident).join(', ')})`); tmeta.unique.push(plainCols) }
        continue
      }
      const m = ix.predicate.match(/^\((\w+) = true\)$/)
      if (m && plainCols.length === 1 && plainCols[0] === m[1]) {
        lines.push(`  \`${m[1]}_unique_key\` TINYINT(1) AS (IF(${ident(m[1])}, 1, NULL)) VIRTUAL`)
        lines.push(`  UNIQUE KEY ${ident(ix.name)} (\`${m[1]}_unique_key\`)`)
        tmeta.columns[`${m[1]}_unique_key`] = { kind: 'int', generated: true, hidden: true }
        continue
      }
      warnings.push(`${t}.${ix.name}: UNIQUE parcial (${ix.predicate}) não suportado — garantido pela aplicação`)
      continue
    }
    const key = (ix.unique ? 'U:' : 'I:') + plainCols.join(',')
    if (seen.has(key) || seen.has('U:' + plainCols.join(','))) continue
    if (!ix.unique && pkCols[t]?.join(',') === plainCols.join(',')) continue
    seen.add(key)
    lines.push(`  ${ix.unique ? 'UNIQUE ' : ''}KEY ${ident(ix.name.slice(0, 64))} (${ix.cols.map(c => c.replace(/^(\w+)/, '`$1`')).join(', ')})`)
  }
  ddl.push(`-- ${t}\nCREATE TABLE IF NOT EXISTS ${ident(t)} (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`)
  meta[t] = tmeta
}

ddl.push(`-- ============================================================================
-- Chaves estrangeiras (adicionadas no fim para respeitar dependências)
-- Reexecução segura: FOREIGN KEY IF NOT EXISTS (MariaDB) salta FKs existentes.
-- ============================================================================`)
ddl.push(fkDdl.join('\n'))
ddl.push('\nSET foreign_key_checks = 1;\n')

// Relações inversas (one-to-many) para os embeds tipo PostgREST
const forward = Object.entries(meta).flatMap(([t, m]) => m.relations.map(r => [t, r]))
for (const [t, r] of forward) {
  meta[r.table]?.relations.push({ columns: r.refColumns, table: t, refColumns: r.columns, name: r.name, many: true })
}

const ts = `// AUTO-GERADO por scripts/mariadb/generate-schema.mjs — não editar à mão.
// Metadados do schema MariaDB usados pela camada de dados (src/lib/db).
import type { SchemaMeta } from './types'

export const SCHEMA_META: SchemaMeta = ${JSON.stringify(meta, null, 2)}
`

const schemaPath = join(ROOT, 'database/mariadb/schema.sql')
const tsPath = join(ROOT, 'src/lib/db/schema.generated.ts')
const sqlOut = ddl.join('\n')
if (CHECK) {
  let diff = false
  for (const [p, content] of [[schemaPath, sqlOut], [tsPath, ts]]) {
    let cur = ''
    try { cur = readFileSync(p, 'utf8') } catch {}
    if (cur !== content) { console.log(`DIFERENTE: ${p}`); diff = true }
  }
  console.log(diff ? '✗ O schema de origem difere dos ficheiros gerados.' : '✓ Schema de origem igual ao commitado.')
  process.exit(diff ? 1 : 0)
}
mkdirSync(dirname(schemaPath), { recursive: true })
writeFileSync(schemaPath, sqlOut)
writeFileSync(tsPath, ts)
console.log(`✓ ${tables.length} tabelas → ${schemaPath}`)
console.log(`✓ metadados → ${tsPath}`)
if (warnings.length) {
  console.log(`\nAvisos (${warnings.length}):`)
  for (const w of warnings) console.log('  - ' + w)
}
