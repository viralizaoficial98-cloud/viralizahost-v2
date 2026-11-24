// Menu principal reorganizado (desktop + telemóvel, a mesma configuração): exactamente 5 grupos por ordem; Domínios e
// E-mail corporativo como links directos; Infraestrutura só com 3 itens; Serviços a partir do registo de páginas
// publicadas; Empresa (Sobre nós, Suporte, Parceria, Blog). Páginas consolidadas, destinos dos links antigos,
// encaminhamento de /hospedagem-wordpress e sitemap.
//   BASE_URL=http://localhost:3000 OUT=/tmp/menu node scripts/mariadb/rehearsal/menu-e2e.cjs
const { chromium, devices } = require('playwright')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-menu'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const GROUPS = ['Hospedagem e site', 'Domínios', 'E-mail corporativo', 'Serviços', 'Empresa']
const status = async (path, redirect = 'manual') => { const r = await fetch(BASE + path, { redirect }); return { status: r.status, location: r.headers.get('location') } }

// Links do antigo menu: continuam a responder (função própria) ou encaminham para a secção equivalente
const OLD_LINKS = [
  '/hospedagem-de-sites', '/revenda-de-hospedagem', '/criador-de-sites', '/construtor-wordpress', '/servidor-vps', '/servidor-vps/n8n', '/servidor-vps/openclaw',
  '/servidor-vps/evolution-api', '/servidor-vps/viraliza-ai-cloud', '/servidor-dedicado', '/servidor-dedicado-windows', '/dominios/pesquisar', '/dominios/registrar-ao',
  '/dominios/registrar-com', '/dominios/registrar-com-br', '/dominios/transferir', '/dominios/renovar', '/dominios/dns-premium', '/dominios/whois', '/dominios/ssl',
  '/dominios/redirecionamento', '/dominios/subdominios', '/dominios/nameservers', '/dominios/precos', '/dominios/base-conhecimento', '/suporte/tickets', '/suporte/faq',
  '/email-corporativo#planos', '/comprar/email-starter', '/comprar/email-standard', '/comprar/email-premium', '/email/microsoft-365-outlook', '/email/antispam',
  '/email/spf-dkim-dmarc', '/email/backup', '/email/malware', '/email/alta-disponibilidade', '/email/webmail', '/email/outlook-365', '/email/mobile',
  '/email/calendario-contactos', '/email/migracao', '/certificado-ssl', '/backup-cloud', '/protecao-de-site', '/migracao-gratis', '/cdn-premium', '/base-conhecimento',
  '/blog', '/ferramentas', '/parcerias', '/suporte/status', '/suporte', '/servicos',
]

