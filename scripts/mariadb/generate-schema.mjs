#!/usr/bin/env node
/**
 * ViralizaHost — Gera o schema MariaDB a partir do catálogo PostgreSQL (Supabase).
 *
 * Lê tabelas, colunas, enums, CHECKs, índices, UNIQUEs e FKs do schema
 * `viralizahost` e escreve:
 *   - database/mariadb/001_schema.sql        (DDL compatível com phpMyAdmin / MariaDB 10.11)
 *   - src/lib/db/schema.generated.ts         (metadados usados pela camada de acesso)
 *
 * Uso:
 *   SOURCE_DATABASE_URL="postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres" \
 *     node scripts/mariadb/generate-schema.mjs [--schema viralizahost] [--check-only]
 *
 * --check-only  não escreve ficheiros; compara o catálogo com o schema.generated.ts
 *               já versionado e lista diferenças (útil para confirmar que a produção
 *               não tem colunas que as migrações do repositório não conhecem).
 */
import pg from 'pg'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const arg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt }
const SCHEMA = arg('--schema', 'viralizahost')
const CHECK_ONLY = args.includes('--check-only')
const URL = process.env.SOURCE_DATABASE_URL
if (!URL) { console.error('Defina SOURCE_DATABASE_URL'); process.exit(1) }

const client = new pg.Client({ connectionString: URL, ssl: /supabase\.(co|com)/.test(URL) ? { rejectUnauthorized: false } : undefined })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

// ── Catálogo ─────────────────────────────────────────────────────────────
const tables = (await q(`
  select c.oid, c.relname from pg_class c
  where c.relnamespace = $1::regnamespace and c.relkind in ('r','p') order by c.relname`, [SCHEMA]))

const enums = Object.fromEntries((await q(`
  select t.typname, array_agg(e.enumlabel::text order by e.enumsortorder) labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid group by t.typname`)).map(r => [r.typname, r.labels]))

const columns = await q(`
  select table_name, column_name, ordinal_position, data_type, udt_name, is_nullable,
         column_default, numeric_precision, numeric_scale, character_maximum_length,
         is_generated, generation_expression, is_identity
  from information_schema.columns where table_schema = $1 order by table_name, ordinal_position`, [SCHEMA])

const indexes = await q(`
  select i.indrelid::regclass::text tbl, ic.relname idxname, i.indisunique uniq, i.indisprimary prim,
         pg_get_expr(i.indpred, i.indrelid) pred,
         array(select a.attname::text from unnest(i.indkey) with ordinality k(attnum, ord)
               join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum order by k.ord) cols,
         pg_get_indexdef(i.indexrelid) def
  from pg_index i join pg_class ic on ic.oid = i.indexrelid
  where i.indrelid in (select oid from pg_class where relnamespace = $1::regnamespace)`, [SCHEMA])

const fks = await q(`
  select con.conname, con.conrelid::regclass::text tbl, con.confrelid::regclass::text reftbl,
         con.confdeltype deltype, con.confupdtype updtype,
         array(select a.attname::text from unnest(con.conkey) with ordinality k(n, o) join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.o) cols,
         array(select a.attname::text from unnest(con.confkey) with ordinality k(n, o) join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.o) refcols
  from pg_constraint con where con.contype = 'f' and con.connamespace = $1::regnamespace`, [SCHEMA])

const checks = await q(`
  select conrelid::regclass::text tbl, conname, pg_get_constraintdef(oid) def
  from pg_constraint where contype = 'c' and connamespace = $1::regnamespace`, [SCHEMA])

const triggers = await q(`
  select event_object_table tbl, trigger_name, action_timing, event_manipulation, action_statement
  from information_schema.triggers where event_object_schema = $1`, [SCHEMA])

await client.end()

