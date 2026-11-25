// E-mail corporativo (hero do painel, atalhos, #seguranca, H1 único), cartões de imagem dos submenus (Hospedagem e
// site, Serviços, Empresa) e WhatsApp + chat em todas as páginas públicas (uma instância, posições, abrir/fechar,
// sem taparem controlos no telemóvel). Desktop + iPhone. Repõe os banners no fim. Sem compras.
//   BASE_URL=http://localhost:3000 OUT=/tmp/site-chrome node --env-file=.env.local scripts/mariadb/rehearsal/site-chrome-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const zlib = require('node:zlib')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-site-chrome'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 400) : ''}`) }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const RND = Math.random().toString(36).slice(2, 8)
const WA = 'https://wa.me/244951008653'
const PUBLIC_PAGES = ['/', '/hospedagem-de-sites', '/dominios', '/email-corporativo', '/servidor-vps', '/sobre', '/carrinho']
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = 30; raw[i + 1] = Math.round(150 * x / w); raw[i + 2] = 245 }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
async function login(email, password) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  return r.headers.getSetCookie().map(c => c.split(';')[0]).find(c => c.startsWith('vh_session='))
}
async function ctxFor(b, opts, cookie) {
  const ctx = await b.newContext({ ...opts })
  if (cookie) await ctx.addCookies([{ name: 'vh_session', value: cookie.split('=')[1], url: BASE }])
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', e => p.errors.push(e.message))
  p.answers = []; p.on('dialog', d => d.accept())
  return { ctx, p }
}
// Controlos tapados por um botão flutuante visível (mesma regra do componente: pontos do botão sobre um controlo)
const coveredControls = p => p.evaluate(() => {
  const CONTROL = 'a,button,input,select,textarea,summary,label,[role=button],[role=radio],[role=tab]'
  const out = []
  for (const f of document.querySelectorAll('[data-testid=floating-whatsapp], [data-testid=chat-toggle]')) {
    const st = getComputedStyle(f.closest('[data-testid=chat-fab]') ?? f)
    if (st.pointerEvents === 'none' || Number(st.opacity) === 0) continue
    const r = f.getBoundingClientRect()
    for (const [x, y] of [[r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]]) {
      const hit = document.elementsFromPoint(x, y).find(n => !n.closest('[data-floating]') && n.closest(CONTROL))
      if (hit) { out.push(`${f.dataset.testid} sobre «${(hit.closest(CONTROL).textContent || hit.closest(CONTROL).getAttribute('aria-label') || '').trim().slice(0, 40)}»`); break }
    }
  }
  return out
})

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const SLUGS = ['email-corporativo', 'hospedagem-de-sites', 'dominios']
  const snap = await all(`SELECT * FROM banner_pages WHERE page_slug IN (${SLUGS.map(() => '?').join(',')})`, SLUGS)
  const em0 = snap.find(r => r.page_slug === 'email-corporativo')
  const admin = await login('admin@ensaio.test', 'Admin#Teste2026')
  const client = await login('cliente1@ensaio.test', 'Cliente#Um2026')
  const b = await chromium.launch()
  let ctx, p
  try {
    // ── 1. Painel → Banners de páginas → E-mail corporativo ──
    console.log('\n1. Hero de E-mail corporativo editada no painel')
    ok(!!em0, `entrada «email-corporativo» existente reutilizada («${em0?.title}»)`)
    ;({ ctx, p } = await ctxFor(b, DESKTOP, admin))
    await p.goto(BASE + '/admin/site/banner-pages', { waitUntil: 'domcontentloaded' })
    const row = p.locator('[data-testid=banner-row][data-slug="email-corporativo"]'); await row.waitFor()
    await row.getByTestId('banner-edit').click()
    const SUB = `Descrição de ensaio ${RND}: e-mail profissional com o domínio da sua empresa.`
    await p.getByTestId('banner-subtitle').fill(SUB)
    const urlInput = p.locator('input[placeholder="Ou cole o URL da imagem"]')
    const before = await urlInput.inputValue()
    await p.getByTestId('banner-image-file').setInputFiles({ name: `hero-email-${RND}.png`, mimeType: 'image/png', buffer: png(960, 400) })
    await p.waitForFunction(prev => { const i = document.querySelector('input[placeholder="Ou cole o URL da imagem"]'); return i && i.value && i.value !== prev }, before, { timeout: 20000 })
    const newImg = await urlInput.inputValue()
    await p.getByTestId('banner-save').click(); await p.waitForTimeout(1500)
    await ctx.close()
    const pathOf = u => u.replace(/^https?:\/\/[^/]+/, '')
    const [em1] = await all("SELECT subtitle, bg_image, title FROM banner_pages WHERE page_slug = 'email-corporativo'")
    ok(em1.subtitle === SUB && em1.bg_image === newImg && em1.title === em0.title, 'descrição e imagem novas guardadas; título preservado')
    const html = await (await fetch(BASE + '/email-corporativo')).text()
    ok(html.includes(SUB) && html.includes(pathOf(newImg)), '/email-corporativo: hero com a nova descrição e a nova imagem')
    const others = await all(`SELECT page_slug, subtitle, bg_image, updated_at FROM banner_pages WHERE page_slug IN ('hospedagem-de-sites', 'dominios')`)
    const othersOk = others.every(r => { const s = snap.find(x => x.page_slug === r.page_slug); return s.subtitle === r.subtitle && s.bg_image === r.bg_image && s.updated_at === r.updated_at })
    const hostHtml = await (await fetch(BASE + '/hospedagem-de-sites')).text(), domHtml = await (await fetch(BASE + '/dominios')).text()
    ok(othersOk && !hostHtml.includes(SUB) && !domHtml.includes(SUB) && !hostHtml.includes(pathOf(newImg)) && !domHtml.includes(pathOf(newImg)), 'hospedagem e domínios: configurações independentes, inalteradas')

    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      console.log(`\n2. /email-corporativo (${label})`)
      ;({ ctx, p } = await ctxFor(b, opts))
      await p.goto(BASE + '/email-corporativo', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('email-plan-card').first().waitFor({ timeout: 15000 })
      const hero = p.getByTestId('email-hero')
      ok(await hero.getAttribute('data-banner-slug') === 'email-corporativo' && await hero.getAttribute('data-banner-source') === 'admin', 'hero partilhada (BannerHero) ligada à entrada «email-corporativo»')
      const h1 = await p.locator('h1').allInnerTexts()
      ok(h1.length === 1 && h1[0].trim() === em0.title.trim() && await hero.locator('h1').count() === 1, `um único H1, na hero: «${h1.join(' | ')}»`)
      const img = await hero.evaluate(el => { const d = [...el.querySelectorAll('div')].find(x => (x.style.backgroundImage || '').includes('url(')); if (!d) return null; const r = d.getBoundingClientRect(); return { bg: d.style.backgroundImage, left: r.left, vw: innerWidth, op: getComputedStyle(d).opacity } })
      ok(img && img.bg.includes(pathOf(newImg)), 'hero: imagem nova aplicada')
      ok(label === 'desktop' ? img.left > img.vw * 0.3 && Number(img.op) === 1 : img.left <= 1 && Number(img.op) < 1, label === 'desktop' ? 'desktop: imagem à direita' : 'telemóvel: imagem por trás do texto, atenuada (como na hospedagem)')
      const nav = p.getByTestId('email-actions')
      const links = await nav.locator('a').evaluateAll(as => as.map(a => `${a.textContent.trim()}|${a.getAttribute('href')}`))
      ok(JSON.stringify(links) === JSON.stringify(['Planos e preços|#planos', 'Microsoft 365|#planos-detalhe', 'Segurança|#seguranca', 'Produtividade|#produtividade']), `atalhos mantidos: ${links.map(l => l.split('|')[0]).join(' · ')}`)
      const order = await p.evaluate(() => { const h = document.querySelector('[data-testid=email-hero]'); return h.nextElementSibling?.getAttribute('data-testid') })
      ok(order === 'email-actions', 'atalhos logo abaixo da hero')
      await nav.getByText('Segurança').click(); await p.waitForTimeout(900)
      const inView = id => p.evaluate(i => { const r = document.getElementById(i).getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight / 2 }, id)
      ok(/#seguranca$/.test(p.url()) && await inView('seguranca'), 'atalho «Segurança» → secção #seguranca')
      ok(await overflow(p) <= 1, 'sem deslocamento horizontal', await overflow(p))
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300)
      await hero.screenshot({ path: `${OUT}/${label}-01-email-hero.png` })
      await p.screenshot({ path: `${OUT}/${label}-02-email-pagina.png`, fullPage: true })
      ok(!p.errors.length, 'sem erros na página', p.errors.join(' | '))
      // Link directo /email-corporativo#seguranca (os planos carregam depois: a âncora continua certa)
      await p.goto(BASE + '/email-corporativo#seguranca', { waitUntil: 'domcontentloaded' })
      await p.getByTestId('email-plan-card').first().waitFor({ timeout: 15000 }); await p.waitForTimeout(2000)
      ok(await inView('seguranca'), '/email-corporativo#seguranca abre na secção «Segurança» (depois de os planos carregarem)')
      await ctx.close()
    }

    // ── 3. Submenus: um único modelo de cartão ──
    console.log('\n3. Submenus (desktop)')
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(BASE + '/sobre', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
    for (const g of ['hospedagem', 'servicos', 'empresa']) {
      await p.keyboard.press('Escape'); await p.waitForTimeout(150)
      await p.getByTestId(`nav-${g}`).click(); await p.waitForTimeout(500)
      const panel = p.getByTestId('nav-panel')
      const card = panel.getByTestId('nav-aside')
      await card.getByTestId('nav-aside-image').evaluate(i => i.complete || new Promise(r => { i.onload = r; i.onerror = r }))
      const info = await card.evaluate(a => ({ kind: a.dataset.kind, href: a.getAttribute('href'), name: a.textContent.trim(), img: a.querySelector('img')?.getAttribute('src') ?? '', loaded: (a.querySelector('img')?.naturalWidth ?? 0) > 0, links: a.querySelectorAll('a').length }))
      ok(info.kind === g && decodeURIComponent(info.img).includes(`/nav/${g}.webp`) && info.loaded, `${g}: imagem própria (${decodeURIComponent(info.img).match(/\/nav\/[a-z]+\.webp/)?.[0]}) carregada`)
      ok(info.href === '/suporte/contactar' && info.name === 'Fale com um especialista', `${g}: cartão = imagem + link «Fale com um especialista» → ${info.href}`)
      const text = await panel.innerText()
      ok((text.match(/Fale com um especialista/g) ?? []).length === 1 && !/Precisa de ajuda|Classe Mundial|Ver Infraestrutura|Falar com Suporte/.test(text), `${g}: sem «Precisa de ajuda?», títulos, descrições ou botões extra; sem repetição`)
      const [cb, lastCol] = [await card.boundingBox(), await panel.getByTestId('nav-column').last().boundingBox()]
      ok(cb.x > lastCol.x + lastCol.width - 1 && Math.abs(cb.width - 236) <= 30, `${g}: coluna direita (x=${Math.round(cb.x)}, ${Math.round(cb.width)} px)`)
      await p.screenshot({ path: `${OUT}/desktop-03-submenu-${g}.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } })
    }
    await p.keyboard.press('Escape')
    await p.getByTestId('nav-empresa').click(); await p.waitForTimeout(400)
    await p.getByTestId('nav-panel').getByTestId('nav-aside').click(); await p.waitForURL('**/suporte/contactar')
    ok(true, 'clicar no cartão abre o contacto')
    await ctx.close()

    console.log('\n4. Submenus (telemóvel)')
    ;({ ctx, p } = await ctxFor(b, IPHONE))
    await p.goto(BASE + '/sobre', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
    await p.getByTestId('mobile-menu-toggle').click()
    for (const g of ['hospedagem', 'servicos', 'empresa']) {
      await p.getByTestId(`mnav-${g}`).click(); await p.waitForTimeout(300)
      const panel = p.getByTestId('mnav-panel'), card = panel.getByTestId('mnav-aside')
      await card.scrollIntoViewIfNeeded()
      await card.getByTestId('mnav-aside-image').evaluate(i => i.complete || new Promise(r => { i.onload = r; i.onerror = r }))
      const info = await card.evaluate(a => ({ kind: a.dataset.kind, href: a.getAttribute('href'), name: a.textContent.trim(), img: a.querySelector('img')?.getAttribute('src') ?? '', loaded: (a.querySelector('img')?.naturalWidth ?? 0) > 0 }))
      const [cb, last] = [await card.boundingBox(), await panel.getByTestId('mnav-item').last().boundingBox()]
      ok(info.kind === g && decodeURIComponent(info.img).includes(`/nav/${g}.webp`) && info.loaded && info.name === 'Fale com um especialista' && info.href === '/suporte/contactar', `${g}: o mesmo cartão (imagem + link)`)
      ok(cb.y > last.y && cb.x >= 0 && cb.x + cb.width <= 390.5, `${g}: abaixo dos links, dentro do ecrã`)
      if (g === 'empresa') await p.screenshot({ path: `${OUT}/iphone-03-submenu-empresa.png` })
    }
    ok(await overflow(p) <= 0, 'menu sem deslocamento horizontal')
    await ctx.close()

    // ── 5. WhatsApp e chat ──
    for (const [label, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      console.log(`\n5. WhatsApp e chat (${label})`)
      ;({ ctx, p } = await ctxFor(b, opts))
      for (const path of PUBLIC_PAGES) {
        await p.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await p.getByTestId('floating-whatsapp').waitFor({ timeout: 10000 })
        const st = await p.evaluate(() => {
          const wa = document.querySelectorAll('[data-testid=floating-whatsapp]'), ch = document.querySelectorAll('[data-testid=floating-chat]')
          const w = wa[0]?.getBoundingClientRect(), c = document.querySelector('[data-testid=chat-toggle]')?.getBoundingClientRect()
          return { wa: wa.length, chat: ch.length, href: wa[0]?.getAttribute('href'), waPos: w && w.left < 40 && innerHeight - w.bottom < 40, chatPos: c && innerWidth - c.right < 40 && innerHeight - c.bottom < 40, fixed: getComputedStyle(wa[0]).position === 'fixed' }
        })
        ok(st.wa === 1 && st.chat === 1 && st.href === WA && st.waPos && st.chatPos && st.fixed, `${path}: um WhatsApp (inferior esquerdo, ${WA.replace('https://', '')}) e um chat (inferior direito)`, JSON.stringify(st))
      }
      // Abrir e fechar o chat (página inicial e página interna)
      for (const path of ['/', '/dominios']) {
        await p.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await p.getByTestId('chat-toggle').waitFor()
        // Abre a partir de uma posição em que o botão está visível (afasta-se quando há um controlo por baixo)
        let y = 0
        for (; y < 6000; y += 250) { await p.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), y); await p.waitForTimeout(250); if (await p.getByTestId('chat-fab').getAttribute('data-covering') === '0') break }
        if (path === '/') ok(true, `página inicial: chat visível a partir de ${y}px (no topo afasta-se da seta do carrossel da hero)`)
        await p.getByTestId('chat-toggle').click()
        await p.getByTestId('chat-panel').waitFor({ timeout: 5000 })
        const pb = await p.getByTestId('chat-panel').boundingBox()
        ok(pb.x >= 0 && pb.x + pb.width <= (opts.viewport?.width ?? 390) + 0.5, `${path}: chat abre dentro do ecrã (${Math.round(pb.width)} px)`)
        if (path === '/dominios') await p.screenshot({ path: `${OUT}/${label}-05-chat-aberto.png` })
        await p.getByTestId('chat-toggle').click()
        await p.waitForTimeout(300)
        ok(await p.getByTestId('chat-panel').count() === 0, `${path}: chat fecha`)
      }
      // Nunca por cima de controlos: percorre páginas e verifica a cada posição
      if (label === 'iphone') {
        for (const path of ['/email-corporativo', '/hospedagem-de-sites', '/dominios', '/carrinho']) {
          await p.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000)
          const H = await p.evaluate(() => document.documentElement.scrollHeight), step = 300
          const conflicts = []
          for (let y = 0; y <= H; y += step) {
            await p.evaluate(v => scrollTo({ top: v, behavior: 'instant' }), y); await p.waitForTimeout(200)
            for (const c of await coveredControls(p)) conflicts.push(`${y}px: ${c}`)
          }
          await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })); await p.waitForTimeout(250)
          for (const c of await coveredControls(p)) conflicts.push(`fim: ${c}`)
          ok(!conflicts.length, `${path}: WhatsApp e chat nunca tapam botões, links ou campos (${Math.ceil(H / step)} posições)`, conflicts.slice(0, 5).join(' | '))
        }
        // Compra: o botão «Adicionar ao carrinho» continua clicável
        await p.goto(BASE + '/dominios', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(500)
        await p.goto(BASE + '/comprar/hosting-start', { waitUntil: 'domcontentloaded' })
        await p.getByRole('radio', { name: /Usar um domínio que já tenho/ }).click()
        await p.getByPlaceholder('empresa.ao').fill('ensaio-flutuante.ao')
        const cont = p.getByTestId('continue-own-domain')
        await cont.scrollIntoViewIfNeeded(); await p.waitForTimeout(400)
        const free = await cont.evaluate(el => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el.contains(t) })
        ok(free, 'percurso de compra: botão «Continuar» não está tapado')
        await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200)
        await p.goto(BASE + '/email-corporativo', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
        await p.screenshot({ path: `${OUT}/iphone-04-flutuantes-email.png` })
      }
      ok(!p.errors.length, 'sem erros', p.errors.join(' | '))
      await ctx.close()
    }

    // ── 6. Área do Cliente e painel: sem duplicação ──
    console.log('\n6. Área do Cliente e painel')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, client))
    await p.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    ok(await p.getByTestId('floating-whatsapp').count() === 1 && await p.getByTestId('floating-chat').count() === 1, 'Área do Cliente: um só WhatsApp e um só chat (o da Área do Cliente)')
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, DESKTOP, admin))
    await p.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    ok(await p.getByTestId('floating-whatsapp').count() === 0, 'painel de administração: sem WhatsApp/chat públicos')
    await ctx.close()
  } catch (e) { ok(false, 'execução', e.stack) }
  finally {
    for (const r of snap) {
      const cols = ['title', 'subtitle', 'bg_image', 'tag', 'breadcrumb', 'updated_at']
      await db.query(`UPDATE banner_pages SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => r[c]), r.id]).catch(e => ok(false, 'reposição', e.message))
    }
    const back = await all(`SELECT page_slug, subtitle, bg_image FROM banner_pages WHERE page_slug IN (${SLUGS.map(() => '?').join(',')})`, SLUGS)
    ok(back.every(r => { const s = snap.find(x => x.page_slug === r.page_slug); return s.subtitle === r.subtitle && s.bg_image === r.bg_image }), 'banners repostos como estavam')
    await b.close(); await db.end()
    console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
    process.exit(fail ? 1 : 0)
  }
})()
