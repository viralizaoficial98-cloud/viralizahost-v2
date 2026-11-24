// Configurações → Facturação: IBAN, titular e imagem do cartão de transferência (ensaio, dados fictícios).
// Cobre: permissões, IBAN inválido/incompleto, guardar e actualizar, imagem (carregar, substituir, remover, ficheiros
// inválidos, falha mantém a anterior), auditoria, checkout/encomenda e Área do Cliente (desktop e telemóvel),
// facturas já emitidas intactas e cópia dos dados nas facturas novas. Repõe no fim a configuração original.
//   BASE_URL=http://localhost:3000 OUT=/tmp/banco node --env-file=.env.local scripts/mariadb/rehearsal/bank-settings-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-banco'
const FIX = path.join(__dirname, 'fixtures')
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => Math.random().toString(36).slice(2, 7)
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const C2 = { email: 'cliente2@ensaio.test', password: 'Cliente#Dois2026' }
// IBAN fictício com dígitos de controlo calculados (ISO 13616); BBAN começa por zeros para testar a sua preservação
function makeIban(cc, bban) {
  const s = bban + cc + '00'
  let rem = 0
  for (const ch of s) for (const d of (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch)) rem = (rem * 10 + Number(d)) % 97
  return cc + String(98 - rem).padStart(2, '0') + bban
}
const IBAN1 = makeIban('AO', '000400000123456789012')   // fictício
const IBAN2 = makeIban('AO', '005500009876543210987')   // fictício
const group = s => s.replace(/(.{4})(?=.)/g, '$1 ')
const HOLDER1 = 'Empresa Ensaio Fictícia, Lda', HOLDER2 = 'Ensaio Pagamentos Teste SA'