;(async () => {
  const b = await chromium.launch()
  try {
    // ── 1. Desktop ──
    console.log('\n1. Desktop')
    let ctx = await b.newContext(DESKTOP), p = await ctx.newPage()
    const errs = []; p.on('pageerror', e => errs.push(e.message))
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    const nav = p.getByTestId('main-nav'); await nav.waitFor()
    const labels = await nav.locator(':scope > a, :scope > div > button').allInnerTexts()
    ok(JSON.stringify(labels.map(s => s.trim())) === JSON.stringify(GROUPS), `cinco grupos por ordem: ${labels.map(s => s.trim()).join(' · ')}`)
    for (const [id, href] of [['dominios', '/dominios'], ['email', '/email-corporativo']]) {
      const a = p.getByTestId(`nav-${id}`)
      ok(await a.evaluate(e => e.tagName) === 'A' && await a.getAttribute('href') === href && await a.getAttribute('aria-expanded') === null, `${href}: link directo, sem submenu`)
    }
    const panelItems = async id => {
      await p.getByTestId(`nav-${id}`).click(); await p.waitForTimeout(300)
      const cols = await p.getByTestId('nav-panel').getByTestId('nav-column').evaluateAll(cs => cs.map(c => ({ title: c.querySelector('p').textContent.trim(), items: [...c.querySelectorAll('[data-testid=nav-item]')].map(a => ({ href: a.getAttribute('href'), label: a.querySelector('span span span').textContent.trim() })) })))
      return cols
    }
    let cols = await panelItems('hospedagem')
    const infra = cols.find(c => /Infraestrutura/i.test(c.title))
    ok(infra && JSON.stringify(infra.items.map(i => i.label)) === JSON.stringify(['Servidor VPS', 'Servidor Dedicado Linux', 'Servidor Dedicado Windows']), `Infraestrutura: ${infra?.items.map(i => i.label).join(', ')}`)
    ok(!cols.some(c => c.items.some(i => /WordPress/.test(i.label) && /hospedagem/i.test(i.label)) || c.items.some(i => i.href === '/hospedagem-wordpress')), 'sem «Hospedagem WordPress» no submenu')
    await p.screenshot({ path: `${OUT}/desktop-01-hospedagem.png` })
    await p.keyboard.press('Escape'); await p.waitForTimeout(200)
    ok((await p.getByTestId('nav-panel').getAttribute('data-group')) === '', 'Escape fecha o painel')
    cols = await panelItems('servicos')
    const svc = cols.flatMap(c => c.items)
    ok(cols.length === 5 && JSON.stringify(cols.map(c => c.title)) === JSON.stringify(['Hospedagem e sites', 'Servidores', 'Domínios', 'E-mail corporativo', 'Segurança e desempenho']), `Serviços por categoria: ${cols.map(c => `${c.title} (${c.items.length})`).join(', ')}`)
    ok(!svc.some(i => /^\/(admin|dashboard|checkout|carrinho|login|register|orders|billing)/.test(i.href)), 'Serviços sem páginas administrativas, privadas ou de checkout')
    const sm = await (await fetch(BASE + '/sitemap.xml')).text()
    ok(svc.every(i => sm.includes(`https://viralizahost.com${i.href}<`)), `todas as ${svc.length} páginas de Serviços estão publicadas (sitemap)`)
    const svcStatus = await Promise.all(svc.map(i => status(i.href)))
    ok(svcStatus.every(s => s.status === 200), `todas respondem 200 (${svc.length})`, svc.filter((_, k) => svcStatus[k].status !== 200).map(i => i.href).join(', '))
    await p.screenshot({ path: `${OUT}/desktop-02-servicos.png` })
    await p.keyboard.press('Escape')
    cols = await panelItems('empresa')
    ok(JSON.stringify(cols.flatMap(c => c.items.map(i => `${i.label}|${i.href}`))) === JSON.stringify(['Sobre nós|/sobre', 'Suporte|/suporte', 'Parceria|/parcerias', 'Blog|/blog']), `Empresa: ${cols.flatMap(c => c.items.map(i => i.label)).join(', ')}`)
    await p.screenshot({ path: `${OUT}/desktop-03-empresa.png` })
    await p.getByTestId('nav-panel').getByText('Sobre nós').click(); await p.waitForURL('**/sobre')
    ok(await p.getByTestId('page-sobre').isVisible() && /suporte@viralizahost\.com/.test(await p.getByTestId('sobre-contactos').innerText()) && /\+244 951 008 653/.test(await p.getByTestId('sobre-contactos').innerText()), '«Sobre nós»: página nova com os contactos reais')
    ok(errs.length === 0, 'sem erros JS', errs.join(' | '))
    await ctx.close()

    // ── 2. Telemóvel: a mesma configuração ──
    console.log('\n2. Telemóvel')
    ctx = await b.newContext(IPHONE); p = await ctx.newPage()
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    await p.getByTestId('mobile-menu-toggle').click()
    const mnav = p.getByTestId('mobile-nav'); await mnav.waitFor()
    const mlabels = await mnav.locator(':scope > a, :scope > div > button').allInnerTexts()
    ok(JSON.stringify(mlabels.map(s => s.trim())) === JSON.stringify(GROUPS), `os mesmos cinco grupos: ${mlabels.map(s => s.trim()).join(' · ')}`)
    ok(await p.getByTestId('mnav-dominios').getAttribute('href') === '/dominios' && await p.getByTestId('mnav-email').getAttribute('href') === '/email-corporativo', 'Domínios e E-mail corporativo: links directos')
    await p.waitForTimeout(400)
    ok(await p.evaluate(() => [...document.querySelectorAll('[data-floating]')].every(e => getComputedStyle(e).visibility === 'hidden')), 'botões flutuantes (chat/WhatsApp) escondidos enquanto o menu está aberto')
    await p.getByTestId('mnav-servicos').click()
    const cats = p.getByTestId('mnav-category')
    ok(await cats.count() === 5 && await p.getByTestId('mnav-item').count() === 0, 'Serviços: 5 categorias recolhidas (lista longa utilizável)')
    await cats.nth(1).click()
    ok(await p.getByTestId('mnav-item').count() === 7, 'categoria «Servidores» aberta (7 páginas)')
    ok(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) <= 0, 'sem deslocamento horizontal')
    await p.screenshot({ path: `${OUT}/iphone-01-servicos.png` })
    await p.getByTestId('mnav-empresa').click()
    ok(JSON.stringify(await p.getByTestId('mnav-panel').getByTestId('mnav-item').allInnerTexts()) === JSON.stringify(['Sobre nós', 'Suporte', 'Parceria', 'Blog']), 'Empresa no telemóvel: Sobre nós, Suporte, Parceria, Blog')
    await p.screenshot({ path: `${OUT}/iphone-02-empresa.png` })
    await p.getByTestId('mnav-panel').getByText('Blog').click(); await p.waitForURL('**/blog')
    ok(await p.getByTestId('blog-empty').isVisible() && /Ainda não há artigos publicados/.test(await p.getByTestId('blog-empty').innerText()), 'Blog sem artigos: estado vazio claro')
    await ctx.close()

    // ── 3. Páginas consolidadas ──
    console.log('\n3. Páginas consolidadas')
    ctx = await b.newContext(DESKTOP); p = await ctx.newPage()
    await p.goto(BASE + '/dominios', { waitUntil: 'domcontentloaded' })
    ok(await p.locator('input').first().isVisible(), 'Domínios: pesquisa mantida')
    for (const [sec, expect] of [['registo', ['/dominios/pesquisar', '/dominios/transferir', '/dominios/renovar', '/dominios/registrar-ao']], ['gestao', ['/dominios/dns-premium', '/dominios/whois', '/dominios/nameservers']], ['recursos', ['/dominios/precos', '/suporte/faq']]]) {
      const hrefs = await p.getByTestId(`section-${sec}`).getByTestId('link-card').evaluateAll(as => as.map(a => a.getAttribute('href')))
      ok(expect.every(h => hrefs.includes(h)), `Domínios #${sec}: ${hrefs.length} ligações aos fluxos (${expect.join(', ')})`)
    }
    await p.getByTestId('domain-actions').getByText('Transferir').click(); await p.waitForURL('**/dominios/transferir')
    ok(true, 'acção «Transferir» abre o fluxo de transferência')
    await p.goto(BASE + '/email-corporativo', { waitUntil: 'domcontentloaded' })
    await p.locator('[data-testid=email-plan-card]').first().waitFor()
    ok(await p.locator('[data-testid=email-plan-card]').count() >= 1 && await p.locator('[data-testid^=email-period-]').count() >= 2, 'E-mail: planos e períodos mantidos')
    for (const sec of ['planos-detalhe', 'seguranca', 'produtividade']) ok(await p.getByTestId(`section-${sec}`).getByTestId('link-card').count() >= 4, `E-mail #${sec}: opções do antigo submenu`)
    await p.goto(BASE + '/servidor-vps#aplicacoes', { waitUntil: 'domcontentloaded' })
    const apps = await p.getByTestId('section-aplicacoes').getByTestId('link-card').evaluateAll(as => as.map(a => a.getAttribute('href')))
    ok(['/servidor-vps/n8n', '/servidor-vps/openclaw', '/servidor-vps/evolution-api', '/servidor-vps/viraliza-ai-cloud'].every(h => apps.includes(h)), 'VPS #aplicacoes: n8n, OpenClaw, Evolution API, Viraliza AI Cloud')
    await p.getByTestId('section-aplicacoes').screenshot({ path: `${OUT}/desktop-04-vps-aplicacoes.png` })
    await p.goto(BASE + '/hospedagem-wordpress', { waitUntil: 'domcontentloaded' })
    ok(/\/hospedagem-de-sites#wordpress$/.test(p.url()) && await p.getByTestId('section-wordpress').isVisible(), `/hospedagem-wordpress → ${p.url().replace(BASE, '')}`)
    await p.locator('#planos-wordpress').waitFor()
    ok(await p.locator('#planos').count() === 1 && await p.locator('#planos-wordpress').count() === 1, 'secção WordPress com os planos WordPress (âncoras distintas)')
    await p.getByTestId('section-wordpress').screenshot({ path: `${OUT}/desktop-05-secao-wordpress.png` })
    await p.goto(BASE + '/servidor-dedicado', { waitUntil: 'domcontentloaded' })
    ok(await p.getByTestId('ded-compatibility').isVisible() && /cPanel\/WHM/.test(await p.getByTestId('ded-compatibility').innerText()), 'Dedicado Linux: compatibilidade (cPanel/WHM, Docker…)')
    await ctx.close()

    // ── 4. URLs antigos, encaminhamentos e sitemap ──
    console.log('\n4. URLs antigos, encaminhamento e sitemap')
    const rw = await status('/hospedagem-wordpress')
    ok(rw.status === 308 && /\/hospedagem-de-sites#wordpress$/.test(rw.location), `/hospedagem-wordpress → 308 ${rw.location}`)
    const res = await Promise.all(OLD_LINKS.map(u => status(u.split('#')[0], 'follow')))
    const badOld = OLD_LINKS.filter((_, k) => res[k].status !== 200)
    ok(!badOld.length, `${OLD_LINKS.length} destinos do antigo menu continuam a funcionar`, badOld.join(', '))
    ok(!sm.includes('/hospedagem-wordpress<') && sm.includes('https://viralizahost.com/sobre<') && sm.includes('https://viralizahost.com/servidor-dedicado-windows<'), 'sitemap: sem o URL encaminhado; com /sobre')
    const smUrls = [...sm.matchAll(/<loc>https:\/\/viralizahost\.com([^<]*)<\/loc>/g)].map(m => m[1] || '/')
    const smRes = await Promise.all(smUrls.map(u => status(u)))
    ok(smRes.every(s => s.status === 200), `todas as ${smUrls.length} entradas do sitemap respondem 200`, smUrls.filter((_, k) => smRes[k].status !== 200).join(', '))
  } catch (e) { ok(false, 'execução', e.stack) }
  await b.close()
  console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
  process.exit(fail ? 1 : 0)
})()
