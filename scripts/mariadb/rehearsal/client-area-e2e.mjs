#!/usr/bin/env node
/**
 * Ensaio da Área do Cliente, renovações e catálogo no painel (base de ensaio + WHM simulado).
 * NÃO usar em produção. Corre depois de commerce-e2e.mjs (usa serviços activos criados por ele).
 *
 *   BASE_URL=http://localhost:3000 node --env-file=.env.local scripts/mariadb/rehearsal/client-area-e2e.mjs
 */
import mysql from 'mysql2/promise'
import { randomBytes, randomUUID } from 'node:crypto'

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : '' }
    const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, location: res.headers.get('location') }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
  quote(lines) { return this.req('/api/checkout/quote', { method: 'POST', body: { lines } }) }
  order(lines, total, key = randomUUID()) { return this.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: key, lines, acceptedTotal: total, paymentMethod: 'bank_transfer', billingDetails: { name: 'Teste' } } }) }
}
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
const one = async (sql, p = []) => (await db.query(sql, p))[0][0]
const count = async (sql, p = []) => Number(Object.values((await db.query(sql, p))[0][0])[0])
const rnd = () => randomBytes(4).toString('hex')

const c1 = new S(), c2 = new S(), adm = new S()
await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')
await c2.login('cliente2@ensaio.test', 'Cliente#Dois2026')
await adm.login('admin@ensaio.test', 'Admin#Teste2026')
const p1 = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id

console.log('\n1. Área do Cliente — Serviços')
let r = await c1.req('/services')
ok(r.status === 200 && r.text.includes('data-testid="service-card"'), 'página Serviços lista os serviços do cliente')
const svc = await one(`SELECT s.id, s.next_due_date, s.renewal_price, s.domain, oi.months FROM services s JOIN products p ON p.id = s.product_id LEFT JOIN order_items oi ON oi.id = s.order_item_id
  WHERE s.profile_id = ? AND s.provisioning_status = 'active' AND p.provisioning = 'whm' AND s.renews_service_id IS NULL AND s.service_type = 'hosting' ORDER BY s.created_at LIMIT 1`, [p1])
ok(!!svc, 'cliente 1 tem um alojamento activo (de commerce-e2e)')
ok(r.text.includes(svc.domain), 'domínio do serviço visível')
ok(r.text.includes('Entrar no cPanel') || r.text.includes('cPanel'), 'acção cPanel disponível no alojamento activo')
r = await c2.req('/services')
ok(r.status === 200 && !r.text.includes(svc.domain), 'cliente 2 não vê os serviços do cliente 1')
r = await c2.req(`/api/client/hosting/${svc.id}/cpanel-sso`, { method: 'POST' })
ok(r.status === 404, 'SSO cPanel de serviço alheio → 404')
r = await c1.req(`/api/client/hosting/${svc.id}/cpanel-sso`, { method: 'POST' })
ok(r.status === 200 && r.json?.redirectUrl?.includes('cpsess'), 'SSO cPanel do próprio serviço devolve ligação temporária')
r = await c1.req(`/api/client/hosting/${svc.id}/webmail-sso`, { method: 'POST' })
ok(r.status === 200 && !!r.json?.redirectUrl, 'SSO Webmail do próprio serviço')
if (process.env.APP_LOG) {
  const log = (await import('node:fs')).readFileSync(process.env.APP_LOG, 'utf8')
  ok(!/cpsess|session=ensaio/.test(log), 'ligação temporária do cPanel não aparece nos logs da aplicação')
}
r = await new S().req('/services')
ok(r.status === 307 || r.status === 302 || r.location?.includes('/login'), 'sem sessão → redireccionado para login')

