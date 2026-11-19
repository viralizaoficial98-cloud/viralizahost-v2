#!/usr/bin/env node
/**
 * Confirma, a partir do processo Node.js (no próprio servidor), como chegar ao
 * MariaDB e se a conta tem o que a aplicação precisa.
 *
 *   node --env-file=.env.local scripts/mariadb/check-connection.mjs
 *
 * Testa DB_SOCKET/DB_HOST:DB_PORT e as alternativas habituais no cPanel
 * (localhost, 127.0.0.1, sockets comuns). Não imprime a palavra-passe.
 */
import mysql from 'mysql2/promise'
import { existsSync } from 'node:fs'

const { DB_HOST, DB_PORT = '3306', DB_SOCKET, DB_NAME, DB_USER, DB_PASSWORD = '' } = process.env
if (!DB_NAME || !DB_USER) { console.error('Defina DB_NAME e DB_USER'); process.exit(2) }

const candidates = []
if (DB_SOCKET) candidates.push({ label: `socket ${DB_SOCKET} (DB_SOCKET)`, socketPath: DB_SOCKET })
if (DB_HOST) candidates.push({ label: `${DB_HOST}:${DB_PORT} (DB_HOST)`, host: DB_HOST, port: Number(DB_PORT) })
for (const h of ['localhost', '127.0.0.1']) if (h !== DB_HOST) candidates.push({ label: `${h}:${DB_PORT}`, host: h, port: Number(DB_PORT) })
for (const s of ['/var/lib/mysql/mysql.sock', '/run/mysqld/mysqld.sock', '/var/run/mysqld/mysqld.sock', '/tmp/mysql.sock']) {
  if (s !== DB_SOCKET && existsSync(s)) candidates.push({ label: `socket ${s}`, socketPath: s })
}

let working = null
for (const c of candidates) {
  const { label, ...opts } = c
  try {
    const conn = await mysql.createConnection({ ...opts, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, connectTimeout: 5000 })
    await conn.query('SELECT 1')
    console.log(`✓ ${label}`)
    if (!working) working = { conn, label }
    else await conn.end()
  } catch (e) {
    console.log(`✗ ${label} — ${e.code ?? ''} ${String(e.message).replace(DB_PASSWORD || '\u0000', '***').slice(0, 120)}`)
  }
}
if (!working) { console.error('\nNenhuma ligação funcionou. Confirme utilizador, permissões da base e host no cPanel (MySQL® Databases).'); process.exit(1) }

const { conn } = working
const one = async sql => (await conn.query(sql))[0][0]
const v = await one('SELECT VERSION() AS v, @@character_set_server AS cs, @@collation_server AS co, @@time_zone AS tz, @@max_allowed_packet AS map, @@lower_case_table_names AS lc, @@sql_mode AS sm, DATABASE() AS db')
console.log(`\nLigação recomendada: ${working.label}`)
console.log(`Versão: ${v.v}`)
console.log(`Base: ${v.db} (lower_case_table_names=${v.lc} — o nome da base deve ser escrito exactamente assim em DB_NAME)`)
console.log(`Charset servidor: ${v.cs} / ${v.co} (as tabelas usam utf8mb4 explicitamente)`)
console.log(`max_allowed_packet: ${Math.round(v.map / 1048576)} MB`)
const grants = (await conn.query('SHOW GRANTS'))[0].map(r => Object.values(r)[0])
const g = grants.join(' ').toUpperCase()
const need = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'INDEX', 'REFERENCES']
const missing = g.includes('ALL PRIVILEGES') ? [] : need.filter(p => !g.includes(p))
console.log(missing.length ? `⚠ Privilégios em falta: ${missing.join(', ')}` : '✓ Privilégios suficientes (SELECT/INSERT/UPDATE/DELETE + DDL para o schema)')
try {
  await conn.query("CREATE TEMPORARY TABLE vh_check (id INT, j JSON CHECK (json_valid(j)), d DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4")
  await conn.query("INSERT INTO vh_check (id, j) VALUES (1, ?)", ['{"ok":"ção 🚀"}'])
  const r = await one('SELECT JSON_VALUE(j, "$.ok") AS t FROM vh_check')
  console.log(r.t === 'ção 🚀' ? '✓ JSON, CHECK, DATETIME(6) e utf8mb4 (acentos/emoji) OK' : `⚠ texto devolvido difere: ${r.t}`)
} catch (e) {
  console.log(`⚠ teste de funcionalidades falhou: ${e.message}`)
}
const tables = (await conn.query('SHOW TABLES'))[0].length
console.log(`Tabelas na base: ${tables}${tables ? '' : ' (vazia — importe database/mariadb/schema.sql)'}`)
await conn.end()
