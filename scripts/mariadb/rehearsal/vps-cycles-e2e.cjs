// VPS: ciclo de 3 meses retirado das novas compras (painel, pré-visualização, página, compra, carrinho, checkout e
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
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const val = v => (v != null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v)
  const vpsIds = (await all("SELECT id FROM products WHERE category = 'vps' AND subcategory IS NULL")).map(r => r.id)
  const inV = `(${vpsIds.map(() => '?').join(',')})`
  const snapProducts = await all(`SELECT * FROM products WHERE id IN ${inV}`, vpsIds)
  const snapPrices = await all(`SELECT * FROM product_prices WHERE product_id IN ${inV}`, vpsIds)
  const snapFeatures = await all(`SELECT * FROM product_features WHERE product_id IN ${inV}`, vpsIds)
  const snapSettings = await all('SELECT * FROM vps_provider_settings')
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
  let fixtureService = null
  try {
    const pl = await plans()
    const p1 = pl.find(p => p.slug === 'vps-nvme2') ?? pl[0], p2 = pl.find(p => p.slug === 'vps-nvme4') ?? pl[1]
    const line = (slug, cycle) => ({ type: 'product', slug, cycle, quantity: 1, options: { location: '21', image: '1130' } })

    // ── 1. Migração e preservação ──
    console.log('\n1. Migração 20: preço de 3 meses desactivado, linha preservada')
    const r3 = await all("SELECT pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NULL AND pp.cycle = '3months'")
    ok(r3.length > 0 && r3.every(r => Number(r.active) === 0), `planos VPS: ${r3.length} preço(s) de 3 meses guardados e desactivados`)
    const sub3 = await all("SELECT pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NOT NULL AND pp.cycle = '3months'")
    ok(sub3.every(r => Number(r.active) === 1) || !sub3.length, `VPS com subcategoria (n8n, Evolution…) não afectados (${sub3.length})`)

    // ── 2. Painel e página pública ──
    console.log('\n2. Painel, pré-visualização, página e compra sem «3 meses»')
    ok(pl.every(p => p.periods.every(x => x.cycle !== '3months')), 'editor: nenhum plano oferece o ciclo de 3 meses')
    let { ctx, p } = await ctxFor(b, DESKTOP, adm.cookie)
    await p.goto(BASE + '/admin/site/catalog?cat=vps', { waitUntil: 'domcontentloaded' })
    const row = p.locator(`[data-testid=vps-plan-admin][data-slug="${p1.slug}"]`); await row.waitFor()
    await row.locator('summary').click()
    const form = row.getByTestId('vps-plan-form'); await form.waitFor()
    ok(await form.getByTestId('vp-period-3months').count() === 0 && await form.getByTestId('vp-preview-3months').count() === 0 && await form.getByTestId('vp-period-6months').count() === 1, 'formulário e pré-visualização: sem 3 meses (os outros períodos mantêm-se)')
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/servidor-vps', { waitUntil: 'domcontentloaded' }); await p.locator('[data-testid=vps-plan]').first().waitFor()
    ok(await p.getByTestId('vps-period-3months').count() === 0 && !/3 meses/.test(await p.locator('[data-testid=vps-plans-section]').innerText()), 'página /servidor-vps: sem 3 meses')
    await p.goto(`${BASE}/comprar/${p1.slug}?ciclo=3months`, { waitUntil: 'domcontentloaded' }); await p.locator('[data-testid^=cycle-]').first().waitFor()
    ok(await p.getByTestId('cycle-3months').count() === 0 && await p.locator('[data-testid^=cycle-]').count() >= 1, 'configuração da compra: «3 meses» não aparece, mesmo com ?ciclo=3months')
    await ctx.close()

    // ── 3. Servidor ──
    console.log('\n3. Servidor recusa 3 meses em novas compras')
    let q = (await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [line(p1.slug, '3months')] } })).json
    ok(q?.quote?.lines?.[0]?.error?.code === 'cycle_retired' && !q.quote.lines[0].cycles.some(c => c.cycle === '3months') && q.quote.lines[0].cycles.length >= 1, `cotação: «${q?.quote?.lines?.[0]?.error?.message}» e ciclos alternativos`)
    const ordersBefore = Number((await one('SELECT COUNT(*) n FROM orders')).n)
    let r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [line(p1.slug, '3months')], acceptedTotal: 1, paymentMethod: 'bank_transfer', proofFile: null } })
    ok(r.status >= 400 && Number((await one('SELECT COUNT(*) n FROM orders')).n) === ordersBefore, `pedido directo de encomenda com 3 meses → ${r.status}, nenhuma encomenda criada`)
    r = await adm.req(API, { method: 'PUT', body: { ...p1, providerSpecs: p1.providerSpecs, periods: [{ cycle: '3months', discount: 0, publish: true }] } })
    ok(r.status === 400 && /3 meses/.test(r.json?.error), 'painel: gravar o ciclo de 3 meses → 400')

    // ── 4. Carrinho antigo ──
    console.log('\n4. Carrinho antigo com VPS de 3 meses')
    const dom = `carrinho-antigo-${randomUUID().slice(0, 6)}.com`
    const cart = JSON.stringify({ state: { lines: [{ key: 'k-vps', type: 'product', slug: p1.slug, cycle: '3months', quantity: 1, options: { location: '21', image: '1130' } }, { key: 'k-dom', type: 'domain', domain: dom, operation: 'register', years: 1 }], idempotencyKey: null }, version: 0 })
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts, null, cart))
      await p.goto(BASE + '/carrinho', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('summary-total').or(p.locator('[role=alert]').first()).first().waitFor()
      await p.waitForTimeout(800)
      const lines = p.getByTestId('cart-line')
      ok(await lines.count() === 2, `${label}: os dois itens continuam no carrinho`)
      const vline = lines.filter({ hasText: /VPS/ }).first()
      ok(/deixou de estar disponível/.test(await vline.innerText()) && !/deixou de estar/.test(await lines.filter({ hasText: dom }).innerText()), `${label}: o VPS pede outro período; o domínio fica intacto`)
      ok(await p.getByTestId('finalize').isDisabled(), `${label}: «Finalizar» bloqueado até escolher outro período`)
      const sel = vline.getByTestId('line-cycle')
      const opts3 = await sel.locator('option').evaluateAll(o => o.map(x => ({ v: x.value, d: x.disabled, t: x.textContent })))
      ok(opts3.some(o => o.v === '3months' && o.d && /escolha outro período/.test(o.t)) && opts3.filter(o => !o.d).every(o => o.v !== '3months'), `${label}: selector com «— escolha outro período —» e só ciclos à venda`)
      if (label === 'desktop') await p.screenshot({ path: `${OUT}/desktop-carrinho-antigo-3meses.png`, fullPage: true })
      await sel.selectOption('1year'); await p.waitForTimeout(1200)
      ok(!/deixou de estar/.test(await vline.innerText()) && await p.getByTestId('finalize').isEnabled(), `${label}: escolhido «1 ano» → linha válida e «Finalizar» disponível`)
      ok(await lines.count() === 2 && await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, `${label}: restantes itens mantidos, sem deslocamento horizontal`)
      if (label === 'iphone') await p.screenshot({ path: `${OUT}/iphone-carrinho-corrigido.png`, fullPage: true })
      await ctx.close()
    }

    // ── 5. Renovação de um VPS já contratado a 3 meses ──
    console.log('\n5. Encomendas e renovações existentes')
    const c1id = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id
    fixtureService = randomUUID()
    await db.query("INSERT INTO services (id, profile_id, product_id, service_type, service_name, status, billing_cycle, price, renewal_price, next_due_date, provisioning_status) VALUES (?, ?, ?, 'vps', 'VPS de ensaio (3 meses, contratado antes)', 'active', '3months', 82200, 82200, CURRENT_DATE + INTERVAL 10 DAY, 'active')", [fixtureService, c1id, p1.id])
    q = (await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'renewal', serviceId: fixtureService }] } })).json
    ok(!q?.quote?.lines?.[0]?.error && Number(q?.quote?.lines?.[0]?.lineTotal) === 82200 && q.quote.lines[0].cycle === '3months', `renovação de um VPS contratado a 3 meses continua possível (${q?.quote?.lines?.[0]?.lineTotal} Kz, ${q?.quote?.lines?.[0]?.cycle})`, JSON.stringify(q?.quote?.lines?.[0]?.error))

    // ── 6. KVM 2: ciclos sem item do mesmo período ──
    console.log('\n6. KVM 2: 6 meses e 3 anos sem item de preço na Hostinger')
    await adm.req(INT, { method: 'POST', body: { mode: 'test', apiUrl: MOCK, secret: 'hostinger-de-ensaio', hostnameSuffix: 'srv.ensaio.test' } })
    await adm.req(INT, { method: 'POST', body: { action: 'test' } })
    const prov = (await adm.req(`${API}?provider=1`)).json.provider
    const kvm2 = prov.items.find(i => i.id === 'hostingercom-vps-kvm2')
    const months = x => x.period_unit === 'year' ? x.period * 12 : x.period
    ok(kvm2 && !kvm2.prices.some(x => [6, 36].includes(months(x))), `catálogo simulado: KVM 2 com itens de ${[...new Set(kvm2.prices.map(months))].join(', ')} meses (sem 6 nem 36)`)
    const it = m => kvm2.prices.find(x => months(x) === m)
    const prov1 = m => ({ providerItemId: it(m).id, providerCostMinor: it(m).first_period_price ?? it(m).price, providerCurrency: 'USD', providerCostLimitMinor: Math.ceil((it(m).first_period_price ?? it(m).price) * 1.1) })
    const specs2 = { vcpu: 2, ramGb: 8, diskGb: 100, diskType: 'NVMe', traffic: { value: 8, unit: 'TB' }, network: { value: 1, unit: 'Gbps' } }
    const body = per => ({ id: p2.id, name: p2.name, description: p2.description, saleStatus: p2.saleStatus, position: p2.position, badge: p2.badge, highlight: p2.highlight, baseMonthly: p2.baseMonthly,
      specs: specs2, features: p2.features, providerProductId: 'hostingercom-vps-kvm2', providerSpecs: kvm2.specs, providerMode: 'auto', periods: per })
    const base = (pub6 = false, pub36 = false, item6 = {}) => [
      { cycle: 'monthly', discount: 0, publish: true, ...prov1(1) }, { cycle: '6months', discount: 5, publish: pub6, providerItemId: '', providerCostMinor: '', providerCurrency: '', providerCostLimitMinor: '', ...item6 },
      { cycle: '1year', discount: 10, publish: true, ...prov1(12) }, { cycle: '2years', discount: 15, publish: true, ...prov1(24) }, { cycle: '3years', discount: 20, publish: pub36, providerItemId: '', providerCostMinor: '', providerCurrency: '', providerCostLimitMinor: '' },
    ]
    r = await adm.req(API, { method: 'PUT', body: body(base(false, false)) })
    ok(r.status === 200, 'KVM 2 em automático guardado com 6 meses e 3 anos NÃO publicados', r.json?.error)
    let saved = (await plans()).find(x => x.id === p2.id)
    ok(['6months', '3years'].every(c => { const x = saved.periods.find(y => y.cycle === c); return x.exists && !x.active && !x.providerItemId }) && saved.periods.find(y => y.cycle === '1year').active, 'ciclos sem item guardados (preço e desconto) como não publicados; 1 mês, 1 e 2 anos publicados')
    r = await adm.req(API, { method: 'PUT', body: body(base(true, false)) })
    ok(r.status === 400 && /6 meses: para publicar em activação automática falta item de preço da Hostinger de 6 mês\(es\)/.test(r.json?.error), `publicar 6 meses em automático sem item → 400: «${r.json?.error}»`)
    r = await adm.req(API, { method: 'PUT', body: body(base(false, true)) })
    ok(r.status === 400 && /3 anos/.test(r.json?.error), 'publicar 3 anos em automático sem item → 400')
    r = await adm.req(API, { method: 'PUT', body: body(base(true, false, prov1(12))) })
    ok(r.status === 400 && /é de 12 mês\(es\); use um item de 6 mês/.test(r.json?.error), `item de 12 meses no ciclo de 6 meses → recusado: «${r.json?.error}»`)
    r = await adm.req(API, { method: 'PUT', body: body(base(false, false, prov1(12))) })
    ok(r.status === 400, 'mesmo não publicado, o item de outro período não é aceite')
    r = await adm.req(API, { method: 'PUT', body: body(base(true, false, { providerItemId: 'hostingercom-vps-kvm2-usd-6m', providerCostMinor: 3000, providerCurrency: 'USD', providerCostLimitMinor: 3300 })) })
    ok(r.status === 400 && /não pertence ao produto/.test(r.json?.error), 'item inventado (inexistente no catálogo) → recusado')
    r = await adm.req(API, { method: 'PUT', body: { ...body(base(true, true)), providerMode: 'manual' } })
    ok(r.status === 200, 'em modo Manual os mesmos ciclos podem ser publicados (a equipa trata da aquisição)', r.json?.error)
    await adm.req(API, { method: 'PUT', body: body(base(false, false)) })

    // Painel: dados em falta e publicação bloqueada no formulário
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(BASE + '/admin/site/catalog?cat=vps', { waitUntil: 'domcontentloaded' })
    const row2 = p.locator(`[data-testid=vps-plan-admin][data-slug="${p2.slug}"]`); await row2.waitFor()
    await row2.locator('summary').click()
    const f2 = row2.getByTestId('vps-plan-form'); await f2.waitFor()
    for (const c of ['6months', '3years']) {
      const m = f2.getByTestId(`vp-missing-${c}`)
      ok(await m.count() === 1 && /sem item de (6|36) mês\(es\) no catálogo da Hostinger/.test(await m.innerText()) && /custo/.test(await m.innerText()) && /Pode guardar como não publicado/.test(await m.innerText()), `formulário ${c}: «${(await m.innerText().catch(() => '')).trim()}»`)
      ok(await f2.getByTestId(`vp-publish-${c}`).isDisabled(), `formulário ${c}: «Publicado» bloqueado em activação automática`)
    }
    ok(await f2.getByTestId('vp-missing-1year').count() === 0 && await f2.getByTestId('vp-publish-1year').isEnabled(), 'ciclos completos (1 ano) sem aviso')
    ok((await f2.getByTestId('vp-item-6months').evaluate(e => e.tagName)) === 'INPUT', '6 meses: não é oferecido nenhum item de outro período (só campo vazio)')
    await f2.getByTestId('vp-provider-mode').selectOption('manual'); await p.waitForTimeout(150)
    ok(await f2.getByTestId('vp-publish-6months').isEnabled() && /Em modo Manual pode ser publicado/.test(await f2.getByTestId('vp-missing-6months').innerText()), 'em Manual: pode publicar, com a indicação do que faltaria')
    await f2.getByTestId('vp-provider-mode').selectOption('auto'); await p.waitForTimeout(150)
    await p.addStyleTag({ content: 'header, [class*=sticky], [class*=fixed] { position: relative !important }' })
    await p.setViewportSize({ width: 1440, height: 2600 }); await f2.getByTestId('vp-period-monthly').scrollIntoViewIfNeeded()
    await f2.locator('table').first().screenshot({ path: `${OUT}/painel-kvm2-ciclos-sem-item.png` })
    await ctx.close()

    // ── 7. Âmbito ──
    console.log('\n7. Âmbito')
    ok((await history()) === historyBefore, 'encomendas, itens, facturas e serviços anteriores inalterados')
  } catch (e) { ok(false, 'execução', e.stack) } finally {
    try {
      if (fixtureService) await db.query('DELETE FROM services WHERE id = ?', [fixtureService])
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
