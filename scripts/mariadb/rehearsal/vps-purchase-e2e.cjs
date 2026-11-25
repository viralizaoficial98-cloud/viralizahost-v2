// Servidor VPS: planos no painel, página pública (desktop + telemóvel), compra com localização e sistema,
// comprovativo, validação e aprovisionamento na Hostinger — tudo contra a API SIMULADA (mock-hostinger.mjs), sem custos.
// Cobre: permissões e validação, publicação/ordem, ícones, descontos, «Comprar agora», compra completa, comprovativo
// pendente, pagamento validado → compra única → VM activa, recusa, resposta perdida/lenta, 202 (+ /setup único),
// custo acima do limite, concorrência sem dupla compra, fluxo manual (tarefa + «Associar VPS…»), preço alterado (409).
// Repõe no fim os planos VPS e a configuração da integração como estavam.
//   Requer: mock-hostinger.mjs --port=12091 --delay=4000 --vps-ready=3000; no servidor REGISTRAR_TEST_PROVISIONING=1 e
//   VPS_PROVIDER_TIMEOUT_MS=2000 (só ensaio).
//   BASE_URL=http://localhost:3000 OUT=/tmp/vps node --env-file=.env.local scripts/mariadb/rehearsal/vps-purchase-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MOCK = process.env.HOSTINGER_MOCK || 'http://127.0.0.1:12091'
const OUT = process.env.OUT || './ui-shots-vps'
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
const CYCLES = [['monthly', 1], ['3months', 3], ['6months', 6], ['1year', 12], ['2years', 24], ['3years', 36]]
const totalOf = (base, months, d) => Math.round(Math.round(base * 100) * months * (100 - d) / 100) / 100
const LOC = '21', IMG = '1130'   // Lisboa · Ubuntu 24.04 (mock)

