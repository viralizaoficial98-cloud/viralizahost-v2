#!/usr/bin/env node
/**
 * API HOSTINGER SIMULADA para ensaio (nunca usar em produção). Nada é comprado nem cobrado.
 * Reproduz os caminhos e campos documentados no SDK oficial (github.com/hostinger/api-python-sdk):
 *   GET  /api/domains/v1/portfolio                 POST /api/domains/v1/portfolio (compra)
 *   GET  /api/domains/v1/portfolio/{d}             POST /api/domains/v1/portfolio/{d}/setup
 *   PUT  /api/domains/v1/portfolio/{d}/nameservers POST /api/domains/v1/availability
 *   GET|POST /api/domains/v1/whois                 GET  /api/billing/v1/catalog?name=.COM*
 *   GET  /api/billing/v1/payment-methods
 *
 *   MOCK_HOSTINGER_TOKEN=... node scripts/mariadb/rehearsal/mock-hostinger.mjs [--port=12091] [--delay=4000]
 *
 * Cenários pelo nome do domínio:
 *   ocupado*  indisponível            premium*  disponível mas premium
 *   pagamento* compra → HTTP 202 (pagamento em processamento); POST /_pay?domain=… conclui o pagamento:
 *              o domínio passa a estar na conta «a aguardar configuração» (precisa de /setup)
 *   lento*    compra efectuada, mas a resposta chega depois do tempo limite
 *   perdido*  compra sem resposta e NÃO efectuada (timeout)
 *   recusa*   compra recusada (422)
 *   nsfalha*  registo OK; alterar nameservers falha (500)
 *   verifica* registo a aguardar verificação do contacto (verification.type = contact_verification)
 *   recupera* já está na conta, PAGO e a aguardar configuração (encomenda antiga)
 *   antigo*   já está registado na conta (registado no hPanel antes da integração)
 * O filtro do catálogo é por prefixo (como na API real); a compra recusa item_id de outra extensão (stats.wrongItem).
 * WHOIS: país diferente de AO sem «zip» → 422 errors.whois_details.zip.
 * GET /_stats: compras efectivas por domínio, chamadas de compra/setup e leituras.
 *
 * VPS (especificação OpenAPI 3.7.0): GET /api/billing/v1/catalog?category=VPS, GET /api/vps/v1/data-centers,
 *   GET /api/vps/v1/templates, GET|POST /api/vps/v1/virtual-machines, GET /api/vps/v1/virtual-machines/{id},
 *   POST /api/vps/v1/virtual-machines/{id}/setup. A VM fica «running» --vps-ready ms depois de criada (3000).
 *   Cenários pelo item de preço do produto «hostingercom-vps-ensaio»: …-lento-… (compra feita, resposta depois do
 *   tempo limite), …-perdido-… (sem resposta e sem compra), …-recusa-… (422, sem compra), …-pagamento-… (202;
 *   POST /_vps_pay?subscription=… conclui: VM em «initial», precisa de /setup), …-caro-… (preço acima de qualquer limite).
 *   GET /_stats → vpsPurchases (compras efectivas por hostname), vpsPurchaseCalls, vpsSetups.
 */
import http from 'node:http'

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')] }))
const PORT = Number(args.port || 12091)
const DELAY = Number(args.delay || 4000)
const TOKEN = process.env.MOCK_HOSTINGER_TOKEN || 'hostinger-de-ensaio'

