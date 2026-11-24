// Configurações → Contas: «Exigir confirmação de e-mail para novos clientes».
// Cobre: valor inicial (comportamento actual), permissões no servidor (anónimo, cliente, revendedor), persistência
// depois de recarregar, auditoria, os dois estados no registo do site e no checkout, sem reinício do servidor,
// contas existentes inalteradas e «reactivar só afecta novos registos». E-mails: simulador Resend (ensaio).
//   BASE_URL=http://localhost:3000 OUT=/tmp/contas node --env-file=.env.local scripts/mariadb/rehearsal/account-settings-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SIM = process.env.RESEND_SIM || 'http://127.0.0.1:12090'
const OUT = process.env.OUT || './ui-shots-contas'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => Math.random().toString(36).slice(2, 8)
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const PASS = 'Senha#Ensaio1'
const mails = async to => (await (await fetch(`${SIM}/_outbox?to=${encodeURIComponent(to)}`)).json()).count

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}
async function ctxFor(b, opts, cookie) {
  const ctx = await b.newContext({ ...opts })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  const p = await ctx.newPage()
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message))
  p.answers = []; p.on('dialog', d => { const a = p.answers.shift(); a === false ? d.dismiss() : d.accept() })
  return { ctx, p }
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const snapSettings = await all('SELECT * FROM account_settings')
  const START = (await one('SELECT DATE_FORMAT(NOW(6), "%Y-%m-%d %H:%i:%s.%f") t')).t
  const existing = async () => JSON.stringify(await all('SELECT id, email_confirmed_at, email_verification_exempt FROM auth_users WHERE created_at < ? ORDER BY id', [START]))
  const before = await existing()
  const userRow = email => one('SELECT u.email_confirmed_at, u.email_verification_exempt ex, p.role FROM auth_users u JOIN profiles p ON p.id = u.id WHERE u.email = ?', [email])
  const API = '/api/admin/settings/accounts'
  const adm = new S(), c1 = new S(), anon = new S(), res = new S()
  await adm.login('admin@ensaio.test', 'Admin#Teste2026')
  await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')
  const b = await chromium.launch()
  const signup = (s, email) => s.req('/api/auth/signup', { method: 'POST', body: { email, password: PASS, options: { data: { full_name: 'Ensaio Contas', phone: '+244 923 000 111', country: 'AO' } } } })
  try {
    // ── 1. Valor inicial e permissões ──
    console.log('\n1. Valor inicial e permissões (servidor)')
    await db.query('DELETE FROM account_settings')
    let r = await adm.req(API)
    ok(r.status === 200 && r.json.settings.source === 'default' && r.json.settings.emailConfirmationRequired === (process.env.AUTH_EMAIL_CONFIRMATION !== 'false'), `valor inicial = comportamento actual (exigida: ${r.json?.settings?.emailConfirmationRequired})`)
    ok((await anon.req(API)).status === 401 && (await anon.req(API, { method: 'PUT', body: { emailConfirmationRequired: false } })).status === 401, 'anónimo: 401 (ler e alterar)')
    ok((await c1.req(API)).status === 403 && (await c1.req(API, { method: 'PUT', body: { emailConfirmationRequired: false } })).status === 403, 'cliente: 403 (ler e alterar)')
    // Revendedor (papel sem acesso de administrador)
    const remail = `revenda-${rnd()}@ensaio.test`
    await signup(new S(), remail)
    await db.query("UPDATE profiles SET role = 'reseller' WHERE email = ?", [remail])
    await db.query('UPDATE auth_users SET email_confirmed_at = CURRENT_TIMESTAMP(6) WHERE email = ?', [remail])
    await res.login(remail, PASS)
    ok((await res.req(API, { method: 'PUT', body: { emailConfirmationRequired: false } })).status === 403, 'revendedor: 403')
    ok((await all('SELECT * FROM account_settings')).length === 0, 'tentativas recusadas não alteram nada')
    ok((await adm.req(API, { method: 'PUT', body: { emailConfirmationRequired: 'não' } })).status === 400, 'valor inválido → 400')

    // ── 2. Painel: desactivar, persistência e auditoria ──
    console.log('\n2. Configurações → Contas (painel)')
    let { ctx, p } = await ctxFor(b, DESKTOP, adm.cookie)
    await p.goto(BASE + '/admin/settings', { waitUntil: 'domcontentloaded' })
    await p.getByTestId('settings-accounts-link').click()
    await p.waitForURL('**/admin/settings/contas')
    const box = p.getByTestId('accounts-email-confirmation'); await box.waitFor()
    ok(await box.isChecked() && /Valor inicial/.test(await p.getByTestId('accounts-source').innerText()), 'opção «Exigir confirmação de e-mail para novos clientes» activa por omissão')
    await p.screenshot({ path: `${OUT}/painel-contas-activa.png`, fullPage: true })
    await box.uncheck()
    p.answers.push(true)
    await p.getByTestId('accounts-save').click()
    await p.getByTestId('accounts-notice').filter({ hasText: 'Guardado' }).waitFor()
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.getByTestId('accounts-email-confirmation').waitFor()
    ok(!(await p.getByTestId('accounts-email-confirmation').isChecked()) && /Última alteração/.test(await p.getByTestId('accounts-source').innerText()), 'depois de recarregar: desactivada (persistente)')
    await p.screenshot({ path: `${OUT}/painel-contas-desactivada.png`, fullPage: true })
    ok(Number((await one("SELECT COUNT(*) n FROM activity_logs WHERE entity_type = 'settings' AND entity_id = 'accounts' AND description LIKE '%NÃO exigida%' AND created_at >= ?", [START])).n) === 1, 'alteração registada no histórico (activity_logs)')
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, IPHONE, adm.cookie))
    await p.goto(BASE + '/admin/settings/contas', { waitUntil: 'domcontentloaded' }); await p.getByTestId('accounts-email-confirmation').waitFor()
    ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'telemóvel: sem deslocamento horizontal')
    await p.screenshot({ path: `${OUT}/iphone-painel-contas.png` })
    await ctx.close()

    // ── 3. Desactivada: registo no site (sem reinício) ──
    console.log('\n3. Desactivada: registo no site e no checkout, sem e-mail de confirmação')
    const e1 = `sem-conf-${rnd()}@ensaio.test`
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/register', { waitUntil: 'domcontentloaded' })
    await p.getByPlaceholder('Seu nome completo').fill('Cliente Sem Confirmação')
    await p.getByPlaceholder('seu@email.com').fill(e1)
    await p.getByPlaceholder('+244 900...').fill('+244 923 456 789')
    await p.getByPlaceholder('Mínimo 8 caracteres').fill(PASS)
    await p.getByPlaceholder('Confirme a sua senha').fill(PASS)
    await p.locator('input[type=checkbox]').first().check()
    await p.locator('button[type=submit]').click()
    await p.waitForURL('**/dashboard**', { timeout: 20000 })
    ok(/\/dashboard/.test(p.url()), 'registo concluído e sessão iniciada sem confirmar o e-mail')
    let u = await userRow(e1)
    ok(u.email_confirmed_at === null && Number(u.ex) === 1 && u.role === 'client', 'endereço fica «por verificar» (email_confirmed_at vazio), conta de cliente')
    ok(await mails(e1) === 0, 'nenhum e-mail de confirmação enviado')
    ok((await new S().login(e1, PASS)).status === 200, 'inicia sessão de novo sem confirmação')
    await ctx.close()

    // Checkout: criar conta no carrinho
    const e2 = `checkout-${rnd()}@ensaio.test`
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(`${BASE}/dominios/configurar?dominio=contas-${rnd()}.com`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('config-continue').click()
    await p.waitForURL('**/carrinho'); await p.locator('[data-testid=finalize]:not([disabled])').click()
    await p.waitForURL('**/checkout/conta')
    await p.locator('#f-full_name').fill('Cliente Checkout Ensaio')
    await p.locator('#f-email').fill(e2)
    await p.locator('#f-phone').fill('+244 923 111 222')
    await p.locator('#f-address').fill('Rua da Missão, 15')
    await p.locator('#f-city').fill('Luanda')
    await p.locator('#f-password').fill(PASS)
    await p.locator('#f-confirm').fill(PASS)
    await p.getByTestId('register-submit').click()
    await p.waitForURL('**/checkout/pagamento', { timeout: 20000 })
    ok(/checkout\/pagamento/.test(p.url()) && await p.getByTestId('account-verify').count() === 0, 'checkout: conta criada e segue para o pagamento, sem passo de confirmação')
    u = await userRow(e2)
    ok(u.email_confirmed_at === null && Number(u.ex) === 1 && await mails(e2) === 0, 'checkout: endereço por verificar e sem e-mail de confirmação')
    await ctx.close()
    // Recuperação de palavra-passe continua igual
    r = await anon.req('/api/auth/recover', { method: 'POST', body: { email: e1 } })
    ok(r.status === 200 && await mails(e1) === 1, 'recuperação de palavra-passe continua a enviar o link')

    // ── 4. Reactivar: só afecta novos registos ──
    console.log('\n4. Reactivar: só afecta novos registos')
    r = await adm.req(API, { method: 'PUT', body: { emailConfirmationRequired: true } })
    ok(r.status === 200 && r.json.settings.emailConfirmationRequired === true, 'reactivada (sem reiniciar o servidor)')
    const e3 = `com-conf-${rnd()}@ensaio.test`
    const s3 = new S()
    r = await signup(s3, e3)
    ok(r.status === 200 && r.json.session === null && r.json.email_sent === true && await mails(e3) === 1, 'novo registo: e-mail de confirmação enviado e sem sessão')
    ok((await new S().login(e3, PASS)).json?.error?.code === 'email_not_confirmed', 'novo registo: login bloqueado até confirmar')
    ok((await new S().login(e1, PASS)).status === 200 && (await new S().login(e2, PASS)).status === 200, 'contas criadas com a opção desactivada continuam a entrar')
    // Conta por confirmar criada com a opção activa continua bloqueada mesmo depois de desactivar
    r = await adm.req(API, { method: 'PUT', body: { emailConfirmationRequired: false } })
    ok((await new S().login(e3, PASS)).json?.error?.code === 'email_not_confirmed', 'desactivar não liberta contas já criadas por confirmar (situação preservada)')
    ok((await existing()) === before, 'contas anteriores ao ensaio inalteradas')
    ok(Number((await one("SELECT COUNT(*) n FROM activity_logs WHERE entity_type = 'settings' AND entity_id = 'accounts' AND created_at >= ?", [START])).n) === 3, 'cada alteração auditada (3)')
  } catch (e) {
    ok(false, 'execução', e.stack)
  } finally {
    try {
      await db.query('DELETE FROM account_settings')
      for (const x of snapSettings) { const k = Object.keys(x); await db.query(`INSERT INTO account_settings (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => x[c])) }
      ok(JSON.stringify(await all('SELECT * FROM account_settings')) === JSON.stringify(snapSettings), 'configuração de contas reposta como estava')
    } catch (e) { ok(false, 'reposição', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