class S {
  cookie = ''
  async req(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...headers, ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
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
const mockPost = async (path, body) => { const r = await fetch(MOCK + path, { method: 'POST', headers: { authorization: 'Bearer hostinger-de-ensaio', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) } }

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  // Cloud VPS (migração 24): compra directa = modo comercial «automático». Este ensaio cobre esse modo; o modo
  // «solicitação mediante aprovação» é coberto por cloud-vps-e2e.cjs. Repõe o modo no fim.
  const cvModeBefore = (await db.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(options, '$.commercialMode')) m FROM vps_provider_settings WHERE id = 1"))[0][0]?.m ?? null
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const val = v => (v != null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v)
  // Instantâneo: planos VPS do /servidor-vps, configuração da integração, resto do catálogo e encomendas anteriores
  const vpsIds = (await all("SELECT id FROM products WHERE category = 'vps' AND subcategory IS NULL")).map(r => r.id)
  const inV = `(${vpsIds.map(() => '?').join(',')})`
  const snapProducts = await all(`SELECT * FROM products WHERE id IN ${inV}`, vpsIds)
  const snapPrices = await all(`SELECT * FROM product_prices WHERE product_id IN ${inV}`, vpsIds)
  const snapFeatures = await all(`SELECT * FROM product_features WHERE product_id IN ${inV}`, vpsIds)
  const snapSettings = await all('SELECT * FROM vps_provider_settings')
  // (depois da cópia da configuração: a reposição final devolve o modo comercial original)
  await db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', 'automatic') WHERE id = 1")
  const otherState = async () => JSON.stringify([
    await all("SELECT id, slug, name, sale_status, position, badge, base_monthly_price, plan_specs FROM products WHERE NOT (category = 'vps' AND subcategory IS NULL) ORDER BY id"),
    await all("SELECT pp.product_id, pp.cycle, pp.price, pp.renewal_price, pp.active, pp.discount_pct FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE NOT (p.category = 'vps' AND p.subcategory IS NULL) ORDER BY pp.product_id, pp.cycle"),
  ])
  const otherBefore = await otherState()
  const START = (await one('SELECT DATE_FORMAT(NOW(6), "%Y-%m-%d %H:%i:%s.%f") t')).t
  const oldOrders = async () => JSON.stringify(await all('SELECT id, status, payment_status, activation_status, amount FROM orders WHERE created_at < ? ORDER BY id', [START]))
  const ordersBefore = await oldOrders()

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
  const placeOrder = (s, lines, total, key = `ensaio-${randomUUID()}`) => s.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: key, lines, acceptedTotal: total, paymentMethod: 'bank_transfer', proofFile: null } })
  const vpsLine = (slug, cycle = 'monthly', options = { location: LOC, image: IMG }) => ({ type: 'product', slug, cycle, quantity: 1, ...(options ? { options } : {}) })
  const svcOf = orderId => one(`SELECT s.id, s.status, s.provisioning_status ps, s.provisioning_error pe, s.external_ref, o.payment_status, o.activation_status, o.order_number,
      v.status op, v.provider_vm_id vm, v.attempts, v.request, v.client_ref, v.expected_cost_minor, v.cost_limit_minor FROM services s JOIN orders o ON o.id = s.order_id
      LEFT JOIN vps_provider_orders v ON v.service_id = s.id WHERE s.order_id = ? AND s.service_type = 'vps'`, [orderId])
  const purchasesFor = async svc => { const st = await mockStats(); return st.vpsPurchases[JSON.parse(svc.request ?? '{}').hostname] ?? 0 }
  const buyAndApprove = async (s, slug, cycle = 'monthly') => {
    const q = await quote(s, [vpsLine(slug, cycle)])
    const r = await placeOrder(s, [vpsLine(slug, cycle)], q?.quote?.total)
    const id = r.json?.order?.id
    const a = await adminAct({ action: 'approve', orderId: id })
    return { id, approve: a.json }
  }
  const waitActive = async (svcId, tries = 8) => { for (let i = 0; i < tries; i++) { const r = await adminAct({ action: 'vps_reconcile', serviceId: svcId }); if (r.json?.result?.status === 'active') return r.json.result; await sleep(1000) } return null }

  const b = await chromium.launch()
  let created = null, mainOrder = null
  try {
    // ── 1. Migração ──
    console.log('\n1. Migração: planos e preços preservados')
    const pl0 = await plans()
    ok(pl0.length >= 3 && pl0.every(p => p.baseMonthly != null), `planos VPS (${pl0.map(p => p.slug).join(', ')}) com preço base derivado do preço guardado`)
    ok(pl0.every(p => p.periods.filter(x => x.exists).every(x => x.matchesRule)), 'preços guardados = base × meses × (1 − desconto): nada foi recalculado')
    ok(pl0.every(p => p.periods.filter(x => x.exists).every(x => Number(snapPrices.find(s => s.product_id === p.id && s.cycle === x.cycle)?.price) === x.price)), 'preços em Kz iguais aos da base de dados')
    ok(pl0.every(p => p.providerMode === 'manual'), 'planos existentes em activação manual até o administrador os associar')

    // ── 2. Permissões ──
    console.log('\n2. Permissões (servidor)')
    const deny = x => x.status === 401 || x.status === 403
    ok(deny(await anon.req(API)) && deny(await c1.req(API)), 'catálogo VPS do painel: anónimo e cliente → recusado (401/403)')
    ok(deny(await c1.req(API, { method: 'PUT', body: asInput(pl0[0], { baseMonthly: 1 }) })), 'cliente não altera preços (PUT recusado)')
    ok(deny(await c1.req(INT)) && deny(await c1.req(INT, { method: 'POST', body: { action: 'test' } })), 'integração Hostinger VPS: cliente → recusado')
    ok(deny(await c1.req('/api/admin/orders', { method: 'POST', body: { action: 'vps_link', serviceId: 'x', vmId: '1' } })), 'acções VPS das encomendas: cliente → recusado')
    ok((await anon.req('/api/cron/vps-sync')).status === 401, 'cron de conciliação sem segredo → 401')
    const intGet = await adm.req(INT)
    ok(intGet.status === 200 && !/hostinger-de-ensaio/.test(intGet.text) && !('secret' in (intGet.json?.settings ?? {})), 'configuração devolvida sem o token')

    // ── 3. Integração (API simulada) ──
    console.log('\n3. Integrações → Hostinger VPS')
    let r = await adm.req(INT, { method: 'POST', body: { mode: 'test', apiUrl: MOCK, secret: 'hostinger-de-ensaio', hostnameSuffix: 'srv.ensaio.test', autoProvision: false } })
    ok(r.status === 200, 'guardar ligação de ensaio')
    r = await adm.req(INT, { method: 'POST', body: { mode: 'test', autoProvision: true, confirmAuto: true } })
    ok(r.status === 400, 'automático recusado antes de um teste com sucesso', r.json?.error)
    const reads0 = (await mockStats()).vpsPurchaseCalls
    r = await adm.req(INT, { method: 'POST', body: { action: 'test' } })
    ok(r.json?.result?.ok === true && /centro\(s\) de dados/.test(r.json.result.message), `«Testar ligação»: ${r.json?.result?.message}`)
    ok((await mockStats()).vpsPurchaseCalls === reads0, '«Testar ligação» só lê (nenhuma compra)')
    ok(r.json?.settings?.locations?.some(x => x.id === LOC) && r.json?.settings?.images?.some(x => x.id === IMG), 'localizações e sistemas actualizados a partir da API')
    r = await adm.req(INT, { method: 'POST', body: { autoProvision: true, paymentMethodId: 7001, enabledLocations: [LOC, '19'], enabledImages: [IMG, '1077'] } })
    ok(r.status === 400 && /Confirme/.test(r.json?.error), 'automático exige confirmação explícita', r.json?.error)
    r = await adm.req(INT, { method: 'POST', body: { autoProvision: true, confirmAuto: true, paymentMethodId: 7001, enabledLocations: [LOC, '19'], enabledImages: [IMG, '1077'] } })
    ok(r.status === 200 && r.json?.settings?.autoProvision === true, 'aprovisionamento automático activado (método de pagamento da conta #7001)', r.json?.error)

    // ── 4. Validação dos planos ──
    console.log('\n4. Plano: validação no servidor')
    const prov = (await adm.req(`${API}?provider=1`)).json.provider
    const kvm2 = prov.items.find(i => i.id === 'hostingercom-vps-kvm2')
    ok(kvm2?.specs?.vcpu === 2 && kvm2.specs.ramGb === 8 && kvm2.specs.diskGb === 100, 'catálogo da Hostinger lido com as características (KVM 2: 2 vCPU, 8 GB, 100 GB)')
    const [p1, p2, p3] = pl0
    const specs2 = { vcpu: 2, ramGb: 8, diskGb: 100, diskType: 'NVMe', traffic: { value: 8, unit: 'TB' }, network: { value: 1, unit: 'Gbps' } }
    const bad = async (over, per, field, label) => { const x = await adm.req(API, { method: 'PUT', body: asInput(p1, over, per) }); ok(x.status === 400 && (!field || x.json?.field === field), `${label} → 400${x.json?.field ? ` (${x.json.field})` : ''}`, `${x.status} ${x.json?.error}`) }
    await bad({ specs: { ...specs2, vcpu: 0 } }, {}, 'vcpu', 'vCPU 0')
    await bad({ specs: { ...specs2, traffic: { unlimited: true, value: 5 } } }, {}, 'traffic', 'tráfego com valor e «Ilimitado»')
    await bad({ features: [{ text: 'Backups', icon: 'skull' }] }, {}, 'features', 'ícone fora da lista')
    await bad({ baseMonthly: -5 }, {}, 'baseMonthly', 'preço negativo')
    await bad({}, { '1year': { discount: 95 } }, 'discount-1year', 'desconto acima do máximo')
    const AUTO = { providerProductId: 'hostingercom-vps-kvm2', providerSpecs: kvm2.specs, providerMode: 'auto' }, AUTO_PER = { monthly: { providerItemId: 'hostingercom-vps-kvm2-usd-1m', providerCostMinor: 699, providerCurrency: 'USD', providerCostLimitMinor: 800 }, '1year': { publish: false }, '2years': { publish: false } }
    await bad({ ...AUTO, specs: { ...specs2, vcpu: 4 } }, AUTO_PER, 'specs', 'Automático: características ≠ produto da Hostinger')
    await bad({ ...AUTO, specs: { ...specs2, traffic: { unlimited: true } } }, AUTO_PER, 'specs', 'Automático: «Ilimitado» num produto com limite de tráfego')

    // ── 4b. Unidades do tráfego (regressão: KVM 1 «4 TB» ≠ «3,90625 TB») ──
    console.log('\n4b. Unidades do tráfego e validação por modo')
    const kvm1 = prov.items.find(i => i.id === 'hostingercombr-vps-kvm1')
    const semU = prov.items.find(i => i.id === 'hostingercom-vps-semunidade')
    ok(kvm1?.specs?.trafficGb === 4000 && JSON.stringify(kvm1.specs.raw?.traffic) === JSON.stringify({ key: 'bandwidth', value: 4096000, unit: 'MB' }), `KVM 1: valor bruto bandwidth = 4 096 000 MB → 4 000 GB (${JSON.stringify(kvm1?.specs?.raw?.traffic)})`)
    const specs1 = { vcpu: 1, ramGb: 4, diskGb: 50, diskType: 'NVMe', traffic: { value: 4, unit: 'TB' }, network: { value: 1, unit: 'Gbps' } }
    const K1 = { providerProductId: 'hostingercombr-vps-kvm1', providerSpecs: kvm1?.specs }
    const K1_PER = { monthly: { discount: 0, publish: true, providerItemId: 'hostingercombr-vps-kvm1-usd-1m', providerCostMinor: 499, providerCurrency: 'USD', providerCostLimitMinor: 550 }, '1year': { publish: false }, '2years': { publish: false } }
    const put = (over, per) => adm.req(API, { method: 'PUT', body: asInput(p2, over, per) })
    let u = await put({ ...K1, specs: specs1, providerMode: 'manual' }, K1_PER)
    ok(u.status === 200 && u.json.warnings.length === 0, 'KVM 1 com 4 TB em modo Manual: gravado sem divergência', JSON.stringify(u.json))
    u = await put({ ...K1, specs: specs1, providerMode: 'auto' }, K1_PER)
    ok(u.status === 200 && u.json.warnings.length === 0, 'KVM 1 com 4 TB em modo Automático: gravado (4 TB = 4 000 GB)', u.json?.error)
    let saved = (await plans()).find(x => x.id === p2.id)
    ok(JSON.stringify(saved.specs.traffic) === JSON.stringify({ value: 4, unit: 'TB' }), 'os 4 TB anunciados são preservados')
    u = await put({ ...K1, specs: { ...specs1, traffic: { value: 4000, unit: 'GB' } }, providerMode: 'auto' }, K1_PER)
    ok(u.status === 200 && u.json.warnings.length === 0, '4 000 GB também equivalem ao produto (unidades decimais)')
    u = await put({ ...K1, specs: { ...specs1, traffic: { value: 4, unit: 'TiB' } }, providerMode: 'auto' }, K1_PER)
    ok(u.status === 400 && u.json.field === 'specs' && /4 TiB \(4,398 TB\)/.test(u.json.error), `4 TiB (binário) em Automático → bloqueado: «${u.json?.error}»`)
    // Divergência real nos dois modos
    u = await put({ ...K1, specs: { ...specs1, traffic: { value: 8, unit: 'TB' } }, providerMode: 'auto' }, K1_PER)
    ok(u.status === 400 && u.json.field === 'specs' && /8 TB/.test(u.json.error), 'divergência real (8 TB num KVM 1) em Automático → bloqueada')
    u = await put({ ...K1, specs: { ...specs1, traffic: { value: 8, unit: 'TB' } }, providerMode: 'manual' }, K1_PER)
    ok(u.status === 200 && u.json.warnings.length === 1 && /tráfego anunciado 8 TB ≠ produto 4 TB/.test(u.json.warnings[0]), `divergência real em Manual → gravado com aviso «${u.json?.warnings?.[0]}»`)
    saved = (await plans()).find(x => x.id === p2.id)
    ok(saved.providerMode === 'manual' && saved.specWarnings.length === 1, 'aviso guardado e visível na lista do painel')
    // Unidade de origem desconhecida
    ok(semU?.specs?.trafficGb === null && JSON.stringify(semU.specs.unverified) === '["traffic"]', 'produto com «traffic: 4» sem unidade: valor não validado')
    const SU = { providerProductId: 'hostingercom-vps-semunidade', providerSpecs: semU?.specs }
    const SU_PER = { ...K1_PER, monthly: { ...K1_PER.monthly, providerItemId: 'hostingercom-vps-semunidade-usd-1m' } }
    u = await put({ ...SU, specs: specs1, providerMode: 'manual' }, SU_PER)
    ok(u.status === 200 && u.json.unverified.length === 1 && /não foi possível validar/.test(u.json.unverified[0]), `Manual: gravado e assinalado «${u.json?.unverified?.[0]}»`)
    u = await put({ ...SU, specs: specs1, providerMode: 'auto' }, SU_PER)
    ok(u.status === 400 && u.json.field === 'providerSpecsConfirmed' && /não foi possível validar/.test(u.json.error), 'Automático: valor não validado exige confirmação explícita')
    u = await put({ ...SU, specs: specs1, providerMode: 'auto', providerSpecsConfirmed: true }, SU_PER)
    ok(u.status === 200, 'Automático com confirmação da equipa: gravado')
    // Painel: mesma regra no formulário (aviso em Manual, bloqueio em Automático)
    {
      const { ctx: c4, p: q } = await ctxFor(b, DESKTOP, adm.cookie)
      await put({ ...K1, specs: { ...specs1, traffic: { value: 8, unit: 'TB' } }, providerMode: 'manual' }, K1_PER)
      await q.goto(BASE + '/admin/site/catalog?cat=vps', { waitUntil: 'domcontentloaded' })
      const r2 = q.locator(`[data-testid=vps-plan-admin][data-slug="${p2.slug}"]`); await r2.waitFor()
      ok(/aviso: características ≠ produto/.test(await r2.locator('summary').innerText()), 'lista: «aviso: características ≠ produto» (modo Manual)')
      await r2.locator('summary').click()
      const f2 = r2.getByTestId('vps-plan-form'); await f2.waitFor()
      const mm = f2.getByTestId('vp-mismatch')
      ok(await mm.getAttribute('data-severity') === 'warning' && /Aviso \(modo Manual/.test(await mm.innerText()), 'formulário em Manual: divergência como aviso')
      ok(/bandwidth = 4 096 000 MB/.test(await f2.getByTestId('vp-provider-raw').innerText()), 'formulário mostra o valor bruto e a unidade da Hostinger')
      await f2.getByTestId('vp-save').click(); await f2.getByTestId('vp-msg').waitFor()
      ok(/Guardado — com avisos/.test(await f2.getByTestId('vp-msg').innerText()), 'Manual: «Guardar» grava com aviso')
      await f2.getByTestId('vp-provider-mode').selectOption('auto')
      ok(await mm.getAttribute('data-severity') === 'block', 'ao mudar para Automático: a mesma divergência passa a bloquear')
      await f2.getByTestId('vp-traffic').fill('4'); await q.waitForTimeout(150)
      ok(await f2.getByTestId('vp-mismatch').count() === 0, 'com 4 TB: sem divergência no formulário')
      await f2.getByTestId('vp-traffic-unit').selectOption('TiB'); await q.waitForTimeout(150)
      ok(/4 TiB \(4,398 TB\)/.test(await f2.getByTestId('vp-mismatch').innerText()), 'rótulos GiB/TiB (binários) convertidos antes de comparar')
      await f2.getByTestId('vp-traffic-unit').selectOption('TB')
      await q.addStyleTag({ content: 'header, [class*=sticky], [class*=fixed] { position: relative !important }' })
      await q.setViewportSize({ width: 1440, height: 3000 }); await f2.getByTestId('vp-provider').scrollIntoViewIfNeeded()
      await f2.getByTestId('vp-provider-mode').selectOption('manual')
      await f2.getByTestId('vp-traffic').fill('8'); await q.waitForTimeout(200)
      await f2.getByTestId('vp-provider').screenshot({ path: `${OUT}/painel-05-kvm1-aviso-manual.png` })
      await c4.close()
    }
    // Repor p2 para o resto do ensaio (sem associação)
    u = await adm.req(API, { method: 'PUT', body: { ...asInput(p2), providerProductId: null, providerMode: 'manual', providerSpecs: null } })
    ok(u.status === 200, 'plano reposto sem associação', u.json?.error)
    await bad({ specs: specs2, providerProductId: 'hostingercom-vps-kvm2', providerSpecs: kvm2.specs, providerMode: 'auto' }, { monthly: { providerItemId: 'hostingercom-vps-kvm2-usd-1m' } }, 'provider-monthly', 'automático sem custo/limite')
    await bad({ specs: specs2, providerProductId: 'hostingercom-vps-kvm2', providerSpecs: kvm2.specs, providerMode: 'auto' }, { monthly: { providerItemId: 'hostingercom-vps-kvm2-usd-1m', providerCostMinor: 699, providerCurrency: 'USD', providerCostLimitMinor: 500 } }, 'provider-monthly', 'limite de custo inferior ao custo')
    await bad({ providerProductId: 'x; DROP' }, {}, 'providerProductId', 'produto da Hostinger inválido')

    // ── 5. Painel: edição do plano principal (formulário) ──
    console.log('\n5. Painel: editar ficha, ícones, descontos, associação e pré-visualização')
    // Base: ficha + associação por API (rápido); o formulário altera desconto, selo e característica
    const kItem = m => kvm2.prices.find(x => x.period === m)
    // A Hostinger só vende KVM 2 a 1, 12 e 24 meses: os outros ciclos deixam de ser publicados neste plano
    const per1 = { monthly: { discount: 0, publish: true }, '1year': { discount: 20, publish: true }, '2years': { discount: 30, publish: true } }
    for (const [c, m] of [['monthly', 1], ['1year', 12], ['2years', 24]]) { const it = kItem(m); Object.assign(per1[c], { providerItemId: it.id, providerCostMinor: it.first_period_price ?? it.price, providerCurrency: 'USD', providerCostLimitMinor: Math.ceil((it.first_period_price ?? it.price) * 1.1) }) }
    r = await adm.req(API, { method: 'PUT', body: asInput(p1, { specs: specs2, features: [{ text: 'Acesso root total', icon: 'terminal' }, { text: 'Backups semanais', icon: 'backup' }, { text: 'Protecção DDoS', icon: 'shield' }],
      providerProductId: 'hostingercom-vps-kvm2', providerSpecs: kvm2.specs, providerMode: 'auto', badge: null }, per1) })
    ok(r.status === 200, 'plano associado ao produto exacto KVM 2, modo automático, custos e limites por ciclo', r.json?.error)
    let { ctx, p } = await ctxFor(b, DESKTOP, adm.cookie)
    await p.goto(BASE + '/admin/site/catalog?cat=vps', { waitUntil: 'domcontentloaded' })
    const row = p.locator(`[data-testid=vps-plan-admin][data-slug="${p1.slug}"]`); await row.waitFor()
    await row.locator('summary').click()
    const form = row.getByTestId('vps-plan-form'); await form.waitFor()
    await form.getByTestId('vp-badge').fill('Mais popular')
    await form.getByTestId('vp-discount-1year').fill('25')
    const base1 = Number(p1.baseMonthly)
    await p.waitForTimeout(200)
    ok(num(await form.getByTestId('vp-total-1year').innerText()) === totalOf(base1, 12, 25), `total de 1 ano recalculado no formulário (${await form.getByTestId('vp-total-1year').innerText()})`)
    await form.getByTestId('vp-add-feature').click()
    await form.getByTestId('vp-feature-text').last().fill('Painel de controlo')
    await form.getByTestId('vp-feature-icon').last().selectOption('panel')
    const iconOpts = await form.getByTestId('vp-feature-icon').first().locator('option').evaluateAll(o => o.map(x => x.value).filter(Boolean))
    ok(iconOpts.length === 14 && iconOpts.includes('shield') && !iconOpts.includes('skull'), `ícones de uma lista controlada (${iconOpts.length})`)
    await form.getByTestId('vp-preview-1year').click()
    const prev = form.getByTestId('vp-preview')
    ok(/Poupe 25%/i.test(await prev.innerText()) && /Mais popular/i.test(await prev.innerText()), 'pré-visualização: selo «Mais popular», «Poupe 25%»')
    ok(num(await prev.getByTestId('vps-plan-total').innerText()) === totalOf(base1, 12, 25) && /renova/i.test(await prev.getByTestId('vps-plan-renewal').innerText()), 'pré-visualização: total e preço de renovação')
    ok(/KVM 2/.test(await form.getByTestId('vp-provider').innerText()) && await form.getByTestId('vp-mismatch').count() === 0, 'associação Hostinger KVM 2 sem divergências')
    await p.addStyleTag({ content: 'header, [class*=sticky], [class*=fixed] { position: relative !important }' })
    // O painel desloca-se num contentor interno: viewport alto para a ficha caber sem deslocamento
    await p.setViewportSize({ width: 1440, height: 3000 }); await form.scrollIntoViewIfNeeded(); await p.waitForTimeout(300)
    await form.screenshot({ path: `${OUT}/painel-01-editor-plano.png` })
    await p.setViewportSize({ width: 1440, height: 900 })
    await form.getByTestId('vp-vcpu').fill('4')
    ok(await form.getByTestId('vp-mismatch').isVisible(), 'aviso imediato quando as características não correspondem ao produto')
    await form.getByTestId('vp-save').click()
    await form.getByTestId('vp-msg').waitFor()
    ok(/não correspondem/.test(await form.getByTestId('vp-msg').innerText()), 'guardar com características divergentes é recusado pelo servidor')
    await form.getByTestId('vp-vcpu').fill('2')
    await form.getByTestId('vp-save').click()
    await p.waitForFunction(() => /Guardado/.test(document.querySelector('[data-testid=vp-msg]')?.textContent ?? '') || document.querySelectorAll('[data-testid=vps-plan-form]').length === 0, null, { timeout: 10000 }).catch(() => {})
    let pl = (await plans()).find(x => x.id === p1.id)
    const y1 = pl.periods.find(x => x.cycle === '1year')
    ok(pl.badge === 'Mais popular' && y1.discount === 25 && y1.price === totalOf(base1, 12, 25) && y1.matchesRule, `gravado: selo e 1 ano = ${y1.price} Kz (25%)`)
    ok(pl.features.length === 4 && pl.features[3].icon === 'panel' && pl.features[0].icon === 'terminal', 'características extra com ícones, pela ordem')
    const act = await one("SELECT COUNT(*) n FROM activity_logs WHERE entity_type = 'product' AND entity_id = ? AND created_at >= ?", [p1.id, START])
    ok(Number(act.n) >= 1, 'alteração registada no histórico (activity_logs)')
    // Imagem do plano
    // Imagem de ensaio gerada no navegador (PNG real, 640×480)
    const ip = await b.newPage({ viewport: { width: 640, height: 480 } })
    await ip.setContent('<body style="margin:0"><div style="width:640px;height:480px;background:linear-gradient(135deg,#0B0B0D,#1F2937);display:flex;align-items:center;justify-content:center"><svg width="220" height="220" viewBox="0 0 24 24" fill="none" stroke="#F5B700" stroke-width="1.5"><rect x="2" y="3" width="20" height="7" rx="2"/><rect x="2" y="14" width="20" height="7" rx="2"/><circle cx="6" cy="6.5" r="1" fill="#F5B700"/><circle cx="6" cy="17.5" r="1" fill="#F5B700"/></svg></div></body>')
    const png = await ip.screenshot({ type: 'png' }); await ip.close()
    const fd = new FormData(); fd.append('productId', p1.id); fd.append('file', new Blob([png], { type: 'image/png' }), 'vps.png')
    r = await fetch(BASE + API + '/image', { method: 'POST', headers: { cookie: adm.cookie }, body: fd })
    ok(r.status === 200, 'imagem do plano carregada (PNG validado pelo conteúdo)')
    const fd2 = new FormData(); fd2.append('productId', p1.id); fd2.append('file', new Blob([Buffer.from('<svg onload=alert(1)>')], { type: 'image/png' }), 'x.png')
    ok((await fetch(BASE + API + '/image', { method: 'POST', headers: { cookie: adm.cookie }, body: fd2 })).status === 400, 'ficheiro que não é imagem → 400')

    // Ordem e publicação a partir da lista
    await p.reload({ waitUntil: 'domcontentloaded' })
    await p.locator(`[data-testid=vps-plan-admin][data-slug="${p3.slug}"]`).waitFor()
    await p.locator(`[data-testid=vps-plan-admin][data-slug="${p3.slug}"]`).getByTestId('vps-up').click()
    await p.waitForTimeout(800)
    let order = (await plans()).map(x => x.slug)
    ok(order.indexOf(p3.slug) < order.indexOf(p2.slug), `ordem alterada no painel (${order.join(' → ')})`)
    await p.locator(`[data-testid=vps-plan-admin][data-slug="${p3.slug}"]`).getByTestId('vps-toggle-publish').click()
    await p.waitForTimeout(800)
    ok((await plans()).find(x => x.id === p3.id).saleStatus === 'draft', `${p3.slug} despublicado`)
    await p.locator('[data-testid=vps-plans-editor]').screenshot({ path: `${OUT}/painel-02-lista-planos.png` })
    await ctx.close()

    // ── 6. Página pública (desktop) ──
    console.log('\n6. /servidor-vps (desktop)')
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/servidor-vps', { waitUntil: 'domcontentloaded' })
    const band = p.locator(`[data-testid=vps-plan][data-slug="${p1.slug}"]`); await band.waitFor()
    const slugs = await p.locator('[data-testid=vps-plan]').evaluateAll(x => x.map(e => e.getAttribute('data-slug')))
    ok(!slugs.includes(p3.slug) && slugs.includes(p2.slug), `só planos publicados (${slugs.join(', ')})`)
    const [bi, bs, bc] = await Promise.all([band.getByTestId('vps-plan-image').boundingBox(), band.getByTestId('vps-spec-vcpu').boundingBox(), band.getByTestId('vps-plan-cta').boundingBox()])
    ok(bi && bs && bc && bi.x < bs.x && bs.x < bc.x && Math.abs((bi.y + bi.height / 2) - (bc.y + bc.height / 2)) < 160, 'faixa horizontal: imagem à esquerda, características ao centro, preço e botão à direita')
    for (const k of ['vcpu', 'ram', 'disk', 'traffic']) {
      const sp = band.getByTestId(`vps-spec-${k}`)
      ok(await sp.locator('svg').count() >= 1 && (await sp.innerText()).trim().length > 2, `ícone + texto: ${(await sp.innerText()).replace(/\s+/g, ' ').trim()}`)
    }
    ok(await band.getByTestId('vps-plan-feature').count() === 4 && await band.locator('[data-testid=vps-plan-feature][data-icon=terminal] svg').count() === 1, 'características extra com os ícones escolhidos')
    ok((await band.getByTestId('vps-plan-badge').textContent()) === 'Mais popular' && await p.locator('[data-testid=vps-plan-badge]').count() === (await plans()).filter(x => x.badge && x.saleStatus === 'active').length, 'selos só nos planos em que o administrador os configurou')
    ok(/^Configurar VPS$/.test((await band.getByTestId('vps-plan-cta').innerText()).trim()), 'botão «Configurar VPS»')
    await p.getByTestId('vps-period-1year').click()
    await p.waitForTimeout(200)
    const listTxt = await band.getByTestId('vps-plan-list').innerText().catch(() => '')
    ok(num(listTxt) === base1 && num(await band.getByTestId('vps-plan-monthly').innerText()) === Math.round(totalOf(base1, 12, 25) / 12 * 100) / 100 && await band.getByTestId('vps-plan-list').evaluate(e => getComputedStyle(e).textDecorationLine.includes('line-through')), `preço mensal original riscado (${listTxt} → ${await band.getByTestId('vps-plan-monthly').innerText()}/mês)`)
    ok(/Poupe 25%/.test(await band.getByTestId('vps-plan-discount').innerText()), '«Poupe 25%» com desconto')
    ok(num(await band.getByTestId('vps-plan-total').innerText()) === totalOf(base1, 12, 25), `total a pagar ${await band.getByTestId('vps-plan-total').innerText()} (preço do catálogo)`)
    ok(/1 ano/.test(await band.getByTestId('vps-plan-period').innerText()), 'período indicado')
    await p.getByTestId('vps-period-monthly').click(); await p.waitForTimeout(150)
    ok(await band.getByTestId('vps-plan-discount').count() === 0 && await band.getByTestId('vps-plan-list').count() === 0, 'sem desconto: sem preço riscado nem «Poupe»')
    await p.getByTestId('vps-period-1year').click(); await p.waitForTimeout(150)
    await p.locator('[data-testid=vps-plan]').first().scrollIntoViewIfNeeded()
    await p.screenshot({ path: `${OUT}/desktop-01-servidor-vps.png` })
    await band.screenshot({ path: `${OUT}/desktop-02-faixa-plano.png` })
    ok(p.errors.length === 0, 'sem erros na página', p.errors.join(' | '))
    // «Comprar agora» noutras páginas comerciais (o destino mantém-se)
    for (const [path, tid] of [['/hospedagem-de-sites', 'hosting-plan-card'], ['/email-corporativo', 'email-plan-card']]) {
      await p.goto(BASE + path, { waitUntil: 'domcontentloaded' })
      const c = p.locator(`[data-testid=${tid}]`).first(); await c.waitFor()
      const a = c.getByRole('link', { name: 'Comprar agora' })
      ok(await a.count() === 1 && /^\/comprar\//.test(await a.getAttribute('href')) && !/Configurar/.test(await c.innerText()), `${path}: «Comprar agora» → ${await a.getAttribute('href')}`)
    }
    await ctx.close()

    // ── 7. Telemóvel ──
    console.log('\n7. /servidor-vps (iPhone)')
    ;({ ctx, p } = await ctxFor(b, IPHONE))
    await p.goto(BASE + '/servidor-vps', { waitUntil: 'domcontentloaded' })
    const mb = p.locator(`[data-testid=vps-plan][data-slug="${p1.slug}"]`); await mb.waitFor()
    ok(await overflow(p) <= 0, `sem deslocamento horizontal (${await overflow(p)}px)`)
    const [mi, mc] = await Promise.all([mb.getByTestId('vps-plan-image').boundingBox(), mb.getByTestId('vps-plan-cta').boundingBox()])
    ok(mi && mc && mc.y > mi.y + mi.height - 1 && mc.width > 250, 'faixa em coluna: botão por baixo, largura total')
    await p.addStyleTag({ content: 'header, nav[class*=sticky], [class*=sticky] { position: relative !important }' })
    await mb.scrollIntoViewIfNeeded()
    await mb.screenshot({ path: `${OUT}/iphone-01-faixa-plano.png` })
    await p.screenshot({ path: `${OUT}/iphone-02-servidor-vps.png` })
    await ctx.close()

    // ── 8. Compra completa (cliente2, desktop): plano e período → localização e sistema → rever → pagar ──
    console.log('\n8. Compra completa com comprovativo pendente')
    await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = ?", [C2.email])
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c2.cookie))
    await p.goto(BASE + '/servidor-vps', { waitUntil: 'domcontentloaded' })
    await p.getByTestId('vps-period-1year').click()
    // O botão do plano abre agora o configurador Cloud VPS; o percurso /comprar (modo automático) é testado directamente
    ok(/\/servidor-vps\/configurar\?plano=/.test(await p.locator(`[data-testid=vps-plan][data-slug="${p1.slug}"]`).getByTestId('vps-plan-cta').getAttribute('href')), 'botão do plano → configurador Cloud VPS')
    await p.goto(`${BASE}/comprar/${p1.slug}?ciclo=1year`, { waitUntil: 'domcontentloaded' })
    ok(/ciclo=1year/.test(p.url()), 'período escolhido passa para a compra')
    await p.getByTestId(`opt-location-${LOC}`).waitFor()
    ok(/Período e instalação/.test(await p.locator('body').innerText()) && await p.getByTestId('to-options').count() === 0, 'passos: período, localização e instalação na mesma página → Rever → Pagar → Activação')
    await p.getByTestId(`opt-location-${LOC}`).waitFor()
    ok(await p.getByTestId('opt-location-17').count() === 0, 'só localizações activadas no painel')
    await p.getByTestId(`opt-location-${LOC}`).click(); await p.getByTestId(`opt-image-${IMG}`).click()
    ok(num(await p.getByTestId('flow-total').innerText()) === totalOf(base1, 12, 25), `total na compra ${await p.getByTestId('flow-total').innerText()}`)
    await p.screenshot({ path: `${OUT}/desktop-03-localizacao-sistema.png`, fullPage: true })
    await p.getByTestId('add-to-cart').click()
    await p.waitForURL('**/carrinho')
    ok(/Lisboa/.test(await p.getByTestId('line-options').first().innerText()) && /Ubuntu 24\.04/.test(await p.getByTestId('line-options').first().innerText()), `carrinho: ${await p.getByTestId('line-options').first().innerText()}`)
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento')
    await p.getByTestId('summary-total').waitFor()
    await p.locator('input[type=file]').setInputFiles({ name: 'comprovativo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ensaio') })
    await p.getByText(/Comprovativo: comprovativo.pdf/).waitFor()
    await p.locator('[data-testid=to-review]:not([disabled])').click()
    ok(/Lisboa/.test(await p.getByTestId('review-options').first().innerText()) && num(await p.getByTestId('review-total').innerText()) === totalOf(base1, 12, 25), 'revisão: localização, sistema e total')
    await p.screenshot({ path: `${OUT}/desktop-04-rever.png`, fullPage: true })
    await p.getByTestId('accept-terms').check()
    await p.getByTestId('confirm-order').dblclick()
    await p.waitForURL('**/orders/**')
    mainOrder = p.url().split('/orders/')[1].split('?')[0]
    await p.getByTestId('order-item-options').first().waitFor()
    ok(await p.getByTestId('order-proof-pending').isVisible(), 'Área do Cliente: comprovativo por validar')
    ok(/A aguardar|pagamento/i.test(await p.getByTestId('order-service-status').first().innerText()), `estado da activação separado: «${await p.getByTestId('order-service-status').first().innerText()}»`)
    await p.screenshot({ path: `${OUT}/desktop-05-encomenda-comprovativo.png`, fullPage: true })
    await ctx.close()
    const oi = await one('SELECT oi.billing_cycle, oi.months, oi.unit_price, oi.line_total, oi.options, (SELECT COUNT(*) FROM orders x WHERE x.user_id = o.user_id AND x.created_at >= ?) n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.id = ?', [START, mainOrder])
    const opts = JSON.parse(oi.options ?? '{}')
    ok(oi.billing_cycle === '1year' && Number(oi.line_total) === totalOf(base1, 12, 25) && opts.location?.id === LOC && opts.image?.id === IMG, `encomenda guarda plano, ciclo, opções e preço aceite (${oi.line_total} Kz; ${opts.location?.label} · ${opts.image?.label})`)
    ok(Number(oi.n) === 1, 'duplo clique → uma só encomenda')
    let sv = await svcOf(mainOrder)
    ok(sv.payment_status === 'proof_submitted' && sv.ps === 'pending' && !sv.op, 'antes da validação: nada é comprado na Hostinger')

    // ── 9. Validação do pagamento → compra única → VM activa ──
    console.log('\n9. Pagamento validado → compra automática (API simulada)')
    const st0 = await mockStats()
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/orders?filtro=todas&encomenda=${sv.order_number}`, { waitUntil: 'domcontentloaded' })
    let card = p.locator(`#order-${sv.order_number}`); await card.waitFor()
    ok(/Lisboa/.test(await card.getByTestId('item-options').first().innerText()), 'painel: opções do VPS na linha da encomenda')
    p.answers.push(true)
    // Concorrência: clique + duas aprovações em paralelo pela API
    await Promise.all([card.getByTestId('approve-payment').click(), adminAct({ action: 'approve', orderId: mainOrder }), adminAct({ action: 'approve', orderId: mainOrder })])
    await p.locator('[role=status]').filter({ hasText: /Pagamento confirmado|confirmad/ }).waitFor({ timeout: 15000 }).catch(() => {})
    sv = await svcOf(mainOrder)
    const st1 = await mockStats()
    ok(sv.payment_status === 'paid' && Number((await one("SELECT COUNT(*) n FROM payments y JOIN invoices i ON i.id = y.invoice_id WHERE i.order_id = ? AND y.status = 'approved'", [mainOrder])).n) === 1, 'três validações em paralelo → um só pagamento aprovado')
    ok(st1.vpsPurchaseCalls - st0.vpsPurchaseCalls === 1 && await purchasesFor(sv) === 1, `uma só compra na Hostinger (${st1.vpsPurchaseCalls - st0.vpsPurchaseCalls} pedido)`)
    const sent = st1.vpsLastBody
    ok(sent && JSON.stringify(Object.keys(sent).sort()) === JSON.stringify(['item_id', 'payment_method_id', 'setup']) && JSON.stringify(Object.keys(sent.setup).sort()) === JSON.stringify(['data_center_id', 'hostname', 'template_id']),
      `só o produto e os parâmetros necessários: ${JSON.stringify(sent)}`)
    ok(sent.item_id === 'hostingercom-vps-kvm2-usd-12m' && sent.payment_method_id === 7001 && String(sent.setup.data_center_id) === LOC && String(sent.setup.template_id) === IMG, 'item do ciclo de 1 ano, método da conta, Lisboa e Ubuntu')
    ok(!/ensaio\.test|cliente|comprovativo|@/i.test(JSON.stringify(sent).replace(/srv\.ensaio\.test/, '')) && !st1.vpsPasswordSent, 'sem e-mail, nome, comprovativo nem palavra-passe do cliente no pedido')
    ok(Number(sv.expected_cost_minor) === 8388 && Number(sv.cost_limit_minor) === Math.ceil(8388 * 1.1), `custo esperado e limite guardados (${sv.expected_cost_minor} / ${sv.cost_limit_minor} cêntimos USD)`)
    ok(['submitted', 'active'].includes(sv.op) && sv.vm, `operação registada com a VM ${sv.vm} (${sv.op})`)
    await p.reload({ waitUntil: 'domcontentloaded' }); card = p.locator(`#order-${sv.order_number}`); await card.waitFor()
    if (sv.ps !== 'active') ok(/A criar|Comprado|aguardar|in_progress|Em activação/i.test(await card.innerText()), 'painel: VPS em activação enquanto a VM é criada')
    const fin = await waitActive(sv.id)
    sv = await svcOf(mainOrder)
    ok(fin && sv.ps === 'active' && sv.status === 'active' && /^VM \d+ · \d+\.\d+\.\d+\.\d+$/.test(sv.external_ref), `VM «running» → serviço activo (${sv.external_ref})`)
    ok(sv.activation_status === 'active' || sv.activation_status === 'completed', `encomenda: activação concluída (${sv.activation_status})`)
    await p.reload({ waitUntil: 'domcontentloaded' }); card = p.locator(`#order-${sv.order_number}`); await card.waitFor()
    ok((await card.getByTestId('vps-op').getAttribute('data-status')) === 'active' && /purchase_sent[\s\S]*purchase_ok[\s\S]*vm_running/.test(await card.getByTestId('vps-events').textContent().catch(() => '')), 'painel: operação Hostinger e histórico de eventos')
    await card.screenshot({ path: `${OUT}/painel-03-encomenda-vps-activa.png` })
    ok((await purchasesFor(sv)) === 1, 'depois da conciliação continua a haver uma só compra')
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, IPHONE, c2.cookie))
    await p.goto(`${BASE}/orders/${mainOrder}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('order-service-status').first().waitFor()
    ok(/Activo|activo/.test(await p.getByTestId('order-service-status').first().innerText()) && await overflow(p) <= 0, `Área do Cliente (iPhone): «${await p.getByTestId('order-service-status').first().innerText()}»`)
    await p.screenshot({ path: `${OUT}/iphone-03-encomenda-activa.png`, fullPage: true })
    await ctx.close()

    // ── 10. Cenários do fornecedor (plano de ensaio associado a «hostingercom-vps-ensaio») ──
    console.log('\n10. Fornecedor: recusa, resposta perdida/lenta, 202, custo acima do limite')
    const ens = prov.items.find(i => i.id === 'hostingercom-vps-ensaio')
    const scen = sc => ({ monthly: { discount: 0, publish: true, providerItemId: `hostingercom-vps-ensaio-${sc}-usd-1m`, providerCostMinor: 699, providerCurrency: 'USD', providerCostLimitMinor: 800 } })
    r = await adm.req(API, { method: 'POST', body: { name: `VPS Ensaio Cenários ${randomUUID().slice(0, 4)}`, saleStatus: 'active', position: 900, baseMonthly: 15000, specs: specs2, features: [],
      providerProductId: 'hostingercom-vps-ensaio', providerSpecs: ens.specs, providerMode: 'auto', periods: [{ cycle: 'monthly', ...scen('recusa').monthly }] } })
    ok(r.status === 200 || r.status === 201, 'plano de cenários criado', r.json?.error)
    created = (await plans()).find(x => x.name.startsWith('VPS Ensaio Cenários'))
    const setScen = async sc => { const x = await adm.req(API, { method: 'PUT', body: asInput((await plans()).find(y => y.id === created.id), {}, scen(sc)) }); if (x.status !== 200) throw new Error(`cenário ${sc}: ${x.json?.error}`) }

    // Recusa (422): nada comprado
    let s0 = await mockStats()
    let o = await buyAndApprove(c1, created.slug)
    sv = await svcOf(o.id)
    ok(sv.payment_status === 'paid' && sv.ps === 'failed' && sv.op === 'failed' && /recusou/.test(sv.pe), `recusa → «${sv.pe.slice(0, 80)}…»`)
    ok((await mockStats()).vpsPurchaseCalls - s0.vpsPurchaseCalls === 1 && await purchasesFor(sv) === 0, 'recusa: um pedido, nenhuma compra')
    ok(sv.payment_status === 'paid', 'pagamento do cliente mantém-se validado (estados separados)')

    // Resposta perdida (sem compra): revisão manual, sem nova tentativa automática
    await setScen('perdido')
    s0 = await mockStats()
    o = await buyAndApprove(c1, created.slug)
    sv = await svcOf(o.id)
    ok(sv.ps === 'manual_required' && sv.op === 'unknown' && /por confirmar/.test(sv.pe), `sem resposta → revisão manual («${sv.pe.slice(0, 70)}…»)`)
    await adminAct({ action: 'provision', serviceId: sv.id }); await adminAct({ action: 'vps_reconcile', serviceId: sv.id })
    r = await adm.req('/api/cron/vps-sync', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    ok(r.status === 200 && Array.isArray(r.json?.results), `cron de conciliação (${r.json?.results?.length} operação(ões) em aberto)`)
    ok((await mockStats()).vpsPurchaseCalls - s0.vpsPurchaseCalls === 1, '«Repetir», «Consultar» e cron não voltam a comprar')
    r = await adminAct({ action: 'vps_confirm_not_purchased', serviceId: sv.id, notes: 'x' })
    ok(r.status >= 400, 'confirmar «não comprado» exige descrição da verificação')
    await setScen('lento')
    r = await adminAct({ action: 'vps_confirm_not_purchased', serviceId: sv.id, notes: 'Verificado no hPanel: sem encomenda nem VM.' })
    sv = await svcOf(o.id)
    ok((await mockStats()).vpsPurchaseCalls - s0.vpsPurchaseCalls === 2 && Number(sv.attempts) === 2, 'depois da verificação da equipa: uma nova tentativa (registada no histórico)')

    // Lenta (compra feita, resposta depois do tempo limite): concilia pela VM, sem segunda compra
    ok(['in_progress', 'active'].includes(sv.ps) && await purchasesFor(sv) === 1, `resposta lenta → conciliada pela VM (${sv.ps}, op ${sv.op})`)
    await waitActive(sv.id)
    sv = await svcOf(o.id)
    ok(sv.ps === 'active' && await purchasesFor(sv) === 1, 'resposta lenta: VM activa, uma só compra')
    const evs = (await all('SELECT event FROM vps_provider_events e JOIN vps_provider_orders v ON v.id = e.provider_order_id WHERE v.service_id = ? ORDER BY e.created_at', [sv.id])).map(x => x.event)
    ok(evs.includes('purchase_unknown') && evs.includes('confirmed_not_purchased') && evs.includes('vm_running'), `histórico: ${evs.join(' → ')}`)

    // 202: pagamento ao fornecedor em processamento → VM «initial» → /setup uma vez
    await setScen('pagamento')
    s0 = await mockStats()
    o = await buyAndApprove(c1, created.slug)
    sv = await svcOf(o.id)
    ok(sv.ps === 'in_progress' && sv.op === 'payment_processing', `202 → «${sv.pe}»`)
    const sub = (await one('SELECT provider_subscription_id s FROM vps_provider_orders WHERE service_id = ?', [sv.id])).s
    await adminAct({ action: 'vps_reconcile', serviceId: sv.id })
    ok((await svcOf(o.id)).ps === 'in_progress', 'antes do pagamento ao fornecedor: continua em activação')
    ok((await mockPost(`/_vps_pay?subscription=${encodeURIComponent(sub)}`)).status === 200, 'simulador: pagamento ao fornecedor concluído (VM «initial»)')
    await db.query('UPDATE vps_provider_orders SET locked_until = NULL WHERE service_id = ?', [sv.id])
    await Promise.all([adminAct({ action: 'vps_reconcile', serviceId: sv.id }), adminAct({ action: 'vps_reconcile', serviceId: sv.id }), adm.req('/api/cron/vps-sync', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })])
    ok((await mockStats()).vpsSetups - s0.vpsSetups === 1, 'conciliações em paralelo → /setup enviado uma só vez')
    await waitActive(sv.id)
    sv = await svcOf(o.id)
    ok(sv.ps === 'active' && (await mockStats()).vpsPurchaseCalls - s0.vpsPurchaseCalls === 1 && await purchasesFor(sv) === 1, 'VM configurada e activa; uma só compra')

    // Custo acima do limite → tarefa manual, sem compra
    await setScen('caro')
    s0 = await mockStats()
    o = await buyAndApprove(c1, created.slug)
    sv = await svcOf(o.id)
    ok(sv.ps === 'manual_required' && /acima do limite/.test(sv.pe) && (await mockStats()).vpsPurchaseCalls === s0.vpsPurchaseCalls, `custo acima do limite → «${sv.pe.slice(0, 90)}…» (sem compra)`)

    // ── 11. Concorrência: duas encomendas iguais, aprovações e conciliações em paralelo ──
    console.log('\n11. Concorrência sem dupla compra')
    s0 = await mockStats()
    const qa = await quote(c1, [vpsLine(p1.slug)])
    const [oa, ob] = await Promise.all([placeOrder(c1, [vpsLine(p1.slug)], qa.quote.total), placeOrder(c1, [vpsLine(p1.slug)], qa.quote.total)])
    const ids = [oa.json?.order?.id, ob.json?.order?.id]
    ok(ids[0] && ids[1] && ids[0] !== ids[1], 'duas encomendas iguais (itens distintos)')
    await Promise.all(ids.flatMap(id => [adminAct({ action: 'approve', orderId: id }), adminAct({ action: 'approve', orderId: id })]))
    const svs = await Promise.all(ids.map(svcOf))
    await Promise.all(svs.flatMap(x => [adminAct({ action: 'provision', serviceId: x.id }), adminAct({ action: 'vps_reconcile', serviceId: x.id })]))
    const s1 = await mockStats()
    ok(s1.vpsPurchaseCalls - s0.vpsPurchaseCalls === 2, `${s1.vpsPurchaseCalls - s0.vpsPurchaseCalls} compras para 2 itens (uma por item)`)
    ok((await Promise.all(svs.map(purchasesFor))).every(n => n === 1) && new Set(svs.map(x => JSON.parse(x.request).hostname)).size === 2, 'cada item com o seu hostname e exactamente uma compra')
    for (const x of svs) await waitActive(x.id)

    // ── 12. Fluxo manual ──
    console.log('\n12. Fluxo manual: tarefa da equipa e «Associar VPS…»')
    r = await adm.req(INT, { method: 'POST', body: { autoProvision: false } })
    ok(r.json?.settings?.autoProvision === false, 'aprovisionamento automático desactivado')
    s0 = await mockStats()
    o = await buyAndApprove(c2, p1.slug)
    sv = await svcOf(o.id)
    ok(sv.payment_status === 'paid' && sv.ps === 'manual_required' && /^Tarefa da equipa: preparar o VPS/.test(sv.pe) && /Lisboa/.test(sv.pe) && (await mockStats()).vpsPurchaseCalls === s0.vpsPurchaseCalls, `tarefa no painel, sem compra: «${sv.pe.slice(0, 100)}…»`)
    ;({ ctx, p } = await ctxFor(b, IPHONE, c2.cookie))
    await p.goto(`${BASE}/orders/${o.id}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('order-service-status').first().waitFor()
    ok(/Activação em tratamento pela equipa/.test(await p.getByTestId('order-service-status').first().innerText()), 'cliente informado: «Activação em tratamento pela equipa»')
    ok(!/Tarefa da equipa|Hostinger/.test(await p.locator('main').innerText()), 'sem detalhes internos do fornecedor para o cliente')
    await p.screenshot({ path: `${OUT}/iphone-04-activacao-manual.png`, fullPage: true })
    await ctx.close()
    // A equipa compra no hPanel (simulador) e associa
    const man = await mockPost('/api/vps/v1/virtual-machines', { item_id: 'hostingercom-vps-kvm2-usd-1m', setup: { template_id: 1130, data_center_id: 21, hostname: `manual-${randomUUID().slice(0, 6)}.srv.ensaio.test` } })
    const vmId = String(man.json?.virtual_machine?.id)
    await sleep(3200)
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/orders?filtro=vps`, { waitUntil: 'domcontentloaded' })
    card = p.locator(`#order-${sv.order_number}`); await card.waitFor()
    ok(/Tarefa da equipa/.test(await card.innerText()), 'filtro «VPS: tarefas e compras» mostra a tarefa')
    await card.screenshot({ path: `${OUT}/painel-04-tarefa-manual.png` })
    const used = (await one("SELECT provider_vm_id v FROM vps_provider_orders WHERE status = 'active' AND provider_vm_id IS NOT NULL LIMIT 1")).v
    r = await adminAct({ action: 'vps_link', serviceId: sv.id, vmId: used })
    ok(r.status >= 400 && /outro serviço/.test(r.json?.error), 'VM já associada a outro serviço → recusada')
    p.answers.push(vmId)
    await card.getByTestId('vps-link').click()
    await p.locator('[role=status]').first().waitFor({ timeout: 10000 }).catch(() => {})
    await p.waitForTimeout(800)
    sv = await svcOf(o.id)
    ok(sv.ps === 'active' && sv.op === 'active' && sv.external_ref.startsWith(`VM ${vmId}`), `VM ${vmId} associada pela equipa → serviço activo (${sv.external_ref})`)
    await ctx.close()

    // ── 13. Preço alterado e opções inválidas ──
    console.log('\n13. Revalidação no servidor')
    const q1 = await quote(c1, [vpsLine(p1.slug, '1year')])
    pl = (await plans()).find(x => x.id === p1.id)
    await adm.req(API, { method: 'PUT', body: asInput(pl, {}, { '1year': { discount: 10 } }) })
    r = await placeOrder(c1, [vpsLine(p1.slug, '1year')], q1.quote.total)
    ok(r.status === 409 && r.json?.code === 'price_changed', `total mudou → 409 «${r.json?.error}» (pede reconfirmação)`)
    let q = await quote(c1, [vpsLine(p1.slug, 'monthly', { location: '17', image: IMG })])
    ok(q?.quote?.lines?.[0]?.error?.code === 'options_invalid' || /indisponível/.test(JSON.stringify(q)), 'localização desactivada → recusada')
    q = await quote(c1, [vpsLine(p1.slug, 'monthly', null)])
    ok(/Escolha a localização/.test(JSON.stringify(q)), 'sem localização/sistema → pedido ao cliente')

    // ── 14. Âmbito ──
    console.log('\n14. Âmbito')
    ok((await otherState()) === otherBefore, 'outros produtos e preços (incl. VPS n8n/Evolution/AI/OpenClaw) inalterados')
    ok((await oldOrders()) === ordersBefore, 'encomendas anteriores inalteradas')
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
      await db.query(`DELETE FROM product_features WHERE product_id IN ${inV}`, vpsIds)
      for (const x of snapFeatures) { const k = Object.keys(x); await db.query(`INSERT INTO product_features (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query('DELETE FROM vps_provider_settings')
      for (const x of snapSettings) { const k = Object.keys(x); await db.query(`INSERT INTO vps_provider_settings (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email IN (?, ?)", [C1.email, C2.email])
      await db.commit()
      await fetch(BASE + '/api/products?category=vps').catch(() => {})
      const key = x => `${x.product_id}|${x.cycle}|${Number(x.price)}|${Number(x.renewal_price)}|${x.active}|${x.discount_pct}`
      const now = (await all(`SELECT product_id, cycle, price, renewal_price, active, discount_pct FROM product_prices WHERE product_id IN ${inV}`, vpsIds)).map(key).sort()
      ok(JSON.stringify(now) === JSON.stringify(snapPrices.map(key).sort()), 'planos VPS e integração repostos como estavam')
    } catch (e) { await db.rollback().catch(() => {}); ok(false, 'reposição (transacção desfeita)', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}${mainOrder ? ` · encomenda de ensaio: ${mainOrder}` : ''}`)
    process.exit(fail ? 1 : 0)
  }
})()