class S {
  cookie = ''
  async req(p, { method = 'GET', body, form } = {}) {
    const headers = { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }
    const res = await fetch(BASE + p, { method, redirect: 'manual', headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json, text: t }
  }
}
const fileForm = (buf, name, type) => { const fd = new FormData(); fd.append('file', new Blob([buf], { type }), name); return fd }
async function ctxFor(b, opts, cookie) {
  const ctx = await b.newContext({ ...opts, permissions: ['clipboard-read', 'clipboard-write'] })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message))
  p.on('dialog', d => d.accept())
  return { ctx, p }
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const settings = () => one('SELECT * FROM company_billing_settings WHERE active = 1')
  const snapSettings = await settings()
  const invHash = async () => (await one("SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, total, amount_paid, updated_at, COALESCE(bank_details, '-')) ORDER BY id)) h FROM invoices WHERE created_at < ?", [START])).h
  const START = (await one('SELECT DATE_FORMAT(NOW(6), "%Y-%m-%d %H:%i:%s.%f") t')).t
  const invBefore = await invHash()
  const auditCount = async () => Number((await one("SELECT COUNT(*) n FROM activity_logs WHERE entity_type = 'billing_settings' AND created_at >= ?", [START])).n)
  const adm = new S(), c2 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c2.req('/api/auth/login', { method: 'POST', body: C2 })
  const API = '/api/admin/billing-settings', IMG = '/api/admin/billing-settings/bank-card-image'
  const served = async url => { const r = await fetch(BASE + url); return { status: r.status, type: r.headers.get('content-type') } }
  const b = await chromium.launch()
  try {
    // ── 0. Migração ──
    console.log('\n0. Migração: uma configuração guardada; facturas emitidas com cópia dos dados')
    ok(snapSettings && snapSettings.iban && snapSettings.account_holder, `configuração guardada (${snapSettings?.bank_name} · ${snapSettings?.iban} · ${snapSettings?.account_holder})`)
    ok(Number((await one('SELECT COUNT(*) n FROM invoices WHERE bank_details IS NULL AND created_at < ?', [START])).n) === 0, 'todas as facturas emitidas têm a cópia dos dados de transferência')
    let g = await adm.req(API)
    ok(g.status === 200 && g.json.bankCheck?.valid === false && /não é um IBAN válido/.test(g.json.bankCheck.message), 'valor antigo que não é IBAN válido: aviso ao administrador (sem alteração automática)')

    // ── 1. Permissões ──
    console.log('\n1. Só administradores')
    let r = await anon.req(API); ok(r.status === 401, `visitante: ler → ${r.status}`)
    r = await c2.req(API, { method: 'POST', body: { iban: IBAN1, account_holder: HOLDER1 } }); ok([401, 403].includes(r.status), `cliente: guardar IBAN → ${r.status}`)
    r = await c2.req(IMG, { method: 'POST', form: fileForm(fs.readFileSync(path.join(FIX, 'cartao-ensaio-1.png')), 'c.png', 'image/png') }); ok([401, 403].includes(r.status), `cliente: carregar imagem → ${r.status}`)
    r = await anon.req(IMG, { method: 'DELETE' }); ok(r.status === 401, `visitante: remover imagem → ${r.status}`)
    ok((await settings()).iban === snapSettings.iban && (await settings()).bank_card_image_path === snapSettings.bank_card_image_path, 'configuração intacta depois das tentativas sem permissão')

    // ── 2. Valor antigo preservado; validação só quando muda ──
    console.log('\n2. Valor antigo preservado ao guardar outros campos')
    r = await adm.req(API, { method: 'POST', body: { iban: snapSettings.iban, account_holder: snapSettings.account_holder, swift: 'ENSAIOXX' } })
    ok(r.status === 200 && (await settings()).iban === snapSettings.iban && (await settings()).swift === 'ENSAIOXX', 'outra alteração não reescreve nem bloqueia o IBAN antigo')
    await adm.req(API, { method: 'POST', body: { swift: snapSettings.swift ?? '' } })

    // ── 3. IBAN inválido ──
    console.log('\n3. IBAN inválido ou incompleto recusado no servidor')
    for (const [label, iban, code, re] of [
      ['número de conta (21 dígitos)', '0040 0000 1234 5678 9012 3', 'account_number', /número de conta.*IBAN completo/],
      ['IBAN incompleto (falta 1 dígito)', IBAN1.slice(0, -1), 'length', /incompleto/],
      ['dígito trocado', IBAN1.slice(0, -1) + ((Number(IBAN1.slice(-1)) + 1) % 10), 'checksum', /controlo/],
      ['caracteres inválidos', 'AO06-0004-0000', 'chars', /letras e números/],
      ['sem código do país', '06 0004 0000 0123 4567 8901 2X', 'format', /código do país/],
    ]) {
      r = await adm.req(API, { method: 'POST', body: { iban, account_holder: HOLDER1 } })
      ok(r.status === 400 && r.json?.field === 'iban' && r.json.code === code && re.test(r.json.error), `recusa ${label} → «${r.json?.error?.slice(0, 90)}…»`)
    }
    r = await adm.req(API, { method: 'POST', body: { iban: IBAN1, account_holder: 'X' } })
    ok(r.status === 400 && r.json?.field === 'account_holder', 'titular demasiado curto recusado')
    ok((await settings()).iban === snapSettings.iban, 'nada gravado com dados inválidos (nem prefixos nem dígitos acrescentados)')

    // ── 4. Painel: guardar e actualizar ──
    console.log('\n4. Painel: guardar e actualizar IBAN e titular')
    let { ctx, p } = await ctxFor(b, DESKTOP, adm.cookie)
    await p.goto(BASE + '/admin/settings/billing', { waitUntil: 'domcontentloaded' })
    await p.getByTestId('card-image-section').waitFor()
    ok(await p.getByTestId('iban-warning').isVisible(), 'painel mostra o aviso do IBAN antigo')
    const sec = p.locator('div', { has: p.getByRole('heading', { name: 'Transferência bancária' }) }).last()
    await sec.scrollIntoViewIfNeeded(); await sec.screenshot({ path: `${OUT}/desktop-01-painel-aviso-iban-antigo.png` })
    await p.getByTestId('bank-iban').fill('0040 0000 1234 5678 9012 3')
    await p.getByRole('button', { name: /Guardar Alterações/ }).click()
    await p.getByTestId('field-error').waitFor()
    ok(/número de conta/.test(await p.getByTestId('field-error').innerText()) && /IBAN completo/.test(await p.getByTestId('field-error').innerText()), `mensagem clara no formulário: «${(await p.getByTestId('field-error').innerText()).slice(0, 80)}…»`)
    await p.getByTestId('field-error').scrollIntoViewIfNeeded(); await sec.screenshot({ path: `${OUT}/desktop-02-painel-iban-incompleto.png` })
    const a0 = await auditCount()
    await p.getByTestId('bank-iban').fill(group(IBAN1))
    await p.getByTestId('bank-holder').fill(HOLDER1)
    await p.getByRole('button', { name: /Guardar Alterações/ }).click()
    await p.getByText('Definições guardadas com sucesso.').waitFor()
    let st = await settings()
    ok(st.iban === IBAN1 && st.iban.slice(4, 8) === '0004' && st.account_holder === HOLDER1, `guardado: ${st.iban} (espaços retirados, zeros iniciais mantidos) · ${st.account_holder}`)
    ok(await p.getByTestId('iban-warning').count() === 0, 'aviso desaparece com um IBAN válido')
    ok((await p.getByTestId('card-preview').getByTestId('bank-card-iban').innerText()) === group(IBAN1), 'pré-visualização do cartão com o IBAN em grupos de 4')
    const log1 = await one("SELECT profile_id, description FROM activity_logs WHERE entity_type = 'billing_settings' AND created_at >= ? ORDER BY created_at DESC LIMIT 1", [START])
    ok(await auditCount() === a0 + 1 && log1.description.includes(IBAN1) && log1.description.includes(HOLDER1), 'alteração registada na auditoria (IBAN e titular, antes → depois)')
    // actualizar
    r = await adm.req(API, { method: 'POST', body: { iban: group(IBAN2), account_holder: HOLDER2 } })
    st = await settings()
    ok(r.status === 200 && st.iban === IBAN2 && st.account_holder === HOLDER2 && await auditCount() === a0 + 2, `actualizado para ${IBAN2} · ${HOLDER2} (auditado)`)

    // ── 5. Imagem do cartão ──
    console.log('\n5. Imagem: carregar, substituir, ficheiros inválidos, remover')
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.getByTestId('card-image-section').waitFor()
    await p.getByTestId('card-image-input').setInputFiles(path.join(FIX, 'cartao-ensaio-1.png'))
    await p.getByTestId('card-image-save').waitFor()
    const pvText = await p.getByTestId('card-preview').innerText(), pvSrc = await p.getByTestId('card-preview').getByTestId('bank-card-image').getAttribute('src').catch(() => null)
    ok(/ainda não guardada/i.test(pvText) && String(pvSrc).startsWith('blob:'), 'pré-visualização antes de guardar', `${pvText.slice(0, 80)} | ${pvSrc}`)
    ok((await settings()).bank_card_image_path == null, 'nada gravado antes de «Guardar imagem»')
    await p.getByTestId('card-image-section').scrollIntoViewIfNeeded(); await p.getByTestId('card-image-section').screenshot({ path: `${OUT}/desktop-03-painel-pre-visualizacao.png` })
    await p.getByTestId('card-image-save').click()
    await p.getByTestId('card-image-msg').filter({ hasText: 'Imagem guardada.' }).waitFor()
    st = await settings(); const img1 = st.bank_card_image_path
    let sv = await served(`/storage/v1/object/public/billing-assets/${img1}`)
    ok(/^bank-card\/[0-9a-f-]+\.png$/.test(img1) && sv.status === 200 && sv.type === 'image/png', `imagem PNG guardada e servida (${img1})`)
    // ficheiros inválidos (API e formulário): a imagem anterior mantém-se
    for (const [label, buf, name, type] of [
      ['texto com extensão .png', fs.readFileSync(path.join(FIX, 'nao-e-imagem.png')), 'falso.png', 'image/png'],
      ['GIF', Buffer.from('GIF89a' + 'x'.repeat(40)), 'a.gif', 'image/gif'],
      ['JPEG declarado como PNG', fs.readFileSync(path.join(FIX, 'cartao-ensaio-2.jpg')), 'x.png', 'image/png'],
      ['maior que 2 MB', Buffer.concat([fs.readFileSync(path.join(FIX, 'cartao-ensaio-1.png')), Buffer.alloc(2.2 * 1024 * 1024)]), 'grande.png', 'image/png'],
      ['ficheiro vazio', Buffer.alloc(0), 'vazio.png', 'image/png'],
    ]) {
      r = await adm.req(IMG, { method: 'POST', form: fileForm(buf, name, type) })
      ok(r.status === 400 && (await settings()).bank_card_image_path === img1, `recusa ${label} (${r.status}: ${r.json?.error?.slice(0, 60)}); imagem anterior mantém-se`)
    }
    await p.getByTestId('card-image-input').setInputFiles({ name: 'falso.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(FIX, 'nao-e-imagem.png')) })
    await p.getByTestId('card-image-save').click()
    await p.getByTestId('card-image-msg').waitFor()
    ok(/Formato não aceite/.test(await p.getByTestId('card-image-msg').innerText()) && (await settings()).bank_card_image_path === img1 && (await served(`/storage/v1/object/public/billing-assets/${img1}`)).status === 200, 'falha no carregamento (formulário): mensagem e a imagem anterior continua guardada e servida')
    await p.getByTestId('card-image-cancel').click()
    // substituir
    const a1 = await auditCount()
    await p.getByTestId('card-image-choose').click().catch(() => {})
    await p.getByTestId('card-image-input').setInputFiles(path.join(FIX, 'cartao-ensaio-2.jpg'))
    await p.getByTestId('card-image-save').click()
    await p.getByTestId('card-image-msg').filter({ hasText: 'Imagem guardada.' }).waitFor()
    const img2 = (await settings()).bank_card_image_path
    ok(img2 !== img1 && /\.jpg$/.test(img2) && (await served(`/storage/v1/object/public/billing-assets/${img2}`)).status === 200 && (await served(`/storage/v1/object/public/billing-assets/${img1}`)).status === 404, 'substituída por JPEG; a anterior foi apagada do armazenamento')
    ok(await auditCount() === a1 + 1 && /substituída/.test((await one("SELECT description FROM activity_logs WHERE entity_type = 'billing_settings' ORDER BY created_at DESC LIMIT 1")).description), 'substituição auditada')
    r = await adm.req(IMG, { method: 'POST', form: fileForm(fs.readFileSync(path.join(FIX, 'cartao-ensaio-3.webp')), 'c.webp', 'image/webp') })
    const img3 = (await settings()).bank_card_image_path
    ok(r.status === 200 && /\.webp$/.test(img3) && (await served(`/storage/v1/object/public/billing-assets/${img3}`)).type === 'image/webp', 'WebP aceite')
    await p.reload({ waitUntil: 'domcontentloaded' }); await p.getByTestId('card-image-section').waitFor()
    await p.getByTestId('card-image-section').scrollIntoViewIfNeeded(); await p.getByTestId('card-image-section').screenshot({ path: `${OUT}/desktop-04-painel-imagem-guardada.png` })
    ok(p.errors.length === 0, 'painel sem erros de consola', p.errors.join(' | '))
    await ctx.close()

    // ── 6. Checkout e encomenda (desktop) com .ao a confirmar ──
    console.log('\n6. Checkout e encomenda (desktop): dados guardados, imagem e .ao a confirmar')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c2.cookie))
    const ao = `banco-${rnd()}`
    await p.goto(BASE + '/dominios/pesquisar', { waitUntil: 'domcontentloaded' })
    await p.locator('#sn').fill(ao); await p.locator('#sx').selectOption('.ao')
    await p.getByRole('button', { name: 'Pesquisar' }).click()
    const row = p.locator('[data-testid=domain-result]').first(); await row.waitFor()
    await row.getByTestId('request-registration').click()
    await p.waitForURL('**/dominios/configurar**'); await p.getByTestId('config-continue').click()
    await p.waitForURL('**/carrinho'); await p.getByTestId('summary-total').waitFor()
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento')
    const card = p.getByTestId('bank-card'); await card.waitFor()
    await p.getByTestId('domain-confirm-note').waitFor()
    ok(await p.getByTestId('domain-confirm-note').isVisible(), '.ao a confirmar: continua a poder pagar por transferência')
    ok((await card.getByTestId('bank-card-iban').innerText()) === group(IBAN2) && (await card.getByTestId('bank-card-holder').innerText()).toUpperCase() === HOLDER2.toUpperCase(), `checkout: IBAN ${group(IBAN2)} e titular guardados no painel`)
    ok((await card.getByTestId('bank-card-image').getAttribute('src')).endsWith(img3) && await card.getByTestId('bank-card-image').getAttribute('alt') === '' && await card.getByTestId('bank-card-image').getAttribute('aria-hidden') === 'true', 'imagem do cartão como elemento decorativo (alt vazio, aria-hidden)')
    await card.getByTestId('copy-iban').click(); await p.getByTestId('copy-status').filter({ hasText: 'IBAN copiado.' }).waitFor()
    ok((await p.evaluate(() => navigator.clipboard.readText())) === IBAN2, '«Copiar IBAN» copia o IBAN sem espaços')
    await card.getByTestId('copy-holder').click(); await p.getByTestId('copy-status').filter({ hasText: 'Entidade copiada.' }).waitFor()
    ok((await p.evaluate(() => navigator.clipboard.readText())) === HOLDER2, '«Copiar entidade» copia o titular')
    await card.screenshot({ path: `${OUT}/desktop-05-checkout-cartao-com-imagem.png` })
    await p.locator('[data-testid=to-review]:not([disabled])').click()
    await p.getByTestId('accept-terms').check(); await p.getByTestId('confirm-order').click()
    await p.waitForURL('**/orders/**')
    const idO = p.url().split('/orders/')[1].split('?')[0]
    const oc = p.getByTestId('bank-card'); await oc.waitFor()
    const ord = await one('SELECT o.order_number, o.amount, i.bank_details, i.invoice_number FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = ?', [idO])
    ok((await oc.getByTestId('bank-card-reference').innerText()) === ord.order_number && (await oc.getByTestId('bank-card-amount').isVisible()), 'encomenda: montante e referência mantidos no cartão')
    const snapNew = JSON.parse(ord.bank_details)
    ok(snapNew.iban === IBAN2 && snapNew.holder === HOLDER2, 'factura nova guarda os dados em vigor (IBAN e titular do painel)')
    await p.screenshot({ path: `${OUT}/desktop-06-encomenda.png` })
    ok(p.errors.length === 0, 'checkout sem erros de consola', p.errors.join(' | '))
    await ctx.close()

    // ── 7. Telemóvel: encomenda e Área do Cliente ──
    console.log('\n7. Telemóvel: encomenda e Área do Cliente com os mesmos dados')
    ;({ ctx, p } = await ctxFor(b, IPHONE, c2.cookie))
    await p.goto(`${BASE}/orders/${idO}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('bank-card').waitFor()
    ok((await p.getByTestId('bank-card-iban').innerText()) === group(IBAN2) && await p.getByTestId('bank-card-image').count() === 1 && await overflow(p) <= 0, 'telemóvel (encomenda): IBAN, imagem, sem deslocamento horizontal')
    await p.getByTestId('bank-card').screenshot({ path: `${OUT}/iphone-01-encomenda-cartao.png` })
    await p.goto(BASE + '/billing', { waitUntil: 'domcontentloaded' })
    await p.getByRole('button', { name: /Pagar Fatura/ }).first().click()
    const inv = p.locator('button', { hasText: ord.invoice_number })
    await inv.first().waitFor({ timeout: 10000 }).then(() => inv.first().click()).catch(() => {})
    await p.getByRole('button', { name: 'Continuar para pagamento' }).click()
    await p.getByRole('button', { name: /Banco BIC \/ Transferência/ }).click()
    await p.getByRole('button', { name: 'Continuar' }).click()
    const mc = p.getByTestId('bank-card'); await mc.waitFor()
    ok((await mc.getByTestId('bank-card-iban').innerText()) === group(IBAN2) && (await mc.getByTestId('bank-card-holder').innerText()).toUpperCase() === HOLDER2.toUpperCase() && (await mc.getByTestId('bank-card-reference').innerText()) === ord.invoice_number, 'telemóvel (Área do Cliente): mesmos dados, referência da factura')
    await mc.screenshot({ path: `${OUT}/iphone-02-area-cliente-cartao.png` })
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c2.cookie))
    await p.goto(BASE + '/billing', { waitUntil: 'domcontentloaded' })
    // desktop: botão «Pagar» na linha da factura (abre o pagamento dessa factura)
    await p.locator('tr', { hasText: ord.invoice_number }).getByRole('button', { name: 'Pagar', exact: true }).click()
    await p.getByRole('button', { name: 'Continuar para pagamento' }).click()
    await p.getByRole('button', { name: /Banco BIC \/ Transferência/ }).click()
    await p.getByRole('button', { name: 'Continuar' }).click()
    await p.getByTestId('bank-card').waitFor()
    ok((await p.getByTestId('bank-card-iban').innerText()) === group(IBAN2) && await p.getByTestId('bank-card-image').count() === 1, 'desktop (Área do Cliente): mesmos dados e imagem')
    ok(Number((await one("SELECT COUNT(*) n FROM payments y JOIN invoices i ON i.id = y.invoice_id WHERE i.invoice_number = ?", [ord.invoice_number])).n) === 1, 'reabrir o pagamento continua o pagamento já iniciado (sem duplicar)')
    await p.getByTestId('bank-card').screenshot({ path: `${OUT}/desktop-07-area-cliente-cartao.png` })
    await ctx.close()

    // ── 8. Remover a imagem: os dados continuam visíveis ──
    console.log('\n8. Remover a imagem')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(BASE + '/admin/settings/billing', { waitUntil: 'domcontentloaded' }); await p.getByTestId('card-image-section').waitFor()
    await p.getByTestId('card-image-remove').click()
    await p.getByTestId('card-image-msg').filter({ hasText: 'Imagem removida.' }).waitFor()
    ok((await settings()).bank_card_image_path == null && (await served(`/storage/v1/object/public/billing-assets/${img3}`)).status === 404, 'imagem removida da configuração e do armazenamento')
    const lastLog = await one("SELECT action, description FROM activity_logs WHERE entity_type = 'billing_settings' ORDER BY created_at DESC LIMIT 1")
    ok(lastLog.action === 'delete' && /removida/.test(lastLog.description), 'remoção auditada')
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, IPHONE, c2.cookie))
    await p.goto(`${BASE}/orders/${idO}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('bank-card').waitFor()
    ok(await p.getByTestId('bank-card-image').count() === 0 && (await p.getByTestId('bank-card-iban').innerText()) === group(IBAN2) && (await p.getByTestId('bank-card-holder').isVisible()), 'sem imagem: IBAN e titular continuam visíveis (fundo vermelho)')
    await p.getByTestId('bank-card').screenshot({ path: `${OUT}/iphone-03-cartao-sem-imagem.png` })
    await ctx.close()

    // ── 9. Facturas emitidas ──
    console.log('\n9. Facturas já emitidas')
    ok((await invHash()) === invBefore, 'facturas emitidas antes do teste intactas (estado, valores, datas e dados bancários da emissão)')
  } catch (e) {
    ok(false, 'execução', e.stack)
  } finally {
    // Repor a configuração original (valores e imagem); ficheiros de ensaio removidos
    try {
      const cur = await settings()
      if (cur.bank_card_image_path && cur.bank_card_image_path !== snapSettings.bank_card_image_path) await adm.req(IMG, { method: 'DELETE' })
      await db.query('UPDATE company_billing_settings SET bank_name = ?, account_holder = ?, iban = ?, account_number = ?, swift = ?, payment_instructions = ?, bank_card_image_path = ? WHERE id = ?',
        [snapSettings.bank_name, snapSettings.account_holder, snapSettings.iban, snapSettings.account_number, snapSettings.swift, snapSettings.payment_instructions, snapSettings.bank_card_image_path, snapSettings.id])
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = ?", [C2.email])
      const after = await settings()
      ok(after.iban === snapSettings.iban && after.account_holder === snapSettings.account_holder && after.bank_card_image_path === snapSettings.bank_card_image_path, 'configuração original reposta')
    } catch (e) { ok(false, 'reposição', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
