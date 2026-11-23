// Regressão: encomenda paga criada com o registrador INACTIVO; a Hostinger é activada depois PELO PAINEL
// (Guardar → Testar ligação → Activar → Guardar) e «Registar na Hostinger…» aparece ao actualizar Encomendas,
// sem recriar a encomenda, revalidar o pagamento ou mexer no alojamento. Só API simulada; nenhuma compra.
//   BASE_URL=http://localhost:3000 HOSTINGER_SIM_URL=http://127.0.0.1:12091 OUT=/tmp/act \
//     node --env-file=.env.local scripts/mariadb/rehearsal/hostinger-activation-e2e.cjs
const { chromium } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID, randomBytes } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SIM = process.env.HOSTINGER_SIM_URL || 'http://127.0.0.1:12091'
const TOKEN = process.env.MOCK_HOSTINGER_TOKEN || 'hostinger-de-ensaio'
const OUT = process.env.OUT || './ui-shots-activacao'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => randomBytes(3).toString('hex')
const stats = async () => (await (await fetch(`${SIM}/_stats`)).json())

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json }
  }
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const one = async (sql, a = []) => (await db.query(sql, a))[0][0]
  const regBefore = await one('SELECT * FROM registrar_settings WHERE id = 1')
  const s0 = await stats()
  const adm = new S(), c1 = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const b = await chromium.launch()
  try {
    // ── 1. Integração inactiva: encomendas pagas ficam no fluxo manual ──
    console.log('\n1. Encomendas pagas com o registrador inactivo')
    await db.query("UPDATE registrar_settings SET provider = 'none', enabled = 0, secret_enc = NULL, extensions = '[]', api_url = NULL, username = NULL, last_test_ok = NULL WHERE id = 1")
    const buy = async (lines) => {
      const q = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines } })
      const o = (await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines, acceptedTotal: q.json.quote.total, paymentMethod: 'bank_transfer' } })).json.order
      return o
    }
    const com = `antiga-${rnd()}.com`
    const main = await buy([{ type: 'product', slug: 'hosting-start', cycle: 'monthly', domain: com, domainMode: 'register' }, { type: 'domain', domain: com, operation: 'register', years: 1 }])
    const net = `outra-${rnd()}.net`
    const oNet = await buy([{ type: 'domain', domain: net, operation: 'register', years: 1 }])
    const upper = `maiusculas-${rnd()}.com`
    const oUpper = await buy([{ type: 'domain', domain: upper, operation: 'register', years: 1 }])
    const prior = `anterior-${rnd()}.com`
    const oPrior = await buy([{ type: 'domain', domain: prior, operation: 'register', years: 1 }])
    for (const o of [main, oNet, oUpper, oPrior]) await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: o.id } })
    const ao = `manual-${rnd()}.ao`
    const qa = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'domain', domain: ao, operation: 'register', years: 1 }] } })
    const oAo = (await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines: [{ type: 'domain', domain: ao, operation: 'register', years: 1 }], acceptedTotal: qa.json.quote.total, paymentMethod: 'bank_transfer' } })).json.order
    const aoItem = await one('SELECT id FROM order_items WHERE order_id = ?', [oAo.id])
    await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'domain_availability', orderItemId: aoItem.id, available: true } })
    await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: oAo.id } })
    // Encomenda antiga com o domínio gravado com maiúsculas/espaços no serviço
    await db.query("UPDATE services SET domain = ? WHERE order_id = ? AND service_type = 'domain'", [`  ${upper.toUpperCase()} `, oUpper.id])
    // Tentativa anterior noutro fornecedor, por resolver
    const svcPrior = await one("SELECT id FROM services WHERE order_id = ? AND service_type = 'domain'", [oPrior.id])
    await db.query("INSERT INTO registrar_operations (id, service_id, operation, domain, provider, mode, client_ref, status, message) VALUES (?, ?, 'register', ?, 'simulado', 'test', ?, 'unknown', 'timeout')", [randomUUID(), svcPrior.id, prior, `vh-register-${svcPrior.id}`.slice(0, 64)])

    const domSvc = await one("SELECT id, provisioning_status, provisioning_error FROM services WHERE order_id = ? AND service_type = 'domain'", [main.id])
    const hostBefore = await one("SELECT id, provisioning_status, provisioned_at, external_ref, status FROM services WHERE order_id = ? AND service_type = 'hosting'", [main.id])
    const payBefore = await one('SELECT o.order_number, o.payment_status, o.paid_at, i.status inv, i.amount_paid, (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.id) pays FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = ?', [main.id])
    ok(domSvc.provisioning_status === 'manual_required' && /sem integração automática activa/.test(domSvc.provisioning_error), `domínio «A aguardar registo» com a mensagem antiga gravada («${domSvc.provisioning_error}»)`)
    ok(hostBefore.provisioning_status === 'active', 'alojamento activo')

    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    await ctx.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
    const orders = await ctx.newPage()
    const errors = []; orders.on('pageerror', e => errors.push(e.message))
    await orders.goto(`${BASE}/admin/orders?filtro=todas&encomenda=${main.order_number}`, { waitUntil: 'networkidle' })
    const row = n => orders.locator(`[id="order-${n}"]`)
    ok(await row(main.order_number).getByTestId('hostinger-open').count() === 0 && await row(main.order_number).getByTestId('mark-active').count() === 1, 'registrador inactivo: só «Repetir» e «Marcar como registado…» (fluxo manual)')

    // ── 2. Activar a Hostinger pelo painel (passos do administrador) ──
    console.log('\n2. Activar a Hostinger em Integrações → Registrador')
    const integ = await ctx.newPage()
    await integ.goto(`${BASE}/admin/settings/integrations/registrar`, { waitUntil: 'networkidle' })
    const notice = async () => { await integ.waitForTimeout(600); return (await integ.locator('[role=status]').allInnerTexts()).join(' | ') }
    await integ.getByTestId('registrar-provider').selectOption('hostinger')
    await integ.locator('select').nth(1).selectOption('test')
    await integ.getByTestId('registrar-url').fill(SIM)
    await integ.getByTestId('registrar-secret').fill(TOKEN)
    await integ.getByTestId('registrar-ext-.com').check()
    await integ.getByTestId('registrar-enabled').check()
    await integ.getByTestId('registrar-save').click()
    let n = await notice()
    ok(/Guarde primeiro|Teste a ligação/.test(n) && !(await integ.getByTestId('registrar-enabled').isChecked()) && /inactiva/.test(await integ.getByTestId('registrar-saved-state').innerText()),
      'activar antes de testar: recusado e a caixa volta ao estado guardado (não parece activa)', n)
    await integ.getByTestId('registrar-ext-.com').check()
    await integ.getByTestId('registrar-save').click(); await notice()
    await integ.getByTestId('registrar-test').click(); n = await notice()
    ok(/Token aceite/.test(n), `«Testar ligação»: ${n}`)
    ok(await integ.getByTestId('registrar-enable-hint').isVisible(), 'aviso: ligação OK mas integração ainda inactiva')
    await integ.getByTestId('registrar-enabled').check()
    await integ.getByTestId('registrar-save').click(); n = await notice()
    const status = await integ.getByTestId('registrar-status').innerText()
    const saved = await one('SELECT provider, enabled, username, extensions FROM registrar_settings WHERE id = 1')
    ok(/Configuração guardada/.test(n) && /Activo — Hostinger/.test(status) && saved.enabled == 1, `Activar → Guardar: integração activa (antes era recusado: «Teste a ligação…»)`, `${n} / ${status}`)
    ok(/\.com/.test(JSON.stringify(saved.extensions)) && saved.username === null, '.com autorizado; utilizador vazio guardado como NULL')
    await integ.screenshot({ path: `${OUT}/desktop-01-integracao-activa.png`, fullPage: true })

    // ── 3. Encomendas: «Actualizar» mostra o botão sem recriar nada ──
    console.log('\n3. Encomendas: «Actualizar»')
    await orders.bringToFront()
    await orders.getByRole('button', { name: 'Actualizar' }).first().click()
    await row(main.order_number).getByTestId('hostinger-open').waitFor({ timeout: 10000 }).catch(() => {})
    ok(await row(main.order_number).getByTestId('hostinger-open').count() === 1, '«Registar na Hostinger…» aparece depois de «Actualizar» (sem recarregar a página)')
    ok(/Aguarda autorização/.test(await row(main.order_number).getByTestId('service-error').first().innerText()), 'a mensagem antiga gravada já não é mostrada como motivo actual')
    ok(await row(main.order_number).getByTestId('mark-active').count() === 1, '«Marcar como registado…» continua disponível')
    await row(main.order_number).scrollIntoViewIfNeeded()
    await orders.screenshot({ path: `${OUT}/desktop-02-encomenda-com-botao.png` })
    ok(await row(oUpper.order_number).getByTestId('hostinger-open').count() === 1, 'domínio antigo gravado com maiúsculas/espaços também é elegível')
    ok(await row(oNet.order_number).getByTestId('hostinger-open').count() === 0 && /\.net não autorizada/.test(await row(oNet.order_number).getByTestId('hostinger-reason').innerText()), '.net (não autorizada) continua manual, com o motivo')
    ok(await row(oAo.order_number).getByTestId('hostinger-open').count() === 0 && /manual/.test(await row(oAo.order_number).getByTestId('hostinger-reason').innerText()), '.ao continua manual, com o motivo')

    // ── 4. Diálogo: custo e confirmação explícita; nada comprado ──
    console.log('\n4. Diálogo «Registar na Hostinger»')
    await row(main.order_number).getByTestId('hostinger-open').click()
    await orders.getByTestId('hostinger-confirm').waitFor()
    const txt = await orders.getByTestId('hostinger-dialog').innerText()
    ok(/9,99 USD/.test(txt) && /\.COM Domain/.test(txt) && /debitar/.test(txt) && txt.includes(com), 'mostra domínio, produto, custo e moeda, com aviso de débito')
    ok(await orders.getByTestId('hostinger-confirm').isDisabled(), 'compra exige confirmação explícita')
    await orders.screenshot({ path: `${OUT}/desktop-03-dialogo.png` })
    await orders.getByRole('button', { name: 'Fechar' }).click()
    await row(oPrior.order_number).getByTestId('hostinger-open').click()
    await orders.getByTestId('hostinger-blockers').waitFor()
    ok(/tentativa anterior no fornecedor «simulado»/.test(await orders.getByTestId('hostinger-blockers').innerText()) && await orders.getByTestId('hostinger-confirm').count() === 0 && await orders.getByTestId('hostinger-release').count() === 1,
      'tentativa anterior noutro fornecedor: sem compra até ser resolvida («Libertar nova tentativa…»)')
    await orders.getByRole('button', { name: 'Fechar' }).click()
    const st = await stats()
    ok(st.purchaseCalls === s0.purchaseCalls && st.setupCalls === s0.setupCalls && st.nsCalls === s0.nsCalls, 'nenhuma compra, conclusão ou alteração de DNS')

    // ── 5. Encomenda e alojamento intactos ──
    const hostAfter = await one("SELECT id, provisioning_status, provisioned_at, external_ref, status FROM services WHERE order_id = ? AND service_type = 'hosting'", [main.id])
    const payAfter = await one('SELECT o.order_number, o.payment_status, o.paid_at, i.status inv, i.amount_paid, (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.id) pays FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = ?', [main.id])
    ok(JSON.stringify(hostAfter) === JSON.stringify(hostBefore), 'alojamento inalterado')
    ok(JSON.stringify(payAfter) === JSON.stringify(payBefore), 'mesma encomenda, pagamento e factura (nada revalidado nem recriado)')

    // ── 6. Desactivar → volta ao fluxo manual ──
    console.log('\n6. Desactivar a integração')
    await integ.bringToFront()
    await integ.getByTestId('registrar-enabled').uncheck()
    await integ.getByTestId('registrar-save').click(); await notice()
    await orders.bringToFront()
    await orders.getByRole('button', { name: 'Actualizar' }).first().click()
    await orders.waitForTimeout(1500)
    ok(await row(main.order_number).getByTestId('hostinger-open').count() === 0 && /inactiva/.test(await row(main.order_number).getByTestId('hostinger-reason').innerText()), 'integração inactiva: botão escondido, fluxo manual com o motivo')
    const r = await adm.req(`/api/admin/registrar/hostinger?serviceId=${domSvc.id}`)
    ok(r.json?.preview?.next === 'blocked' && /inactiva/.test(r.json.preview.blockers.join(' ')), 'servidor também recusa com a integração inactiva')
    ok(errors.length === 0, 'sem erros JavaScript', errors.join(' | '))
    await ctx.close()
  } finally {
    await b.close()
    if (regBefore) await db.query('UPDATE registrar_settings SET provider = ?, mode = ?, enabled = ?, api_url = ?, username = ?, secret_enc = ?, extensions = ?, last_test_ok = ?, last_test_at = ?, last_test_message = ? WHERE id = 1',
      [regBefore.provider, regBefore.mode, regBefore.enabled, regBefore.api_url, regBefore.username, regBefore.secret_enc, typeof regBefore.extensions === 'string' ? regBefore.extensions : JSON.stringify(regBefore.extensions ?? []), regBefore.last_test_ok, regBefore.last_test_at, regBefore.last_test_message])
    await db.end()
  }
  console.log(`\n${pass} OK, ${fail} falhadas`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('ERRO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2) })
