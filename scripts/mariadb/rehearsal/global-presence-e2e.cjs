// «Presença Global ViralizaHost» (página inicial): bandeiras locais por código ISO, junto ao código nos marcadores
// e junto ao nome na lista. Verifica a correspondência de cada bandeira, legibilidade e sobreposição dos marcadores
// (desktop e telemóvel), interacções, acessibilidade e o texto quando a imagem falha.
//   BASE_URL=http://localhost:3000 OUT=/tmp/mapa node scripts/mariadb/rehearsal/global-presence-e2e.cjs
const { chromium, devices } = require('playwright')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-mapa'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
// Localizações configuradas → ISO 3166-1 alfa-2 (fonte da verdade do ensaio)
const EXPECTED = { Angola: 'AO', Brasil: 'BR', Portugal: 'PT', EUA: 'US', 'Reino Unido': 'GB', 'Canadá': 'CA', 'França': 'FR', Alemanha: 'DE', 'México': 'MX',
  'Colômbia': 'CO', Chile: 'CL', Peru: 'PE', 'Bolívia': 'BO', Uruguai: 'UY', Argentina: 'AR', Turquia: 'TR', 'Rússia': 'RU', 'Índia': 'IN', China: 'CN',
  'Hong Kong': 'HK', 'Malásia': 'MY', Singapura: 'SG', 'Indonésia': 'ID' }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']

async function open(b, opts, blockFlags = false) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage()
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message))
  if (blockFlags) await p.route('**/flags/*.png', r => r.abort())
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  const sec = p.locator('#global-presence'); await sec.scrollIntoViewIfNeeded()
  await p.locator('[data-testid=gp-marker]').first().waitFor(); await p.waitForTimeout(1500)
  return { ctx, p, sec }
}
const overlaps = boxes => { const out = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.x < c.x + c.w - 0.5 && c.x < a.x + a.w - 0.5 && a.y < c.y + c.h - 0.5 && c.y < a.y + a.h - 0.5) out.push(`${a.code}/${c.code}`) } return out }

