// Pagamento por transferência com domínio nacional a confirmar (.ao / .co.ao) — ensaio, pagamentos simulados.
// Cobre: .ao sozinho e .ao + e-mail corporativo (pagar já, comprovativo, validação do admin com o domínio pendente),
// domínio confirmado → registado, domínio indisponível depois do pagamento (caso manual, sem reembolso automático),
// cartão de transferência (cópia, desktop e telemóvel), validações e preservação dos registos anteriores.
//   BASE_URL=http://localhost:3000 OUT=/tmp/transf node --env-file=.env.local scripts/mariadb/rehearsal/bank-transfer-domain-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-transferencia'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => Math.random().toString(36).slice(2, 7)
const num = s => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const C2 = { email: 'cliente2@ensaio.test', password: 'Cliente#Dois2026' }
const IBAN = '005100002477517910141', HOLDER = 'VIRALIZA FÁCIL ANGOLA LDA'
const NOTE = 'Pode pagar agora. A nossa equipa vai confirmar a disponibilidade do domínio antes de o registar.'

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json, text: t }
  }
}
async function ctxFor(b, opts, cookie) {
  const ctx = await b.newContext({ ...opts, permissions: ['clipboard-read', 'clipboard-write'] })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  const p = await ctx.newPage()
  p.errors = []
  p.on('pageerror', e => p.errors.push(e.message))
  // Diálogos do painel (confirm/prompt): respostas em fila
  p.answers = []
  p.on('dialog', d => { const a = p.answers.shift(); if (a === false) d.dismiss(); else d.accept(typeof a === 'string' ? a : undefined) })
  return { ctx, p }
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  // Registos anteriores (para confirmar que nada muda)
  const snap = async () => JSON.stringify([
    await all('SELECT id, status, payment_status, activation_status, hold_reason, amount FROM orders WHERE created_at < ? ORDER BY id', [START]),
    await all('SELECT id, status, total, amount_paid FROM invoices WHERE created_at < ? ORDER BY id', [START]),
    await all('SELECT id, status, amount FROM payments WHERE created_at < ? ORDER BY id', [START]),
  ])
  const START = (await one('SELECT DATE_FORMAT(NOW(6), "%Y-%m-%d %H:%i:%s.%f") t')).t
  const before = await snap()
  const adm = new S(), c2 = new S(), c1 = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c2.req('/api/auth/login', { method: 'POST', body: C2 })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const b = await chromium.launch()
  const adminAct = body => adm.req('/api/admin/orders', { method: 'POST', body })
  const quote = async (s, lines) => (await s.req('/api/checkout/quote', { method: 'POST', body: { lines } })).json?.quote
  const order = (s, lines, total, key = `ensaio-${randomUUID()}`) => s.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: key, lines, acceptedTotal: total, paymentMethod: 'bank_transfer', proofFile: null } })
  try {
    // ── 0. Dados bancários centrais ──
    console.log('\n0. Dados bancários (fonte única)')
    const bd = (await new S().req('/api/billing/bank-details')).json?.bank
    const pm = (await new S().req('/api/checkout/payment-methods')).json?.methods
    ok(bd?.bank === 'Banco BIC' && bd.iban === IBAN && bd.holder === HOLDER, `dados por omissão: ${bd?.bank} · ${bd?.iban} · ${bd?.holder}`)
    ok(JSON.stringify(pm?.find(m => m.id === 'bank_transfer')?.bank) === JSON.stringify(bd), 'checkout e Área do Cliente leem os mesmos dados')
    ok(pm?.find(m => m.id === 'card')?.available === false, 'cartão continua a depender do gateway (indisponível)')

    // ── A. .ao sozinho, desktop: comprovativo no checkout ──
    console.log('\nA. .ao sozinho (desktop): pagar já, comprovativo, validação com o domínio pendente')
    let { ctx, p } = await ctxFor(b, DESKTOP, c2.cookie)
    const aoA = `pago-${rnd()}.ao`
    await p.goto(BASE + '/dominios/pesquisar', { waitUntil: 'domcontentloaded' })
    await p.locator('#sn').fill(aoA.split('.')[0]); await p.locator('#sx').selectOption('.ao')
    await p.getByRole('button', { name: 'Pesquisar' }).click()
    const row = p.locator('[data-testid=domain-result]').first(); await row.waitFor()
    ok(await row.getAttribute('data-status') === 'confirm', `${aoA}: «A confirmar pela equipa»`)
    await row.getByTestId('request-registration').click()
    await p.waitForURL('**/dominios/configurar**'); await p.getByTestId('config-continue').click()
    await p.waitForURL('**/carrinho'); await p.getByTestId('summary-total').waitFor()
    const cartSum = await p.getByTestId('cart-summary').innerText()
    ok(/Total a pagar/.test(cartSum) && !/pago após confirmação/.test(cartSum) && (await p.getByTestId('summary-domain-confirm').innerText()) === NOTE, 'carrinho: «Total a pagar» completo e o novo aviso')
    const totalA = num(await p.getByTestId('summary-total').innerText())
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento')
    await p.getByTestId('summary-total').waitFor()
    ok((await p.getByTestId('domain-confirm-note').innerText()).trim() === NOTE, `pagamento: «${NOTE}»`)
    ok(!/Ainda não pague/.test(await p.locator('body').innerText()), 'sem «Ainda não pague»')
    const card = p.getByTestId('bank-card'); await card.waitFor()
    ok((await card.getByTestId('bank-card-label').innerText()) === 'Transferência bancária — Banco BIC', 'cartão: «Transferência bancária — Banco BIC»')
    ok((await card.getByTestId('bank-card-iban').innerText()) === IBAN && (await card.getByTestId('bank-card-holder').innerText()) === HOLDER, `cartão: IBAN ${IBAN} e entidade ${HOLDER}, sem alterar os dígitos`)
    const bg = await card.evaluate(e => getComputedStyle(e).backgroundImage)
    ok(/rgb\(215, 25, 46\)|#D7192E/i.test(bg), 'cartão vermelho')
    ok(await card.evaluate(e => getComputedStyle(e.querySelector('[data-testid=bank-card-iban]')).userSelect) !== 'none', 'IBAN em texto seleccionável')
    ok(!/CVV|validade|\b\d{4} \d{4} \d{4} \d{4}\b/i.test(await card.innerText()), 'cartão sem número de cartão, validade nem CVV')
    await card.getByTestId('copy-iban').click()
    await p.getByTestId('copy-status').filter({ hasText: 'IBAN copiado.' }).waitFor()
    ok((await p.evaluate(() => navigator.clipboard.readText())) === IBAN, '«Copiar IBAN» copia exactamente o IBAN, com confirmação «IBAN copiado.»')
    await card.getByTestId('copy-holder').click()
    await p.getByTestId('copy-status').filter({ hasText: 'Entidade copiada.' }).waitFor()
    ok((await p.evaluate(() => navigator.clipboard.readText())) === HOLDER && (await p.getByTestId('copy-status').getAttribute('aria-live')) === 'polite', '«Copiar entidade» copia a entidade; confirmação anunciada (aria-live)')
    await card.screenshot({ path: `${OUT}/desktop-01-cartao-transferencia.png` })
    await p.screenshot({ path: `${OUT}/desktop-02-pagamento-dominio-a-confirmar.png`, fullPage: true })
    ok(await p.locator('input[type=file]').count() === 1, 'envio de comprovativo disponível')
    await p.locator('input[type=file]').setInputFiles({ name: 'comprovativo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ensaio') })
    await p.getByText(/Comprovativo: comprovativo.pdf/).waitFor()
    await p.locator('[data-testid=to-review]:not([disabled])').click()
    ok(/Total a pagar/.test(await p.locator('body').innerText()) && num(await p.getByTestId('review-total').innerText()) === totalA, `revisão: «Total a pagar» ${await p.getByTestId('review-total').innerText()}`)
    await p.getByTestId('accept-terms').check()
    await p.getByTestId('confirm-order').dblclick()
    await p.waitForURL('**/orders/**')
    const idA = p.url().split('/orders/')[1].split('?')[0]
    await p.getByTestId('order-domain-confirm').waitFor()
    ok(await p.getByTestId('order-proof-pending').isVisible() && /Comprovativo por validar/.test(await p.locator('body').innerText()), 'encomenda: comprovativo «Por validar»; domínio a confirmar')
    ok(/A confirmar pela equipa/.test(await p.getByTestId('order-domain-state').innerText()), 'encomenda: estado do domínio «A confirmar pela equipa»')
    let oA = await one(`SELECT o.order_number, o.payment_status, o.hold_reason, i.status inv, (SELECT status FROM payments y WHERE y.order_id = o.id ORDER BY created_at DESC LIMIT 1) pay, oi.availability, oi.id item
      FROM orders o JOIN invoices i ON i.order_id = o.id JOIN order_items oi ON oi.order_id = o.id AND oi.availability IS NOT NULL WHERE o.id = ?`, [idA])
    ok(oA.payment_status === 'proof_submitted' && oA.inv === 'under_review' && oA.pay === 'under_review' && oA.availability === 'confirm' && oA.hold_reason === 'domain_confirmation', 'base: comprovativo por validar, factura em análise, domínio «confirm»')
    ok(Number((await one('SELECT COUNT(*) n FROM order_items WHERE domain_name = ?', [aoA])).n) === 1, 'duplo clique → uma só encomenda')
    await p.screenshot({ path: `${OUT}/desktop-03-encomenda-comprovativo.png`, fullPage: true })
    await ctx.close()

    // Painel: estados separados; validar pagamento mantém o domínio pendente
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    const openAdmin = async (num_) => { await p.goto(`${BASE}/admin/orders?filtro=todas&encomenda=${num_}`, { waitUntil: 'domcontentloaded' }); const c = p.locator(`#order-${num_}`); await c.waitFor(); return c }
    let ac = await openAdmin(oA.order_number)
    ok((await ac.getByTestId('order-payment-state').innerText()) === 'Pagamento: Comprovativo por validar' && /A confirmar pela equipa/.test(await ac.getByTestId('order-domain-state').innerText()), 'painel: «Pagamento: Comprovativo por validar» e «Domínio: A confirmar pela equipa» separados')
    await ac.screenshot({ path: `${OUT}/desktop-04-painel-por-validar.png` })
    p.answers.push(true)
    await ac.getByTestId('approve-payment').click()
    await p.locator('[role=status]').filter({ hasText: 'Pagamento confirmado' }).waitFor()
    ac = await openAdmin(oA.order_number)
    ok((await ac.getByTestId('order-payment-state').innerText()) === 'Pagamento: Paga' && /A confirmar pela equipa/.test(await ac.getByTestId('order-domain-state').innerText()), 'depois de validar: «Pagamento: Paga» e domínio ainda «A confirmar pela equipa»')
    oA = { ...oA, ...await one(`SELECT o.payment_status, i.status inv, (SELECT status FROM payments y WHERE y.order_id = o.id ORDER BY created_at DESC LIMIT 1) pay, s.provisioning_status ps, s.provisioning_error pe
      FROM orders o JOIN invoices i ON i.order_id = o.id JOIN services s ON s.order_id = o.id AND s.service_type = 'domain' WHERE o.id = ?`, [idA]) }
    ok(oA.payment_status === 'paid' && oA.inv === 'paid' && oA.pay === 'approved' && oA.ps === 'pending' && /A confirmar pela equipa/.test(oA.pe), `pagamento validado; registo à espera: «${oA.pe}»`)
    ok(await ac.getByTestId('mark-active').count() === 0 && await ac.getByTestId('await-domain').isVisible(), 'sem «Marcar como registado» antes de confirmar a disponibilidade')
    await ac.screenshot({ path: `${OUT}/desktop-05-painel-paga-dominio-a-confirmar.png` })
    // Domínio confirmado → registo manual com referência → «Registado»
    p.answers.push(true)
    await ac.getByTestId('domain-available').click()
    await p.locator('[role=status]').first().waitFor()
    ac = await openAdmin(oA.order_number)
    ok(/Confirmado — por registar/.test(await ac.getByTestId('order-domain-state').innerText()), `domínio confirmado: ${await ac.getByTestId('order-domain-state').innerText()}`)
    const sA = await one("SELECT provisioning_status ps FROM services WHERE order_id = ? AND service_type = 'domain'", [idA])
    ok(['manual_required', 'failed', 'active', 'pending'].includes(sA.ps) && sA.ps !== 'active', `registo segue o fluxo existente (${sA.ps}); não fica «Registado» sem confirmação do registo`)
    p.answers.push(`ENSAIO-REG-${rnd()}`)
    await ac.getByTestId('mark-active').first().click()
    await p.locator('[role=status]').filter({ hasText: 'Feito' }).waitFor()
    ac = await openAdmin(oA.order_number)
    ok(/Registado/.test(await ac.getByTestId('order-domain-state').innerText()), 'com a referência do registo: «Domínio: Registado»')
    await ac.getByTestId('domain-history').locator('summary').click()
    ok((await ac.getByTestId('domain-history').innerText()).includes('Disponibilidade confirmada'), 'histórico: «Disponibilidade confirmada»')
    await ctx.close()

    // ── B. .ao + e-mail corporativo (iPhone): comprovativo na Área do Cliente ──
    console.log('\nB. .ao + e-mail corporativo (iPhone): pagar já, comprovativo na Área do Cliente, indisponível após pagamento')
    ;({ ctx, p } = await ctxFor(b, IPHONE, c2.cookie))
    const nameB = `mail-${rnd()}`, aoB = `${nameB}.ao`
    await p.goto(BASE + '/comprar/email-starter', { waitUntil: 'domcontentloaded' })
    await p.locator('#dn').fill(nameB); await p.locator('#dx').selectOption('.ao')
    await p.getByRole('button', { name: 'Pesquisar' }).click()
    const rB = p.locator('[data-testid=domain-result]').first(); await rB.waitFor()
    ok(await rB.getAttribute('data-status') === 'confirm' && /Pode pagar agora/.test(await rB.innerText()), 'resultado .ao: «Pode pagar agora…»')
    await rB.getByTestId('choose-domain').click()
    await p.waitForURL('**passo=duracao**')
    await p.getByRole('button', { name: 'Mais uma caixa' }).click()
    await p.getByTestId('cycle-monthly').click()
    await p.getByTestId('add-to-cart').click(); await p.waitForURL('**/carrinho')
    await p.getByTestId('summary-total').waitFor()
    const linesB = await p.evaluate(() => JSON.parse(localStorage.getItem('viralizahost-cart-v2') || '{}').state?.lines ?? [])
    ok(linesB.some(l => l.type === 'domain' && l.domain === aoB) && linesB.some(l => l.type === 'product' && l.slug === 'email-starter' && l.domain === aoB && l.quantity === 2), 'carrinho misto: domínio .ao + e-mail (2 caixas)')
    const totalB = num(await p.getByTestId('summary-total').innerText())
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento')
    await p.getByTestId('bank-card').waitFor()
    ok((await p.getByTestId('domain-confirm-note').innerText()).trim() === NOTE, 'telemóvel: novo aviso no pagamento')
    ok(await overflow(p) <= 0, `telemóvel: sem deslocamento horizontal (${await overflow(p)}px)`)
    const box = await p.getByTestId('bank-card').boundingBox()
    ok(box && box.width <= 390 && box.width >= 300, `telemóvel: cartão responsivo (${Math.round(box?.width)}px)`)
    await p.getByTestId('bank-card').screenshot({ path: `${OUT}/iphone-01-cartao-transferencia.png` })
    await p.locator('[data-testid=to-review]:not([disabled])').click()
    await p.getByTestId('accept-terms').check(); await p.getByTestId('confirm-order').click()
    await p.waitForURL('**/orders/**')
    const idB = p.url().split('/orders/')[1].split('?')[0]
    const oB = await one('SELECT order_number, amount FROM orders WHERE id = ?', [idB])
    const cB = p.getByTestId('bank-card'); await cB.waitFor()
    ok(num(await cB.getByTestId('bank-card-amount').innerText()) === totalB && Number(oB.amount) === totalB, `encomenda: montante ${await cB.getByTestId('bank-card-amount').innerText()} no cartão`)
    ok((await cB.getByTestId('bank-card-reference').innerText()) === oB.order_number, `encomenda: referência do pedido ${oB.order_number}`)
    await cB.getByTestId('copy-reference').click()
    await p.getByTestId('copy-status').filter({ hasText: 'Referência copiada.' }).waitFor().catch(() => {})
    ok((await p.evaluate(() => navigator.clipboard.readText())) === oB.order_number, '«Copiar referência» copia o n.º do pedido')
    ok(await overflow(p) <= 0, 'encomenda no telemóvel sem deslocamento horizontal')
    await cB.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/iphone-02-encomenda-montante-referencia.png` })
    // Comprovativo pela Área do Cliente (fluxo existente)
    const invB = await one('SELECT id, invoice_number, status FROM invoices WHERE order_id = ?', [idB])
    ok(invB.status === 'pending', 'factura disponível para pagamento («pending»), não em rascunho')
    await p.goto(BASE + '/billing', { waitUntil: 'domcontentloaded' })
    await p.getByRole('button', { name: /Pagar Fatura/ }).first().click()
    const invBtn = p.locator('button', { hasText: invB.invoice_number })
    await invBtn.first().waitFor({ timeout: 10000 }).then(() => invBtn.first().click()).catch(() => {})
    await p.getByRole('button', { name: 'Continuar para pagamento' }).click()
    await p.getByRole('button', { name: /Banco BIC \/ Transferência/ }).click()
    await p.getByRole('button', { name: 'Continuar' }).click()
    const mc = p.getByTestId('bank-card'); await mc.waitFor()
    ok((await mc.getByTestId('bank-card-iban').innerText()) === IBAN && (await mc.getByTestId('bank-card-reference').innerText()) === invB.invoice_number && num(await mc.getByTestId('bank-card-amount').innerText()) === totalB, 'Área do Cliente: mesmo cartão, com montante e referência da factura')
    await p.screenshot({ path: `${OUT}/iphone-03-area-cliente-comprovativo.png` })
    await p.locator('input[type=file][accept=".png,.jpg,.jpeg,.pdf"]').setInputFiles({ name: 'comprovativo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ensaio') })
    await p.getByRole('button', { name: /Enviar Comprovativo/ }).click()
    await p.getByText('Comprovativo enviado!').waitFor()
    let sB = await one(`SELECT o.payment_status, i.status inv, (SELECT status FROM payments y WHERE y.invoice_id = i.id ORDER BY created_at DESC LIMIT 1) pay FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = ?`, [idB])
    ok(sB.payment_status === 'proof_submitted' && sB.pay === 'under_review', 'comprovativo enviado pela Área do Cliente: «Por validar»')
    ok(p.errors.length === 0, 'sem erros de consola no telemóvel', p.errors.join(' | '))
    await ctx.close()
    // Admin valida o pagamento: domínio e e-mail continuam à espera
    let r = await adminAct({ action: 'approve', orderId: idB })
    ok(r.status === 200 && r.json?.payment === 'paid', 'admin valida o pagamento (.ao + e-mail)')
    const svB = await all('SELECT service_type, provisioning_status ps, provisioning_error pe FROM services WHERE order_id = ?', [idB])
    ok(svB.length === 2 && svB.every(s => s.ps === 'pending') && /Aguarda a confirmação do domínio/.test(svB.find(s => s.service_type === 'email').pe), 'domínio e e-mail esperam a confirmação do domínio (sem criar caixas num domínio por confirmar)')
    // Indisponível depois do pagamento → caso manual
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/orders?filtro=dominios&encomenda=${oB.order_number}`, { waitUntil: 'domcontentloaded' })
    let bc = p.locator(`#order-${oB.order_number}`); await bc.waitFor()
    p.answers.push('Nome já registado por terceiros (ensaio)')
    await bc.getByTestId('domain-unavailable').click()
    await p.locator('[role=status]').first().waitFor()
    const itB = await one('SELECT id, availability, domain_case, domain_case_note FROM order_items WHERE order_id = ? AND availability IS NOT NULL', [idB])
    const stB = await one(`SELECT o.status, o.payment_status, o.hold_reason, i.status inv, (SELECT COUNT(*) FROM payments y WHERE y.invoice_id = i.id AND y.status = 'approved') ap,
      (SELECT COUNT(*) FROM payments y WHERE y.invoice_id = i.id AND y.status = 'refunded') rf FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = ?`, [idB])
    ok(itB.availability === 'unavailable' && itB.domain_case === 'manual_review' && itB.domain_case_note === 'Nome já registado por terceiros (ensaio)', 'indisponível após pagamento: caso manual com o motivo')
    ok(stB.status !== 'cancelled' && stB.payment_status === 'paid' && stB.inv === 'paid' && Number(stB.ap) === 1 && Number(stB.rf) === 0 && stB.hold_reason === 'domain_review', 'pagamento, factura e encomenda preservados; nenhum reembolso automático')
    await p.reload({ waitUntil: 'domcontentloaded' }); bc = p.locator(`#order-${oB.order_number}`); await bc.waitFor()
    ok(/em tratamento pela equipa/.test(await bc.getByTestId('order-domain-state').innerText()) && (await bc.getByTestId('order-payment-state').innerText()) === 'Pagamento: Paga', 'painel: «Paga» e «Domínio: Indisponível — em tratamento pela equipa»')
    p.answers.push(`${nameB}-angola.ao`, 'Proposto por telefone (ensaio)')
    await bc.getByTestId('case-propose').click()
    await p.locator('[role=status]').filter({ hasText: 'Feito' }).waitFor()
    await p.reload({ waitUntil: 'domcontentloaded' }); bc = p.locator(`#order-${oB.order_number}`); await bc.waitFor()
    ok(/outro domínio proposto/.test(await bc.getByTestId('order-domain-state').innerText()) && (await bc.getByTestId('domain-case').innerText()).includes(`${nameB}-angola.ao`), 'proposta de outro domínio registada')
    p.answers.push('Cliente prefere reembolso (ensaio)')
    await bc.getByTestId('case-refund').click()
    await p.locator('[role=status]').filter({ hasText: 'Feito' }).waitFor()
    const afterRefund = await one(`SELECT oi.domain_case, o.payment_status, i.status inv, (SELECT COUNT(*) FROM payments y WHERE y.invoice_id = i.id AND y.status = 'approved') ap FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN invoices i ON i.order_id = o.id WHERE oi.id = ?`, [itB.id])
    ok(afterRefund.domain_case === 'refund_manual' && afterRefund.payment_status === 'paid' && afterRefund.inv === 'paid' && Number(afterRefund.ap) === 1, 'encaminhado para reembolso manual: nada é reembolsado automaticamente')
    p.answers.push('Reembolso feito pela equipa financeira, ref. ENSAIO-RB-1')
    await p.reload({ waitUntil: 'domcontentloaded' }); bc = p.locator(`#order-${oB.order_number}`); await bc.waitFor()
    await bc.getByTestId('case-resolve').click()
    await p.locator('[role=status]').filter({ hasText: 'Feito' }).waitFor()
    // caso encerrado: sai do filtro «em tratamento»
    await p.goto(`${BASE}/admin/orders?filtro=todas&encomenda=${oB.order_number}`, { waitUntil: 'domcontentloaded' }); bc = p.locator(`#order-${oB.order_number}`); await bc.waitFor()
    await bc.getByTestId('domain-history').locator('summary').click()
    const hist = await bc.getByTestId('domain-event').evaluateAll(els => els.map(e => e.dataset.action))
    ok(JSON.stringify(hist) === JSON.stringify(['unavailable_manual_review', 'alternative_proposed', 'refund_forwarded', 'case_resolved']), `histórico da decisão: ${hist.join(' → ')}`)
    const admName = (await one("SELECT full_name FROM profiles WHERE email = 'admin@ensaio.test'")).full_name
    const histText = await bc.getByTestId('domain-history').innerText()
    ok(histText.includes(admName) && /\d{2}\/\d{2}\/\d{4}/.test(histText) && histText.includes('Nome já registado por terceiros (ensaio)'), `histórico com data, autor (${admName}) e motivo`)
    ok(/Domínio em tratamento|Domínio indisponível/.test(await bc.innerText()) && !/Activação: A aguardar pagamento/.test(await bc.innerText()), 'activação não diz «A aguardar pagamento» numa encomenda paga')
    ok(/Pagamento validado em/.test(await bc.innerText()), 'painel mostra quando o pagamento foi validado (pagamento ligado à factura)')
    await bc.screenshot({ path: `${OUT}/desktop-06-painel-indisponivel-historico.png` })
    await ctx.close()
    // Cliente vê o caso (antes de encerrar já via proposta; agora encerrado)
    const cr = await c2.req(`/orders/${idB}`)
    ok(cr.status === 200 && /Indisponível/.test(cr.text) && !/Ainda não pague/.test(cr.text), 'cliente vê o domínio indisponível na encomenda')

    // ── C. Substituição aceite pelo cliente (API) ──
    console.log('\nC. Outro domínio aceite: substituição e activação')
    const nameC = `troca-${rnd()}`
    const linesC = [{ type: 'domain', domain: `${nameC}.ao`, operation: 'register', years: 1 }, { type: 'product', slug: 'email-starter', cycle: 'monthly', quantity: 1, domain: `${nameC}.ao`, domainMode: 'register' }]
    const qC = await quote(c2, linesC)
    ok(qC?.valid && qC.needsConfirmation, 'cotação válida com domínio a confirmar')
    r = await order(c2, linesC, qC.total); const idC = r.json?.order?.id
    ok(r.status === 201 && idC, `encomenda criada (${r.status})`)
    await adminAct({ action: 'approve', orderId: idC })
    const itC = await one('SELECT id FROM order_items WHERE order_id = ? AND availability IS NOT NULL', [idC])
    r = await adminAct({ action: 'domain_availability', orderItemId: itC.id, available: false })
    ok(r.status === 400, `indisponível sem motivo recusado (${r.status})`)
    await adminAct({ action: 'domain_availability', orderItemId: itC.id, available: false, reason: 'Ocupado (ensaio)' })
    await adminAct({ action: 'domain_case', caseAction: 'propose', orderItemId: itC.id, domain: `${nameC}-novo.ao` })
    r = await adminAct({ action: 'domain_case', caseAction: 'replace', orderItemId: itC.id, domain: `${nameC}-novo.com`, confirmed: true })
    ok(r.status === 409, 'substituição por outra extensão (outro preço) recusada')
    r = await adminAct({ action: 'domain_case', caseAction: 'replace', orderItemId: itC.id, domain: `${nameC}-novo.ao`, confirmed: true, notes: 'Cliente aceitou' })
    const svC = await all('SELECT service_type, domain, provisioning_status ps FROM services WHERE order_id = ? ORDER BY service_type', [idC])
    ok(r.status === 200 && svC.every(s => s.domain === `${nameC}-novo.ao`), `domínio substituído no item e nos serviços (${svC.map(s => s.domain).join(', ')})`)
    ok(svC.find(s => s.service_type === 'email').ps === 'active', 'com o novo domínio confirmado, o e-mail é activado (WHM simulado)')
    ok(svC.find(s => s.service_type === 'domain').ps !== 'active', 'o domínio só fica «Registado» com a confirmação do registo')

    // ── D. Validações e regras mantidas ──
    console.log('\nD. Validações mantidas')
    const linesD = [{ type: 'domain', domain: `nopay-${rnd()}.co.ao`, operation: 'register', years: 1 }]
    const qD = await quote(c2, linesD)
    ok(qD?.valid && qD.needsConfirmation, '.co.ao também «a confirmar»')
    r = await order(c2, linesD, qD.total - 100)
    ok(r.status === 409 && r.json?.code === 'price_changed', 'total adulterado → 409 (preço validado no servidor)')
    const key = `ensaio-${randomUUID()}`
    const [d1, d2] = await Promise.all([order(c2, linesD, qD.total, key), order(c2, linesD, qD.total, key)])
    ok(d1.json?.order?.id && d1.json.order.id === d2.json?.order?.id, 'mesma chave → uma só encomenda (duplicados evitados)')
    const qT = await quote(c2, [{ type: 'domain', domain: `ocupado-${rnd()}.com`, operation: 'register', years: 1 }])
    ok(qT && !qT.valid && qT.lines[0].availability?.status === 'unavailable', 'domínio já identificado como indisponível continua bloqueado')
    // Sem pagamento → indisponível cancela, como antes (registo local pendente removido sem erro)
    const itD = await one('SELECT id FROM order_items WHERE order_id = ? AND availability IS NOT NULL', [d1.json.order.id])
    r = await adminAct({ action: 'domain_availability', orderItemId: itD.id, available: false, reason: 'Ocupado (ensaio)' })
    const stD = await one('SELECT o.status, i.status inv FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = ?', [d1.json.order.id])
    ok(r.status === 200 && r.json?.cancelled && stD.status === 'cancelled' && stD.inv === 'cancelled', 'sem pagamento: encomenda cancelada sem cobrança (como antes)')
    r = await c1.req('/api/admin/orders', { method: 'POST', body: { action: 'domain_case', caseAction: 'refund', orderItemId: itB.id, notes: 'x' } })
    ok(r.status === 401, `cliente não acede às acções do painel (${r.status})`)
    r = await new S().req('/api/admin/orders')
    ok(r.status === 401, 'visitante não lê as encomendas do painel')

    // ── E. Registos anteriores ──
    console.log('\nE. Encomendas, pagamentos e facturas anteriores')
    ok((await snap()) === before, 'encomendas, facturas e pagamentos anteriores inalterados')
  } catch (e) {
    ok(false, 'execução', e.stack)
  } finally {
    await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = ?", [C2.email]).catch(() => {})
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
