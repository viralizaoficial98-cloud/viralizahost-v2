// Catálogo de domínios e cartões da página inicial (ensaio, registrador simulado; sem compras reais).
// Repõe no fim os preços e a apresentação das extensões tal como estavam.
//   BASE_URL=http://localhost:3000 OUT=/tmp/cat node --env-file=.env.local scripts/mariadb/rehearsal/domain-catalog-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID, randomBytes } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-catalogo'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => randomBytes(3).toString('hex')

class S {
  cookie = ''
  async req(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, { method, headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = `vh_session=${v}` }
    const t = await res.text(); let json = null; try { json = JSON.parse(t) } catch {}
    return { status: res.status, json }
  }
}
const PRIORITY = ['.ao', '.co.ao', '.com', '.net', '.org', '.it.ao', '.org.ao', '.edu.ao', '.online', '.shop', '.store', '.xyz', '.io', '.tech', '.ai']
const LABELS = { '.ao': 'Angola oficial', '.co.ao': 'Empresas em Angola', '.com': 'O mais popular', '.net': 'Tecnologia e redes', '.org': 'Organizações', '.it.ao': 'Tecnologia em Angola', '.io': 'Startups e tecnologia', '.online': 'Presença online', '.shop': 'Lojas', '.store': 'Lojas' }

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const snapPrices = await all('SELECT * FROM domain_prices')
  const snapMeta = await all('SELECT * FROM domain_extensions')
  const adm = new S(), c1 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  const b = await chromium.launch()
  const homeCards = async (page) => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.locator('[data-testid=ext-card]').first().waitFor()
    return page.locator('[data-testid=ext-card]').evaluateAll(els => els.map(e => ({ ext: e.dataset.ext, hl: e.dataset.highlight === '1', text: e.innerText.replace(/\s+/g, ' ').trim() })))
  }
  const priceOf = async (ext, op) => Number((await one('SELECT price FROM domain_prices WHERE extension = ? AND operation = ? AND years = 1', [ext, op])).price)
  const digits = t => Number(String(t).replace(/[^\d]/g, ''))
  const cardPrice = t => digits((String(t).match(/([\d\s.]+,\d{2})\s*Kz/) ?? [])[1] ?? '')
  try {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
    const home = await ctx.newPage()
    const errors = []; home.on('pageerror', e => errors.push(e.message))

    // ── 1. Primeira publicação preserva os cartões ──
    console.log('\n1. Cartões actuais preservados (migração)')
    const sellable = [...new Set((await all("SELECT extension FROM domain_prices WHERE operation = 'register' AND status = 'active' AND price IS NOT NULL AND years = 1")).map(r => r.extension))]
    const rank = x => { const i = PRIORITY.indexOf(x); return i < 0 ? 99 : i }
    const expected = sellable.sort((a, c) => rank(a) - rank(c) || a.localeCompare(c)).slice(0, 6)
    let cards = await homeCards(home)
    ok(JSON.stringify(cards.map(c => c.ext)) === JSON.stringify(expected), `mesmos cartões e ordem de antes: ${cards.map(c => c.ext).join(' ')}`, JSON.stringify(expected))
    ok(cards.every(c => !LABELS[c.ext] || c.text.includes(LABELS[c.ext])), 'mesmas descrições')
    ok(cards.filter(c => /^POPULAR /i.test(c.text)).map(c => c.ext).sort().join() === expected.filter(e => ['.ao', '.com'].includes(e)).sort().join() && cards.filter(c => c.hl).length === expected.filter(e => ['.ao', '.com'].includes(e)).length, '«Popular» e realce em .ao e .com, como antes')
    for (const c of cards) ok(digits(c.text.split('/1.º')[0]) === Math.round(await priceOf(c.ext, 'register') * 100), `${c.ext}: preço do 1.º ano = catálogo (${c.text.match(/[\d\s.,]+Kz/)?.[0]?.trim()})`)
    ok(await home.locator('a', { hasText: 'Ver todos os domínios e preços' }).count() === 1, 'link «Ver todos os domínios e preços» mantido')
    await home.locator('a', { hasText: 'Ver todos os domínios e preços' }).scrollIntoViewIfNeeded()
    await home.screenshot({ path: `${OUT}/desktop-01-cartoes-antes.png` })

    // ── 2. Autorização no servidor ──
    console.log('\n2. Sem permissões não altera o catálogo')
    const before = JSON.stringify(await all('SELECT extension, operation, price, status FROM domain_prices ORDER BY extension, operation'))
    let r = await anon.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: '.com', register: 1 } })
    ok(r.status === 401, `visitante → ${r.status}`)
    r = await c1.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: '.com', register: 1, featured: false } })
    ok([401, 403].includes(r.status), `cliente → ${r.status}`)
    r = await c1.req('/api/admin/catalog', { method: 'POST', body: { kind: 'reorder', order: ['.com'] } })
    ok([401, 403].includes(r.status), `cliente a reordenar → ${r.status}`)
    r = await c1.req('/api/admin/catalog', { method: 'POST', body: { kind: 'extension', extension: '.hack' } })
    ok([401, 403].includes(r.status), `cliente a criar extensão → ${r.status}`)
    ok(JSON.stringify(await all('SELECT extension, operation, price, status FROM domain_prices ORDER BY extension, operation')) === before, 'catálogo inalterado')

    // ── 3. Encomenda anterior e item no carrinho antes da alteração ──
    const oldCom = `antes-${rnd()}.com`
    const lines = [{ type: 'domain', domain: oldCom, operation: 'register', years: 1 }]
    let q = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines } })
    const oldOrder = (await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines, acceptedTotal: q.json.quote.total, paymentMethod: 'bank_transfer' } })).json.order
    const oldVals = JSON.stringify(await one('SELECT o.amount, i.total, oi.unit_price, oi.line_total, oi.renewal_price FROM orders o JOIN invoices i ON i.order_id = o.id JOIN order_items oi ON oi.order_id = o.id WHERE o.id = ?', [oldOrder.id]))
    const cartCom = `carrinho-${rnd()}.com`
    const cartLines = [{ type: 'domain', domain: cartCom, operation: 'register', years: 1 }]
    const qCart = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: cartLines } })
    const comOld = await priceOf('.com', 'register')

    // ── 4. Painel: editar preço e etiqueta de .com ──
    console.log('\n3. Painel: preço e etiqueta')
    await ctx.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
    const admin = await ctx.newPage()
    await admin.goto(`${BASE}/admin/site/catalog?cat=dominios`, { waitUntil: 'networkidle' })
    const card = ext => admin.locator(`[data-testid=ext-editor][data-ext="${ext}"]`)
    await card('.com').waitFor()
    const NEWCOM = comOld + 1500
    await card('.com').getByTestId('ext-register').fill(String(NEWCOM))
    await card('.com').getByTestId('ext-badge').selectOption('promo')
    await card('.com').getByTestId('ext-save').click()
    await card('.com').locator('[role=status]').waitFor()
    ok(/Guardado/.test(await card('.com').locator('[role=status]').innerText()) && await priceOf('.com', 'register') === NEWCOM, `.com: registo ${comOld} → ${NEWCOM} Kz guardado em domain_prices`)
    await admin.screenshot({ path: `${OUT}/desktop-02-painel-dominios.png` })
    cards = await homeCards(home)
    const comCard = cards.find(c => c.ext === '.com')
    ok(comCard && /^PROMOÇÃO /i.test(comCard.text) && !/^POPULAR /i.test(comCard.text) && digits(comCard.text.split('/1.º')[0]) === NEWCOM * 100 && comCard.hl, `cartão .com: «Promoção», novo preço e realce mantido (${comCard?.text})`)
    const cfg = await c1.req(`/api/domains/config?dominio=${encodeURIComponent(cartCom)}`)
    ok(cfg.json?.register === NEWCOM, `configuração do domínio usa o novo preço (${cfg.json?.register})`)
    const srch = await c1.req(`/api/domains/search?q=${encodeURIComponent(cartCom)}`)
    ok(srch.json?.exact?.register === NEWCOM, 'pesquisa usa o novo preço')
    // etiqueta personalizada e remoção
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: '.net', badge: 'custom', badgeText: 'x' } })
    ok(r.status === 400, 'etiqueta personalizada vazia/curta recusada')
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: '.net', badge: 'custom', badgeText: 'Mais barato <b>' } })
    cards = await homeCards(home)
    ok(r.status === 200 && /MAIS BARATO B/i.test(cards.find(c => c.ext === '.net')?.text ?? '') && !/<b>/.test(cards.find(c => c.ext === '.net')?.text ?? ''), 'etiqueta personalizada (texto limpo) no cartão .net')
    await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: '.net', badge: 'none' } })
    cards = await homeCards(home)
    ok(!/^(MAIS BARATO|POPULAR|PROMO)/i.test(cards.find(c => c.ext === '.net')?.text ?? ''), 'etiqueta removida')
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: '.ao', badge: 'none', highlight: true } })
    cards = await homeCards(home)
    ok(cards.find(c => c.ext === '.ao')?.hl && !/^POPULAR /i.test(cards.find(c => c.ext === '.ao').text), 'realce independente da etiqueta (.ao realçado sem etiqueta)')
    await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: '.ao', badge: 'popular' } })

    // ── 5. Checkout com o preço actualizado; encomenda anterior intacta ──
    console.log('\n4. Carrinho e checkout com o novo preço')
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines: cartLines, acceptedTotal: qCart.json.quote.total, paymentMethod: 'bank_transfer' } })
    ok(r.status === 409 && r.json?.code === 'price_changed' && Number(r.json.quote.total) === Number(qCart.json.quote.total) + 1500, `item no carrinho com o preço antigo → 409 «o total foi actualizado» com o novo valor (${r.json?.quote?.total})`)
    q = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: cartLines } })
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines: cartLines, acceptedTotal: q.json.quote.total, paymentMethod: 'bank_transfer' } })
    const newItem = r.json?.order ? await one('SELECT unit_price FROM order_items WHERE order_id = ?', [r.json.order.id]) : null
    ok(r.status === 201 && Number(newItem?.unit_price) === NEWCOM, `encomenda nova criada com o preço recalculado no servidor (${newItem?.unit_price})`)
    ok(JSON.stringify(await one('SELECT o.amount, i.total, oi.unit_price, oi.line_total, oi.renewal_price FROM orders o JOIN invoices i ON i.order_id = o.id JOIN order_items oi ON oi.order_id = o.id WHERE o.id = ?', [oldOrder.id])) === oldVals, 'encomenda e factura anteriores mantêm os valores')
    // carrinho no navegador mostra o novo valor
    const shop = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await shop.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await shop.evaluate(l => localStorage.setItem('viralizahost-cart-v2', JSON.stringify({ state: { lines: [{ key: 'k1', ...l }], idempotencyKey: null }, version: 0 })), cartLines[0])
    await shop.goto(BASE + '/carrinho', { waitUntil: 'networkidle' })
    await shop.getByTestId('summary-total').waitFor()
    ok(digits(await shop.getByTestId('summary-total').innerText()) === NEWCOM, 'carrinho mostra o novo valor antes de confirmar')
    await shop.context().close()

    // ── 6. Reordenar e retirar do destaque ──
    console.log('\n5. Ordem e destaque')
    await admin.reload({ waitUntil: 'networkidle' })
    const order0 = await admin.locator('[data-testid=featured-item]').evaluateAll(els => els.map(e => e.dataset.ext))
    const target = order0[order0.length - 1]
    for (let i = 0; i < order0.length - 1; i++) await admin.locator(`[data-testid=featured-item][data-ext="${target}"]`).getByTestId('featured-up').click()
    await admin.getByTestId('featured-save').click()
    await admin.getByTestId('featured-order').locator('[role=status]').waitFor()
    cards = await homeCards(home)
    ok(cards[0].ext === target, `reordenar: ${target} passa a ser o 1.º cartão (${cards.map(c => c.ext).join(' ')})`)
    r = await adm.req('/api/admin/catalog', { method: 'POST', body: { kind: 'reorder', order: ['.com'] } })
    ok(r.status === 400, 'ordem incompleta recusada')
    await card('.co.ao').getByTestId('ext-featured').uncheck()
    await card('.co.ao').getByTestId('ext-save').click(); await card('.co.ao').locator('[role=status]').waitFor()
    cards = await homeCards(home)
    ok(!cards.some(c => c.ext === '.co.ao'), 'retirar do destaque: .co.ao sai dos cartões')
    const ao = (await c1.req('/api/catalog/domains')).json.extensions.find(e => e.extension === '.co.ao')
    ok(ao?.status === 'active' && ao.register > 0, '.co.ao continua à venda no catálogo completo')
    await home.goto(BASE + '/dominios/precos', { waitUntil: 'networkidle' })
    ok((await home.locator('main').innerText()).includes('.co.ao'), '«Ver todos os domínios e preços» continua a mostrar .co.ao')

    // ── 7. Desactivar uma extensão ──
    console.log('\n6. Retirar uma extensão da venda')
    await card('.org').getByTestId('ext-sale').selectOption('draft')
    await card('.org').getByTestId('ext-save').click(); await card('.org').locator('[role=status]').waitFor()
    cards = await homeCards(home)
    ok(!cards.some(c => c.ext === '.org'), '.org retirada da venda: sai dos cartões')
    q = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'domain', domain: `nova-${rnd()}.org`, operation: 'register', years: 1 }] } })
    ok(q.json?.quote?.lines?.[0]?.error?.code === 'extension_unavailable', 'registo .org recusado no carrinho/checkout')
    const ren = await one("SELECT status, price FROM domain_prices WHERE extension = '.org' AND operation = 'renew'")
    ok(ren.status === 'active' && Number(ren.price) > 0, 'renovação .org continua activa para quem já tem o domínio')

    // ── 8. Nova extensão, validação e separação oferta / disponibilidade / registrador ──
    console.log('\n7. Nova extensão')
    for (const [bad, why] of [['.co..ao', 'inválida'], ['.c', 'inválida'], ['.t1f66', 'inválida: extensão final com dígitos'], ['.com-', 'inválida'], ['co.ao', 'duplicada'], ['.COM', 'duplicada']]) {
      r = await adm.req('/api/admin/catalog', { method: 'POST', body: { kind: 'extension', extension: bad } })
      ok(r.status === 400, `«${bad}» recusada (${why}): ${r.json?.error}`)
    }
    const NEW = `.t${Array.from({ length: 5 }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('')}`
    await admin.locator('[aria-label="Nova extensão"]').fill(NEW.toUpperCase())
    await admin.getByRole('button', { name: 'Acrescentar extensão' }).click()
    await card(NEW).waitFor()
    ok(true, `${NEW} criada (normalizada) em rascunho`)
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: NEW, sale: 'active', register: 12345.5, renew: null } })
    ok(r.status === 400 && /renovação/.test(r.json?.error), 'à venda exige preço de renovação')
    r = await adm.req('/api/admin/catalog', { method: 'PATCH', body: { kind: 'extension', extension: NEW, sale: 'active', description: 'Teste de ensaio', register: 12345.5, renew: 15000, transfer: 9000, featured: true, badge: 'new', highlight: false } })
    cards = await homeCards(home)
    const nc = cards[cards.length - 1]
    ok(r.status === 200 && nc?.ext === NEW && /NOVO/i.test(nc.text) && /Teste de ensaio/.test(nc.text) && cardPrice(nc.text) === 1234550, `${NEW} à venda e em destaque: último cartão com «Novo» e 12 345,50 Kz (${nc?.text})`)
    const s2 = await c1.req(`/api/domains/search?q=${encodeURIComponent('nome' + NEW)}`)
    ok(s2.json?.exact?.availability === 'confirm', `disponibilidade continua a ser verificada: ${NEW} sem consulta automática → «A confirmar pela equipa»`)
    const reg = await one('SELECT provider, enabled, extensions FROM registrar_settings WHERE id = 1')
    ok(!JSON.stringify(reg?.extensions ?? '[]').includes(NEW), 'activar no catálogo não activa o registo automático no registrador')
    await home.goto(BASE + '/', { waitUntil: 'networkidle' })
    await home.locator('a', { hasText: 'Ver todos os domínios e preços' }).scrollIntoViewIfNeeded()
    await home.screenshot({ path: `${OUT}/desktop-03-cartoes-depois.png` })
    const mob = await (await b.newContext({ ...devices['iPhone 13'] })).newPage()
    await mob.goto(BASE + '/', { waitUntil: 'networkidle' }); await mob.locator('[data-testid=ext-card]').first().scrollIntoViewIfNeeded()
    ok(await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1, 'telemóvel: cartões sem deslocamento horizontal')
    await mob.screenshot({ path: `${OUT}/telemovel-01-cartoes.png` })
    const mobAdmin = await (await b.newContext({ ...devices['iPhone 13'] })).newPage()
    await mobAdmin.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
    await mobAdmin.goto(`${BASE}/admin/site/catalog?cat=dominios`, { waitUntil: 'networkidle' }); await mobAdmin.getByTestId('featured-order').waitFor()
    await mobAdmin.screenshot({ path: `${OUT}/telemovel-02-painel.png` })
    await mob.context().close(); await mobAdmin.context().close()
    const logs = await one("SELECT COUNT(*) n FROM activity_logs WHERE entity_type = 'domain_extension' AND created_at > NOW() - INTERVAL 10 MINUTE")
    ok(Number(logs.n) >= 5, `alterações registadas na auditoria (${logs.n})`)
    ok(errors.length === 0, 'sem erros JavaScript', errors.join(' | '))
    await ctx.close()
  } finally {
    await b.close()
    // Repor o catálogo como estava (preços, estados e apresentação)
    const exts = new Set(snapPrices.map(p => p.extension))
    for (const e of (await all('SELECT DISTINCT extension FROM domain_prices')).map(r => r.extension)) if (!exts.has(e)) { await db.query('DELETE FROM domain_prices WHERE extension = ?', [e]); await db.query('DELETE FROM domain_extensions WHERE extension = ?', [e]) }
    for (const p of snapPrices) await db.query('UPDATE domain_prices SET price = ?, status = ?, reference = ? WHERE id = ?', [p.price, p.status, p.reference == null ? null : (typeof p.reference === 'string' ? p.reference : JSON.stringify(p.reference)), p.id])
    for (const m of snapMeta) await db.query('UPDATE domain_extensions SET description = ?, featured = ?, featured_position = ?, badge = ?, badge_text = ?, highlight = ? WHERE extension = ?', [m.description, m.featured, m.featured_position, m.badge, m.badge_text, m.highlight, m.extension])
    await db.end()
  }
  console.log(`\n${pass} OK, ${fail} falhadas`)
  process.exit(fail ? 1 : 0)
})().catch(e => { console.error('ERRO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2) })
