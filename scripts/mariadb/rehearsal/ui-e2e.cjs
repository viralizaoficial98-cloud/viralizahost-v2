// Ensaio de interface (desktop 1440 e iPhone 13): compra pelo checkout como visitante,
// confirmação, Área do Cliente, renovação e páginas do painel. Ensaio apenas.
//   BASE_URL=http://localhost:3000 OUT=/tmp/ui node scripts/mariadb/rehearsal/ui-e2e.cjs
const { chromium, devices } = require('playwright')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }
const rnd = () => Math.random().toString(36).slice(2, 8)

async function overflow(p) { return p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) }
async function shot(p, name) { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }) }

async function guestPurchase(b, label, ctxOpts) {
  console.log(`\n[${label}] Compra como visitante: alojamento + domínio novo`)
  const ctx = await b.newContext({ ...ctxOpts, deviceScaleFactor: 1 }); const p = await ctx.newPage()
  const errors = []; p.on('pageerror', e => errors.push(e.message))
  await p.goto(BASE + '/hospedagem-de-sites', { waitUntil: 'networkidle' })
  ok(/Kz/.test(await p.locator('#planos').innerText()), 'página de alojamento mostra preços do catálogo')
  ok(await overflow(p) <= 1, 'sem deslocamento horizontal na página de serviço', await overflow(p))
  // Percurso: plano → domínio → duração → carrinho
  await p.locator('#planos a[href^="/comprar/"]').first().click()
  await p.waitForURL('**/comprar/**')
  const name = `ensaio-ui-${rnd()}`
  await p.locator('#dn').fill(name); await p.locator('#dx').selectOption('.com')
  await p.getByRole('button', { name: 'Pesquisar' }).click()
  await p.locator('[data-testid=domain-result]').first().getByTestId('choose-domain').click()
  await p.getByTestId('cycle-monthly').click()
  await p.getByTestId('add-to-cart').click()
  await p.waitForURL('**/carrinho')
  await p.getByTestId('cart-line').first().waitFor()
  await p.waitForTimeout(800)
  ok((await p.getByTestId('cart-line').count()) === 2, 'plano + domínio novo no carrinho')
  await shot(p, `${label}-1-carrinho`)
  ok(await overflow(p) <= 1, 'carrinho sem deslocamento horizontal', await overflow(p))
  await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/conta')
  const email = `ui-${rnd()}@ensaio.test`
  await p.locator('#f-full_name').fill('Cliente Ensaio UI')
  await p.locator('#f-email').fill(email)
  await p.locator('#f-phone').fill('+244 923 000 000')
  await p.locator('#f-address').fill('Rua do Ensaio, 1'); await p.locator('#f-city').fill('Luanda')
  await p.locator('#f-company_name').fill('Ensaio UI Lda')
  await p.locator('#f-password').fill('Ensaio#UI2026'); await p.locator('#f-confirm').fill('Ensaio#UI2026')
  await shot(p, `${label}-2-conta`)
  await p.getByTestId('register-submit').click(); await p.getByTestId('account-verify').waitFor()
  const sim = process.env.RESEND_SIM || 'http://127.0.0.1:12090'
  const last = await (await fetch(`${sim}/_outbox?to=${encodeURIComponent(email)}`)).json()
  await p.goto(last.last.html.match(/href="([^"]+)"/)[1].replace(/&amp;/g, '&'), { waitUntil: 'domcontentloaded' })
  await p.waitForURL('**/checkout/pagamento**')
  await p.waitForSelector('text=/transferência/i')
  await shot(p, `${label}-3-pagamento`)
  ok(await p.getByText(/indisponível/i).first().isVisible().catch(() => false), 'métodos sem gateway aparecem como indisponíveis')
  await p.getByTestId('summary-total').waitFor()
  await p.locator('[data-testid=to-review]:not([disabled])').click()
  const total = await p.getByTestId('review-total').textContent()
  ok(/Kz/.test(total ?? ''), `revisão mostra total ${total}`)
  await p.getByTestId('accept-terms').check()
  await shot(p, `${label}-4-revisao`)
  // duplo clique: uma só encomenda
  const btn = p.getByTestId('confirm-order')
  await btn.dblclick()
  await p.waitForURL('**/orders/**', { timeout: 30000 })
  await p.waitForSelector('text=Encomenda recebida')
  ok(true, `confirmação: ${await p.locator('h1').textContent()}`)
  ok(await p.getByText(/Por pagar/).first().isVisible(), 'estado de pagamento «Por pagar» visível')
  ok(await p.getByRole('link', { name: /Factura/ }).first().isVisible(), 'ligação para a factura')
  await shot(p, `${label}-5-confirmacao`)
  ok(await overflow(p) <= 1, 'confirmação sem deslocamento horizontal', await overflow(p))
  const cart = await p.evaluate(() => JSON.parse(localStorage.getItem('viralizahost-cart-v2') || '{}').state?.lines?.length ?? 0)
  ok(cart === 0, 'carrinho esvaziado após a encomenda')
  await p.goto(BASE + '/orders', { waitUntil: 'networkidle' })
  ok((await p.locator('a[href^="/orders/"]').count()) === 1, 'duplo clique criou uma única encomenda')
  await p.goto(BASE + '/services', { waitUntil: 'networkidle' })
  ok(await p.getByText('Activamos o serviço assim que o pagamento for confirmado.').first().isVisible(), 'serviço aparece como «a aguardar pagamento»')
  await shot(p, `${label}-6-servicos-pendentes`)
  ok(errors.length === 0, 'sem erros JavaScript', errors.join(' | '))
  await ctx.close()
}