const domains = new Map()   // domínio → { id, status, registered_at, verification, ns }
const purchases = new Map() // domínio → n.º de compras efectivas
const stats = { purchaseCalls: 0, setupCalls: 0, nsCalls: 0, whoisCreated: 0, reads: 0, vpsPurchaseCalls: 0, vpsSetups: 0 }
const VPS_READY = Number(args['vps-ready'] || 3000)
const vms = new Map()          // id → VM
const vpsPurchases = new Map() // hostname → n.º de compras efectivas
const vpsPending = new Map()   // subscription_id → dados da compra (202)
const VPS_ITEMS = [
  ['kvm1', 'KVM 1', 1, 4096, 51200, 4194304, [[1, 1199, 499], [12, 7188, 5988], [24, 14376, 11976]]],
  ['kvm2', 'KVM 2', 2, 8192, 102400, 8388608, [[1, 1799, 699], [12, 10788, 8388], [24, 21576, 16776]]],
  ['kvm4', 'KVM 4', 4, 16384, 204800, 16777216, [[1, 2999, 999], [12, 17988, 11988], [24, 35976, 23976]]],
  ['kvm8', 'KVM 8', 8, 32768, 409600, 33554432, [[1, 5999, 1999], [12, 35988, 23988], [24, 71976, 47976]]],
]
const vpsCatalog = () => [
  ...VPS_ITEMS.map(([k, name, cpus, memory, disk, bandwidth, prices]) => ({ id: `hostingercom-vps-${k}`, name, category: 'VPS', metadata: { cpus, memory, disk_space: disk, bandwidth },
    prices: prices.map(([m, price, first]) => ({ id: `hostingercom-vps-${k}-usd-${m}m`, name: `${name} (${m} mês/meses)`, currency: 'USD', price, first_period_price: first, period: m, period_unit: 'month' })) })),
  { id: 'hostingercom-vps-ensaio', name: 'KVM 2 (cenários de ensaio)', category: 'VPS', metadata: { cpus: 2, memory: 8192, disk_space: 102400, bandwidth: 8388608 },
    prices: ['lento', 'perdido', 'recusa', 'pagamento', 'caro'].flatMap(sc => [1, 12].map(m => ({ id: `hostingercom-vps-ensaio-${sc}-usd-${m}m`, name: `Ensaio ${sc} ${m}m`, currency: 'USD', price: sc === 'caro' ? 999999 : 1799 * m, first_period_price: sc === 'caro' ? 999999 : 699 * m, period: m, period_unit: 'month' }))) },
]
const vpsItem = id => { for (const it of vpsCatalog()) { const pr = it.prices.find(x => x.id === id); if (pr) return { it, pr } } return null }
const vmView = vm => ({ ...vm, state: vm.state === 'creating' && Date.now() >= vm._readyAt ? 'running' : vm.state, _readyAt: undefined })
function createVm(it, setup, subscription, state = 'creating', count = true) {
  const id = ++seq
  const vm = { id, subscription_id: subscription, data_center_id: setup?.data_center_id ?? null, plan: it.name, hostname: setup?.hostname || `srv${id}.hstgr.cloud`, state,
    actions_lock: 'unlocked', cpus: it.metadata.cpus, memory: it.metadata.memory, disk: it.metadata.disk_space, bandwidth: it.metadata.bandwidth,
    ipv4: [{ id: id + 1, address: `198.51.100.${id % 250}`, ptr: null }], ipv6: [], template: setup?.template_id ? { id: setup.template_id, name: `Template ${setup.template_id}` } : null,
    created_at: now(), _readyAt: Date.now() + VPS_READY }
  vms.set(id, vm)
  if (count) vpsPurchases.set(vm.hostname, (vpsPurchases.get(vm.hostname) ?? 0) + 1)
  return vm
}
const whois = []
let seq = 5000
const label = d => d.split('.')[0]
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
const body = req => new Promise(r => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { r(JSON.parse(b || '{}')) } catch { r({}) } }) })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const now = () => new Date().toISOString()

