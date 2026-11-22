// Ensaio no navegador: registo e verificação de e-mail (Resend SIMULADO) e eliminação de contas
// no painel (Clientes → ⋮). Base de ENSAIO; contas fictícias criadas e removidas aqui.
//   BASE_URL=http://localhost:3100 RESEND_SIM=http://127.0.0.1:12090 OUT=/tmp/conta \
//     node --env-file=.env.local scripts/mariadb/rehearsal/account-ui-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const crypto = require('crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '')
const SIM = process.env.RESEND_SIM || 'http://127.0.0.1:12090'
const OUT = process.env.OUT || '/tmp/conta-ui'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const PW = 'Ensaio#Conta2026'
const lastLink = async to => { const j = await (await fetch(`${SIM}/_outbox?to=${encodeURIComponent(to)}`)).json(); return ((j.last && j.last.html.match(/href="([^"]+)"/)) || [])[1]?.replace(/&amp;/g, '&') }

async function fillRegister(p, name, email) {
  await p.goto(BASE + '/register', { waitUntil: 'load' })
  await p.getByPlaceholder('Seu nome completo').fill(name)
  await p.getByPlaceholder('seu@email.com').fill(email)
  const pws = p.locator('input[type="password"]')
  await pws.nth(0).fill(PW); await pws.nth(1).fill(PW)
  await p.locator('form input[type="checkbox"]').first().check()
  await p.locator('form button[type="submit"]').click()
}

async function run(label, ctxOpts, db, created) {
  console.log(`\n== ${label}`)
  const tag = crypto.randomBytes(3).toString('hex')
  const b = await chromium.launch()
  const ctx = await b.newContext(ctxOpts)
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', e => errors.push(e.message))

  // 1. Falha de envio → mensagem clara e reenvio
  const failEmail = `falha-envio-${tag}@ensaio.test`; created.push(failEmail)
  await fillRegister(p, 'Conta Falha', failEmail)
  await p.getByTestId('signup-not-sent').waitFor({ timeout: 15000 })
  ok(true, 'registo com falha de envio: «conta criada, mas não conseguimos enviar»')
  if (label === 'desktop') await p.screenshot({ path: `${OUT}/${label}-registo-falha-envio.png` })
  await p.getByTestId('resend-link').click()
  await p.waitForURL(/\/verificar-email\?email=/)
  ok((await p.getByTestId('resend-email').inputValue()) === failEmail, 'página de reenvio abre com o e-mail preenchido')
  await p.getByTestId('resend-submit').click()
  await p.getByTestId('resend-result').waitFor()
  ok(/Se este endereço/.test(await p.getByTestId('resend-result').textContent()), 'reenvio responde de forma genérica')

  // 2. Registo normal → link → confirmação
  const em = `ui-${tag}@ensaio.test`; created.push(em)
  await fillRegister(p, 'Conta Navegador', em)
  await p.getByTestId('signup-sent').waitFor({ timeout: 15000 })
  ok(true, 'registo: «Enviámos um e-mail de confirmação»')
  if (label === 'desktop') await p.screenshot({ path: `${OUT}/${label}-registo-enviado.png` })
  // login antes de confirmar → erro com reenvio
  await p.goto(BASE + '/login', { waitUntil: 'load' })
  await p.locator('input[type="email"]').fill(em)
  await p.locator('input[type="password"]').fill(PW)
  await p.locator('form button[type="submit"]').click()
  await p.getByTestId('login-error').waitFor()
  ok(/ainda não foi confirmado/.test(await p.getByTestId('login-error').textContent()) && await p.getByTestId('login-resend').isVisible(), 'login antes de confirmar: mensagem em português e «Reenviar e-mail de verificação»')
  const link = await lastLink(em)
  ok(link && link.startsWith(`${BASE}/api/auth/verify?type=signup`), 'link do e-mail aponta para o endereço público do site')
  await p.goto(link, { waitUntil: 'load' })
  ok(/\/dashboard\?verificado=1/.test(p.url()), `abrir o link confirma e entra na Área do Cliente (${new URL(p.url()).pathname})`)
  await p.goto(link, { waitUntil: 'load' })
  ok(/estado=ja-confirmado/.test(p.url()) && await p.getByTestId('verify-state-ja-confirmado').isVisible(), 'abrir o link outra vez: «E-mail já confirmado»')
  await p.goto(BASE + '/api/auth/verify?type=signup&token_hash=xyz', { waitUntil: 'load' })
  ok(await p.getByTestId('verify-state-invalido').isVisible(), 'link inválido: mensagem própria')
  if (label === 'desktop') await p.screenshot({ path: `${OUT}/${label}-link-invalido.png` })
  await ctx.clearCookies()

  // 3. Painel: Clientes → ⋮ → Eliminar conta
  await p.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  const delEmail = `apagar-${tag}@ensaio.test`
  await p.request.post(BASE + '/api/auth/signup', { data: { email: delEmail, password: PW, options: { data: { full_name: 'Conta Para Apagar' } } } })
  await db.query('UPDATE auth_users SET email_confirmed_at = CURRENT_TIMESTAMP(6) WHERE email = ?', [delEmail])
  created.push(delEmail)
  await p.goto(BASE + '/admin/clients', { waitUntil: 'load' })
  const search = p.getByPlaceholder(/pesquisar|buscar|procurar/i).first()
  const rowFor = email => p.locator('tr', { hasText: email })
  await search.fill(delEmail); await p.waitForTimeout(1200)
  await rowFor(delEmail).first().waitFor()
  ok(/E-mail verificado/.test(await rowFor(delEmail).first().getByTestId('client-email-status').textContent()), 'estado do e-mail na linha («E-mail verificado»), separado de Ativo/Suspenso')
  const totalBefore = await p.getByText('Clientes', { exact: true }).first().locator('xpath=..').textContent().catch(() => '')
  await rowFor(delEmail).first().getByTestId('client-menu').click()
  await p.getByTestId('client-action-delete').click()
  const dlg = p.getByTestId('delete-dialog')
  await dlg.getByTestId('delete-confirm-email').waitFor()
  ok((await dlg.getByTestId('delete-email').textContent()) === delEmail, 'diálogo mostra a conta a eliminar e o efeito')
  ok(await dlg.getByTestId('delete-submit').isDisabled(), '«Eliminar conta» bloqueado até confirmar')
  if (label === 'desktop') await p.screenshot({ path: `${OUT}/${label}-eliminar-elegivel.png` })
  await dlg.getByTestId('delete-confirm-email').fill(delEmail)
  await dlg.getByTestId('delete-ack').check()
  await dlg.getByTestId('delete-submit').click()
  await p.getByText(/eliminada do portal/).waitFor({ timeout: 10000 })
  await p.waitForTimeout(800)
  ok((await rowFor(delEmail).count()) === 0, 'depois de eliminar a linha desaparece da lista')
  ok(!(await db.query('SELECT id FROM auth_users WHERE email = ?', [delEmail]))[0].length, 'conta removida da base')
  void totalBefore

  // Conta com histórico → bloqueio com motivos e suspensão como alternativa
  await search.fill('cliente1@ensaio.test'); await p.waitForTimeout(1200)
  await rowFor('cliente1@ensaio.test').first().getByTestId('client-menu').click()
  await p.getByTestId('client-action-delete').click()
  await p.getByTestId('delete-blocked').waitFor()
  const reasons = await p.getByTestId('delete-blocker').allTextContents()
  ok(reasons.some(r => /factura/.test(r)) && reasons.some(r => /hospedagem/.test(r)) && await p.getByTestId('delete-suspend-instead').isVisible(), `bloqueado com motivos exactos e «Suspender acesso ao portal» (${reasons.length} motivos)`)
  ok(!(await p.getByTestId('delete-submit').count()), 'sem botão de eliminar quando bloqueado')
  if (label === 'desktop') await p.screenshot({ path: `${OUT}/${label}-eliminar-bloqueado.png` })
  await p.getByTestId('delete-dialog').getByRole('button', { name: 'Fechar', exact: true }).click()

  // Conta administrativa → protegida no menu
  await search.fill('admin@ensaio.test'); await p.waitForTimeout(1200)
  const admRow = rowFor('admin@ensaio.test').first()
  ok(await admRow.getByTestId('client-role-badge').isVisible(), 'conta administrativa assinalada «Administrador»')
  await admRow.getByTestId('client-menu').click()
  ok(await p.getByTestId('client-action-protected').isDisabled() && !(await p.getByTestId('client-action-delete').count()), 'menu da conta administrativa: «protegida», sem eliminar')

  ok(errors.length === 0, 'sem erros de JavaScript', errors.join(' | '))
  await b.close()
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
  const created = []
  try {
    await run('desktop', { viewport: { width: 1366, height: 900 } }, db, created)
    await run('telemovel', { ...devices['iPhone 13'] }, db, created)
  } finally {
    for (const e of created) {
      const [[x]] = await db.query('SELECT id FROM auth_users WHERE email = ?', [e])
      if (x) { await db.query('DELETE FROM auth_email_log WHERE user_id = ?', [x.id]); await db.query('DELETE FROM auth_users WHERE id = ?', [x.id]) }
    }
    await db.end()
  }
  console.log(`\n${pass} passaram, ${fail} falharam`)
  process.exit(fail ? 1 : 0)
})()
