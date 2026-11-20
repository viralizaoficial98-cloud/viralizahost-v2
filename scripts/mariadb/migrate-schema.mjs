#!/usr/bin/env node
/**
 * Aplica as migrações MariaDB de database/mariadb/migrations por ordem e regista-as
 * em vh_schema_migrations. Cada ficheiro é idempotente (IF NOT EXISTS), por isso
 * repetir é seguro. Usa as variáveis DB_* do .env.local.
 *
 *   node --env-file=.env.local scripts/mariadb/migrate-schema.mjs [--dry-run]
 */
import mysql from 'mysql2/promise'
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'database', 'mariadb', 'migrations')
const DRY = process.argv.includes('--dry-run')
const conn = await mysql.createConnection({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD ?? '',
  charset: 'utf8mb4_unicode_ci', multipleStatements: true,
})
try {
  const [[{ db }]] = await conn.query('SELECT DATABASE() AS db')
  console.log(`Base: ${db}`)
  await conn.query(`CREATE TABLE IF NOT EXISTS vh_schema_migrations (
    name VARCHAR(191) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL,
    applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  const [done] = await conn.query('SELECT name, checksum FROM vh_schema_migrations')
  const applied = new Map(done.map(r => [r.name, r.checksum]))
  const files = (await readdir(DIR)).filter(f => f.endsWith('.sql')).sort()
  for (const f of files) {
    const sql = await readFile(join(DIR, f), 'utf8')
    const sum = createHash('sha256').update(sql).digest('hex')
    if (applied.get(f) === sum) { console.log(`= ${f} (já aplicada)`); continue }
    if (DRY) { console.log(`• ${f} ${applied.has(f) ? '(alterada desde a última aplicação)' : '(pendente)'}`); continue }
    await conn.query(sql)
    await conn.query('INSERT INTO vh_schema_migrations (name, checksum) VALUES (?, ?) ON DUPLICATE KEY UPDATE checksum = VALUES(checksum), applied_at = CURRENT_TIMESTAMP(6)', [f, sum])
    console.log(`✓ ${f}`)
  }
} catch (e) {
  console.error(`✗ ${e.code ?? ''} ${String(e.sqlMessage ?? e.message).replace(/'[^']*'/g, "'…'")}`)
  process.exitCode = 1
} finally {
  await conn.end()
}
