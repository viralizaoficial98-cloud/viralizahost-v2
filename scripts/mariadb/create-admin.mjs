#!/usr/bin/env node
/**
 * Cria (ou promove) um administrador da ViralizaHost no MariaDB.
 * O registo público nunca atribui o papel admin; este é o mecanismo previsto.
 *
 *   node --env-file=<ficheiro-protegido> scripts/mariadb/create-admin.mjs --email=admin@exemplo.com --name="Nome"
 *
 * Opções:
 *   --promote          a conta já existe: só muda profiles.role para 'admin'
 *   --reset-password   com --promote: define também uma nova senha
 *   --dry-run          mostra o que faria, sem escrever
 *
 * Senha: pedida no terminal sem eco (duas vezes). Para uso não interactivo,
 * ADMIN_INITIAL_PASSWORD no ambiente (num ficheiro com chmod 600, apagado a seguir).
 * A senha só é guardada como hash bcrypt; nunca é impressa nem registada.
 */
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import readline from 'node:readline'

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true] }))
const email = String(args.email ?? '').trim().toLowerCase()
const name = String(args.name ?? '').trim()
const DRY = !!args['dry-run']
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Use --email=endereço válido'); process.exit(2) }
if (!process.env.DB_NAME || !process.env.DB_USER) { console.error('Defina DB_NAME e DB_USER (ficheiro de ambiente protegido)'); process.exit(2) }

const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/

function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = s => { if (s.startsWith(question)) process.stdout.write(question) }
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer) })
  })
}

async function getPassword() {
  if (process.env.ADMIN_INITIAL_PASSWORD) return process.env.ADMIN_INITIAL_PASSWORD
  if (!process.stdin.isTTY) { console.error('Sem terminal: defina ADMIN_INITIAL_PASSWORD num ficheiro protegido.'); process.exit(2) }
  const a = await askHidden('Senha do administrador: ')
  const b = await askHidden('Repita a senha: ')
  if (a !== b) { console.error('As senhas não coincidem.'); process.exit(2) }
  return a
}

const conn = await mysql.createConnection({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD ?? '',
  charset: 'utf8mb4_unicode_ci', timezone: 'Z',
})

try {
  const [[db]] = await conn.query('SELECT DATABASE() AS db')
  console.log(`Base: ${db.db}`)
  const [[existing]] = await conn.query('SELECT u.id, p.role FROM auth_users u LEFT JOIN profiles p ON p.id = u.id WHERE u.email = ?', [email])

  if (existing) {
    if (!args.promote) { console.error(`Já existe uma conta com este e-mail (papel: ${existing.role ?? 'sem perfil'}). Use --promote para a tornar admin.`); process.exit(1) }
    let hash = null
    if (args['reset-password']) {
      const pw = await getPassword()
      if (!STRONG.test(pw)) { console.error('Senha fraca: ≥10 caracteres, maiúscula, minúscula, número e símbolo.'); process.exit(2) }
      hash = await bcrypt.hash(pw, 10)
    }
    if (DRY) { console.log(`[simulação] promoveria ${existing.id} a admin${hash ? ' e redefiniria a senha' : ''}`); process.exit(0) }
    await conn.beginTransaction()
    await conn.query(`INSERT INTO profiles (id, email, full_name, role) VALUES (?, ?, ?, 'admin') ON DUPLICATE KEY UPDATE role = 'admin'`, [existing.id, email, name])
    await conn.query('INSERT IGNORE INTO clients (id, profile_id) VALUES (?, ?)', [randomUUID(), existing.id])
    await conn.query('UPDATE auth_users SET email_confirmed_at = COALESCE(email_confirmed_at, CURRENT_TIMESTAMP(6)) WHERE id = ?', [existing.id])
    if (hash) {
      await conn.query('UPDATE auth_users SET encrypted_password = ?, password_reset_required = 0 WHERE id = ?', [hash, existing.id])
      await conn.query('DELETE FROM auth_sessions WHERE user_id = ?', [existing.id])
    }
    await conn.commit()
    console.log(`✓ Conta ${existing.id} promovida a admin${hash ? ' (senha redefinida, sessões terminadas)' : ''}`)
  } else {
    const pw = await getPassword()
    if (!STRONG.test(pw)) { console.error('Senha fraca: ≥10 caracteres, maiúscula, minúscula, número e símbolo.'); process.exit(2) }
    const id = randomUUID()
    if (DRY) { console.log(`[simulação] criaria o admin ${email}`); process.exit(0) }
    const hash = await bcrypt.hash(pw, 10)
    await conn.beginTransaction()
    // auth_users + handle_new_user (perfil + cliente), como no Supabase
    await conn.query(
      `INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP(6), ?, ?)`,
      [id, email, hash, JSON.stringify({ full_name: name }), JSON.stringify({ created_by: 'create-admin' })],
    )
    await conn.query(`INSERT INTO profiles (id, email, full_name, country, role) VALUES (?, ?, ?, 'AO', 'admin')`, [id, email, name])
    await conn.query('INSERT INTO clients (id, profile_id) VALUES (?, ?)', [randomUUID(), id])
    await conn.commit()
    console.log(`✓ Administrador criado: ${id} (${email})`)
  }
  const [[n]] = await conn.query("SELECT COUNT(*) AS n FROM profiles WHERE role = 'admin'")
  console.log(`Administradores na base: ${n.n}`)
} catch (e) {
  try { await conn.rollback() } catch {}
  console.error(`✗ ${e.code ?? ''} ${String(e.sqlMessage ?? e.message).replace(/'[^']*'/g, "'…'")}`)
  process.exitCode = 1
} finally {
  await conn.end()
}
