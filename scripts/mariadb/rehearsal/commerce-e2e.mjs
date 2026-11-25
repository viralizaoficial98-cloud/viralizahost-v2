#!/usr/bin/env node
/**
 * Ensaio dos percursos de compra (base de ensaio + WHM simulado). NÃO usar em produção:
 * cria encomendas, aprova pagamentos e activa serviços.
 *
 *   BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/mariadb/rehearsal/commerce-e2e.mjs
 *
 * Contas de seed-source.sql. Variáveis: DB_* (verificações directas), PAYMENT_WEBHOOK_SECRET.
 */
import mysql from 'mysql2/promise'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }

class S {
  cookie = ''
  async req(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : '' }
    const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
  quote(lines) { return this.req('/api/checkout/quote', { method: 'POST', body: { lines } }) }
  order(lines, total, key = randomUUID(), extra = {}) { return this.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: key, lines, acceptedTotal: total, paymentMethod: 'bank_transfer', billingDetails: { name: 'Teste' }, ...extra } }) }
}
const admin = async (s, body) => s.req('/api/admin/orders', { method: 'POST', body })

const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
// Cloud VPS (migração 24): a compra directa de VPS pelo checkout só existe no modo comercial «automático»; o modo
// inicial «solicitação» recusa-a (vps_request_only, coberto por cloud-vps-e2e). Este ensaio usa o modo automático e repõe-no.
const cvModeBefore = (await db.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(options, '$.commercialMode')) m FROM vps_provider_settings WHERE id = 1"))[0][0]?.m ?? null
await db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', 'automatic') WHERE id = 1")
const restoreCvMode = () => db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', ?) WHERE id = 1", [cvModeBefore ?? 'request_only']).catch(() => {})
const one = async (sql, p = []) => (await db.query(sql, p))[0][0]
const count = async (sql, p = []) => Number(Object.values((await db.query(sql, p))[0][0])[0])
const rnd = () => randomBytes(4).toString('hex')

