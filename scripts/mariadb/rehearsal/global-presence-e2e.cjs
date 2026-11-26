// «Presença Global ViralizaHost» (página inicial): globo 3D (three.js) com bandeiras locais por código ISO, pulsos,
// rotas animadas, rotação e alternativa em mapa plano. Verifica (desktop e telemóvel):
//   · carregamento sob demanda (nenhuma textura antes de a secção se aproximar) e espaço reservado (sem saltos);
//   · vista inicial com África/Atlântico e Angola visível; marcadores atrás da Terra ocultos;
//   · os 23 países consultáveis (clicar na lista roda o globo até ao país), rótulos legíveis e sem sobreposição;
//   · rotação por arrasto e teclado, bandeiras a acompanhar as coordenadas, pulsos e rotas, legenda e interacções;
//   · prefers-reduced-motion; scroll vertical livre no telemóvel (touch-action); sem 3D → mapa plano; textura em falta;
//   · bandeiras indisponíveis (nome e código continuam legíveis).
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
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
const IPHONE = devices['iPhone 13']
const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const NO_WEBGL = () => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/i.test(String(t)) ? null : orig.call(this, t, ...r) } }

const overlaps = boxes => { const out = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.x < c.x + c.w - 0.5 && c.x < a.x + a.w - 0.5 && a.y < c.y + c.h - 0.5 && c.y < a.y + a.h - 0.5) out.push(`${a.code}/${c.code}`) } return out }

