#!/usr/bin/env node
/**
 * ViralizaHost — Gera o schema MySQL/MariaDB a partir do schema PostgreSQL `viralizahost`.
 *
 * Lê o catálogo do PostgreSQL (Supabase real ou uma réplica local das migrations) e escreve:
 *   database/mysql/001_schema.sql          — DDL para MariaDB 10.6+ / MySQL 8.0+
 *   src/lib/db/schema.generated.ts         — metadados usados pela camada de dados da aplicação
 *   scripts/mysql-migration/schema.json    — metadados usados pelos scripts de migração de dados
 *
 * Uso:
 *   PG_URL=postgres://... node scripts/mysql-migration/generate-schema.mjs
 *
 * Regras de conversão (resumo — ver database/mysql/README.md):
 *   uuid → CHAR(36) ascii_bin · text → VARCHAR(255)/MEDIUMTEXT utf8mb4_bin · jsonb/json/text[] → JSON
 *   timestamptz/timestamp → DATETIME(6) (UTC) · date → DATE · numeric(p,s) → DECIMAL(p,s)
 *   boolean → TINYINT(1) · enum → ENUM(...) · inet → VARCHAR(45)
 *   triggers updated_at → ON UPDATE CURRENT_TIMESTAMP(6); restantes triggers/funções → aplicação
 *   índices únicos parciais → coluna gerada + UNIQUE; FKs para auth.users → removidas (Auth fica no Supabase)
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCHEMA = 'viralizahost'
const PG_URL = process.env.PG_URL
if (!PG_URL) { console.error('Defina PG_URL'); process.exit(1) }

const client = new pg.Client({ connectionString: PG_URL })
await client.connect()
const q = async (sql, params = []) => (await client.query(sql, params)).rows

/* ─── Introspeção ─────────────────────────────────────────────────────── */
const tables = (await q(`
  SELECT c.relname AS name, obj_description(c.oid) AS comment
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY c.relname`, [SCHEMA])).map(r => r.name)

const columns = await q(`
  SELECT c.table_name, c.column_name, c.ordinal_position, c.data_type, c.udt_name, c.is_nullable,
         c.column_default, c.character_maximum_length, c.numeric_precision, c.numeric_scale,
         c.is_generated, c.generation_expression
  FROM information_schema.columns c
  WHERE c.table_schema = $1 ORDER BY c.table_name, c.ordinal_position`, [SCHEMA])

const enums = {}
for (const r of await q(`
  SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace ORDER BY t.typname, e.enumsortorder`)) {
  ;(enums[r.typname] ??= []).push(r.enumlabel)
}

const constraints = await q(`
  SELECT cl.relname AS table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) AS def,
         (SELECT array_agg(a.attname ORDER BY k.ord) FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum) AS cols,
         fcl.relname AS ref_table, fn.nspname AS ref_schema,
         (SELECT array_agg(a.attname ORDER BY k.ord) FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum) AS ref_cols,
         con.confdeltype, con.confupdtype
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
  LEFT JOIN pg_class fcl ON fcl.oid = con.confrelid LEFT JOIN pg_namespace fn ON fn.oid = fcl.relnamespace
  WHERE n.nspname = $1 ORDER BY cl.relname, con.conname`, [SCHEMA])

const indexes = await q(`
  SELECT t.relname AS table_name, i.relname AS index_name, ix.indisunique AS is_unique,
         pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
         (SELECT array_agg(a.attname ORDER BY k.ord) FROM unnest(ix.indkey) WITH ORDINALITY k(attnum, ord)
            JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum) AS cols,
         (SELECT bool_or(k.attnum = 0) FROM unnest(ix.indkey) k(attnum)) AS has_expr,
         (SELECT array_agg((o & 1) = 1 ORDER BY ord) FROM unnest(ix.indoption) WITH ORDINALITY x(o, ord)) AS desc_flags,
         EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = ix.indexrelid) AS backs_constraint
  FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = $1 AND NOT ix.indisprimary ORDER BY t.relname, i.relname`, [SCHEMA])

