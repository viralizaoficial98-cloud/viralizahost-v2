// Ensaio de interface do painel administrativo (desktop + telemóvel), base de ENSAIO:
//   menu lateral com um único item activo (URL directo, filtros, recarregar, voltar/avançar),
//   acções pendentes (contagens, ligação ao registo, «sem pendências» ≠ «falha ao carregar»),
//   encomendas (filtros por URL, estado vs botão), integrações WHM e registrador.
//   BASE_URL=http://localhost:3100 OUT=/tmp/admin-ui node scripts/mariadb/rehearsal/admin-ui-e2e.cjs
const { chromium, devices } = require('playwright')
const fs = require('fs')
const BASE = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '')
const OUT = process.env.OUT || '/tmp/admin-ui'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 300) : ''}`) }

const activeItems = p => p.$$eval('[data-testid="admin-nav-item"][aria-current="page"]', els => els.filter(e => e.offsetParent !== null).map(e => e.textContent.trim()))
// Itens com fundo realçado (seleccionado ou realce preso) — deve ser só o activo
const highlighted = async p => { await p.mouse.move(1, 899); return p.$$eval('[data-testid="admin-nav-item"]', els => els.filter(e => e.offsetParent !== null && getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)').map(e => e.textContent.trim())) }

async function run(label, ctxOpts, shots) {
  console.log(`\n== ${label}`)
  const b = await chromium.launch()
  const ctx = await b.newContext({ ...ctxOpts, ...(shots ? {} : {}) })
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', e => errors.push(e.message))
  await p.request.post(BASE + '/api/auth/login', { data: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  const mobile = !!ctxOpts.isMobile
  const openMenu = async () => { if (mobile) { const btn = p.getByRole('button', { name: 'Abrir menu', exact: true }); if (await btn.isVisible().catch(() => false)) { await btn.click(); await p.locator('[data-testid="admin-nav-item"]:visible').first().waitFor() } } }
  const closeMenu = async () => { if (mobile) { const x = p.getByRole('button', { name: 'Fechar menu' }); if (await x.isVisible().catch(() => false)) { await x.click(); await p.waitForTimeout(200) } } }

  // Menu: cada rota → um único item activo, o correcto
  const cases = [
    ['/admin', 'Dashboard'], ['/admin/site', 'Gestão do Site'], ['/admin/site/banners', 'Gestão do Site'], ['/admin/site/hero', 'Gestão do Site'],
    ['/admin/site/catalog', 'Catálogo e Preços'], ['/admin/site/catalog?cat=email', 'Catálogo e Preços'], ['/admin/site/products', 'Catálogo e Preços'],
    ['/admin/settings/integrations', 'Integrações'], ['/admin/settings/integrations/whm', 'Integrações'], ['/admin/settings/integrations/registrar', 'Integrações'],
    ['/admin/settings/billing', 'Facturação'], ['/admin/settings', 'Configurações'], ['/admin/orders?filtro=activacao', 'Pedidos'], ['/admin/quotes?estado=new', 'Cotações'],
  ]
  for (const [url, expected] of cases) {
    await p.goto(BASE + url, { waitUntil: 'load' })
    if (!mobile) await p.locator('[data-testid="admin-nav-item"]').first().waitFor({ state: 'attached' })
    else await p.getByRole('button', { name: 'Abrir menu', exact: true }).waitFor()
    await openMenu()
    const act = await activeItems(p)
    const hl = await highlighted(p)
    ok(act.length === 1 && act[0] === expected && hl.length === 1 && hl[0] === expected, `${url} → só «${expected}» activo e realçado`, JSON.stringify({ act, hl }))
    await closeMenu()
  }
  // Recarregar e voltar/avançar entre separadores do catálogo e páginas
  await p.goto(BASE + '/admin/site', { waitUntil: 'networkidle' })
  await p.goto(BASE + '/admin/site/catalog?cat=hosting', { waitUntil: 'networkidle' })
  await p.getByRole('tab', { name: /e-mail/i }).first().click()
  await p.waitForURL(/cat=email/)
  await p.reload({ waitUntil: 'networkidle' })
  await openMenu()
  ok((await activeItems(p)).join() === 'Catálogo e Preços' && /cat=email/.test(p.url()) && (await p.getByRole('tab', { name: /e-mail/i }).first().getAttribute('aria-selected')) === 'true', 'recarregar mantém separador E-mail e «Catálogo e Preços»')
  await closeMenu()
  await p.goBack({ waitUntil: 'commit' }); await p.waitForTimeout(1200)
  await openMenu()
  ok(/cat=hosting/.test(p.url()) && (await activeItems(p)).join() === 'Catálogo e Preços', 'voltar → separador Alojamento, mesmo item activo')
  await closeMenu()
  await p.goBack({ waitUntil: 'commit' }); await p.waitForTimeout(1200)
  await openMenu()
  ok(/\/admin\/site$/.test(p.url()) && (await activeItems(p)).join() === 'Gestão do Site', 'voltar → Gestão do Site activo (e só ele)')
  await closeMenu()
  await p.goForward({ waitUntil: 'commit' }); await p.waitForTimeout(1200)
  await openMenu()
  ok(/cat=hosting/.test(p.url()) && (await activeItems(p)).join() === 'Catálogo e Preços', 'avançar → Catálogo e Preços')
  await closeMenu()

  // Dashboard: acções pendentes
  await p.goto(BASE + '/admin', { waitUntil: 'load' })
  const panel = p.getByTestId('pending-actions')
  await panel.getByTestId('pending-count').first().waitFor({ timeout: 15000 })
  ok(await panel.isVisible() && (await p.locator('h2#pending-title').count()) === 1, 'área «Acções pendentes» no topo do dashboard')
  const counts = await panel.getByTestId('pending-count').allTextContents()
  ok(counts.length === 5 && counts.every(c => /^\d+$/.test(c.trim())), `5 contagens reais: ${counts.join(', ')}`)
  const rev = await p.getByTestId('stat-revenue-value').textContent()
  ok(/Kz/.test(rev) && !/\$/.test(rev), `receita formatada em Kz (${rev.trim()})`)
  if (shots) await p.screenshot({ path: `${OUT}/${label}-dashboard.png`, fullPage: true })
  const item = panel.getByTestId('pending-activations').getByTestId('pending-item').first()
  if (await item.count()) {
    await item.click()
    await p.waitForURL(/filtro=activacao&encomenda=/)
    const focused = p.locator('[data-testid="admin-order"].ring-2')
    await focused.waitFor({ timeout: 10000 })
    ok(await focused.isVisible(), 'item pendente abre a encomenda certa (realçada) no filtro «Activação pendente»')
    if (!mobile) { await p.waitForTimeout(400); const hl = await highlighted(p); ok(hl.join() === 'Pedidos', `depois de navegar a partir do dashboard só «Pedidos» fica realçado (${hl.join(', ')})`) }
    ok((await p.getByTestId('orders-filter-activacao').getAttribute('aria-selected')) === 'true', 'filtro da URL seleccionado')
    // estado (texto) separado do botão de acção
    const statuses = await focused.getByTestId('service-status').allTextContents()
    const buttons = await focused.getByTestId('mark-active').allTextContents()
    ok(statuses.every(s => s !== 'Activo') && buttons.every(t => /^Marcar como (registado|activado)…$/.test(t)), `estado «${statuses.join(' | ')}» e botão «${buttons.join(' | ')}» não se confundem`)
    if (shots) await p.screenshot({ path: `${OUT}/${label}-encomenda-activacao.png`, fullPage: false })
  } else ok(true, 'sem activações pendentes neste momento')

  // Erro de carregamento ≠ sem pendências
  await p.route('**/api/admin/pending-actions', r => r.fulfill({ status: 500, body: '{"error":"x"}', contentType: 'application/json' }))
  await p.goto(BASE + '/admin', { waitUntil: 'load' })
  await p.getByTestId('pending-error').waitFor({ timeout: 10000 })
  ok(await p.getByTestId('pending-error').isVisible() && !(await p.getByText('sem pendências').count()), 'falha ao carregar mostra erro (não «sem pendências»)')
  await p.unroute('**/api/admin/pending-actions')
  await p.route('**/api/admin/pending-actions', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: ['proofs', 'domains', 'activations', 'quotes', 'tickets'].map(k => ({ key: k, label: k, action: 'Abrir', count: 0, items: [], listHref: '/admin' })) }) }))
  await p.goto(BASE + '/admin', { waitUntil: 'load' })
  await p.getByTestId('pending-total').waitFor()
  ok((await p.getByTestId('pending-total').textContent()) === 'sem pendências', 'sem pendências → indicação explícita')
  await p.unroute('**/api/admin/pending-actions')

  // Integrações → WHM/cPanel → Abrir
  await p.goto(BASE + '/admin/settings/integrations', { waitUntil: 'networkidle' })
  const whmRow = p.getByTestId('integration').filter({ hasText: 'WHM / cPanel' }).first()
  await whmRow.getByRole('link', { name: 'Abrir' }).click()
  await p.waitForURL(/\/admin\/settings\/integrations\/whm$/)
  await p.getByTestId('whm-checklist').waitFor()
  ok(true, '«Abrir» do WHM leva à configuração WHM/cPanel')
  await p.getByTestId('whm-test').click()
  await p.getByTestId('whm-test-result').waitFor({ timeout: 20000 })
  ok(/Ligação OK/.test(await p.getByTestId('whm-test-result').textContent()), 'Testar ligação (leitura) OK')
  ok(await p.locator('[data-testid^="whm-pkg-"]').count() > 0, 'lista de pacotes do WHM disponível para mapear planos')
  if (shots) await p.screenshot({ path: `${OUT}/${label}-whm.png`, fullPage: true })
  await p.getByTestId('whm-preview').click()
  await p.getByTestId('whm-preview-result').waitFor({ timeout: 20000 })
  ok(/candidata/.test(await p.getByTestId('whm-preview-result').textContent()), 'pré-visualização da importação com contagens')
  await p.goto(BASE + '/admin/settings/integrations', { waitUntil: 'networkidle' })
  await p.getByTestId('integration').filter({ hasText: 'Registrador de domínios' }).first().getByRole('link', { name: 'Abrir' }).click()
  await p.waitForURL(/integrations\/registrar$/)
  await p.getByTestId('registrar-status').waitFor()
  ok(true, '«Abrir» do registrador leva à configuração do registrador')
  if (shots) await p.screenshot({ path: `${OUT}/${label}-registrador.png`, fullPage: true })

  ok(errors.length === 0, 'sem erros de JavaScript', errors.join(' | '))
  await b.close()
}

;(async () => {
  await run('desktop', { viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 }, true)
  await run('telemovel', { ...devices['iPhone 13'] }, true)
  console.log(`\n${pass} passaram, ${fail} falharam`)
  process.exit(fail ? 1 : 0)
})()