/** Abre a página inicial e leva a secção ao ecrã. `waitReady`: espera pelo globo (dica visível) ou pelo mapa plano. */
async function open(b, opts, { blockFlags = false, noWebgl = false, blockTexture = false, scroll = true } = {}) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage()
  p.errors = []; p.textureReq = []
  p.on('pageerror', e => p.errors.push(e.message))
  p.on('request', r => { if (/\/textures\//.test(r.url())) p.textureReq.push(r.url()) })
  if (noWebgl) await p.addInitScript(NO_WEBGL)
  if (blockFlags) await p.route('**/flags/*.png', r => r.abort())
  if (blockTexture) await p.route('**/textures/*', r => r.abort())
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  const sec = p.locator('#global-presence')
  if (scroll) await sec.scrollIntoViewIfNeeded()
  return { ctx, p, sec }
}
const waitGlobe = async p => { await p.getByTestId('gp-globe-hint').waitFor({ state: 'visible', timeout: 60000 }); await p.waitForTimeout(900) }
const waitFlat = async p => { await p.getByTestId('gp-map').waitFor({ timeout: 60000 }); await p.locator('[data-testid=gp-marker]').first().waitFor(); await p.waitForTimeout(1700) }  // 1,7 s: termina a animação de entrada da secção

/** Estado dos marcadores no globo: visibilidade, posição do ponto e caixa do rótulo. */
const globeState = p => p.evaluate(() => {
  const st = document.querySelector('[data-testid=gp-globe]').getBoundingClientRect()
  const dots = Object.fromEntries([...document.querySelectorAll('[data-testid=gp-dot]')].map(d => { const r = d.getBoundingClientRect(); return [d.dataset.code, { op: +d.getAttribute('opacity'), x: r.x + r.width / 2 - st.x, y: r.y + r.height / 2 - st.y }] }))
  const labels = [...document.querySelectorAll('[data-testid=gp-marker]')].map(g => {
    const r = g.querySelector('rect').getBoundingClientRect(), t = g.querySelector('[data-testid=gp-marker-code]'), img = g.querySelector('image')
    return { code: g.dataset.code, op: +g.getAttribute('opacity'), text: t.textContent, font: t.getBoundingClientRect().height, href: img?.getAttribute('href'), imgHidden: img?.getAttribute('aria-hidden'), x: r.x - st.x, y: r.y - st.y, w: r.width, h: r.height }
  })
  const arcs = [...document.querySelectorAll('[data-testid=gp-globe] path.gp-flow')].map(a => a.getAttribute('d') || '')
  return { w: st.width, h: st.height, dots, labels, arcs }
})
const shown = s => s.labels.filter(l => l.op > 0.45)

;(async () => {
  const b = await chromium.launch({ args: GL_ARGS })
  try {
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      console.log(`\n${label}: globo 3D`)
      // Carregamento sob demanda: nada da textura/3D enquanto a secção está longe do ecrã; espaço reservado
      const ctxA = await b.newContext(opts); const pA = await ctxA.newPage(); const texA = [], jsA = []
      pA.on('request', r => { if (/\/textures\//.test(r.url())) texA.push(r.url()); if (r.resourceType() === 'script') jsA.push(r.url()) })
      await pA.goto(BASE + '/', { waitUntil: 'load' }); await pA.waitForTimeout(2500)
      const stage0 = await pA.getByTestId('gp-globe-stage').boundingBox()
      ok(texA.length === 0, 'textura NÃO é pedida enquanto a secção está longe do ecrã')
      ok(!!stage0 && stage0.height >= (label === 'desktop' ? 440 : 380), `espaço do globo reservado antes de carregar (${Math.round(stage0?.width)}×${Math.round(stage0?.height)})`)
      const jsBefore = jsA.length
      await pA.locator('#global-presence').scrollIntoViewIfNeeded()
      await waitGlobe(pA)
      ok(jsA.length > jsBefore, `código do globo (three.js) carregado só ao aproximar (+${jsA.length - jsBefore} ficheiros JS)`)
      ok(texA.length === 1, `textura pedida uma vez ao aproximar (${texA.map(u => u.split('/').pop()).join(', ')})`)
      ok(/2k/.test(texA[0]), 'textura 2K (leve) num ecrã de densidade normal')
      const stage1 = await pA.getByTestId('gp-globe-stage').boundingBox()
      ok(Math.abs(stage1.height - stage0.height) < 1 && Math.abs(stage1.width - stage0.width) < 1, 'sem salto de layout: o globo ocupa o espaço já reservado')
      await ctxA.close()

      const { ctx, p, sec } = await open(b, opts)
      await waitGlobe(p)
      // Lista: nome + bandeira (decorativa) do código certo
      const list = await p.locator('[data-testid=gp-country]').evaluateAll(els => els.map(e => ({ code: e.dataset.code, name: e.innerText.trim(), img: e.querySelector('img') && { src: e.querySelector('img').getAttribute('src'), alt: e.querySelector('img').getAttribute('alt'), hidden: e.querySelector('img').getAttribute('aria-hidden'), w: e.querySelector('img').naturalWidth } })))
      ok(list.length === 23 && list.every(x => EXPECTED[x.name] === x.code), `lista: 23 localizações com nome e código preservados (${list.map(x => x.code).join(' ')})`)
      ok(list.every(x => x.img && x.img.src === `/flags/${x.code.toLowerCase()}.png` && x.img.w > 0 && x.img.alt === '' && x.img.hidden === 'true'), 'lista: bandeira local do código ISO certo, carregada e decorativa')
      ok(await p.getByText('Ponto de presença').isVisible() && await p.getByText('Rota de rede ativa').isVisible(), 'legenda mantida («Ponto de presença», «Rota de rede ativa»)')
      ok(await p.locator('#global-presence h2', { hasText: 'Presença Global' }).count() === 1 && await p.getByText('Infraestrutura distribuída globalmente').count() === 1, 'título e textos da secção mantidos')
      ok(await p.getByTestId('gp-map').count() === 0 && await p.locator('[data-testid=gp-globe] canvas').count() >= 1, 'globo 3D activo (canvas WebGL) e mapa plano não usado')

      // Vista inicial: África e Atlântico, Angola visível; o que fica atrás da Terra está oculto
      let s = await globeState(p)
      const cx = s.w / 2, cy = s.h / 2, R = Math.min(0.9 * s.h, 0.96 * s.w) / 2
      const ao = s.dots.AO, br = s.dots.BR, pt = s.dots.PT
      ok(ao.op > 0.9 && Math.hypot(ao.x - cx, ao.y - cy) < R * 0.8, `vista inicial: Angola visível dentro do globo (${ao.x.toFixed(0)},${ao.y.toFixed(0)})`)
      ok(br.op > 0.5 && pt.op > 0.9 && s.dots.GB.op > 0.5, 'vista inicial: Brasil, Portugal e Reino Unido também visíveis (Atlântico)')
      ok(['SG', 'ID', 'HK', 'US', 'CN'].every(c => s.dots[c].op < 0.05), 'marcadores atrás da Terra ocultos (SG, ID, HK, US, CN)')
      const lab0 = shown(s)
      ok(lab0.some(l => l.code === 'AO') && lab0.length >= 8 && lab0.length < 23, `rótulos visíveis só os da face voltada (${lab0.length}: ${lab0.map(l => l.code).join(' ')})`)
      ok(s.labels.length === 23 && s.labels.every(m => m.text === m.code && Object.values(EXPECTED).includes(m.code) && m.href === `/flags/${m.code.toLowerCase()}.png` && m.imgHidden === 'true'), '23 marcadores com código ISO e bandeira do código certo (decorativa)')
      const ov0 = overlaps(lab0)
      ok(ov0.length === 0, `marcadores visíveis sem sobreposição${ov0.length ? ' — ' + ov0.join(', ') : ''}`)
      ok(Math.min(...lab0.map(m => m.font)) >= 9.5 && Math.min(...lab0.map(m => m.h)) >= 16, `códigos legíveis (texto ≥ ${Math.min(...lab0.map(m => m.font)).toFixed(1)} px, rótulos ≥ ${Math.min(...lab0.map(m => m.h)).toFixed(1)} px)`)
      ok(lab0.every(m => m.x >= 0 && m.y >= 0 && m.x + m.w <= s.w && m.y + m.h <= s.h), 'rótulos dentro da área do globo')
      ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'página sem deslocamento horizontal')

      // Rotas e pulsos (mesmas animações do mapa plano)
      ok(s.arcs.length === 25, `rotas de rede preservadas (${s.arcs.length} arcos)`)
      ok(s.arcs.filter(d => d.length > 10).length >= 8 && s.arcs.some(d => d === ''), `rotas desenhadas como arcos só onde estão à vista (${s.arcs.filter(d => d.length > 10).length} visíveis, ${s.arcs.filter(d => d === '').length} atrás da Terra)`)
      const anim = await p.evaluate(() => ({
        dot: getComputedStyle(document.querySelector('[data-testid=gp-dot] circle.gp-dot')).animationName,
        ring: getComputedStyle(document.querySelector('[data-testid=gp-dot] circle.gp-ring')).animationName,
        flow: getComputedStyle(document.querySelector('[data-testid=gp-globe] path.gp-flow')).animationName,
        dash: document.querySelector('[data-testid=gp-globe] path.gp-flow').getAttribute('stroke-dasharray'),
        touch: getComputedStyle(document.querySelector('[data-testid=gp-globe]')).touchAction,
      }))
      ok(anim.dot === 'gp-pulse' && anim.ring === 'gp-ring' && anim.flow === 'gp-flow' && anim.dash === '5 8', `animações preservadas: pulso (${anim.dot}), anel (${anim.ring}), rota tracejada (${anim.flow}, ${anim.dash})`)
      const off1 = await p.locator('[data-testid=gp-globe] path.gp-flow').first().evaluate(e => getComputedStyle(e).strokeDashoffset)
      await p.waitForTimeout(500)
      const off2 = await p.locator('[data-testid=gp-globe] path.gp-flow').first().evaluate(e => getComputedStyle(e).strokeDashoffset)
      ok(off1 !== off2, `rotas tracejadas em movimento (strokeDashoffset ${off1} → ${off2})`)
      ok(anim.touch === 'pan-y', 'telemóvel: o globo deixa o scroll vertical livre (touch-action: pan-y)')

      await p.screenshot({ path: `${OUT}/${label}-pagina.png` }).catch(() => {})
      await sec.screenshot({ path: `${OUT}/${label}-presenca-global.png` })
      await p.getByTestId('gp-globe-stage').screenshot({ path: `${OUT}/${label}-globo-inicial.png` })
      const hash0 = (await p.getByTestId('gp-globe-stage').screenshot()).length

      // Interacções: passar na lista destaca o ponto e mostra o nome; marcador destaca a lista
      if (label === 'desktop') {
        await p.locator('[data-testid=gp-country][data-code=GB]').hover(); await p.waitForTimeout(250)
        ok(await p.locator('[data-testid=gp-globe] text', { hasText: 'Reino Unido' }).count() === 1, 'passar o rato em «Reino Unido» mostra o nome no globo')
        ok(await p.locator('[data-testid=gp-marker][data-code=GB] rect').first().getAttribute('stroke') === '#F5B700', 'e destaca o marcador GB')
        await p.getByTestId('gp-globe-stage').screenshot({ path: `${OUT}/desktop-globo-destaque.png` })
        await p.mouse.move(5, 5)
        const gb = await p.locator('[data-testid=gp-marker][data-code=GB] rect').first().boundingBox()
        for (const dx of [0, 4]) { await p.mouse.move(gb.x + gb.width / 2 + dx, gb.y + gb.height / 2, { steps: 4 }); await p.waitForTimeout(250) }
        ok(await p.locator('[data-testid=gp-country][data-code=GB]').evaluate(e => e.className.includes('bg-[#F5B700]')), 'passar no marcador GB destaca «Reino Unido» na lista')
        await p.mouse.move(5, 5)
      }

      // Rotação por arrasto: as bandeiras acompanham as coordenadas
      const box = await p.getByTestId('gp-globe').boundingBox()
      await p.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5)
      await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.35 + 140, box.y + box.height * 0.5, { steps: 8 }); await p.mouse.up()
      await p.waitForTimeout(700)
      const s2 = await globeState(p)
      ok(Math.abs(s2.dots.AO.x - ao.x) > 40, `arrastar roda o globo: Angola mexeu-se ${Math.round(s2.dots.AO.x - ao.x)} px`)
      ok(s2.dots.BR.x > br.x && s2.dots.BR.op >= 0 && (await p.getByTestId('gp-globe-hint').evaluate(e => +getComputedStyle(e).opacity)) < 0.1, 'rotação para oeste traz as Américas; a dica desaparece depois de usar')
      ok(await p.getByTestId('gp-globe').evaluate(e => e.style.cursor) !== undefined && (await p.getByTestId('gp-globe-stage').screenshot()).length !== hash0, 'a imagem do globo mudou com a rotação')
      // Teclado e botões (um ponto visível antes e depois)
      const vis2 = Object.entries(s2.dots).find(([, d]) => d.op > 0.95 && Math.abs(d.x - s2.w / 2) < s2.w * 0.2)[0]
      await p.getByTestId('gp-globe').focus(); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(500)
      const s3 = await globeState(p)
      ok(s3.dots[vis2].x - s2.dots[vis2].x > 15, `seta para a esquerda roda o globo (${vis2}: ${Math.round(s2.dots[vis2].x)} → ${Math.round(s3.dots[vis2].x)} px)`)
      await p.getByTestId('gp-globe-reset').click(); await p.waitForTimeout(1400)
      const s4 = await globeState(p)
      ok(Math.abs(s4.dots.AO.x - ao.x) < 6 && Math.abs(s4.dots.AO.y - ao.y) < 6, 'botão «repor» devolve a vista inicial (África e Atlântico)')

      // Todos os países consultáveis: clicar na lista roda o globo até ao país, que fica visível e legível
      const failedViews = [], overlapViews = []
      for (const code of Object.values(EXPECTED)) {
        await p.locator(`[data-testid=gp-country][data-code=${code}]`).click()
        await p.waitForTimeout(1250)
        // Os rótulos deslizam até à posição final (renderização por software: poucas imagens/s): esperar que assente
        let sv = await globeState(p)
        for (let t = 0; t < 20 && overlaps(shown(sv)).length; t++) { await p.waitForTimeout(250); sv = await globeState(p) }
        const d = sv.dots[code], lb = sv.labels.find(l => l.code === code)
        if (!(d.op > 0.9 && Math.hypot(d.x - sv.w / 2, d.y - sv.h / 2) < 40 && lb.op > 0.9)) failedViews.push(`${code}(${d.op.toFixed(1)}@${d.x.toFixed(0)},${d.y.toFixed(0)})`)
        const ovv = overlaps(shown(sv)); if (ovv.length) overlapViews.push(`${code}:${ovv.join('/')}`)
        if (code === 'SG' || code === 'AO' && label === 'desktop') await p.getByTestId('gp-globe-stage').screenshot({ path: `${OUT}/${label}-globo-${code.toLowerCase()}.png` })
        if (code === 'SG') {
          ok(sv.dots.AO.op < 0.05 && sv.dots.BR.op < 0.05, 'ao rodar para a Ásia, Angola e o Brasil ficam atrás da Terra (ocultos)')
          ok(shown(sv).length >= 6, `Sudeste Asiático: ${shown(sv).map(l => l.code).join(' ')} visíveis e sem sobreposição`)
        }
      }
      ok(failedViews.length === 0, `os 23 países ficam centrados, com ponto e rótulo visíveis, ao clicar na lista${failedViews.length ? ' — ' + failedViews.join(' ') : ''}`)
      ok(overlapViews.length === 0, `rótulos sem sobreposição em todas as 23 vistas${overlapViews.length ? ' — ' + overlapViews.join(' ') : ''}`)
      ok(p.errors.length === 0, 'sem erros de JavaScript', p.errors.join(' | '))
      await ctx.close()
    }

    // Ecrã de alta densidade: textura 4K
    console.log('\nDensidade 2×: textura 4K')
    {
      const ctx = await b.newContext({ ...DESKTOP, deviceScaleFactor: 2 }); const p = await ctx.newPage(); const tex = []
      p.on('request', r => { if (/\/textures\//.test(r.url())) tex.push(r.url()) })
      await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.locator('#global-presence').scrollIntoViewIfNeeded(); await waitGlobe(p)
      ok(tex.length === 1 && /4k/.test(tex[0]), `textura 4K em ecrã 2× (${tex.map(u => u.split('/').pop()).join(', ')})`)
      await ctx.close()
    }

    // Movimento reduzido: sem pulsos nem rotas animadas; a rotação para um país é imediata
    console.log('\nprefers-reduced-motion')
    {
      const { ctx, p } = await open(b, { ...DESKTOP, reducedMotion: 'reduce' })
      await waitGlobe(p)
      const an = await p.evaluate(() => ['circle.gp-dot', 'circle.gp-ring'].map(q => getComputedStyle(document.querySelector('[data-testid=gp-dot] ' + q)).animationName).concat(getComputedStyle(document.querySelector('[data-testid=gp-globe] path.gp-flow')).animationName))
      ok(an.every(x => x === 'none'), `animações desligadas (${an.join(', ')})`)
      await p.locator('[data-testid=gp-country][data-code=SG]').click(); await p.waitForTimeout(250)
      const sv = await globeState(p)
      ok(sv.dots.SG.op > 0.9 && Math.hypot(sv.dots.SG.x - sv.w / 2, sv.dots.SG.y - sv.h / 2) < 40, 'rotação até Singapura imediata (sem animação)')
      await ctx.close()
    }

    // Alternativas: sem WebGL e textura em falta → mapa plano atual, com tudo o que já existia
    for (const [why, extra] of [['sem WebGL', { noWebgl: true }], ['textura em falta', { blockTexture: true }]]) {
      for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
        console.log(`\nAlternativa (${why}, ${label}): mapa plano`)
        const { ctx, p, sec } = await open(b, opts, extra)
        await waitFlat(p)
        ok(await p.getByTestId('gp-globe').count() === 0, 'sem globo: mapa plano usado')
        const marks = await p.locator('[data-testid=gp-marker]').evaluateAll(els => els.map(g => { const r = g.querySelector('rect').getBoundingClientRect(), t = g.querySelector('[data-testid=gp-marker-code]'), img = g.querySelector('image'); return { code: g.dataset.code, text: t.textContent, font: t.getBoundingClientRect().height, href: img?.getAttribute('href'), x: r.x, y: r.y, w: r.width, h: r.height } }))
        ok(marks.length === 23 && marks.every(m => m.text === m.code && m.href === `/flags/${m.code.toLowerCase()}.png`), 'mapa: 23 marcadores com código e bandeira')
        ok(overlaps(marks).length === 0 && Math.min(...marks.map(m => m.font)) >= 9.5, 'mapa: marcadores legíveis e sem sobreposição')
        ok(await p.locator('[data-testid=gp-map] path.gp-flow').count() === 25, 'mapa: 25 rotas tracejadas')
        ok(await p.getByText('Ponto de presença').isVisible() && await p.getByText('Rota de rede ativa').isVisible(), 'legenda mantida')
        if (label === 'iphone') {
          const sc = p.getByTestId('gp-map-scroll'); const sm = await sc.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, sl: e.scrollLeft }))
          ok(sm.sw > sm.cw && sm.sl > 0 && await p.getByTestId('gp-map-hint').isVisible(), 'telemóvel: mapa desloca-se dentro do cartão (centrado no Atlântico), com indicação')
        }
        if (label === 'desktop') {
          await p.locator('[data-testid=gp-country][data-code=GB]').hover(); await p.waitForTimeout(250)
          ok(await p.locator('[data-testid=gp-map] text', { hasText: 'Reino Unido' }).count() === 1, 'mapa: passar o rato em «Reino Unido» mostra o nome')
          await sec.screenshot({ path: `${OUT}/alternativa-${why === 'sem WebGL' ? 'sem-webgl' : 'sem-textura'}-desktop.png` })
        } else if (why === 'sem WebGL') await p.getByTestId('gp-map-scroll').screenshot({ path: `${OUT}/alternativa-sem-webgl-iphone.png` })
        ok(p.errors.length === 0, 'sem erros de JavaScript', p.errors.join(' | '))
        await ctx.close()
      }
    }

    // Bandeiras indisponíveis: nome e código continuam legíveis, sem imagem partida (globo)
    console.log('\nBandeiras indisponíveis (globo)')
    {
      const { ctx, p } = await open(b, DESKTOP, { blockFlags: true })
      await waitGlobe(p); await p.waitForTimeout(600)
      ok(await p.locator('[data-testid=gp-country-flag]').count() === 0 && await p.locator('[data-testid=gp-marker-flag]').count() === 0, 'imagens que falham são retiradas (sem ícone partido)')
      const names = await p.locator('[data-testid=gp-country]').allInnerTexts()
      ok(names.length === 23 && names.every(n => Object.keys(EXPECTED).includes(n.trim())), 'lista mantém todos os nomes')
      const sv = await globeState(p)
      ok(sv.labels.length === 23 && overlaps(shown(sv)).length === 0, 'rótulos só com código, sem sobreposição')
      await p.getByTestId('gp-globe-stage').screenshot({ path: `${OUT}/desktop-globo-sem-bandeiras.png` })
      await ctx.close()
    }
  } catch (e) { ok(false, 'execução', e.stack) }
  await b.close()
  console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
  process.exit(fail ? 1 : 0)
})()