console.log('\n2. Renovação de alojamento (WHM)')
r = await c2.quote([{ type: 'renewal', serviceId: svc.id }])
ok(r.json?.quote?.lines?.[0]?.error?.code === 'service_not_owned', 'cliente 2 não pode renovar serviço do cliente 1')
r = await c1.quote([{ type: 'renewal', serviceId: svc.id }])
const rl = r.json?.quote?.lines?.[0]
ok(rl && !rl.error && rl.lineTotal === Number(svc.renewal_price), `preço = renovação comunicada na compra (${rl?.lineTotal} = ${svc.renewal_price})`, JSON.stringify(rl?.error))
const servicesBefore = await count('SELECT COUNT(*) FROM services WHERE profile_id = ? AND renews_service_id IS NULL', [p1])
r = await c1.order([{ type: 'renewal', serviceId: svc.id }], rl.lineTotal)
const ro = r.json?.order
ok(r.status < 300 && ro?.invoice_number, `encomenda de renovação ${ro?.order_number} com factura ${ro?.invoice_number}`, r.text)
ok(await count('SELECT COUNT(*) FROM services WHERE profile_id = ? AND renews_service_id IS NULL', [p1]) === servicesBefore, 'renovar não cria um serviço novo')
r = await c1.quote([{ type: 'renewal', serviceId: svc.id }])
ok(r.json?.quote?.lines?.[0]?.error?.code === 'renewal_pending', 'segunda renovação bloqueada enquanto a primeira está por pagar')
r = await c1.req('/services')
ok(r.text.includes('Renovação por pagar'), 'Área do Cliente mostra «Renovação por pagar»')
r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: ro.id } })
ok(r.status === 200, 'admin confirma o pagamento da renovação', r.text)
const after = await one('SELECT next_due_date FROM services WHERE id = ?', [svc.id])
const exp = new Date(Math.max(Date.parse(svc.next_due_date ?? 0), Date.parse(new Date().toISOString().slice(0, 10))))
exp.setUTCMonth(exp.getUTCMonth() + Number(svc.months ?? 1))
ok(after.next_due_date === exp.toISOString().slice(0, 10), `vencimento prolongado ${svc.next_due_date} → ${after.next_due_date}`, exp.toISOString().slice(0, 10))
r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: ro.id } })
ok((await one('SELECT next_due_date FROM services WHERE id = ?', [svc.id])).next_due_date === after.next_due_date, 'aprovar de novo não prolonga duas vezes')
ok(await count("SELECT COUNT(*) FROM payments WHERE order_id = ? AND status = 'approved'", [ro.id]) === 1, 'um único pagamento')
r = await c1.req('/services')
ok(r.text.includes(ro.order_number), 'histórico do serviço mostra a renovação')

console.log('\n3. Renovação de serviço manual (VPS)')
const vps = await one(`SELECT s.id, s.next_due_date, s.renewal_price, oi.months, pr.email FROM services s JOIN products p ON p.id = s.product_id JOIN profiles pr ON pr.id = s.profile_id
  LEFT JOIN order_items oi ON oi.id = s.order_item_id
  WHERE pr.email IN ('cliente1@ensaio.test','cliente2@ensaio.test') AND s.provisioning_status = 'active' AND p.provisioning = 'manual' AND s.service_type = 'vps' AND s.renews_service_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM services r JOIN orders o ON o.id = r.order_id WHERE r.renews_service_id = s.id AND o.payment_status <> 'paid') LIMIT 1`)
if (vps) {
  const owner = vps.email === 'cliente1@ensaio.test' ? c1 : c2
  r = await owner.quote([{ type: 'renewal', serviceId: vps.id }])
  r = await owner.order([{ type: 'renewal', serviceId: vps.id }], r.json.quote.total)
  const vo = r.json.order
  r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: vo.id } })
  ok(r.json?.provisioning?.[0]?.status === 'manual_required', 'renovação de VPS paga fica para confirmação manual no fornecedor')
  ok((await one('SELECT next_due_date FROM services WHERE id = ?', [vps.id])).next_due_date === vps.next_due_date, 'vencimento só muda quando a equipa confirma')
  const rs = await one('SELECT id FROM services WHERE renews_service_id = ? AND order_id = ?', [vps.id, vo.id])
  await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'mark_active', serviceId: rs.id } })
  const v1 = (await one('SELECT next_due_date FROM services WHERE id = ?', [vps.id])).next_due_date
  await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'mark_active', serviceId: rs.id } })
  const v2 = (await one('SELECT next_due_date FROM services WHERE id = ?', [vps.id])).next_due_date
  ok(v1 !== vps.next_due_date && v1 === v2, `equipa confirma → vencimento prolongado uma única vez (${vps.next_due_date} → ${v1})`)
} else ok(false, 'sem VPS activo de commerce-e2e')

