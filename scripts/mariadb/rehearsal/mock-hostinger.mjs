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
 *   Gestão: GET …/{id}/actions[/{actionId}], POST …/{id}/start|stop|restart|recreate, PUT …/{id}/root-password,
 *   GET|POST|DELETE …/{id}/ssh-keys. Cada instalação cria a acção «vps_install» (painéis/aplicações terminam
 *   --vps-ready ms depois da VM «running»; o template 1299 termina em «error»). Stats: vpsPowerCalls, vpsRecreates,
 *   vpsRootPasswords (só a contagem), vpsSshKeys.
 * Cloud VPS (especificação 3.9.2): catálogo BRL real (hostingercombr-vps-kvm1/2/4/8, cêntimos de BRL) e itens Game Panel;
 *   VM 1564781 (infraestrutura de produção, KVM 4, AlmaLinux 9 + cPanel) e VM 1570001 (existente, por importar);
 *   GET /api/billing/v1/subscriptions; GET …/{id}/metrics; GET …/{id}/backups e POST …/backups/{b}/restore;
 *   GET|POST|DELETE …/{id}/snapshot e POST …/snapshot/restore; PUT …/{id}/hostname; firewall (GET|POST /firewall,
 *   GET /firewall/{f}, POST|DELETE regras, activate/deactivate/sync). Stats: vmOps[vmId] (todas as operações de
 *   escrita por VM — a VM protegida tem de ficar a 0), firewallCreated, snapshotOps, backupRestores, hostnames.
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
  ['kvm1', 'KVM 1', 1, 4096, 51200, 4096000, [[1, 1199, 499], [12, 7188, 5988], [24, 14376, 11976]]],
  ['kvm2', 'KVM 2', 2, 8192, 102400, 8192000, [[1, 1799, 699], [12, 10788, 8388], [24, 21576, 16776]]],
  ['kvm4', 'KVM 4', 4, 16384, 204800, 16384000, [[1, 2999, 999], [12, 17988, 11988], [24, 35976, 23976]]],
  ['kvm8', 'KVM 8', 8, 32768, 409600, 32768000, [[1, 5999, 1999], [12, 35988, 23988], [24, 71976, 47976]]],
]
const vpsCatalog = () => [
  ...vpsCatalogExtra(),
  ...VPS_ITEMS.map(([k, name, cpus, memory, disk, bandwidth, prices]) => ({ id: `hostingercom-vps-${k}`, name, category: 'VPS', metadata: { cpus, memory, disk_space: disk, bandwidth },
    prices: prices.map(([m, price, first]) => ({ id: `hostingercom-vps-${k}-usd-${m}m`, name: `${name} (${m} mês/meses)`, currency: 'USD', price, first_period_price: first, period: m, period_unit: 'month' })) })),
  { id: 'hostingercom-vps-ensaio', name: 'KVM 2 (cenários de ensaio)', category: 'VPS', metadata: { cpus: 2, memory: 8192, disk_space: 102400, bandwidth: 8192000 },
    prices: ['lento', 'perdido', 'recusa', 'pagamento', 'caro'].flatMap(sc => [1, 12].map(m => ({ id: `hostingercom-vps-ensaio-${sc}-usd-${m}m`, name: `Ensaio ${sc} ${m}m`, currency: 'USD', price: sc === 'caro' ? 999999 : 1799 * m, first_period_price: sc === 'caro' ? 999999 : 699 * m, period: m, period_unit: 'month' }))) },
]
// Tráfego como a Hostinger o devolve: GB anunciados × 1024 (KVM 1 «4 TB» = 4 000 GB = 4 096 000 MB).
// Também: o mesmo KVM 1 na loja brasileira (hostingercombr-…) e um produto cuja chave de tráfego não tem unidade.
// Preços REAIS da auditoria (loja brasileira, cêntimos de BRL): [meses, renovação, inicial]
const BR = { kvm1: [1, 4096, 51200, 4096000, [[1, 8799, 5299], [12, 81588, 39588], [24, 143976, 71976]]], kvm2: [2, 8192, 102400, 8192000, [[1, 10899, 7099], [12, 106788, 59988], [24, 187176, 103176]]],
  kvm4: [4, 16384, 204800, 16384000, [[1, 19699, 12999], [12, 191988, 83988], [24, 359976, 143976]]], kvm8: [8, 32768, 409600, 32768000, [[1, 35999, 25999], [12, 335988, 167988], [24, 623976, 287976]]] }
