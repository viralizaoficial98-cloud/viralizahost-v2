// /hospedagem-de-sites: hero com a configuração de «Banners de páginas», ordem das secções, H1 único, só planos de
// hospedagem (sem grelha WordPress), âncoras e encaminhamentos (#wordpress), «Todos os planos incluem» só com benefícios
// comuns (confirmados no catálogo), afirmações não confirmadas ausentes, SSL conforme o catálogo, links das secções
// novas, percurso de um plano até à configuração da compra e planos WordPress preservados no catálogo.
// Desktop + iPhone. Sem compras.
//   BASE_URL=http://localhost:3000 OUT=/tmp/hosting-page node --env-file=.env.local scripts/mariadb/rehearsal/hosting-page-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-hosting-page'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const num = s => Number(String(s ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const ORDER = ['hero', 'plans', 'included', 'build', 'security', 'cta']
// Afirmações não confirmadas no catálogo/documentação: não podem aparecer na página
const UNCONFIRMED = [/Imunify/i, /SitePad/i, /\b500\b.*modelos/i, /LiteSpeed/i, /99[.,]9/, /DDoS/i, /6x/i, /posicionamento/i]
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const hosting = await all(`SELECT p.id, p.slug, p.name FROM products p WHERE p.category = 'hosting' AND p.active = 1 AND p.sale_status = 'active'
    AND EXISTS (SELECT 1 FROM product_prices x WHERE x.product_id = p.id AND x.active = 1) ORDER BY p.position`)
  const feats = async id => (await all('SELECT feature FROM product_features WHERE product_id = ? AND included = 1', [id])).map(r => r.feature)
  const featsBy = {}; for (const h of hosting) featsBy[h.slug] = await feats(h.id)
  const [banner] = await all("SELECT id, title, subtitle, tag, bg_image, button_primary_text, button_primary_link FROM banner_pages WHERE page_slug = 'hospedagem-de-sites' AND is_active = 1")
  const wpPlans = await all("SELECT p.slug FROM products p WHERE p.category = 'wordpress' AND p.active = 1 AND p.sale_status = 'active' AND EXISTS (SELECT 1 FROM product_prices x WHERE x.product_id = p.id AND x.active = 1) ORDER BY p.position")
  const b = await chromium.launch()
  let sslRestore = null, bannerRestore = null
  try {
    // ── 1. Encaminhamentos e âncoras ──
    console.log('\n1. Encaminhamentos e links que apontavam para os blocos removidos')
    const r = await fetch(BASE + '/hospedagem-wordpress', { redirect: 'manual' })
    ok(r.status === 308 && /\/hospedagem-de-sites#wordpress$/.test(r.headers.get('location') ?? ''), `/hospedagem-wordpress → 308 ${r.headers.get('location')}`)
    const footer = fs.readFileSync('src/components/layout/Footer.tsx', 'utf8')
    ok(/Hospedagem WordPress', href: '\/hospedagem-de-sites#wordpress'/.test(footer), 'rodapé: «Hospedagem WordPress» → #wordpress (bloco informativo)')
    ok(!!banner, `configuração «Banners de páginas» activa para hospedagem-de-sites («${banner?.title}»)`)

    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      console.log(`\n2. Página (${label})`)
      const ctx = await b.newContext({ ...opts }); const p = await ctx.newPage()
      const errors = []; p.on('pageerror', e => errors.push(e.message))
      await p.goto(BASE + '/hospedagem-de-sites', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('hosting-plan-card').first().waitFor()
      // Ordem e ausência de outros blocos
      const tops = await p.evaluate(o => o.map(s => { const e = document.querySelector(`main [data-section="${s}"]`); return e ? e.getBoundingClientRect().top + window.scrollY : null }), ORDER)
      ok(tops.every(t => t !== null) && tops.every((t, i) => i === 0 || t > tops[i - 1]), `secções por esta ordem: ${ORDER.join(' → ')}`, JSON.stringify(tops))
      const blocks = await p.evaluate(() => [...document.querySelectorAll('main > *')].map(e => e.getAttribute('data-section') ?? e.id ?? e.tagName))
      ok(JSON.stringify(blocks) === JSON.stringify(ORDER), `sem outros blocos na rota (${blocks.join(', ')})`)
      ok(await p.locator('header').first().isVisible() && await p.locator('footer').first().isVisible(), 'cabeçalho e rodapé globais')
      const h1 = await p.locator('h1').allInnerTexts()
      ok(h1.length === 1 && h1[0].trim() === banner.title.trim() && await p.getByTestId('hosting-hero').locator('h1').count() === 1, `um único H1, na hero, com o título do painel: «${h1.join(' | ')}»`)
      // Hero: conteúdo e imagem da configuração do painel
      const hero = p.getByTestId('hosting-hero')
      const heroHtml = await hero.innerHTML()
      ok(!banner.subtitle || (await hero.innerText()).includes(banner.subtitle.trim()), 'hero: subtítulo do painel')
      ok(!banner.bg_image || heroHtml.includes(banner.bg_image.replace(/&/g, '&amp;')) || heroHtml.includes(banner.bg_image), 'hero: imagem configurada no painel')
      ok(!banner.button_primary_link || await hero.locator(`a[href="${banner.button_primary_link}"]`).count() >= 1, `hero: botão principal → ${banner.button_primary_link}`)
      const h2 = await p.locator('main h2').allInnerTexts()
      ok(h2.some(x => x.includes('Hospedagem de sites — Escolha o seu plano')), '«Hospedagem de sites — Escolha o seu plano» como H2 logo a seguir à hero')
      ok(['Todos os planos incluem', 'Crie e publique o seu site', 'Segurança para o seu site', 'Comece hoje'].every(t => h2.some(x => x.includes(t))), `títulos das secções: ${h2.join(' | ')}`)
      ok(!(await p.getByTestId('section-wordpress').count()) && !(await p.locator('main').getByText('Hospedagem WordPress optimizada').count()), 'antiga secção autónoma de WordPress removida (integrada em «Crie e publique»)')
      // Planos (catálogo)
      ok(/Kz/.test(await p.locator('#planos').innerText()) && await p.getByTestId('hosting-plan-card').count() === hosting.length, `planos de hospedagem do catálogo (${hosting.length}) com preços`)
      ok(await p.locator('#planos-wordpress').count() === 0 && await p.locator('main a[href^="/comprar/wp-"]').count() === 0 && !(await p.locator('main').getByText('Planos WordPress', { exact: true }).count()), 'sem grelha de planos WordPress na página')
      ok(await p.locator('#planos a[href^="/comprar/"]').evaluateAll(as => as.every(a => !/\/comprar\/wp-/.test(a.getAttribute('href')))), '«Escolha o seu plano»: só planos de hospedagem de sites')
      // Todos os planos incluem: só comuns a todos os planos
      const inc = await p.locator('[data-section=included]').getByTestId('included-title').allInnerTexts()
      const CHECKS = { 'cPanel incluído': /cPanel/i, 'Armazenamento NVMe SSD': /NVMe/i, 'E-mail no seu domínio': /e-?mail/i, 'Migração gratuita': /Migra.*gratuita/i, 'Suporte 24/7': /Suporte.*24\/7/i }
      ok(inc.length === Object.keys(CHECKS).length && inc.every(t => CHECKS[t] && hosting.every(h => featsBy[h.slug].some(f => CHECKS[t].test(f)))), `«Todos os planos incluem»: ${inc.join(', ')} — presentes em todos os planos do catálogo`)
      ok(!inc.some(t => /SSL|Backup|cópia/i.test(t)), 'sem duplicar SSL e cópias de segurança (tratados em «Segurança»)')
      // Afirmações não confirmadas
      // Texto da página fora da hero (a hero é conteúdo editável no painel)
      const text = await p.evaluate(() => [...document.querySelectorAll('main > [data-section]:not([data-section=hero])')].map(e => e.innerText).join('\n'))
      const bad = UNCONFIRMED.filter(re => re.test(text))
      ok(!bad.length, 'sem afirmações por confirmar (Imunify360, SitePad, 500 modelos, LiteSpeed, 99,9%, DDoS, posicionamento)', bad.join(', '))
      // Crie e publique
      const build = p.getByTestId('section-build')
      for (const t of ['Use WordPress', 'Crie com um editor visual', 'Peça um site à nossa equipa']) ok(/./.test(t) && (await build.getByRole('heading', { name: t }).count()) === 1, `«${t}»`)
      ok(await p.locator('#wordpress').count() === 1 && await p.locator('#planos').count() === 1, 'âncoras #planos e #wordpress únicas')
      ok(await p.getByTestId('build-option-wordpress').locator('a').count() === 0 && /WordPress/.test(await p.getByTestId('build-option-wordpress').innerText()), '«Use WordPress»: bloco informativo, sem botão para planos')
      ok(await p.locator('a[href*="planos-wordpress"]').count() === 0, 'nenhum link para #planos-wordpress')
      const hrefs = await build.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href')))
      ok(JSON.stringify(hrefs) === JSON.stringify(['/criador-de-sites', '/construtor-wordpress', '/suporte/contactar']), `links: ${hrefs.join(', ')}`)
      // Segurança
      const sec = p.getByTestId('section-security')
      ok(await sec.getByRole('heading', { name: 'Proteção do alojamento' }).count() === 1 && await sec.getByRole('heading', { name: 'HTTPS para os seus visitantes' }).count() === 1, 'dois blocos: «Proteção do alojamento» e «HTTPS para os seus visitantes»')
      const allSsl = hosting.every(h => featsBy[h.slug].some(f => /SSL/i.test(f)))
      const note = await p.getByTestId('ssl-note').innerText().catch(() => '')
      ok(allSsl ? /todos os planos de hospedagem/.test(note) : !/todos os planos/.test(note), `SSL conforme o catálogo: «${note}»`)
      // Links internos respondem
      if (label === 'desktop') {
        for (const h of ['/criador-de-sites', '/construtor-wordpress', '/suporte/contactar']) { const x = await fetch(BASE + h); ok(x.status === 200, `${h} → ${x.status}`) }
      }
      // Comece hoje → área dos planos
      const cta = p.locator('[data-section=cta] a').first()
      ok(await cta.getAttribute('href') === '#planos', '«Comece hoje»: botão aponta para #planos')
      await cta.click(); await p.waitForTimeout(800)
      ok(/#planos$/.test(p.url()) && await p.evaluate(() => { const r = document.querySelector('#planos').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0 }), '«Comece hoje» leva à área dos planos')
      // Encaminhamento antigo → bloco informativo visível
      await p.goto(BASE + '/hospedagem-wordpress', { waitUntil: 'domcontentloaded' })
      await p.locator('#wordpress').waitFor(); await p.waitForTimeout(800)
      ok(/\/hospedagem-de-sites#wordpress$/.test(p.url()) && await p.evaluate(() => { const r = document.querySelector('#wordpress').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0 }), '/hospedagem-wordpress abre o bloco «Use WordPress»')
      ok(await overflow(p) <= 1, 'sem deslocamento horizontal', await overflow(p))
      ok(!errors.length, 'sem erros na página', errors.join(' | '))
      // Capturas
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300)
      await p.addStyleTag({ content: 'header { position: absolute !important } [data-floating], [class*=fixed][class*=bottom] { display: none !important }' })
      await p.screenshot({ path: `${OUT}/${label}-01-pagina.png`, fullPage: true })
      await hero.screenshot({ path: `${OUT}/${label}-00-hero.png` })
      await build.screenshot({ path: `${OUT}/${label}-02-crie-e-publique.png` })
      await sec.screenshot({ path: `${OUT}/${label}-03-seguranca.png` })

      // Percurso: plano → configuração da compra (sem encomendar)
      console.log(`\n3. Percurso de compra (${label})`)
      await p.goto(BASE + '/hospedagem-de-sites', { waitUntil: 'domcontentloaded' })
      const card = p.getByTestId('hosting-plan-card').first(); await card.waitFor()
      const slug = await card.getAttribute('data-slug')
      const cardMonthly = num(await card.getByTestId('hosting-plan-monthly').innerText())
      await card.getByTestId('hosting-plan-cta').click()
      await p.waitForURL(`**/comprar/${slug}**`)
      ok(/Escolha o domínio/.test(await p.locator('body').innerText()), `«Comprar agora» (${slug}) → configuração da compra (domínio)`)
      await p.getByRole('radio', { name: /Usar um domínio que já tenho/ }).click()
      await p.getByPlaceholder('empresa.ao').fill('ensaio-pagina.ao')
      await p.getByTestId('continue-own-domain').click(); await p.waitForURL('**passo=duracao**')
      await p.getByTestId('cycle-monthly').click()
      const [price] = await all("SELECT pp.price FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.slug = ? AND pp.cycle = 'monthly' AND pp.active = 1", [slug])
      ok(num(await p.getByTestId('flow-total').innerText()) === Number(price.price) && cardMonthly === Number(price.price), `preço do catálogo mantido: cartão ${cardMonthly} = duração ${await p.getByTestId('flow-total').innerText()} = ${price.price} Kz`)
      // Planos WordPress: fora desta página, mas o percurso de compra continua disponível
      if (wpPlans.length) {
        await p.goto(`${BASE}/comprar/${wpPlans[0].slug}`, { waitUntil: 'domcontentloaded' })
        const okWp = await p.getByText(/Escolha o domínio/).first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
        ok(okWp, `percurso WordPress preservado: /comprar/${wpPlans[0].slug} abre a configuração da compra`)
      }
      await ctx.close()
    }

    // ── 4. Catálogo WordPress preservado e hero ligada ao painel ──
    console.log('\n4. Catálogo WordPress preservado; hero segue o painel')
    ok(wpPlans.length >= 1, `planos WordPress continuam activos no catálogo, com preços (${wpPlans.map(x => x.slug).join(', ')})`)
    const api = await (await fetch(BASE + '/api/products?category=wordpress')).json()
    ok(api.success && api.data.length === wpPlans.length, '/api/products?category=wordpress continua a devolver os planos')
    const wpPage = await (await fetch(BASE + '/construtor-wordpress')).status
    ok(wpPage === 200, `/construtor-wordpress (planos WordPress Builder) → ${wpPage}`)
    if (banner) {
      bannerRestore = banner
      const novo = `${banner.title} (ensaio)`
      await db.query('UPDATE banner_pages SET title = ? WHERE id = ?', [novo, banner.id])
      const html = await (await fetch(BASE + '/hospedagem-de-sites')).text()
      ok(html.includes(novo), 'alterar o título em «Banners de páginas» muda a hero desta página')
      await db.query('UPDATE banner_pages SET title = ? WHERE id = ?', [banner.title, banner.id]); bannerRestore = null
    }

    // ── 5. SSL só nos planos em que é verdade ──
    console.log('\n4. SSL apresentado conforme o catálogo')
    const target = hosting[hosting.length - 1]
    const [f] = await all("SELECT id FROM product_features WHERE product_id = ? AND feature LIKE '%SSL%' AND included = 1 LIMIT 1", [target.id])
    if (f) {
      sslRestore = f.id
      await db.query('UPDATE product_features SET included = 0 WHERE id = ?', [f.id])
      const html = await (await fetch(BASE + '/hospedagem-de-sites')).text()
      const others = hosting.filter(h => h.id !== target.id).map(h => h.name)
      ok(!/incluído em todos os planos de hospedagem/.test(html) && others.every(n => html.includes(n)) && /Certificado SSL gratuito incluído nos planos/.test(html), `sem SSL num plano (${target.name}) → nota só com ${others.join(', ')}`)
      await db.query('UPDATE product_features SET included = 1 WHERE id = ?', [f.id]); sslRestore = null
    } else ok(true, 'catálogo sem SSL em algum plano: nota já reflecte isso')
  } catch (e) { ok(false, 'execução', e.stack) }
  finally {
    if (bannerRestore) await db.query('UPDATE banner_pages SET title = ? WHERE id = ?', [bannerRestore.title, bannerRestore.id]).catch(() => {})
    if (sslRestore) await db.query('UPDATE product_features SET included = 1 WHERE id = ?', [sslRestore]).catch(() => {})
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
