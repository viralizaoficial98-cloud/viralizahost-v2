// Bandeira de cada país nos centros de dados (API Hostinger SIMULADA — nada é comprado):
//   · «Centro de dados» da configuração de VPS e seletor da compra: bandeira no lugar do ícone de localização;
//   · Cloud VPS → Datacenters: bandeira ao lado do nome da cidade, mantendo caixa de seleção, ID, código e selo.
// Os dez centros das capturas (LT, SG, GB, IN, ID, MY, BR, US, DE, FR) em desktop e iPhone; o país vem do código de
// país dos dados (maiúsculas/minúsculas misturadas), nunca do nome técnico (bnk, fast, mum2, «de», «us»…).
// Mantém seleção na compra, ativar/desativar no painel e gravação; sem país ou com a imagem em falha → ícone neutro.
//   BASE_URL=http://localhost:3000 OUT=/tmp/dc node --env-file=.env.local scripts/mariadb/rehearsal/dc-flags-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MOCK = process.env.HOSTINGER_MOCK || 'http://127.0.0.1:12091'
const OUT = process.env.OUT || './ui-shots-dc-flags'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x !== '' ? ' — ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : ''}`) }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
// id do centro → [cidade, país esperado (ISO minúsculo), nome técnico do fornecedor]
const TEN = { 301: ['Vilnius', 'lt', 'bnk'], 302: ['Singapore', 'sg', 'sin1'], 303: ['Manchester', 'gb', 'fast'], 304: ['Mumbai 2', 'in', 'mum2'], 305: ['Jakarta', 'id', 'jkt1'],
  306: ['Kuala Lumpur', 'my', 'de'], 307: ['Campinas', 'br', 'cpq'], 308: ['Boston 2', 'us', 'bos2'], 309: ['Düsseldorf', 'de', 'us'], 310: ['Paris', 'fr', 'par'] }
const NAMES = { lt: 'Lituânia', sg: 'Singapura', gb: 'Reino Unido', in: 'Índia', id: 'Indonésia', my: 'Malásia', br: 'Brasil', us: 'Estados Unidos', de: 'Alemanha', fr: 'França' }
const sleep = ms => new Promise(r => setTimeout(r, ms))

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
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message)); p.on('dialog', d => d.accept())
  return { ctx, p }
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const hide = p => p.addStyleTag({ content: 'header, [data-floating] { display: none !important }' }).catch(() => {})

