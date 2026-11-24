// /dominios: hero com configuração própria em «Banners de páginas» (editada no painel: descrição e imagem nova),
// sem afectar /hospedagem-de-sites; secção «Registo de domínios» logo a seguir à hero; cartões = catálogo de
// domínios (extensão, descrição, preço do 1.º ano, etiqueta, ordem); botões e pesquisa nos fluxos existentes;
// H1 único; restantes secções mantidas; desktop + iPhone. Repõe os banners no fim. Sem compras.
//   BASE_URL=http://localhost:3000 OUT=/tmp/dominios node --env-file=.env.local scripts/mariadb/rehearsal/domains-page-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const zlib = require('node:zlib')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-dominios'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const num = s => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const RND = Math.random().toString(36).slice(2, 8)

// PNG simples (gradiente) gerado no teste: imagem nova a carregar no painel
function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = 245; raw[i + 1] = Math.round(183 * x / w); raw[i + 2] = Math.round(120 * y / h) } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
async function login(email, password) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  return r.headers.getSetCookie().map(c => c.split(';')[0]).find(c => c.startsWith('vh_session='))
}

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const snap = await all("SELECT * FROM banner_pages WHERE page_slug IN ('dominios', 'hospedagem-de-sites')")
  const dom0 = snap.find(r => r.page_slug === 'dominios'), host0 = snap.find(r => r.page_slug === 'hospedagem-de-sites')
  // Extensões em destaque, como lib/commerce/domain-catalog (featuredExtensions)
  const featured = await all(`SELECT e.extension, e.description, e.badge, e.badge_text, e.featured_position, e.highlight, dp.price
    FROM domain_extensions e JOIN domain_prices dp ON dp.extension = e.extension AND dp.operation = 'register' AND dp.years = 1 AND dp.status = 'active' AND dp.price IS NOT NULL
    WHERE e.featured = 1 ORDER BY e.featured_position, e.extension`)
  const BADGE = { popular: 'Popular', promo: 'Promoção', new: 'Novo' }
  const badgeOf = r => (r.badge === 'custom' ? r.badge_text || null : BADGE[r.badge] ?? null)
  const admin = await login('admin@ensaio.test', 'Admin#Teste2026')
  const b = await chromium.launch()
  const heroOf = async path => {
    const html = await (await fetch(BASE + path, { cache: 'no-store' })).text()
    return html
  }
  try {
    ok(!!dom0 && !!host0, `configurações próprias em «Banners de páginas»: dominios («${dom0?.title}») e hospedagem-de-sites`)

    // ── 1. Painel: guardar descrição e substituir a imagem da hero de /dominios ──
    console.log('\n1. Painel → Banners de páginas → Domínios: nova descrição e nova imagem')
    let { ctx, p } = await (async () => { const ctx = await b.newContext(DESKTOP); await ctx.addCookies([{ name: 'vh_session', value: admin.split('=')[1], url: BASE }]); return { ctx, p: await ctx.newPage() } })()
    await p.goto(BASE + '/admin/site/banner-pages', { waitUntil: 'domcontentloaded' })
    const row = p.locator('[data-testid=banner-row][data-slug="dominios"]'); await row.waitFor()
    await row.getByTestId('banner-edit').click()
    const SUB = `Descrição de ensaio ${RND}: pesquise e registe o domínio da sua marca.`
    await p.getByTestId('banner-subtitle').fill(SUB)
    const before = await p.locator('input[placeholder="Ou cole o URL da imagem"]').inputValue()
    await p.getByTestId('banner-image-file').setInputFiles({ name: `hero-dominios-${RND}.png`, mimeType: 'image/png', buffer: png(960, 400) })
    await p.waitForFunction(prev => { const i = document.querySelector('input[placeholder="Ou cole o URL da imagem"]'); return i && i.value && i.value !== prev }, before, { timeout: 20000 })
    const newImg = await p.locator('input[placeholder="Ou cole o URL da imagem"]').inputValue()
    ok(newImg && newImg !== before && /\.png/.test(newImg), `imagem carregada no painel (${newImg.replace(BASE, '')})`)
    await p.getByTestId('banner-save').click()
    await p.waitForTimeout(1500)
    await p.screenshot({ path: `${OUT}/desktop-00-painel-banner-dominios.png` })
    await ctx.close()
    const [dom1] = await all("SELECT subtitle, bg_image FROM banner_pages WHERE page_slug = 'dominios'")
    ok(dom1.subtitle === SUB && dom1.bg_image === newImg, 'configuração «dominios» guardada (descrição e imagem)')
    const imgRes = await fetch(newImg.startsWith('http') ? newImg : BASE + newImg)
    ok(imgRes.status === 200 && /image\/png/.test(imgRes.headers.get('content-type') ?? ''), `imagem servida (${imgRes.status} ${imgRes.headers.get('content-type')})`)
    const domHtml = await heroOf('/dominios')
    const pathOf = u => u.replace(/^https?:\/\/[^/]+/, '')
    ok(domHtml.includes(SUB) && domHtml.includes(pathOf(newImg)), '/dominios: hero com a nova descrição e a nova imagem')
    const hostHtml = await heroOf('/hospedagem-de-sites')
    const [host1] = await all("SELECT title, subtitle, bg_image, updated_at FROM banner_pages WHERE page_slug = 'hospedagem-de-sites'")
    ok(!hostHtml.includes(SUB) && !hostHtml.includes(pathOf(newImg)) && hostHtml.includes(host0.bg_image.replace(/&/g, '&amp;')) && host1.updated_at === host0.updated_at && host1.subtitle === host0.subtitle,
      '/hospedagem-de-sites: hero inalterada (conteúdo independente)')

    // ── 2. Página em desktop e telemóvel ──
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      console.log(`\n2. /dominios (${label})`)
      ;({ ctx, p } = await (async () => { const ctx = await b.newContext({ ...opts }); return { ctx, p: await ctx.newPage() } })())
      const errors = []; p.on('pageerror', e => errors.push(e.message))
      await p.goto(BASE + '/dominios', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('ext-card').first().waitFor({ timeout: 15000 })
      const blocks = await p.evaluate(() => [...document.querySelectorAll('main > *')].map(e => e.getAttribute('data-section') ?? e.id ?? e.tagName))
      ok(blocks[0] === 'hero' && blocks[1] === 'domain-register', `hero e, logo a seguir, «Registo de domínios» (${blocks.slice(0, 4).join(' → ')}…)`)
      const tops = await p.evaluate(() => ['[data-section=hero]', '[data-section=domain-register]', '#extensoes', '#registo', '#gestao', '#recursos'].map(s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : null }))
      ok(tops.every(t => t != null) && tops.every((t, i) => !i || t > tops[i - 1]), 'restantes secções mantidas abaixo (extensões, registo, gestão, recursos)')
      const hero = p.getByTestId('domains-hero')
      ok(await hero.getAttribute('data-banner-source') === 'admin' && await hero.getAttribute('data-banner-slug') === 'dominios', 'hero lida da configuração «dominios» do painel')
      const h1 = await p.locator('h1').allInnerTexts()
      ok(h1.length === 1 && h1[0].trim() === dom0.title.trim() && await hero.locator('h1').count() === 1, `um único H1, na hero: «${h1.join(' | ')}»`)
      ok((await hero.innerText()).includes(SUB), 'hero: descrição guardada no painel')
      // Hero partilhada com /hospedagem-de-sites: mesmo layout (imagem à direita em desktop)
      const img = await hero.evaluate(el => { const d = [...el.querySelectorAll('div')].find(x => (x.style.backgroundImage || '').includes('url(')); if (!d) return null; const r = d.getBoundingClientRect(); return { bg: d.style.backgroundImage, left: r.left, width: r.width, vw: innerWidth, op: getComputedStyle(d).opacity } })
      ok(img && img.bg.includes(pathOf(newImg)), 'hero: nova imagem aplicada')
      if (label === 'desktop') ok(img && img.left > img.vw * 0.3 && Number(img.op) === 1, `desktop: imagem à direita (início em ${Math.round(img.left)} px de ${img.vw})`)
      else ok(img && img.left <= 1 && Number(img.op) < 1, `telemóvel: imagem por trás do texto, atenuada (opacidade ${img?.op})`)
      // Secção «Registo de domínios»
      const sec = p.getByTestId('domain-register')
      const secText = await sec.innerText()
      ok(/REGISTO DE DOMÍNIOS/.test(secText), 'linha superior «REGISTO DE DOMÍNIOS»')
      const h2 = await sec.locator('h2').innerText()
      ok(h2.replace(/\s+/g, ' ').trim() === 'Encontre o domínio ideal para o seu negócio', `H2: «${h2.replace(/\s+/g, ' ')}»`)
      ok(await sec.getByTestId('domain-register-highlight').evaluate(e => e.textContent === 'domínio ideal' && getComputedStyle(e).color === 'rgb(245, 183, 0)'), '«domínio ideal» em amarelo')
      ok(secText.includes('Pesquise, registe e proteja o nome da sua marca com rapidez e segurança.'), 'descrição')
      ok(await sec.getByTestId('domain-search-input').getAttribute('placeholder') === 'Digite o nome do domínio desejado' && /Pesquisar Domínio/.test(await sec.getByTestId('domain-search-submit').innerText()), 'campo «Digite o nome do domínio desejado» e botão «Pesquisar Domínio»')
      const btnBg = await sec.getByTestId('domain-search-submit').evaluate(e => getComputedStyle(e).backgroundColor)
      ok(btnBg === 'rgb(245, 183, 0)', 'botão amarelo')
      const trust = await sec.getByTestId('domain-trust').innerText()
      ok(['Preços em kwanzas', 'Disponibilidade revalidada na encomenda', 'Suporte especializado'].every(t => trust.includes(t)) && await sec.getByTestId('domain-trust').locator('svg').count() === 3, 'três indicações com ícones')
      // Cartões = catálogo
      const cards = await sec.getByTestId('ext-card').evaluateAll(cs => cs.map(c => ({ ext: c.getAttribute('data-ext'), desc: c.querySelector('[data-testid=ext-card-desc]')?.textContent ?? '', price: c.querySelector('[data-testid=ext-card-price]')?.textContent ?? '', badge: c.querySelector('[data-testid=ext-card-badge]')?.textContent ?? null, btn: c.querySelector('[data-testid=ext-card-register]')?.textContent ?? '' })))
      ok(JSON.stringify(cards.map(c => c.ext)) === JSON.stringify(featured.map(f => f.extension)), `extensões e ordem do catálogo: ${cards.map(c => c.ext).join(' ')}`)
      const bad = cards.filter((c, i) => { const f = featured[i]; return !f || num(c.price.split('/')[0]) !== Number(f.price) || c.desc !== (f.description ?? '') || (c.badge ?? null) !== badgeOf(f) || c.btn.trim() !== 'Registar' })
      ok(!bad.length, 'descrição, preço do 1.º ano, etiqueta e botão «Registar» iguais ao catálogo', JSON.stringify(bad))
      ok(await overflow(p) <= 1, 'sem deslocamento horizontal', await overflow(p))
      // Capturas
      await p.addStyleTag({ content: 'header { position: absolute !important } [data-floating], [class*=fixed][class*=bottom] { display: none !important }' })
      await p.screenshot({ path: `${OUT}/${label}-01-pagina.png`, fullPage: true })
      await hero.screenshot({ path: `${OUT}/${label}-02-hero.png` })
      await sec.screenshot({ path: `${OUT}/${label}-03-registo-de-dominios.png` })
      // Fluxos: «Registar» sem nome → pesquisa com a extensão; com nome → domínio completo
      const first = featured[0].extension
      await sec.locator(`[data-testid=ext-card][data-ext="${first}"]`).getByTestId('ext-card-register').click()
      await p.waitForURL('**/dominios/pesquisar**')
      ok(new URL(p.url()).searchParams.get('ext') === first, `«Registar» ${first} → /dominios/pesquisar?ext=${first}`)
      await p.goto(BASE + '/dominios', { waitUntil: 'domcontentloaded' }); await p.getByTestId('ext-card').first().waitFor()
      const name = `ensaio-dom-${RND}`
      await p.getByTestId('domain-search-input').fill(name)
      await p.getByTestId('domain-register').locator(`[data-testid=ext-card][data-ext="${first}"]`).getByTestId('ext-card-register').click()
      await p.waitForURL('**/dominios/pesquisar**')
      ok(new URL(p.url()).searchParams.get('q') === `${name}${first}`, `com nome escrito → /dominios/pesquisar?q=${name}${first}`)
      await p.goto(BASE + '/dominios', { waitUntil: 'domcontentloaded' }); await p.getByTestId('ext-card').first().waitFor()
      await p.getByTestId('domain-search-input').fill(`${name}.com`)
      await p.getByTestId('domain-search-submit').click()
      const choose = p.getByTestId('domain-register').getByRole('button', { name: /Escolher/ }).first()
      const found = await choose.waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
      ok(found, '«Pesquisar Domínio»: disponibilidade e alternativas (pesquisa existente)')
      if (found) { await choose.click(); await p.waitForURL('**/dominios/pesquisar?q=**'); ok(/q=ensaio-dom-/.test(p.url()), `«Escolher» → ${p.url().replace(BASE, '')} (fluxo de registo)`) }
      await p.goto(BASE + '/dominios', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('domain-actions').getByText('Transferir').click(); await p.waitForURL('**/dominios/transferir')
      ok(true, 'acções: «Transferir» abre o fluxo de transferência')
      ok(!errors.length, 'sem erros na página', errors.join(' | '))
      await ctx.close()
    }

    // ── 3. Página inicial: mesma secção, variante da página inicial ──
    console.log('\n3. Página inicial (componente partilhado)')
    ;({ ctx, p } = await (async () => { const ctx = await b.newContext(DESKTOP); return { ctx, p: await ctx.newPage() } })())
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await p.getByTestId('ext-card').first().waitFor({ timeout: 15000 })
    ok(await p.getByTestId('domain-register').count() === 0 && await p.locator('a[href="/dominios"]').filter({ hasText: 'Ver todos os domínios' }).count() === 1, 'página inicial mantém a sua variante (link «Ver todos os domínios e preços»)')
    await ctx.close()
  } catch (e) { ok(false, 'execução', e.stack) }
  finally {
    for (const r of snap) {
      const cols = ['title', 'subtitle', 'bg_image', 'tag', 'breadcrumb', 'updated_at']
      await db.query(`UPDATE banner_pages SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => r[c]), r.id]).catch(e => ok(false, 'reposição', e.message))
    }
    const back = await all("SELECT page_slug, subtitle, bg_image FROM banner_pages WHERE page_slug IN ('dominios', 'hospedagem-de-sites')")
    ok(back.every(r => { const s = snap.find(x => x.page_slug === r.page_slug); return s.subtitle === r.subtitle && s.bg_image === r.bg_image }), 'banners repostos como estavam')
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