function seed(d) {
  if (domains.has(d)) return
  if (/^recupera/.test(label(d))) domains.set(d, { id: ++seq, status: 'pending_setup', registered_at: null, verification: null, ns: [] })
  if (/^antigo/.test(label(d))) domains.set(d, { id: ++seq, status: 'active', registered_at: now(), verification: null, ns: ['ns1.dns-parking.com', 'ns2.dns-parking.com'] })
}
// Catálogo com o comportamento REAL do filtro por prefixo: «.COM*» devolve também .COM.BR, .COM.ES,
// .COMPANY… Preços fictícios (cêntimos). .AI só tem 2 anos (como no teste real: sem preço de 1 ano).
const PRODUCTS = [
  ['com', [[1, 999, 1599], [2, 2598, 3198], [3, 4197, 4797]]], ['com.br', [[1, 4111, 4111]]], ['com.es', [[1, 777, 777]]], ['company', [[1, 333, 3333]]],
  ['net', [[1, 1299, 1799], [2, 3098, 3598]]], ['net.in', [[1, 555, 555]]], ['network', [[1, 444, 2444]]],
  ['org', [[1, 1099, 1699]]], ['org.br', [[1, 3999, 3999]]], ['org.uk', [[1, 899, 899]]],
  ['shop', [[1, 199, 3999]]], ['shopping', [[1, 299, 2999]]],
  ['ai', [[2, 15998, 15998]]],
  ['io', [[1, 3499, 5999]]], ['online', [[1, 99, 3499]]], ['store', [[1, 99, 4999]]], ['tech', [[1, 199, 4999]]], ['xyz', [[1, 99, 1499]]],
]
const itemId = (tld, y) => `hostingercom-domain-${tld.replace(/\./g, '-')}-usd-${y}y`
function catalog(name) {
  const prefix = String(name || '').replace(/\*$/, '').toLowerCase()
  return PRODUCTS.filter(([t]) => `.${t}`.startsWith(prefix)).map(([t, prices]) => ({
    id: `hostingercom-domain-${t.replace(/\./g, '-')}`, name: `.${t.toUpperCase()} Domain`, category: 'DOMAIN', metadata: {},
    prices: prices.map(([y, first, price]) => ({ id: itemId(t, y), name: `.${t.toUpperCase()} ${y} ano(s)`, currency: 'USD', price, first_period_price: first, period: y, period_unit: 'year' })),
  }))
}
function register(d, extra = {}) {
  domains.set(d, { id: ++seq, status: 'active', registered_at: now(), verification: null, ns: ['ns1.dns-parking.com', 'ns2.dns-parking.com'], ...extra })
  purchases.set(d, (purchases.get(d) ?? 0) + 1)
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  const p = url.pathname
  if (p === '/_stats') return send(res, 200, { ...stats, purchases: Object.fromEntries(purchases), whois: whois.length, vpsPurchases: Object.fromEntries(vpsPurchases) })
  if (p === '/_vps_pay' && req.method === 'POST') {
    const sub = url.searchParams.get('subscription'); const x = vpsPending.get(sub)
    if (!x) return send(res, 404, { message: 'sem pagamento pendente' })
    vpsPending.delete(sub); const vm = createVm(x.it, { ...x.setup, hostname: x.setup.hostname }, sub, 'initial', false)
    return send(res, 200, { ok: true, vm: vm.id })
  }
  if (p === '/_pay' && req.method === 'POST') {
    const d = url.searchParams.get('domain'); const x = domains.get(d)
    if (x?.status === 'payment_processing') { x.status = 'pending_setup'; return send(res, 200, { ok: true }) }
    return send(res, 404, { message: 'sem pagamento pendente' })
  }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { message: 'Unauthenticated.' })

  // Leituras
  if (req.method === 'GET' && p === '/api/domains/v1/portfolio') {
    stats.reads++
    return send(res, 200, [...domains.entries()].filter(([, x]) => x.status !== 'payment_processing').map(([d, x]) => ({ id: x.id, domain: d, type: 'domain', status: x.status, created_at: now(), expires_at: null, verification: x.verification })))
  }
  let m = p.match(/^\/api\/domains\/v1\/portfolio\/([^/]+)$/)
  if (req.method === 'GET' && m) {
    stats.reads++
    const d = decodeURIComponent(m[1]); seed(d); const x = domains.get(d)
    if (!x || x.status !== 'active') return send(res, 404, { message: 'Domain not found.' })
    return send(res, 200, { domain: d, status: 'active', registered_at: x.registered_at, expires_at: null, name_servers: Object.fromEntries(x.ns.map((n, i) => [`ns${i + 1}`, n])) })
  }
  if (req.method === 'POST' && p === '/api/domains/v1/availability') {
    stats.reads++
    const b = await body(req)
    const d = `${b.domain}.${(b.tlds ?? [])[0]}`; seed(d)
    const taken = /^ocupado/.test(b.domain) || domains.has(d)
    return send(res, 200, [{ domain: d, is_available: !taken, is_alternative: false, is_premium: /^premium/.test(b.domain), restriction: null }])
  }
  if (req.method === 'GET' && p === '/api/billing/v1/catalog') { stats.reads++; return send(res, 200, url.searchParams.get('category') === 'VPS' ? vpsCatalog() : catalog(url.searchParams.get('name'))) }
  // ── VPS ──
  if (req.method === 'GET' && p === '/api/vps/v1/data-centers') { stats.reads++; return send(res, 200, [{ id: 19, name: 'fra', location: 'de', city: 'Frankfurt', continent: 'Europe' }, { id: 21, name: 'lis', location: 'pt', city: 'Lisboa', continent: 'Europe' }, { id: 17, name: 'bos', location: 'us', city: 'Boston', continent: 'North America' }]) }
  if (req.method === 'GET' && p === '/api/vps/v1/templates') { stats.reads++; return send(res, 200, [{ id: 1130, name: 'Ubuntu 24.04', description: 'Ubuntu 24.04 LTS' }, { id: 1077, name: 'Debian 12', description: 'Debian 12' }, { id: 1155, name: 'Ubuntu 24.04 com Docker', description: 'Docker' }]) }
  if (req.method === 'GET' && p === '/api/vps/v1/virtual-machines') { stats.reads++; return send(res, 200, [...vms.values()].map(vmView)) }
  let vmm = p.match(/^\/api\/vps\/v1\/virtual-machines\/(\d+)$/)
  if (req.method === 'GET' && vmm) { stats.reads++; const vm = vms.get(Number(vmm[1])); return vm ? send(res, 200, vmView(vm)) : send(res, 404, { error: 'Virtual machine not found' }) }
  vmm = p.match(/^\/api\/vps\/v1\/virtual-machines\/(\d+)\/setup$/)
  if (req.method === 'POST' && vmm) {
    const vm = vms.get(Number(vmm[1])); const b = await body(req)
    if (!vm) return send(res, 404, { error: 'Virtual machine not found' })
    if (vm.state !== 'initial') return send(res, 422, { error: 'Virtual machine is already set up' })
    if (!b.template_id || !b.data_center_id) return send(res, 422, { error: 'The given data was invalid.' })
    stats.vpsSetups++; vm.state = 'creating'; vm._readyAt = Date.now() + VPS_READY; vm.template = { id: b.template_id, name: `Template ${b.template_id}` }; vm.data_center_id = b.data_center_id
    return send(res, 200, vmView(vm))
  }
  if (req.method === 'POST' && p === '/api/vps/v1/virtual-machines') {
    stats.vpsPurchaseCalls++
    const b = await body(req); const found = vpsItem(String(b.item_id || ''))
    if (!found) return send(res, 422, { error: 'Invalid item_id.' })
    if (!b.setup?.template_id || !b.setup?.data_center_id) return send(res, 422, { error: 'setup.template_id and setup.data_center_id are required.' })
    if (b.setup.password) stats.vpsPasswordSent = (stats.vpsPasswordSent ?? 0) + 1
    stats.vpsLastBody = b   // para o ensaio confirmar que só seguem o produto e os parâmetros necessários
    const sc = (String(b.item_id).match(/-ensaio-(\w+)-usd/) ?? [])[1]
    const sub = `Azz${(++seq).toString(36)}`
    const order = { id: ++seq, subscription_id: sub, status: 'completed', currency: 'USD', subtotal: found.pr.first_period_price ?? found.pr.price, total: found.pr.first_period_price ?? found.pr.price, created_at: now(), updated_at: now() }
    if (sc === 'recusa') return send(res, 422, { error: 'Payment method declined.' })
    if (sc === 'perdido') { await sleep(DELAY); return send(res, 504, { error: 'Gateway timeout' }) }
    if (sc === 'pagamento') { vpsPending.set(sub, { it: found.it, setup: b.setup }); vpsPurchases.set(b.setup.hostname, (vpsPurchases.get(b.setup.hostname) ?? 0) + 1); return send(res, 202, { id: order.id, subscription_id: sub, status: 'payment_initiated', message: 'Payment is being processed.' }) }
    const vm = createVm(found.it, b.setup, sub)
    if (sc === 'lento') { await sleep(DELAY); return send(res, 200, { order, virtual_machine: vmView(vm) }) }
    return send(res, 200, { order, virtual_machine: vmView(vm) })
  }
  if (req.method === 'GET' && p === '/api/billing/v1/payment-methods') {
    stats.reads++
    return send(res, 200, [{ id: 7001, name: 'Visa', identifier: '**** 4242', payment_method: 'card', is_default: true, is_expired: false, is_suspended: false }, { id: 7002, name: 'PayPal', identifier: 'conta@exemplo', is_default: false }])
  }
  if (req.method === 'GET' && p === '/api/domains/v1/whois') { stats.reads++; return send(res, 200, whois) }
  if (req.method === 'POST' && p === '/api/domains/v1/whois') {
    const b = await body(req); const w = b.whois_details ?? {}
    const errors = {}
    for (const k of ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'country']) if (!w[k]) errors[`whois_details.${k}`] = ['required']
    if (b.country !== 'AO' && !w.zip) errors['whois_details.zip'] = ['The zip field is required.']
    if (Object.keys(errors).length) return send(res, 422, { message: 'The given data was invalid.', errors })
    const prof = { id: ++seq, tld: b.tld, country: b.country, entity_type: b.entity_type, is_default: false, whois_details: w }
    whois.push(prof); stats.whoisCreated++
    return send(res, 200, prof)
  }

  // COMPRA
  if (req.method === 'POST' && p === '/api/domains/v1/portfolio') {
    stats.purchaseCalls++
    const b = await body(req); const d = String(b.domain || ''); seed(d)
    // O item tem de ser do produto da extensão EXACTA do domínio (apanha a escolha de .COM.BR para .com)
    const tld = d.slice(d.indexOf('.') + 1)
    if (!b.item_id || !new RegExp(`^hostingercom-domain-${tld.replace(/\./g, '-')}-usd-\\d+y$`).test(b.item_id)) { stats.wrongItem = (stats.wrongItem ?? 0) + 1; return send(res, 422, { message: 'Item does not match the domain TLD.', errors: { item_id: ['invalid'] } }) }
    if (domains.has(d) || /^ocupado/.test(label(d))) return send(res, 422, { message: 'Domain is not available.', errors: { domain: ['not available'] } })
    const order = { id: ++seq, subscription_id: `sub_${seq}`, status: 'completed', currency: 'USD', subtotal: 999, total: 999, created_at: now(), updated_at: now() }
    const l = label(d)
    if (/^recusa/.test(l)) return send(res, 422, { message: 'Registration rejected by registry.', errors: { domain: ['rejected'] } })
    if (/^pagamento/.test(l)) { domains.set(d, { id: ++seq, status: 'payment_processing', registered_at: null, verification: null, ns: [] }); purchases.set(d, (purchases.get(d) ?? 0) + 1); return send(res, 202, { ...order, status: 'processing' }) }
    if (/^perdido/.test(l)) { await sleep(DELAY); return send(res, 504, { message: 'timeout' }) }
    if (/^lento/.test(l)) { register(d); await sleep(DELAY); return send(res, 200, order) }
    if (/^verifica/.test(l)) { domains.set(d, { id: ++seq, status: 'pending_verification', registered_at: null, verification: { type: 'contact_verification' }, ns: [] }); purchases.set(d, (purchases.get(d) ?? 0) + 1); return send(res, 200, order) }
    register(d)
    return send(res, 200, order)
  }
  m = p.match(/^\/api\/domains\/v1\/portfolio\/([^/]+)\/setup$/)
  if (req.method === 'POST' && m) {
    stats.setupCalls++
    const d = decodeURIComponent(m[1]); seed(d); const x = domains.get(d)
    if (!x || x.status !== 'pending_setup') return send(res, 404, { message: 'Domain is not awaiting setup.' })
    x.status = 'active'; x.registered_at = now(); x.ns = ['ns1.dns-parking.com', 'ns2.dns-parking.com']
    return send(res, 200, { message: 'Request accepted' })
  }
  m = p.match(/^\/api\/domains\/v1\/portfolio\/([^/]+)\/nameservers$/)
  if (req.method === 'PUT' && m) {
    stats.nsCalls++
    const d = decodeURIComponent(m[1]); const x = domains.get(d)
    if (!x || x.status !== 'active') return send(res, 404, { message: 'Domain not found.' })
    if (/^nsfalha/.test(label(d))) return send(res, 500, { message: 'Nameserver update failed.' })
    const b = await body(req)
    if (!b.ns1 || !b.ns2) return send(res, 422, { message: 'ns1 and ns2 are required.', errors: { ns1: ['required'] } })
    x.ns = [b.ns1, b.ns2, b.ns3, b.ns4].filter(Boolean)
    return send(res, 200, { message: 'Nameservers updated' })
  }
  send(res, 404, { message: 'Not found' })
}).listen(PORT, '127.0.0.1', () => console.log(`Hostinger simulada em http://127.0.0.1:${PORT}`))
