// E-mail Corporativo: períodos (1 mês, 1/2/3 anos), descontos do administrador e fichas de plano.
// Ensaio apenas: encomendas por transferência sem cobrança real. Repõe no fim o catálogo de e-mail como estava.
//   BASE_URL=http://localhost:3000 OUT=/tmp/email node --env-file=.env.local scripts/mariadb/rehearsal/email-plans-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomBytes } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-email'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => randomBytes(3).toString('hex')
// «3 000,00 Kz» (cartões) ou «Kz 8 532» (carrinho) → número
const num = s => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.'))
const renewOf = t => num((String(t).match(/Renova por ([^K]*)Kz/) ?? [])[1] ?? (String(t).match(/Renova por Kz ([\d\s.,]+)/) ?? [])[1])
const cartLines = p => p.evaluate(() => JSON.parse(localStorage.getItem('viralizahost-cart-v2') || '{}').state?.lines ?? [])
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const PERIODS = [['monthly', 1, '1 mês'], ['1year', 12, '1 ano'], ['2years', 24, '2 anos'], ['3years', 36, '3 anos']]
// Regra única (period-pricing.ts): mensal = arredondar ao kwanza(base × (100 − d)/100); total = mensal × meses
const monthlyOf = (base, d) => Math.round(Math.round(base * 100) * (100 - d) / 10000)

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json, headers: res.headers }
  }
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const emailIds = (await all("SELECT id FROM products WHERE category = 'email'")).map(r => r.id)
  const inIds = `(${emailIds.map(() => '?').join(',')})`
  const snapProducts = await all(`SELECT * FROM products WHERE id IN ${inIds}`, emailIds)
  const snapPrices = await all(`SELECT * FROM product_prices WHERE product_id IN ${inIds}`, emailIds)
  const snapFeatures = await all(`SELECT * FROM product_features WHERE product_id IN ${inIds}`, emailIds)
  const snapSite = await all('SELECT * FROM site_email_plans').catch(() => [])
  const snapOrders = await all("SELECT id, order_id, price, unit_price, line_total, renewal_price, quantity, billing_cycle, months FROM order_items WHERE service_type = 'email' ORDER BY id")
  const snapInvoices = await all("SELECT ii.* FROM invoice_items ii JOIN products p ON p.id = ii.product_id WHERE p.category = 'email' ORDER BY ii.id").catch(() => [])
  const adm = new S(), c1 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const b = await chromium.launch()
  let created = null
  const createdOrders = []
  try {
    const visible = (await all("SELECT id, slug, name, base_monthly_price FROM products WHERE category = 'email' AND active = 1 AND sale_status = 'active' ORDER BY position")).filter(p => p.base_monthly_price != null)

    // ── 1. Migração: planos e preços actuais preservados ──
    console.log('\n1. Migração preserva os planos e os preços')
    for (const p of visible) {
      const pp = snapPrices.filter(r => r.product_id === p.id && Number(r.active) === 1)
      const m = pp.find(r => r.cycle === 'monthly')
      ok(m && Number(p.base_monthly_price) === Number(m.price), `${p.slug}: preço base = preço mensal actual (${Number(m?.price)})`)
      ok(pp.every(r => Number(r.discount_pct) === 0 && Number(r.renewal_discount_pct) === 0), `${p.slug}: sem descontos até o administrador os gravar`)
      ok(PERIODS.every(([c, mo]) => { const r = pp.find(x => x.cycle === c); return r && Number(r.price) === Number(m.price) * mo }), `${p.slug}: totais dos 4 períodos inalterados (mensal × meses)`)
    }
    const st = await one("SELECT storage_gb FROM products WHERE slug = 'email-standard'")
    ok(st && Number(st.storage_gb) > 0, `armazenamento preenchido a partir da ficha actual (email-standard: ${st?.storage_gb} GB)`)

    // ── 2. Autorização e validação no servidor ──
    console.log('\n2. Só administradores; valores validados no servidor')
    const plan0 = { name: `Ensaio ${rnd()}`, baseMonthly: 790, storageGb: 10, saleStatus: 'draft', periods: [] }
    let r = await anon.req('/api/admin/catalog/email-plans', { method: 'POST', body: plan0 })
    ok(r.status === 401, `visitante: criar → ${r.status}`)
    r = await c1.req('/api/admin/catalog/email-plans', { method: 'POST', body: plan0 })
    ok(r.status === 403, `cliente: criar → ${r.status}`)
    r = await c1.req('/api/admin/catalog/email-plans')
    ok(r.status === 403, `cliente: listar → ${r.status}`)
    r = await c1.req('/api/admin/catalog/email-plans', { method: 'PUT', body: { ...plan0, id: visible[0].id } })
    ok(r.status === 403 && Number((await one('SELECT base_monthly_price b FROM products WHERE id = ?', [visible[0].id])).b) === Number(visible[0].base_monthly_price), `cliente: editar → ${r.status}, plano intacto`)
    for (const [label, body, field] of [
      ['desconto 91%', { ...plan0, periods: [{ cycle: '3years', discount: 91 }] }, 'discount-3years'],
      ['desconto negativo', { ...plan0, periods: [{ cycle: '1year', discount: -5 }] }, 'discount-1year'],
      ['desconto decimal', { ...plan0, periods: [{ cycle: '2years', discount: 12.5 }] }, 'discount-2years'],
      ['preço base 0', { ...plan0, baseMonthly: 0 }, 'baseMonthly'],
      ['preço base com 3 casas', { ...plan0, baseMonthly: 790.123 }, 'baseMonthly'],
      ['sem nome', { ...plan0, name: ' ' }, 'name'],
      ['armazenamento 0', { ...plan0, storageGb: 0 }, 'storageGb'],
      ['limite de envio inválido', { ...plan0, sendLimitHour: 'muito' }, 'sendLimitHour'],
    ]) {
      r = await adm.req('/api/admin/catalog/email-plans', { method: 'POST', body })
      ok(r.status === 400 && r.json?.field === field, `recusa ${label} → ${r.status} (${r.json?.error})`)
    }
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'product', id: visible[0].id, prices: [{ cycle: 'monthly', price: 1, renewal_price: 1, active: true }] } })
    ok(r.status === 400 && Number((await one("SELECT price FROM product_prices WHERE product_id = ? AND cycle = 'monthly'", [visible[0].id])).price) === Number(visible[0].base_monthly_price), `tabela genérica não altera preços de e-mail → ${r.status}`)

    // ── 3. Página pública antes de qualquer desconto ──
    console.log('\n3. Página pública sem descontos (desconto 0)')
    const ctx = await b.newContext(DESKTOP)
    const p = await ctx.newPage()
    const errors = []; p.on('pageerror', e => errors.push(e.message))
    const cardsOf = async () => {
      await p.locator('[data-testid=email-plan-card]').first().waitFor()
      return p.locator('[data-testid=email-plan-card]').evaluateAll(els => els.map(e => ({
        slug: e.dataset.slug, text: e.innerText.replace(/\s+/g, ' '),
        monthly: e.querySelector('[data-testid=email-plan-monthly]')?.textContent ?? null, total: e.querySelector('[data-testid=email-plan-total]')?.textContent ?? null,
        list: e.querySelector('[data-testid=email-plan-list]')?.textContent ?? null, discount: e.querySelector('[data-testid=email-plan-discount]')?.textContent ?? null,
        badge: e.querySelector('[data-testid=email-plan-badge]')?.textContent ?? null, cta: e.querySelector('[data-testid=email-plan-cta]')?.getAttribute('href'),
        features: [...e.querySelectorAll('[data-testid=email-plan-feature]')].map(f => f.textContent.trim()),
        storage: e.querySelector('[data-testid=email-plan-storage]')?.textContent ?? null, send: e.querySelector('[data-testid=email-plan-send]')?.textContent ?? null,
      })))
    }
    const pick = async c => { await p.getByTestId(`email-period-${c}`).click(); await p.waitForFunction(c => document.querySelector(`[data-testid=email-period-${c}]`)?.getAttribute('aria-checked') === 'true', c) }
    const periodBadge = c => p.getByTestId(`email-period-${c}`).locator('[data-testid=email-period-badge]').textContent().catch(() => null)
    await p.goto(BASE + '/email-corporativo', { waitUntil: 'domcontentloaded' })
    await p.getByTestId('email-period-3years').waitFor()
    const labels = await p.locator('[role=radiogroup][aria-label="Período de contratação"] [role=radio]').allInnerTexts()
    ok(labels.map(t => t.split('\n')[0].trim()).join('|') === '1 mês|1 ano|2 anos|3 anos', `selector com 4 períodos: ${labels.map(t => t.split('\n')[0]).join(', ')}`)
    for (const [c, months, label] of PERIODS) {
      await pick(c)
      const cards = await cardsOf()
      const bad = []
      for (const v of visible) {
        const k = cards.find(x => x.slug === v.slug); const base = Number(v.base_monthly_price)
        if (!k || num(k.monthly) !== base || num(k.total) !== base * months || k.list || k.discount || !/por caixa de correio/.test(k.text) || k.cta !== `/comprar/${v.slug}?ciclo=${c}`) bad.push(`${v.slug}:${JSON.stringify(k)}`)
      }
      ok(!bad.length, `${label}: preços actuais, sem etiqueta nem preço riscado, «por caixa de correio», «Configurar» com ?ciclo=${c}`, bad.join(' '))
      ok(!(await periodBadge(c)), `${label}: selector sem «Poupe/Até» com desconto 0`)
    }
    await pick('monthly')
    await p.locator('#planos').screenshot({ path: `${OUT}/desktop-01-antes.png` })

    // ── 4. Criar um plano no painel ──
    console.log('\n4. Criar plano no painel')
    const actx = await b.newContext(DESKTOP)
    await actx.addCookies([{ name: 'vh_session', value: adm.cookie.split('=')[1], url: BASE }])
    const ap = await actx.newPage()
    await ap.goto(BASE + '/admin/site/email-plans', { waitUntil: 'domcontentloaded' })
    await ap.waitForURL('**/admin/site/catalog?cat=email')
    ok(true, 'antiga página /admin/site/email-plans abre Catálogo e Preços → E-mail')
    await ap.getByTestId('email-plans-editor').waitFor()
    ok(await ap.getByTestId('email-plan-admin').count() === emailIds.length, `editor lista os ${emailIds.length} planos de e-mail`)
    await ap.getByTestId('email-plan-create').click()
    const f = ap.getByTestId('email-plan-new')
    const name = `Ensaio Mail ${rnd()}`
    await f.getByTestId('ep-name').fill(name)
    await f.getByTestId('ep-description').fill('Plano de ensaio <b>sem</b> HTML')
    await f.getByTestId('ep-storage').fill('10')
    await f.getByTestId('ep-send').fill('300')
    await f.getByTestId('ep-badge').fill('Mais popular')
    await f.getByTestId('ep-position').fill('5')
    await f.getByTestId('ep-status').selectOption('active')
    await f.getByTestId('ep-base').fill('790')
    const feats = ['Webmail e IMAP', 'Antispam', 'Calendário partilhado']
    await f.locator('[data-testid=ep-feature] input').first().fill(feats[0])
    for (const x of feats.slice(1)) { await f.getByTestId('ep-add-feature').click(); await f.locator('[data-testid=ep-feature] input').last().fill(x) }
    await f.locator('[data-testid=ep-feature]').nth(2).getByLabel('Subir').click() // Calendário sobe para 2.º
    for (const [c, d] of [['monthly', 0], ['1year', 30], ['2years', 50], ['3years', 70]]) await f.getByTestId(`ep-discount-${c}`).fill(String(d))
    ok(num(await f.getByTestId('ep-total-3years').innerText()) === 8532, `pré-visualização: 790 com 70% por 36 meses → ${await f.getByTestId('ep-total-3years').innerText()} por caixa`)
    ok((await f.getByTestId('ep-period-3years').innerText()).includes('237'), 'pré-visualização: Kz 237/caixa/mês')
    ok(/só descrevem o plano/.test(await f.getByTestId('ep-quota-note').innerText()), 'painel avisa que armazenamento e limite de envio não configuram quotas')
    await ap.screenshot({ path: `${OUT}/desktop-02-painel-novo.png`, fullPage: false })
    await f.getByTestId('ep-save').click()
    await ap.locator('[data-testid=email-plan-admin]', { hasText: name }).waitFor()
    created = await one('SELECT * FROM products WHERE name = ?', [name])
    ok(created && created.category === 'email' && created.slug.startsWith('email-') && created.description === 'Plano de ensaio bsem/b HTML', `plano criado (${created?.slug}), descrição sem HTML`)
    ok(Number(created.storage_gb) === 10 && Number(created.send_limit_hour) === 300 && created.badge === 'Mais popular' && Number(created.position) === 5 && Number(created.base_monthly_price) === 790, 'ficha gravada: 10 GB, 300/hora, etiqueta, ordem 5, base 790')
    let pp = await all('SELECT cycle, months, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id = ?', [created.id])
    const want = { monthly: [790, 0], '1year': [553 * 12, 30], '2years': [395 * 24, 50], '3years': [237 * 36, 70] }
    ok(Object.entries(want).every(([c, [price, d]]) => { const x = pp.find(y => y.cycle === c); return x && Number(x.price) === price && Number(x.discount_pct) === d && Number(x.active) === 1 }), `servidor calcula os totais: ${pp.map(x => `${x.cycle}=${Number(x.price)}`).join(' ')}`)
    ok(pp.every(x => Number(x.renewal_price) === 790 * Number(x.months)), 'renovação = base × meses (sem regra de desconto de renovação)')
    let ff = (await all('SELECT feature FROM product_features WHERE product_id = ? ORDER BY position', [created.id])).map(x => x.feature)
    ok(ff.join('|') === 'Webmail e IMAP|Calendário partilhado|Antispam', `características pela ordem escolhida: ${ff.join(', ')}`)
    r = await adm.req('/api/admin/catalog/email-plans', { method: 'POST', body: { ...plan0, name } })
    ok(r.status === 400 && r.json?.field === 'name', 'nome duplicado recusado')

    // ── 5. Editar o plano ──
    console.log('\n5. Editar plano')
    await ap.reload({ waitUntil: 'domcontentloaded' })
    const row = ap.locator('[data-testid=email-plan-admin]', { hasText: name })
    await row.locator('summary').click()
    const ef = row.getByTestId('email-plan-form')
    await ef.getByTestId('ep-description').fill('Para equipas pequenas')
    await ef.locator('[data-testid=ep-feature]').nth(1).getByLabel('Remover').click()
    await ef.getByTestId('ep-add-feature').click(); await ef.locator('[data-testid=ep-feature] input').last().fill('Suporte em português')
    await ef.locator('[data-testid=ep-feature]').nth(2).getByLabel('Subir').click()
    await ef.getByTestId('ep-send').fill('')
    await ef.getByTestId('ep-save').click()
    await ef.getByTestId('ep-msg').filter({ hasText: 'Guardado' }).waitFor()
    const ed = await one('SELECT description, send_limit_hour FROM products WHERE id = ?', [created.id])
    ff = (await all('SELECT feature FROM product_features WHERE product_id = ? ORDER BY position', [created.id])).map(x => x.feature)
    ok(ed.description === 'Para equipas pequenas' && ed.send_limit_hour == null, 'descrição editada; limite de envio removido (opcional)')
    ok(ff.join('|') === 'Webmail e IMAP|Suporte em português|Antispam', `características editadas, removidas e reordenadas: ${ff.join(', ')}`)
    ok(Number((await one("SELECT price FROM product_prices WHERE product_id = ? AND cycle = '3years'", [created.id])).price) === 8532, 'preços mantêm-se ao editar a ficha')

    // ── 6. Descontos diferentes por plano ──
    console.log('\n6. Descontos diferentes por plano')
    const starter = visible.find(v => v.slug === 'email-starter') ?? visible[0]
    const loadPlan = async id => (await adm.req('/api/admin/catalog/email-plans')).json.plans.find(x => x.id === id)
    const asInput = (pl, discounts) => ({ id: pl.id, name: pl.name, description: pl.description, storageGb: pl.storageGb, sendLimitHour: pl.sendLimitHour, features: pl.features, badge: pl.badge, position: pl.position, saleStatus: pl.saleStatus, baseMonthly: pl.baseMonthly,
      periods: pl.periods.map((x, i) => ({ cycle: x.cycle, discount: discounts[i], renewalDiscount: x.renewalDiscount })) })
    const sp = await loadPlan(starter.id)
    r = await adm.req('/api/admin/catalog/email-plans', { method: 'PUT', body: asInput(sp, [0, 20, 30, 40]) })
    ok(r.status === 200, `${starter.slug}: descontos 0/20/30/40 gravados → ${r.status}`)
    await p.reload({ waitUntil: 'domcontentloaded' })
    const exp = (v, c) => {
      const base = v.id === created.id ? 790 : Number(v.base_monthly_price)
      const d = v.id === created.id ? { monthly: 0, '1year': 30, '2years': 50, '3years': 70 }[c] : v.id === starter.id ? { monthly: 0, '1year': 20, '2years': 30, '3years': 40 }[c] : 0
      return { base, d }
    }
    const shown = [...visible, { id: created.id, slug: created.slug }]
    for (const [c, months, label] of PERIODS) {
      await pick(c)
      const cards = await cardsOf()
      const bad = []
      for (const v of shown) {
        const k = cards.find(x => x.slug === v.slug); const { base, d } = exp(v, c); const m = monthlyOf(base, d)
        if (!k) { bad.push(`${v.slug}: sem cartão`); continue }
        if (num(k.monthly) !== m || num(k.total) !== m * months) bad.push(`${v.slug}: ${k.monthly} / ${k.total} (esperado ${m} / ${m * months})`)
        if (d > 0 ? (k.discount !== `Poupe ${d}%` || num(k.list) !== base) : (k.discount || k.list)) bad.push(`${v.slug}: etiqueta ${k.discount} riscado ${k.list}`)
      }
      ok(!bad.length, `${label}: cada cartão com o seu % exacto, preço riscado só com desconto, mensal e total certos`, bad.join(' | '))
      const ds = shown.map(v => exp(v, c).d); const max = Math.max(...ds)
      const wantBadge = max === 0 ? null : ds.every(x => x === max) ? `Poupe ${max}%` : `Até ${max}%`
      ok((await periodBadge(c)) === wantBadge, `${label}: selector «${await periodBadge(c)}» (esperado ${wantBadge ?? 'nada'})`)
    }
    await pick('3years')
    let cards = await cardsOf()
    const mine = cards.find(x => x.slug === created.slug)
    ok(num(mine.monthly) === 237 && num(mine.total) === 8532 && num(mine.list) === 790, `exemplo: 790 com 70% por 36 meses → ${mine.monthly}/caixa/mês, total ${mine.total}`)
    ok(/36 meses pagos antecipadamente/.test(mine.text), 'período de 3 anos indicado como pago antecipadamente')
    ok(mine.badge === 'Mais popular' && /10 GB por caixa/.test(mine.storage ?? '') && mine.send == null, 'etiqueta e armazenamento da ficha; sem limite de envio quando vazio')
    ok(mine.features.join('|') === 'Webmail e IMAP|Suporte em português|Antispam', 'características pela ordem da ficha')
    const order = cards.map(x => x.slug)
    ok(order.indexOf(created.slug) === 0, `ordem de apresentação: ${order.join(', ')} (ordem 5 primeiro)`)
    ok(renewOf(mine.text) === 28440 && !/desconto de renovação/.test(mine.text), 'renovação ao preço base (790 × 36), sem anúncio de desconto de renovação')
    await p.locator('#planos').screenshot({ path: `${OUT}/desktop-03-3anos-descontos.png` })
    // mesmo desconto em todos → «Poupe X%»
    const saved = {}
    for (const v of shown) { const pl = await loadPlan(v.id); saved[v.id] = pl; const ds = pl.periods.map(x => x.discount); ds[1] = 15; await adm.req('/api/admin/catalog/email-plans', { method: 'PUT', body: asInput(pl, ds) }) }
    await p.reload({ waitUntil: 'domcontentloaded' })
    ok((await periodBadge('1year')) === 'Poupe 15%', `mesmo desconto em todos os planos → selector «${await periodBadge('1year')}»`)
    for (const v of shown) await adm.req('/api/admin/catalog/email-plans', { method: 'PUT', body: asInput(saved[v.id], saved[v.id].periods.map(x => x.discount)) })
    // desconto de renovação só anunciado se configurado
    const cp = await loadPlan(created.id)
    await adm.req('/api/admin/catalog/email-plans', { method: 'PUT', body: { ...asInput(cp, cp.periods.map(x => x.discount)), periods: cp.periods.map(x => ({ cycle: x.cycle, discount: x.discount, renewalDiscount: x.cycle === '1year' ? 10 : 0 })) } })
    await p.reload({ waitUntil: 'domcontentloaded' }); await pick('1year')
    cards = await cardsOf()
    ok(/desconto de renovação 10%/.test(cards.find(x => x.slug === created.slug).text) && renewOf(cards.find(x => x.slug === created.slug).text) === 8532, 'regra de renovação configurada (10%): anunciada e calculada (711 × 12 = 8 532)')
    await adm.req('/api/admin/catalog/email-plans', { method: 'PUT', body: asInput(cp, cp.periods.map(x => x.discount)) })

    // ── 7. Página inicial usa a mesma secção ──
    console.log('\n7. Página inicial')
    const hp = await ctx.newPage()
    await hp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await hp.locator('#email-plans [data-testid=email-plan-card]').first().waitFor()
    await hp.locator('#email-plans').getByTestId('email-period-3years').click()
    const homeMine = hp.locator('#email-plans [data-testid=email-plan-card]', { hasText: name })
    ok(num(await homeMine.getByTestId('email-plan-monthly').innerText()) === 237 && num(await homeMine.getByTestId('email-plan-total').innerText()) === 8532, 'página inicial: os mesmos valores (237/mês, 8 532 por 36 meses)')
    await hp.close()

    // ── 8. Configurar → compra com várias caixas; cartão = fluxo = carrinho = checkout ──
    console.log('\n8. Várias caixas: cartão, configuração, carrinho e checkout')
    await p.reload({ waitUntil: 'domcontentloaded' }); await pick('3years')
    await p.locator('[data-testid=email-plan-card]', { hasText: name }).getByTestId('email-plan-cta').click()
    await p.waitForURL(`**/comprar/${created.slug}?ciclo=3years`)
    await p.getByRole('radio', { name: 'Usar um domínio que já tenho' }).click()
    await p.getByPlaceholder('empresa.ao').fill(`mail-${rnd()}.ao`)
    await p.getByTestId('continue-own-domain').click(); await p.waitForURL('**passo=duracao**')
    ok(await p.getByTestId('cycle-3years').getAttribute('aria-checked') === 'true', '«Configurar» leva o período escolhido (3 anos)')
    for (let i = 0; i < 3; i++) await p.getByRole('button', { name: 'Mais uma caixa' }).click()
    const flowTotal = num(await p.getByTestId('flow-total').innerText())
    ok(flowTotal === 8532 * 4, `configuração: 4 caixas × 8 532 = ${flowTotal}`)
    ok((await p.getByTestId('cycle-3years').innerText()).includes('Poupe 70%') && /antecipadamente/.test(await p.getByTestId('cycle-3years').innerText()), 'configuração: «Poupe 70%» e pagamento antecipado')
    ok(!(await p.getByTestId('cycle-monthly').innerText()).includes('Poupe'), 'configuração: mensal sem etiqueta (desconto 0)')
    await p.screenshot({ path: `${OUT}/desktop-04-configurar.png` })
    await p.getByTestId('add-to-cart').click(); await p.waitForURL('**/carrinho')
    await p.getByTestId('summary-total').waitFor()
    const line = p.locator('[data-testid=cart-line]', { hasText: name })
    await line.getByTestId('line-discount').waitFor()
    ok(num(await line.getByTestId('line-total').innerText()) === 34128, `carrinho: total da linha ${await line.getByTestId('line-total').innerText()}`)
    ok(/4 caixas de correio/.test(await line.getByTestId('line-quantity').innerText()), `carrinho: ${await line.getByTestId('line-quantity').innerText()}`)
    ok(/Desconto 70%/.test(await line.getByTestId('line-discount').innerText()) && num((await line.getByTestId('line-discount').innerText()).split('(')[1]) === 790 * 36 * 4 - 34128, `carrinho: ${await line.getByTestId('line-discount').innerText()}`)
    ok(/36 meses pagos antecipadamente/.test(await line.getByTestId('line-period').innerText()), `carrinho: ${await line.getByTestId('line-period').innerText()}`)
    ok(num(await p.getByTestId('summary-subtotal').innerText()) === 34128, 'resumo do carrinho: subtotal igual ao cartão × caixas')
    await p.screenshot({ path: `${OUT}/desktop-05-carrinho.png`, fullPage: true })
    // servidor: cotação directa igual
    const q = await (await p.request.post(BASE + '/api/checkout/quote', { data: { lines: [{ type: 'product', slug: created.slug, cycle: '3years', quantity: 4, domain: 'exemplo-ensaio.ao', domainMode: 'existing' }] } })).json()
    ok(q.quote.lines[0].lineTotal === 34128 && q.quote.lines[0].unitPrice === 8532 && q.quote.lines[0].discountPct === 70 && q.quote.lines[0].listTotal === 790 * 36 * 4, 'cotação do servidor: 8 532 × 4, desconto 70%')
    for (const [c, months] of PERIODS) {
      const qq = await (await p.request.post(BASE + '/api/checkout/quote', { data: { lines: [{ type: 'product', slug: created.slug, cycle: c, quantity: 2, domain: 'exemplo-ensaio.ao', domainMode: 'existing' }] } })).json()
      const d = { monthly: 0, '1year': 30, '2years': 50, '3years': 70 }[c]
      ok(qq.quote.lines[0].lineTotal === monthlyOf(790, d) * months * 2 && (d === 0 ? qq.quote.lines[0].listTotal == null : true), `cotação ${c} × 2 caixas = ${qq.quote.lines[0].lineTotal}`)
    }
    // checkout com cliente 1
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/conta')
    await p.getByTestId('tab-login').click()
    await p.locator('#l-email').fill('cliente1@ensaio.test'); await p.locator('#l-pass').fill('Cliente#Um2026')
    await p.getByTestId('login-submit').click()
    await p.waitForURL(/\/checkout\/(pagamento|dados)/)
    if (p.url().includes('/checkout/dados')) { await p.getByRole('button', { name: /Continuar|Guardar/ }).first().click(); await p.waitForURL('**/checkout/pagamento') }
    await p.getByTestId('summary-total').waitFor()
    ok(/Desconto 70%/.test(await p.getByTestId('summary-discount').first().innerText()), 'checkout: resumo com o desconto')
    await p.locator('[data-testid=to-review]:not([disabled])').waitFor()
    await p.getByTestId('to-review').click()
    await p.getByTestId('review-lines').waitFor()
    const rev = await p.getByTestId('review-lines').innerText()
    ok(/× 4 caixas/.test(rev) && /36 meses pagos antecipadamente/.test(rev) && /Desconto 70%/.test(rev), 'revisão: 4 caixas, 36 meses antecipados, desconto 70%')
    const reviewTotal = num(await p.getByTestId('review-total').innerText())
    const sub = num(await p.getByTestId('summary-subtotal').innerText())
    ok(sub === 34128 && sub === flowTotal, `cartão × caixas = configuração = carrinho = checkout (${sub}); total com impostos ${reviewTotal}`)
    await p.screenshot({ path: `${OUT}/desktop-06-revisao.png`, fullPage: true })

    // ── 9. Preço alterado com o plano no carrinho ──
    console.log('\n9. Administrador altera o preço com o plano no carrinho')
    const cp2 = await loadPlan(created.id)
    r = await adm.req('/api/admin/catalog/email-plans', { method: 'PUT', body: { ...asInput(cp2, cp2.periods.map(x => x.discount)), baseMonthly: 800 } })
    ok(r.status === 200, 'preço base 790 → 800 (3 anos: 240 × 36 = 8 640)')
    await p.getByTestId('accept-terms').check()
    await p.getByTestId('confirm-order').click()
    await p.getByTestId('submit-error').waitFor()
    ok(/total foi actualizado/.test(await p.getByTestId('submit-error').innerText()), 'confirmação recusada: «o total foi actualizado»')
    await p.waitForFunction(() => document.querySelector('[data-testid=summary-subtotal]')?.textContent?.replace(/\D/g, '') === '34560')
    ok(num(await p.getByTestId('summary-subtotal').innerText()) === 8640 * 4, `novo total mostrado antes de confirmar: ${await p.getByTestId('summary-subtotal').innerText()}`)
    ok(Number((await one("SELECT COUNT(*) n FROM order_items WHERE product_name = ? OR product_id = ?", [name, created.id]).catch(() => ({ n: 0 }))).n) === 0, 'nenhuma encomenda criada com o total antigo')
    await p.getByTestId('confirm-order').click(); await p.waitForURL('**/orders/**')
    const oi = await one('SELECT oi.order_id, oi.unit_price, oi.line_total, oi.quantity, oi.months, oi.billing_cycle, o.payment_status FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.service_type = ? AND oi.line_total = ? ORDER BY o.created_at DESC LIMIT 1', ['email', 34560])
    if (oi) createdOrders.push(oi.order_id)
    ok(oi && Number(oi.unit_price) === 8640 && Number(oi.quantity) === 4 && Number(oi.months) === 36 && oi.billing_cycle === '3years', `encomenda de ensaio: 4 × 8 640, 36 meses (${oi?.payment_status}, sem cobrança)`)
    await p.screenshot({ path: `${OUT}/desktop-07-encomenda.png` })

    // ── 10. Encomendas e facturas emitidas preservadas ──
    console.log('\n10. Encomendas e facturas emitidas preservadas')
    const after = await all(`SELECT id, order_id, price, unit_price, line_total, renewal_price, quantity, billing_cycle, months FROM order_items WHERE service_type = 'email' AND id IN (${snapOrders.map(() => '?').join(',') || "''"}) ORDER BY id`, snapOrders.map(o => o.id))
    ok(JSON.stringify(after) === JSON.stringify(snapOrders), `${snapOrders.length} itens de e-mail já encomendados mantêm os valores`)
    const invAfter = await all("SELECT ii.* FROM invoice_items ii JOIN products p ON p.id = ii.product_id WHERE p.category = 'email' AND ii.id IN (" + (snapInvoices.map(() => '?').join(',') || "''") + ') ORDER BY ii.id', snapInvoices.map(x => x.id)).catch(() => [])
    ok(JSON.stringify(invAfter) === JSON.stringify(snapInvoices), `${snapInvoices.length} itens de factura de e-mail inalterados`)

    // ── 11. Telemóvel ──
    console.log('\n11. Telemóvel')
    const mctx = await b.newContext(IPHONE)
    const mp = await mctx.newPage()
    await mp.goto(BASE + '/email-corporativo#planos', { waitUntil: 'domcontentloaded' })
    await mp.locator('[data-testid=email-plan-card]').first().waitFor()
    await mp.getByTestId('email-period-3years').click()
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ok(overflow <= 0, `sem deslocamento horizontal (${overflow}px)`)
    const sel = await mp.locator('[role=radiogroup][aria-label="Período de contratação"]').boundingBox()
    ok(sel && sel.width <= 390, `selector cabe no ecrã (${Math.round(sel?.width)}px)`)
    await mp.locator('#planos').screenshot({ path: `${OUT}/iphone-01-planos.png` })
    await mp.locator('[data-testid=email-plan-card]', { hasText: name }).screenshot({ path: `${OUT}/iphone-02-cartao.png` })
    await mctx.close()
    ok(errors.length === 0, 'sem erros de consola', errors.join(' | '))
    await ap.screenshot({ path: `${OUT}/desktop-08-painel.png` })
    await actx.close(); await ctx.close()
  } catch (e) {
    ok(false, 'execução', e.stack)
  } finally {
    // Repor o catálogo de e-mail como estava; o plano de ensaio sai do site (fica em rascunho se já tiver encomendas)
    const val = v => (v != null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v)
    try {
      await db.beginTransaction()
      if (created) {
        await db.query('DELETE FROM product_features WHERE product_id = ?', [created.id])
        const refs = Number((await one('SELECT COUNT(*) n FROM invoice_items WHERE product_id = ?', [created.id]).catch(() => ({ n: 0 }))).n)
        if (refs) await db.query("UPDATE products SET active = 0, sale_status = 'draft' WHERE id = ?", [created.id])
        else { await db.query('DELETE FROM product_prices WHERE product_id = ?', [created.id]); await db.query('DELETE FROM products WHERE id = ?', [created.id]) }
      }
      for (const pr of snapProducts) {
        const cols = ['name', 'description', 'storage_gb', 'send_limit_hour', 'badge', 'popular', 'position', 'sale_status', 'base_monthly_price', 'price_monthly', 'price_6months', 'price_1year', 'price_2years', 'price_3years']
        await db.query(`UPDATE products SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => pr[c]), pr.id])
      }
      await db.query(`DELETE FROM product_prices WHERE product_id IN ${inIds}`, emailIds)
      for (const x of snapPrices) { const k = Object.keys(x); await db.query(`INSERT INTO product_prices (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      await db.query(`DELETE FROM product_features WHERE product_id IN ${inIds}`, emailIds)
      for (const x of snapFeatures) { const k = Object.keys(x); await db.query(`INSERT INTO product_features (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => val(x[c]))) }
      for (const x of snapSite) { const k = Object.keys(x).filter(c => c !== 'id'); await db.query(`UPDATE site_email_plans SET ${k.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...k.map(c => val(x[c])), x.id]) }
      await db.commit()
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente1@ensaio.test'")
      const restored = await all(`SELECT product_id, cycle, price, renewal_price, active, discount_pct FROM product_prices WHERE product_id IN ${inIds}`, emailIds)
      restored.sort((a, c) => a.product_id.localeCompare(c.product_id) || a.cycle.localeCompare(c.cycle))
      const orig = snapPrices.map(x => ({ product_id: x.product_id, cycle: x.cycle, price: x.price, renewal_price: x.renewal_price, active: x.active, discount_pct: x.discount_pct })).sort((a, c) => a.product_id.localeCompare(c.product_id) || a.cycle.localeCompare(c.cycle))
      ok(JSON.stringify(restored) === JSON.stringify(orig), 'catálogo de e-mail reposto como estava')
      await fetch(BASE + '/api/products?category=email', { cache: 'no-store' })
    } catch (e) { await db.rollback().catch(() => {}); ok(false, 'reposição do catálogo (nada alterado: transacção desfeita)', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}${createdOrders.length ? ` · encomendas de ensaio: ${createdOrders.join(', ')}` : ''}`)
    process.exit(fail ? 1 : 0)
  }
})()