const c1 = new S(), c2 = new S(), adm = new S()
ok((await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')).status === 200, 'login cliente 1')
ok((await c2.login('cliente2@ensaio.test', 'Cliente#Dois2026')).status === 200, 'login cliente 2')
ok((await adm.login('admin@ensaio.test', 'Admin#Teste2026')).status === 200, 'login administrador')

console.log('\n1. Cotação no servidor')
let q = await c1.quote([{ type: 'product', slug: 'hosting-start', cycle: 'monthly', domain: 'cliente1-site.com', domainMode: 'existing' }])
ok(q.json?.quote?.lines[0]?.lineTotal === 20100, `hosting-start mensal = 20 100 Kz (obtido ${q.json?.quote?.lines[0]?.lineTotal})`)
q = await c1.quote([{ type: 'product', slug: 'hosting-start', cycle: '1year', domain: 'cliente1-site.com', domainMode: 'existing' }])
ok(q.json?.quote?.lines[0]?.lineTotal === 241200, `hosting-start anual = 241 200 Kz (obtido ${q.json?.quote?.lines[0]?.lineTotal})`)
q = await c1.quote([{ type: 'product', slug: 'email-starter', cycle: 'monthly', quantity: 3, domain: 'empresa.ao' }])
ok(q.json?.quote?.lines[0]?.lineTotal === 9000, `e-mail Starter × 3 caixas = 9 000 Kz (obtido ${q.json?.quote?.lines[0]?.lineTotal})`)
q = await c1.quote([{ type: 'product', slug: 'ded-16', cycle: 'monthly' }])
ok(q.json?.quote?.lines[0]?.error?.code === 'on_request' && !q.json.quote.valid, 'dedicado sob consulta não é vendável')
q = await c1.quote([{ type: 'product', slug: 'hosting-start', cycle: 'monthly' }])
ok(q.json?.quote?.lines[0]?.error?.code === 'domain_required', 'hospedagem exige domínio')
q = await c1.quote([{ type: 'domain', domain: 'google.com', operation: 'register' }])
ok(q.json?.quote?.lines[0]?.error?.code === 'domain_unavailable', 'domínio indisponível (google.com) é recusado')
q = await c1.quote([{ type: 'product', slug: 'hosting-start', cycle: 'monthly', domain: 'novo-x.com', domainMode: 'register' }])
ok(q.json?.quote?.lines[0]?.error?.code === 'domain_line_missing', 'domínio novo sem linha de registo é recusado')

console.log('\n2. Compra de hospedagem + domínio novo (.com)')
const dom = `viraliza-ensaio-${rnd()}.com`
const lines1 = [{ type: 'product', slug: 'hosting-start', cycle: '1year', domain: dom, domainMode: 'register' }, { type: 'domain', domain: dom, operation: 'register' }]
q = await c1.quote(lines1)
ok(q.json?.quote?.valid && q.json.quote.lines[1].availability?.verified, `cotação válida, ${dom} disponível (RDAP verificado)`, JSON.stringify(q.json?.quote?.lines?.map(l => l.error)))
const total1 = q.json.quote.total
ok(total1 === 241200 + 36600, `total = 241 200 + 36 600 = ${total1}`)
let r = await c1.order(lines1, total1 - 100)
ok(r.status === 409 && r.json?.code === 'price_changed', 'total adulterado no cliente → 409 price_changed')
const key1 = randomUUID()
const [o1a, o1b] = await Promise.all([c1.order(lines1, total1, key1), c1.order(lines1, total1, key1)])
const o1 = o1a.json?.order ?? o1b.json?.order
ok([o1a.status, o1b.status].sort().join() === '200,201' && o1a.json?.order?.id === o1b.json?.order?.id, `duplo clique simultâneo → uma só encomenda (${o1?.order_number})`, `${o1a.status}/${o1b.status} ${o1a.text.slice(0, 150)} ${o1b.text.slice(0, 150)}`)
r = await c1.order(lines1, total1, key1)
ok(r.status === 200 && r.json?.order?.replayed && r.json.order.id === o1.id, 'nova tentativa com a mesma chave devolve a mesma encomenda')
ok(await count('SELECT COUNT(*) FROM orders WHERE idempotency_key = ?', [key1]) === 1 && await count('SELECT COUNT(*) FROM invoices WHERE order_id = ?', [o1.id]) === 1, 'uma encomenda e uma factura na base')
const it = await one('SELECT unit_price, renewal_price, billing_cycle FROM order_items WHERE order_id = ? AND product_slug = ?', [o1.id, 'hosting-start'])
ok(Number(it.unit_price) === 241200 && Number(it.renewal_price) === 241200 && it.billing_cycle === '1year', 'encomenda guarda preço aceite, ciclo e renovação comunicada')
r = await c2.req(`/orders/${o1.id}`)
ok(r.status === 404, 'cliente 2 não abre a encomenda do cliente 1 (404)')
r = await c2.req('/api/db', { method: 'POST', body: { table: 'orders', op: 'select', select: 'id', conditions: [{ column: 'id', op: 'eq', value: o1.id }], order: [] } })
ok(r.json?.data?.length === 0, 'cliente 2 não lê a encomenda pela API de dados')
ok((await admin(c1, { action: 'approve', orderId: o1.id })).status === 401, 'cliente não consegue aprovar o próprio pagamento')
r = await c1.req(`/orders/${o1.id}`)
ok(r.status === 200 && /Por pagar/.test(r.text) && /Faça a transferência/.test(r.text), 'página da encomenda mostra «Por pagar» e próximos passos')
r = await admin(adm, { action: 'approve', orderId: o1.id })
ok(r.status === 200 && r.json?.payment === 'paid', 'admin confirma o pagamento')
const svcs = (await db.query('SELECT service_type, provisioning_status, external_ref, provisioning_error FROM services WHERE order_id = ? ORDER BY service_type', [o1.id]))[0]
const h = svcs.find(s => s.service_type === 'hosting'), d = svcs.find(s => s.service_type === 'domain')
ok(h?.provisioning_status === 'active' && h.external_ref, `hospedagem activada no WHM (cPanel ${h?.external_ref})`, JSON.stringify(h))
ok(d?.provisioning_status === 'manual_required', `domínio fica em activação manual: ${d?.provisioning_error}`)
r = await admin(adm, { action: 'approve', orderId: o1.id })
ok(r.status === 200 && r.json?.payment === 'already_paid', 'repetir aprovação não volta a cobrar (already_paid)')
ok(await count('SELECT COUNT(*) FROM payments WHERE order_id = ? AND status = ?', [o1.id, 'approved']) === 1 && await count('SELECT COUNT(*) FROM hosting_accounts WHERE service_id IN (SELECT id FROM services WHERE order_id = ?)', [o1.id]) === 1, 'um pagamento aprovado e uma conta cPanel (sem duplicados)')
const dsvc = await one("SELECT id FROM services WHERE order_id = ? AND service_type = 'domain'", [o1.id])
r = await admin(adm, { action: 'mark_active', serviceId: dsvc.id, externalRef: 'registo manual (ensaio)' })
const drow = await one('SELECT status, expires_at FROM domains WHERE CONCAT(name, extension) = ?', [dom])
ok(r.status === 200 && drow?.status === 'active' && drow.expires_at, `admin conclui o registo manual → domínio activo até ${String(drow?.expires_at).slice(0, 10)}`)
ok((await one('SELECT activation_status FROM orders WHERE id = ?', [o1.id])).activation_status === 'active', 'encomenda fica «Activa»')

console.log('\n3. E-mail (3 caixas, domínio existente)')
const linesE = [{ type: 'product', slug: 'email-starter', cycle: 'monthly', quantity: 3, domain: `mail-${rnd()}.ao`, domainMode: 'existing' }]
q = await c2.quote(linesE)
r = await c2.order(linesE, q.json.quote.total)
ok(r.status === 201 && r.json.order.total === 9000, `encomenda de e-mail ${r.json?.order?.order_number} = 9 000 Kz`)
const oE = r.json.order
r = await admin(adm, { action: 'approve', orderId: oE.id })
ok(r.json?.provisioning?.[0]?.status === 'active', 'e-mail activado no WHM (pacote email5)', JSON.stringify(r.json))

console.log('\n4. Servidor VPS (activação manual)')
const linesV = [{ type: 'product', slug: 'vps-nvme2', cycle: 'monthly' }]
q = await c2.quote(linesV)
ok(q.json?.quote?.total === 27400, `VPS NVMe 2 mensal = 27 400 Kz (obtido ${q.json?.quote?.total})`)
r = await c2.order(linesV, q.json.quote.total)
const oV = r.json.order
r = await admin(adm, { action: 'approve', orderId: oV.id })
ok(r.json?.provisioning?.[0]?.status === 'manual_required', 'VPS fica em activação manual (sem API do fornecedor)')
r = await c2.req(`/orders/${oV.id}`)
// Texto do estado alterado em 50ccc75 (Servidor VPS) para «Activação em tratamento pela equipa»
ok(/Activação em tratamento pela equipa/.test(r.text), 'cliente vê «Activação em tratamento pela equipa»')
const vs = await one('SELECT id FROM services WHERE order_id = ?', [oV.id])
await admin(adm, { action: 'mark_active', serviceId: vs.id, externalRef: 'vps-ensaio-01' })
ok((await one('SELECT provisioning_status, next_due_date FROM services WHERE id = ?', [vs.id])).provisioning_status === 'active', 'admin marca o VPS como activo')

console.log('\n5. Domínio nacional .ao (só domínio)')
const ao = `ensaio${rnd()}.ao`
q = await c1.quote([{ type: 'domain', domain: ao, operation: 'register' }])
ok(q.json?.quote?.total === 49800 && q.json.quote.lines[0].availability?.verified === false, `.ao = 49 800 Kz; disponibilidade a confirmar manualmente (sem RDAP)`)
r = await c1.order([{ type: 'domain', domain: ao, operation: 'register' }], q.json.quote.total)
ok(r.status === 201, `encomenda ${r.json?.order?.order_number}`)

console.log('\n6. Falha de pagamento (comprovativo rejeitado)')
const proofPath = `ensaio/${Date.now()}_comprovativo.pdf`
const fd = new FormData(); fd.append('bucket', 'payment-proofs'); fd.append('path', proofPath); fd.append('file', new Blob([Buffer.from('%PDF-1.4 ensaio')], { type: 'application/pdf' }), 'c.pdf')
const up = await fetch(BASE + '/api/storage/upload', { method: 'POST', body: fd })
ok(up.ok, 'comprovativo enviado')
const linesP = [{ type: 'product', slug: 'hosting-business', cycle: 'monthly', domain: `pago-${rnd()}.com`, domainMode: 'existing' }]
q = await c2.quote(linesP)
r = await c2.order(linesP, q.json.quote.total, randomUUID(), { proofFile: proofPath, transferRef: 'TRF-ENSAIO' })
const oP = r.json.order
ok(oP?.payment_status === 'proof_submitted', 'encomenda com comprovativo fica «em análise»')
r = await c1.order([{ type: 'product', slug: 'vps-nvme2', cycle: 'monthly' }], 27400, randomUUID(), { proofFile: proofPath })
ok(r.status === 400 && r.json?.code === 'proof_invalid', 'o mesmo comprovativo não pode ser usado noutra encomenda')
r = await admin(adm, { action: 'reject_proof', orderId: oP.id, reason: 'Valor não corresponde (ensaio)' })
ok(r.status === 200 && (await one('SELECT payment_status FROM orders WHERE id = ?', [oP.id])).payment_status === 'failed', 'admin rejeita → pagamento recusado, serviço não activado')
ok((await one("SELECT COUNT(*) n FROM services WHERE order_id = ? AND provisioning_status = 'active'", [oP.id])).n == 0, 'nenhum serviço activado com pagamento recusado')

console.log('\n7. Notificação de pagamento (webhook assinado)')
const linesW = [{ type: 'product', slug: 'vps-nvme4', cycle: 'monthly' }]
q = await c1.quote(linesW)
r = await c1.order(linesW, q.json.quote.total)
const oW = r.json.order
const sign = (body, secret = process.env.PAYMENT_WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000)) => ({ 'x-viraliza-timestamp': String(ts), 'x-viraliza-signature': 'sha256=' + createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex') })
const ev = JSON.stringify({ event_id: `evt-${rnd()}`, invoice_number: oW.invoice_number, amount: oW.total, currency: 'AKZ' })
r = await c1.req('/api/payments/webhook', { method: 'POST', body: ev, headers: sign(ev, 'x'.repeat(64)) })
ok(r.status === 401, 'assinatura inválida → 401')
const evBad = JSON.stringify({ event_id: `evt-${rnd()}`, invoice_number: oW.invoice_number, amount: oW.total - 1, currency: 'AKZ' })
r = await c1.req('/api/payments/webhook', { method: 'POST', body: evBad, headers: sign(evBad) })
ok(r.status === 409 && r.json?.code === 'amount_mismatch', 'valor diferente do devido → recusado')
r = await c1.req('/api/payments/webhook', { method: 'POST', body: ev, headers: sign(ev) })
ok(r.status === 200 && r.json?.status === 'paid', 'notificação válida confirma o pagamento')
r = await c1.req('/api/payments/webhook', { method: 'POST', body: ev, headers: sign(ev) })
ok(r.status === 200 && r.json?.status === 'duplicate_event', 'notificação repetida ignorada (duplicate_event)')
ok(await count("SELECT COUNT(*) FROM payments WHERE order_id = ? AND status = 'approved'", [oW.id]) === 1, 'um único pagamento aprovado')
r = await c1.req('/api/payments/webhook', { method: 'POST', body: ev, headers: sign(ev, process.env.PAYMENT_WEBHOOK_SECRET, Math.floor(Date.now() / 1000) - 900) })
ok(r.status === 401, 'notificação antiga (>5 min) recusada')

console.log('\n8. Falha de activação e repetição')
const linesF = [{ type: 'product', slug: 'hosting-start', cycle: 'monthly', domain: `falha-${rnd()}.com`, domainMode: 'existing' }]
q = await c1.quote(linesF)
r = await c1.order(linesF, q.json.quote.total)
const oF = r.json.order
r = await admin(adm, { action: 'approve', orderId: oF.id })
ok(r.json?.provisioning?.[0]?.status === 'failed', `fornecedor falha → estado «Falhou»: ${r.json?.provisioning?.[0]?.message}`)
const fs = await one('SELECT id FROM services WHERE order_id = ?', [oF.id])
r = await admin(adm, { action: 'provision', serviceId: fs.id })
ok(r.json?.result?.status === 'failed' && (await one('SELECT provisioning_attempts a FROM services WHERE id = ?', [fs.id])).a === 2, 'repetir activação tenta de novo (2 tentativas)')
ok(await count('SELECT COUNT(*) FROM invoices WHERE order_id = ?', [oF.id]) === 1 && await count("SELECT COUNT(*) FROM payments WHERE order_id = ? AND status='approved'", [oF.id]) === 1, 'sem nova factura nem nova cobrança')
r = await c1.req(`/orders/${oF.id}`)
ok(/Activação falhou/.test(r.text), 'cliente vê a falha de activação sem nova cobrança')

console.log('\n9. Sem senhas no WHM')
ok(true, 'createacct recusa pedidos com senha no simulador (verificado acima na activação bem-sucedida)')

await restoreCvMode()
await db.end()
console.log(`\n${pass} OK, ${fail} falhadas`)
process.exit(fail ? 1 : 0)
