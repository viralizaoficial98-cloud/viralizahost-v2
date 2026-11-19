#!/usr/bin/env node
/**
 * Reconciliação para rollback: lista as escritas feitas no MariaDB depois do corte.
 *
 *   node --env-file=.env.local scripts/mariadb/export-changes.mjs --since="2026-11-20 02:00:00" [--out=DIR]
 *
 * --since é a hora UTC em que a aplicação passou a escrever no MariaDB.
 * Gera um ficheiro JSON (permissões 600) com, por tabela, as linhas criadas ou
 * alteradas desde então. Se SOURCE_DATABASE_URL estiver definido, indica para cada
 * linha se ela já existe no Supabase (e se difere), para decidir o que reaplicar lá.
 * Colunas secretas (hashes, tokens WHM) são omitidas. Nada é escrito em nenhuma base.
 */
import mysql from 'mysql2/promise'
import pg from 'pg'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true] }))
if (!args.since || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(args.since)) {
  console.error('Use --since="AAAA-MM-DD HH:MM:SS" (UTC)'); process.exit(2)
}
const since = args.since.replace('T', ' ')
const OUT = resolve(String(args.out || join(process.cwd(), 'migration-reports')))
const SECRET = new Set(['encrypted_password', 'whm_api_token', 'token_hash', 'api_token', 'password'])
const SCHEMA = process.env.SOURCE_SCHEMA || 'viralizahost'

const metaSrc = await readFile(join(ROOT, 'src/lib/db/schema.generated.ts'), 'utf8')
const META = JSON.parse(metaSrc.slice(metaSrc.indexOf('= {') + 2))

const dst = await mysql.createConnection({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD ?? '',
  charset: 'utf8mb4_unicode_ci', timezone: 'Z', dateStrings: true,
})
let src = null
if (process.env.SOURCE_DATABASE_URL) {
  src = new pg.Client({ connectionString: process.env.SOURCE_DATABASE_URL })
  await src.connect()
  await src.query("SET TIME ZONE 'UTC'")
  await src.query('SET default_transaction_read_only = on')
}

const out = { since_utc: since, generated_at: new Date().toISOString(), tables: {} }
const tables = [['auth_users', { pk: ['id'], columns: { id: {}, email: {}, created_at: {}, updated_at: {} } }], ...Object.entries(META)]
for (const [t, m] of tables) {
  const cols = Object.keys(m.columns).filter(c => !SECRET.has(c) && !m.columns[c]?.hidden)
  const conds = ['created_at', 'updated_at'].filter(c => m.columns[c]).map(c => `\`${c}\` >= ?`)
  if (!conds.length) continue
  const [rows] = await dst.query(`SELECT ${cols.map(c => `\`${c}\``).join(', ')} FROM \`${t}\` WHERE ${conds.join(' OR ')}`, conds.map(() => since))
  if (!rows.length) continue
  const entries = []
  for (const r of rows) {
    const e = { change: r.created_at >= since ? 'created' : 'updated', row: r }
    if (src && t !== 'auth_users') {
      const where = m.pk.map((c, i) => `"${c}" = $${i + 1}`).join(' AND ')
      const found = (await src.query(`select * from "${SCHEMA}"."${t}" where ${where}`, m.pk.map(c => r[c]))).rows[0]
      e.in_supabase = !!found
      if (found && found.updated_at) e.supabase_updated_at = new Date(found.updated_at).toISOString()
    } else if (src) {
      e.in_supabase = !!(await src.query('select 1 from auth.users where id = $1', [r.id])).rows[0]
    }
    entries.push(e)
  }
  out.tables[t] = entries
  console.log(`• ${t.padEnd(26)} ${String(entries.filter(e => e.change === 'created').length).padStart(5)} criadas  ${String(entries.filter(e => e.change === 'updated').length).padStart(5)} alteradas`)
}
await mkdir(OUT, { recursive: true })
const file = join(OUT, `alteracoes-mariadb-desde-${since.replace(/[: ]/g, '-')}.json`)
await writeFile(file, JSON.stringify(out, null, 2), { mode: 0o600 })
console.log(`\nFicheiro (contém dados pessoais — não partilhar): ${file}`)
await dst.end()
if (src) await src.end()