console.log('\n4. Renovação de domínio')
const dom = await one("SELECT CONCAT(name, extension) d FROM domains WHERE profile_id = ? AND status = 'active' LIMIT 1", [p1])
if (dom) {
  r = await c1.quote([{ type: 'domain', domain: dom.d, operation: 'renew' }])
  ok(!r.json.quote.lines[0].error && r.json.quote.lines[0].lineTotal > 0, `renovação de ${dom.d}: ${r.json.quote.lines[0].lineTotal} Kz`)
  r = await c2.quote([{ type: 'domain', domain: dom.d, operation: 'renew' }])
  ok(r.json.quote.lines[0].error?.code === 'domain_not_owned', 'cliente 2 não renova domínio do cliente 1')
} else ok(false, 'sem domínio activo')

console.log('\n5. Catálogo no painel')
r = await c1.req('/api/admin/catalog')
ok(r.status === 403 || r.status === 401, 'cliente não acede ao catálogo do painel')
r = await adm.req('/api/admin/catalog')
const cat = r.json
ok(r.status === 200 && cat.products.length > 10 && cat.domains.length > 10, `admin vê ${cat?.products?.length} produtos e ${cat?.domains?.length} preços de domínio`)
const ws = cat.products.find(p => p.slug === 'webmail-start' || p.sale_status === 'draft')
ok(!!ws && (await new S().req('/api/products?category=' + ws.category)).json.data.every(p => p.sale_status !== 'draft'), 'rascunhos não aparecem no site')
const hs = cat.products.find(p => p.slug === 'hosting-business')
const m = hs.prices.find(x => x.cycle === 'monthly')
r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: hs.id, prices: [{ cycle: 'monthly', price: m.price + 100, renewal_price: m.renewal_price + 100, active: true }] } })
ok(r.status === 200, 'admin altera o preço mensal')
r = await c1.quote([{ type: 'product', slug: 'hosting-business', cycle: 'monthly', domain: `x${rnd()}.com`, domainMode: 'existing' }])
ok(r.json.quote.lines[0].lineTotal === m.price + 100, 'checkout usa o novo preço imediatamente')
const pub = (await new S().req('/api/products?category=hosting')).json.data.find(p => p.slug === 'hosting-business')
ok(pub.price_monthly === m.price + 100, 'site mostra o novo preço')
await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: hs.id, prices: [{ cycle: 'monthly', price: m.price, renewal_price: m.renewal_price, active: true }] } })
r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: hs.id, prices: [{ cycle: 'monthly', price: -5, renewal_price: 1, active: true }] } })
ok(r.status === 400, 'preço negativo recusado')
const dr = cat.products.find(p => p.sale_status === 'draft')
r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: dr.id, sale_status: 'active' } })
ok(r.status === 400 || dr.prices.some(x => x.active), 'não pode pôr à venda sem preço', r.text)
r = await c1.quote([{ type: 'product', slug: 'ded-16', cycle: 'monthly' }])
ok(r.json.quote.lines[0].error?.code === 'on_request', 'plano sob consulta não entra no carrinho')

console.log('\n6. Integrações')
r = await adm.req('/admin/settings/integrations')
ok(r.status === 200 && r.text.includes('Registrador de domínios') && !r.text.includes(process.env.PAYMENT_WEBHOOK_SECRET) && !r.text.includes(process.env.WHM_ENCRYPTION_KEY), 'painel de integrações mostra estado sem revelar segredos')
r = await c1.req('/admin/settings/integrations')
ok(r.status !== 200 || !r.text.includes('Registrador de domínios'), 'cliente não vê o painel de integrações')

await db.end()
console.log(`\n${pass} OK, ${fail} falhadas`)
process.exit(fail ? 1 : 0)