async function clientArea(b, label, ctxOpts) {
  console.log(`\n[${label}] Área do Cliente (cliente com serviços activos)`)
  const ctx = await b.newContext({ ...ctxOpts, deviceScaleFactor: 1 }); const p = await ctx.newPage()
  const errors = []; p.on('pageerror', e => errors.push(e.message))
  await p.request.post(BASE + '/api/auth/login', { data: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  await p.goto(BASE + '/services', { waitUntil: 'networkidle' })
  ok((await p.getByTestId('service-card').count()) > 0, `serviços listados: ${await p.getByTestId('service-card').count()}`)
  ok(await overflow(p) <= 1, 'Serviços sem deslocamento horizontal', await overflow(p))
  await shot(p, `${label}-7-servicos`)
  const renew = p.getByTestId('renew').first()
  if (await renew.count()) {
    await renew.click(); await p.waitForURL('**/carrinho'); await p.waitForSelector('text=/Renovação/')
    ok(await p.getByTestId('cart-line').filter({ hasText: /Renovação/ }).count() === 1, 'Renovar leva ao carrinho com a linha de renovação')
    await shot(p, `${label}-8-renovacao-carrinho`)
    await p.evaluate(async () => { localStorage.removeItem('viralizahost-cart-v2'); await fetch('/api/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"lines":[]}' }) })  // esvazia também o carrinho da conta
  } else ok(false, 'sem botão Renovar')
  for (const path of ['/dashboard', '/orders', '/domains', '/hosting', '/billing', '/tickets?assunto=Teste']) {
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800)
    ok(await overflow(p) <= 1, `${path} sem deslocamento horizontal`, await overflow(p))
  }
  ok(await p.locator('input').evaluateAll(els => els.some(e => e.value === 'Teste')), 'pedido de suporte abre com assunto pré-preenchido')
  ok(errors.length === 0, 'sem erros JavaScript', errors.join(' | '))
  await ctx.close()
}

async function admin(b, label, ctxOpts) {
  console.log(`\n[${label}] Painel`)
  const ctx = await b.newContext({ ...ctxOpts, deviceScaleFactor: 1 }); const p = await ctx.newPage()
  const errors = []; p.on('pageerror', e => errors.push(e.message))
  await p.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  for (const [path, name, check] of [
    ['/admin/orders', 'pedidos', /Por pagar|validar/i],
    ['/admin/site/catalog', 'catalogo', /Catálogo e preços/],
    ['/admin/settings/integrations', 'integracoes', /Registrador de domínios/],
    ['/admin/servers/whm-accounts', 'whm', /Importar contas do WHM/],
  ]) {
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500)
    ok(check.test(await p.content()), `${path} carrega`)
    ok(await overflow(p) <= 1, `${path} sem deslocamento horizontal`, await overflow(p))
    await shot(p, `${label}-admin-${name}`)
  }
  ok(errors.length === 0, 'sem erros JavaScript', errors.join(' | '))
  await ctx.close()
}

;(async () => {
  const b = await chromium.launch()
  const desktop = { viewport: { width: 1440, height: 900 } }
  const { deviceScaleFactor, ...iphone } = devices['iPhone 13'] // eslint-disable-line no-unused-vars
  await guestPurchase(b, 'desktop', desktop)
  await guestPurchase(b, 'iphone', iphone)
  await clientArea(b, 'desktop', desktop)
  await clientArea(b, 'iphone', iphone)
  await admin(b, 'desktop', desktop)
  await admin(b, 'iphone', iphone)
  await b.close()
  console.log(`\n${pass} OK, ${fail} falhadas — capturas em ${OUT}`)
  process.exit(fail ? 1 : 0)
})()