;(async () => {
  const b = await chromium.launch()
  try {
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      console.log(`\n${label}`)
      const { ctx, p, sec } = await open(b, opts)
      // Lista: nome + bandeira (decorativa) do código certo
      const list = await p.locator('[data-testid=gp-country]').evaluateAll(els => els.map(e => ({ code: e.dataset.code, name: e.innerText.trim(), img: e.querySelector('img') && { src: e.querySelector('img').getAttribute('src'), alt: e.querySelector('img').getAttribute('alt'), hidden: e.querySelector('img').getAttribute('aria-hidden'), w: e.querySelector('img').naturalWidth } })))
      ok(list.length === 23 && list.every(x => EXPECTED[x.name] === x.code), `lista: 23 localizações com nome e código preservados (${list.map(x => x.code).join(' ')})`)
      ok(list.every(x => x.img && x.img.src === `/flags/${x.code.toLowerCase()}.png`), 'lista: cada nome com a bandeira do seu código ISO')
      ok(list.every(x => x.img.w > 0), 'lista: todas as bandeiras carregadas (imagens locais)')
      ok(list.every(x => x.img.alt === '' && x.img.hidden === 'true'), 'lista: bandeira decorativa (alt vazio, aria-hidden)')
      ok(EXPECTED['Reino Unido'] === 'GB' && list.find(x => x.name === 'Reino Unido').img.src === '/flags/gb.png' && list.find(x => x.name === 'Hong Kong').img.src === '/flags/hk.png', 'Reino Unido → GB e Hong Kong → HK')
      // Marcadores: bandeira junto ao código
      const marks = await p.locator('[data-testid=gp-marker]').evaluateAll(els => els.map(g => {
        const r = g.querySelector('rect').getBoundingClientRect(), t = g.querySelector('[data-testid=gp-marker-code]'), img = g.querySelector('image')
        return { code: g.dataset.code, text: t.textContent, font: t.getBoundingClientRect().height, href: img?.getAttribute('href'), imgHidden: img?.getAttribute('aria-hidden'), x: r.x, y: r.y, w: r.width, h: r.height }
      }))
      ok(marks.length === 23 && marks.every(m => m.text === m.code && Object.values(EXPECTED).includes(m.code)), 'mapa: 23 marcadores com o código ISO visível')
      ok(marks.every(m => m.href === `/flags/${m.code.toLowerCase()}.png` && m.imgHidden === 'true'), 'mapa: bandeira do código certo em cada marcador (decorativa)')
      const ov = overlaps(marks)
      ok(ov.length === 0, `mapa: marcadores sem sobreposição (Europa, Cone Sul, Sudeste Asiático)${ov.length ? ` — ${ov.join(', ')}` : ''}`)
      const minFont = Math.min(...marks.map(m => m.font)), minH = Math.min(...marks.map(m => m.h))
      ok(minFont >= 9.5 && minH >= 16, `mapa: códigos legíveis (texto ≥ ${minFont.toFixed(1)} px, rótulos ≥ ${minH.toFixed(1)} px)`)
      ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'página sem deslocamento horizontal')
      // Interacções preservadas: passar na lista destaca o ponto e mostra o nome; rotas continuam
      const routes = await p.locator('[data-testid=gp-map] path.gp-flow').count()
      ok(routes === 25, `rotas de rede preservadas (${routes})`)
      if (label === 'desktop') {
        await p.locator('[data-testid=gp-country][data-code=GB]').hover(); await p.waitForTimeout(250)
        ok(await p.locator('[data-testid=gp-map] text', { hasText: 'Reino Unido' }).count() === 1, 'passar o rato em «Reino Unido» mostra o nome no mapa')
        ok(await p.locator('[data-testid=gp-marker][data-code=GB] rect').first().getAttribute('stroke') === '#F5B700', 'e destaca o marcador GB')
        await p.locator('[data-testid=gp-marker][data-code=HK]').hover(); await p.waitForTimeout(250)
        ok(await p.locator('[data-testid=gp-country][data-code=HK]').evaluate(e => /F5B700/i.test(getComputedStyle(e).backgroundColor) || e.className.includes('bg-[#F5B700]')), 'passar no marcador HK destaca «Hong Kong» na lista')
        await p.mouse.move(5, 5)
      } else {
        const sc = p.getByTestId('gp-map-scroll')
        const s = await sc.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, sl: e.scrollLeft }))
        ok(s.sw > s.cw && s.sl > 0 && await p.getByTestId('gp-map-hint').isVisible(), 'telemóvel: mapa desloca-se dentro do cartão (centrado no Atlântico), com indicação')
      }
      ok(p.errors.length === 0, 'sem erros de JavaScript', p.errors.join(' | '))
      await sec.screenshot({ path: `${OUT}/${label}-presenca-global.png` })
      await p.getByTestId('gp-map').screenshot({ path: `${OUT}/${label}-mapa.png` })
      if (label === 'iphone') {
        await p.getByTestId('gp-map-scroll').evaluate(e => { e.scrollLeft = e.scrollWidth })
        await p.waitForTimeout(200)
        await p.getByTestId('gp-map-scroll').screenshot({ path: `${OUT}/iphone-mapa-asia.png` })
        await p.getByTestId('gp-map-scroll').evaluate(e => { e.scrollLeft = 0 })
        await p.waitForTimeout(200)
        await p.getByTestId('gp-map-scroll').screenshot({ path: `${OUT}/iphone-mapa-americas.png` })
      }
      await ctx.close()
    }
    // Bandeiras indisponíveis: nome e código continuam legíveis, sem imagem partida
    console.log('\nBandeiras indisponíveis')
    const { ctx, p } = await open(b, DESKTOP, true)
    await p.waitForTimeout(800)
    ok(await p.locator('[data-testid=gp-country-flag]').count() === 0 && await p.locator('[data-testid=gp-marker-flag]').count() === 0, 'imagens que falham são retiradas (sem ícone partido)')
    const names = await p.locator('[data-testid=gp-country]').allInnerTexts()
    ok(names.length === 23 && names.every(n => Object.keys(EXPECTED).includes(n.trim())), 'lista mantém todos os nomes')
    ok((await p.locator('[data-testid=gp-marker-code]').allTextContents()).length === 23, 'mapa mantém todos os códigos')
    ok(overlaps(await p.locator('[data-testid=gp-marker]').evaluateAll(els => els.map(g => { const r = g.querySelector('rect').getBoundingClientRect(); return { code: g.dataset.code, x: r.x, y: r.y, w: r.width, h: r.height } }))).length === 0, 'rótulos só com código também sem sobreposição')
    await p.getByTestId('gp-map').screenshot({ path: `${OUT}/desktop-mapa-sem-imagens.png` })
    await ctx.close()
  } catch (e) { ok(false, 'execução', e.stack) }
  await b.close()
  console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
  process.exit(fail ? 1 : 0)
})()
