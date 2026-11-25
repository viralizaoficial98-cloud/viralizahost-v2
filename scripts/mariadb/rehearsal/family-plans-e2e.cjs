// Planos editáveis de Revenda, Criador de Sites e Construtor WordPress (Catálogo e Preços): criação no painel,
// página pública (descrição, características pela ordem, etiqueta, desconto), só 1 mês/1/2/3 anos (painel, página,
// compra, carrinho, servidor), preços iguais até ao checkout, carrinho antigo com ciclo retirado, renovação de um
// contrato antigo; «Nossas Marcas» (só texto) no submenu Empresa; hero do painel em Sobre nós, Parceria e Suporte.
// Desktop + iPhone. Repõe catálogo, banners e carrinhos no fim. Sem encomendas.
//   BASE_URL=http://localhost:3000 OUT=/tmp/family node --env-file=.env.local scripts/mariadb/rehearsal/family-plans-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const zlib = require('node:zlib')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-family'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 400) : ''}`) }
const num = s => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const RND = Math.random().toString(36).slice(2, 6)
const FOR_SALE = ['monthly', '1year', '2years', '3years']
const MONTHS = { monthly: 1, '1year': 12, '2years': 24, '3years': 36 }
const total = (base, m, d) => Math.round(Math.round(base * 100) * m * (100 - d) / 100) / 100
const FAMILIES = [
  { key: 'reseller', page: '/revenda-de-hospedagem', where: "category = 'reseller' AND subcategory IS NULL", needsDomain: false },
  { key: 'website-builder', page: '/criador-de-sites', where: "category = 'website-builder' AND subcategory IS NULL", needsDomain: true },
  { key: 'wp-builder', page: '/construtor-wordpress', where: "category = 'wordpress' AND subcategory = 'builder'", needsDomain: true },
]
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