// ── Utilitários ──────────────────────────────────────────────────────────
const bare = (regclass) => regclass.replace(/^"?[a-z_]+"?\./, '').replace(/"/g, '')
const mapTable = (regclass) => {
  if (regclass === 'auth.users') return 'auth_users'
  return bare(regclass)
}
const qi = (s) => '`' + s.replace(/`/g, '``') + '`'
const sqlStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'"

const warnings = []
const tableNames = tables.map(t => t.relname)
const colsBy = {}
for (const c of columns) (colsBy[c.table_name] ??= []).push(c)

// colunas que participam em chaves/índices precisam de VARCHAR (TEXT não indexa sem prefixo)
const keyCols = {}
const markKey = (t, c) => { (keyCols[t] ??= new Set()).add(c) }
for (const ix of indexes) for (const c of ix.cols) markKey(bare(ix.tbl), c)
for (const fk of fks) { for (const c of fk.cols) markKey(bare(fk.tbl), c); for (const c of fk.refcols) markKey(mapTable(fk.reftbl), c) }

function colType(t, c) {
  const isKey = keyCols[t]?.has(c.column_name)
  switch (c.udt_name) {
    case 'uuid': return { sql: 'CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci', kind: 'uuid' }
    case 'text': case 'varchar': case 'bpchar': case 'citext': {
      if (c.character_maximum_length) return { sql: `VARCHAR(${c.character_maximum_length})`, kind: 'text' }
      return { sql: isKey ? 'VARCHAR(255)' : 'TEXT', kind: 'text' }
    }
    case 'int2': return { sql: 'SMALLINT', kind: 'int' }
    case 'int4': return { sql: 'INT', kind: 'int' }
    case 'int8': return { sql: 'BIGINT', kind: 'int' }
    case 'float4': return { sql: 'FLOAT', kind: 'float' }
    case 'float8': return { sql: 'DOUBLE', kind: 'float' }
    case 'numeric': {
      if (c.numeric_precision) return { sql: `DECIMAL(${c.numeric_precision},${c.numeric_scale ?? 0})`, kind: 'decimal' }
      warnings.push(`${t}.${c.column_name}: numeric sem precisão → DECIMAL(30,10)`)
      return { sql: 'DECIMAL(30,10)', kind: 'decimal' }
    }
    case 'bool': return { sql: 'TINYINT(1)', kind: 'bool' }
    case 'timestamptz': case 'timestamp': return { sql: 'DATETIME(6)', kind: 'datetime' }
    case 'date': return { sql: 'DATE', kind: 'date' }
    case 'time': case 'timetz': return { sql: 'TIME(6)', kind: 'text' }
    case 'json': case 'jsonb': return { sql: 'LONGTEXT', kind: 'json', json: true }
    case 'inet': case 'cidr': return { sql: 'VARCHAR(45)', kind: 'text' }
    case 'bytea': return { sql: 'LONGBLOB', kind: 'text' }
    default:
      if (c.data_type === 'ARRAY') return { sql: 'LONGTEXT', kind: 'array', json: true }
      if (enums[c.udt_name]) {
        const longest = Math.max(...enums[c.udt_name].map(l => l.length))
        return { sql: `VARCHAR(${Math.max(32, longest)})`, kind: 'enum', enumValues: enums[c.udt_name] }
      }
      warnings.push(`${t}.${c.column_name}: tipo ${c.udt_name} desconhecido → TEXT`)
      return { sql: 'TEXT', kind: 'text' }
  }
}

function convertDefault(t, c, kind) {
  const d = c.column_default
  if (d == null) return { sql: null }
  let m
  if (/^(now\(\)|CURRENT_TIMESTAMP)$/i.test(d)) return { sql: 'CURRENT_TIMESTAMP(6)', app: 'now' }
  if (/^(gen_random_uuid|uuid_generate_v4|public\.uuid_generate_v4|extensions\.uuid_generate_v4)\(\)$/.test(d)) return { sql: null, app: 'uuid' }
  if (d === 'CURRENT_DATE') return { sql: '(CURDATE())', app: 'today' }
  if ((m = d.match(/^\(now\(\) \+ '(\d+) days'::interval\)$/))) return { sql: `(CURRENT_TIMESTAMP(6) + INTERVAL ${m[1]} DAY)`, app: `now+${m[1]}d` }
  if (d === 'true') return { sql: '1', value: true }
  if (d === 'false') return { sql: '0', value: false }
  if (/^-?\d+(\.\d+)?$/.test(d)) return { sql: d, value: Number(d) }
  if ((m = d.match(/^'((?:[^']|'')*)'::(?:text|character varying|jsonb|json|[a-z_.]+)(\[\])?$/s))) {
    const raw = m[1].replace(/''/g, "'")
    if (m[2] === '[]' || kind === 'array') {
      const arr = raw === '{}' ? [] : raw.replace(/^\{|\}$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''))
      return { sql: `(${sqlStr(JSON.stringify(arr))})`, value: arr }
    }
    if (kind === 'json') return { sql: `(${sqlStr(raw)})`, value: JSON.parse(raw) }
    return { sql: sqlStr(raw), value: raw }
  }
  // concatenações de literais de texto: ('a'::text || 'b'::text)
  if (/^\(*'/.test(d) && !/\(\)/.test(d) && /\|\|/.test(d)) {
    const parts = [...d.matchAll(/'((?:[^']|'')*)'::text/gs)].map(p => p[1].replace(/''/g, "'"))
    const raw = parts.join('')
    return { sql: sqlStr(raw), value: raw }
  }
  if (/^\(*\(*'INV-'/.test(d)) return { sql: null, app: 'invoice_number' }
  warnings.push(`${t}.${c.column_name}: default "${d}" não convertido (a aplicação deve preencher)`)
  return { sql: null }
}

function convertCheck(t, def, colKinds) {
  let s = def.replace(/^CHECK \(/, '(')
  // (col = ANY (ARRAY['a'::text, 'b'::text]))
  s = s.replace(/\(?\(?([a-z_]+)\)?(?:::text)? = ANY \(\(?ARRAY\[([^\]]+)\]\)?(?:::text\[\])?\)\)?/g,
    (_, col, list) => `(${qi(col)} IN (${list.split(',').map(x => x.trim().replace(/::[a-z_. ]+$/i, '')).join(', ')}))`)
  s = s.replace(/'((?:[^']|'')*)'::[a-z_. ]+/gi, "'$1'")
  s = s.replace(/\((-?\d+(?:\.\d+)?)\)::numeric/g, '$1')
  s = s.replace(/length\(TRIM\(BOTH FROM ([a-z_]+)\)\)/g, 'CHAR_LENGTH(TRIM($1))')
  s = s.replace(/\blength\(/g, 'CHAR_LENGTH(')
  if (/::|ANY|ARRAY|~|SIMILAR/.test(s)) { warnings.push(`${t}: CHECK não convertido: ${def}`); return null }
  return s
}

// ── Construção ───────────────────────────────────────────────────────────
const fkAction = (c) => ({ a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' }[c])
const meta = { tables: {} }
const ddl = []
const updatedAtTables = new Set(triggers.filter(tr => /updated_at/.test(tr.action_statement) && tr.action_timing === 'BEFORE').map(tr => tr.tbl))

// ordem topológica pelas FKs (pais antes dos filhos)
const deps = Object.fromEntries(tableNames.map(t => [t, new Set()]))
for (const fk of fks) { const a = bare(fk.tbl), b = mapTable(fk.reftbl); if (a !== b && deps[a] && deps[b]) deps[a].add(b) }
const ordered = []; const seen = new Set()
const visit = (t, stack = new Set()) => { if (seen.has(t)) return; if (stack.has(t)) return; stack.add(t); for (const d of deps[t]) visit(d, stack); seen.add(t); ordered.push(t) }
tableNames.forEach(t => visit(t))

for (const t of ordered) {
  const cols = colsBy[t] ?? []
  const tm = { columns: {}, pk: [], uniques: [], fks: [], autoUpdatedAt: updatedAtTables.has(t) && cols.some(c => c.column_name === 'updated_at') }
  const lines = []
  for (const c of cols) {
    const ty = colType(t, c)
    const def = convertDefault(t, c, ty.kind)
    const cm = { type: ty.kind }
    if (c.is_nullable === 'YES') cm.nullable = true
    if (ty.enumValues) cm.enumValues = ty.enumValues
    if (def.app) cm.default = def.app
    else if (def.value !== undefined) cm.default = { value: def.value }
    let line = `  ${qi(c.column_name)} ${ty.sql}`
    if (c.is_generated === 'ALWAYS') {
      cm.generated = true
      let expr = c.generation_expression.replace(/\(\(?([a-z_]+) \|\| ([a-z_]+)\)?\)/, 'CONCAT($1, $2)')
      line = `  ${qi(c.column_name)} VARCHAR(512) GENERATED ALWAYS AS (${expr}) STORED`
    } else {
      line += c.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'
      if (def.sql) line += ` DEFAULT ${def.sql}`
    }
    lines.push(line)
    tm.columns[c.column_name] = cm
  }
  // PK
  const pk = indexes.find(ix => bare(ix.tbl) === t && ix.prim)
  if (pk) { tm.pk = pk.cols; lines.push(`  PRIMARY KEY (${pk.cols.map(qi).join(', ')})`) }
  // UNIQUE / INDEX
  for (const ix of indexes.filter(ix => bare(ix.tbl) === t && !ix.prim)) {
    const desc = /DESC\)/.test(ix.def)
    const colList = ix.cols.map(c => qi(c) + (desc && ix.cols.length === 1 ? ' DESC' : '')).join(', ')
    if (ix.uniq) {
      if (ix.pred && ix.cols.length === 1 && new RegExp(`^\\(*${ix.cols[0]}( = true)?\\)*$`).test(ix.pred)) {
        // índice único parcial do tipo "UNIQUE(active) WHERE active" → coluna gerada
        const g = `${ix.cols[0]}_unique_key`
        lines.splice(lines.length, 0, `  ${qi(g)} TINYINT GENERATED ALWAYS AS (IF(${qi(ix.cols[0])}, 1, NULL)) VIRTUAL`)
        tm.columns[g] = { type: 'int', nullable: true, generated: true, internal: true }
        lines.push(`  UNIQUE KEY ${qi(ix.idxname.slice(0, 64))} (${qi(g)})`)
      } else {
        lines.push(`  UNIQUE KEY ${qi(ix.idxname.slice(0, 64))} (${colList})`)
        if (ix.pred && !/IS NOT NULL/.test(ix.pred)) warnings.push(`${t}.${ix.idxname}: predicado "${ix.pred}" ignorado`)
      }
      tm.uniques.push(ix.cols)
    } else {
      lines.push(`  KEY ${qi(ix.idxname.slice(0, 64))} (${colList})`)
    }
  }
  // CHECKs (incl. enums)
  let n = 0
  for (const [cname, cm] of Object.entries(tm.columns)) {
    if (cm.enumValues) lines.push(`  CONSTRAINT ${qi(`chk_${t}_${cname}`.slice(0, 64))} CHECK (${qi(cname)} IN (${cm.enumValues.map(sqlStr).join(', ')}))`)
    if (cm.type === 'json' || cm.type === 'array') lines.push(`  CONSTRAINT ${qi(`chk_${t}_${cname}_json`.slice(0, 64))} CHECK (${qi(cname)} IS NULL OR JSON_VALID(${qi(cname)}))`)
  }
  for (const ck of checks.filter(c => bare(c.tbl) === t)) {
    const conv = convertCheck(t, ck.def)
    if (conv) lines.push(`  CONSTRAINT ${qi(ck.conname.slice(0, 64))} CHECK ${conv}`)
    n++
  }
  // FKs
  for (const fk of fks.filter(f => bare(f.tbl) === t)) {
    const ref = mapTable(fk.reftbl)
    if (ref !== 'auth_users' && !tableNames.includes(ref)) { warnings.push(`${t}: FK para ${fk.reftbl} ignorada`); continue }
    tm.fks.push({ name: fk.conname, columns: fk.cols, refTable: ref, refColumns: fk.refcols })
    lines.push(`  CONSTRAINT ${qi(fk.conname.slice(0, 64))} FOREIGN KEY (${fk.cols.map(qi).join(', ')}) REFERENCES ${qi(ref)} (${fk.refcols.map(qi).join(', ')}) ON DELETE ${fkAction(fk.deltype)} ON UPDATE ${fkAction(fk.updtype) === 'NO ACTION' ? 'CASCADE' : fkAction(fk.updtype)}`)
  }
  ddl.push(`-- ─── ${t} ${'─'.repeat(Math.max(0, 66 - t.length))}\nCREATE TABLE IF NOT EXISTS ${qi(t)} (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`)
  meta.tables[t] = tm
}

// ── Saída ────────────────────────────────────────────────────────────────
const AUTH_STORAGE = readFileSync(join(ROOT, 'scripts/mariadb/auth-storage.sql'), 'utf8')
const header = `-- ═══════════════════════════════════════════════════════════════════════
-- ViralizaHost — Schema MariaDB 10.11 (gerado por scripts/mariadb/generate-schema.mjs)
-- Origem: PostgreSQL schema "${SCHEMA}" (Supabase)
-- Importar no phpMyAdmin: base viralizahost_viralizaHost → Importar → este ficheiro.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS; não apaga dados existentes.
-- Datas: guardadas em UTC (DATETIME(6)); a aplicação liga com time_zone '+00:00'.
-- ═══════════════════════════════════════════════════════════════════════
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

`
const footer = `\nSET FOREIGN_KEY_CHECKS = 1;\n`
const sql = header + AUTH_STORAGE + '\n' + ddl.join('\n') + footer

const metaTs = `// GERADO por scripts/mariadb/generate-schema.mjs — não editar à mão.
// Metadados do schema MariaDB usados pela camada de acesso (src/lib/db).
import type { SchemaMeta } from './types'

export const schemaMeta: SchemaMeta = ${JSON.stringify(meta, null, 2)}
`

if (CHECK_ONLY) {
  const current = readFileSync(join(ROOT, 'src/lib/db/schema.generated.ts'), 'utf8')
  const m = current.match(/export const schemaMeta: SchemaMeta = ([\s\S]+)\n$/)
  const old = JSON.parse(m[1])
  let diffs = 0
  for (const [t, tm] of Object.entries(meta.tables)) {
    if (!old.tables[t]) { console.log(`+ tabela nova na origem: ${t}`); diffs++; continue }
    for (const [c, cm] of Object.entries(tm.columns)) {
      const o = old.tables[t].columns[c]
      if (!o) { console.log(`+ coluna nova na origem: ${t}.${c} (${cm.type})`); diffs++ }
      else if (o.type !== cm.type) { console.log(`~ tipo diferente: ${t}.${c} ${o.type} → ${cm.type}`); diffs++ }
    }
    for (const c of Object.keys(old.tables[t].columns)) if (!tm.columns[c]) { console.log(`- coluna ausente na origem: ${t}.${c}`); diffs++ }
  }
  for (const t of Object.keys(old.tables)) if (!meta.tables[t]) { console.log(`- tabela ausente na origem: ${t}`); diffs++ }
  console.log(diffs ? `\n${diffs} diferença(s). Regenere sem --check-only e reveja o diff.` : 'Schema da origem igual ao versionado.')
} else {
  mkdirSync(join(ROOT, 'database/mariadb'), { recursive: true })
  writeFileSync(join(ROOT, 'database/mariadb/001_schema.sql'), sql)
  writeFileSync(join(ROOT, 'src/lib/db/schema.generated.ts'), metaTs)
  console.log(`✔ ${ordered.length} tabelas → database/mariadb/001_schema.sql e src/lib/db/schema.generated.ts`)
}
if (warnings.length) { console.log('\nAvisos:'); warnings.forEach(w => console.log('  - ' + w)) }