const brPrices = (k, name) => BR[k][4].map(([m, price, first]) => ({ id: `hostingercombr-vps-${k}-brl-${m}m`, name: `${name} BR (${m})`, currency: 'BRL', price, first_period_price: first, period: m, period_unit: 'month' }))
const vpsCatalogExtra = () => [
  { id: 'hostingercombr-vps-kvm1', name: 'KVM 1 (BR)', category: 'VPS', metadata: { cpus: 1, memory: 4096, disk_space: 51200, bandwidth: 4096000 },
    prices: [...[[1, 1199, 499], [12, 7188, 5988]].map(([m, price, first]) => ({ id: `hostingercombr-vps-kvm1-usd-${m}m`, name: `KVM 1 BR (${m})`, currency: 'USD', price, first_period_price: first, period: m, period_unit: 'month' })), ...brPrices('kvm1', 'KVM 1')] },
  ...['kvm2', 'kvm4', 'kvm8'].map(k => ({ id: `hostingercombr-vps-${k}`, name: `${k.toUpperCase().replace('KVM', 'KVM ')} (BR)`, category: 'VPS', metadata: { cpus: BR[k][0], memory: BR[k][1], disk_space: BR[k][2], bandwidth: BR[k][3] }, prices: brPrices(k, k.toUpperCase()) })),
  ...[1, 2, 3, 4].map(n => ({ id: `hostingercombr-vps-game-panel-${n}`, name: `Game Panel ${n}`, category: 'VPS', metadata: { cpus: n * 2, memory: 4096 * n, disk_space: 51200 * n }, prices: [{ id: `hostingercombr-vps-game-panel-${n}-brl-1m`, name: `Game Panel ${n}`, currency: 'BRL', price: 9999 * n, first_period_price: 5999 * n, period: 1, period_unit: 'month' }] })),
  { id: 'hostingercom-vps-semunidade', name: 'KVM 1 (tráfego sem unidade)', category: 'VPS', metadata: { cpus: 1, memory: 4096, disk_space: 51200, traffic: 4 },
    prices: [{ id: 'hostingercom-vps-semunidade-usd-1m', name: 'sem unidade 1m', currency: 'USD', price: 1199, first_period_price: 499, period: 1, period_unit: 'month' }] },
]
const vpsItem = id => { for (const it of vpsCatalog()) { const pr = it.prices.find(x => x.id === id); if (pr) return { it, pr } } return null }
// Templates (só id, name, description — como na API real). Painéis e aplicações: «<SO> with <X>».
// 1299 é um template de ensaio cuja instalação termina em erro.
const TEMPLATES = [
  { id: 1130, name: 'Ubuntu 24.04', description: 'Ubuntu 24.04 LTS' }, { id: 1077, name: 'Debian 12', description: 'Debian 12' },
  { id: 1155, name: 'Ubuntu 24.04 com Docker', description: 'Docker' }, { id: 1203, name: 'Rocky Linux 9', description: 'Rocky Linux 9' },
  { id: 1200, name: 'AlmaLinux 9 with cPanel', description: 'cPanel & WHM (licença paga)' }, { id: 1201, name: 'Ubuntu 24.04 with CyberPanel', description: 'CyberPanel + OpenLiteSpeed' },
  { id: 1204, name: 'Ubuntu 24.04 with Plesk', description: 'Plesk Obsidian (licença paga)' }, { id: 1202, name: 'Ubuntu 24.04 with n8n', description: 'n8n (automação)' },
  { id: 1299, name: 'Debian 12 with Ensaio Erro', description: 'Instalação que falha (ensaio)' },
  { id: 1210, name: 'Ubuntu 24.04 with Ollama', description: 'Ollama (modelos de IA locais)' }, { id: 1211, name: 'Ubuntu 24.04 with MySQL', description: 'MySQL 8' },
  { id: 1212, name: 'Ubuntu 24.04 with Odoo', description: 'Odoo (ERP)' }, { id: 1213, name: 'Ubuntu 24.04 with Node.js', description: 'Node.js LTS' },
]
const fwView = f => ({ id: f.id, name: f.name, is_synced: f.synced, rules: f.rules, created_at: now(), updated_at: now() })
const isPanelOrApp = id => / with /.test(TEMPLATES.find(t => t.id === Number(id))?.name ?? '')
// Estado derivado do tempo: criação/instalação, ligar/desligar/reiniciar e reinstalação terminam sozinhos
function vmState(vm) {
  const t = Date.now()
  if (vm.state === 'creating' && t >= vm._readyAt) vm.state = 'running'
  if (vm._transition && t >= vm._transition.at) { vm.state = vm._transition.to; vm._transition = null }
  return vm.state
}
const actView = a => ({ id: a.id, name: a.name, state: Date.now() >= a._doneAt ? a._final : 'started', created_at: a.created_at, updated_at: Date.now() >= a._doneAt ? new Date(a._doneAt).toISOString() : a.created_at })
function addAction(vm, name, doneAt, final = 'success') { const a = { id: ++seq, name, created_at: now(), _doneAt: doneAt, _final: final }; vm._actions.push(a); return a }
const vmView = vm => {
  vmState(vm)
  const busy = vm._actions.some(a => Date.now() < a._doneAt)
  const { _readyAt, _actions, _transition, _keys, ...pub } = vm; void _readyAt; void _actions; void _transition; void _keys
  return { ...pub, actions_lock: busy ? 'locked' : 'unlocked' }
}
const installAction = (vm, templateId, base) => addAction(vm, 'vps_install', base + (isPanelOrApp(templateId) ? VPS_READY : 0), Number(templateId) === 1299 ? 'error' : 'success')
const ROOT_PW = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[-().&@?'#;/,+])[A-Za-z\d\-().&@?'#;/,+]{12,50}$/
const LEAKED = ['Password123#', 'Viraliza#Teste1']
function createVm(it, setup, subscription, state = 'creating', count = true) {
  const id = ++seq
  const vm = { id, subscription_id: subscription, data_center_id: setup?.data_center_id ?? null, plan: it.name, hostname: setup?.hostname || `srv${id}.hstgr.cloud`, state,
    actions_lock: 'unlocked', cpus: it.metadata.cpus, memory: it.metadata.memory, disk: it.metadata.disk_space, bandwidth: it.metadata.bandwidth,
    ipv4: [{ id: id + 1, address: `198.51.100.${id % 250}`, ptr: null }], ipv6: [{ id: id + 2, address: `2001:db8::${(id % 65535).toString(16)}` }], template: setup?.template_id ? { id: setup.template_id, name: `Template ${setup.template_id}` } : null,
    created_at: now(), _readyAt: Date.now() + VPS_READY, _actions: [], _transition: null, _keys: [...(setup?.ssh_keys ?? [])] }
  if (state === 'creating' && setup?.template_id) installAction(vm, setup.template_id, vm._readyAt)
  vms.set(id, vm)
  if (subscription && !subs.has(subscription)) {
    const pr = it.prices?.find?.(x => x.id === setup?._item) ?? it.prices?.[0]
    subs.set(subscription, { id: subscription, name: it.name, status: 'active', billing_period: pr?.period ?? 1, billing_period_unit: 'month', currency_code: pr?.currency ?? 'USD', total_price: pr?.first_period_price ?? pr?.price ?? 0, renewal_price: pr?.price ?? 0, is_auto_renewed: true, created_at: now(), expires_at: null, next_billing_at: new Date(Date.now() + 30 * 86400000).toISOString() })
  }
  if (count) vpsPurchases.set(vm.hostname, (vpsPurchases.get(vm.hostname) ?? 0) + 1)
  return vm
}
const whois = []
// Contas existentes (antes de qualquer compra do portal): infraestrutura interna e uma VM por importar
const seedVm = (id, it, tpl, sub, extra = {}) => vms.set(id, { id, subscription_id: sub, data_center_id: 19, plan: it.name, hostname: extra.hostname, state: 'running', actions_lock: 'unlocked',
  cpus: it.metadata.cpus, memory: it.metadata.memory, disk: it.metadata.disk_space, bandwidth: it.metadata.bandwidth, ipv4: [{ id: id + 1, address: extra.ip, ptr: null }], ipv6: [{ id: id + 2, address: `2a02:4780::${id % 9999}` }],
  template: { id: tpl.id, name: tpl.name }, created_at: '2025-03-01T10:00:00Z', _readyAt: 0, _actions: [], _transition: null, _keys: [] })
const subs = new Map() // subscription_id → dados (custos/renovação)
const fws = new Map()  // firewall id → { id, name, rules, vms:Set }
const snaps = new Map() // vmId → snapshot
const vmOp = id => { stats.vmOps = stats.vmOps ?? {}; stats.vmOps[id] = (stats.vmOps[id] ?? 0) + 1 }
// Números distintos em cada arranque (VMs de execuções anteriores continuam associadas na base de ensaio)
let seq = 5000 + (Math.floor(Date.now() / 1000) % 100000) * 100
{
  const kvm4 = { name: 'KVM 4', metadata: { cpus: 4, memory: 16384, disk_space: 204800, bandwidth: 16384000 } }, kvm2 = { name: 'KVM 2', metadata: { cpus: 2, memory: 8192, disk_space: 102400, bandwidth: 8192000 } }
  seedVm(1564781, kvm4, { id: 1200, name: 'AlmaLinux 9 with cPanel' }, 'AzProd1564781', { hostname: 'server.viralizahost.com', ip: '203.0.113.10' })
  subs.set('AzProd1564781', { id: 'AzProd1564781', name: 'KVM 4', status: 'active', billing_period: 12, billing_period_unit: 'month', currency_code: 'BRL', total_price: 83988, renewal_price: 191988, is_auto_renewed: true, created_at: '2025-03-01T10:00:00Z', expires_at: null, next_billing_at: new Date(Date.now() + 20 * 86400000).toISOString() })
  seedVm(1570001, kvm2, { id: 1130, name: 'Ubuntu 24.04' }, 'AzOld1570001', { hostname: 'cliente-antigo.example.com', ip: '203.0.113.20' })
  subs.set('AzOld1570001', { id: 'AzOld1570001', name: 'KVM 2', status: 'active', billing_period: 1, billing_period_unit: 'month', currency_code: 'BRL', total_price: 7099, renewal_price: 10899, is_auto_renewed: true, created_at: '2025-06-01T10:00:00Z', expires_at: null, next_billing_at: new Date(Date.now() + 10 * 86400000).toISOString() })
}
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
  if (req.method === 'GET' && p === '/api/vps/v1/templates') { stats.reads++; return send(res, 200, TEMPLATES) }
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
    installAction(vm, b.template_id, vm._readyAt)
    return send(res, 200, vmView(vm))
  }
  // ── Cloud VPS (3.9.2): subscrições, métricas, backups, snapshot, hostname, firewall ──
  if (req.method === 'GET' && p === '/api/billing/v1/subscriptions') { stats.reads++; return send(res, 200, [...subs.values()]) }
  vmm = p.match(/^\/api\/vps\/v1\/virtual-machines\/(\d+)\/(metrics|backups|snapshot|hostname)(?:\/(\d+|restore))?(?:\/(restore))?$/)
  if (vmm) {
    const id = Number(vmm[1]), vm = vms.get(id), what = vmm[2]
    if (!vm) return send(res, 404, { error: 'Virtual machine not found' })
    if (what === 'metrics' && req.method === 'GET') {
      stats.reads++
      if (!url.searchParams.get('date_from') || !url.searchParams.get('date_to')) return send(res, 422, { error: 'date_from and date_to are required.' })
      const t0 = Math.floor(Date.now() / 1000) - 86400, serie = f => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [t0 + i * 7200, f(i)]))
      return send(res, 200, { cpu_usage: { unit: '%', usage: serie(i => 5 + (i * 7) % 40) }, ram_usage: { unit: 'bytes', usage: serie(i => (1.2 + i * 0.05) * 1024 ** 3) }, disk_space: { unit: 'bytes', usage: serie(i => (10 + i * 0.1) * 1024 ** 3) },
        outgoing_traffic: { unit: 'bytes', usage: serie(i => i * 50 * 1024 ** 2) }, incoming_traffic: { unit: 'bytes', usage: serie(i => i * 30 * 1024 ** 2) }, uptime: { unit: 'milliseconds', usage: serie(i => i * 7200000) } })
    }
    if (what === 'backups' && req.method === 'GET' && !vmm[3]) { stats.reads++; return send(res, 200, { data: [{ id: id * 10 + 1, size: 2048000, restore_time: 600, location: 'nl', created_at: new Date(Date.now() - 7 * 86400000).toISOString() }, { id: id * 10 + 2, size: 2100000, restore_time: 620, location: 'nl', created_at: new Date(Date.now() - 86400000).toISOString() }], meta: { current_page: 1, per_page: 50, total: 2 } }) }
    if (what === 'backups' && req.method === 'POST' && vmm[4] === 'restore') {
      if (![id * 10 + 1, id * 10 + 2].includes(Number(vmm[3]))) return send(res, 404, { error: 'Backup not found' })
      vmOp(id); stats.backupRestores = (stats.backupRestores ?? 0) + 1; vm.state = 'restoring'; vm._transition = { to: 'running', at: Date.now() + 1500 }
      return send(res, 200, actView(addAction(vm, 'backup_restore', Date.now() + 1500)))
    }
    if (what === 'snapshot') {
      if (req.method === 'GET' && !vmm[3]) { stats.reads++; const sn = snaps.get(id); return sn ? send(res, 200, sn) : send(res, 404, { error: 'Snapshot not found' }) }
      vmOp(id); stats.snapshotOps = (stats.snapshotOps ?? 0) + 1
      if (req.method === 'POST' && !vmm[3]) { snaps.set(id, { id: ++seq, restore_time: 120, created_at: now(), expires_at: new Date(Date.now() + 20 * 86400000).toISOString() }); return send(res, 200, actView(addAction(vm, 'snapshot_create', Date.now() + 800))) }
      if (req.method === 'POST' && vmm[3] === 'restore') { if (!snaps.has(id)) return send(res, 422, { error: 'No snapshot.' }); return send(res, 200, actView(addAction(vm, 'snapshot_restore', Date.now() + 800))) }
      if (req.method === 'DELETE') { snaps.delete(id); return send(res, 200, actView(addAction(vm, 'snapshot_delete', Date.now() + 300))) }
    }
    if (what === 'hostname' && req.method === 'PUT') {
      const b = await body(req)
      if (!/^[a-z0-9.-]{3,191}$/.test(String(b.hostname ?? ''))) return send(res, 422, { error: 'Invalid hostname.' })
      vmOp(id); vm.hostname = b.hostname; stats.hostnames = (stats.hostnames ?? 0) + 1
      return send(res, 200, actView(addAction(vm, 'hostname_set', Date.now() + 200)))
    }
  }
  if (p === '/api/vps/v1/firewall') {
    if (req.method === 'GET') { stats.reads++; return send(res, 200, { data: [...fws.values()].map(fwView), meta: { current_page: 1, per_page: 50, total: fws.size } }) }
    if (req.method === 'POST') { const b = await body(req); if (!b.name) return send(res, 422, { error: 'name required' }); const f = { id: ++seq, name: String(b.name), rules: [], vms: new Set(), synced: true }; fws.set(f.id, f); stats.firewallCreated = (stats.firewallCreated ?? 0) + 1; return send(res, 200, fwView(f)) }
  }
  let fm = p.match(/^\/api\/vps\/v1\/firewall\/(\d+)(?:\/(rules|activate|deactivate|sync))?(?:\/(\d+))?$/)
  if (fm) {
    const f = fws.get(Number(fm[1]))
    if (!f) return send(res, 404, { error: 'Firewall not found' })
    if (!fm[2] && req.method === 'GET') { stats.reads++; return send(res, 200, fwView(f)) }
    if (fm[2] === 'rules' && req.method === 'POST') { const b = await body(req); if (!['accept', 'drop'].includes(b.action) || !b.protocol) return send(res, 422, { error: 'invalid rule' }); f.rules.push({ id: ++seq, action: b.action, protocol: b.protocol, port: String(b.port ?? 'any'), source: b.source ?? 'any', source_detail: b.source_detail ?? 'any' }); f.synced = false; return send(res, 200, fwView(f)) }
    if (fm[2] === 'rules' && req.method === 'DELETE' && fm[3]) { f.rules = f.rules.filter(r => r.id !== Number(fm[3])); f.synced = false; return send(res, 200, fwView(f)) }
    if (['activate', 'deactivate', 'sync'].includes(fm[2]) && req.method === 'POST' && fm[3]) {
      const vm = vms.get(Number(fm[3])); if (!vm) return send(res, 404, { error: 'Virtual machine not found' })
      vmOp(Number(fm[3]))
      if (fm[2] === 'activate') f.vms.add(Number(fm[3])); if (fm[2] === 'deactivate') f.vms.delete(Number(fm[3])); f.synced = true
      return send(res, 200, actView(addAction(vm, `firewall_${fm[2]}`, Date.now() + 300)))
    }
  }
  // Gestão (sem custo): acções, energia, reinstalação, palavra-passe root, chaves SSH
  vmm = p.match(/^\/api\/vps\/v1\/virtual-machines\/(\d+)\/(actions|start|stop|restart|recreate|root-password|ssh-keys)(?:\/(\d+))?$/)
  if (vmm) {
    const vm = vms.get(Number(vmm[1])); const op = vmm[2]
    if (!vm) return send(res, 404, { error: 'Virtual machine not found' })
    const st = vmState(vm); const busy = vm._actions.some(a => Date.now() < a._doneAt)
    if (op === 'actions' && req.method === 'GET') {
      stats.reads++
      if (vmm[3]) { const a = vm._actions.find(x => x.id === Number(vmm[3])); return a ? send(res, 200, actView(a)) : send(res, 404, { error: 'Action not found' }) }
      return send(res, 200, { data: [...vm._actions].reverse().map(actView), meta: { current_page: 1, per_page: 50, total: vm._actions.length } })
    }
    if (op === 'ssh-keys') {
      if (req.method === 'GET') { stats.reads++; return send(res, 200, { data: vm._keys.map((k, i) => ({ id: i + 1, key: k })) }) }
      const b = await body(req)
      if (!Array.isArray(b.keys) || !b.keys.length || b.keys.some(k => !/^(ssh-|ecdsa-|sk-)/.test(String(k)))) return send(res, 422, { error: 'The given data was invalid.' })
      stats.vpsSshKeys = (stats.vpsSshKeys ?? 0) + 1
      vmOp(vm.id)
      if (req.method === 'POST') vm._keys.push(...b.keys.filter(k => !vm._keys.includes(k)))
      if (req.method === 'DELETE') vm._keys = vm._keys.filter(k => !b.keys.includes(k))
      return send(res, 200, actView(addAction(vm, 'ssh_keys_update', Date.now())))
    }
    if (op === 'root-password' && req.method === 'PUT') {
      const b = await body(req)
      if (!ROOT_PW.test(String(b.password ?? ''))) return send(res, 422, { error: 'Password does not meet requirements.' })
      if (LEAKED.includes(b.password)) return send(res, 422, { error: 'Password has been found in a data leak.' })
      stats.vpsRootPasswords = (stats.vpsRootPasswords ?? 0) + 1   // o valor nunca é guardado
      vmOp(vm.id)
      return send(res, 200, actView(addAction(vm, 'set_root_password', Date.now() + 500)))
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' })
    vmOp(vm.id)
    if (busy) return send(res, 422, { error: 'Another action is in progress.' })
    stats.vpsPowerCalls = (stats.vpsPowerCalls ?? 0) + 1
    if (op === 'start') { if (st !== 'stopped') return send(res, 422, { error: 'Virtual machine is not stopped.' }); vm.state = 'starting'; vm._transition = { to: 'running', at: Date.now() + 1500 }; return send(res, 200, actView(addAction(vm, 'vps_start', Date.now() + 1500))) }
    if (op === 'stop') { if (st !== 'running') return send(res, 422, { error: 'Virtual machine is not running.' }); vm.state = 'stopping'; vm._transition = { to: 'stopped', at: Date.now() + 1500 }; return send(res, 200, actView(addAction(vm, 'vps_stop', Date.now() + 1500))) }
    if (op === 'restart') { if (st !== 'running') return send(res, 422, { error: 'Virtual machine is not running.' }); vm.state = 'stopping'; vm._transition = { to: 'running', at: Date.now() + 2000 }; return send(res, 200, actView(addAction(vm, 'vps_restart', Date.now() + 2000))) }
    if (op === 'recreate') {
      const b = await body(req)
      if (!TEMPLATES.some(t => t.id === Number(b.template_id))) return send(res, 422, { error: 'Invalid template_id.' })
      if (b.password && !ROOT_PW.test(String(b.password))) return send(res, 422, { error: 'Password does not meet requirements.' })
      stats.vpsRecreates = (stats.vpsRecreates ?? 0) + 1
      const at = Date.now() + VPS_READY
      vm.state = 'recreating'; vm._transition = { to: 'running', at }; vm.template = { id: Number(b.template_id), name: TEMPLATES.find(t => t.id === Number(b.template_id)).name }
      return send(res, 200, actView(installAction(vm, b.template_id, at)))
    }
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
    const vm = createVm(found.it, { ...b.setup, _item: found.pr.id }, sub)
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
