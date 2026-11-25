// Características e descrições dos planos de Revenda, Criador de Sites e Construtor WordPress: editor (texto livre +
// ícone), gravação, reabertura, formatos antigos, alteração só de preços, cartões públicos (com e sem preço) e texto
// simples. Desktop + iPhone. Repõe o catálogo no fim. Sem encomendas.
//   BASE_URL=http://localhost:3000 OUT=/tmp/family-features node --env-file=.env.local scripts/mariadb/rehearsal/family-features-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const { randomUUID } = require('node:crypto')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-family-features'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 400) : ''}`) }
const DESKTOP = { viewport: { width: 1440, height: 2200 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
// Um plano por categoria: com preço (criador, construtor) e «Sob consulta» (revenda)
const CASES = [
  { family: 'reseller', slug: 'reseller-business', page: '/revenda-de-hospedagem', onRequest: true },
  { family: 'website-builder', slug: 'ia-pro', page: '/criador-de-sites', onRequest: false },
  { family: 'wp-builder', slug: 'wp-builder-pro', page: '/construtor-wordpress', onRequest: false },
]
const LEGACY = 'ia-starter' // plano com características antigas (formatos do editor antigo e do catálogo)
const login = async (email, password) => (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })).headers.getSetCookie().map(c => c.split(';')[0]).find(c => c.startsWith('vh_session='))
async function ctxFor(b, opts, cookie) {
  const ctx = await b.newContext({ ...opts })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message))
  return { ctx, p }
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const slugs = [...CASES.map(c => c.slug), LEGACY]
  const ids = (await all(`SELECT id, slug FROM products WHERE slug IN (${slugs.map(() => '?').join(',')})`, slugs))
  const idOf = s => ids.find(x => x.slug === s).id
  const inI = `(${ids.map(() => '?').join(',')})`, idList = ids.map(x => x.id)
  const snapProd = await all(`SELECT id, description, base_monthly_price, sale_status FROM products WHERE id IN ${inI}`, idList)
  const snapFeat = await all(`SELECT * FROM product_features WHERE product_id IN ${inI}`, idList)
  const snapPrice = await all(`SELECT * FROM product_prices WHERE product_id IN ${inI}`, idList)
  const priceKey = async () => JSON.stringify(await all(`SELECT product_id, cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id IN ${inI} ORDER BY product_id, cycle`, idList))
  const ordersBefore = Number((await one('SELECT COUNT(*) n FROM orders')).n)
  const feats = id => all('SELECT feature, icon, included, position FROM product_features WHERE product_id = ? ORDER BY position', [id])
  const admin = await login('admin@ensaio.test', 'Admin#Teste2026')
  const api = (path, method = 'GET', body) => fetch(BASE + path, { method, headers: { cookie: admin, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, json: await r.json().catch(() => null) }))
  const b = await chromium.launch()
  let ctx, p
  try {
    // ── 0. Plano com características antigas: formatos do editor antigo e do catálogo ──
    console.log('\n0. Formatos antigos (editor antigo de produtos e catálogo)')
    const legId = idOf(LEGACY)
    await db.query('DELETE FROM product_features WHERE product_id = ?', [legId])
    const legacyRows = [
      ['Até 5 páginas', null, 1, 0],                                // editor antigo: sem ícone, posição a partir de 0
      ['Domínio grátis no 1.º ano', null, 0, 1],                    // editor antigo: característica não incluída
      ['{"text":"SSL incluído","icon":"shield"}', null, 1, 2],      // texto guardado em JSON
      ['', 'globe', 1, 3],                                          // só ícone, sem texto na origem
    ]
    for (const [f, icon, inc, pos] of legacyRows) await db.query('INSERT INTO product_features (id, product_id, feature, icon, included, position) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), legId, f, icon, inc, pos])
    let r = await api('/api/admin/catalog/family-plans?family=website-builder')
    const leg = r.json.plans.find(x => x.slug === LEGACY)
    ok(JSON.stringify(leg.features) === JSON.stringify([{ text: 'Até 5 páginas', icon: null, included: true }, { text: 'Domínio grátis no 1.º ano', icon: null, included: false }, { text: 'SSL incluído', icon: 'shield', included: true }, { text: '', icon: 'globe', included: true }]),
      'catálogo lido em todos os formatos: texto simples, não incluída, JSON; linha só com ícone sem texto inventado', JSON.stringify(leg.features))
    // Alterar só preços pela API (sem «features»): características mantidas
    const legPeriods = leg.periods.map(x => ({ cycle: x.cycle, discount: x.matchesRule ? x.discount : null, publish: x.active }))
    r = await api('/api/admin/catalog/family-plans?family=website-builder', 'PUT', { id: leg.id, name: leg.name, description: leg.description, saleStatus: leg.saleStatus, position: leg.position, badge: leg.badge, highlight: leg.highlight, baseMonthly: leg.baseMonthly, periods: legPeriods })
    ok(r.status === 200 && (await feats(legId)).length === 4, 'gravar só preços (sem características no pedido) não apaga as características')
    // Página pública: lista recuperada, sem a linha vazia
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/criador-de-sites', { waitUntil: 'domcontentloaded' })
    const legCard = p.locator(`[data-testid=fam-plan-card][data-slug="${LEGACY}"]`); await legCard.waitFor()
    const legPub = await legCard.getByTestId('fam-plan-feature').evaluateAll(x => x.map(e => `${e.textContent}|${e.dataset.icon}|${e.dataset.included}|${getComputedStyle(e).textDecorationLine}`))
    ok(JSON.stringify(legPub) === JSON.stringify(['Até 5 páginas|check|1|none', 'Domínio grátis no 1.º ano|x|0|line-through', 'SSL incluído|shield|1|none']), `cartão: textos antigos recuperados (não incluída riscada); linha sem texto não aparece (${legPub.map(x => x.split('|')[0]).join(' · ')})`)
    await ctx.close()
    // Editor: a linha só com ícone é assinalada e impede gravar até ser corrigida
    ;({ ctx, p } = await ctxFor(b, DESKTOP, admin))
    await p.goto(BASE + '/admin/site/catalog?cat=hosting', { waitUntil: 'domcontentloaded' })
    let sec = p.getByTestId('family-plans-admin-website-builder'); await sec.getByTestId('fp-create').waitFor({ timeout: 20000 })
    let plan = sec.locator(`[data-testid=fp-plan][data-slug="${LEGACY}"]`); await plan.locator('summary').click()
    let form = plan.getByTestId('fp-form')
    ok(JSON.stringify(await form.getByTestId('fp-feature-text').evaluateAll(x => x.map(i => i.value))) === JSON.stringify(['Até 5 páginas', 'Domínio grátis no 1.º ano', 'SSL incluído', ''])
      && JSON.stringify(await form.getByTestId('fp-feature-included').evaluateAll(x => x.map(i => i.checked))) === JSON.stringify([true, false, true, true])
      && await form.getByTestId('fp-feature-orig-empty').count() === 1, 'editor: valores gravados, «Incluída» desmarcada na linha antiga e aviso na linha só com ícone')
    await form.getByTestId('fp-save').click(); await p.waitForTimeout(800)
    ok(/Escreva o «Texto da característica» na linha 4/.test(await form.getByTestId('fp-msg').innerText()) && (await feats(legId)).length === 4, `linha sem texto: gravação bloqueada com explicação («${await form.getByTestId('fp-msg').innerText()}»)`)
    await form.getByTestId('fp-feature-delete').nth(3).click()
    await form.getByTestId('fp-save').click()
    await form.getByTestId('fp-msg').filter({ hasText: 'Guardado' }).waitFor({ timeout: 10000 })
    const legNow = await feats(legId)
    ok(JSON.stringify(legNow.map(x => [x.feature, x.icon, Number(x.included)])) === JSON.stringify([['Até 5 páginas', 'check', 1], ['Domínio grátis no 1.º ano', null, 0], ['SSL incluído', 'shield', 1]]) || JSON.stringify(legNow.map(x => [x.feature, x.included])) === JSON.stringify([['Até 5 páginas', 1], ['Domínio grátis no 1.º ano', 0], ['SSL incluído', 1]]),
      `apagada a linha vazia e gravado: textos recuperados guardados como texto simples (${legNow.map(x => x.feature).join(' · ')})`)
    await ctx.close()

    // ── 1. Percurso completo nas três categorias ──
    for (const c of CASES) {
      console.log(`\n1. ${c.family} — ${c.slug}${c.onRequest ? ' (sob consulta)' : ' (com preço)'}`)
      const pid = idOf(c.slug)
      const prices0 = JSON.stringify(await all('SELECT cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id = ? ORDER BY cycle', [pid]))
      ;({ ctx, p } = await ctxFor(b, DESKTOP, admin))
      await p.goto(BASE + '/admin/site/catalog?cat=hosting', { waitUntil: 'domcontentloaded' })
      sec = p.getByTestId(`family-plans-admin-${c.family}`); await sec.getByTestId('fp-create').waitFor({ timeout: 20000 })
      plan = sec.locator(`[data-testid=fp-plan][data-slug="${c.slug}"]`); await plan.locator('summary').click()
      form = plan.getByTestId('fp-form')
      // Problema reportado: só ícones escolhidos, sem texto → antes «Guardado» e nada gravado; agora bloqueado
      await form.getByTestId('fp-add-feature').click()
      ok(await form.getByTestId('fp-feature-icon').last().evaluate(s => s.selectedOptions[0].text) === 'Visto', 'nova linha: ícone inicial «Visto»')
      const labels = await form.getByTestId('fp-feature').last().locator('label').allInnerTexts()
      ok(labels.some(t => /^Ícone/.test(t)) && labels.some(t => /^Texto da característica/.test(t)), 'campos com rótulo «Ícone» e «Texto da característica»')
      await form.getByTestId('fp-feature-icon').last().selectOption('panel')
      const before = (await feats(pid)).length
      await form.getByTestId('fp-save').click(); await p.waitForTimeout(800)
      ok(/Texto da característica/.test(await form.getByTestId('fp-msg').innerText()) && (await feats(pid)).length === before, 'só ícone, sem texto: não grava e explica (sem perda silenciosa)')
      // Descrição + duas características personalizadas, com acentos; muda a ordem
      const DESC = `Descrição curta — ${c.family}: ação, gestão e preços em kwanzas`
      const F1 = `Configuração automática com acentuação (ç, ã, é) — ${c.family}`, F2 = '20 GB de armazenamento', F3 = '<b>Negrito</b> & «aspas»'
      await form.getByTestId('fp-description').fill(DESC)
      await form.getByTestId('fp-feature-text').last().fill(F1)
      await form.getByTestId('fp-add-feature').click(); await form.getByTestId('fp-feature-text').last().fill(F2); await form.getByTestId('fp-feature-icon').last().selectOption('database')
      await form.getByTestId('fp-add-feature').click(); await form.getByTestId('fp-feature-text').last().fill(F3); await form.getByTestId('fp-feature-icon').last().selectOption('shield')
      const n = await form.getByTestId('fp-feature').count()
      await form.getByTestId('fp-feature-up').nth(n - 2).click() // F2 sobe acima de F1
      await form.getByTestId('fp-save').click()
      await form.getByTestId('fp-msg').filter({ hasText: 'Guardado' }).waitFor({ timeout: 10000 })
      const expected = [[F2, 'database'], [F1, 'panel'], [F3, 'shield']]
      const shownAfter = await form.getByTestId('fp-feature-text').evaluateAll(x => x.map(i => i.value))
      ok(JSON.stringify(shownAfter.slice(-3)) === JSON.stringify(expected.map(e => e[0])), 'depois de guardar, o editor mostra os valores gravados')
      const stored = (await feats(pid)).slice(-3)
      ok(JSON.stringify(stored.map(x => [x.feature, x.icon])) === JSON.stringify(expected), `gravado: texto, ícone e ordem (${stored.map(x => `${x.feature} [${x.icon}]`).join(' · ')})`)
      ok((await one('SELECT description FROM products WHERE id = ?', [pid])).description === DESC, 'descrição curta gravada')
      // Reabrir o editor
      await p.reload({ waitUntil: 'domcontentloaded' })
      sec = p.getByTestId(`family-plans-admin-${c.family}`); await sec.getByTestId('fp-create').waitFor({ timeout: 20000 })
      plan = sec.locator(`[data-testid=fp-plan][data-slug="${c.slug}"]`); await plan.locator('summary').click(); form = plan.getByTestId('fp-form')
      const reopened = await form.getByTestId('fp-feature').evaluateAll(x => x.map(li => `${li.querySelector('input[data-testid=fp-feature-text]').value}|${li.querySelector('select').value}`))
      ok(JSON.stringify(reopened.slice(-3)) === JSON.stringify(expected.map(e => e.join('|'))) && await form.getByTestId('fp-description').inputValue() === DESC, 'reabrir o editor: descrição, textos, ícones e ordem gravados')
      if (c.family === 'reseller') await form.screenshot({ path: `${OUT}/desktop-01-editor-${c.family}.png` })
      // Alterar só o preço/desconto não apaga as características
      if (!c.onRequest) {
        const cur = await form.getByTestId('fp-discount-1year').inputValue()
        await form.getByTestId('fp-discount-1year').fill(String(Number(cur || 0) + 5))
        await form.getByTestId('fp-save').click(); await form.getByTestId('fp-msg').filter({ hasText: 'Guardado' }).waitFor({ timeout: 10000 })
        ok(JSON.stringify((await feats(pid)).slice(-3).map(x => [x.feature, x.icon])) === JSON.stringify(expected), 'alterar só o desconto no painel: características mantidas')
        await form.getByTestId('fp-discount-1year').fill(cur); await form.getByTestId('fp-save').click(); await form.getByTestId('fp-msg').filter({ hasText: 'Guardado' }).waitFor({ timeout: 10000 })
      }
      ok(JSON.stringify(await all('SELECT cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id = ? ORDER BY cycle', [pid])) === prices0, 'preços e ciclos do plano iguais aos de antes')
      await ctx.close()
      // Página pública (sem novo deploy), desktop e telemóvel
      for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
        ;({ ctx, p } = await ctxFor(b, opts))
        await p.goto(BASE + c.page, { waitUntil: 'domcontentloaded' })
        const card = p.locator(`[data-testid=fam-plan-card][data-slug="${c.slug}"]`); await card.waitFor()
        const [nameBox, descBox] = [await card.getByTestId('fam-plan-name').boundingBox(), await card.getByTestId('fam-plan-description').boundingBox()]
        ok((await card.getByTestId('fam-plan-description').innerText()) === DESC && descBox.y > nameBox.y, `${label}: descrição curta abaixo do nome`)
        const pub = await card.getByTestId('fam-plan-feature').evaluateAll(x => x.map(e => `${e.textContent}|${e.dataset.icon}`))
        ok(JSON.stringify(pub.slice(-3)) === JSON.stringify(expected.map(e => e.join('|'))), `${label}: características com ícones, pela ordem do painel`)
        ok(await card.locator('b').count() === 0 && pub.some(x => x.startsWith('<b>Negrito</b> & «aspas»')), `${label}: texto do painel mostrado como texto simples`)
        if (c.onRequest) {
          ok(await card.getByTestId('fam-plan-onrequest').count() === 1 && /Pedir proposta/.test(await card.getByTestId('fam-plan-cta').innerText()), `${label}: «Sob consulta» com a lista e «Pedir proposta»`)
          await card.getByTestId('fam-plan-cta').click(); await p.waitForURL(`**/comprar/${c.slug}`)
          ok(await p.getByRole('button', { name: /Pedir proposta/ }).count() === 1, `${label}: «Pedir proposta» abre o formulário`)
          await p.goBack({ waitUntil: 'domcontentloaded' })
        } else {
          ok(await card.getByTestId('fam-plan-cta').getAttribute('href') === `/comprar/${c.slug}?ciclo=monthly`, `${label}: «Comprar agora» mantido`)
        }
        ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 1, `${label}: sem deslocamento horizontal`)
        await p.goto(BASE + c.page, { waitUntil: 'domcontentloaded' })
        const card2 = p.locator(`[data-testid=fam-plan-card][data-slug="${c.slug}"]`); await card2.waitFor()
        await p.addStyleTag({ content: 'header { position: absolute !important } [data-floating] { display: none !important }' })
        await card2.scrollIntoViewIfNeeded(); await card2.screenshot({ path: `${OUT}/${label}-02-cartao-${c.family}.png` })
        ok(!p.errors.length, `${label}: sem erros`, p.errors.join(' | '))
        await ctx.close()
      }
    }
    ok(Number((await one('SELECT COUNT(*) n FROM orders')).n) === ordersBefore, 'nenhuma encomenda criada')
  } catch (e) { ok(false, 'execução', e.stack) }
  finally {
    try {
      await db.query(`DELETE FROM product_features WHERE product_id IN ${inI}`, idList)
      for (const f of snapFeat) { const k = Object.keys(f); await db.query(`INSERT INTO product_features (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => f[c])) }
      for (const pr of snapProd) await db.query('UPDATE products SET description = ?, base_monthly_price = ?, sale_status = ? WHERE id = ?', [pr.description, pr.base_monthly_price, pr.sale_status, pr.id])
      await db.query(`DELETE FROM product_prices WHERE product_id IN ${inI}`, idList)
      for (const x of snapPrice) { const k = Object.keys(x); await db.query(`INSERT INTO product_prices (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => (x[c] != null && typeof x[c] === 'object' ? JSON.stringify(x[c]) : x[c]))) }
      ok((await all(`SELECT COUNT(*) n FROM product_features WHERE product_id IN ${inI}`, idList))[0].n == snapFeat.length, 'catálogo reposto como estava')
    } catch (e) { ok(false, 'reposição', e.message) }
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