const updatedAtTriggers = new Set((await q(`
  SELECT DISTINCT event_object_table AS t FROM information_schema.triggers
  WHERE trigger_schema = $1 AND action_timing = 'BEFORE' AND event_manipulation = 'UPDATE'
    AND action_statement ~ '(set_updated_at|updated_at)'`, [SCHEMA])).map(r => r.t))

await client.end()

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const qi = s => '`' + s.replace(/`/g, '``') + '`'
const sqlStr = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'"
const pgArray = a => (Array.isArray(a) ? a : String(a ?? '').replace(/^{|}$/g, '').split(',').filter(Boolean))

const byTable = {}
for (const t of tables) byTable[t] = { name: t, columns: [], pk: [], uniques: [], fks: [], checks: [], indexes: [], warnings: [] }
for (const c of columns) byTable[c.table_name]?.columns.push(c)
for (const c of constraints) {
  const t = byTable[c.table_name]; if (!t) continue
  const cols = pgArray(c.cols)
  if (c.contype === 'p') t.pk = cols
  else if (c.contype === 'u') t.uniques.push({ name: c.conname, cols })
  else if (c.contype === 'f') t.fks.push({ name: c.conname, cols, refSchema: c.ref_schema, refTable: c.ref_table, refCols: pgArray(c.ref_cols), onDelete: c.confdeltype, onUpdate: c.confupdtype })
  else if (c.contype === 'c') t.checks.push({ name: c.conname, def: c.def })
}
for (const ix of indexes) {
  const t = byTable[ix.table_name]; if (!t || ix.backs_constraint) continue
  t.indexes.push({ name: ix.index_name, unique: ix.is_unique, cols: pgArray(ix.cols), predicate: ix.predicate, hasExpr: ix.has_expr, desc: pgArray(ix.desc_flags).map(v => v === true || v === 't') })
}

// Colunas de texto que participam em chaves/índices precisam de VARCHAR
const keyed = new Set()
for (const t of Object.values(byTable)) {
  const mark = cols => cols.forEach(c => keyed.add(`${t.name}.${c}`))
  mark(t.pk); t.uniques.forEach(u => mark(u.cols)); t.fks.forEach(f => mark(f.cols)); t.indexes.forEach(i => mark(i.cols))
  t.fks.forEach(f => f.refSchema === SCHEMA && f.refCols.forEach(c => keyed.add(`${f.refTable}.${c}`)))
}

/** Tipo lógico usado pela aplicação para (de)serializar valores. */
function kindOf(c) {
  if (c.data_type === 'USER-DEFINED' && enums[c.udt_name]) return 'enum'
  if (c.data_type === 'ARRAY') return 'array'
  switch (c.data_type) {
    case 'uuid': return 'uuid'
    case 'text': case 'character varying': case 'character': case 'citext': return 'text'
    case 'jsonb': case 'json': return 'json'
    case 'boolean': return 'bool'
    case 'integer': case 'smallint': return 'int'
    case 'bigint': return 'bigint'
    case 'numeric': return 'decimal'
    case 'real': case 'double precision': return 'float'
    case 'timestamp with time zone': case 'timestamp without time zone': return 'datetime'
    case 'date': return 'date'
    case 'time without time zone': return 'time'
    case 'inet': return 'text'
    default: throw new Error(`Tipo não suportado: ${c.table_name}.${c.column_name} ${c.data_type}`)
  }
}

function mysqlType(t, c) {
  const kind = kindOf(c)
  const key = keyed.has(`${t.name}.${c.column_name}`)
  switch (kind) {
    case 'uuid': return 'CHAR(36) CHARACTER SET ascii COLLATE ascii_bin'
    case 'enum': return `ENUM(${enums[c.udt_name].map(sqlStr).join(', ')}) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
    case 'text':
      if (c.data_type === 'inet') return 'VARCHAR(45) CHARACTER SET ascii COLLATE ascii_bin'
      if (c.character_maximum_length && c.character_maximum_length <= 1000) return `VARCHAR(${c.character_maximum_length}) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
      return key ? 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin' : 'MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin'
    case 'json': case 'array': return 'JSON'
    case 'bool': return 'TINYINT(1)'
    case 'int': return c.data_type === 'smallint' ? 'SMALLINT' : 'INT'
    case 'bigint': return 'BIGINT'
    case 'decimal': return c.numeric_precision ? `DECIMAL(${c.numeric_precision},${c.numeric_scale ?? 0})` : 'DECIMAL(30,10)'
    case 'float': return 'DOUBLE'
    case 'datetime': return 'DATETIME(6)'
    case 'date': return 'DATE'
    case 'time': return 'TIME(6)'
  }
}

/** Converte o DEFAULT do PostgreSQL. Devolve { sql } ou { appDefault } quando só a aplicação o pode reproduzir. */
function mysqlDefault(t, c) {
  const d = c.column_default
  if (d == null) return null
  const kind = kindOf(c)
  const lit = d.match(/^'((?:[^']|'')*)'::[\w."]+(\[\])?$/s)
  if (/^(now\(\)|CURRENT_TIMESTAMP|timezone\('utc'::text, now\(\)\))$/i.test(d)) return { sql: kind === 'date' ? '(CURRENT_DATE)' : 'CURRENT_TIMESTAMP(6)' }
  if (d === 'CURRENT_DATE') return { sql: kind === 'date' ? '(CURRENT_DATE)' : '(CURRENT_DATE)' }
  if (/^(gen_random_uuid|uuid_generate_v4|extensions\.uuid_generate_v4)\(\)$/.test(d)) return { sql: '(UUID())', appDefault: 'uuid' }
  if (d === 'true' || d === 'false') return { sql: d === 'true' ? '1' : '0' }
  if (/^-?\d+(\.\d+)?$/.test(d) || /^\(-?\d+(\.\d+)?\)::\w+$/.test(d)) return { sql: d.replace(/[()]|::\w+/g, '') }
  if (lit) {
    const v = lit[1].replace(/''/g, "'")
    if (kind === 'array') return { sql: `(${sqlStr(JSON.stringify(pgArray(v)))})` }
    if (kind === 'json') return { sql: `(${sqlStr(JSON.stringify(JSON.parse(v)))})` }
    if (kind === 'bool') return { sql: /^(t|true)$/i.test(v) ? '1' : '0' }
    if (kind === 'text' && !/^VARCHAR/.test(mysqlType(t, c))) return { sql: `(${sqlStr(v)})` }
    return { sql: sqlStr(v) }
  }
  // Expressões conhecidas
  if (/^\(now\(\) \+ '(\d+) days?'::interval\)$/.test(d)) return { sql: `(CURRENT_TIMESTAMP(6) + INTERVAL ${d.match(/'(\d+)/)[1]} DAY)` }
  if (/^\(+'INV-'::text \|\| to_char\(now\(\), 'YYYY'::text\)\)/.test(d))
    return { sql: "(CONCAT('INV-', DATE_FORMAT(CURRENT_TIMESTAMP, '%Y'), '-', LPAD(FLOOR(RAND() * 99999), 5, '0')))" }
  if (/^\(+'.*'::text( \|\| '.*'::text)+\)+$/s.test(d)) {
    const parts = [...d.matchAll(/'((?:[^']|'')*)'::text/gs)].map(m => m[1].replace(/''/g, "'"))
    return { sql: `(${sqlStr(parts.join(''))})` }
  }
  throw new Error(`DEFAULT não convertido: ${t.name}.${c.column_name} = ${d}`)
}