function png(w, h, r) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = r; raw[i + 1] = Math.round(120 * x / w); raw[i + 2] = Math.round(200 * y / h) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json, text: t }
  }
}
async function ctxFor(b, opts, cookie, initCart) {
  const ctx = await b.newContext({ ...opts })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  if (initCart) await ctx.addInitScript(c => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('viralizahost-cart-v2', c); sessionStorage.setItem('seeded', '1') } }, initCart)
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.on('dialog', d => d.accept())
  return { ctx, p }
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const famIds = {}
  for (const f of FAMILIES) famIds[f.key] = (await all(`SELECT id FROM products WHERE ${f.where}`)).map(r => r.id)
  const allIds = Object.values(famIds).flat(), inA = `(${allIds.map(() => '?').join(',')})`
  const snapProducts = JSON.stringify(await all(`SELECT id, name, description, sale_status, position, badge, popular, base_monthly_price, service_type, provisioning FROM products WHERE id IN ${inA} ORDER BY id`, allIds))
  const snapPrices = JSON.stringify(await all(`SELECT product_id, cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id IN ${inA} ORDER BY product_id, cycle`, allIds))
  const SLUGS = ['sobre', 'parcerias', 'suporte', 'hospedagem-de-sites']
  const snapBanners = await all(`SELECT * FROM banner_pages WHERE page_slug IN (${SLUGS.map(() => '?').join(',')})`, SLUGS)
  const ordersBefore = Number((await one('SELECT COUNT(*) n FROM orders')).n)
  const adm = new S(), c1 = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const c1id = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id
  const quote = async lines => (await c1.req('/api/checkout/quote', { method: 'POST', body: { lines } })).json
  const b = await chromium.launch()
  const created = [], fixtures = []
  let ctx, p
  try {
    // ── 0. Preservação e permissões ──
    console.log('\n0. Planos existentes preservados; permissões')
    for (const f of FAMILIES) {
      const r = await adm.req(`/api/admin/catalog/family-plans?family=${f.key}`)
      const priced = r.json.plans.filter(x => x.periods.some(y => y.exists))
      ok(r.status === 200 && r.json.plans.length === famIds[f.key].length && priced.every(x => x.periods.filter(y => y.exists).every(y => y.matchesRule)), `${f.key}: ${r.json.plans.length} plano(s) existentes; preços guardados seguem a regra (desconto 0%, base proposta a partir de 1 mês)`)
      ok(priced.every(x => x.otherCycles.every(c => ['3months', '6months'].includes(c.cycle))), `${f.key}: 3 e 6 meses mantidos como ciclos retirados (${priced[0]?.otherCycles.map(c => c.cycle).join(', ') || 'nenhum'})`)
    }
    ok((await c1.req('/api/admin/catalog/family-plans?family=reseller')).status === 403 && (await c1.req('/api/admin/catalog/family-plans?family=reseller', { method: 'POST', body: { name: 'x' } })).status === 403, 'cliente: editor recusado (403)')
    let r = await adm.req('/api/admin/catalog/family-plans?family=website-builder', { method: 'POST', body: { name: 'Ensaio inválido', saleStatus: 'active', baseMonthly: 1000, periods: [{ cycle: '6months', discount: 0, publish: true }] } })
    ok(r.status === 400 && /1 mês, 1 ano, 2 anos ou 3 anos/.test(r.json?.error), `servidor: gravar 6 meses → 400 («${r.json?.error}»)`)

    // ── 1. Painel: criar um plano em cada categoria ──
    console.log('\n1. Painel: criar um plano por categoria')
    ;({ ctx, p } = await ctxFor(b, { viewport: { width: 1440, height: 2000 } }, adm.cookie))
    await p.goto(BASE + '/admin/site/catalog?cat=hosting', { waitUntil: 'domcontentloaded' })
    for (const [i, f] of FAMILIES.entries()) {
      const sec = p.getByTestId(`family-plans-admin-${f.key}`); await sec.getByTestId('fp-create').waitFor({ timeout: 15000 })
      await sec.getByTestId('fp-create').click()
      const form = sec.getByTestId('fp-new')
      const name = `Ensaio ${f.key} ${RND}`
      await form.getByTestId('fp-name').fill(name)
      await form.getByTestId('fp-description').fill(`Descrição de ensaio para ${f.key}`)
      await form.getByTestId('fp-status').selectOption('active')
      await form.getByTestId('fp-position').fill('1')
      await form.getByTestId('fp-badge').fill('Mais popular')
      await form.getByTestId('fp-highlight').check()
      // Três características com ícones; a terceira sobe para segundo lugar
      const feats = [['Primeira característica', 'shield'], ['Segunda característica', 'zap'], ['Terceira característica', 'headphones']]
      for (let k = 0; k < 3; k++) {
        if (k > 0) await form.getByTestId('fp-add-feature').click()
        await form.getByTestId('fp-feature-text').nth(k).fill(feats[k][0])
        await form.getByTestId('fp-feature-icon').nth(k).selectOption(feats[k][1])
      }
      await form.getByTestId('fp-feature-up').nth(2).click()
      const base = 10000 + i * 1000
      await form.getByTestId('fp-base').fill(String(base))
      const disc = { monthly: 0, '1year': 10, '2years': 20, '3years': 30 }
      for (const c of FOR_SALE) { await form.getByTestId(`fp-discount-${c}`).fill(String(disc[c])); await form.getByTestId(`fp-publish-${c}`).check() }
      ok(await form.locator('[data-testid^=fp-period-]').count() === 4 && await form.getByTestId('fp-period-3months').count() === 0 && await form.getByTestId('fp-period-6months').count() === 0, `${f.key}: editor só com 1 mês, 1 ano, 2 anos e 3 anos`)
      await form.getByTestId('fp-preview-1year').click()
      const prev = form.getByTestId('fp-preview')
      ok(num((await prev.getByTestId('fam-plan-total').innerText())) === total(base, 12, 10) && /Poupe 10%/.test(await prev.innerText()) && await prev.getByTestId('fam-plan-list').count() === 1, `${f.key}: pré-visualização 1 ano = ${total(base, 12, 10)} Kz, preço riscado e «Poupe 10%»`)
      ok(/equivalente mensal/.test(await form.getByTestId('fp-preview-summary').innerText()), 'pré-visualização: total do período e equivalente mensal')
      await form.getByTestId('fp-preview-monthly').click()
      ok(await prev.getByTestId('fam-plan-discount').count() === 0 && await prev.getByTestId('fam-plan-list').count() === 0, `${f.key}: 1 mês (0%) sem preço riscado nem «Poupe»`)
      if (i === 0) await form.screenshot({ path: `${OUT}/desktop-01-painel-novo-plano.png` })
      await form.getByTestId('fp-save').click()
      await sec.getByTestId('fp-msg').filter({ hasText: /criado|Guardado/ }).waitFor({ timeout: 10000 }).catch(() => {})
      const row = await one(`SELECT id, slug, base_monthly_price, badge, popular, position, service_type, provisioning FROM products WHERE ${f.where} AND name = ?`, [name])
      ok(!!row && Number(row.base_monthly_price) === base && row.badge === 'Mais popular' && Number(row.popular) === 1, `${f.key}: plano «${name}» criado (${row?.slug}; activação ${row?.service_type}/${row?.provisioning}, como os existentes)`)
      if (row) created.push({ ...f, id: row.id, slug: row.slug, name, base, disc })
      const pr = row ? await all('SELECT cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id = ? ORDER BY months', [row.id]) : []
      ok(pr.length === 4 && pr.every(x => FOR_SALE.includes(x.cycle) && Number(x.price) === total(base, MONTHS[x.cycle], disc[x.cycle]) && Number(x.renewal_price) === total(base, MONTHS[x.cycle], 0)), `${f.key}: preços calculados no servidor (renovação ao preço base)`)
    }
    await ctx.close()

    // ── 2. Páginas públicas ──
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      console.log(`\n2. Páginas públicas (${label})`)
      ;({ ctx, p } = await ctxFor(b, opts))
      for (const c of created) {
        await p.goto(BASE + c.page, { waitUntil: 'domcontentloaded' })
        const card = p.locator(`[data-testid=fam-plan-card][data-slug="${c.slug}"]`); await card.waitFor()
        const periods = await p.locator('[data-testid^=fam-period-]').evaluateAll(x => x.map(y => y.dataset.testid.replace('fam-period-', '')))
        ok(JSON.stringify(periods) === JSON.stringify(FOR_SALE), `${c.page}: períodos ${periods.join(', ')}`)
        ok((await card.getByTestId('fam-plan-description').innerText()) === `Descrição de ensaio para ${c.key}` && (await card.getByTestId('fam-plan-badge').innerText()).toLowerCase() === 'mais popular', `${c.page}: descrição e etiqueta`)
        const fts = await card.getByTestId('fam-plan-feature').allInnerTexts()
        ok(JSON.stringify(fts) === JSON.stringify(['Primeira característica', 'Terceira característica', 'Segunda característica']), `${c.page}: características pela ordem do painel (${fts.join(' · ')})`)
        ok(await card.getByTestId('fam-plan-discount').count() === 0, `${c.page}: 1 mês sem «Poupe»`)
        await p.getByTestId('fam-period-2years').click()
        ok(/Poupe 20%/.test(await card.getByTestId('fam-plan-discount').innerText()) && num(await card.getByTestId('fam-plan-total').innerText()) === total(c.base, 24, 20)
          && /Renova por/.test(await card.getByTestId('fam-plan-renewal').innerText()) && num((await card.getByTestId('fam-plan-renewal').innerText()).split('a cada')[0]) === total(c.base, 24, 0), `${c.page}: 2 anos — «Poupe 20%», a pagar agora ${total(c.base, 24, 20)} Kz, renova por ${total(c.base, 24, 0)} Kz`)
        ok(await overflow(p) <= 1, `${c.page}: sem deslocamento horizontal`)
        await p.addStyleTag({ content: 'header { position: absolute !important } [data-floating] { display: none !important }' })
        await p.locator('[data-testid^=family-plans-]').first().screenshot({ path: `${OUT}/${label}-02-planos-${c.key}.png` })
      }
      // Planos existentes: preço = catálogo; revenda sob consulta → «Pedir proposta»
      await p.goto(BASE + '/criador-de-sites', { waitUntil: 'domcontentloaded' })
      const ia = p.locator('[data-testid=fam-plan-card][data-slug="ia-pro"]'); await ia.waitFor()
      const iaPrice = await one("SELECT price FROM product_prices pp JOIN products x ON x.id = pp.product_id WHERE x.slug = 'ia-pro' AND pp.cycle = 'monthly'")
      ok(num(await ia.getByTestId('fam-plan-monthly').innerText()) === Number(iaPrice.price) && await ia.getByTestId('fam-plan-discount').count() === 0, `plano existente «ia-pro»: ${iaPrice.price} Kz/mês, sem desconto (igual ao catálogo)`)
      await p.goto(BASE + '/revenda-de-hospedagem', { waitUntil: 'domcontentloaded' })
      const rs = p.locator('[data-testid=fam-plan-card][data-slug="reseller-start"]'); await rs.waitFor()
      ok(await rs.getByTestId('fam-plan-onrequest').count() === 1 && await rs.getByTestId('fam-plan-cta').getAttribute('href') === '/comprar/reseller-start' && /Pedir proposta/.test(await rs.getByTestId('fam-plan-cta').innerText()), 'revenda sob consulta: «Pedir proposta» mantido')
      await rs.getByTestId('fam-plan-cta').click(); await p.waitForURL('**/comprar/reseller-start')
      ok(await p.getByRole('button', { name: /Pedir proposta/ }).count() === 1, 'formulário de proposta aberto')
      ok(!p.errors.length, 'sem erros', p.errors.join(' | '))
      await ctx.close()
    }

    // ── 3. Compra: preços iguais até ao checkout ──
    console.log('\n3. Configuração da compra, carrinho e checkout (cliente)')
    for (const c of created) {
      await db.query("UPDATE shopping_carts c JOIN profiles x ON x.id = c.profile_id SET c.items = '[]' WHERE x.email = 'cliente1@ensaio.test'")
      ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
      await p.goto(BASE + c.page, { waitUntil: 'domcontentloaded' })
      const card = p.locator(`[data-testid=fam-plan-card][data-slug="${c.slug}"]`); await card.waitFor()
      await p.getByTestId('fam-period-3years').click()
      await card.getByTestId('fam-plan-cta').click(); await p.waitForURL(`**/comprar/${c.slug}**`)
      ok(/ciclo=3years/.test(p.url()), `${c.key}: «Comprar agora» leva à configuração com 3 anos`)
      if (c.needsDomain) {
        await p.getByRole('radio', { name: /Usar um domínio que já tenho/ }).click()
        await p.getByPlaceholder('empresa.ao').fill(`ensaio-${c.key}-${RND}.ao`)
        await p.getByTestId('continue-own-domain').click(); await p.waitForURL('**passo=duracao**')
      }
      await p.getByTestId('cycle-3years').waitFor()
      const cyc = await p.locator('[data-testid^=cycle-]').evaluateAll(x => x.map(y => y.dataset.testid).filter(t => /^cycle-(monthly|\dyears?|1year|\dmonths)$/.test(t)).map(t => t.replace('cycle-', '')))
      ok(JSON.stringify(cyc) === JSON.stringify(FOR_SALE), `${c.key}: configuração da compra só com ${cyc.join(', ')}`)
      await p.getByTestId('cycle-3years').click()
      const flow = num(await p.getByTestId('flow-total').innerText())
      ok(flow === total(c.base, 36, 30), `${c.key}: total da configuração ${flow} = cartão = ${total(c.base, 36, 30)}`)
      await p.getByTestId('add-to-cart').click(); await p.waitForURL('**/carrinho')
      await p.getByTestId('cart-line').first().waitFor(); await p.waitForTimeout(800)
      const q = await quote([{ type: 'product', slug: c.slug, cycle: '3years', quantity: 1, ...(c.needsDomain ? { domain: `ensaio-${c.key}-${RND}.ao`, domainMode: 'existing' } : {}) }])
      const ql = q.quote.lines[0]
      ok(!ql.error && ql.lineTotal === flow && ql.renewalPrice === total(c.base, 36, 0), `${c.key}: servidor (cotação) ${ql.lineTotal} Kz, renovação ${ql.renewalPrice} Kz`)
      ok(num(await p.getByTestId('summary-total').innerText()) >= flow, `${c.key}: carrinho com o mesmo total`)
      await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/**')
      await p.getByTestId('summary-total').waitFor({ timeout: 15000 })
      const chk = num(await p.getByTestId('summary-total').innerText())
      ok(chk === q.quote.total, `${c.key}: checkout ${chk} Kz = cotação do servidor (${q.quote.total} Kz)`)
      if (c.key === 'website-builder') await p.screenshot({ path: `${OUT}/desktop-03-checkout-${c.key}.png`, fullPage: true })
      await ctx.close()
    }

    // ── 4. Ciclos retirados ──
    console.log('\n4. Ciclos retirados (3 e 6 meses)')
    let q = await quote([{ type: 'product', slug: 'ia-pro', cycle: '6months', quantity: 1, domain: `retirado-${RND}.ao`, domainMode: 'existing' }])
    let l0 = q.quote.lines[0]
    ok(l0.error?.code === 'cycle_retired_plan' && JSON.stringify(l0.cycles.map(x => x.cycle)) === JSON.stringify(FOR_SALE), `pedido directo ao servidor com 6 meses → recusado («${l0.error?.message}»); alternativas: ${l0.cycles.map(x => x.cycle).join(', ')}`)
    q = await quote([{ type: 'product', slug: 'wp-builder-start', cycle: '3months', quantity: 1, domain: `retirado-${RND}.ao`, domainMode: 'existing' }])
    ok(q.quote.lines[0].error?.code === 'cycle_retired_plan', 'Construtor WordPress com 3 meses → recusado')
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ type: 'product', slug: 'ia-pro', cycle: '6months', quantity: 1, domain: `retirado-${RND}.ao`, domainMode: 'existing' }], acceptedTotal: 186600, paymentMethod: 'bank_transfer', proofFile: null } })
    ok(r.status === 409 && r.json?.code === 'cart_invalid', `encomenda directa com 6 meses → ${r.status} ${r.json?.code}`)
    ok(Number((await one('SELECT COUNT(*) n FROM orders')).n) === ordersBefore, 'nenhuma encomenda criada')
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      const cart = JSON.stringify({ state: { lines: [
        { key: 'k-6m', type: 'product', slug: 'ia-pro', cycle: '6months', quantity: 1, domain: `antigo-${RND}.ao`, domainMode: 'existing' },
        { key: 'k-ok', type: 'product', slug: 'wp-builder-start', cycle: 'monthly', quantity: 1, domain: `antigo2-${RND}.ao`, domainMode: 'existing' }], idempotencyKey: null }, version: 0 })
      ;({ ctx, p } = await ctxFor(b, opts, null, cart))
      await p.goto(BASE + '/carrinho', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('cart-line').first().waitFor(); await p.waitForTimeout(1200)
      const lines = p.getByTestId('cart-line')
      const l6 = lines.filter({ hasText: /IA Pro|ia-pro/i }).first()
      ok(await lines.count() === 2 && /deixou de estar disponível/.test(await l6.innerText()), `${label}: carrinho antigo — item de 6 meses pede outro período; o outro item mantém-se`)
      const opt = await l6.getByTestId('line-cycle').locator('option').evaluateAll(x => x.map(y => ({ v: y.value, d: y.disabled })))
      ok(opt.some(x => x.v === '6months' && x.d) && opt.filter(x => !x.d).map(x => x.v).join() === FOR_SALE.join(), `${label}: selector com «escolha outro período» e só 1 mês/1/2/3 anos`)
      ok(await p.getByTestId('finalize').isDisabled(), `${label}: «Finalizar» bloqueado até escolher`)
      if (label === 'desktop') await p.screenshot({ path: `${OUT}/desktop-04-carrinho-antigo.png`, fullPage: true })
      await l6.getByTestId('line-cycle').selectOption('1year'); await p.waitForTimeout(1200)
      ok(await p.getByTestId('finalize').isEnabled() && await lines.count() === 2, `${label}: escolhido 1 ano → «Finalizar» disponível, itens mantidos`)
      await ctx.close()
    }
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/comprar/ia-pro?ciclo=6months&passo=duracao', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    ok(await p.getByTestId('cycle-6months').count() === 0 && await p.getByTestId('cycle-3months').count() === 0, 'configuração da compra com ?ciclo=6months: período não oferecido')
    await ctx.close()

    // ── 5. Contrato antigo: renovação ──
    console.log('\n5. Renovação de contratos antigos')
    const iaId = (await one("SELECT id FROM products WHERE slug = 'ia-pro'")).id
    for (const [cy, price] of [['6months', 186600], ['3months', 93300]]) {
      const id = randomUUID(); fixtures.push(id)
      await db.query("INSERT INTO services (id, profile_id, product_id, service_type, service_name, status, billing_cycle, price, renewal_price, next_due_date, provisioning_status) VALUES (?, ?, ?, 'hosting', ?, 'active', ?, ?, ?, CURRENT_DATE + INTERVAL 10 DAY, 'active')", [id, c1id, iaId, `Criador de Sites (ensaio, ${cy})`, cy, price, price])
      const rq = await quote([{ type: 'renewal', serviceId: id }])
      ok(!rq.quote.lines[0].error && rq.quote.lines[0].lineTotal === price && rq.quote.lines[0].cycle === cy, `renovação de contrato antigo de ${cy} continua possível (${rq.quote.lines[0].lineTotal} Kz)`, JSON.stringify(rq.quote.lines[0].error))
    }

    // ── 6. «Nossas Marcas» ──
    console.log('\n6. Submenu Empresa: «Nossas Marcas»')
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/sobre', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
    await p.getByTestId('nav-empresa').click(); await p.waitForTimeout(500)
    const panel = p.getByTestId('nav-panel')
    const cols = await panel.getByTestId('nav-column').evaluateAll(cs => cs.map(c => ({ title: c.querySelector('p').textContent.trim(), links: [...c.querySelectorAll('a')].map(a => a.getAttribute('href')), texts: [...c.querySelectorAll('[data-testid=nav-text]')].map(t => t.textContent.trim()) })))
    const marcas = cols.find(c => c.title === 'Nossas Marcas')
    ok(!!marcas && JSON.stringify(marcas.texts) === JSON.stringify(['Viralizastudio', 'Automação com IA']) && marcas.links.length === 0, `«Nossas Marcas»: ${marcas?.texts.join(', ')} — sem links`)
    const inter = await panel.getByTestId('nav-texts').evaluate(u => ({ ctrl: u.querySelectorAll('a,button,[href],[role=button],[tabindex]').length, cursor: getComputedStyle(u.querySelector('li')).cursor }))
    ok(inter.ctrl === 0 && inter.cursor !== 'pointer' && await panel.locator('a[href="#"]').count() === 0, `sem links, botões ou href="#"; cursor ${inter.cursor}`)
    ok(JSON.stringify(cols.find(c => c.title === 'Empresa').links) === JSON.stringify(['/sobre', '/suporte', '/parcerias', '/blog']) && await panel.getByTestId('nav-aside').count() === 1, 'links da Empresa e cartão «Fale com um especialista» mantidos')
    await p.screenshot({ path: `${OUT}/desktop-05-submenu-empresa.png`, clip: { x: 0, y: 0, width: 1440, height: 480 } })
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, IPHONE))
    await p.goto(BASE + '/sobre', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
    await p.getByTestId('mobile-menu-toggle').click(); await p.getByTestId('mnav-empresa').click(); await p.waitForTimeout(400)
    const mp = p.getByTestId('mnav-panel')
    const texts = await mp.getByTestId('mnav-text').allInnerTexts()
    const [tb, lastLink, card] = [await mp.getByTestId('mnav-text').last().boundingBox(), await mp.getByTestId('mnav-item').last().boundingBox(), await mp.getByTestId('mnav-aside').boundingBox()]
    ok(JSON.stringify(texts) === JSON.stringify(['Viralizastudio', 'Automação com IA']) && tb.y > lastLink.y && tb.y < card.y, 'telemóvel: «Nossas Marcas» depois dos links e antes do cartão')
    ok(await mp.getByTestId('mnav-text').evaluateAll(x => x.every(e => !e.closest('a,button') && getComputedStyle(e).cursor !== 'pointer')), 'telemóvel: só texto')
    await mp.getByTestId('mnav-text').first().scrollIntoViewIfNeeded()
    await p.screenshot({ path: `${OUT}/iphone-05-submenu-empresa.png` })
    await ctx.close()

    // ── 7. Heros: Sobre nós, Parceria, Suporte ──
    console.log('\n7. Hero do painel em Sobre nós, Parceria e Suporte')
    const heroes = { sobre: { path: '/sobre', tid: 'sobre-hero', below: 'sobre-contactos', btns: [] }, parcerias: { path: '/parcerias', tid: 'parcerias-hero', btns: ['/register?ref=parceiro', '/suporte/tickets'] }, suporte: { path: '/suporte', tid: 'suporte-hero', btns: ['/suporte/tickets', '/suporte/base-conhecimento'] } }
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(BASE + '/admin/site/banner-pages', { waitUntil: 'domcontentloaded' })
    await p.locator('[data-testid=banner-row]').first().waitFor({ timeout: 15000 })
    for (const slug of ['sobre', 'parcerias', 'suporte']) ok(await p.locator(`[data-testid=banner-row][data-slug="${slug}"]`).count() === 1, `«Banners de páginas»: entrada própria «${slug}»`)
    const row = p.locator('[data-testid=banner-row][data-slug="sobre"]'); await row.getByTestId('banner-edit').click()
    const SUB = `Descrição de ensaio ${RND}: quem somos.`
    await p.getByTestId('banner-subtitle').fill(SUB)
    const urlIn = p.locator('input[placeholder="Ou cole o URL da imagem"]'); const before = await urlIn.inputValue()
    await p.getByTestId('banner-image-file').setInputFiles({ name: `sobre-${RND}.png`, mimeType: 'image/png', buffer: png(960, 400, 230) })
    await p.waitForFunction(v => { const i = document.querySelector('input[placeholder="Ou cole o URL da imagem"]'); return i && i.value && i.value !== v }, before, { timeout: 20000 })
    const img = await urlIn.inputValue()
    await p.getByTestId('banner-save').click(); await p.waitForTimeout(1500)
    await ctx.close()
    const pathOf = u => u.replace(/^https?:\/\/[^/]+/, '')
    const html = {}
    for (const [slug, h] of Object.entries(heroes)) html[slug] = await (await fetch(BASE + h.path)).text()
    const hostHtml = await (await fetch(BASE + '/hospedagem-de-sites')).text()
    ok(html.sobre.includes(SUB) && html.sobre.includes(pathOf(img)), '/sobre: nova descrição e nova imagem')
    ok(!html.parcerias.includes(SUB) && !html.suporte.includes(SUB) && !hostHtml.includes(SUB) && !html.parcerias.includes(pathOf(img)) && !html.suporte.includes(pathOf(img)), 'Parceria, Suporte e Hospedagem: inalteradas')
    const sup = (await adm.req('/api/admin/banner-pages')).json.data.find(x => x.page_slug === 'suporte')
    const SUB2 = `Suporte de ensaio ${RND}.`
    await adm.req(`/api/admin/banner-pages/${sup.id}`, { method: 'PUT', body: { subtitle: SUB2 } })
    const sobre2 = await (await fetch(BASE + '/sobre')).text(), sup2 = await (await fetch(BASE + '/suporte')).text(), par2 = await (await fetch(BASE + '/parcerias')).text()
    ok(sup2.includes(SUB2) && !sobre2.includes(SUB2) && !par2.includes(SUB2) && sobre2.includes(SUB), 'alterar a descrição de Suporte só afecta /suporte')
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts))
      for (const [slug, h] of Object.entries(heroes)) {
        await p.goto(BASE + h.path, { waitUntil: 'domcontentloaded' })
        const hero = p.getByTestId(h.tid); await hero.waitFor()
        const h1 = await p.locator('h1').count()
        ok(h1 === 1 && await hero.locator('h1').count() === 1 && await hero.getAttribute('data-banner-source') === 'admin' && await hero.getAttribute('data-banner-slug') === slug, `${label} ${h.path}: hero do painel («${slug}»), um único H1`)
        const btns = await hero.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href')).filter(h => h !== '/'))
        ok(JSON.stringify(btns) === JSON.stringify(h.btns), `${label} ${h.path}: botões ${h.btns.length ? h.btns.join(', ') : '(nenhum)'}`)
        if (h.below) ok(await p.getByTestId(h.below).isVisible(), `${label} ${h.path}: conteúdo abaixo preservado`)
        ok(await overflow(p) <= 1, `${label} ${h.path}: sem deslocamento horizontal`)
        if (slug === 'sobre') {
          const im = await hero.evaluate(el => { const d = [...el.querySelectorAll('div')].find(x => (x.style.backgroundImage || '').includes('url(')); if (!d) return null; const r = d.getBoundingClientRect(); return { bg: d.style.backgroundImage, left: r.left, vw: innerWidth, op: getComputedStyle(d).opacity } })
          ok(im && im.bg.includes(pathOf(img)) && (label === 'desktop' ? im.left > im.vw * 0.3 && Number(im.op) === 1 : im.left <= 1 && Number(im.op) < 1), `${label} /sobre: imagem ${label === 'desktop' ? 'à direita' : 'por trás do texto, atenuada'} (como na hospedagem)`)
          await hero.screenshot({ path: `${OUT}/${label}-06-hero-sobre.png` })
        }
      }
      ok(!p.errors.length, 'sem erros', p.errors.join(' | '))
      await ctx.close()
    }
  } catch (e) { ok(false, 'execução', e.stack) }
  finally {
    try {
      for (const id of fixtures) await db.query('DELETE FROM services WHERE id = ?', [id])
      for (const c of created) {
        await db.query('DELETE FROM product_features WHERE product_id = ?', [c.id])
        await db.query('DELETE FROM product_prices WHERE product_id = ?', [c.id])
        await db.query('DELETE FROM products WHERE id = ?', [c.id]).catch(async () => { await db.query("UPDATE products SET active = 0, sale_status = 'draft' WHERE id = ?", [c.id]) })
      }
      for (const r of snapBanners) {
        const cols = ['title', 'subtitle', 'bg_image', 'tag', 'breadcrumb', 'updated_at']
        await db.query(`UPDATE banner_pages SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => r[c]), r.id])
      }
      await db.query("UPDATE shopping_carts c JOIN profiles x ON x.id = c.profile_id SET c.items = '[]' WHERE x.email = 'cliente1@ensaio.test'")
      const nowP = JSON.stringify(await all(`SELECT id, name, description, sale_status, position, badge, popular, base_monthly_price, service_type, provisioning FROM products WHERE id IN ${inA} ORDER BY id`, allIds))
      const nowPr = JSON.stringify(await all(`SELECT product_id, cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id IN ${inA} ORDER BY product_id, cycle`, allIds))
      ok(nowP === snapProducts && nowPr === snapPrices, 'planos, preços, descontos e modo de activação existentes inalterados; planos de ensaio removidos; banners repostos')
    } catch (e) { ok(false, 'reposição', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
