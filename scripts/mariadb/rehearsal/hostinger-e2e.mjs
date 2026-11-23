#!/usr/bin/env node
/**
 * Ensaio do registrador Hostinger contra a API SIMULADA (mock-hostinger.mjs). Base de ENSAIO apenas:
 * cria encomendas, aprova pagamentos e altera a configuração do registrador (reposta no fim).
 * Nenhum domínio real é comprado: o processo Next de ensaio fala só com http://127.0.0.1:12091.
 *
 *   BASE_URL=http://localhost:3000 HOSTINGER_SIM_URL=http://127.0.0.1:12091 APP_LOG=/caminho/next.log OUT=/tmp/hst \
 *     node --env-file=.env.local scripts/mariadb/rehearsal/hostinger-e2e.mjs
 * Next de ensaio: REGISTRAR_TEST_PROVISIONING=1 e REGISTRAR_TIMEOUT_MS=2000; mock com --delay=4000.
 */
import mysql from 'mysql2/promise'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const SIM = process.env.HOSTINGER_SIM_URL || 'http://127.0.0.1:12091'
const TOKEN = process.env.MOCK_HOSTINGER_TOKEN || 'hostinger-de-ensaio'
const OUT = process.env.OUT || './ui-shots-hostinger'
mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 400) : ''}`) }

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : '' }
    const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
const one = async (sql, p = []) => (await db.query(sql, p))[0][0]
const rnd = () => randomBytes(3).toString('hex')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const rawStats = async () => (await (await fetch(`${SIM}/_stats`)).json())
let BASE_STATS = null
/** Contadores do simulador desde o início deste ensaio (o simulador pode ter corrido antes). */
const stats = async () => { const s = await rawStats(); return { ...s, purchaseCalls: s.purchaseCalls - BASE_STATS.purchaseCalls, setupCalls: s.setupCalls - BASE_STATS.setupCalls, nsCalls: s.nsCalls - BASE_STATS.nsCalls, reads: s.reads - BASE_STATS.reads } }

const c1 = new S(), c2 = new S(), adm = new S()
ok((await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')).status === 200, 'login cliente 1')
ok((await c2.login('cliente2@ensaio.test', 'Cliente#Dois2026')).status === 200, 'login cliente 2')
ok((await adm.login('admin@ensaio.test', 'Admin#Teste2026')).status === 200, 'login administrador')
const reg = body => adm.req('/api/admin/integrations/registrar', { method: 'POST', body })
const act = body => adm.req('/api/admin/orders', { method: 'POST', body })
const hst = (action, serviceId, extra = {}) => adm.req('/api/admin/registrar/hostinger', { method: 'POST', body: { action, serviceId, ...extra } })
const pv = async serviceId => (await adm.req(`/api/admin/registrar/hostinger?serviceId=${serviceId}`)).json?.preview
const regBefore = await one('SELECT * FROM registrar_settings WHERE id = 1')
const c2Before = await one('SELECT p.country, c.postal_code FROM profiles p LEFT JOIN clients c ON c.profile_id = p.id WHERE p.email = ?', ['cliente2@ensaio.test'])

/** Encomenda de domínio .com do cliente (opcionalmente renomeada depois, para cenários do fornecedor). */
async function order(s, label, { pay = true, rename } = {}) {
  const dn = `${label}-${rnd()}.com`
  const lines = [{ type: 'domain', domain: dn, operation: 'register', years: 1 }]
  const q = await s.req('/api/checkout/quote', { method: 'POST', body: { lines } })
  if (!q.json?.quote?.valid) return { error: JSON.stringify(q.json?.quote?.lines?.map(l => l.error)) }
  const r = await s.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines, acceptedTotal: q.json.quote.total, paymentMethod: 'bank_transfer' } })
  const o = r.json?.order
  if (!o) return { error: r.text }
  let domain = dn
  if (rename) {
    domain = `${rename}-${rnd()}.com`
    await db.query('UPDATE services SET domain = ?, service_name = ? WHERE order_id = ?', [domain, `Registo de domínio ${domain}`, o.id])
    await db.query('UPDATE order_items SET domain_name = ? WHERE order_id = ?', [domain, o.id])
    await db.query('UPDATE orders SET domain_name = ? WHERE id = ?', [domain, o.id])
    await db.query('UPDATE domains SET name = ? WHERE order_id = ?', [domain.replace(/\.com$/, ''), o.id])
  }
  if (pay) await act({ action: 'approve', orderId: o.id })
  const svc = await one("SELECT * FROM services WHERE order_id = ? AND service_type = 'domain'", [o.id])
  return { o, domain, svc }
}

BASE_STATS = await rawStats()
try {
  // ── 1. Configuração, token e «Testar ligação» ──
  console.log('\n1. Configuração e «Testar ligação» (só leitura)')
  let r = await reg({ action: 'save', provider: 'hostinger', mode: 'live', apiUrl: 'https://api.exemplo.invalid', secret: 'x', extensions: [] })
  ok(r.status === 400 && /developers\.hostinger\.com/.test(r.json?.error), 'produção: só a API oficial da Hostinger', r.text)
  const BAD = `token-errado-${rnd()}`
  r = await reg({ action: 'save', provider: 'hostinger', mode: 'test', apiUrl: SIM, secret: BAD, extensions: ['.com'] })
  ok(r.status === 200, 'guarda Hostinger (ensaio) com token', r.text)
  r = await reg({ action: 'test' })
  ok(r.json?.ok === false && /Token recusado/.test(r.json?.message), `token inválido → «${r.json?.message}»`)
  r = await adm.req('/api/admin/integrations/registrar')
  ok(r.json?.settings?.hasSecret === true && !r.text.includes(BAD), 'painel só mostra «configurado»; o token nunca volta ao navegador')
  ok(String((await one('SELECT secret_enc FROM registrar_settings WHERE id = 1')).secret_enc).startsWith('enc:'), 'token guardado cifrado na base')
  r = await reg({ action: 'save', provider: 'hostinger', mode: 'test', apiUrl: SIM, secret: TOKEN, extensions: ['.com'] })
  r = await reg({ action: 'test' })
  ok(r.json?.ok === true && /Token aceite/.test(r.json?.message) && /Visa \*\*\*\* 4242/.test(r.json?.message), `token válido → «${r.json?.message}»`)
  r = await reg({ action: 'save', provider: 'hostinger', mode: 'test', apiUrl: SIM, extensions: ['.com', '.ao'], enabled: true })
  ok(r.status === 400 && /\.ao/.test(r.json?.error), '.ao recusado: fica em registo manual', r.text)
  r = await reg({ action: 'save', provider: 'hostinger', mode: 'test', apiUrl: SIM, extensions: ['.com', '.co.ao'], enabled: true })
  ok(r.status === 400 && /\.co\.ao/.test(r.json?.error), '.co.ao recusado: fica em registo manual')
  r = await reg({ action: 'save', provider: 'hostinger', mode: 'test', apiUrl: SIM, extensions: ['.com'], enabled: true })
  ok(r.status === 200 && (await one('SELECT enabled FROM registrar_settings WHERE id = 1')).enabled == 1, 'integração activa para .com')
  let st = await stats()
  ok(st.purchaseCalls === 0 && st.setupCalls === 0 && st.nsCalls === 0, `«Testar ligação» só fez leituras (${st.reads} leituras, 0 compras)`)
  r = await reg({ action: 'save', provider: 'simulado', mode: 'test', apiUrl: 'http://127.0.0.1:12089', extensions: [] })
  ok(!(await one('SELECT secret_enc FROM registrar_settings WHERE id = 1')).secret_enc, 'mudar de fornecedor sem novo segredo apaga o token anterior')
  await reg({ action: 'save', provider: 'hostinger', mode: 'test', apiUrl: SIM, secret: TOKEN, extensions: ['.com'] })
  await reg({ action: 'test' })
  await reg({ action: 'save', provider: 'hostinger', mode: 'test', apiUrl: SIM, extensions: ['.com'], enabled: true })

  // ── 2. Pagamento por validar e aprovação sem compra automática ──
  console.log('\n2. Pagamento por validar; aprovação não compra')
  const unpaid = await order(c1, 'porpagar', { pay: false })
  let p = await pv(unpaid.svc.id)
  ok(p?.next === 'blocked' && p.blockers.some(b => /pagamento do cliente/.test(b)), 'pagamento por validar → bloqueado', JSON.stringify(p?.blockers))
  r = await hst('purchase', unpaid.svc.id, { confirmToken: 'x' })
  ok(r.json?.ok === false && (await stats()).purchaseCalls === 0, 'compra recusada antes de o pagamento estar validado (nenhum pedido à Hostinger)')
  await act({ action: 'approve', orderId: unpaid.o.id })
  const s1 = await one('SELECT provisioning_status, provisioning_error FROM services WHERE id = ?', [unpaid.svc.id])
  ok(s1.provisioning_status === 'manual_required' && /Registar na Hostinger/.test(s1.provisioning_error), `pago → aguarda autorização («${s1.provisioning_error}»)`)
  ok((await stats()).purchaseCalls === 0, 'aprovar o pagamento nunca compra automaticamente')

  // ── 3. Compra bem-sucedida com pré-visualização e duplo clique ──
  console.log('\n3. Compra autorizada, duplo clique, nameservers e DNS')
  p = await pv(unpaid.svc.id)
  ok(p?.next === 'purchase', `pré-visualização: ${p?.next}`, JSON.stringify(p?.blockers))
  ok(p?.cost?.amount === 9.99 && p.cost.currency === 'USD' && p.cost.itemId === 'hostingercom-domain-com-usd-1y', `custo confirmado no catálogo: ${p?.cost?.amount} ${p?.cost?.currency} (${p?.cost?.itemId})`)
  ok(p?.paymentMethod?.label === 'Visa **** 4242' && p.paymentMethod.id === 7001, 'método de pagamento predefinido da conta (só o rótulo)')
  ok(p?.owner?.email === 'cliente1@ensaio.test' && p.owner.city && p.nameservers.length >= 2, 'titular da encomenda e nameservers mostrados')
  r = await hst('purchase', unpaid.svc.id, { confirmToken: 'token-antigo' })
  ok(r.json?.outcome === 'changed' && (await stats()).purchaseCalls === 0, 'confirmação desactualizada → rever, nada comprado')
  const [a, b] = await Promise.all([hst('purchase', unpaid.svc.id, { confirmToken: p.confirmToken }), hst('purchase', unpaid.svc.id, { confirmToken: p.confirmToken })])
  st = await stats()
  ok(st.purchases[unpaid.domain] === 1 && st.purchaseCalls === 1, `duplo clique / pedidos concorrentes → uma só compra (${[a.status, b.status].join(', ')})`)
  let svc = await one('SELECT provisioning_status, activation_source, external_ref FROM services WHERE id = ?', [unpaid.svc.id])
  ok(svc.provisioning_status === 'active' && svc.activation_source === 'registrar', `«Registado» com confirmação da Hostinger (ref. ${svc.external_ref})`)
  let op = await one('SELECT * FROM registrar_operations WHERE service_id = ?', [unpaid.svc.id])
  ok(op.status === 'succeeded' && op.authorized_by && Number(op.cost_amount) === 9.99 && op.cost_currency === 'USD' && op.provider_order_id, 'operação guarda autorização, custo e referência do fornecedor')
  ok(op.ns_status === 'applied' && op.dns_status === 'pending', 'nameservers aplicados; DNS pendente até a delegação pública responder')
  ok(Number((await one("SELECT COUNT(*) n FROM registrar_operation_events WHERE operation_id = ? AND kind = 'purchase_request'", [op.id])).n) === 1, 'tentativa registada na auditoria')
  r = await hst('purchase', unpaid.svc.id, { confirmToken: p.confirmToken })
  ok(r.json?.ok === false && (await stats()).purchaseCalls === 1, 'repetir depois de registado → nada comprado')
  r = await hst('dns', unpaid.svc.id)
  ok(r.json?.outcome === 'pending', 'verificar DNS: pendente (domínio de ensaio sem delegação pública)')

  // ── 4. Domínio indisponível e extensão manual ──
  console.log('\n4. Indisponível e extensão manual')
  const taken = await order(c1, 'livre', { rename: 'ocupado' })
  p = await pv(taken.svc.id)
  ok(p?.next === 'blocked' && p.blockers.some(x => /já não está disponível/.test(x)), 'domínio indisponível → revisão manual, sem compra')
  const before = (await stats()).purchaseCalls
  r = await hst('purchase', taken.svc.id, { confirmToken: p?.confirmToken ?? 'x' })
  ok(r.json?.ok === false && (await stats()).purchaseCalls === before, 'compra recusada no servidor')
  const ao = `manual-${rnd()}.ao`
  let q = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'domain', domain: ao, operation: 'register', years: 1 }] } })
  const ro = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines: [{ type: 'domain', domain: ao, operation: 'register', years: 1 }], acceptedTotal: q.json.quote.total, paymentMethod: 'bank_transfer' } })
  const aoItem = await one('SELECT id FROM order_items WHERE order_id = ?', [ro.json.order.id])
  await act({ action: 'domain_availability', orderItemId: aoItem.id, available: true })
  await act({ action: 'approve', orderId: ro.json.order.id })
  const aoSvc = await one("SELECT id, provisioning_status, provisioning_error FROM services WHERE order_id = ? AND service_type = 'domain'", [ro.json.order.id])
  p = await pv(aoSvc.id)
  ok(aoSvc.provisioning_status === 'manual_required' && p?.next === 'blocked' && p.blockers.some(x => /manual/.test(x)), `.ao → registo manual («${p?.blockers?.[0]}»)`)

  // ── 5. HTTP 202 e conclusão do registo já pago ──
  console.log('\n5. HTTP 202 → pagamento pendente → concluir registo (sem nova compra)')
  const pay = await order(c1, 'livre', { rename: 'pagamento' })
  p = await pv(pay.svc.id)
  r = await hst('purchase', pay.svc.id, { confirmToken: p.confirmToken })
  ok(r.json?.outcome === 'payment_pending' && /202/.test(r.json?.message), `HTTP 202 → «${r.json?.message}»`)
  svc = await one('SELECT provisioning_status FROM services WHERE id = ?', [pay.svc.id])
  ok(svc.provisioning_status !== 'active', 'não fica «Registado» com o pagamento pendente')
  p = await pv(pay.svc.id)
  ok(p?.next === 'reconcile' && !p.confirmToken, 'com pagamento pendente só é possível consultar (sem nova compra)')
  r = await hst('reconcile', pay.svc.id)
  ok(r.json?.outcome === 'pending', 'consulta: pagamento ainda em processamento')
  await fetch(`${SIM}/_pay?domain=${pay.domain}`, { method: 'POST' })
  r = await hst('reconcile', pay.svc.id)
  ok(r.json?.outcome === 'awaiting_setup', 'pagamento concluído → pago, a aguardar configuração')
  const setupBefore = (await stats()).setupCalls
  r = await hst('setup', pay.svc.id)
  st = await stats()
  ok(r.json?.outcome === 'registered' && st.setupCalls === setupBefore + 1 && st.purchases[pay.domain] === 1, 'concluir registo usa /setup (sem nova compra) → registado')

  // ── 6. Encomenda antiga (referência: VH-ORD-202611-0002) ──
  console.log('\n6. Recuperação de encomenda antiga sem duplicar a compra')
  const old = await order(c1, 'livre', { rename: 'recupera' })
  await db.query('UPDATE orders SET created_at = created_at - INTERVAL 3 DAY WHERE id = ?', [old.o.id])
  const pBefore = (await stats()).purchaseCalls
  p = await pv(old.svc.id)
  ok(p?.next === 'setup' && !p.operation, `domínio já pago na conta Hostinger → «Concluir registo» (${p?.next})`)
  r = await hst('setup', old.svc.id)
  ok(r.json?.outcome === 'registered' && (await stats()).purchaseCalls === pBefore, 'encomenda antiga recuperada sem nova compra')
  const reg2 = await order(c1, 'livre', { rename: 'antigo' })
  p = await pv(reg2.svc.id)
  ok(p?.next === 'link', 'domínio já registado no hPanel → associar (sem compra)')
  r = await hst('link', reg2.svc.id)
  ok(r.json?.outcome === 'registered' && (await stats()).purchaseCalls === pBefore, 'associado à encomenda; nenhuma compra')

  // ── 7. Timeout e resposta ambígua ──
  console.log('\n7. Timeout')
  const slow = await order(c1, 'livre', { rename: 'lento' })
  p = await pv(slow.svc.id)
  r = await hst('purchase', slow.svc.id, { confirmToken: p.confirmToken })
  ok(r.json?.outcome === 'unknown', 'timeout → inconclusivo (não registado, não falhado)')
  p = await pv(slow.svc.id)
  r = await hst('purchase', slow.svc.id, { confirmToken: p.confirmToken ?? 'x' })
  ok(p?.next === 'reconcile' && r.json?.ok === false, 'nova compra impedida: é obrigatório consultar primeiro')
  await sleep(2500)
  r = await hst('reconcile', slow.svc.id)
  ok(r.json?.outcome === 'registered' && (await stats()).purchases[slow.domain] === 1, 'consulta encontra o domínio registado → associa, sem segunda compra')
  const lost = await order(c1, 'livre', { rename: 'perdido' })
  p = await pv(lost.svc.id)
  await hst('purchase', lost.svc.id, { confirmToken: p.confirmToken })
  r = await hst('reconcile', lost.svc.id)
  ok(r.json?.outcome === 'manual' && /Libertar nova tentativa/.test(r.json?.message), 'compra perdida → inconclusivo → revisão manual')
  r = await hst('release', lost.svc.id, { note: 'x' })
  ok(r.status === 400, 'libertar exige descrever a verificação no hPanel')
  r = await hst('release', lost.svc.id, { note: 'Sem encomenda nem domínio no hPanel' })
  p = await pv(lost.svc.id)
  ok(r.json?.outcome === 'released' && p?.next === 'purchase', 'após revisão no hPanel, nova tentativa permitida')

  // ── 8. Falha nos nameservers, verificação e recusa ──
  console.log('\n8. Nameservers, verificação do contacto e recusa')
  const nsf = await order(c1, 'livre', { rename: 'nsfalha' })
  p = await pv(nsf.svc.id)
  r = await hst('purchase', nsf.svc.id, { confirmToken: p.confirmToken })
  op = await one('SELECT * FROM registrar_operations WHERE service_id = ?', [nsf.svc.id])
  svc = await one('SELECT provisioning_status FROM services WHERE id = ?', [nsf.svc.id])
  ok(svc.provisioning_status === 'active' && op.ns_status === 'failed', 'registado; falha nos nameservers mostrada à parte (por aplicar)')
  r = await hst('nameservers', nsf.svc.id)
  ok(r.json?.outcome === 'failed' && (await stats()).purchases[nsf.domain] === 1, 'repetir nameservers não compra de novo')
  const ver = await order(c1, 'livre', { rename: 'verifica' })
  p = await pv(ver.svc.id)
  r = await hst('purchase', ver.svc.id, { confirmToken: p.confirmToken })
  ok(r.json?.outcome === 'verification' && /hPanel/.test(r.json?.message), `verificação do titular → «${r.json?.message}»`)
  const rej = await order(c1, 'livre', { rename: 'recusa' })
  p = await pv(rej.svc.id)
  r = await hst('purchase', rej.svc.id, { confirmToken: p.confirmToken })
  op = await one('SELECT status FROM registrar_operations WHERE service_id = ?', [rej.svc.id])
  ok(r.json?.outcome === 'failed' && op.status === 'failed', 'recusa (422) → falhado, nada comprado, pode repetir depois de corrigir')

  // ── 9. Dados do titular exigidos pela extensão ──
  console.log('\n9. Dados do titular em falta')
  await db.query("UPDATE profiles SET country = 'PT' WHERE email = 'cliente2@ensaio.test'")
  await db.query("UPDATE clients c JOIN profiles p ON p.id = c.profile_id SET c.postal_code = NULL WHERE p.email = 'cliente2@ensaio.test'")
  const zip = await order(c2, 'titular')
  p = await pv(zip.svc.id)
  const pc = (await stats()).purchaseCalls
  r = await hst('purchase', zip.svc.id, { confirmToken: p.confirmToken })
  ok(r.json?.outcome === 'needs_correction' && JSON.stringify(r.json?.errors).includes('zip') && (await stats()).purchaseCalls === pc, 'perfil WHOIS recusado (falta código postal) → corrigir antes de comprar')
  r = await hst('owner', zip.svc.id, { owner: { zip: '1000-001' } })
  p = await pv(zip.svc.id)
  r = await hst('purchase', zip.svc.id, { confirmToken: p.confirmToken })
  ok(r.json?.outcome === 'registered', 'dados corrigidos → registado')

  // ── 10. «Marcar como registado…» nunca cobra ──
  console.log('\n10. Marcação manual')
  const man = await order(c1, 'manual')
  const pc2 = (await stats()).purchaseCalls, sc2 = (await stats()).setupCalls
  r = await act({ action: 'mark_active', serviceId: man.svc.id, externalRef: 'HPANEL-12345', notes: 'registo manual' })
  svc = await one('SELECT provisioning_status, activation_source FROM services WHERE id = ?', [man.svc.id])
  st = await stats()
  ok(r.status === 200 && svc.provisioning_status === 'active' && svc.activation_source === 'manual' && st.purchaseCalls === pc2 && st.setupCalls === sc2, '«Marcar como registado…» activa sem chamar a Hostinger')

  // ── 11. Sem fugas do token ──
  if (process.env.APP_LOG) {
    const log = readFileSync(process.env.APP_LOG, 'utf8')
    ok(!log.includes(TOKEN) && !log.includes(BAD), 'token ausente dos registos da aplicação')
  }

  // ── 12. Navegador: diálogo «Registar na Hostinger» (desktop + telemóvel) ──
  console.log('\n12. Painel no navegador')
  const { chromium, devices } = createRequire(import.meta.url)('playwright')
  const br = await chromium.launch()
  for (const [label, opts] of [['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['telemovel', devices['iPhone 13']]]) {
    const ui = await order(c1, `painel${label === 'desktop' ? 'd' : 'm'}`)
    const ctx = await br.newContext(opts); const pg = await ctx.newPage()
    const errors = []; pg.on('pageerror', e => errors.push(e.message))
    await pg.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
    await pg.goto(`${BASE}/admin/orders?filtro=activacao&encomenda=${ui.o.order_number}`, { waitUntil: 'domcontentloaded' })
    const row = pg.locator(`[id="order-${ui.o.order_number}"]`)
    await row.getByTestId('hostinger-open').click()
    await pg.getByTestId('hostinger-confirm').waitFor()
    const txt = await pg.getByTestId('hostinger-dialog').innerText()
    ok(/9,99 USD/.test(txt) && /Visa \*\*\*\* 4242/.test(txt) && /debitar o método de pagamento predefinido/.test(txt) && txt.includes(ui.domain), `${label}: diálogo mostra domínio, custo, moeda, método e aviso de cobrança`)
    ok(await pg.getByTestId('hostinger-confirm').isDisabled(), `${label}: «Confirmar» exige marcar a confirmação`)
    await pg.screenshot({ path: `${OUT}/${label}-01-registar-hostinger.png`, fullPage: false })
    await pg.getByTestId('hostinger-accept').check()
    await pg.getByTestId('hostinger-confirm').dblclick()
    await pg.getByTestId('hostinger-result').waitFor()
    await pg.getByTestId('hostinger-dns-status').waitFor()
    ok((await stats()).purchases[ui.domain] === 1, `${label}: duplo clique no navegador → uma compra`)
    ok(/DNS pendente/.test(await pg.getByTestId('hostinger-dns-status').innerText()), `${label}: «DNS pendente» mostrado à parte`)
    await pg.screenshot({ path: `${OUT}/${label}-02-registado-dns-pendente.png`, fullPage: false })
    ok(errors.length === 0, `${label}: sem erros JavaScript`, errors.join(' | '))
    await ctx.close()
  }
  // integrações
  {
    const ctx = await br.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage()
    await pg.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
    await pg.goto(`${BASE}/admin/settings/integrations/registrar`, { waitUntil: 'domcontentloaded' })
    await pg.getByTestId('registrar-authorize-note').waitFor()
    ok(await pg.getByTestId('registrar-ext-.ao').isDisabled() && await pg.getByTestId('registrar-ext-.co.ao').isDisabled(), 'integrações: .ao e .co.ao desactivadas (manual)')
    ok(!(await pg.content()).includes(TOKEN), 'integrações: token nunca presente na página')
    await pg.screenshot({ path: `${OUT}/desktop-03-integracao-hostinger.png`, fullPage: true })
    await ctx.close()
  }
  await br.close()
} finally {
  // Repor configuração e o cliente 2
  if (regBefore) await db.query('UPDATE registrar_settings SET provider = ?, mode = ?, enabled = ?, api_url = ?, username = ?, secret_enc = ?, extensions = ?, last_test_ok = ?, last_test_at = ?, last_test_message = ? WHERE id = 1',
    [regBefore.provider, regBefore.mode, regBefore.enabled, regBefore.api_url, regBefore.username, regBefore.secret_enc, typeof regBefore.extensions === 'string' ? regBefore.extensions : JSON.stringify(regBefore.extensions ?? []), regBefore.last_test_ok, regBefore.last_test_at, regBefore.last_test_message])
  else await db.query("UPDATE registrar_settings SET provider = 'none', enabled = 0, secret_enc = NULL, extensions = '[]' WHERE id = 1")
  if (c2Before) {
    await db.query("UPDATE profiles SET country = ? WHERE email = 'cliente2@ensaio.test'", [c2Before.country])
    await db.query("UPDATE clients c JOIN profiles p ON p.id = c.profile_id SET c.postal_code = ? WHERE p.email = 'cliente2@ensaio.test'", [c2Before.postal_code])
  }
  await db.end()
}
console.log(`\n${pass} OK, ${fail} falhadas`)
process.exit(fail ? 1 : 0)
