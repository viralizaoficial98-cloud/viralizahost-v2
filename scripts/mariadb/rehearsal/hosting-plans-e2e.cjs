// Hospedagem Premium: períodos (1 mês, 1/2/3 anos), descontos do administrador e fichas de plano.
// Ensaio apenas (WHM simulado, transferência sem cobrança real). Repõe no fim o catálogo de hospedagem como estava.
//   BASE_URL=http://localhost:3000 OUT=/tmp/hosp node --env-file=.env.local scripts/mariadb/rehearsal/hosting-plans-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomBytes } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-hospedagem'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => randomBytes(3).toString('hex')
// «57 456,00 Kz» / «Kz 57 456» → 57456
const num = s => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const PERIODS = [['monthly', 1, '1 mês'], ['1year', 12, '1 ano'], ['2years', 24, '2 anos'], ['3years', 36, '3 anos']]
// Regra do servidor: total = arredondar ao cêntimo(base × meses × (100 − d)/100)
const totalOf = (base, months, d) => Math.round(Math.round(base * 100) * months * (100 - d) / 100) / 100
const implied = (price, base, months) => Math.max(0, Math.min(90, Math.round(100 * (1 - price / (base * months)))))

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json }
  }
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const val = v => (v != null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v)
  const hostIds = (await all("SELECT id FROM products WHERE category = 'hosting'")).map(r => r.id)
  const activeHost = (await all("SELECT id FROM products WHERE category = 'hosting' AND active = 1")).map(r => r.id)
  const inH = `(${hostIds.map(() => '?').join(',')})`
  const snapProducts = await all(`SELECT * FROM products WHERE id IN ${inH}`, hostIds)
  const snapPrices = await all(`SELECT * FROM product_prices WHERE product_id IN ${inH}`, hostIds)
  const snapFeatures = await all(`SELECT * FROM product_features WHERE product_id IN ${inH}`, hostIds)
  // Âmbito: tudo o que NÃO é Hospedagem Premium tem de ficar igual
  const otherState = async () => JSON.stringify([
    await all("SELECT id, slug, name, sale_status, position, badge, popular, base_monthly_price, plan_specs, whm_package, price_monthly, price_1year FROM products WHERE category <> 'hosting' AND slug NOT LIKE 'hosting-%' ORDER BY id"),
    await all("SELECT pp.product_id, pp.cycle, pp.price, pp.renewal_price, pp.active, pp.discount_pct FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category <> 'hosting' ORDER BY pp.product_id, pp.cycle"),
    await all("SELECT f.product_id, f.feature, f.included, f.position, f.group_name FROM product_features f JOIN products p ON p.id = f.product_id WHERE p.category <> 'hosting' ORDER BY f.product_id, f.position"),
  ])
  const otherBefore = await otherState()
  const snapOrders = await all("SELECT id, unit_price, line_total, renewal_price, quantity, billing_cycle, months FROM order_items WHERE service_type = 'hosting' ORDER BY id")
  const snapInvoices = await all(`SELECT * FROM invoice_items WHERE product_id IN ${inH} ORDER BY id`, hostIds).catch(() => [])
  const snapServices = await all("SELECT id, status, billing_cycle, next_due_date, price, renewal_price FROM services WHERE service_type = 'hosting' ORDER BY id").catch(async () => all("SELECT id, status, next_due_date FROM services WHERE service_type = 'hosting' ORDER BY id"))
  const adm = new S(), c1 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const API = '/api/admin/catalog/hosting-plans'
  const loadPlan = async id => (await adm.req(API)).json.plans.find(x => x.id === id)
  // Corpo de edição a partir do plano guardado (mantém tudo; discounts: array por período ou null = manter)
  const asInput = (pl, over = {}, discounts = null, publish = null) => ({
    id: pl.id, name: pl.name, description: pl.description, saleStatus: pl.saleStatus, position: pl.position, badge: pl.badge, highlight: pl.highlight, baseMonthly: pl.baseMonthly,
    specs: pl.specs, groups: pl.groups, ...over,
    periods: pl.periods.map((x, i) => ({ cycle: x.cycle, discount: discounts ? discounts[i] : (x.exists && x.matchesRule ? x.discount : null), publish: publish ? publish[i] : x.active, renewal: null })),
  })
  const b = await chromium.launch()
  const created = []
  let orderId = null
  try {
    const visible = await all("SELECT id, slug, name, base_monthly_price FROM products WHERE category = 'hosting' AND active = 1 AND sale_status = 'active' ORDER BY position")

    // ── 1. Migração ──
    console.log('\n1. Migração preserva planos, preços, ciclos e pacotes WHM')
    for (const p of visible) {
      const pp = snapPrices.filter(r => r.product_id === p.id)
      const m = pp.find(r => r.cycle === 'monthly')
      ok(m && Number(p.base_monthly_price) === Number(m.price), `${p.slug}: preço base = preço mensal guardado (${Number(m?.price)})`)
      ok(PERIODS.every(([c, mo]) => { const r = pp.find(x => x.cycle === c); return !r || Number(r.discount_pct) === implied(Number(r.price), Number(m.price), mo) }), `${p.slug}: desconto calculado a partir dos preços guardados (${pp.filter(x => PERIODS.some(([c]) => c === x.cycle)).map(x => `${x.cycle}=${x.discount_pct}%`).join(' ')})`)
    }
    ok(snapPrices.length >= visible.length * 4 && snapPrices.some(r => r.cycle === '3months'), `ciclos existentes mantidos (${[...new Set(snapPrices.map(r => r.cycle))].join(', ')})`)
    ok(snapProducts.filter(p => visible.some(v => v.id === p.id)).every(p => p.plan_specs == null) && snapFeatures.filter(f => visible.some(v => v.id === f.product_id)).every(f => f.group_name == null), 'sem ficha nem grupos até o administrador os gravar (cartões como antes)')
    // Exceptuam-se os planos provisórios de revenda criados pela migração 23 (revenda-starter/business/pro, com preço base)
    const nonHostingBase = await one("SELECT COUNT(*) n FROM products WHERE category IN ('wordpress', 'website-builder', 'reseller') AND slug NOT IN ('revenda-starter','revenda-business','revenda-pro') AND (base_monthly_price IS NOT NULL OR plan_specs IS NOT NULL)")
    ok(Number(nonHostingBase.n) === 0, 'WordPress, construtor e revenda não foram tocados pela migração')

    // ── 2. Autorização e validação ──
    console.log('\n2. Só administradores; formulário validado no servidor')
    const p0 = { name: `Ensaio ${rnd()}`, baseMonthly: 4200, saleStatus: 'draft', specs: {}, groups: [], periods: [] }
    let r = await anon.req(API, { method: 'POST', body: p0 }); ok(r.status === 401, `visitante: criar → ${r.status}`)
    r = await c1.req(API, { method: 'POST', body: p0 }); ok(r.status === 403, `cliente: criar → ${r.status}`)
    r = await c1.req(API); ok(r.status === 403, `cliente: listar → ${r.status}`)
    r = await c1.req(API, { method: 'PUT', body: { ...p0, id: visible[0].id } })
    ok(r.status === 403 && Number((await one('SELECT base_monthly_price b FROM products WHERE id = ?', [visible[0].id])).b) === Number(visible[0].base_monthly_price), `cliente: editar → ${r.status}, plano intacto`)
    for (const [label, body, field] of [
      ['desconto 91%', { ...p0, periods: [{ cycle: '3years', discount: 91, publish: true }] }, 'discount-3years'],
      ['desconto negativo', { ...p0, periods: [{ cycle: '1year', discount: -1, publish: true }] }, 'discount-1year'],
      ['desconto decimal', { ...p0, periods: [{ cycle: '2years', discount: 12.5, publish: true }] }, 'discount-2years'],
      ['publicar período sem desconto definido', { ...p0, periods: [{ cycle: '1year', discount: null, publish: true }] }, 'discount-1year'],
      ['preço base 0', { ...p0, baseMonthly: 0 }, 'baseMonthly'],
      ['preço base com 3 casas', { ...p0, baseMonthly: 4200.555 }, 'baseMonthly'],
      ['nome vazio', { ...p0, name: '  ' }, 'name'],
      ['sites com número E ilimitado', { ...p0, specs: { sites: { unlimited: true, value: 5 } } }, 'sites'],
      ['tráfego em PB', { ...p0, specs: { traffic: { value: 5, unit: 'PB' } } }, 'traffic'],
      ['tráfego ilimitado com valor', { ...p0, specs: { traffic: { unlimited: true, value: 100 } } }, 'traffic'],
      ['armazenamento 0', { ...p0, specs: { storageGb: 0 } }, 'storageGb'],
      ['disco HDD', { ...p0, specs: { diskType: 'HDD' } }, 'diskType'],
      ['RAM negativa', { ...p0, specs: { ramGb: -1 } }, 'ramGb'],
      ['inodes não numéricos', { ...p0, specs: { inodes: { value: 'muitos' } } }, 'inodes'],
      ['à venda sem período publicado', { ...p0, saleStatus: 'active' }, 'periods'],
    ]) {
      r = await adm.req(API, { method: 'POST', body })
      ok(r.status === 400 && r.json?.field === field, `recusa ${label} → ${r.status} (${r.json?.error})`)
    }
    const wp = await one("SELECT id, name FROM products WHERE category = 'wordpress' LIMIT 1")
    r = await adm.req(API, { method: 'PUT', body: { ...p0, id: wp.id, name: wp.name } })
    ok(r.status === 400, `editor de hospedagem não edita outras categorias (WordPress → ${r.status})`)
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: visible[0].id, prices: [{ cycle: '1year', price: 1, renewal_price: 1, active: true }] } })
    ok(r.status === 400 && Number((await one("SELECT price FROM product_prices WHERE product_id = ? AND cycle = '1year'", [visible[0].id])).price) === Number(snapPrices.find(x => x.product_id === visible[0].id && x.cycle === '1year').price), `tabela genérica não altera os 4 períodos da hospedagem → ${r.status}`)
    const q3 = snapPrices.find(x => x.product_id === visible[0].id && x.cycle === '3months')
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: visible[0].id, prices: [{ cycle: '3months', price: Number(q3.price), renewal_price: Number(q3.renewal_price), active: true }] } })
    ok(r.status === 200, `outros ciclos (trimestral) continuam editáveis na tabela → ${r.status}`)

    // ── 3. Página pública antes de descontos ──
    console.log('\n3. Página pública com os preços actuais (desconto 0)')
    const ctx = await b.newContext(DESKTOP)
    const p = await ctx.newPage()
    const errors = []; p.on('pageerror', e => errors.push(e.message))
    const cardsOf = async (root = p) => {
      await root.locator('[data-testid=hosting-plan-card]').first().waitFor()
      return root.locator('[data-testid=hosting-plan-card]').evaluateAll(els => els.map(e => {
        const q = s => e.querySelector(`[data-testid=${s}]`)?.textContent?.replace(/\s/g, ' ') ?? null
        return { slug: e.dataset.slug, text: e.innerText.replace(/\s+/g, ' ').replace(/\s/g, ' '), monthly: q('hosting-plan-monthly'), total: q('hosting-plan-total'), period: q('hosting-plan-period'),
          list: q('hosting-plan-list'), discount: q('hosting-plan-discount'), badge: q('hosting-plan-badge'), profile: q('hosting-plan-profile'), renewal: q('hosting-plan-renewal'),
          cta: e.querySelector('[data-testid=hosting-plan-cta]')?.getAttribute('href') ?? null,
          specs: [...e.querySelectorAll('[data-testid^=hosting-spec-]')].map(x => `${x.dataset.testid.replace('hosting-spec-', '')}:${x.textContent.trim().replace(/\s/g, ' ')}`),
          groups: [...e.querySelectorAll('[data-testid=hosting-plan-group]')].map(g => ({ name: g.querySelector('[data-testid=hosting-plan-group-name]')?.textContent ?? null, features: [...g.querySelectorAll('[data-testid=hosting-plan-feature]')].map(f => f.textContent.trim()) })) }
      }))
    }
    const pick = async (c, root = p) => { await root.getByTestId(`hosting-period-${c}`).click(); await p.waitForFunction(c => [...document.querySelectorAll(`[data-testid=hosting-period-${c}]`)].some(x => x.getAttribute('aria-checked') === 'true'), c) }
    const periodBadge = c => p.getByTestId(`hosting-period-${c}`).locator('[data-testid=hosting-period-badge]').textContent({ timeout: 500 }).catch(() => null)
    const open = async () => { await p.goto(BASE + '/hospedagem-de-sites', { waitUntil: 'domcontentloaded' }); await p.getByTestId('hosting-period-3years').waitFor() }
    await open()
    const labels = await p.locator('[role=radiogroup][aria-label="Período de contratação"] [role=radio]').allInnerTexts()
    ok(labels.map(t => t.split('\n')[0].trim()).join('|') === '1 mês|1 ano|2 anos|3 anos', `selector: ${labels.map(t => t.split('\n')[0]).join(', ')}`)
    for (const [c, months, label] of PERIODS) {
      await pick(c)
      const cards = await cardsOf(), bad = []
      for (const v of visible) {
        const k = cards.find(x => x.slug === v.slug), row = snapPrices.find(x => x.product_id === v.id && x.cycle === c)
        const d = implied(Number(row.price), Number(v.base_monthly_price), months)
        if (!k || num(k.total) !== Number(row.price) || Math.abs(num(k.monthly) - Number(row.price) / months) > 0.01 || (d === 0 && (k.discount || k.list)) || k.cta !== `/comprar/${v.slug}?ciclo=${c}`) bad.push(`${v.slug}:${JSON.stringify(k).slice(0, 200)}`)
        if (k && months > 1 && !new RegExp(`pagos por ${months} meses`).test(k.period)) bad.push(`${v.slug}: «${k.period}»`)
      }
      ok(!bad.length, `${label}: total guardado, equivalente mensal, sem etiqueta/riscado com desconto 0${months > 1 ? `, «pagos por ${months} meses»` : ''}, «Comprar agora» com ?ciclo=${c}`, bad.join(' '))
      ok(!(await periodBadge(c)), `${label}: selector sem «Poupe/Até» (descontos 0)`)
    }
    await pick('monthly')
    await p.locator('#planos').screenshot({ path: `${OUT}/desktop-01-antes.png` })

    // ── 4. Criar plano no painel ──
    console.log('\n4. Criar plano no painel (ficha, grupos, descontos, pré-visualização)')
    const actx = await b.newContext(DESKTOP)
    await actx.addCookies([{ name: 'vh_session', value: adm.cookie.split('=')[1], url: BASE }])
    const ap = await actx.newPage()
    ap.on('pageerror', e => errors.push('painel: ' + e.message))
    await ap.goto(BASE + '/admin/site/catalog?cat=hosting', { waitUntil: 'domcontentloaded' })
    await ap.getByTestId('hosting-plans-editor').waitFor()
    ok(await ap.getByTestId('hosting-plan-admin').count() === activeHost.length, `editor lista só os ${activeHost.length} planos de Hospedagem Premium`)
    await ap.getByTestId('hosting-plan-create').click()
    const f = ap.getByTestId('hosting-plan-new')
    const name = `Ensaio Hosp ${rnd()}`
    await f.getByTestId('hp-name').fill(name)
    await f.getByTestId('hp-profile').fill('Para lojas online')
    await f.getByTestId('hp-description').fill('Plano de ensaio <script>sem</script> HTML')
    await f.getByTestId('hp-status').selectOption('active')
    await f.getByTestId('hp-badge').fill('Mais popular')
    await f.getByTestId('hp-position').fill('5')
    await f.getByTestId('hp-highlight').check()
    await f.getByTestId('hp-sites-mode').selectOption('value'); await f.getByTestId('hp-sites').fill('10')
    await f.getByTestId('hp-storage').fill('100'); await f.getByTestId('hp-disk').selectOption('NVMe')
    await f.getByTestId('hp-traffic-mode').selectOption('unlimited')
    await f.getByTestId('hp-email-mode').selectOption('value'); await f.getByTestId('hp-email').fill('50')
    await f.getByTestId('hp-send').fill('200'); await f.getByTestId('hp-ram').fill('2')
    await f.getByTestId('hp-inodes-mode').selectOption('value'); await f.getByTestId('hp-inodes').fill('300000')
    // grupo 1 «Recursos Premium»
    const g1 = f.getByTestId('hp-group').nth(0)
    await g1.getByTestId('hp-group-name').fill('Recursos Premium')
    const feats1 = ['SSL grátis', 'Backups diários', 'Construtor de sites', 'Acesso SSH']
    await g1.locator('[data-testid=hp-feature] input[aria-label^="Característica"]').first().fill(feats1[0])
    for (const x of feats1.slice(1)) { await g1.getByTestId('hp-add-feature').click(); await g1.locator('[data-testid=hp-feature] input[aria-label^="Característica"]').last().fill(x) }
    await g1.getByTestId('hp-feature').nth(3).getByLabel('Subir').click() // SSH sobe para 3.º
    // grupo 2 «Desempenho», sobe para 1.º
    await f.getByTestId('hp-add-group').click()
    const g2 = f.getByTestId('hp-group').nth(1)
    await g2.getByTestId('hp-group-name').fill('Desempenho')
    await g2.locator('[data-testid=hp-feature] input[aria-label^="Característica"]').first().fill('LiteSpeed Enterprise')
    await g2.getByTestId('hp-add-feature').click(); await g2.locator('[data-testid=hp-feature] input[aria-label^="Característica"]').last().fill('CDN global')
    await g2.getByLabel('Subir grupo').click()
    await f.getByTestId('hp-base').fill('4200')
    for (const [c, d] of [['monthly', 0], ['1year', 12], ['2years', 37], ['3years', 62]]) { await f.getByTestId(`hp-discount-${c}`).fill(String(d)); await f.getByTestId(`hp-publish-${c}`).check() }
    ok(num(await f.getByTestId('hp-total-3years').innerText()) === 57456, `pré-visualização da tabela: 4 200 × 36 × 0,38 = ${await f.getByTestId('hp-total-3years').innerText()}`)
    await f.getByTestId('hp-preview-3years').click()
    const pv = f.getByTestId('hp-preview').getByTestId('hosting-plan-card')
    ok(num(await pv.getByTestId('hosting-plan-monthly').innerText()) === 1596 && /57 456,00 Kz pagos por 36 meses/.test((await pv.getByTestId('hosting-plan-period').innerText()).replace(/\s/g, ' ')) && (await pv.getByTestId('hosting-plan-discount').innerText()) === 'Poupe 62%', `pré-visualização do cartão: ${await pv.getByTestId('hosting-plan-monthly').innerText()}/mês, «${await pv.getByTestId('hosting-plan-period').innerText()}»`)
    ok(/PACOTE WHM/.test(await f.innerText()) && /DESCRITIVO/.test(await f.innerText()) && /não configuram o servidor/.test(await f.getByTestId('hp-quota-note').innerText()), 'editor indica campos aplicados pelo pacote WHM e campos descritivos')
    await f.screenshot({ path: `${OUT}/desktop-02-painel-novo.png` })
    ok(await ap.getByTestId('hosting-plan-admin').count() === activeHost.length && (await one('SELECT COUNT(*) n FROM products WHERE name = ?', [name])).n === 0, 'nada gravado antes de «Criar plano»')
    await f.getByTestId('hp-save').click()
    await ap.locator('[data-testid=hosting-plan-admin]', { hasText: name }).waitFor()
    const cr = await one('SELECT * FROM products WHERE name = ?', [name]); created.push(cr.id)
    const specs = JSON.parse(cr.plan_specs)
    ok(cr.category === 'hosting' && cr.service_type === 'hosting' && cr.provisioning === 'whm' && cr.whm_package == null && cr.slug.startsWith('hosting-'), `plano criado (${cr.slug}), activação WHM manual até ter pacote`)
    ok(cr.description === 'Plano de ensaio scriptsem/script HTML' && cr.badge === 'Mais popular' && Number(cr.position) === 5 && Number(cr.popular) === 1 && cr.sale_status === 'active' && Number(cr.base_monthly_price) === 4200, 'nome, descrição sem HTML, etiqueta, ordem, destaque, estado e preço base')
    ok(JSON.stringify(specs) === JSON.stringify({ usageProfile: 'Para lojas online', sites: { value: 10 }, storageGb: 100, diskType: 'NVMe', traffic: { unlimited: true }, emailAccounts: { value: 50 }, sendLimitHour: 200, ramGb: 2, inodes: { value: 300000 } }), `ficha gravada: ${cr.plan_specs}`)
    let pp = await all('SELECT cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id = ? ORDER BY months', [cr.id])
    const want = { monthly: [4200, 0], '1year': [44352, 12], '2years': [63504, 37], '3years': [57456, 62] }
    ok(pp.length === 4 && Object.entries(want).every(([c, [price, d]]) => { const x = pp.find(y => y.cycle === c); return x && Number(x.price) === price && Number(x.discount_pct) === d && Number(x.active) === 1 }), `servidor calcula os totais: ${pp.map(x => `${x.cycle}=${Number(x.price)}`).join(' ')}`)
    ok(pp.every(x => Number(x.renewal_price) === 4200 * { monthly: 1, '1year': 12, '2years': 24, '3years': 36 }[x.cycle]), 'renovação pela regra actual (preço base × meses)')
    let ff = await all('SELECT feature, group_name FROM product_features WHERE product_id = ? ORDER BY position', [cr.id])
    ok(ff.map(x => `${x.group_name}:${x.feature}`).join('|') === 'Desempenho:LiteSpeed Enterprise|Desempenho:CDN global|Recursos Premium:SSL grátis|Recursos Premium:Backups diários|Recursos Premium:Acesso SSH|Recursos Premium:Construtor de sites', `grupos e características pela ordem escolhida: ${ff.map(x => x.feature).join(', ')}`)
    r = await adm.req(API, { method: 'POST', body: { ...p0, name } })
    ok(r.status === 400 && r.json?.field === 'name', 'nome duplicado recusado')

    // ── 5. Cartão público do plano novo ──
    console.log('\n5. Cartão público: ficha, grupos, tráfego ilimitado, 4 períodos')
    await open()
    for (const [c, months, label] of PERIODS) {
      await pick(c)
      const k = (await cardsOf()).find(x => x.slug === cr.slug)
      const d = { monthly: 0, '1year': 12, '2years': 37, '3years': 62 }[c], t = totalOf(4200, months, d)
      ok(k && num(k.total) === t && Math.abs(num(k.monthly) - t / months) < 0.01 && (d ? k.discount === `Poupe ${d}%` && num(k.list) === 4200 : !k.discount && !k.list), `${label}: ${k?.monthly}/mês, total ${k?.total}${d ? `, «Poupe ${d}%», riscado 4 200` : ', sem etiqueta nem riscado'}`)
    }
    await pick('3years')
    let mine = (await cardsOf()).find(x => x.slug === cr.slug)
    ok(num(mine.monthly) === 1596 && /57 456,00 Kz pagos por 36 meses/.test(mine.period), `exemplo: «${mine.monthly}/mês» e «${mine.period}»`)
    ok(num((mine.renewal.match(/por ([\d\s.,]+) Kz/) ?? [])[1]) === 151200 && /a cada 36 meses/.test(mine.renewal), `valor de renovação mostrado: «${mine.renewal}»`)
    ok(mine.specs.join('|') === 'sites:10 sites|storage:100 GB NVMe|traffic:Tráfego ilimitado|email:50 caixas de e-mail|send:Até 200 envios/hora|ram:2 GB de RAM|inodes:300 000 ficheiros (inodes)', `ficha: ${mine.specs.join(' · ')}`)
    ok(JSON.stringify(mine.groups) === JSON.stringify([{ name: 'Desempenho', features: ['LiteSpeed Enterprise', 'CDN global'] }, { name: 'Recursos Premium', features: ['SSL grátis', 'Backups diários', 'Acesso SSH', 'Construtor de sites'] }]), 'grupos e características pela ordem da ficha')
    ok(mine.badge === 'Mais popular' && mine.profile === 'Para lojas online' && (await cardsOf()).map(x => x.slug)[0] === cr.slug, 'etiqueta, perfil e ordem de apresentação (ordem 5 primeiro)')
    const startCard = (await cardsOf()).find(x => x.slug === 'hosting-start')
    ok(startCard && startCard.specs.length === 0 && startCard.groups.length === 1 && startCard.groups[0].name == null, 'plano sem ficha: campos vazios omitidos, características como antes')
    await p.locator('#planos').screenshot({ path: `${OUT}/desktop-03-3anos-plano-novo.png` })

    // ── 6. Editar o plano; pacote WHM mantido ──
    console.log('\n6. Editar plano; associação ao pacote WHM mantida')
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: cr.id, whm_package: 'business' } })
    ok(r.status === 200, 'pacote WHM «business» associado na linha do produto (como até agora)')
    await ap.reload({ waitUntil: 'domcontentloaded' })
    const row = ap.locator('[data-testid=hosting-plan-admin]', { hasText: name })
    await row.locator('summary').click()
    const ef = row.getByTestId('hosting-plan-form')
    ok((await ef.getByTestId('hp-whm-package').innerText()) === 'business' && /armazenamento 50 GB, tráfego ilimitado, caixas de e-mail 50, sites 6/.test(await ef.getByTestId('hp-quota-note').innerText()), `editor mostra o pacote e os limites que ele aplica: ${(await ef.getByTestId('hp-quota-note').innerText()).split('\n')[0].slice(0, 160)}`)
    ok(/Armazenamento 100 GB ≠ pacote \(50 GB\)/.test(await ef.getByTestId('hp-pkg-warnings').innerText()), 'aviso: ficha diferente do limite real do pacote')
    await ef.getByTestId('hp-description').fill('Para lojas com tráfego moderado')
    await ef.getByTestId('hp-storage').fill('50')
    await ef.getByTestId('hp-traffic-mode').selectOption('value'); await ef.getByTestId('hp-traffic').fill('500'); await ef.getByTestId('hp-traffic-unit').selectOption('GB')
    await ef.getByTestId('hp-inodes-mode').selectOption('unlimited')
    await ef.getByTestId('hp-ram').fill('')
    const eg = ef.getByTestId('hp-group').nth(1)
    await eg.getByTestId('hp-feature').nth(1).getByLabel('Remover').click() // remove «Backups diários»
    await eg.getByTestId('hp-feature').nth(2).getByLabel('Subir').click() // Construtor sobe
    await ef.getByTestId('hp-group').nth(1).getByLabel('Subir grupo').click() // Recursos Premium volta a 1.º
    await ef.getByTestId('hp-save').click()
    await ef.getByTestId('hp-msg').filter({ hasText: 'Guardado' }).waitFor()
    const ed = await one('SELECT description, whm_package, provisioning, plan_specs FROM products WHERE id = ?', [cr.id])
    const es = JSON.parse(ed.plan_specs)
    ok(ed.whm_package === 'business' && ed.provisioning === 'whm', 'guardar a ficha NÃO altera o pacote WHM associado')
    ok(ed.description === 'Para lojas com tráfego moderado' && JSON.stringify(es.traffic) === JSON.stringify({ value: 500, unit: 'GB' }) && JSON.stringify(es.inodes) === JSON.stringify({ unlimited: true }) && es.ramGb === undefined && es.storageGb === 50, `ficha editada: tráfego 500 GB, inodes ilimitados, RAM omitida (${ed.plan_specs})`)
    ff = await all('SELECT feature, group_name FROM product_features WHERE product_id = ? ORDER BY position', [cr.id])
    ok(ff.map(x => x.feature).join('|') === 'SSL grátis|Construtor de sites|Acesso SSH|LiteSpeed Enterprise|CDN global', `características removidas e reordenadas: ${ff.map(x => x.feature).join(', ')}`)
    ok(Number((await one("SELECT price FROM product_prices WHERE product_id = ? AND cycle = '3years'", [cr.id])).price) === 57456, 'preços mantêm-se ao editar a ficha')
    await open(); await pick('3years')
    mine = (await cardsOf()).find(x => x.slug === cr.slug)
    ok(mine.specs.includes('traffic:500 GB de tráfego/mês') && mine.specs.includes('inodes:Ficheiros (inodes) ilimitados') && !mine.specs.some(s => s.startsWith('ram:')), `cartão: tráfego limitado, inodes ilimitados, RAM omitida (${mine.specs.join(' · ')})`)
    await ap.screenshot({ path: `${OUT}/desktop-04-painel-editar.png`, fullPage: true })

    // ── 7. Descontos diferentes por plano; mesmo desconto em todos ──
    console.log('\n7. Descontos diferentes por plano')
    const start = visible.find(v => v.slug === 'hosting-start') ?? visible[0]
    const sp = await loadPlan(start.id)
    r = await adm.req(API, { method: 'PUT', body: asInput(sp, {}, [0, 10, 20, 30]) })
    ok(r.status === 200, `${start.slug}: descontos 0/10/20/30 → ${r.status}`)
    const disc = (slug, c) => slug === cr.slug ? { monthly: 0, '1year': 12, '2years': 37, '3years': 62 }[c] : slug === start.slug ? { monthly: 0, '1year': 10, '2years': 20, '3years': 30 }[c] : implied(Number(snapPrices.find(x => x.product_id === visible.find(v => v.slug === slug).id && x.cycle === c).price), Number(visible.find(v => v.slug === slug).base_monthly_price), PERIODS.find(([pc]) => pc === c)[1])
    const shown = [...visible.map(v => ({ slug: v.slug, base: Number(v.base_monthly_price) })), { slug: cr.slug, base: 4200 }]
    await open()
    for (const [c, months, label] of PERIODS) {
      await pick(c)
      const cards = await cardsOf(), bad = []
      for (const v of shown) {
        const k = cards.find(x => x.slug === v.slug), d = disc(v.slug, c), t = totalOf(v.base, months, d)
        if (!k || num(k.total) !== t || (d ? k.discount !== `Poupe ${d}%` || num(k.list) !== v.base : k.discount || k.list)) bad.push(`${v.slug}: ${k?.total} ${k?.discount} ${k?.list} (esperado ${t}, ${d}%)`)
      }
      ok(!bad.length, `${label}: cada cartão com o seu desconto exacto e total certo`, bad.join(' | '))
      const ds = shown.map(v => disc(v.slug, c)), max = Math.max(...ds)
      const wantB = max === 0 ? null : ds.every(x => x === max) ? `Poupe ${max}%` : `Até ${max}%`
      ok((await periodBadge(c)) === wantB, `${label}: selector «${await periodBadge(c)}» (esperado ${wantB ?? 'nada'})`)
    }
    await pick('3years'); await p.locator('#planos').screenshot({ path: `${OUT}/desktop-05-descontos-diferentes.png` })
    const savedPlans = {}
    for (const v of [...visible, { id: cr.id }]) { const pl = await loadPlan(v.id); savedPlans[v.id] = pl; const ds = pl.periods.map(x => x.discount); ds[1] = 15; await adm.req(API, { method: 'PUT', body: asInput(pl, {}, ds) }) }
    await open()
    ok((await periodBadge('1year')) === 'Poupe 15%', `mesmo desconto em todos os planos → «${await periodBadge('1year')}»`)
    for (const v of [...visible, { id: cr.id }]) await adm.req(API, { method: 'PUT', body: asInput(savedPlans[v.id], {}, savedPlans[v.id].periods.map(x => x.discount)) })

    // ── 8. Período por configurar e preço personalizado preservado ──
    console.log('\n8. Período por configurar e preço personalizado')
    r = await adm.req(API, { method: 'POST', body: { name: `Ensaio Parcial ${rnd()}`, baseMonthly: 3000, saleStatus: 'active', position: 99, specs: { sites: { unlimited: true } }, groups: [{ name: null, features: ['SSL grátis'] }],
      periods: [{ cycle: 'monthly', discount: 0, publish: true }, { cycle: '1year', discount: 10, publish: true }, { cycle: '2years', discount: 20, publish: false }] } })
    const part = r.json?.id; if (part) created.push(part)
    ok(r.status === 201, `plano com 2 anos configurado mas não publicado e 3 anos por configurar → ${r.status}`)
    const partSlug = (await one('SELECT slug FROM products WHERE id = ?', [part])).slug
    await open(); await pick('2years')
    let pk = (await cardsOf()).find(x => x.slug === partSlug)
    ok(pk && pk.cta == null && /Indisponível neste período/.test(pk.text), '2 anos não publicado: cartão sem preço nem «Comprar agora»')
    await ap.reload({ waitUntil: 'domcontentloaded' })
    const prow = ap.locator('[data-testid=hosting-plan-admin]', { hasText: 'Ensaio Parcial' }); await prow.locator('summary').click()
    ok(await prow.getByTestId('hp-period-3years').getByTestId('hp-needs-config').count() === 1, 'editor marca 3 anos «por configurar»')
    await prow.getByTestId('hp-discount-3years').fill('25')
    ok(num(await prow.getByTestId('hp-total-3years').innerText()) === 81000, `total revisto antes de publicar: ${await prow.getByTestId('hp-total-3years').innerText()} (3 000 × 36 × 0,75)`)
    await prow.getByTestId('hp-publish-3years').check(); await prow.getByTestId('hp-publish-2years').check()
    await prow.getByTestId('hp-save').click(); await prow.getByTestId('hp-msg').filter({ hasText: 'Guardado' }).waitFor()
    await open(); await pick('3years')
    pk = (await cardsOf()).find(x => x.slug === partSlug)
    ok(pk && num(pk.total) === 81000 && pk.cta === `/comprar/${partSlug}?ciclo=3years`, '3 anos publicado depois de rever o total: aparece no site')
    // Preço personalizado (não segue a regra): mantido até o administrador aplicar a regra
    const biz = visible.find(v => v.slug === 'hosting-business')
    await db.query("UPDATE product_prices SET price = 350000, discount_pct = 6 WHERE product_id = ? AND cycle = '1year'", [biz.id])
    await ap.reload({ waitUntil: 'domcontentloaded' })
    const brow = ap.locator('[data-testid=hosting-plan-admin][data-slug=hosting-business]'); await brow.locator('summary').click()
    ok(/Preço personalizado mantido \(≈6%\)/.test(await brow.getByTestId('hp-kept-1year').innerText()), 'editor: preço personalizado mantido (≈6%)')
    await brow.getByTestId('hp-description').fill('Para pequenas e médias empresas')
    await brow.getByTestId('hp-save').click(); await brow.getByTestId('hp-msg').filter({ hasText: 'Guardado' }).waitFor()
    ok(Number((await one("SELECT price FROM product_prices WHERE product_id = ? AND cycle = '1year'", [biz.id])).price) === 350000, 'guardar outras alterações NÃO muda o preço personalizado')
    await open(); await pick('1year')
    const bk = (await cardsOf()).find(x => x.slug === 'hosting-business')
    ok(num(bk.total) === 350000 && bk.discount === 'Poupe 6%', `cartão: desconto calculado a partir do preço guardado (${bk.discount}, ${bk.total})`)
    await brow.getByTestId('hp-apply-1year').click()
    ok(num(await brow.getByTestId('hp-total-1year').innerText()) === 350808 && /muda/.test(await brow.getByTestId('hp-current-1year').innerText()), `«Aplicar regra»: novo total ${await brow.getByTestId('hp-total-1year').innerText()} assinalado antes de guardar`)

    // ── 9. Página inicial ──
    console.log('\n9. Página inicial com os mesmos dados')
    const hp = await ctx.newPage()
    await hp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await hp.locator('#planos [data-testid=hosting-plan-card]').first().waitFor()
    await hp.locator('#planos').getByTestId('hosting-period-3years').click()
    const hm = hp.locator(`#planos [data-testid=hosting-plan-card][data-slug="${cr.slug}"]`)
    ok(num(await hm.getByTestId('hosting-plan-monthly').innerText()) === 1596 && num(await hm.getByTestId('hosting-plan-total').innerText()) === 57456, 'página inicial: 1 596/mês e 57 456 por 36 meses')
    await hp.locator('#planos').screenshot({ path: `${OUT}/desktop-06-pagina-inicial.png` })
    await hp.close()

    // ── 10. Compra: cartão → configuração → carrinho → checkout ──
    console.log('\n10. Cartão, configuração, carrinho e checkout com o mesmo total')
    await open(); await pick('3years')
    await p.locator(`[data-testid=hosting-plan-card][data-slug="${cr.slug}"]`).getByTestId('hosting-plan-cta').click()
    await p.waitForURL(`**/comprar/${cr.slug}?ciclo=3years`)
    const dom = `hp${rnd()}${rnd()}.ao`
    await p.getByRole('radio', { name: 'Usar um domínio que já tenho' }).click()
    await p.getByPlaceholder('empresa.ao').fill(dom)
    await p.getByTestId('continue-own-domain').click(); await p.waitForURL('**passo=duracao**')
    ok(await p.getByTestId('cycle-3years').getAttribute('aria-checked') === 'true', '«Comprar agora» leva o período (3 anos) e passa pelo domínio')
    ok(num(await p.getByTestId('flow-total').innerText()) === 57456 && /Poupe 62%/.test(await p.getByTestId('cycle-3years').innerText()), `configuração: ${await p.getByTestId('flow-total').innerText()}, «Poupe 62%»`)
    await p.getByTestId('add-to-cart').click(); await p.waitForURL('**/carrinho')
    await p.getByTestId('summary-total').waitFor()
    const line = p.locator('[data-testid=cart-line]', { hasText: name })
    await line.getByTestId('line-discount').waitFor()
    ok(num(await line.getByTestId('line-total').innerText()) === 57456 && /36 meses pagos antecipadamente/.test(await line.getByTestId('line-period').innerText()), `carrinho: ${await line.getByTestId('line-total').innerText()}, ${await line.getByTestId('line-period').innerText()}`)
    ok(/Desconto 62%/.test(await line.getByTestId('line-discount').innerText()) && num((await line.getByTestId('line-discount').innerText()).split('(')[1]) === 151200 - 57456, `carrinho: ${await line.getByTestId('line-discount').innerText()}`)
    ok((await p.evaluate(() => JSON.parse(localStorage.getItem('viralizahost-cart-v2') || '{}').state?.lines ?? [])).some(l => l.slug === cr.slug && l.domain === dom && l.domainMode === 'existing' && l.cycle === '3years') && await line.locator(`input[value="${dom}"]`).count() === 1, `carrinho mantém o domínio escolhido (${dom})`)
    await p.screenshot({ path: `${OUT}/desktop-07-carrinho.png`, fullPage: true })
    for (const [c, months] of PERIODS) {
      const qq = await (await p.request.post(BASE + '/api/checkout/quote', { data: { lines: [{ type: 'product', slug: cr.slug, cycle: c, domain: 'exemplo-ensaio.ao', domainMode: 'existing' }] } })).json()
      const d = { monthly: 0, '1year': 12, '2years': 37, '3years': 62 }[c]
      ok(qq.quote.lines[0].lineTotal === totalOf(4200, months, d) && qq.quote.lines[0].discountPct === d, `cotação do servidor ${c} = ${qq.quote.lines[0].lineTotal}`)
    }
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/conta')
    await p.getByTestId('tab-login').click()
    await p.locator('#l-email').fill('cliente1@ensaio.test'); await p.locator('#l-pass').fill('Cliente#Um2026')
    await p.getByTestId('login-submit').click()
    await p.waitForURL(/\/checkout\/(pagamento|dados)/)
    if (p.url().includes('/checkout/dados')) { await p.getByRole('button', { name: /Continuar|Guardar/ }).first().click(); await p.waitForURL('**/checkout/pagamento') }
    await p.getByTestId('summary-total').waitFor()
    await p.locator('[data-testid=to-review]:not([disabled])').waitFor()
    await p.getByTestId('to-review').click(); await p.getByTestId('review-lines').waitFor()
    const rev = await p.getByTestId('review-lines').innerText()
    ok(/36 meses pagos antecipadamente/.test(rev) && /Desconto 62%/.test(rev) && num(await p.getByTestId('summary-subtotal').innerText()) === 57456, 'checkout: 36 meses antecipados, desconto 62%, subtotal = cartão = carrinho (57 456)')
    await p.screenshot({ path: `${OUT}/desktop-08-revisao.png`, fullPage: true })

    // ── 11. Preço alterado com o item no carrinho ──
    console.log('\n11. Administrador altera o preço com o plano no carrinho')
    const cp = await loadPlan(cr.id)
    r = await adm.req(API, { method: 'PUT', body: asInput(cp, { baseMonthly: 4300 }) })
    ok(r.status === 200, 'preço base 4 200 → 4 300 (3 anos: 4 300 × 36 × 0,38 = 58 824)')
    await p.getByTestId('accept-terms').check(); await p.getByTestId('confirm-order').click()
    await p.getByTestId('submit-error').waitFor()
    ok(/total foi actualizado/.test(await p.getByTestId('submit-error').innerText()), 'confirmação recusada: «o total foi actualizado»')
    await p.waitForFunction(() => document.querySelector('[data-testid=summary-subtotal]')?.textContent?.replace(/\D/g, '') === '58824')
    ok(num(await p.getByTestId('summary-subtotal').innerText()) === 58824, `novo total mostrado antes de confirmar: ${await p.getByTestId('summary-subtotal').innerText()}`)
    await p.getByTestId('confirm-order').click(); await p.waitForURL('**/orders/**')
    const oi = await one("SELECT oi.order_id, oi.unit_price, oi.line_total, oi.months, oi.billing_cycle, oi.renewal_price FROM order_items oi WHERE oi.product_slug = ? ORDER BY oi.order_id DESC LIMIT 1", [cr.slug])
    orderId = oi?.order_id
    ok(oi && Number(oi.line_total) === 58824 && Number(oi.months) === 36 && oi.billing_cycle === '3years' && Number(oi.renewal_price) === 151200, `encomenda de ensaio: 58 824, 36 meses, renovação comunicada ${oi?.renewal_price}`)

    // ── 12. Activação no WHM simulado com o pacote associado ──
    console.log('\n12. Activação respeita o pacote WHM do plano')
    r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId } })
    ok(r.status === 200 && r.json?.payment === 'paid', `pagamento de ensaio confirmado pelo admin (${r.status})`)
    const svc = await one("SELECT s.id, s.provisioning_status, s.external_ref, s.provisioning_error FROM services s WHERE s.order_id = ? AND s.service_type = 'hosting'", [orderId])
    const ha = svc ? await one('SELECT cpanel_username, package_name, primary_domain FROM hosting_accounts WHERE service_id = ?', [svc.id]) : null
    ok(svc?.provisioning_status === 'active' && ha?.package_name === 'business' && ha.primary_domain === dom, `conta cPanel ${ha?.cpanel_username} criada no WHM simulado com o pacote «${ha?.package_name}»`, JSON.stringify(svc))

    // ── 13. Encomendas, facturas e subscrições existentes ──
    console.log('\n13. Encomendas, facturas e subscrições existentes preservadas')
    const ordersAfter = await all(`SELECT id, unit_price, line_total, renewal_price, quantity, billing_cycle, months FROM order_items WHERE id IN (${snapOrders.map(() => '?').join(',') || "''"}) ORDER BY id`, snapOrders.map(o => o.id))
    ok(JSON.stringify(ordersAfter) === JSON.stringify(snapOrders), `${snapOrders.length} itens de hospedagem já encomendados inalterados`)
    const invAfter = await all(`SELECT * FROM invoice_items WHERE id IN (${snapInvoices.map(() => '?').join(',') || "''"}) ORDER BY id`, snapInvoices.map(x => x.id)).catch(() => [])
    ok(JSON.stringify(invAfter) === JSON.stringify(snapInvoices), `${snapInvoices.length} itens de factura inalterados`)
    const svcCols = Object.keys(snapServices[0] ?? { id: 1 }).join(', ')
    const svcAfter = await all(`SELECT ${svcCols} FROM services WHERE id IN (${snapServices.map(() => '?').join(',') || "''"}) ORDER BY id`, snapServices.map(s => s.id))
    ok(JSON.stringify(svcAfter) === JSON.stringify(snapServices), `${snapServices.length} subscrições de hospedagem inalteradas`)

    // ── 14. Telemóvel ──
    console.log('\n14. Telemóvel')
    const mctx = await b.newContext(IPHONE)
    const mp = await mctx.newPage()
    await mp.goto(BASE + '/hospedagem-de-sites#planos', { waitUntil: 'domcontentloaded' })
    await mp.getByTestId('hosting-period-3years').click()
    await mp.locator(`[data-testid=hosting-plan-card][data-slug="${cr.slug}"]`).waitFor()
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ok(overflow <= 0, `sem deslocamento horizontal (${overflow}px)`)
    const sel = await mp.locator('[role=radiogroup][aria-label="Período de contratação"]').boundingBox()
    ok(sel && sel.width <= 390, `selector cabe no ecrã (${Math.round(sel?.width)}px)`)
    await mp.locator('#planos [role=radiogroup]').scrollIntoViewIfNeeded()
    await mp.screenshot({ path: `${OUT}/iphone-01-selector.png` })
    await mp.locator(`[data-testid=hosting-plan-card][data-slug="${cr.slug}"]`).screenshot({ path: `${OUT}/iphone-02-cartao.png` })
    await mctx.close()

    // ── 15. Âmbito ──
    console.log('\n15. Alteração limitada à Hospedagem Premium')
    ok((await otherState()) === otherBefore, 'produtos, preços e características das outras categorias inalterados')
    await p.goto(BASE + '/email-corporativo', { waitUntil: 'domcontentloaded' })
    ok(await p.locator('[data-testid=email-plan-card]').first().waitFor().then(() => true).catch(() => false), 'E-mail Corporativo continua com a sua secção')
    ok(errors.length === 0, 'sem erros de consola', errors.join(' | '))
    await actx.close(); await ctx.close()
  } catch (e) {
    ok(false, 'execução', e.stack)
  } finally {
    // Repor o catálogo de hospedagem como estava (transacção). Planos de ensaio: removidos, ou em rascunho se já tiverem encomendas.
    try {
      await db.beginTransaction()
      for (const id of created) {
        await db.query('DELETE FROM product_features WHERE product_id = ?', [id])
        const refs = Number((await one('SELECT (SELECT COUNT(*) FROM invoice_items WHERE product_id = ?) + (SELECT COUNT(*) FROM services WHERE product_id = ?) n', [id, id]).catch(() => ({ n: 1 }))).n)
        if (refs) await db.query("UPDATE products SET active = 0, sale_status = 'draft' WHERE id = ?", [id])
        else { await db.query('DELETE FROM product_prices WHERE product_id = ?', [id]); await db.query('DELETE FROM products WHERE id = ?', [id]) }
      }
      const cols = ['name', 'description', 'sale_status', 'position', 'badge', 'popular', 'base_monthly_price', 'plan_specs', 'storage_gb', 'send_limit_hour', 'whm_package', 'price_monthly', 'price_6months', 'price_1year', 'price_2years', 'price_3years']
      for (const pr of snapProducts) await db.query(`UPDATE products SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => val(pr[c])), pr.id])
      await db.query(`DELETE FROM product_prices WHERE product_id IN ${inH}`, hostIds)
      for (const x of snapPrices) { const k = Object.keys(x); await db.query(`INSERT INTO product_prices (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query(`DELETE FROM product_features WHERE product_id IN ${inH}`, hostIds)
      for (const x of snapFeatures) { const k = Object.keys(x); await db.query(`INSERT INTO product_features (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente1@ensaio.test'")
      await db.commit()
      const key = x => `${x.product_id}|${x.cycle}|${Number(x.price)}|${Number(x.renewal_price)}|${x.active}|${x.discount_pct}`
      const now = (await all(`SELECT product_id, cycle, price, renewal_price, active, discount_pct FROM product_prices WHERE product_id IN ${inH}`, hostIds)).map(key).sort()
      ok(JSON.stringify(now) === JSON.stringify(snapPrices.map(key).sort()), 'catálogo de hospedagem reposto como estava')
    } catch (e) { await db.rollback().catch(() => {}); ok(false, 'reposição do catálogo (transacção desfeita)', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}${orderId ? ` · encomenda de ensaio: ${orderId}` : ''}`)
    process.exit(fail ? 1 : 0)
  }
})()
