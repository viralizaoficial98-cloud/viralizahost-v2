#!/usr/bin/env node
/**
 * Regenera src/lib/db/schema.generated.ts a partir do MariaDB (fonte da verdade
 * depois da migração). Preserva o tipo lógico já conhecido de cada coluna
 * (ex.: arrays PostgreSQL guardados como JSON) e acrescenta colunas/tabelas novas.
 *
 *   node --env-file=.env.local scripts/mariadb/generate-meta.mjs [--check]
 */
import mysql from 'mysql2/promise'
import { readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'src/lib/db/schema.generated.ts')
const PLATFORM = /^(auth_|storage_|vh_)/

const cur = await readFile(OUT, 'utf8')
const OLD = JSON.parse(cur.slice(cur.indexOf('= {') + 2))

const conn = await mysql.createConnection({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD ?? '',
})
const q = async (sql, p = []) => (await conn.query(sql, p))[0]
const db = process.env.DB_NAME
const cols = await q(`SELECT TABLE_NAME t, COLUMN_NAME c, COLUMN_TYPE ct, DATA_TYPE dt, IS_NULLABLE n, COLUMN_DEFAULT d, EXTRA x, GENERATION_EXPRESSION g
  FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`, [db])
const checks = await q(`SELECT TABLE_NAME t, CHECK_CLAUSE cc FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ?`, [db])
const keys = await q(`SELECT s.TABLE_NAME t, s.INDEX_NAME i, s.NON_UNIQUE nu, GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) cs
  FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = ? GROUP BY s.TABLE_NAME, s.INDEX_NAME, s.NON_UNIQUE`, [db])
const fks = await q(`SELECT k.TABLE_NAME t, k.CONSTRAINT_NAME n, k.COLUMN_NAME c, k.REFERENCED_TABLE_NAME rt, k.REFERENCED_COLUMN_NAME rc
  FROM information_schema.KEY_COLUMN_USAGE k WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`, [db])
await conn.end()

const jsonCols = new Set()
for (const { t, cc } of checks) { const m = String(cc).match(/json_valid\(`?(\w+)`?\)/i); if (m) jsonCols.add(`${t}.${m[1]}`) }

function kindOf(r) {
  const ct = r.ct.toLowerCase()
  if (r.dt === 'enum') return 'enum'
  if (ct === 'char(36)' || ct === 'uuid') return 'uuid'
  if (ct === 'tinyint(1)') return 'bool'
  if (['int', 'bigint', 'smallint', 'tinyint', 'mediumint'].includes(r.dt)) return 'int'
  if (['decimal', 'double', 'float'].includes(r.dt)) return 'number'
  if (r.dt === 'datetime' || r.dt === 'timestamp') return 'timestamp'
  if (r.dt === 'date') return 'date'
  if (jsonCols.has(`${r.t}.${r.c}`) || r.dt === 'json') return 'json'
  return 'text'
}

const META = {}
for (const r of cols) {
  if (PLATFORM.test(r.t)) continue
  const tm = (META[r.t] ??= { pk: [], unique: [], columns: {}, relations: [] })
  const old = OLD[r.t]?.columns?.[r.c]
  const kind = old?.kind === 'array' && kindOf(r) === 'json' ? 'array' : kindOf(r)
  const cm = { kind }
  if (kind === 'enum') cm.values = r.ct.slice(5, -1).split(/,(?=')/).map(v => v.replace(/^'|'$/g, '').replace(/''/g, "'"))
  const generated = /VIRTUAL|STORED|PERSISTENT/i.test(r.x) || !!r.g
  if (generated) { cm.generated = true; if (/_unique_key$/.test(r.c)) cm.hidden = true }
  else {
    if (r.d != null) cm.hasDefault = true
    if (r.d != null && /uuid\(\)/i.test(r.d)) cm.defaultUuid = true
    if (old?.appDefault) { cm.appDefault = old.appDefault; cm.hasDefault = true }
    if (/on update/i.test(r.x)) cm.autoUpdate = true
    if (r.n === 'YES') cm.nullable = true
  }
  tm.columns[r.c] = cm
}
for (const k of keys) {
  if (!META[k.t]) continue
  const cs = String(k.cs).split(',')
  if (k.i === 'PRIMARY') META[k.t].pk = cs
  else if (Number(k.nu) === 0 && !cs.some(c => META[k.t].columns[c]?.hidden)) META[k.t].unique.push(cs)
}
const byName = new Map()
for (const f of fks) {
  if (!META[f.t] || !META[f.rt]) continue
  const key = `${f.t}.${f.n}`
  if (!byName.has(key)) byName.set(key, { t: f.t, name: f.n, columns: [], table: f.rt, refColumns: [] })
  const e = byName.get(key); e.columns.push(f.c); e.refColumns.push(f.rc)
}
for (const e of byName.values()) {
  META[e.t].relations.push({ columns: e.columns, table: e.table, refColumns: e.refColumns, name: e.name })
  META[e.table].relations.push({ columns: e.refColumns, table: e.t, refColumns: e.columns, name: e.name, many: true })
}
const ts = `// AUTO-GERADO por scripts/mariadb/generate-meta.mjs (a partir do MariaDB) — não editar à mão.
// Metadados do schema MariaDB usados pela camada de dados (src/lib/db).
import type { SchemaMeta } from './types'

export const SCHEMA_META: SchemaMeta = ${JSON.stringify(META, null, 2)}
`
if (process.argv.includes('--check')) {
  console.log(ts === cur ? '✓ metadados actualizados' : '✗ metadados desactualizados — corra sem --check')
  process.exit(ts === cur ? 0 : 1)
}
await writeFile(OUT, ts)
const added = Object.keys(META).filter(t => !OLD[t])
const newCols = Object.entries(META).flatMap(([t, m]) => Object.keys(m.columns).filter(c => OLD[t] && !OLD[t].columns[c]).map(c => `${t}.${c}`))
console.log(`✓ ${Object.keys(META).length} tabelas → ${OUT}`)
console.log(`  tabelas novas: ${added.join(', ') || '—'}`)
console.log(`  colunas novas: ${newCols.length}`)
