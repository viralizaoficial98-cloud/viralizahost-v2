// Servidor VPS: duração + localização + «Escolha o que instalar» na mesma página, licenças, compatibilidade,
// «Escolher mais tarde», estados para o cliente, aprovisionamento (Hostinger SIMULADA), entrega manual e
// «Os meus VPS» (acesso, energia, palavra-passe root, chaves SSH, reinstalação, suporte, posse).
// Sem compras reais: só contra mock-hostinger.mjs. Repõe no fim planos VPS, integração e carrinhos.
//   Requer: mock-hostinger.mjs --port=12091 --delay=4000 --vps-ready=3000; no servidor REGISTRAR_TEST_PROVISIONING=1 e
//   VPS_PROVIDER_TIMEOUT_MS=2000 (só ensaio).
//   BASE_URL=http://localhost:3000 OUT=/tmp/vps-install node --env-file=.env.local scripts/mariadb/rehearsal/vps-install-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MOCK = process.env.HOSTINGER_MOCK || 'http://127.0.0.1:12091'
const OUT = process.env.OUT || './ui-shots-vps-install'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const num = s => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const ADMIN = { email: 'admin@ensaio.test', password: 'Admin#Teste2026' }
const C1 = { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' }
const C2 = { email: 'cliente2@ensaio.test', password: 'Cliente#Dois2026' }
// Mock: 21 Lisboa, 19 Frankfurt, 17 Boston · 1130 Ubuntu 24.04, 1077 Debian 12, 1200 AlmaLinux 9 with cPanel (paga),
// 1201 Ubuntu 24.04 with CyberPanel (só Lisboa), 1202 Ubuntu 24.04 with n8n, 1204 Plesk (RAM mínima 64 GB), 1299 instalação com erro
const LIS = '21', FRA = '19', UBU = '1130', DEB = '1077', CPANEL = '1200', CYBER = '1201', N8N = '1202', PLESK = '1204', ERR = '1299'
const LIC = 4500
const STRONG_PW = 'Ensaio#Forte2026x'

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
  const ctx = await b.newContext({ ...opts })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  const p = await ctx.newPage()
  p.errors = []
  p.on('pageerror', e => p.errors.push(e.message))
  p.answers = []
  p.on('dialog', d => { const a = p.answers.shift(); if (a === false) d.dismiss(); else d.accept(typeof a === 'string' ? a : undefined) })
  return { ctx, p }
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const mockStats = async () => (await fetch(`${MOCK}/_stats`)).json()
// Espera por uma mensagem; em caso de falha mostra a mensagem actual
async function waitMsg(p, re, timeout = 20000) {
  try { await p.getByTestId('vps-msg').filter({ hasText: re }).waitFor({ timeout }) }
  catch { throw new Error(`mensagem ${re} não apareceu; actual: «${await p.getByTestId('vps-msg').innerText().catch(() => '—')}»`) }
}
const hideChrome = p => p.addStyleTag({ content: 'header, [class*=sticky], [class*=fixed], [data-floating] { position: relative !important } [data-floating] { display: none !important }' })

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  // Cloud VPS (migração 24): compra directa = modo comercial «automático». Este ensaio cobre esse modo; o modo
  // «solicitação mediante aprovação» é coberto por cloud-vps-e2e.cjs. Repõe o modo no fim.
  const cvModeBefore = (await db.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(options, '$.commercialMode')) m FROM vps_provider_settings WHERE id = 1"))[0][0]?.m ?? null
  await db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', 'automatic') WHERE id = 1")
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const val = v => (v != null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v)
  const vpsIds = (await all("SELECT id FROM products WHERE category = 'vps' AND subcategory IS NULL")).map(r => r.id)
  const inV = `(${vpsIds.map(() => '?').join(',')})`
  const snapProducts = await all(`SELECT * FROM products WHERE id IN ${inV}`, vpsIds)
  const snapPrices = await all(`SELECT * FROM product_prices WHERE product_id IN ${inV}`, vpsIds)
  const snapSettings = await all('SELECT * FROM vps_provider_settings')
  const START = (await one('SELECT DATE_FORMAT(NOW(6), "%Y-%m-%d %H:%i:%s.%f") t')).t
  const oldOrders = async () => JSON.stringify(await all('SELECT id, status, payment_status, activation_status, amount FROM orders WHERE created_at < ? ORDER BY id', [START]))
  const ordersBefore = await oldOrders()
  const oldServices = async () => JSON.stringify(await all('SELECT s.id, s.status, s.provisioning_status, s.external_ref FROM services s WHERE s.created_at < ? ORDER BY s.id', [START]))
  const servicesBefore = await oldServices()

  const adm = new S(), c1 = new S(), c2 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: ADMIN })
  await c1.req('/api/auth/login', { method: 'POST', body: C1 })
  await c2.req('/api/auth/login', { method: 'POST', body: C2 })
  const API = '/api/admin/catalog/vps-plans', INT = '/api/admin/integrations/hostinger-vps'
  const plans = async () => (await adm.req(API)).json.plans
  const asInput = (pl, over = {}, per = {}) => ({
    id: pl.id, name: pl.name, description: pl.description, saleStatus: pl.saleStatus, position: pl.position, badge: pl.badge, highlight: pl.highlight, baseMonthly: pl.baseMonthly,
    specs: pl.specs, features: pl.features, providerProductId: pl.providerProductId, providerMode: pl.providerMode, providerSpecs: pl.providerSpecs, ...over,
    periods: pl.periods.filter(x => x.exists || per[x.cycle]).map(x => ({ cycle: x.cycle, discount: x.matchesRule ? x.discount : null, publish: x.active,
      providerItemId: x.providerItemId, providerCostMinor: x.providerCostMinor, providerCurrency: x.providerCurrency, providerCostLimitMinor: x.providerCostLimitMinor, ...(per[x.cycle] ?? {}) })),
  })
  const adminAct = body => adm.req('/api/admin/orders', { method: 'POST', body })
  const quote = async (s, lines) => (await s.req('/api/checkout/quote', { method: 'POST', body: { lines } })).json
  const placeOrder = (s, lines, total) => s.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines, acceptedTotal: total, paymentMethod: 'bank_transfer', proofFile: null } })
  const line = (slug, options, cycle = 'monthly') => ({ type: 'product', slug, cycle, quantity: 1, options })
  const svcOf = orderId => one(`SELECT s.id, s.status, s.provisioning_status ps, s.provisioning_error pe, s.external_ref, o.payment_status, o.order_number,
      v.status op, v.provider_vm_id vm, v.request, v.ipv4 FROM services s JOIN orders o ON o.id = s.order_id
      LEFT JOIN vps_provider_orders v ON v.service_id = s.id WHERE s.order_id = ? AND s.service_type = 'vps'`, [orderId])
  const purchasesFor = async svc => (await mockStats()).vpsPurchases[JSON.parse(svc.request ?? '{}').hostname] ?? 0
  const buy = async (s, slug, options, cycle = 'monthly') => {
    const q = await quote(s, [line(slug, options, cycle)])
    const r = await placeOrder(s, [line(slug, options, cycle)], q?.quote?.total)
    return { id: r.json?.order?.id, quote: q?.quote, status: r.status }
  }
  const buyAndApprove = async (s, slug, options, cycle) => { const o = await buy(s, slug, options, cycle); const a = await adminAct({ action: 'approve', orderId: o.id }); return { ...o, approve: a.json } }
  const reconcileUntil = async (svcId, want = 'active', tries = 14) => { let r; for (let i = 0; i < tries; i++) { r = await adminAct({ action: 'vps_reconcile', serviceId: svcId }); if (r.json?.result?.status === want) return r.json.result; await sleep(1000) } return r?.json?.result ?? null }
  const settings = async () => (await adm.req(INT)).json.settings
  const setImages = async (patch, extra = {}) => {
    const s = await settings()
    const images = s.images.map(x => (patch[x.id] ? { ...x, ...patch[x.id], license: { ...x.license, ...(patch[x.id].license ?? {}) } } : x))
    return adm.req(INT, { method: 'POST', body: { images, ...extra } })
  }
  const clientVps = (s, id, q = '') => s.req(`/api/client/vps/${id}${q}`)
  const clientAct = (s, id, body) => s.req(`/api/client/vps/${id}`, { method: 'POST', body })

  const b = await chromium.launch()
  let created = null
  try {
    // ── 1. Integração: catálogo da Hostinger (simulada) e classificação ──
    console.log('\n1. Integração: templates, classificação e configuração comercial')
    let r = await adm.req(INT, { method: 'POST', body: { mode: 'test', apiUrl: MOCK, secret: 'hostinger-de-ensaio', hostnameSuffix: 'srv.ensaio.test', autoProvision: false } })
    ok(r.status === 200, 'ligação de ensaio guardada')
    const calls0 = (await mockStats()).vpsPurchaseCalls
    r = await adm.req(INT, { method: 'POST', body: { action: 'test' } })
    ok(r.json?.result?.ok === true && (await mockStats()).vpsPurchaseCalls === calls0, `«Testar ligação» (só leitura): ${r.json?.result?.message}`)
    let st = r.json.settings
    const img = id => st.images.find(x => x.id === id)
    ok(img(UBU)?.category === 'os' && img(UBU).name === 'Ubuntu' && img(UBU).version === '24.04', 'Ubuntu 24.04 → sistema operativo, versão 24.04')
    ok(img(CPANEL)?.category === 'panel' && img(CPANEL).includedOs === 'AlmaLinux 9' && img(CPANEL).license.type === 'paid', 'AlmaLinux 9 with cPanel → painel, inclui AlmaLinux 9, licença paga (sem preço)')
    ok(img(CYBER)?.category === 'panel' && img(CYBER).license.type === 'included', 'CyberPanel → painel com licença incluída')
    ok(img(N8N)?.category === 'app' && img(N8N).name === 'n8n' && img(N8N).includedOs === 'Ubuntu 24.04', 'n8n → aplicação, inclui Ubuntu 24.04')
    ok(st.images.every(x => !x.enabled), 'templates novos ficam desactivados até o administrador os rever')
    // Licença paga sem preço: recusado
    r = await setImages({ [CPANEL]: { enabled: true } })
    ok(r.status === 400 && /preço mensal da licença/.test(r.json?.error), `licença paga sem preço não pode ser activada (${r.json?.error})`)
    r = await setImages({ [CYBER]: { accessUrl: 'ftp://x' } })
    ok(r.status === 400, 'endereço de acesso inválido → 400')
    r = await adm.req(INT, { method: 'POST', body: {
      autoProvision: true, confirmAuto: true, paymentMethodId: 7001, enabledLocations: [LIS, FRA], allowChooseLater: true,
      images: st.images.map(x => ({ ...x, enabled: [UBU, DEB, CPANEL, CYBER, N8N, PLESK].includes(x.id),
        ...(x.id === CPANEL ? { license: { type: 'paid', monthlyKz: LIC }, accessUrl: 'https://{ip}:2087', sshUser: 'root' } : {}),
        ...(x.id === PLESK ? { license: { type: 'paid', monthlyKz: 6000 }, minRamGb: 64 } : {}),
        ...(x.id === CYBER ? { locations: [LIS], accessUrl: 'https://{ip}:8090' } : {}),
        ...(x.id === N8N ? { accessUrl: 'https://{ip}:5678' } : {}) })) } })
    ok(r.status === 200 && r.json.settings.autoProvision === true && r.json.settings.allowChooseLater === true, 'opções activadas, cPanel 4 500 Kz/mês, CyberPanel só em Lisboa, Plesk ≥ 64 GB, «Escolher mais tarde» permitido', r.json?.error)
    r = await adm.req(INT, { method: 'POST', body: { addManualImage: { label: 'Windows Server 2022' } } })
    st = r.json?.settings
    ok(r.status === 200 && st.images.some(x => x.source === 'manual' && x.label === 'Windows Server 2022' && !x.enabled), 'opção manual criada (desactivada) para a equipa entregar')
    const manualId = st.images.find(x => x.source === 'manual')?.id
    r = await adm.req(INT, { method: 'POST', body: { removeImage: UBU } })
    ok(r.status === 400, 'templates da Hostinger não se removem (só se desactivam)')
    r = await adm.req(INT, { method: 'POST', body: { removeImage: manualId } })
    ok(r.status === 200 && !r.json.settings.images.some(x => x.id === manualId), 'opção manual removida')
    r = await adm.req(INT, { method: 'POST', body: { action: 'test' } })
    ok(r.json.settings.images.find(x => x.id === CPANEL)?.license?.monthlyKz === LIC && r.json.settings.images.find(x => x.id === CPANEL).enabled, 'novo «Testar ligação» preserva a configuração do administrador')
    ok((await c1.req(INT)).status === 403 && (await c1.req(INT, { method: 'POST', body: { images: [] } })).status === 403, 'cliente não altera a configuração (403)')

    // Planos: vps-nvme2 automático (KVM 2, RAM 8 GB) · vps-nvme4 activação manual
    const pl = await plans()
    const p1 = pl.find(p => p.slug === 'vps-nvme2') ?? pl[0], p2 = pl.find(p => p.slug === 'vps-nvme4') ?? pl[1]
    const prov = (await adm.req(`${API}?provider=1`)).json.provider
    const kvm2 = prov.items.find(i => i.id === 'hostingercom-vps-kvm2')
    const specs2 = { vcpu: 2, ramGb: 8, diskGb: 100, diskType: 'NVMe', traffic: { value: 8, unit: 'TB' }, network: { value: 1, unit: 'Gbps' } }
    const per1 = {}
    for (const [c, m] of [['monthly', 1], ['1year', 12], ['2years', 24]]) { const it = kvm2.prices.find(x => x.period === m); per1[c] = { publish: true, discount: { monthly: 0, '1year': 10, '2years': 20 }[c], providerItemId: it.id, providerCostMinor: it.first_period_price ?? it.price, providerCurrency: 'USD', providerCostLimitMinor: Math.ceil((it.first_period_price ?? it.price) * 1.1) } }
    r = await adm.req(API, { method: 'PUT', body: asInput(p1, { specs: specs2, providerProductId: 'hostingercom-vps-kvm2', providerSpecs: kvm2.specs, providerMode: 'auto' }, per1) })
    ok(r.status === 200, `${p1.slug}: automático (KVM 2), 1 mês / 1 ano / 2 anos com o item exacto de cada período`, r.json?.error)
    r = await adm.req(API, { method: 'PUT', body: asInput(p2, { specs: { ...specs2, ramGb: 16 }, providerMode: 'manual' }) })
    ok(r.status === 200, `${p2.slug}: activação manual`, r.json?.error)
    const prices1 = (await adm.req(API)).json.plans.find(p => p.id === p1.id).periods
    const priceOf = c => prices1.find(x => x.cycle === c)?.price

    // ── 2. Catálogo público e validação no servidor ──
    console.log('\n2. Opções compatíveis e validação no servidor')
    r = await anon.req(`/api/catalog/vps-options?plano=${p1.slug}`)
    const pub = r.json
    ok(r.status === 200 && pub.locations.map(l => l.id).sort().join() === [FRA, LIS].sort().join(), 'só as localizações activadas (Lisboa, Frankfurt)')
    ok(pub.images.some(i => i.id === CPANEL && i.license.type === 'paid' && i.license.monthlyKz === LIC) && pub.images.some(i => i.id === N8N && i.category === 'app'), 'cPanel com licença paga e n8n como aplicação')
    ok(!pub.images.some(i => i.id === PLESK), 'Plesk (RAM mínima 64 GB) não aparece num plano de 8 GB')
    ok(pub.images.find(i => i.id === CYBER)?.locations.join() === LIS, 'CyberPanel indica que só está disponível em Lisboa')
    ok(!JSON.stringify(pub).includes('accessUrl') && !JSON.stringify(pub).includes('hostinger-de-ensaio'), 'resposta pública sem endereços internos nem token')
    ok((await anon.req('/api/catalog/vps-options?plano=nao-existe')).status === 404, 'plano inexistente → 404')
    let q = await quote(c1, [line(p1.slug, { location: FRA, image: CYBER })])
    ok(q.quote.lines[0].error?.code === 'image_incompatible', `CyberPanel em Frankfurt → recusado: «${q.quote.lines[0].error?.message}»`)
    q = await quote(c1, [line(p1.slug, { location: LIS, image: PLESK })])
    ok(q.quote.lines[0].error?.code === 'image_incompatible', 'Plesk num plano sem RAM suficiente → recusado')
    q = await quote(c1, [line(p1.slug, { location: LIS })])
    ok(q.quote.lines[0].error?.code === 'options_required', 'sem instalação nem «escolher mais tarde» → pedido de escolha')
    q = await quote(c1, [line(p1.slug, { location: LIS, image: CPANEL })])
    let l0 = q.quote.lines[0]
    ok(!l0.error && l0.lineTotal === priceOf('monthly') + LIC && l0.options.image.license.total === LIC && l0.options.image.includedOs === 'AlmaLinux 9', `cPanel 1 mês: ${priceOf('monthly')} + ${LIC} = ${l0.lineTotal} Kz`)
    q = await quote(c1, [line(p1.slug, { location: LIS, image: CPANEL }, '1year')])
    l0 = q.quote.lines[0]
    ok(l0.lineTotal === priceOf('1year') + LIC * 12 && l0.renewalPrice >= LIC * 12, `cPanel 1 ano: licença × 12 meses somada (${l0.lineTotal} Kz); renovação inclui a licença (${l0.renewalPrice} Kz)`)
    q = await quote(c1, [line(p1.slug, { location: LIS, later: true })])
    ok(!q.quote.lines[0].error && q.quote.lines[0].options.later === true && q.quote.lines[0].lineTotal === priceOf('monthly'), '«Escolher mais tarde» aceite, sem custo de licença')
    // Preço da licença alterado antes do pagamento → 409 e nova confirmação
    q = await quote(c1, [line(p1.slug, { location: LIS, image: CPANEL })])
    await setImages({ [CPANEL]: { license: { type: 'paid', monthlyKz: 5000 } } })
    r = await placeOrder(c1, [line(p1.slug, { location: LIS, image: CPANEL })], q.quote.total)
    ok(r.status === 409 && r.json?.code === 'price_changed' && r.json?.quote?.total === q.quote.total + 500, `licença alterada antes do pagamento → 409 «${r.json?.error}» com o novo total`)
    await setImages({ [CPANEL]: { license: { type: 'paid', monthlyKz: LIC } } })

    // ── 3. Compra no navegador (desktop): duração + localização + instalação na mesma página ──
    console.log('\n3. «Comprar agora» → duração e instalação → carrinho → pagamento (desktop)')
    await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email IN (?, ?)", [C1.email, C2.email])
    let { ctx, p } = await ctxFor(b, DESKTOP, c2.cookie)
    await p.goto(BASE + '/servidor-vps', { waitUntil: 'domcontentloaded' })
    await p.getByTestId('vps-period-monthly').click().catch(() => {})
    // O botão do plano abre agora o configurador Cloud VPS; o percurso /comprar (modo automático) é testado directamente
    ok(/\/servidor-vps\/configurar\?plano=/.test(await p.locator(`[data-testid=vps-plan][data-slug="${p1.slug}"]`).getByTestId('vps-plan-cta').getAttribute('href')), 'botão do plano → configurador Cloud VPS')
    await p.goto(`${BASE}/comprar/${p1.slug}?ciclo=monthly`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('install-picker').waitFor()
    const body = await p.locator('body').innerText()
    ok(/Escolha a duração/.test(body) && /Localização do servidor/.test(body) && /Escolha o que instalar/.test(body), 'mesma página: «Escolha a duração», «Localização do servidor» e «Escolha o que instalar»')
    ok(await p.getByTestId('to-options').count() === 0, 'sem passo intermédio: «Adicionar ao carrinho» na mesma página')
    await p.getByTestId('cycle-monthly').click()
    ok(await p.locator('[data-testid=add-to-cart][disabled]').count() === 1, '«Adicionar ao carrinho» desactivado até escolher localização e instalação')
    const tabs = await p.locator('[role=tab]').allInnerTexts()
    ok(tabs.length === 3 && /Sistema operativo/.test(tabs[0]) && /Painel de controlo/.test(tabs[1]) && /Aplicações/.test(tabs[2]), `três separadores: ${tabs.map(t => t.replace(/\s+/g, ' ')).join(' | ')}`)
    ok(await p.getByTestId(`opt-image-${UBU}`).isVisible() && await p.getByTestId(`opt-image-${CPANEL}`).count() === 0, 'separador «Sistema operativo» só com sistemas')
    const ubuCard = await p.getByTestId(`opt-image-${UBU}`).innerText()
    ok(/Ubuntu/.test(ubuCard) && /Versão 24\.04/.test(ubuCard) && /Licença incluída/.test(ubuCard), `cartão: nome, versão e licença («${ubuCard.replace(/\s+/g, ' ')}»)`)
    await p.getByTestId('install-search').fill('cpanel')
    ok(await p.getByTestId(`opt-image-${CPANEL}`).isVisible() && await p.getByTestId(`opt-image-${UBU}`).count() === 0, 'pesquisa «cpanel» encontra o painel em qualquer separador')
    ok(/Licença paga: Kz 4/.test(await p.getByTestId(`opt-image-${CPANEL}`).innerText()), 'licença paga com valor e periodicidade no cartão')
    await p.getByTestId('install-search').fill('zzzz')
    ok(await p.getByTestId('install-empty').isVisible() && /Nenhum resultado/.test(await p.getByTestId('install-empty').innerText()), 'pesquisa sem resultados → estado vazio com «Limpar pesquisa»')
    await p.getByTestId('install-search').fill('')
    await p.getByTestId(`opt-location-${LIS}`).click()
    await p.getByTestId('install-tab-panel').click()
    await p.getByTestId(`opt-image-${CYBER}`).click()
    await p.getByTestId(`opt-location-${FRA}`).click()
    ok(await p.getByTestId('install-notice').isVisible() && /não está disponível em Frankfurt/.test(await p.getByTestId('install-notice').innerText()), `região incompatível: «${(await p.getByTestId('install-notice').innerText()).trim()}»`)
    ok(await p.getByTestId(`opt-image-${CYBER}`).count() === 0 && await p.locator('[data-testid=add-to-cart][disabled]').count() === 1, 'CyberPanel escondido em Frankfurt; escolha anulada até nova escolha')
    await p.screenshot({ path: `${OUT}/desktop-01-regiao-incompativel.png`, fullPage: true })
    await p.getByTestId(`opt-location-${LIS}`).click()
    await p.getByTestId(`opt-image-${CPANEL}`).click()
    ok(/AlmaLinux 9/.test(await p.getByTestId('summary-included-os').innerText()), 'painel com sistema incluído: resumo mostra «sistema incluído: AlmaLinux 9» (uma só escolha)')
    ok(/Kz 4/.test(await p.getByTestId('summary-license').innerText()) && /mês/.test(await p.getByTestId('summary-license').innerText()), `custo da licença antes de continuar: «${(await p.getByTestId('summary-license').innerText()).trim()}»`)
    ok(num(await p.getByTestId('flow-total').innerText()) === priceOf('monthly') + LIC, `total a pagar agora inclui a licença (${await p.getByTestId('flow-total').innerText()})`)
    await p.getByTestId('cycle-1year').click()
    ok(num(await p.getByTestId('flow-total').innerText()) === priceOf('1year') + LIC * 12, `1 ano: VPS + licença × 12 (${await p.getByTestId('flow-total').innerText()})`)
    const y1 = await p.getByTestId('cycle-1year').innerText()
    ok(/Poupe 10%/.test(y1) && /A pagar agora/.test(y1) && /Renova por/.test(y1), `períodos mantêm desconto, total a pagar e renovação («${y1.replace(/\s+/g, ' ')}»)`)
    await p.getByTestId('cycle-monthly').click()
    await hideChrome(p)
    await p.screenshot({ path: `${OUT}/desktop-02-duracao-e-instalacao.png`, fullPage: true })
    ok(p.errors.length === 0, 'sem erros na página', p.errors.join(' | '))
    await p.getByTestId('add-to-cart').click()
    await p.waitForURL('**/carrinho')
    const lineOpts = await p.getByTestId('line-options').first().innerText()
    ok(/Lisboa/.test(lineOpts) && /Painel: cPanel/.test(lineOpts) && /AlmaLinux 9/.test(lineOpts) && /licença/.test(lineOpts), `carrinho: «${lineOpts}»`)
    await p.screenshot({ path: `${OUT}/desktop-03-carrinho.png`, fullPage: true })
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento')
    await p.getByTestId('summary-total').waitFor()
    ok(num(await p.getByTestId('summary-total').innerText()) >= priceOf('monthly') + LIC, 'checkout: total com a licença')
    await p.locator('input[type=file]').setInputFiles({ name: 'comprovativo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ensaio') })
    await p.getByText(/Comprovativo: comprovativo.pdf/).waitFor()
    await p.locator('[data-testid=to-review]:not([disabled])').click()
    ok(/cPanel/.test(await p.getByTestId('review-options').first().innerText()), 'revisão: instalação e licença')
    await p.getByTestId('accept-terms').check()
    await p.getByTestId('confirm-order').click()
    await p.waitForURL('**/orders/**')
    const orderMain = p.url().split('/orders/')[1].split('?')[0]
    ok(/Painel: cPanel/.test(await p.getByTestId('order-item-options').first().innerText()), 'encomenda (cliente): configuração completa')
    await ctx.close()
    const oi = await one('SELECT oi.options, oi.line_total, oi.renewal_price FROM order_items oi WHERE oi.order_id = ?', [orderMain])
    const oOpts = JSON.parse(oi.options)
    ok(oOpts.location.id === LIS && oOpts.image.id === CPANEL && oOpts.image.license.monthlyKz === LIC && Number(oi.line_total) === priceOf('monthly') + LIC, `encomenda guarda plano, região, imagem e valores aceites (${oi.line_total} Kz)`)
    let svMain = await svcOf(orderMain)

    // ── 4. Estados para o cliente e aprovisionamento ──
    console.log('\n4. Estados: pagamento → preparação → pronto (instalação concluída)')
    const unpaid = await buy(c1, p1.slug, { location: LIS, image: UBU })
    let list = (await c1.req('/api/client/vps')).json.items
    ok(list.find(v => v.orderId === unpaid.id)?.stateLabel === 'A aguardar pagamento', '«A aguardar pagamento» (sem comprovativo)')
    list = (await c2.req('/api/client/vps')).json.items
    ok(list.find(v => v.orderId === orderMain)?.stateLabel === 'Pagamento em validação', '«Pagamento em validação» (comprovativo enviado)')
    ok((await mockStats()).vpsPurchaseCalls === calls0, 'nada é comprado antes da validação do pagamento')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/orders?filtro=todas&encomenda=${svMain.order_number}`, { waitUntil: 'domcontentloaded' })
    let card = p.locator(`#order-${svMain.order_number}`); await card.waitFor()
    const adminOpts = await card.getByTestId('item-options').first().innerText()
    ok(/Painel: cPanel/.test(adminOpts) && /AlmaLinux 9/.test(adminOpts) && /Lisboa/.test(adminOpts) && /licença/.test(adminOpts), `painel: configuração completa («${adminOpts}»)`)
    await ctx.close()
    const s0 = await mockStats()
    await adminAct({ action: 'approve', orderId: orderMain })
    svMain = await svcOf(orderMain)
    ok((await mockStats()).vpsPurchaseCalls - s0.vpsPurchaseCalls === 1 && String(JSON.parse(svMain.request).setup.template_id) === CPANEL, 'pagamento validado → uma compra com o template cPanel')
    list = (await c2.req('/api/client/vps')).json.items
    ok(list.find(v => v.orderId === orderMain)?.stateLabel === 'A preparar o VPS', '«A preparar o VPS» durante a criação')
    await sleep(3600)
    r = await adminAct({ action: 'vps_reconcile', serviceId: svMain.id })
    ok(r.json?.result?.status === 'in_progress' && /instalação em curso/.test(r.json.result.message), `VM em execução mas instalação do painel por terminar → ainda não está pronto («${r.json?.result?.message}»)`)
    const done = await reconcileUntil(svMain.id)
    svMain = await svcOf(orderMain)
    ok(done?.status === 'active' && svMain.status === 'active', '«Pronto a utilizar» só com a VM activa e a instalação concluída')
    list = (await c2.req('/api/client/vps')).json.items
    const mine = list.find(v => v.orderId === orderMain)
    ok(mine?.stateLabel === 'Pronto a utilizar' && mine.ip && mine.install.includedOs === 'AlmaLinux 9' && mine.accessUrl === `https://${mine.ip}:2087`, `Os meus VPS: IP ${mine?.ip}, ${mine?.install?.label}, acesso ${mine?.accessUrl}`)

    // ── 5. Os meus VPS (desktop): acesso, energia, palavra-passe, chave SSH, reinstalação ──
    console.log('\n5. Área do Cliente → Os meus VPS (desktop)')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c2.cookie))
    await p.goto(BASE + '/vps', { waitUntil: 'domcontentloaded' })
    const vcard = p.locator(`[data-testid=vps-card][href="/vps/${svMain.id}"]`)
    ok(/Pronto a utilizar/.test(await vcard.innerText()) && /Lisboa/.test(await vcard.innerText()), 'lista: plano, estado, localização e IP')
    await hideChrome(p)
    await p.setViewportSize({ width: 1440, height: 2700 }); await p.waitForTimeout(300)
    await p.screenshot({ path: `${OUT}/desktop-04-os-meus-vps.png`, fullPage: true })
    await p.setViewportSize({ width: 1440, height: 900 })
    await vcard.click(); await p.waitForURL(`**/vps/${svMain.id}`)
    await p.getByTestId('vps-power-state').filter({ hasText: /Ligado/ }).waitFor({ timeout: 15000 })
    ok(await p.getByTestId('vps-ssh').innerText() === `ssh root@${mine.ip}`, `instruções SSH com utilizador e endereço: «${await p.getByTestId('vps-ssh').innerText()}»`)
    ok(await p.getByTestId('vps-open-panel').getAttribute('href') === `https://${mine.ip}:2087`, 'botão de acesso ao painel com o endereço')
    ok(/AlmaLinux 9/.test(await p.getByTestId('vps-os').innerText()) && /cPanel/.test(await p.getByTestId('vps-install').innerText()), 'painel instalado e sistema operativo incluído')
    ok(!/Ensaio#|password|palavra-passe:\s*\S{8,}/i.test(await p.getByTestId('vps-access').innerText()), 'nenhuma palavra-passe mostrada')
    ok(await p.locator('[data-testid=vps-start][disabled]').count() === 1, '«Ligar» indisponível com o VPS ligado')
    await hideChrome(p)
    await p.setViewportSize({ width: 1440, height: 2700 }); await p.waitForTimeout(300)
    await p.screenshot({ path: `${OUT}/desktop-05-gerir-vps.png`, fullPage: true })
    await p.setViewportSize({ width: 1440, height: 900 })
    const pw0 = await mockStats()
    p.answers.push(true)
    await p.getByTestId('vps-stop').click()
    await waitMsg(p, /em curso/, 5000)
    ok(true, 'desligar: progresso mostrado («em curso…»)')
    await waitMsg(p, /Desligar: concluído/, 20000)
    ok(/Desligado/.test(await p.getByTestId('vps-msg').innerText()), `resultado: «${await p.getByTestId('vps-msg').innerText()}»`)
    await p.locator('[data-testid=vps-start]:not([disabled])').click()
    await waitMsg(p, /Ligar: concluído/, 20000)
    await p.locator('[data-testid=vps-restart]:not([disabled])').click()
    await waitMsg(p, /Reiniciar: concluído/, 20000)
    ok((await mockStats()).vpsPowerCalls - (pw0.vpsPowerCalls ?? 0) === 3, 'desligar, ligar e reiniciar executados e verificados na Hostinger')
    r = await clientAct(c2, svMain.id, { action: 'start' })
    ok(r.status === 409, `ligar um VPS já ligado → recusado sem chamar a API («${r.json?.error}»)`)
    // Palavra-passe root
    await p.getByTestId('root-pw').fill('fraca'); await p.getByTestId('root-pw2').fill('fraca')
    ok(await p.locator('[data-testid=root-pw-save][disabled]').count() === 1, 'palavra-passe fraca: botão desactivado com as regras visíveis')
    await p.getByTestId('root-pw').fill('Viraliza#Teste1'); await p.getByTestId('root-pw2').fill('Viraliza#Teste1')
    await p.getByTestId('root-pw-save').click()
    await waitMsg(p, /recusou/, 10000)
    ok(true, 'palavra-passe comprometida → recusada pela Hostinger com explicação')
    await p.getByTestId('root-pw').fill(STRONG_PW); await p.getByTestId('root-pw2').fill(STRONG_PW)
    await p.getByTestId('root-pw-save').click()
    await waitMsg(p, /Palavra-passe root: concluído/, 10000)
    ok(await p.getByTestId('root-pw').inputValue() === '', 'palavra-passe definida; campo limpo')
    // Chave SSH
    const KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGVuc2Fpb2NoYXZlZGV0ZXN0ZXBhcmF2cHNlbnNhaW8 ensaio@portatil'
    await p.getByTestId('ssh-key').fill(KEY)
    await p.getByTestId('ssh-key-add').click()
    await waitMsg(p, /Chave SSH: concluído/, 10000)
    await p.getByTestId('ssh-keys').waitFor({ timeout: 5000 })
    ok(/ssh-ed25519/.test(await p.getByTestId('ssh-keys').innerText()) && /ensaio@portatil/.test(await p.getByTestId('ssh-keys').innerText()), 'chave SSH adicionada e listada (só a impressão)')
    r = await clientAct(c2, svMain.id, { action: 'ssh_key', key: '-----BEGIN OPENSSH PRIVATE KEY-----' })
    ok(r.status === 422, 'chave privada/inválida → recusada')
    // Reinstalação com confirmação separada
    r = await clientVps(c2, svMain.id)
    const reinstallIds = r.json.installs.map(i => i.id)
    ok(reinstallIds.includes(UBU) && reinstallIds.includes(CPANEL) && !reinstallIds.includes(PLESK), `reinstalação: opções compatíveis (${reinstallIds.join(', ')}); licença paga só a já contratada`)
    r = await clientAct(c2, svMain.id, { action: 'reinstall', image: UBU, acceptDataLoss: true, confirmText: 'sim' })
    ok(r.status === 422, 'reinstalar sem escrever REINSTALAR → recusado no servidor')
    const rc0 = (await mockStats()).vpsRecreates ?? 0
    await p.getByTestId('reinstall-image').selectOption(UBU)
    await p.getByTestId('reinstall-start').click()
    ok(/Todos os dados do VPS serão apagados/.test(await p.getByTestId('reinstall-warning').innerText()), 'aviso explícito de perda de dados')
    ok(await p.locator('[data-testid=reinstall-confirm][disabled]').count() === 1, 'confirmação desactivada sem aceitar e sem escrever REINSTALAR')
    await p.getByTestId('reinstall-accept').check()
    await p.getByTestId('reinstall-confirm-text').fill('REINSTALAR')
    await hideChrome(p)
    await p.getByTestId('vps-reinstall').screenshot({ path: `${OUT}/desktop-06-reinstalar-confirmacao.png` })
    await p.getByTestId('reinstall-confirm').click()
    await waitMsg(p, /Reinstalação: concluído/, 30000)
    ok(((await mockStats()).vpsRecreates ?? 0) - rc0 === 1 && /Ubuntu/.test(await p.getByTestId('vps-install').innerText()), 'reinstalado com Ubuntu 24.04 (uma operação)')
    ok(p.errors.length === 0, 'sem erros na página', p.errors.join(' | '))
    await ctx.close()
    // Palavras-passe nunca guardadas nem registadas
    const leak = await one("SELECT (SELECT COUNT(*) FROM activity_logs WHERE description LIKE ?) + (SELECT COUNT(*) FROM vps_provider_events WHERE detail LIKE ?) + (SELECT COUNT(*) FROM vps_provider_orders WHERE request LIKE ?) n", [`%${STRONG_PW}%`, `%${STRONG_PW}%`, `%${STRONG_PW}%`])
    const logs = ['/tmp/claude-0/next.log', '/tmp/claude-0/mocks/resend.log'].map(f => { try { return fs.readFileSync(f, 'utf8') } catch { return '' } }).join('\n')
    ok(Number(leak.n) === 0 && !logs.includes(STRONG_PW) && !logs.includes('Viraliza#Teste1'), 'palavra-passe root: não guardada na base, nem nos registos, nem em e-mails')
    ok(Number((await one("SELECT COUNT(*) n FROM vps_provider_events WHERE event = 'client_root_password' AND detail LIKE '%não guardado%'")).n) >= 1, 'auditoria regista a operação sem o valor')

    // ── 6. Posse: outro cliente ──
    console.log('\n6. Posse: cada cliente só vê e gere os seus VPS')
    ok((await clientVps(c1, svMain.id)).status === 404 && (await clientAct(c1, svMain.id, { action: 'stop' })).status === 404, 'outro cliente: consulta e operação → 404 (sem revelar o VPS)')
    ok((await clientAct(c1, svMain.id, { action: 'root_password', password: STRONG_PW })).status === 404 && (await clientAct(c1, svMain.id, { action: 'reinstall', image: UBU, acceptDataLoss: true, confirmText: 'REINSTALAR' })).status === 404, 'outro cliente: palavra-passe e reinstalação → 404')
    ok((await anon.req(`/api/client/vps/${svMain.id}`)).status === 401, 'sem sessão → 401')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
    const resp = await p.goto(`${BASE}/vps/${svMain.id}`, { waitUntil: 'domcontentloaded' })
    ok(resp.status() === 404, 'página de outro cliente → 404')
    ok(!(await c1.req('/api/client/vps')).json.items.some(v => v.id === svMain.id), 'lista do outro cliente sem este VPS')
    await ctx.close()

    // ── 7. Sistema operativo e aplicação (API) ──
    console.log('\n7. Sistema operativo (Debian) e aplicação (n8n)')
    const osOrder = await buyAndApprove(c1, p1.slug, { location: FRA, image: DEB })
    const appOrder = await buyAndApprove(c1, p1.slug, { location: LIS, image: N8N })
    const svOs = await svcOf(osOrder.id), svApp = await svcOf(appOrder.id)
    ok((await reconcileUntil(svOs.id))?.status === 'active', 'Debian 12 em Frankfurt: pronto')
    ok((await reconcileUntil(svApp.id))?.status === 'active', 'n8n (Ubuntu 24.04) em Lisboa: pronto depois da instalação da aplicação')
    const appV = (await c1.req('/api/client/vps')).json.items.find(v => v.id === svApp.id)
    ok(appV.install.category === 'app' && appV.install.includedOs === 'Ubuntu 24.04' && appV.accessUrl === `https://${appV.ip}:5678`, `aplicação: ${appV.install.label}, acesso ${appV.accessUrl}`)

    // ── 8. Escolher mais tarde ──
    console.log('\n8. «Escolher mais tarde»: paga agora, escolhe em «Os meus VPS»')
    const s8 = await mockStats()
    const later = await buyAndApprove(c1, p1.slug, { location: LIS, later: true })
    let svL = await svcOf(later.id)
    ok(svL.payment_status === 'paid' && svL.ps === 'manual_required' && /aguardar a escolha/.test(svL.pe) && (await mockStats()).vpsPurchaseCalls === s8.vpsPurchaseCalls, 'pago: nada comprado até à escolha')
    let vL = (await c1.req('/api/client/vps')).json.items.find(v => v.id === svL.id)
    ok(vL.awaitingChoice && vL.stateLabel === 'Necessita de intervenção', '«Necessita de intervenção»: escolha a instalação')
    r = await clientAct(c1, svL.id, { action: 'choose_install', image: CPANEL })
    ok(r.status === 422, 'mais tarde só opções com licença incluída (cPanel recusado)')
    r = await clientAct(c2, svL.id, { action: 'choose_install', image: UBU })
    ok(r.status === 404, 'outro cliente não escolhe por ele')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
    await p.goto(`${BASE}/vps/${svL.id}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId(`choose-image-${DEB}`).waitFor()
    ok(await p.getByTestId(`choose-image-${CPANEL}`).count() === 0 && await p.getByTestId(`choose-image-${CYBER}`).count() === 1, 'só opções compatíveis com Lisboa e com licença incluída')
    await hideChrome(p)
    await p.setViewportSize({ width: 1440, height: 2700 }); await p.waitForTimeout(300)
    await p.screenshot({ path: `${OUT}/desktop-07-escolher-mais-tarde.png`, fullPage: true })
    await p.setViewportSize({ width: 1440, height: 900 })
    await p.getByTestId(`choose-image-${DEB}`).click()
    await p.getByTestId('choose-confirm').click()
    await waitMsg(p, /Instalação escolhida/, 15000)
    await ctx.close()
    svL = await svcOf(later.id)
    ok((await mockStats()).vpsPurchaseCalls - s8.vpsPurchaseCalls === 1 && String(JSON.parse(svL.request).setup.template_id) === DEB, 'escolha feita → compra única com Debian 12')
    r = await clientAct(c1, svL.id, { action: 'choose_install', image: UBU })
    ok(r.status === 409, 'segunda escolha recusada (já escolhida)')
    ok((await reconcileUntil(svL.id))?.status === 'active', 'pronto depois da escolha')

    // ── 9. Activação manual ──
    console.log('\n9. Activação manual: configuração completa e entrega pela equipa')
    const s9 = await mockStats()
    const man = await buyAndApprove(c1, p2.slug, { location: FRA, image: DEB }, 'monthly')
    let svM = await svcOf(man.id)
    ok(svM.ps === 'manual_required' && /^Tarefa da equipa: preparar o VPS/.test(svM.pe) && /Debian 12/.test(svM.pe) && /Frankfurt/.test(svM.pe) && (await mockStats()).vpsPurchaseCalls === s9.vpsPurchaseCalls, `tarefa com a configuração completa, sem compra: «${svM.pe.slice(0, 110)}…»`)
    ok((await c1.req('/api/client/vps')).json.items.find(v => v.id === svM.id)?.stateLabel === 'A preparar o VPS', 'cliente vê «A preparar o VPS» (não precisa de agir)')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/orders?filtro=todas&encomenda=${svM.order_number}`, { waitUntil: 'domcontentloaded' })
    card = p.locator(`#order-${svM.order_number}`); await card.waitFor()
    p.answers.push('203.0.113.10', 'entregue pela equipa no ensaio')
    await card.getByTestId('vps-deliver').click()
    await sleep(2500)
    await ctx.close()
    svM = await svcOf(man.id)
    ok(svM.status === 'active' && svM.ipv4 === '203.0.113.10', '«Confirmar entrega…» → activo com o IP indicado')
    const vM = (await c1.req('/api/client/vps')).json.items.find(v => v.id === svM.id)
    ok(vM.stateLabel === 'Pronto a utilizar' && !vM.manageable && vM.ip === '203.0.113.10', 'cliente: pronto; gestão pelo suporte (entrega manual)')
    ok((await clientAct(c1, svM.id, { action: 'restart' })).status === 409, 'operações da API indisponíveis num VPS entregue manualmente')

    // ── 10. Resposta inconclusiva: concilia antes de repetir, sem compra duplicada ──
    console.log('\n10. Resposta inconclusiva (compra feita, resposta perdida)')
    const ens = prov.items.find(i => i.id === 'hostingercom-vps-ensaio')
    r = await adm.req(API, { method: 'POST', body: { name: `VPS Ensaio Instalação ${randomUUID().slice(0, 4)}`, saleStatus: 'active', position: 901, baseMonthly: 15000, specs: specs2, features: [],
      providerProductId: 'hostingercom-vps-ensaio', providerSpecs: ens.specs, providerMode: 'auto', periods: [{ cycle: 'monthly', discount: 0, publish: true, providerItemId: 'hostingercom-vps-ensaio-lento-usd-1m', providerCostMinor: 699, providerCurrency: 'USD', providerCostLimitMinor: 800 }] } })
    created = (await plans()).find(x => x.name.startsWith('VPS Ensaio Instalação'))
    const s10 = await mockStats()
    const slow = await buyAndApprove(c1, created.slug, { location: LIS, image: UBU })
    let svS = await svcOf(slow.id)
    ok(['unknown', 'submitted', 'active'].includes(svS.op), `resposta inconclusiva registada (${svS.op}) — não repete a compra`)
    await adminAct({ action: 'approve', orderId: slow.id })
    await sleep(4500)
    const fin = await reconcileUntil(svS.id)
    svS = await svcOf(slow.id)
    ok(fin?.status === 'active' && svS.vm, `conciliação encontrou a VM ${svS.vm} pelo hostname único`)
    ok((await mockStats()).vpsPurchaseCalls - s10.vpsPurchaseCalls === 1 && await purchasesFor(svS) === 1, 'uma só compra na Hostinger (sem duplicado)')

    // ── 11. Instalação com erro ──
    console.log('\n11. Instalação falhada na Hostinger')
    await setImages({ [ERR]: { enabled: true } })
    const bad = await buyAndApprove(c1, p1.slug, { location: LIS, image: ERR })
    const svB = await svcOf(bad.id)
    const badRes = await reconcileUntil(svB.id, 'manual_required')
    ok(badRes?.status === 'manual_required' && /instalação falhou/.test(badRes.message), `VM criada, instalação com erro → revisão («${badRes?.message}»)`)
    ok((await c1.req('/api/client/vps')).json.items.find(v => v.id === svB.id)?.stateLabel === 'Necessita de intervenção', 'cliente: «Necessita de intervenção» com pedido de suporte')
    await setImages({ [ERR]: { enabled: false } })

    // ── 12. Telemóvel ──
    console.log('\n12. Telemóvel (iPhone 13)')
    ;({ ctx, p } = await ctxFor(b, IPHONE, c2.cookie))
    await p.goto(`${BASE}/comprar/${p1.slug}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('install-picker').waitFor()
    await p.getByTestId(`opt-location-${LIS}`).click()
    await p.getByTestId('install-tab-app').click()
    await p.getByTestId(`opt-image-${N8N}`).click()
    ok(await overflow(p) <= 1, 'compra: sem deslocamento horizontal')
    ok(await p.getByTestId('install-later').isVisible(), '«Escolher mais tarde» visível (activação permite)')
    await hideChrome(p)
    await p.screenshot({ path: `${OUT}/iphone-01-duracao-e-instalacao.png`, fullPage: true })
    await p.goto(`${BASE}/vps/${svMain.id}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('vps-power-state').filter({ hasText: /Ligado|Estado actual/ }).waitFor({ timeout: 15000 })
    ok(await overflow(p) <= 1, 'Os meus VPS: sem deslocamento horizontal')
    // Área do Cliente: sem alterar o posicionamento (o menu lateral é fixo); só esconde os botões flutuantes
    await p.addStyleTag({ content: '[data-floating], [class*=fixed][class*=bottom] { display: none !important }' })
    await p.setViewportSize({ width: 390, height: 3600 }); await p.waitForTimeout(300)
    await p.screenshot({ path: `${OUT}/iphone-02-gerir-vps.png`, fullPage: true })
    ok(p.errors.length === 0, 'sem erros no telemóvel', p.errors.join(' | '))
    await ctx.close()

    // ── 13. Estados de carregamento e catálogo indisponível ──
    console.log('\n13. Carregamento e catálogo indisponível')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c2.cookie))
    await p.route('**/api/catalog/vps-options**', async route => { await sleep(1500); await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'indisponível' }) }) })
    await p.goto(`${BASE}/comprar/${p1.slug}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('install-loading').waitFor({ timeout: 5000 })
    ok(true, 'a carregar: esqueleto e mensagem')
    await p.getByTestId('install-unavailable').waitFor({ timeout: 10000 })
    ok(await p.locator('[data-testid=add-to-cart][disabled]').count() === 1, 'catálogo indisponível: mensagem, «Tentar novamente» e compra bloqueada')
    await p.getByTestId('install-unavailable').screenshot({ path: `${OUT}/desktop-08-catalogo-indisponivel.png` })
    await p.unroute('**/api/catalog/vps-options**')
    await p.getByRole('button', { name: /Tentar novamente/ }).click()
    await p.getByTestId('install-picker').waitFor({ timeout: 10000 })
    ok(true, '«Tentar novamente» recupera o catálogo')
    await ctx.close()
    // Integração: editor no painel
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/settings/integrations/hostinger-vps`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId(`vps-int-imgrow-${CPANEL}`).waitFor()
    await p.getByTestId(`vps-int-imgedit-${CPANEL}`).click()
    ok(await p.getByTestId(`vps-int-licprice-${CPANEL}`).inputValue() === String(LIC), 'painel: preço da licença editável')
    await p.setViewportSize({ width: 1440, height: 2400 })
    await p.screenshot({ path: `${OUT}/desktop-09-painel-opcoes.png`, fullPage: true })
    await ctx.close()

    ok(await oldOrders() === ordersBefore && await oldServices() === servicesBefore, 'encomendas e VPS anteriores inalterados')
  } catch (e) {
    ok(false, 'execução', e.stack)
  } finally {
    await db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', ?) WHERE id = 1", [cvModeBefore ?? 'request_only']).catch(() => {})
    try {
      await db.beginTransaction()
      if (created) {
        await db.query('DELETE FROM product_features WHERE product_id = ?', [created.id])
        await db.query("UPDATE products SET active = 0, sale_status = 'draft' WHERE id = ?", [created.id])
        await db.query('UPDATE product_prices SET active = 0 WHERE product_id = ?', [created.id])
      }
      const cols = ['name', 'description', 'sale_status', 'position', 'badge', 'popular', 'base_monthly_price', 'plan_specs', 'image_path', 'provider_product_id', 'provider_mode', 'provider_specs']
      for (const pr of snapProducts) await db.query(`UPDATE products SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => val(pr[c])), pr.id])
      await db.query(`DELETE FROM product_prices WHERE product_id IN ${inV}`, vpsIds)
      for (const x of snapPrices) { const k = Object.keys(x); await db.query(`INSERT INTO product_prices (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query('DELETE FROM vps_provider_settings')
      for (const x of snapSettings) { const k = Object.keys(x); await db.query(`INSERT INTO vps_provider_settings (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email IN (?, ?)", [C1.email, C2.email])
      await db.commit()
      ok(true, 'planos VPS, integração e carrinhos repostos como estavam')
    } catch (e) { await db.rollback().catch(() => {}); ok(false, 'reposição (transacção desfeita)', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