function translateCheck(def) {
  let s = def.replace(/^CHECK \((.*)\)$/s, '$1')
  s = s.replace(/\(([a-z_]+) = ANY \(ARRAY\[(.*?)\]\)\)/g, (_, col, list) =>
    `(${qi(col)} IN (${list.split(',').map(x => x.trim().replace(/::[\w.]+$/, '')).join(', ')}))`)
  s = s.replace(/\((-?\d+(?:\.\d+)?)\)::numeric/g, '$1')
  s = s.replace(/'([^']*)'::text/g, "'$1'")
  s = s.replace(/length\(TRIM\(BOTH FROM ([a-z_]+)\)\)/g, 'CHAR_LENGTH(TRIM($1))')
  s = s.replace(/\b(IS NOT NULL|IS NULL|AND|OR)\b/g, ' $1 ').replace(/\s+/g, ' ')
  s = s.replace(/(?<![`'\w])([a-z_][a-z0-9_]*)(?=\s*(>=|<=|=|<|>|IS|IN\b))/g, m => (/^(AND|OR|IN|IS|NULL|NOT)$/i.test(m) ? m : qi(m)))
  if (/::|ANY|ARRAY|~/.test(s)) throw new Error(`CHECK não convertido: ${def}`)
  return s.trim()
}

const fkAction = a => ({ a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' }[a] ?? 'NO ACTION')

/* ─── DDL ─────────────────────────────────────────────────────────────── */
const out = []
const meta = {}
const notes = []
out.push(`-- ============================================================
-- ViralizaHost — schema MySQL/MariaDB (gerado por scripts/mysql-migration/generate-schema.mjs)
-- Origem: PostgreSQL schema "${SCHEMA}" · ${tables.length} tabelas · gerado em ${new Date().toISOString()}
-- Compatível com MariaDB 10.6+ e MySQL 8.0.16+ · utf8mb4 · datas em UTC
-- Idempotente (CREATE TABLE IF NOT EXISTS). Importar pelo phpMyAdmin ou: mysql BASE < 001_schema.sql
-- Não usa triggers, procedimentos nem eventos (a lógica correspondente está na aplicação).
-- ============================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;
`)

for (const t of Object.values(byTable)) {
  const lines = []
  const tmeta = { pk: t.pk, columns: {}, fks: [], generated: [], appDefaults: {} }
  for (const c of t.columns) {
    const kind = kindOf(c)
    const type = mysqlType(t, c)
    const colMeta = { kind, nullable: c.is_nullable === 'YES' }
    if (kind === 'enum') colMeta.values = enums[c.udt_name]
    if (kind === 'decimal') colMeta.scale = c.numeric_scale ?? null
    if (c.is_generated === 'ALWAYS') {
      // Única coluna gerada conhecida: domains.full_domain = name || extension
      const expr = c.generation_expression.replace(/\(?([a-z_]+) \|\| ([a-z_]+)\)?/, (_, a, b) => `CONCAT(${qi(a)}, ${qi(b)})`)
      if (/\|\||::/.test(expr)) throw new Error(`Coluna gerada não convertida: ${t.name}.${c.column_name}`)
      lines.push(`  ${qi(c.column_name)} ${type} GENERATED ALWAYS AS (${expr}) STORED`)
      tmeta.generated.push(c.column_name); colMeta.generated = true
      tmeta.columns[c.column_name] = colMeta
      continue
    }
    let line = `  ${qi(c.column_name)} ${type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
    const def = mysqlDefault(t, c)
    if (def) {
      line += ` DEFAULT ${def.sql}`
      if (def.appDefault) tmeta.appDefaults[c.column_name] = def.appDefault
      colMeta.hasDefault = true
    }
    if (c.column_name === 'updated_at' && kind === 'datetime' && updatedAtTriggers.has(t.name)) line += ' ON UPDATE CURRENT_TIMESTAMP(6)'
    lines.push(line)
    tmeta.columns[c.column_name] = colMeta
  }
  if (t.pk.length) lines.push(`  PRIMARY KEY (${t.pk.map(qi).join(', ')})`)
  for (const u of t.uniques) lines.push(`  UNIQUE KEY ${qi(u.name.slice(0, 64))} (${u.cols.map(qi).join(', ')})`)
  for (const ix of t.indexes) {
    if (ix.hasExpr) throw new Error(`Índice por expressão não suportado: ${ix.name}`)
    let cols = ix.cols.map((c, i) => qi(c) + (ix.desc[i] ? ' DESC' : ''))
    if (ix.predicate) {
      const notNull = ix.predicate.match(/^\((\w+) IS NOT NULL\)$/)
      const eqTrue = ix.predicate.match(/^\((\w+) = true\)$/)
      if (notNull && ix.cols.length === 1 && ix.cols[0] === notNull[1]) {
        notes.push(`${t.name}.${ix.name}: índice parcial "${ix.predicate}" → índice sem condição (no MySQL vários NULL não colidem num UNIQUE; comportamento igual).`)
      } else if (eqTrue && ix.unique && ix.cols.length === 1 && ix.cols[0] === eqTrue[1]) {
        const gen = `${eqTrue[1]}_unique_key`
        lines.splice(lines.findIndex(l => l.startsWith('  PRIMARY KEY')), 0,
          `  ${qi(gen)} TINYINT GENERATED ALWAYS AS (IF(${qi(eqTrue[1])} = 1, 1, NULL)) STORED`)
        tmeta.generated.push(gen); tmeta.columns[gen] = { kind: 'int', nullable: true, generated: true, internal: true }
        cols = [qi(gen)]
        notes.push(`${t.name}.${ix.name}: UNIQUE parcial "${ix.predicate}" → coluna gerada ${gen} + UNIQUE.`)
      } else throw new Error(`Índice parcial não suportado: ${ix.name} ${ix.predicate}`)
    }
    lines.push(`  ${ix.unique ? 'UNIQUE KEY' : 'KEY'} ${qi(ix.name.slice(0, 64))} (${cols.join(', ')})`)
  }
  for (const f of t.fks) {
    if (f.refSchema !== SCHEMA) {
      notes.push(`${t.name}.${f.cols.join(',')}: FK para ${f.refSchema}.${f.refTable} removida (Auth fica no Supabase; integridade garantida pela aplicação).`)
      tmeta.fks.push({ cols: f.cols, refTable: `${f.refSchema}.${f.refTable}`, refCols: f.refCols, external: true })
      continue
    }
    lines.push(`  CONSTRAINT ${qi(f.name.slice(0, 64))} FOREIGN KEY (${f.cols.map(qi).join(', ')}) REFERENCES ${qi(f.refTable)} (${f.refCols.map(qi).join(', ')}) ON DELETE ${fkAction(f.onDelete)} ON UPDATE ${fkAction(f.onUpdate)}`)
    tmeta.fks.push({ name: f.name, cols: f.cols, refTable: f.refTable, refCols: f.refCols })
  }
  for (const ck of t.checks) {
    if (/IS NOT NULL$/.test(ck.def) && !/AND|OR/.test(ck.def)) continue
    lines.push(`  CONSTRAINT ${qi(ck.name.slice(0, 64))} CHECK (${translateCheck(ck.def)})`)
  }
  out.push(`-- ── ${t.name} ${'─'.repeat(Math.max(0, 56 - t.name.length))}
CREATE TABLE IF NOT EXISTS ${qi(t.name)} (
${lines.join(',\n')}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`)
  meta[t.name] = tmeta
}

out.push(`-- Linha única da configuração do topo da página inicial (equivalente à migração 20261118_000000_home_hero.sql)
INSERT IGNORE INTO \`site_home_hero\` (\`id\`, \`mode\`) VALUES (1, 'carousel');

-- Controlo de versão do schema e da migração de dados
CREATE TABLE IF NOT EXISTS \`_migration_state\` (
  \`table_name\` VARCHAR(64) CHARACTER SET ascii NOT NULL,
  \`rows_imported\` BIGINT NOT NULL DEFAULT 0,
  \`last_batch_at\` DATETIME(6) NULL,
  \`completed_at\` DATETIME(6) NULL,
  \`source_count\` BIGINT NULL,
  \`checksum\` VARCHAR(64) NULL,
  PRIMARY KEY (\`table_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
`)

mkdirSync(join(ROOT, 'database/mysql'), { recursive: true })
mkdirSync(join(ROOT, 'src/lib/db'), { recursive: true })
writeFileSync(join(ROOT, 'database/mysql/001_schema.sql'), out.join('\n'))
writeFileSync(join(ROOT, 'scripts/mysql-migration/schema.json'), JSON.stringify(meta, null, 2) + '\n')
writeFileSync(join(ROOT, 'src/lib/db/schema.generated.ts'),
  `/* Gerado por scripts/mysql-migration/generate-schema.mjs — não editar à mão. */\n` +
  `import type { DbSchema } from './types'\n\nexport const SCHEMA: DbSchema = ${JSON.stringify(meta, null, 2)}\n`)
console.log(`OK: ${tables.length} tabelas`)
for (const n of notes) console.log('  nota:', n)
