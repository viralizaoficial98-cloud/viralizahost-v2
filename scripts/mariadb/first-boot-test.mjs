#!/usr/bin/env node
/**
 * Testes do primeiro arranque numa base MariaDB nova (catálogo + admin criado).
 *
 *   BASE_URL=http://127.0.0.1:3100 node --env-file=<ficheiro-protegido> scripts/mariadb/first-boot-test.mjs
 *
 * Ambiente: DB_* (para confirmar IDs na base), ADMIN_EMAIL, ADMIN_PASSWORD.
 * Cria uma conta fictícia (teste+<data>@viralizahost.invalid) e apaga-a no fim
 * (use --keep para a manter). --no-signup não cria contas. Nunca imprime senhas nem cookies.
 */
import mysql from 'mysql2/promise'
import { randomBytes } from 'node:crypto'

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3100').replace(/\/$/, '')
const KEEP = process.argv.includes('--keep')
// --no-signup: verificação pós-produção (só site, produtos, admin e senha errada; não cria contas)
const NO_SIGNUP = process.argv.includes('--no-signup')
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no ficheiro protegido.'); process.exit(2) }

let pass = 0, fail = 0
const ok = (c, name, extra = '') => { if (c) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`) } }

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [k, v] = c.split(';')[0].split('=')
      if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : ''
    }
    const text = await res.text()
    let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, location: res.headers.get('location') ?? '' }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}

const db = await mysql.createConnection({
  ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : { host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306) }),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD ?? '', charset: 'utf8mb4_unicode_ci',
})
const [[{ base }]] = await db.query('SELECT DATABASE() AS base')
console.log(`Teste de primeiro arranque → ${BASE} (base ${base})`)

console.log('\n1. Página inicial e produtos')
const anon = new S()
const home = await anon.req('/')
ok(home.status === 200, `GET / → ${home.status}`)
const prods = await anon.req('/api/products')
const list = prods.json?.data ?? []
ok(prods.status === 200 && prods.json?.success && list.length > 0, `GET /api/products → ${prods.status}, ${list.length} produtos activos`, prods.text)
if (list[0]) {
  const [[row]] = await db.query('SELECT id, slug FROM products WHERE id = ?', [list[0].id])
  ok(row?.slug === list[0].slug, `produto ${list[0].id} (${list[0].slug}) confirmado na base ${base}`)
  ok(Array.isArray(list[0].product_features), 'features embutidas no produto')
}
const [[{ bp }]] = await db.query('SELECT COUNT(*) AS bp FROM banner_pages WHERE is_active = 1')
ok(Number(bp) > 0, `banner_pages activos na base: ${bp}`)

console.log('\n2. Administrador')
const adm = new S()
const la = await adm.login(ADMIN_EMAIL, ADMIN_PASSWORD)
ok(la.status === 200 && !!adm.cookie, 'login do administrador', la.json?.error?.message)
const pa = await adm.req('/admin')
ok(pa.status === 200 && /Painel Administrativo/.test(pa.text), `admin abre /admin → ${pa.status}`)
const ps = await adm.req('/admin/site')
ok(ps.status === 200, `admin abre /admin/site → ${ps.status}`)
const ac = await adm.req('/api/admin/clients')
ok(ac.status === 200, `API admin /api/admin/clients → ${ac.status}`, ac.text)

if (NO_SIGNUP) {
  const bad0 = await new S().login(ADMIN_EMAIL, ADMIN_PASSWORD + 'x')
  ok(bad0.status === 400 && bad0.json?.error?.message === 'Invalid login credentials', 'senha errada do admin rejeitada')
  await adm.req('/api/auth/logout', { method: 'POST' })
  ok(!(await adm.req('/api/auth/user')).json?.user, 'logout do admin')
  await db.end()
  console.log(`\n${pass} OK, ${fail} falhadas`)
  process.exit(fail ? 1 : 0)
}

console.log('\n3. Conta fictícia: registo, sessão, logout')
const email = `teste+${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${randomBytes(3).toString('hex')}@viralizahost.invalid`
const pw = `Fx#${randomBytes(9).toString('base64url')}9a`
const cli = new S()
const reg = await cli.req('/api/auth/signup', { method: 'POST', body: { email, password: pw, options: { data: { full_name: 'Conta de Teste', role: 'admin', country: 'AO' } } } })
ok(reg.status === 200 && reg.json?.user?.id, `registo pelo endpoint público → ${reg.status}`, reg.json?.error?.message)
const [[prof]] = await db.query('SELECT p.role FROM profiles p JOIN auth_users u ON u.id = p.id WHERE u.email = ?', [email])
ok(prof?.role === 'client', `papel atribuído: ${prof?.role ?? 'sem perfil'} (pedido 'admin' ignorado)`)
if (!reg.json?.session) {
  const l0 = await cli.login(email, pw)
  ok(l0.json?.error?.message === 'Email not confirmed', 'confirmação de e-mail activa: login recusado até confirmar')
  console.log('    (confirmação de e-mail ligada neste processo — o resto do teste precisa de AUTH_EMAIL_CONFIRMATION=false)')
}
const lc = await cli.login(email, pw)
ok(lc.status === 200 && !!cli.cookie, 'login da conta fictícia', lc.json?.error?.message)
const me = await cli.req('/api/auth/user')
ok(me.json?.user?.email === email, 'cookie de sessão reconhecido em /api/auth/user')
const sum = await cli.req('/api/client/billing/summary')
ok(sum.status === 200, `rota autenticada /api/client/billing/summary → ${sum.status}`, sum.text)
const dash = await cli.req('/dashboard')
ok(dash.status === 200, `Área do Cliente /dashboard → ${dash.status}`)

console.log('\n4. Restrições')
const bad = await new S().login(email, pw + 'x')
ok(bad.status === 400 && bad.json?.error?.message === 'Invalid login credentials', 'senha errada rejeitada')
const pc = await cli.req('/admin')
ok(pc.status === 307 && /\/dashboard$/.test(pc.location), `cliente em /admin → ${pc.status} ${pc.location.replace(/^https?:\/\/[^/]+/, '')}`)
const pcs = await cli.req('/admin/site')
ok(pcs.status === 307, `cliente em /admin/site → ${pcs.status}`)
const apic = await cli.req('/api/admin/clients')
ok(apic.status === 401 || apic.status === 403, `cliente na API admin → ${apic.status}`)

console.log('\n5. Logout')
await cli.req('/api/auth/logout', { method: 'POST' })
const after = await cli.req('/api/auth/user')
ok(!after.json?.user, 'sessão anulada após logout')
const d2 = await cli.req('/dashboard')
ok(d2.status === 307 && /\/login$/.test(d2.location), '/dashboard após logout → /login')

if (!KEEP) {
  await db.query('DELETE FROM auth_users WHERE email = ?', [email])
  const [[left]] = await db.query('SELECT COUNT(*) AS n FROM profiles WHERE email = ?', [email])
  ok(Number(left.n) === 0, 'conta fictícia removida (auth_users → profiles → clients em cascata)')
}
await db.end()
console.log(`\n${pass} OK, ${fail} falhadas`)
process.exit(fail ? 1 : 0)
