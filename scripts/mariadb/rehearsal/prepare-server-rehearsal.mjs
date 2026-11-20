#!/usr/bin/env node
/**
 * Prepara uma base de ENSAIO (nome tem de conter «ensaio») para correr run-all.sh no servidor:
 *   - contas de teste (senhas só de ensaio), cliente 1 com alojamento joaoconc + domínio joaoconceicao.ao
 *   - configuração WHM a apontar para o WHM SIMULADO em 127.0.0.1:<porta> (nunca o WHM real)
 *   - planos com activação WHM recebem um pacote de ensaio
 * Requer o esquema já aplicado (migrate-schema.mjs) e o catálogo (build-catalog.mjs --apply).
 *
 *   node --env-file=.env.local scripts/mariadb/rehearsal/prepare-server-rehearsal.mjs --whm-port=12087
 */
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto'

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || true] }))
const PORT = Number(args['whm-port'] || 12087)
const e = process.env
if (!/ensaio/i.test(e.DB_NAME ?? '')) { console.error(`Recusado: DB_NAME «${e.DB_NAME}» não é uma base de ensaio.`); process.exit(2) }
if (!e.WHM_ENCRYPTION_KEY || e.WHM_ENCRYPTION_KEY.length < 64) { console.error('WHM_ENCRYPTION_KEY em falta (64 hex).'); process.exit(2) }

const enc = text => {
  const key = Buffer.from(e.WHM_ENCRYPTION_KEY.slice(0, 64), 'hex'), iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv); const d = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return `enc:${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${d.toString('hex')}`
}
const db = await mysql.createConnection({ host: e.DB_HOST, port: Number(e.DB_PORT || 3306), socketPath: e.DB_SOCKET || undefined, user: e.DB_USER, password: e.DB_PASSWORD, database: e.DB_NAME, charset: 'utf8mb4' })
const q = async (sql, p = []) => (await db.query(sql, p))[0]

const users = [
  ['00000000-0000-4000-8000-00000000a001', 'admin@ensaio.test', 'Admin#Teste2026', 'Administradora Ensaio', 'admin'],
  ['00000000-0000-4000-8000-00000000c001', 'cliente1@ensaio.test', 'Cliente#Um2026', 'João Conceição', 'client'],
  ['00000000-0000-4000-8000-00000000c002', 'cliente2@ensaio.test', 'Cliente#Dois2026', 'Maria Gonçalves', 'client'],
]
for (const [id, email, pw, name, role] of users) {
  await q(`INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) VALUES (?, ?, ?, CURRENT_TIMESTAMP(6), ?)
           ON DUPLICATE KEY UPDATE encrypted_password = VALUES(encrypted_password), email_confirmed_at = COALESCE(email_confirmed_at, CURRENT_TIMESTAMP(6))`,
    [id, email, await bcrypt.hash(pw, 10), JSON.stringify({ full_name: name })])
  await q(`INSERT INTO profiles (id, email, full_name, country, role) VALUES (?, ?, ?, 'AO', ?) ON DUPLICATE KEY UPDATE role = VALUES(role)`, [id, email, name, role])
  if (!(await q('SELECT 1 FROM clients WHERE profile_id = ?', [id])).length) await q('INSERT INTO clients (id, profile_id) VALUES (?, ?)', [randomUUID(), id])
}

// WHM simulado
const [cfg] = await q("SELECT id FROM servers WHERE name = '__whm_config__'")
const serverId = cfg?.id ?? randomUUID()
if (cfg) await q("UPDATE servers SET whm_url = ?, whm_api_token = ?, whm_username = 'root', hostname = '127.0.0.1' WHERE id = ?", [`https://127.0.0.1:${PORT}`, enc('token-de-ensaio'), serverId])
else await q("INSERT INTO servers (id, name, hostname, ip_address, whm_url, whm_api_token, whm_username) VALUES (?, '__whm_config__', '127.0.0.1', '127.0.0.1', ?, ?, 'root')", [serverId, `https://127.0.0.1:${PORT}`, enc('token-de-ensaio')])

// Alojamento existente do cliente 1 (para a importação WHM e para a Área do Cliente)
const c1 = users[1][0], svc = '00000000-0000-4000-8000-0000000005a1'
await q(`INSERT IGNORE INTO services (id, profile_id, server_id, status, currency, price, billing_cycle, service_type, service_name, domain, provisioning_status)
         VALUES (?, ?, ?, 'active', 'AKZ', 20100, 'monthly', 'hosting', 'Plano Start — joaoconceicao.ao', 'joaoconceicao.ao', 'active')`, [svc, c1, serverId])
await q(`INSERT IGNORE INTO hosting_accounts (id, service_id, profile_id, server_id, cpanel_username, primary_domain, status, disk_used_mb, disk_limit_mb, php_version)
         VALUES (?, ?, ?, ?, 'joaoconc', 'joaoconceicao.ao', 'active', 512, 20480, '8.2')`, ['00000000-0000-4000-8000-0000000004a1', svc, c1, serverId])
await q(`INSERT IGNORE INTO domains (id, profile_id, service_id, name, extension, status, expires_at) VALUES (?, ?, ?, 'joaoconceicao', '.ao', 'active', CURRENT_DATE + INTERVAL 1 YEAR)`,
  ['00000000-0000-4000-8000-0000000002d1', c1, svc])
await q("UPDATE products SET whm_package = COALESCE(whm_package, 'ensaio_pacote') WHERE provisioning = 'whm' AND sale_status = 'active'")

console.log(`✓ Base ${e.DB_NAME} pronta para ensaio (WHM simulado em https://127.0.0.1:${PORT}).`)
await db.end()
