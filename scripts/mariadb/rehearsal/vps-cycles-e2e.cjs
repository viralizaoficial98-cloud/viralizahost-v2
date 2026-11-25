// VPS: ciclos de 3 meses, 6 meses e 3 anos retirados das novas compras (à venda: 1 mês, 1 ano e 2 anos) (painel, pré-visualização, página, compra, carrinho, checkout e
// servidor), preservando encomendas/renovações; KVM 2 com ciclos sem item de preço da Hostinger do mesmo período
// (guardados como não publicados; publicação automática bloqueada; item de outro período recusado).
// Ensaio, API Hostinger simulada (mock-hostinger.mjs: KVM 2 só tem itens de 1, 12 e 24 meses). Repõe tudo no fim.
//   BASE_URL=http://localhost:3000 OUT=/tmp/vps-ciclos node --env-file=.env.local scripts/mariadb/rehearsal/vps-cycles-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MOCK = process.env.HOSTINGER_MOCK || 'http://127.0.0.1:12091'
const OUT = process.env.OUT || './ui-shots-vps-ciclos'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json }
  }
}
async function ctxFor(b, opts, cookie, initCart) {
  const ctx = await b.newContext({ ...opts })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  if (initCart) await ctx.addInitScript(c => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('viralizahost-cart-v2', c); sessionStorage.setItem('seeded', '1') } }, initCart)
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message))
  return { ctx, p }
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  // Cloud VPS (migração 24): compra directa = modo comercial «automático». Este ensaio cobre esse modo; o modo
  // «solicitação mediante aprovação» é coberto por cloud-vps-e2e.cjs. Repõe o modo no fim.
  const cvModeBefore = (await db.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(options, '$.commercialMode')) m FROM vps_provider_settings WHERE id = 1"))[0][0]?.m ?? null
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const val = v => (v != null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v)
  const vpsIds = (await all("SELECT id FROM products WHERE category = 'vps' AND subcategory IS NULL")).map(r => r.id)
  const inV = `(${vpsIds.map(() => '?').join(',')})`
  const snapProducts = await all(`SELECT * FROM products WHERE id IN ${inV}`, vpsIds)
  const snapPrices = await all(`SELECT * FROM product_prices WHERE product_id IN ${inV}`, vpsIds)
  const snapFeatures = await all(`SELECT * FROM product_features WHERE product_id IN ${inV}`, vpsIds)
  const snapSettings = await all('SELECT * FROM vps_provider_settings')
  // (depois da cópia da configuração: a reposição final devolve o modo comercial original)
  await db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', 'automatic') WHERE id = 1")
  const START = (await one('SELECT DATE_FORMAT(NOW(6), "%Y-%m-%d %H:%i:%s.%f") t')).t
  const history = async () => JSON.stringify([
    await all('SELECT id, status, payment_status, amount FROM orders WHERE created_at < ? ORDER BY id', [START]),
    await all('SELECT order_id, billing_cycle, months, unit_price, line_total FROM order_items WHERE created_at < ? ORDER BY id', [START]).catch(() => all('SELECT order_id, billing_cycle, months, unit_price, line_total FROM order_items ORDER BY id')),
    await all('SELECT id, status, total, amount_paid FROM invoices WHERE created_at < ? ORDER BY id', [START]),
    await all('SELECT id, status, billing_cycle, renewal_price, next_due_date FROM services WHERE created_at < ? ORDER BY id', [START]),
  ])
  const historyBefore = await history()
  const adm = new S(), c1 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const API = '/api/admin/catalog/vps-plans', INT = '/api/admin/integrations/hostinger-vps'
  const plans = async () => (await adm.req(API)).json.plans
  const b = await chromium.launch()
  const fixtures = []
  try {
    const pl = await plans()
    const p1 = pl.find(p => p.slug === 'vps-nvme2') ?? pl[0], p2 = pl.find(p => p.slug === 'vps-nvme4') ?? pl[1]
    const line = (slug, cycle) => ({ type: 'product', slug, cycle, quantity: 1, options: { location: '21', image: '1130' } })

    const RETIRED = [['3months', '3 meses'], ['6months', '6 meses'], ['3years', '3 anos']]
    const FOR_SALE = ['monthly', '1year', '2years']

    // ── 1. Migrações 20 e 21 ──
    console.log('\n1. Migrações: 3 meses, 6 meses e 3 anos despublicados, linhas preservadas')
    for (const [c, l] of RETIRED) {
      const rr = await all("SELECT pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NULL AND pp.cycle = ?", [c])
      ok(rr.length > 0 && rr.every(r => Number(r.active) === 0), `planos VPS: ${rr.length} preço(s) de ${l} guardados e despublicados`)
    }
    const subR = await all("SELECT pp.cycle, pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NOT NULL AND pp.cycle IN ('3months','6months','3years')")
    ok(subR.every(r => Number(r.active) === 1) || !subR.length, `VPS com subcategoria (n8n, Evolution…) não afectados (${subR.length} preços activos)`)
    const others = await all("SELECT p.category, pp.cycle, COUNT(*) n FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE NOT (p.category = 'vps' AND p.subcategory IS NULL) AND pp.cycle IN ('6months','3years') AND pp.active = 1 GROUP BY 1, 2")
    ok(others.length > 0, `restantes produtos mantêm 6 meses/3 anos (${others.map(x => `${x.category} ${x.cycle}: ${x.n}`).join('; ')})`)

    // ── 2. Painel, pré-visualização, página e compra ──
    console.log('\n2. Painel, pré-visualização, página e compra: só 1 mês, 1 ano e 2 anos')
    ok(pl.every(p => JSON.stringify(p.periods.map(x => x.cycle)) === JSON.stringify(FOR_SALE)), `editor: ciclos ${FOR_SALE.join(', ')} em todos os planos`)
    let { ctx, p } = await ctxFor(b, DESKTOP, adm.cookie)
    await p.goto(BASE + '/admin/site/catalog?cat=vps', { waitUntil: 'domcontentloaded' })
    const row = p.locator(`[data-testid=vps-plan-admin][data-slug="${p1.slug}"]`); await row.waitFor()
    await row.locator('summary').click()
    const form = row.getByTestId('vps-plan-form'); await form.waitFor()
    const rows = await form.locator('[data-testid^=vp-period-]').evaluateAll(e => e.map(x => x.dataset.testid.replace('vp-period-', '')))
    const prevs = await form.locator('[data-testid^=vp-preview-]').evaluateAll(e => e.map(x => x.dataset.testid.replace('vp-preview-', '')))
    ok(JSON.stringify(rows) === JSON.stringify(FOR_SALE) && JSON.stringify(prevs) === JSON.stringify(FOR_SALE), `formulário e pré-visualização: ${rows.join(', ')}`)
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/servidor-vps', { waitUntil: 'domcontentloaded' }); await p.locator('[data-testid=vps-plan]').first().waitFor()
    const pub = await p.locator('[data-testid^=vps-period-]').evaluateAll(e => e.map(x => x.dataset.testid.replace('vps-period-', '')).filter(x => x !== 'badge'))
    ok(pub.every(c => FOR_SALE.includes(c)) && !/(3|6) meses|3 anos/.test(await p.locator('[data-testid=vps-plans-section]').innerText()), `página /servidor-vps: ${pub.join(', ')}`)
    for (const [c] of RETIRED) {
      await p.goto(`${BASE}/comprar/${p1.slug}?ciclo=${c}`, { waitUntil: 'domcontentloaded' }); await p.locator('[data-testid^=cycle-]').first().waitFor()
      const cs = await p.locator('[data-testid^=cycle-]').evaluateAll(e => e.map(x => x.dataset.testid.replace('cycle-', '')).filter(x => x !== 'discount'))
      ok(cs.every(x => FOR_SALE.includes(x)) && !cs.includes(c), `configuração da compra com ?ciclo=${c}: só ${cs.join(', ')}`)
    }
    await ctx.close()

    // ── 3. Servidor ──
    console.log('\n3. Servidor rejeita os ciclos retirados em novas compras')
    const ordersBefore = Number((await one('SELECT COUNT(*) n FROM orders')).n)
    for (const [c, l] of RETIRED) {
      const q = (await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [line(p1.slug, c)] } })).json
      ok(q?.quote?.lines?.[0]?.error?.code === 'cycle_retired' && q.quote.lines[0].cycles.every(x => FOR_SALE.includes(x.cycle)), `cotação ${l}: «${q?.quote?.lines?.[0]?.error?.message}», alternativas ${q?.quote?.lines?.[0]?.cycles?.map(x => x.cycle).join(', ')}`)
      const r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [line(p1.slug, c)], acceptedTotal: 1, paymentMethod: 'bank_transfer', proofFile: null } })
      ok(r.status >= 400, `encomenda directa com ${l} → ${r.status}`)
      const r2 = await adm.req(API, { method: 'PUT', body: { ...p1, periods: [{ cycle: c, discount: 0, publish: false }] } })
      ok(r2.status === 400 && new RegExp(`${l} deixou de estar à venda`).test(r2.json?.error), `painel: gravar ${l} → 400`)
    }
    ok(Number((await one('SELECT COUNT(*) n FROM orders')).n) === ordersBefore, 'nenhuma encomenda criada com ciclos retirados')
    const qOk = (await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: FOR_SALE.map(c => line(p1.slug, c)) } })).json
    ok(qOk?.quote?.lines?.every(x => !x.error || x.error.code === 'duplicate_line'), 'ciclos à venda continuam a cotar normalmente')

    // ── 4. Carrinho antigo ──
    console.log('\n4. Carrinho antigo com VPS de 6 meses e de 3 anos')
    const dom = `carrinho-antigo-${randomUUID().slice(0, 6)}.com`
    const cart = JSON.stringify({ state: { lines: [
      { key: 'k-6m', type: 'product', slug: p1.slug, cycle: '6months', quantity: 1, options: { location: '21', image: '1130' } },
      { key: 'k-3y', type: 'product', slug: p2.slug, cycle: '3years', quantity: 1, options: { location: '21', image: '1130' } },
      { key: 'k-dom', type: 'domain', domain: dom, operation: 'register', years: 1 }], idempotencyKey: null }, version: 0 })
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts, null, cart))
      await p.goto(BASE + '/carrinho', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('summary-total').or(p.locator('[role=alert]').first()).first().waitFor(); await p.waitForTimeout(800)
      const lines = p.getByTestId('cart-line')
      ok(await lines.count() === 3, `${label}: os três itens continuam no carrinho`)
      const l6 = lines.filter({ hasText: p1.name }).first(), l3 = lines.filter({ hasText: p2.name }).first(), ld = lines.filter({ hasText: dom }).first()
      ok(/deixou de estar disponível/.test(await l6.innerText()) && /deixou de estar disponível/.test(await l3.innerText()) && !/deixou de estar/.test(await ld.innerText()), `${label}: cada VPS (6 meses, 3 anos) indica que precisa de outro período; o domínio fica intacto`)
      ok(await p.getByTestId('finalize').isDisabled(), `${label}: «Finalizar» bloqueado até corrigir`)
      for (const [ln, c] of [[l6, '6months'], [l3, '3years']]) {
        const o = await ln.getByTestId('line-cycle').locator('option').evaluateAll(x => x.map(y => ({ v: y.value, d: y.disabled })))
        ok(o.some(x => x.v === c && x.d) && o.filter(x => !x.d).every(x => FOR_SALE.includes(x.v)), `${label}: selector do item ${c} com «escolha outro período» e só ${FOR_SALE.join('/')}`)
      }
      if (label === 'desktop') await p.screenshot({ path: `${OUT}/desktop-carrinho-antigo-6m-3a.png`, fullPage: true })
      await l6.getByTestId('line-cycle').selectOption('1year'); await p.waitForTimeout(1000)
      ok(!/deixou de estar/.test(await l6.innerText()) && /deixou de estar/.test(await l3.innerText()) && await p.getByTestId('finalize').isDisabled(), `${label}: corrigido o primeiro, o segundo continua assinalado`)
      await l3.getByTestId('line-cycle').selectOption('2years'); await p.waitForTimeout(1000)
      ok(await p.getByTestId('finalize').isEnabled() && await lines.count() === 3 && await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, `${label}: ambos corrigidos → «Finalizar»; itens mantidos; sem deslocamento horizontal`)
      await ctx.close()
    }

    // ── 5. Renovações existentes ──
    console.log('\n5. Contratos e renovações existentes (3 meses, 6 meses, 3 anos)')
    const c1id = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id
    for (const [c, l, price] of [['3months', '3 meses', 82200], ['6months', '6 meses', 156180], ['3years', '3 anos', 790000]]) {
      const id = randomUUID(); fixtures.push(id)
      await db.query("INSERT INTO services (id, profile_id, product_id, service_type, service_name, status, billing_cycle, price, renewal_price, next_due_date, provisioning_status) VALUES (?, ?, ?, 'vps', ?, 'active', ?, ?, ?, CURRENT_DATE + INTERVAL 10 DAY, 'active')", [id, c1id, p1.id, `VPS de ensaio (${l}, contratado antes)`, c, price, price])
      const q = (await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'renewal', serviceId: id }] } })).json
      ok(!q?.quote?.lines?.[0]?.error && Number(q?.quote?.lines?.[0]?.lineTotal) === price && q.quote.lines[0].cycle === c, `renovação de um VPS contratado a ${l} continua possível (${q?.quote?.lines?.[0]?.lineTotal} Kz)`, JSON.stringify(q?.quote?.lines?.[0]?.error))
    }

    // ── 6. KVM 2 com os ciclos elegíveis ──
    console.log('\n6. KVM 2: guardado com 1 mês, 1 ano e 2 anos (itens do mesmo período)')
    await adm.req(INT, { method: 'POST', body: { mode: 'test', apiUrl: MOCK, secret: 'hostinger-de-ensaio', hostnameSuffix: 'srv.ensaio.test' } })
    await adm.req(INT, { method: 'POST', body: { action: 'test' } })
    const prov = (await adm.req(`${API}?provider=1`)).json.provider
    const kvm2 = prov.items.find(i => i.id === 'hostingercom-vps-kvm2')
    const months = x => x.period_unit === 'year' ? x.period * 12 : x.period
    const it = m => kvm2.prices.find(x => months(x) === m)
    const prov1 = m => ({ providerItemId: it(m).id, providerCostMinor: it(m).first_period_price ?? it(m).price, providerCurrency: 'USD', providerCostLimitMinor: Math.ceil((it(m).first_period_price ?? it(m).price) * 1.1) })
    const specs2 = { vcpu: 2, ramGb: 8, diskGb: 100, diskType: 'NVMe', traffic: { value: 8, unit: 'TB' }, network: { value: 1, unit: 'Gbps' } }
    const body = (per, mode = 'auto') => ({ id: p2.id, name: p2.name, description: p2.description, saleStatus: p2.saleStatus, position: p2.position, badge: p2.badge, highlight: p2.highlight, baseMonthly: p2.baseMonthly,
      specs: specs2, features: p2.features, providerProductId: 'hostingercom-vps-kvm2', providerSpecs: kvm2.specs, providerMode: mode, periods: per })
    const eligible = (over = {}) => [{ cycle: 'monthly', discount: 0, publish: true, ...prov1(1), ...(over.monthly ?? {}) }, { cycle: '1year', discount: 10, publish: true, ...prov1(12), ...(over['1year'] ?? {}) }, { cycle: '2years', discount: 15, publish: true, ...prov1(24), ...(over['2years'] ?? {}) }]
    let r = await adm.req(API, { method: 'PUT', body: body(eligible()) })
    ok(r.status === 200, 'KVM 2 em activação automática guardado e publicado com 1 mês, 1 ano e 2 anos', r.json?.error)
    let saved = (await plans()).find(x => x.id === p2.id)
    ok(FOR_SALE.every(c => { const x = saved.periods.find(y => y.cycle === c); return x.active && x.providerItemId === it(c === 'monthly' ? 1 : c === '1year' ? 12 : 24).id }), 'cada ciclo com o item da Hostinger do MESMO período')
    const old = await all("SELECT cycle, price, active, provider_item_id FROM product_prices WHERE product_id = ? AND cycle IN ('3months','6months','3years') ORDER BY cycle", [p2.id])
    ok(old.length >= 1 && old.every(x => Number(x.active) === 0), `linhas retiradas guardadas e despublicadas (${old.map(x => x.cycle).join(', ')})`)
    r = await adm.req(API, { method: 'PUT', body: body(eligible({ '1year': prov1(24) })) })
    ok(r.status === 400 && /é de 24 mês\(es\); use um item de 12 mês/.test(r.json?.error), `item de 24 meses no ciclo de 1 ano → recusado: «${r.json?.error}»`)
    r = await adm.req(API, { method: 'PUT', body: body(eligible({ monthly: { providerItemId: '', providerCostMinor: '', providerCurrency: '', providerCostLimitMinor: '' } })) })
    ok(r.status === 400 && /1 mês: para publicar em activação automática falta item de preço da Hostinger de 1 mês/.test(r.json?.error), 'publicar em automático sem item → 400')
    r = await adm.req(API, { method: 'PUT', body: body(eligible({ monthly: { publish: false, providerItemId: '', providerCostMinor: '', providerCurrency: '', providerCostLimitMinor: '' } })) })
    ok(r.status === 200, 'sem item: guardado como não publicado')
    await adm.req(API, { method: 'PUT', body: body(eligible()) })

    // Falha temporária do catálogo: erro de ligação, ciclos guardados intactos
    const before = JSON.stringify(await all('SELECT cycle, price, active, provider_item_id, provider_cost_minor, provider_cost_limit_minor FROM product_prices WHERE product_id = ? ORDER BY cycle', [p2.id]))
    const apiUrl = (await one('SELECT api_url FROM vps_provider_settings WHERE id = 1')).api_url
    await db.query("UPDATE vps_provider_settings SET api_url = 'http://127.0.0.1:9' WHERE id = 1")
    r = await adm.req(API, { method: 'PUT', body: body(eligible({ '1year': { discount: 30 } })) })
    ok(r.status === 503 && r.json?.field === 'connection' && /Erro de ligação ao catálogo da Hostinger/.test(r.json?.error) && /nada foi alterado/.test(r.json?.error), `catálogo indisponível → 503 «${r.json?.error}»`)
    ok(JSON.stringify(await all('SELECT cycle, price, active, provider_item_id, provider_cost_minor, provider_cost_limit_minor FROM product_prices WHERE product_id = ? ORDER BY cycle', [p2.id])) === before, 'ciclos, preços e itens guardados sem qualquer alteração')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(BASE + '/admin/site/catalog?cat=vps', { waitUntil: 'domcontentloaded' })
    let row2 = p.locator(`[data-testid=vps-plan-admin][data-slug="${p2.slug}"]`); await row2.waitFor(); await row2.locator('summary').click()
    ok(/Erro de ligação ao catálogo da Hostinger/.test(await row2.getByTestId('vp-catalog-error').innerText()), 'editor: o erro aparece como erro de ligação')
    await row2.getByTestId('vp-save').click(); await row2.getByTestId('vp-msg').waitFor()
    ok(/Erro de ligação/.test(await row2.getByTestId('vp-msg').innerText()), 'editor: «Guardar» com o catálogo em baixo → erro de ligação, nada gravado')
    await ctx.close()
    await db.query('UPDATE vps_provider_settings SET api_url = ? WHERE id = 1', [apiUrl])

    // Editor com a ligação reposta: só os ciclos elegíveis
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(BASE + '/admin/site/catalog?cat=vps', { waitUntil: 'domcontentloaded' })
    row2 = p.locator(`[data-testid=vps-plan-admin][data-slug="${p2.slug}"]`); await row2.waitFor(); await row2.locator('summary').click()
    const f2 = row2.getByTestId('vps-plan-form'); await f2.waitFor()
    const checked = await Promise.all(FOR_SALE.map(c => f2.getByTestId(`vp-publish-${c}`).isChecked()))
    ok(await f2.locator('[data-testid^=vp-missing-]').count() === 0 && checked.every(Boolean), 'editor do KVM 2: 1 mês, 1 ano e 2 anos publicados e completos, sem avisos')
    await p.addStyleTag({ content: 'header, [class*=sticky], [class*=fixed] { position: relative !important }' })
    await p.setViewportSize({ width: 1440, height: 3000 }); await f2.scrollIntoViewIfNeeded(); await p.waitForTimeout(300)
    await f2.screenshot({ path: `${OUT}/painel-editor-vps-kvm2.png` })
    await ctx.close()

    // ── 7. Âmbito ──
    console.log('\n7. Âmbito')
    ok((await history()) === historyBefore, 'encomendas, itens, facturas e serviços anteriores inalterados')
  } catch (e) { ok(false, 'execução', e.stack) } finally {
    await db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', ?) WHERE id = 1", [cvModeBefore ?? 'request_only']).catch(() => {})
    try {
      for (const id of fixtures) await db.query('DELETE FROM services WHERE id = ?', [id])
      await db.beginTransaction()
      const cols = ['name', 'description', 'sale_status', 'position', 'badge', 'popular', 'base_monthly_price', 'plan_specs', 'image_path', 'provider_product_id', 'provider_mode', 'provider_specs']
      for (const pr of snapProducts) await db.query(`UPDATE products SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => val(pr[c])), pr.id])
      await db.query(`DELETE FROM product_prices WHERE product_id IN ${inV}`, vpsIds)
      for (const x of snapPrices) { const k = Object.keys(x); await db.query(`INSERT INTO product_prices (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query(`DELETE FROM product_features WHERE product_id IN ${inV}`, vpsIds)
      for (const x of snapFeatures) { const k = Object.keys(x); await db.query(`INSERT INTO product_features (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query('DELETE FROM vps_provider_settings')
      for (const x of snapSettings) { const k = Object.keys(x); await db.query(`INSERT INTO vps_provider_settings (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.commit()
      const key = x => `${x.product_id}|${x.cycle}|${Number(x.price)}|${x.active}`
      ok(JSON.stringify((await all(`SELECT product_id, cycle, price, active FROM product_prices WHERE product_id IN ${inV}`, vpsIds)).map(key).sort()) === JSON.stringify(snapPrices.map(key).sort()), 'planos VPS e integração repostos')
    } catch (e) { await db.rollback().catch(() => {}); ok(false, 'reposição', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