/** Bandeira (ou ícone) de um elemento: país, tamanho, alinhamento vertical com o texto e ausência de sobreposição. */
const flagInfo = (loc, textSel) => loc.evaluate((el, textSel) => {
  const f = el.querySelector('[data-testid=dc-flag]'), fb = el.querySelector('[data-testid=dc-flag-fallback]')
  const node = f || fb; const t = textSel ? el.querySelector(textSel) : el
  const range = document.createRange(); range.selectNodeContents(t); const tr = [...range.getClientRects()].pop()
  const nr = node?.getBoundingClientRect()
  return { country: f?.dataset.country ?? null, fallback: !!fb, w: nr?.width, h: nr?.height, loaded: f ? f.naturalWidth > 0 : null, dy: nr && tr ? Math.abs((nr.top + nr.height / 2) - (tr.top + tr.height / 2)) : null,
    gap: nr && tr ? tr.left - nr.right : null, text: el.innerText.replace(/\s+/g, ' ').trim(), mapPin: !!el.querySelector('svg.lucide-map-pin:not([data-testid=dc-flag-fallback])') }
}, textSel)

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const one = async (sql, a = []) => (await db.query(sql, a))[0][0]
  const snap = await one('SELECT * FROM vps_provider_settings WHERE id = 1')
  const adm = new S(), c2 = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c2.req('/api/auth/login', { method: 'POST', body: { email: 'cliente2@ensaio.test', password: 'Cliente#Dois2026' } })
  const cv = body => adm.req('/api/admin/cloud-vps', { method: 'POST', body })
  const b = await chromium.launch()
  try {
    // ── 0. Preparação: fornecedor simulado com os dez centros, sincronizado como em produção ──
    console.log('\n0. Fornecedor simulado com os dez centros de dados')
    await fetch(`${MOCK}/_dcs?set=ten`, { method: 'POST' })
    let r = await cv({ action: 'provider_save', mode: 'test', apiUrl: MOCK, secret: 'hostinger-de-ensaio', paymentMethodId: 7001, hostnameSuffix: 'srv.ensaio.test' })
    ok(r.status === 200, 'fornecedor em ensaio', r.json)
    r = await cv({ action: 'test' })
    ok(r.status === 200 && r.json.ok && r.json.results.dataCenters?.ok, 'Testar ligação: centros de dados lidos e sincronizados', r.json)
    r = await cv({ action: 'templates_save', enabledImages: ['1130'] })
    ok(r.status === 200, 'imagem Ubuntu publicada')
    r = await cv({ action: 'datacenters_save', enabledLocations: Object.keys(TEN) })
    ok(r.status === 200 && r.json.locations.filter(l => l.enabled).length === 10, 'dez centros oferecidos', r.json?.locations?.length)
    const stored = JSON.parse((await one('SELECT options FROM vps_provider_settings WHERE id = 1')).options).locations
    ok(Object.entries(TEN).every(([id, [city, cc, tech]]) => { const l = stored.find(x => x.id === id); return l && l.country === cc && l.detail === tech && l.label.startsWith(city) }),
      'sincronização guarda o país normalizado (minúsculas) e mantém o nome técnico à parte', stored.map(l => `${l.id}:${l.country}/${l.detail}`).join(' '))
    r = await adm.req('/api/admin/cloud-vps?section=datacenters')
    ok(Object.entries(TEN).every(([id, [, cc]]) => r.json.locations.find(x => x.id === id)?.country === cc), 'API do painel devolve o país de cada centro')
    const planSlug = (await one("SELECT slug FROM products WHERE category = 'vps' AND subcategory IS NULL AND active = 1 AND sale_status = 'active' ORDER BY position LIMIT 1")).slug
    const optsApi = async () => (await c2.req(`/api/catalog/vps-options?plano=${planSlug}`))
    r = await optsApi(); const pub = r.json?.locations ?? []
    ok(r.status === 200 && Object.entries(TEN).every(([id, [, cc]]) => pub.find(x => x.id === id)?.country === cc), 'API pública devolve o país de cada centro', r.status)
    const plan = planSlug
    await db.query("UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', 'automatic') WHERE id = 1") // compra directa só no modo automático

    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      // ── 1. Painel: Cloud VPS → Datacenters ──
      console.log(`\n1. Painel Cloud VPS → Datacenters (${label})`)
      let { ctx, p } = await ctxFor(b, opts, adm.cookie)
      await p.goto(`${BASE}/admin/cloud-vps/datacenters`, { waitUntil: 'domcontentloaded' })
      await p.getByTestId('cv-datacenters').waitFor({ timeout: 20000 }); await p.locator('[data-testid=cv-dc]').nth(9).waitFor(); await p.waitForTimeout(700)
      const cards = p.locator('[data-testid=cv-dc]')
      let bad = []
      for (const [id, [city, cc, tech]] of Object.entries(TEN)) {
        const card = cards.filter({ hasText: new RegExp(`id ${id}\\b`) }); const f = await flagInfo(card.first(), 'p.font-bold')
        const good = f.country === cc && f.loaded && f.w >= 18 && f.w <= 22 && f.h >= 13 && f.h <= 17 && f.dy <= 3 && f.gap >= 3 && !f.fallback && f.text.includes(city) && f.text.includes(`id ${id}`) && f.text.includes(tech) && f.text.includes('Oferecido') &&
          await card.getByTestId('cv-dc-check').isChecked()
        if (!good) bad.push(`${city}: ${JSON.stringify(f)}`)
      }
      ok(bad.length === 0, `dez cartões: bandeira certa e pequena, alinhada com a cidade, com caixa, ID, código e selo «Oferecido»`, bad.join(' | '))
      ok((await cards.count()) === 10 && await overflow(p) <= 1, 'dez cartões e sem deslocamento horizontal')
      const nameCheck = await Promise.all(Object.entries(TEN).map(async ([id, [, cc]]) => (await cards.filter({ hasText: new RegExp(`id ${id}\\b`) }).first().evaluate(e => e.querySelector('[data-testid=dc-flag]').naturalWidth)) > 0 && !!NAMES[cc]))
      ok(nameCheck.every(Boolean), `países: ${Object.values(TEN).map(([c, cc]) => `${c}→${NAMES[cc]}`).join(', ')}`)
      await hide(p); await p.screenshot({ path: `${OUT}/${label}-1-painel-datacenters.png`, fullPage: true })
      // ativar/desativar continua a funcionar e a gravar
      const sg = cards.filter({ hasText: /id 302\b/ }).first()
      await sg.getByTestId('cv-dc-check').uncheck(); await p.getByTestId('cv-dc-save').click()
      await p.getByText('Centros de dados guardados.').waitFor({ timeout: 15000 })
      ok(/Não oferecido/.test(await sg.innerText()) && (await flagInfo(sg, 'p.font-bold')).country === 'sg', 'desativar Singapore: selo «Não oferecido» e a bandeira mantém-se')
      const dbOff = JSON.parse((await one('SELECT options FROM vps_provider_settings WHERE id = 1')).options).locations
      ok(dbOff.find(l => l.id === '302').enabled === false && dbOff.filter(l => l.enabled).length === 9 && dbOff.find(l => l.id === '302').country === 'sg', 'gravado na base: 9 oferecidos, país e ID intactos')
      r = await optsApi(); ok(!r.json.locations.some(l => l.id === '302') && r.json.locations.length === 9, 'seletor da compra deixa de listar Singapore')
      await p.reload({ waitUntil: 'domcontentloaded' }); await p.locator('[data-testid=cv-dc]').nth(9).waitFor()
      ok(!(await p.locator('[data-testid=cv-dc]').filter({ hasText: /id 302\b/ }).getByTestId('cv-dc-check').isChecked()), 'após recarregar, Singapore continua desativado')
      await p.locator('[data-testid=cv-dc]').filter({ hasText: /id 302\b/ }).getByTestId('cv-dc-check').check(); await p.getByTestId('cv-dc-save').click(); await p.getByText('Centros de dados guardados.').waitFor({ timeout: 15000 })
      ok(/Oferecido/.test(await p.locator('[data-testid=cv-dc]').filter({ hasText: /id 302\b/ }).innerText()) && (await optsApi()).json.locations.length === 10, 'reativar Singapore: «Oferecido» e volta ao seletor')
      ok(p.errors.length === 0, 'sem erros de JavaScript', p.errors)
      await ctx.close()

      // ── 2. Configuração de VPS: passo «Centro de dados» ──
      console.log(`\n2. Configuração de VPS → Centro de dados (${label})`)
      ;({ ctx, p } = await ctxFor(b, opts, c2.cookie))
      await p.goto(`${BASE}/servidor-vps/configurar?plano=${plan}`, { waitUntil: 'domcontentloaded' })
      await p.locator('[data-testid=cfg-location]').nth(9).waitFor({ timeout: 20000 }); await p.waitForTimeout(700)
      bad = []
      for (const [id, [city, cc]] of Object.entries(TEN)) {
        const btn = p.locator(`[data-testid=cfg-location][data-id="${id}"]`); const f = await flagInfo(btn)
        if (!(f.country === cc && f.loaded && f.w >= 18 && f.w <= 22 && f.dy <= 3 && !f.mapPin && !f.fallback && f.text.includes(city))) bad.push(`${city}: ${JSON.stringify(f)}`)
      }
      ok(bad.length === 0, 'dez opções: a bandeira do país substitui o ícone de localização, alinhada com a cidade', bad.join(' | '))
      const cfgSection = p.locator('section', { has: p.locator('[data-testid=cfg-location]') }).first()
      ok(await cfgSection.locator('svg.lucide-map-pin').count() === 0, 'sem ícones de localização enquanto há bandeira')
      ok(await p.locator('[data-testid=cfg-image] [data-testid=dc-flag], [data-testid=cfg-image] [data-testid=dc-flag-fallback]').count() === 0 && await p.getByTestId('cfg-hostname').count() === 1, 'cartões de sistemas operativos e campo Hostname inalterados (sem bandeiras)')
      const before = await p.locator('[data-testid=cfg-location][aria-pressed=true]').count()
      await p.locator('[data-testid=cfg-location][data-id="309"]').click()
      ok(await p.locator('[data-testid=cfg-location][data-id="309"]').getAttribute('aria-pressed') === 'true' && await p.locator('[data-testid=cfg-location][aria-pressed=true]').count() === 1 && before === 1, 'selecionar Düsseldorf: só essa opção fica ativa')
      await p.locator('[data-testid=cfg-location][data-id="307"]').click()
      ok(await p.locator('[data-testid=cfg-location][data-id="307"]').getAttribute('aria-pressed') === 'true' && await p.locator('[data-testid=cfg-location][data-id="309"]').getAttribute('aria-pressed') === 'false', 'mudar para Campinas: seleção troca')
      ok(await overflow(p) <= 1, 'sem deslocamento horizontal')
      await hide(p); await cfgSection.scrollIntoViewIfNeeded(); await cfgSection.screenshot({ path: `${OUT}/${label}-2-configuracao-centro-de-dados.png` })
      ok(p.errors.length === 0, 'sem erros de JavaScript', p.errors)
      await ctx.close()

      // ── 3. Compra: seletor «Localização do servidor» (modo automático) e seleção até ao carrinho ──
      console.log(`\n3. Compra → Localização do servidor (${label})`)
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente2@ensaio.test'")
      ;({ ctx, p } = await ctxFor(b, opts, c2.cookie))
      await p.goto(`${BASE}/comprar/${plan}?ciclo=monthly`, { waitUntil: 'domcontentloaded' })
      await p.locator('[data-testid^=opt-location-]').nth(9).waitFor({ timeout: 20000 }); await p.waitForTimeout(600)
      bad = []
      for (const [id, [city, cc]] of Object.entries(TEN)) {
        const f = await flagInfo(p.getByTestId(`opt-location-${id}`).locator('span').first())
        if (!(f.country === cc && f.loaded && f.w >= 18 && f.w <= 22 && f.dy <= 3 && f.text.includes(city))) bad.push(`${city}: ${JSON.stringify(f)}`)
      }
      ok(bad.length === 0, 'dez opções do seletor com a bandeira certa, alinhada com a cidade', bad.join(' | '))
      const fs1 = p.locator('fieldset', { has: p.locator('[data-testid^=opt-location-]') })
      ok(await fs1.locator('legend svg.lucide-map-pin').count() === 1, 'o ícone do título «Localização do servidor» mantém-se')
      await p.getByTestId('opt-location-308').click()
      ok(await p.getByTestId('opt-location-308').getAttribute('aria-checked') === 'true' && await p.locator('[data-testid^=opt-location-][aria-checked=true]').count() === 1, 'selecionar Boston 2: só essa opção fica marcada')
      await hide(p); await fs1.screenshot({ path: `${OUT}/${label}-3-compra-localizacao.png` })
      await p.getByTestId('opt-location-310').click(); await p.getByTestId('opt-image-1130').click()
      await p.getByTestId('add-to-cart').click(); await p.waitForURL('**/carrinho', { timeout: 20000 })
      ok(/Paris/.test(await p.getByTestId('line-options').first().innerText()), `a escolha segue para o carrinho: ${await p.getByTestId('line-options').first().innerText()}`)
      ok(p.errors.length === 0, 'sem erros de JavaScript', p.errors)
      await ctx.close()
    }

    // ── 4. Sem país ou bandeira em falha: cidade visível com ícone neutro ──
    console.log('\n4. Sem país identificado / bandeira em falha')
    const optsNow = JSON.parse((await one('SELECT options FROM vps_provider_settings WHERE id = 1')).options)
    const extra = [{ id: '901', label: 'Atlântida', detail: 'atl', enabled: true }, { id: '902', label: 'Zedland, zz', detail: 'zed', enabled: true }]
    await db.query('UPDATE vps_provider_settings SET options = ? WHERE id = 1', [JSON.stringify({ ...optsNow, locations: [...optsNow.locations, ...extra] })])
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      let { ctx, p } = await ctxFor(b, opts, c2.cookie)
      await p.route('**/flags/lt.png', r => r.abort())
      await p.goto(`${BASE}/servidor-vps/configurar?plano=${plan}`, { waitUntil: 'domcontentloaded' })
      await p.locator('[data-testid=cfg-location]').nth(11).waitFor({ timeout: 20000 }); await p.waitForTimeout(900)
      const atl = await flagInfo(p.locator('[data-testid=cfg-location][data-id="901"]')), zed = await flagInfo(p.locator('[data-testid=cfg-location][data-id="902"]')), vln = await flagInfo(p.locator('[data-testid=cfg-location][data-id="301"]'))
      ok(atl.fallback && !atl.country && /Atlântida/.test(atl.text), `${label}: sem país → cidade visível com ícone neutro`)
      ok(zed.fallback && /Zedland/.test(zed.text), `${label}: país sem ficheiro de bandeira → ícone neutro, cidade visível`)
      ok(vln.fallback && /Vilnius/.test(vln.text), `${label}: bandeira que falha o carregamento (Vilnius) → ícone neutro, cidade visível`)
      await p.locator('[data-testid=cfg-location][data-id="901"]').click()
      ok(await p.locator('[data-testid=cfg-location][data-id="901"]').getAttribute('aria-pressed') === 'true', `${label}: centro sem bandeira continua selecionável`)
      const sec = p.locator('section', { has: p.locator('[data-testid=cfg-location]') }).first(); await hide(p); await sec.screenshot({ path: `${OUT}/${label}-4-sem-bandeira.png` })
      await ctx.close()
    }
    {
      const { ctx, p } = await ctxFor(b, DESKTOP, adm.cookie)
      await p.goto(`${BASE}/admin/cloud-vps/datacenters`, { waitUntil: 'domcontentloaded' }); await p.locator('[data-testid=cv-dc]').nth(11).waitFor({ timeout: 20000 }); await p.waitForTimeout(900)
      const a = await flagInfo(p.locator('[data-testid=cv-dc]').filter({ hasText: /id 901\b/ }).first(), 'p.font-bold')
      ok(a.fallback && /Atlântida/.test(a.text) && /id 901/.test(a.text) && /atl/.test(a.text), 'painel: centro sem país mostra a cidade, o ID, o código e o selo com ícone neutro')
      await ctx.close()
    }
  } catch (e) { ok(false, 'execução', e.stack) }
  finally {
    // repõe a configuração e o simulador
    await fetch(`${MOCK}/_dcs?set=default`, { method: 'POST' }).catch(() => {})
    await db.query('UPDATE vps_provider_settings SET mode = ?, api_url = ?, secret_enc = ?, auto_provision = ?, payment_method_id = ?, options = ?, last_test_ok = ?, last_test_at = ?, last_test_message = ? WHERE id = 1',
      [snap.mode, snap.api_url, snap.secret_enc, snap.auto_provision, snap.payment_method_id, snap.options, snap.last_test_ok, snap.last_test_at, snap.last_test_message]).catch(() => {})
    await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente2@ensaio.test'").catch(() => {})
    await db.end(); await b.close()
  }
  console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
  process.exit(fail ? 1 : 0)
})()
