// Cloud VPS — ensaio completo com a API Hostinger SIMULADA (nada é comprado nem cobrado):
// fornecedor (teste por consulta, sincronização, métodos mascarados, subscrições, histórico), inventário e protecção
// da VM interna 1564781, planos e finanças (custos BRL reais, câmbio, acréscimo 100 %, sustentabilidade), SO/apps,
// datacenters, página pública + páginas especializadas + configurador, pedido → aprovação → factura → pagamento →
// autorização → compra → entrega, HTTP 202, resposta inconclusiva, limites de despesa e de custo, duplicados,
// área do cliente (ficha, métricas, backups, snapshot, firewall, acesso), isolamento, importação/associação, modos.
// Desktop + iPhone. Repõe a configuração e apaga o que criou.
//   BASE_URL=http://localhost:3000 OUT=/tmp/cloud-vps node --env-file=.env.local scripts/mariadb/rehearsal/cloud-vps-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const fs = require('fs')
const { randomUUID } = require('node:crypto')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const MOCK = process.env.HOSTINGER_MOCK || 'http://127.0.0.1:12091'
const OUT = process.env.OUT || './ui-shots-cloud-vps'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x !== '' ? ' — ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : ''}`) }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const RND = Math.random().toString(36).slice(2, 6)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const stats = async () => (await fetch(`${MOCK}/_stats`)).json()
const SSH = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEnsaioChaveSoParaTestesNaoUsarEmProducao12345 ensaio@vh'
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
const hide = p => p.addStyleTag({ content: '[data-floating]{display:none!important}' }).catch(() => {})

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const started = (await one('SELECT CURRENT_TIMESTAMP(6) t')).t
  const snapSettings = await one('SELECT * FROM vps_provider_settings WHERE id = 1')
  const snapInstances = await all('SELECT id FROM vps_instances')
  const adm = new S(), c1 = new S(), c2 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  await c2.req('/api/auth/login', { method: 'POST', body: { email: 'cliente2@ensaio.test', password: 'Cliente#Dois2026' } })
  const c1id = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id
  const c2id = (await one("SELECT id FROM profiles WHERE email = 'cliente2@ensaio.test'")).id
  const cv = body => adm.req('/api/admin/cloud-vps', { method: 'POST', body })
  const cvGet = (section, q = '') => adm.req(`/api/admin/cloud-vps?section=${section}${q}`)
  const reqAct = (id, op, extra = {}) => cv({ action: 'request', id, op, ...extra })
  const createdProducts = []
  /** Plano de ensaio ligado a itens reais do catálogo simulado (BRL) — fixture directa na base. */
  async function mkPlan(name, product, items, limitMinor, mode = 'auto') {
    const id = randomUUID(), slug = `cloud-ensaio-${name}-${RND}`
    await db.query(`INSERT INTO products (id, slug, category, subcategory, name, description, sale_status, position, active, service_type, provisioning, provider_product_id, provider_mode, max_quantity, currency, base_monthly_price, plan_specs)
      VALUES (?, ?, 'vps', NULL, ?, 'Plano de ensaio Cloud VPS', 'active', 900, 1, 'vps', 'manual', ?, ?, 1, 'AOA', 25000, ?)`, [id, slug, `Cloud Ensaio ${name} ${RND}`, product, mode, JSON.stringify({ vcpu: 2, ramGb: 8, diskGb: 100, diskType: 'NVMe' })])
    for (const [cycle, months, price, renewal, item, cost, cur] of items)
      await db.query(`INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, discount_pct, provider_item_id, provider_cost_minor, provider_currency, provider_cost_limit_minor)
        VALUES (UUID(), ?, ?, ?, ?, ?, 'AKZ', 1, 0, ?, ?, ?, ?)`, [id, cycle, months, price, renewal, item, cost, cur, limitMinor])
    createdProducts.push(id)
    return { id, slug }
  }
  const b = await chromium.launch()
  let ctx, p
  try {
    // ── 0. Preparação ──
    console.log('\n0. Fornecedor simulado, opções e planos de ensaio')
    // Token de ensaio próprio (a base pode não ter nenhum): só serve o simulador; nunca é devolvido ao navegador
    let r = await cv({ action: 'provider_save', mode: 'test', apiUrl: MOCK, secret: 'hostinger-de-ensaio', paymentMethodId: 7001, hostnameSuffix: 'srv.ensaio.test' })
    ok(r.status === 200, 'fornecedor em ensaio (API simulada)', r.json)
    r = await cv({ action: 'test' })
    ok(r.status === 200 && r.json.ok && ['catalog', 'virtualMachines', 'dataCenters', 'templates', 'paymentMethods', 'subscriptions', 'firewalls'].every(k => r.json.results[k]?.ok), 'Testar ligação: resultado OK por consulta (7 consultas)', r.json)
    r = await cv({ action: 'provider_save', autoProvision: true, confirmAuto: true })
    ok(r.status === 200 && r.json.settings.autoProvision, 'compra automática no fornecedor activada (ensaio)', r.json)
    r = await cv({ action: 'save_cloud', mode: 'request_only', finance: { fxBrlAoa: 165, fxUsdAoa: 900, markupPct: 100, bankFeePct: 0, taxPct: 0 }, spendLimitMonthlyMinor: null, operations: { purchases: true, clientManagement: true },
      addons: [{ id: 'sup-premium', label: 'Suporte premium', kind: 'support', monthlyKz: 5000, enabled: true }, { id: 'bkp-diario', label: 'Backups diários (gestão ViralizaHost)', kind: 'backup', monthlyKz: 3000, enabled: true }] })
    ok(r.status === 200 && r.json.cloud.mode === 'request_only' && r.json.cloud.finance.fxBrlAoa === 165, 'modo «solicitação», câmbio 165, acréscimo 100 %, 2 extras', r.json)
    r = await cv({ action: 'templates_save', enabledImages: ['1130', '1202', '1210', '1200', '1155'], images: [{ id: '1200', license: { type: 'paid', monthlyKz: 15000 } }] })
    ok(r.status === 200, 'templates publicados (Ubuntu, n8n, Ollama, cPanel com licença paga, Docker)', r.json)
    r = await cv({ action: 'datacenters_save', enabledLocations: ['19', '21'] })
    ok(r.status === 200 && r.json.locations.filter(l => l.enabled).length === 2, 'datacenters Frankfurt e Lisboa oferecidos')
    // Plano principal: KVM 2 BR real (cêntimos BRL: 1 mês 70,99 → renova 108,99; 1 ano 599,88 → 1 067,88)
    const kvm2 = await mkPlan('kvm2', 'hostingercombr-vps-kvm2', [['monthly', 1, 25000, 36000, 'hostingercombr-vps-kvm2-brl-1m', 7099, 'BRL'], ['1year', 12, 200000, 360000, 'hostingercombr-vps-kvm2-brl-12m', 59988, 'BRL']], 200000)
    const pay202 = await mkPlan('pagamento', 'hostingercom-vps-ensaio', [['monthly', 1, 25000, 36000, 'hostingercom-vps-ensaio-pagamento-usd-1m', 699, 'USD']], 100000)
    const lost = await mkPlan('perdido', 'hostingercom-vps-ensaio', [['monthly', 1, 25000, 36000, 'hostingercom-vps-ensaio-perdido-usd-1m', 699, 'USD']], 100000)
    const cheapLimit = await mkPlan('limite', 'hostingercombr-vps-kvm2', [['monthly', 1, 25000, 36000, 'hostingercombr-vps-kvm2-brl-1m', 7099, 'BRL']], 1000)
    ok(true, `planos de ensaio: ${kvm2.slug}, ${pay202.slug}, ${lost.slug}, ${cheapLimit.slug}`)

    // ── 1. Permissões ──
    console.log('\n1. Permissões')
    for (const s of ['overview', 'instances', 'providers', 'finance']) { r = await c1.req(`/api/admin/cloud-vps?section=${s}`); ok(r.status === 403 || r.status === 401, `cliente sem acesso a ${s}`, r.status) }
    r = await anon.req('/api/admin/cloud-vps', { method: 'POST', body: { action: 'sync_inventory' } }); ok(r.status === 401 || r.status === 403, 'visitante não sincroniza')
    r = await anon.req('/api/vps/requests', { method: 'POST', body: { plan: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1130' } } }); ok(r.status === 401, 'pedido de VPS exige sessão', r.status)
    r = await anon.req('/api/cron/vps-sync'); ok(r.status === 401 || r.status === 403, 'cron protegido', r.status)

    // ── 2. Fornecedor, inventário e protecção ──
    console.log('\n2. Fornecedor, inventário e protecção da VM interna')
    r = await cv({ action: 'sync_inventory' })
    ok(r.status === 200 && r.json.ok, 'inventário sincronizado (VMs e subscrições)', r.json)
    const prod = await one("SELECT * FROM vps_instances WHERE provider_vm_id = '1564781'")
    const old = await one("SELECT * FROM vps_instances WHERE provider_vm_id = '1570001'")
    ok(Number(prod?.is_internal) === 1 && Number(prod.is_protected) === 1 && prod.link_status === 'unlinked' && prod.plan === 'KVM 4' && Number(prod.sub_renewal_minor) === 191988, 'VM 1564781: interna, protegida, sem associação, KVM 4 com subscrição', prod)
    ok(old?.link_status === 'unlinked' && Number(old.is_internal) === 0, 'VM 1570001 importada sem associação comercial', old)
    r = await cvGet('providers', '&live=1')
    ok(Array.isArray(r.json.paymentMethods) && r.json.paymentMethods.every(m => /•••• \w{1,4}$/.test(m.label)) && !JSON.stringify(r.json).includes('conta@exemplo'), 'métodos de pagamento mascarados', r.json.paymentMethods)
    ok(Array.isArray(r.json.subscriptions) && r.json.subscriptions.some(s => s.id === 'AzProd1564781' && s.renewalMinor === 191988), 'subscrições: custos e renovação', r.json.subscriptions?.slice?.(0, 2))
    ok(r.json.history.length >= 2 && r.json.history.every(h => h.results ? typeof h.results === 'object' : true), 'histórico de sincronização com resultado por consulta')
    ok(!JSON.stringify(r.json).match(/hostinger-de-ensaio|Bearer/), 'o token nunca é devolvido')
    r = await cv({ action: 'link_instance', id: prod.id, profileId: c1id, confirmed: true }); ok(r.status === 403 && r.json.code === 'vm_protected', 'associar a VM protegida → recusado', r.json)
    r = await cv({ action: 'set_internal', id: prod.id, internal: false, reason: 'tentativa de ensaio' }); ok(r.status === 403, 'retirar a protecção da VM de produção → recusado', r.json)
    r = await cv({ action: 'link_instance', id: old.id, profileId: c2id, confirmed: false }); ok(r.status === 400, 'associação exige confirmação de titularidade')
    r = await cv({ action: 'link_instance', id: old.id, profileId: (await one("SELECT id FROM profiles WHERE email='admin@ensaio.test'")).id, confirmed: true }); ok(r.status === 422, 'conta administrativa não pode ser titular')
    // API do fornecedor indisponível: o «Testar ligação» não pode dizer «OK»
    await cv({ action: 'provider_save', apiUrl: 'http://127.0.0.1:1' })
    r = await cv({ action: 'test' })
    ok(r.status === 200 && r.json.ok === false && /Falha em consultas essenciais/.test(r.json.message) && Object.values(r.json.results).every(x => !x.ok), 'fornecedor inacessível → falha mostrada por consulta (nunca «OK»)', r.json)
    await cv({ action: 'provider_save', apiUrl: MOCK }); await cv({ action: 'test' }); await cv({ action: 'provider_save', autoProvision: true, confirmAuto: true })
    ok((await one('SELECT last_test_ok, auto_provision FROM vps_provider_settings WHERE id = 1')).last_test_ok === 1, 'ligação reposta')

    // ── 3. Planos e finanças ──
    console.log('\n3. Planos, custos do fornecedor e preço sugerido')
    r = await cv({ action: 'sync_costs' })
    ok(r.status === 200 && r.json.updated >= 2 && r.json.missing.length === 0, 'custos sincronizados do catálogo (sem itens em falta)', r.json)
    const m1 = await one("SELECT provider_cost_minor, provider_renewal_minor, provider_currency FROM product_prices WHERE product_id = ? AND cycle = 'monthly'", [kvm2.id])
    ok(Number(m1.provider_cost_minor) === 7099 && Number(m1.provider_renewal_minor) === 10899 && m1.provider_currency === 'BRL', 'KVM 2 mensal: 70,99 BRL inicial, 108,99 BRL renovação', m1)
    r = await cvGet('finance')
    const fc = r.json.plans.find(x => x.id === kvm2.id).cycles.find(c => c.cycle === 'monthly')
    ok(fc.suggestedPromo === Math.ceil(70.99 * 165 * 2 / 100) * 100 && fc.suggestedRegular === Math.ceil(108.99 * 165 * 2 / 100) * 100, `sugerido: promo ${fc.suggestedPromo}, regular ${fc.suggestedRegular} (custo × 165 × 2)`, fc)
    ok(fc.sustainable === true && fc.monthlyEquivalent === 25000 && fc.upfront === 25000, 'mensal sustentável; equivalente mensal e desembolso inicial', fc)
    // Renovação de venda abaixo do custo de renovação → ciclo bloqueado na venda
    await db.query("UPDATE product_prices SET renewal_price = 1000 WHERE product_id = ? AND cycle = 'monthly'", [kvm2.id])
    r = await c1.req('/api/vps/quote', { method: 'POST', body: { plan: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1130' } } })
    ok(r.json?.line?.error?.code === 'vps_cycle_unsustainable', 'renovação abaixo do custo → ciclo recusado no servidor', r.json?.line)
    r = await cv({ action: 'apply_suggested', productId: kvm2.id, cycle: 'monthly' })
    const after = await one("SELECT price, renewal_price FROM product_prices WHERE product_id = ? AND cycle = 'monthly'", [kvm2.id])
    ok(r.status === 200 && Number(after.price) === fc.suggestedPromo && Number(after.renewal_price) === fc.suggestedRegular, 'preço sugerido aplicado (100 % sobre o custo; renovação como regular)', after)
    const ok1y = (await cvGet('finance')).json.plans.find(x => x.id === kvm2.id).cycles.find(c => c.cycle === '1year')
    ok(ok1y.sustainable === true, 'anual sustentável (renovação 3 600 00 Kz ≥ 1 067,88 BRL × 165)', ok1y)
    ok(!(await one("SELECT COUNT(*) n FROM products WHERE provider_product_id LIKE '%game-panel%'")).n, 'planos Game Panel do catálogo NÃO publicados automaticamente')

    // ── 4. Página pública, páginas especializadas e configurador ──
    console.log('\n4. Página pública e configurador (desktop)')
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(`${BASE}/servidor-vps`, { waitUntil: 'domcontentloaded' })
    const card = p.locator(`[data-testid=vps-plan][data-slug="${kvm2.slug}"]`); await card.waitFor({ timeout: 20000 })
    ok(/Configurar VPS/.test(await card.getByTestId('vps-plan-cta').innerText()) && /\/servidor-vps\/configurar\?plano=/.test(await card.getByTestId('vps-plan-cta').getAttribute('href')), '/servidor-vps: botão do plano abre o configurador')
    await p.goto(`${BASE}/servidor-vps/n8n`, { waitUntil: 'domcontentloaded' })
    const nCard = p.locator(`[data-testid=vps-plan][data-slug="${kvm2.slug}"]`); await nCard.waitFor({ timeout: 20000 })
    ok(/app=n8n/.test(await nCard.getByTestId('vps-plan-cta').getAttribute('href')), '/servidor-vps/n8n: planos reais com n8n pré-seleccionado')
    await nCard.getByTestId('vps-plan-cta').click(); await p.waitForURL(/configurar/)
    await p.getByTestId('cfg-image').first().waitFor({ timeout: 15000 })
    await p.waitForTimeout(800)
    ok(await p.locator('[data-testid=cfg-image][data-id="1202"]').getAttribute('aria-pressed') === 'true', 'configurador: n8n já seleccionado')
    await p.goto(`${BASE}/servidor-vps/configurar?plano=${kvm2.slug}&app=openclaw`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('cfg-app-missing').waitFor({ timeout: 15000 })
    ok(true, 'OpenClaw sem template oficial publicado → aviso claro (nada inventado)')
    await p.goto(`${BASE}/servidor-vps/viraliza-ai-cloud`, { waitUntil: 'domcontentloaded' }); await p.locator('[data-testid=vps-plan]').first().waitFor({ timeout: 20000 })
    ok(/app=ai/.test(await p.locator('[data-testid=vps-plan-cta]').first().getAttribute('href')), 'Viraliza AI Cloud → configurador com a categoria IA')
    await p.goto(`${BASE}/servidor-vps/configurar?plano=${kvm2.slug}`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('cfg-image').first().waitFor({ timeout: 15000 })
    ok(await p.getByTestId('cfg-login').count() === 1, 'visitante: «Entrar para solicitar» (modo solicitação)')
    ok((await p.getByTestId('cfg-image').count()) === 5 && (await p.locator('[data-testid^=cfg-group-]').count()) >= 4, 'só os 5 templates publicados, com categorias')
    await p.screenshot({ path: `${OUT}/01-configurador-desktop.png`, fullPage: true })
    ok(p.errors.length === 0, 'sem erros JS (público)', p.errors)
    await ctx.close()

    // ── 5. Pedido → aprovação → factura → pagamento → autorização → compra → entrega ──
    console.log('\n5. Fluxo completo (modo solicitação)')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
    await p.goto(`${BASE}/servidor-vps/configurar?plano=${kvm2.slug}&ciclo=monthly`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('cfg-image').first().waitFor({ timeout: 15000 })
    await p.locator('[data-testid=cfg-image][data-id="1130"]').click()
    await p.locator('[data-testid=cfg-location][data-id="21"]').click()
    await p.getByTestId('cfg-hostname').fill(`app-${RND}.cliente.ao`)
    await p.locator('[data-testid=cfg-addon][data-id="sup-premium"]').check()
    await p.getByTestId('cfg-ssh').fill('isto não é uma chave')
    await p.getByTestId('cfg-error').waitFor({ timeout: 10000 })
    ok(/Chave pública SSH inválida/.test(await p.getByTestId('cfg-error').innerText()), 'chave SSH inválida recusada pelo servidor')
    await p.getByTestId('cfg-ssh').fill(SSH)
    await p.getByTestId('cfg-total').waitFor({ timeout: 10000 }); await p.waitForTimeout(700)
    const q = (await c1.req('/api/vps/quote', { method: 'POST', body: { plan: kvm2.slug, cycle: 'monthly', options: { location: '21', image: '1130', hostname: `app-${RND}.cliente.ao`, sshKey: SSH, addons: ['sup-premium'] } } })).json
    ok(q.line.lineTotal === fc.suggestedPromo + 5000 && q.line.renewalPrice === fc.suggestedRegular + 5000, `preço do servidor: plano + suporte (${q.line.lineTotal} Kz)`, q.line)
    await p.screenshot({ path: `${OUT}/02-configurador-preenchido-desktop.png`, fullPage: true })
    await p.getByTestId('cfg-submit').click()
    await p.getByTestId('cfg-done').waitFor({ timeout: 15000 })
    const ref = await p.getByTestId('cfg-ref').innerText()
    let rq = await one('SELECT * FROM vps_requests WHERE reference = ?', [ref])
    ok(/^VH-VPS-\d{6}-[A-Z0-9]{6}$/.test(ref) && rq.status === 'submitted' && rq.profile_id === c1id && Number(rq.quoted_total) === q.total, 'pedido gravado com o preço calculado no servidor', rq)
    ok(JSON.parse(rq.options).sshKey === SSH && !JSON.stringify(rq).match(/password/i), 'opções guardadas: chave PÚBLICA, nunca senhas')
    await ctx.close()
    r = await c1.req('/api/vps/requests', { method: 'POST', body: { plan: kvm2.slug, cycle: 'monthly', options: { location: '21', image: '1130', hostname: `app-${RND}.cliente.ao`, sshKey: SSH, addons: ['sup-premium'] } } })
    ok(r.status === 200 && r.json.duplicate && r.json.reference === ref, 'pedido repetido → o mesmo (sem duplicar)', r.json)
    r = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'product', slug: kvm2.slug, cycle: 'monthly', options: { location: '21', image: '1130' } }] } })
    ok(r.json?.quote?.lines?.[0]?.error?.code === 'vps_request_only', 'checkout directo bloqueado (vps_request_only)', r.json?.quote?.lines?.[0])
    r = await c1.req(`/comprar/${kvm2.slug}`); ok(/vps-buy-blocked/.test(r.text), '/comprar mostra o bloqueio e envia para o configurador')
    r = await reqAct(rq.id, 'approve'); ok(r.status === 409, 'não aprova sem análise')
    await reqAct(rq.id, 'start_review')
    r = await cvGet('requests', `&id=${rq.id}`)
    ok(r.json.check.checks.every(c => c.ok !== false), 'verificação do fornecedor: produto, item, preço actual, moeda, limite, instalação', r.json.check)
    r = await reqAct(rq.id, 'approve'); ok(r.status === 200 && r.json.request.status === 'approved' && Number(r.json.request.provider_cost_minor) === 7099, 'aprovado (custo do fornecedor verificado: 70,99 BRL)', r.json?.request)
    const before = await stats()
    r = await reqAct(rq.id, 'send_to_payment'); rq = await one('SELECT * FROM vps_requests WHERE id = ?', [rq.id])
    ok(r.status === 200 && rq.status === 'awaiting_payment' && rq.order_id && rq.service_id, 'factura emitida pelo fluxo existente', rq)
    r = await reqAct(rq.id, 'send_to_payment'); ok(r.status === 409, 'emitir duas vezes → recusado')
    r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: rq.order_id } })
    rq = await one('SELECT * FROM vps_requests WHERE id = ?', [rq.id])
    let svc = await one('SELECT * FROM services WHERE id = ?', [rq.service_id])
    ok(r.status === 200 && rq.status === 'paid' && svc.provisioning_status === 'manual_required' && /aguarda a autorização de aquisição/.test(svc.provisioning_error), 'pagamento confirmado (Financeiro) → «Pago», sem compra', { rq: rq.status, svc: svc.provisioning_error })
    ok((await stats()).vpsPurchaseCalls === before.vpsPurchaseCalls, 'nenhuma compra no fornecedor antes da autorização')
    r = await reqAct(rq.id, 'authorize_purchase', { confirmText: 'sim' }); ok(r.status === 400, 'autorização exige o texto exacto')
    r = await reqAct(rq.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' })
    ok(r.status === 200 && ['active', 'in_progress'].includes(r.json.outcome?.status), 'aquisição autorizada → compra no fornecedor', r.json?.outcome)
    const st = await stats()
    ok(st.vpsPurchaseCalls === before.vpsPurchaseCalls + 1, 'exactamente uma compra', st.vpsPurchaseCalls - before.vpsPurchaseCalls)
    ok(st.vpsLastBody?.payment_method_id === 7001 && st.vpsLastBody?.setup?.ssh_keys?.[0] === SSH && !st.vpsLastBody?.setup?.password && st.vpsLastBody?.item_id === 'hostingercombr-vps-kvm2-brl-1m', 'compra: item, método de pagamento autorizado, chave SSH, sem senha', st.vpsLastBody)
    for (let i = 0; i < 12; i++) { await sleep(1500); await cv({ action: 'reconcile_all' }); svc = await one('SELECT * FROM services WHERE id = ?', [rq.service_id]); if (svc.provisioning_status === 'active') break }
    rq = await one('SELECT * FROM vps_requests WHERE id = ?', [rq.id])
    const op1 = await one('SELECT * FROM vps_provider_orders WHERE service_id = ?', [rq.service_id])
    ok(svc.provisioning_status === 'active' && rq.status === 'active' && op1.access_method === 'ssh_key' && op1.access_configured_at, 'entregue: VPS activo, acesso por chave SSH', { svc: svc.provisioning_status, rq: rq.status, op: op1.access_method })
    ok(op1.client_hostname === `app-${RND}.cliente.ao` && (await stats()).hostnames >= 1, 'hostname do cliente aplicado após a entrega')
    r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: rq.order_id } })
    ok(r.json?.payment === 'already_paid' && (await stats()).vpsPurchaseCalls === st.vpsPurchaseCalls, 'pagamento repetido → nada comprado de novo')
    r = await reqAct(rq.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' }); ok(r.status === 409, 'autorizar de novo → recusado')

    // ── 6. HTTP 202, resposta inconclusiva, limites ──
    console.log('\n6. HTTP 202, resposta inconclusiva, limites de custo e de despesas')
    async function toPaid(plan, image = '1130') {
      const x = await c1.req('/api/vps/requests', { method: 'POST', body: { plan: plan.slug, cycle: 'monthly', options: { location: '19', image } } })
      const req = await one('SELECT * FROM vps_requests WHERE reference = ?', [x.json?.reference])
      await reqAct(req.id, 'start_review'); await reqAct(req.id, 'approve', { acceptWarnings: true }); await reqAct(req.id, 'send_to_payment')
      const fr = await one('SELECT * FROM vps_requests WHERE id = ?', [req.id])
      await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: fr.order_id } })
      return fr
    }
    let fr = await toPaid(pay202)
    r = await reqAct(fr.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' })
    let op = await one('SELECT * FROM vps_provider_orders WHERE service_id = ?', [fr.service_id])
    ok(op.status === 'payment_processing' && r.json.outcome?.status === 'in_progress', 'HTTP 202 → pagamento ao fornecedor em processamento (não repetido)', { op: op.status, o: r.json?.outcome })
    await fetch(`${MOCK}/_vps_pay?subscription=${encodeURIComponent(op.provider_subscription_id)}`, { method: 'POST' })
    for (let i = 0; i < 12; i++) { await cv({ action: 'reconcile_all' }); op = await one('SELECT * FROM vps_provider_orders WHERE service_id = ?', [fr.service_id]); if (op.status === 'active') break; await sleep(1500) }
    ok(op.status === 'active' && (await stats()).vpsSetups >= 1, 'reconciliação pela subscrição → /setup uma vez → activo', op.status)
    ok((await one("SELECT access_configured_at FROM vps_provider_orders WHERE service_id = ?", [fr.service_id])).access_configured_at === null, 'sem chave SSH: acesso por definir pelo cliente (não «totalmente entregue»)')
    const accessPendingSvc = fr.service_id
    fr = await toPaid(lost)
    const cLost = (await stats()).vpsPurchaseCalls
    r = await reqAct(fr.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' })
    op = await one('SELECT * FROM vps_provider_orders WHERE service_id = ?', [fr.service_id])
    await cv({ action: 'reconcile_all' })
    ok(['unknown'].includes(op.status) && (await stats()).vpsPurchaseCalls === cLost + 1, 'resposta inconclusiva (rede) → resultado por confirmar, sem nova compra', op.status)
    r = await reqAct(fr.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' })
    ok((await stats()).vpsPurchaseCalls === cLost + 1, 'nova autorização não repete a compra inconclusiva')
    fr = await toPaid(cheapLimit)
    r = await reqAct(fr.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' })
    svc = await one('SELECT * FROM services WHERE id = ?', [fr.service_id])
    ok(/acima do limite/.test(svc.provisioning_error) && !(await one('SELECT id FROM vps_provider_orders WHERE service_id = ?', [fr.service_id])), 'custo acima do limite do plano → nada comprado', svc.provisioning_error)
    await cv({ action: 'save_cloud', spendLimitMonthlyMinor: 100 })
    fr = await toPaid(kvm2)
    const cSpend = (await stats()).vpsPurchaseCalls
    r = await reqAct(fr.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' })
    svc = await one('SELECT * FROM services WHERE id = ?', [fr.service_id])
    ok(/Limite mensal de despesas/.test(svc.provisioning_error) && (await stats()).vpsPurchaseCalls === cSpend, 'limite mensal de despesas → nada comprado', svc.provisioning_error)
    await cv({ action: 'save_cloud', spendLimitMonthlyMinor: null, operations: { purchases: false, clientManagement: true } })
    r = await reqAct(fr.id, 'authorize_purchase', { confirmText: 'AUTORIZO AQUISICAO' })
    svc = await one('SELECT * FROM services WHERE id = ?', [fr.service_id])
    ok(/Compras no fornecedor desactivadas/.test(svc.provisioning_error) && (await stats()).vpsPurchaseCalls === cSpend, 'compras desactivadas no painel → nada comprado', svc.provisioning_error)
    await cv({ action: 'save_cloud', operations: { purchases: true, clientManagement: true } })

    // ── 7. Área do cliente ──
    console.log('\n7. Área do cliente: ficha, métricas, backups, snapshot, firewall, acesso, isolamento')
    const sid = rq.service_id
    r = await c1.req(`/api/client/vps/${sid}?view=details`)
    ok(r.status === 200 && r.json.cpus === 2 && r.json.ipv4.length && r.json.ipv6.length && r.json.hostname === `app-${RND}.cliente.ao` && r.json.location, 'ficha técnica real (CPU, IPv4/IPv6, hostname, centro de dados)', r.json)
    r = await c1.req(`/api/client/vps/${sid}?view=metrics`); ok(r.status === 200 && r.json.cpu.length === 12 && r.json.ram.length, 'métricas reais (série do fornecedor)')
    r = await c1.req(`/api/client/vps/${sid}?view=backups`); ok(r.status === 200 && r.json.backups.length === 2 && r.json.snapshot === null, 'backups listados; sem snapshot')
    r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'backup_op', op: 'backup-restore', backupId: r.json.backups[0].id } }); ok(r.status === 422, 'restaurar sem confirmação escrita → recusado')
    r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'backup_op', op: 'backup-restore', backupId: 1, confirmText: 'RESTAURAR' } }); ok(r.status === 404, 'backup de outra VM → recusado (404)')
    r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'backup_op', op: 'snapshot-create' } }); ok(r.status === 200, 'snapshot criado')
    await sleep(1200)
    r = await c1.req(`/api/client/vps/${sid}?view=backups`); ok(r.json.snapshot?.id, 'snapshot visível')
    r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'firewall_op', op: 'create' } }); ok(r.status === 200 && r.json.firewall?.name?.startsWith('vh-'), 'firewall dedicada criada', r.json)
    r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'firewall_op', op: 'add-rule', protocol: 'SSH', port: '22', sourceDetail: 'any', ruleAction: 'accept' } }); ok(r.status === 200 && r.json.firewall.rules.length === 1, 'regra SSH adicionada')
    r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'firewall_op', op: 'add-rule', protocol: 'TCP', port: '99999' } }); ok(r.status === 422, 'porta inválida recusada')
    r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'firewall_op', op: 'activate' } }); ok(r.status === 200, 'firewall activada no VPS')
    for (const [view, path] of [['details', '?view=details'], ['firewall', '?view=firewall'], ['backups', '?view=backups']]) { r = await c2.req(`/api/client/vps/${sid}${path}`); ok(r.status === 404, `isolamento: outro cliente não vê ${view} (404)`, r.status) }
    r = await c2.req(`/api/client/vps/${sid}`, { method: 'POST', body: { action: 'stop' } }); ok(r.status === 404, 'isolamento: outro cliente não desliga (404)')
    // Acesso por definir (VPS do 202, sem chave): aviso, depois senha root → acesso configurado
    r = await c1.req(`/api/client/vps/${accessPendingSvc}`); ok(r.json?.vps?.accessPending === true, 'VPS sem acesso configurado: «defina o acesso»')
    r = await c1.req(`/api/client/vps/${accessPendingSvc}`, { method: 'POST', body: { action: 'root_password', password: `Ensaio-${RND}-Forte9#` } }); ok(r.status === 200, 'senha root definida pelo cliente (enviada ao fornecedor, não guardada)')
    r = await c1.req(`/api/client/vps/${accessPendingSvc}`); ok(r.json?.vps?.accessPending === false, 'acesso configurado → entrega completa')
    ok(!JSON.stringify(await all('SELECT description FROM activity_logs WHERE created_at >= ?', [started])).includes(`Ensaio-${RND}-Forte9#`), 'a senha não aparece na auditoria')
    for (const [name, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts, c1.cookie))
      await p.goto(`${BASE}/vps/${sid}`, { waitUntil: 'domcontentloaded' })
      await p.getByTestId('vx-details').waitFor({ timeout: 20000 }); await p.getByTestId('vx-cpu').waitFor({ timeout: 15000 })
      await p.getByTestId('vx-metric').first().waitFor({ timeout: 15000 })
      await p.getByTestId('vx-fw-rule').first().waitFor({ timeout: 15000 }).catch(() => {}); await p.getByTestId('vx-backup').first().waitFor({ timeout: 15000 }).catch(() => {})
      const counts = { backup: await p.getByTestId('vx-backup').count(), rule: await p.getByTestId('vx-fw-rule').count(), renew: await p.getByTestId('vx-renew').count(), upgrade: await p.getByTestId('vx-upgrade').count() }
      ok(counts.backup >= 1 && counts.rule === 1 && counts.renew === 1 && counts.upgrade === 1, `${name}: ficha, métricas, backups, firewall, renovar e upgrade`, counts)
      ok(await overflow(p) <= 1, `${name}: sem deslocamento horizontal`)
      await hide(p); await p.screenshot({ path: `${OUT}/0${name === 'desktop' ? 3 : 4}-area-cliente-vps-${name}.png`, fullPage: true })
      ok(p.errors.length === 0, `${name}: sem erros JS`, p.errors)
      await ctx.close()
    }
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
    await p.goto(`${BASE}/vps`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('vps-card').first().waitFor({ timeout: 15000 })
    ok(await p.getByTestId('vps-request-row').count() >= 1, '«Os meus VPS»: pedidos em curso listados')
    await ctx.close()

    // ── 8. Importação e associação explícita ──
    console.log('\n8. VM existente importada → associada ao cliente 2')
    r = await cv({ action: 'link_instance', id: old.id, profileId: c2id, confirmed: true })
    ok(r.status === 200 && r.json.serviceId, 'VM 1570001 associada (serviço importado, sem cobrança)', r.json)
    r = await c2.req('/api/client/vps'); const imp = r.json.items.find(v => v.reference.includes('1570001') || v.vmId === '1570001')
    ok(imp && imp.accessPending === true, 'cliente 2 vê o VPS importado, com acesso por definir', imp)
    r = await cv({ action: 'link_instance', id: old.id, profileId: c1id, confirmed: true }); ok(r.status === 409, 'VM já associada → recusado')
    r = await c1.req(`/api/client/vps/${imp.id}?view=details`); ok(r.status === 404, 'cliente 1 não acede ao VPS do cliente 2')
    // Adulteração simulada: a base passa a apontar o VPS do cliente 1 para a VM de produção. Todas as rotas
    // (cliente, painel, cron) têm de recusar e nada pode chegar à Hostinger (2.ª barreira no cliente da API).
    const opRow = await one('SELECT id, provider_vm_id FROM vps_provider_orders WHERE service_id = ?', [sid])
    await db.query("UPDATE vps_provider_orders SET provider_vm_id = '1564781' WHERE id = ?", [opRow.id])
    try {
      const refused = []
      for (const body of [{ action: 'restart' }, { action: 'stop' }, { action: 'start' }, { action: 'root_password', password: `Ensaio-${RND}-Forte9#` }, { action: 'ssh_key', key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEnsaioEnsaioEnsaioEnsaioEnsaioEnsaio01 ensaio' },
        { action: 'reinstall', image: '1130', acceptDataLoss: true, confirmText: 'REINSTALAR' }, { action: 'backup_op', op: 'snapshot-create' }, { action: 'backup_op', op: 'backup-restore', backupId: '1', confirmText: 'RESTAURAR' }, { action: 'firewall_op', op: 'activate' }]) {
        r = await c1.req(`/api/client/vps/${sid}`, { method: 'POST', body }); if (r.status === 403) refused.push(body.action + (body.op ? `:${body.op}` : ''))
      }
      ok(refused.length === 9, `cliente: 9/9 operações recusadas (403) na VM 1564781 (${refused.join(', ')})`)
      r = await c1.req(`/api/client/vps/${sid}?view=details`); ok(r.status === 403, 'cliente: ficha da VM protegida recusada')
      r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'vps_link', serviceId: sid, vmId: '1564781' } })
      ok(r.status !== 200 || r.json?.ok !== true, `painel → Encomendas: associar a VM 1564781 recusado (${r.status} ${String(r.json?.error ?? '').slice(0, 80)})`)
      r = await cv({ action: 'link_instance', id: (await one("SELECT id FROM vps_instances WHERE provider_vm_id = '1564781'")).id, profileId: c1id, confirmed: true })
      ok(r.status === 403, 'painel → Cloud VPS: associar a VM 1564781 recusado (403)')
      r = await cv({ action: 'set_internal', id: (await one("SELECT id FROM vps_instances WHERE provider_vm_id = '1564781'")).id, internal: false })
      ok(r.status === 403, 'painel → Cloud VPS: retirar «interna» da VM 1564781 recusado (403)')
      const cron = await fetch(`${BASE}/api/cron/vps-sync`, { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
      ok(cron.status === 200, `tarefa cron de conciliação executada (${cron.status})`)
      r = await fetch(`${BASE}/api/cron/vps-sync`, { method: 'POST' }); ok(r.status === 401, 'cron sem segredo → 401')
    } finally {
      await db.query('UPDATE vps_provider_orders SET provider_vm_id = ? WHERE id = ?', [opRow.provider_vm_id, opRow.id])
    }
    const vmOps = (await stats()).vmOps ?? {}
    ok(!vmOps['1564781'], 'VM 1564781 nunca recebeu operações de escrita (cliente, painel, cron)', vmOps)

    // ── 9. Modos ──
    console.log('\n9. Modos: desactivado, teste e automático')
    await cv({ action: 'save_cloud', mode: 'disabled' })
    r = await c1.req('/api/vps/requests', { method: 'POST', body: { plan: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1210' } } }); ok(r.status === 403, 'desactivado: pedidos recusados')
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
    await p.goto(`${BASE}/servidor-vps/configurar?plano=${kvm2.slug}`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('cfg-closed').waitFor({ timeout: 15000 })
    ok(true, 'desactivado: configurador mostra «Em breve»'); await ctx.close()
    await cv({ action: 'save_cloud', mode: 'test' })
    r = await c1.req('/api/vps/requests', { method: 'POST', body: { plan: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1210' } } }); ok(r.status === 403, 'teste: cliente recusado')
    r = await adm.req('/api/vps/requests', { method: 'POST', body: { plan: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1210' } } })
    ok(r.status === 201 && Number((await one('SELECT is_test FROM vps_requests WHERE reference = ?', [r.json.reference])).is_test) === 1, 'teste: administrador cria pedido de teste')
    r = await cv({ action: 'save_cloud', mode: 'automatic' }); ok(r.status === 409, 'automático sem autorização expressa → recusado')
    r = await cv({ action: 'save_cloud', mode: 'automatic', confirmText: 'AUTORIZO VENDA AUTOMATICA VPS' }); ok(r.status === 200 && r.json.cloud.mode === 'automatic', 'automático autorizado (API simulada)')
    // Percurso completo no navegador (modo automático, API simulada): configurador → carrinho → checkout → rever →
    // encomenda → comprovativo validado no painel → compra → aprovisionamento → painel do VPS. Capturas de cada etapa.
    await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente2@ensaio.test'")
    const aq = (await c2.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'product', slug: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1210' } }] } })).json.quote
    r = await c2.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ type: 'product', slug: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1210' } }], acceptedTotal: 1, paymentMethod: 'bank_transfer', proofFile: null } })
    ok(r.status === 409 && r.json.code === 'price_changed', 'preço do navegador ignorado (recalculado no servidor)')
    const proofPath = `ensaio/${Date.now()}_cloud-vps.pdf`
    let autoOrder = null
    for (const [name, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente2@ensaio.test'")
      ;({ ctx, p } = await ctxFor(b, opts, c2.cookie))
      await p.goto(`${BASE}/servidor-vps/configurar?plano=${kvm2.slug}`, { waitUntil: 'domcontentloaded' })
      await p.locator('[data-testid=cfg-image][data-id="1210"]').click(); await p.getByTestId('cfg-total').waitFor({ timeout: 15000 })
      if (name === 'desktop') ok(/Adicionar ao carrinho/.test(await p.getByTestId('cfg-submit').innerText()), 'automático: «Adicionar ao carrinho»')
      await p.getByTestId('cfg-submit').click(); await p.waitForURL('**/carrinho', { timeout: 20000 })
      await p.getByTestId('finalize').waitFor({ timeout: 15000 }); await hide(p); await p.waitForTimeout(500)
      ok(await overflow(p) <= 1, `${name}: carrinho sem deslocamento horizontal`)
      await p.screenshot({ path: `${OUT}/${name === 'desktop' ? 20 : 30}-carrinho-${name}.png`, fullPage: true })
      if (name === 'iphone') { await ctx.close(); break }
      await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento', { timeout: 20000 })
      await p.getByTestId('summary-total').waitFor(); await hide(p)
      ok(/27|Kz/.test(await p.getByTestId('summary-total').innerText()) && await overflow(p) <= 1, `checkout: total do servidor (${await p.getByTestId('summary-total').innerText()})`)
      await p.screenshot({ path: `${OUT}/21-checkout-pagamento-desktop.png`, fullPage: true })
      await p.locator('input[type=file]').setInputFiles({ name: 'comprovativo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 ensaio cloud vps') })
      await p.getByText(/Comprovativo: comprovativo.pdf/).waitFor()
      await p.locator('[data-testid=to-review]:not([disabled])').click()
      await p.getByTestId('review-total').waitFor(); await hide(p)
      await p.screenshot({ path: `${OUT}/22-checkout-rever-desktop.png`, fullPage: true })
      await p.getByTestId('accept-terms').check(); await p.getByTestId('confirm-order').click()
      await p.waitForURL('**/orders/**', { timeout: 20000 }); autoOrder = p.url().split('/orders/')[1].split('?')[0]
      await p.getByTestId('order-proof-pending').waitFor({ timeout: 15000 }); await hide(p)
      ok(true, `encomenda criada no checkout (${autoOrder.slice(0, 8)}) com comprovativo por validar`)
      await p.screenshot({ path: `${OUT}/23-encomenda-comprovativo-desktop.png`, fullPage: true })
      await ctx.close()
    }
    // Mobile: checkout (sem criar encomenda)
    ;({ ctx, p } = await ctxFor(b, IPHONE, c2.cookie))
    await p.goto(`${BASE}/servidor-vps/configurar?plano=${kvm2.slug}`, { waitUntil: 'domcontentloaded' })
    await p.locator('[data-testid=cfg-image][data-id="1210"]').click(); await p.getByTestId('cfg-total').waitFor({ timeout: 15000 })
    await p.getByTestId('cfg-submit').click(); await p.waitForURL('**/carrinho', { timeout: 20000 })
    await p.getByTestId('finalize').click(); await p.waitForURL('**/checkout/pagamento', { timeout: 20000 }); await p.getByTestId('summary-total').waitFor(); await hide(p)
    ok(await overflow(p) <= 1, 'iphone: checkout sem deslocamento horizontal')
    await p.screenshot({ path: `${OUT}/31-checkout-iphone.png`, fullPage: true })
    await ctx.close()
    await db.query("UPDATE shopping_carts c JOIN profiles p ON p.id = c.profile_id SET c.items = '[]' WHERE p.email = 'cliente2@ensaio.test'")
    // Painel: lista de comprovativos (paginada, pesquisa) → confirmar pagamento → compra automática
    const autoNumber = (await one('SELECT order_number FROM orders WHERE id = ?', [autoOrder])).order_number
    const cAuto = (await stats()).vpsPurchaseCalls
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/orders?filtro=comprovativos`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('proofs-total').waitFor({ timeout: 20000 }); await p.getByTestId('admin-order').first().waitFor()
    ok((await p.getByTestId('admin-order').first().innerText()).includes(autoNumber), `comprovativos: o mais recente (${autoNumber}) aparece primeiro`)
    await hide(p); await p.screenshot({ path: `${OUT}/24-admin-comprovativos-desktop.png`, fullPage: false })
    await p.getByTestId('proofs-search').fill(autoNumber); await p.getByTestId('proofs-search-go').click()
    await p.waitForURL(/q=/); await p.waitForFunction(n => { const e = document.querySelectorAll('[data-testid=admin-order]'); return e.length === 1 && e[0].textContent.includes(n) }, autoNumber, { timeout: 15000 })
    ok(true, 'comprovativos: pesquisa pelo número da encomenda')
    await p.getByTestId('approve-payment').first().click()
    await p.locator('[role=status]').filter({ hasText: /Pagamento confirmado|confirmad/ }).waitFor({ timeout: 20000 })
    ok((await stats()).vpsPurchaseCalls === cAuto + 1, 'automático: pagamento confirmado → compra automática (uma)')
    await hide(p); await p.screenshot({ path: `${OUT}/25-admin-pagamento-confirmado-desktop.png`, fullPage: false })
    const autoSvc = (await one('SELECT id FROM services WHERE order_id = ?', [autoOrder])).id
    await p.goto(`${BASE}/admin/cloud-vps/aprovisionamento`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('cv-provisioning').waitFor({ timeout: 20000 }); await p.waitForTimeout(900)
    await hide(p); await p.screenshot({ path: `${OUT}/26-admin-aprovisionamento-compra-desktop.png`, fullPage: true })
    await ctx.close()
    for (let i = 0; i < 12; i++) { await sleep(1500); await cv({ action: 'reconcile_all' }); if ((await one('SELECT provisioning_status s FROM services WHERE id = ?', [autoSvc])).s === 'active') break }
    ok((await one('SELECT provisioning_status s FROM services WHERE id = ?', [autoSvc])).s === 'active', 'aprovisionamento concluído: VM «running» → serviço activo')
    // Cliente: painel do VPS → definir acesso → backups, snapshot e firewall
    r = await c2.req(`/api/client/vps/${autoSvc}`, { method: 'POST', body: { action: 'root_password', password: `Ensaio-${RND}-Forte9#` } }); ok(r.status === 200, 'cliente 2 define a senha root (acesso entregue)')
    await c2.req(`/api/client/vps/${autoSvc}`, { method: 'POST', body: { action: 'firewall_op', op: 'create' } })
    for (const [protocol, port] of [['SSH', '22'], ['HTTPS', '443']]) await c2.req(`/api/client/vps/${autoSvc}`, { method: 'POST', body: { action: 'firewall_op', op: 'add-rule', protocol, port, sourceDetail: 'any', ruleAction: 'accept' } })
    r = await c2.req(`/api/client/vps/${autoSvc}`, { method: 'POST', body: { action: 'firewall_op', op: 'activate' } }); ok(r.status === 200, 'firewall criada, 2 regras e activada no VPS do cliente 2')
    // Com uma acção ainda em curso no VPS (senha root acabada de definir) a operação é recusada (409): aguardar
    for (let i = 0; i < 10; i++) { r = await c2.req(`/api/client/vps/${autoSvc}`, { method: 'POST', body: { action: 'backup_op', op: 'snapshot-create' } }); if (r.status !== 409) break; await sleep(1000) }
    ok(r.status === 200, 'snapshot criado', r.json)
    for (const [name, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts, c2.cookie))
      await p.goto(`${BASE}/vps/${autoSvc}`, { waitUntil: 'domcontentloaded' })
      await p.getByTestId('vx-details').waitFor({ timeout: 20000 }); await p.getByTestId('vx-metric').first().waitFor({ timeout: 15000 })
      await p.getByTestId('vx-backup').first().waitFor({ timeout: 15000 }).catch(() => {}); await p.getByTestId('vx-fw-rule').first().waitFor({ timeout: 15000 }).catch(() => {})
      await hide(p); await p.waitForTimeout(600)
      ok(await overflow(p) <= 1 && p.errors.length === 0, `${name}: painel do VPS sem deslocamento nem erros`)
      await p.screenshot({ path: `${OUT}/${name === 'desktop' ? 27 : 32}-painel-vps-${name}.png`, fullPage: true })
      if (name === 'desktop') {
        for (const [tid, file] of [['vx-firewall', '28-firewall-desktop'], ['vx-backups', '29-backups-snapshot-desktop']]) {
          const el = p.getByTestId(tid); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: `${OUT}/${file}.png` })
        }
      }
      await ctx.close()
    }

    // Compras reais: o modo de ensaio nunca aponta para a API real, e o modo produção sem VPS_LIVE_PURCHASES=1 não compra
    ok(process.env.VPS_LIVE_PURCHASES !== '1', 'ensaio corre sem VPS_LIVE_PURCHASES')
    r = await cv({ action: 'provider_save', mode: 'test', apiUrl: 'https://developers.hostinger.com' })
    ok(r.status === 400 && /simulada/.test(r.json?.error ?? ''), `modo de ensaio com a API real → recusado (${r.json?.error})`)
    const prevMode = (await one('SELECT mode FROM vps_provider_settings WHERE id = 1')).mode
    await db.query("UPDATE vps_provider_settings SET mode = 'live' WHERE id = 1") // simula produção (sem chamadas: a compra é recusada antes)
    try {
      const lq = (await c2.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'product', slug: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1210' } }] } })).json.quote
      r = await c2.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ type: 'product', slug: kvm2.slug, cycle: 'monthly', options: { location: '19', image: '1210' } }], acceptedTotal: lq.total, paymentMethod: 'bank_transfer', proofFile: null } })
      const liveOrder = r.json?.order?.id
      const cLive = (await stats()).vpsPurchaseCalls
      await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: liveOrder } })
      const ls = await one('SELECT provisioning_status, provisioning_error FROM services WHERE order_id = ?', [liveOrder])
      ok((await stats()).vpsPurchaseCalls === cLive && ls?.provisioning_status === 'manual_required' && /VPS_LIVE_PURCHASES/.test(ls.provisioning_error ?? ''), `produção sem VPS_LIVE_PURCHASES: pago mas NADA comprado → tratamento manual («${String(ls?.provisioning_error ?? '').slice(0, 70)}…»)`)
      await cv({ action: 'save_cloud', mode: 'request_only' })
      r = await cv({ action: 'save_cloud', mode: 'automatic', confirmText: 'AUTORIZO VENDA AUTOMATICA VPS' })
      ok(r.status !== 200, `produção sem VPS_LIVE_PURCHASES: modo automático recusado mesmo com autorização (${r.status})`)
    } finally {
      await db.query('UPDATE vps_provider_settings SET mode = ? WHERE id = 1', [prevMode])
    }
    await cv({ action: 'save_cloud', mode: 'request_only' })

    // ── 10. Painel: capturas e responsividade ──
    console.log('\n10. Painel Cloud VPS (desktop + iPhone)')
    const pages = [['', 'cv-overview'], ['servidores', 'cv-servers'], ['solicitacoes', 'cv-requests'], ['planos', 'cv-plans'], ['fornecedores', 'cv-providers'], ['sistemas', 'cv-templates'], ['datacenters', 'cv-datacenters'], ['aprovisionamento', 'cv-provisioning'], ['custos', 'cv-costs'], ['configuracoes', 'cv-settings']]
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    let n = 5
    for (const [slug, tid] of pages) {
      await p.goto(`${BASE}/admin/cloud-vps${slug ? `/${slug}` : ''}`, { waitUntil: 'domcontentloaded' })
      await p.getByTestId(tid).waitFor({ timeout: 20000 }); await p.waitForTimeout(900)
      ok(true, `secção ${slug || 'visão geral'} carregada`)
      if (slug === 'servidores') ok(await p.locator('[data-testid=cv-instance][data-vm="1564781"] [data-testid=cv-protected]').count() === 1 && await p.locator('[data-testid=cv-instance][data-vm="1564781"] [data-testid=cv-link-open]').count() === 0, 'servidores: 1564781 «Protegida» e sem «Associar»')
      if (slug === 'sistemas') {
        await p.getByTestId('cv-tpl-group').selectOption('automation'); await p.waitForTimeout(300)
        ok(await p.getByTestId('cv-tpl').count() >= 1 && (await p.getByTestId('cv-tpl').evaluateAll(es => es.every(e => e.dataset.group === 'automation'))), 'SO/apps: filtro por categoria')
        await p.getByTestId('cv-tpl-group').selectOption(''); await p.getByTestId('cv-tpl-search').fill('ubuntu'); await p.waitForTimeout(300)
        ok(await p.getByTestId('cv-tpl').count() >= 3, 'SO/apps: pesquisa')
        await p.getByTestId('cv-tpl-search').fill('')
      }
      if (slug === 'fornecedores') { await p.getByTestId('cv-prov-test').click(); await p.getByTestId('cv-query-results').waitFor({ timeout: 20000 }); ok(await p.locator('[data-testid=cv-query][data-ok="1"]').count() === 7, 'fornecedores: «Testar ligação» com 7 consultas OK') }
      if (slug === 'solicitacoes') { await p.getByTestId('cv-req-search').fill(ref); await p.locator(`[data-testid=cv-req-row][data-ref="${ref}"] button`).first().click(); await p.getByTestId('cv-req-detail').waitFor({ timeout: 15000 }); await p.waitForTimeout(800) }
      if (slug === '') ok(Number(await p.getByTestId('kpi-internal').locator('p').first().innerText()) >= 1, 'visão geral: indicadores reais (VPS internos ≥ 1)')
      await p.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}-admin-${slug || 'visao-geral'}-desktop.png`, fullPage: true })
    }
    ok(p.errors.length === 0, 'painel: sem erros JS', p.errors)
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, IPHONE, adm.cookie))
    for (const [slug, tid] of [['', 'cv-overview'], ['solicitacoes', 'cv-requests']]) {
      await p.goto(`${BASE}/admin/cloud-vps${slug ? `/${slug}` : ''}`, { waitUntil: 'domcontentloaded' }); await p.getByTestId(tid).waitFor({ timeout: 20000 }); await p.waitForTimeout(700)
      ok(await overflow(p) <= 1, `iPhone: ${slug || 'visão geral'} sem deslocamento horizontal`, await overflow(p))
      await p.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}-admin-${slug || 'visao-geral'}-iphone.png`, fullPage: true })
    }
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, IPHONE, c1.cookie))
    await p.goto(`${BASE}/servidor-vps/configurar?plano=${kvm2.slug}`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('cfg-image').first().waitFor({ timeout: 15000 }); await hide(p)
    ok(await overflow(p) <= 1, 'iPhone: configurador sem deslocamento horizontal')
    await p.screenshot({ path: `${OUT}/${String(n++).padStart(2, '0')}-configurador-iphone.png`, fullPage: true })
    await ctx.close()
  } catch (e) {
    ok(false, 'excepção no ensaio', e.stack)
  } finally {
    // ── Reposição ──
    const reqs = await all('SELECT id, order_id, service_id FROM vps_requests WHERE created_at >= ?', [started])
    const orders = [...new Set([...reqs.map(x => x.order_id), ...(await all('SELECT id FROM orders WHERE created_at >= ? AND user_id IN (?, ?)', [started, c1id, c2id])).map(x => x.id)].filter(Boolean))]
    const svcIds = [...(orders.length ? await all(`SELECT id FROM services WHERE order_id IN (${orders.map(() => '?').join(',')})`, orders) : []), ...(await all("SELECT id FROM services WHERE activation_source = 'import' AND created_at >= ? AND service_type = 'vps'", [started]))].map(x => x.id)
    if (svcIds.length) {
      const inS = `(${svcIds.map(() => '?').join(',')})`
      const ops = (await all(`SELECT id FROM vps_provider_orders WHERE service_id IN ${inS}`, svcIds)).map(x => x.id)
      if (ops.length) await db.query(`DELETE FROM vps_provider_events WHERE provider_order_id IN (${ops.map(() => '?').join(',')})`, ops)
      await db.query(`DELETE FROM vps_provider_orders WHERE service_id IN ${inS}`, svcIds)
    }
    if (orders.length) {
      const inO = `(${orders.map(() => '?').join(',')})`
      await db.query(`DELETE ii FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.order_id IN ${inO}`, orders)
      for (const t of ['payments', 'invoices', 'services', 'order_items']) await db.query(`DELETE FROM ${t} WHERE order_id IN ${inO}`, orders)
      await db.query(`DELETE FROM orders WHERE id IN ${inO}`, orders)
    }
    if (svcIds.length) await db.query(`DELETE FROM services WHERE id IN (${svcIds.map(() => '?').join(',')})`, svcIds)
    if (reqs.length) { const ids = reqs.map(x => x.id); await db.query(`DELETE FROM vps_request_events WHERE request_id IN (${ids.map(() => '?').join(',')})`, ids); await db.query(`DELETE FROM vps_requests WHERE id IN (${ids.map(() => '?').join(',')})`, ids) }
    for (const id of createdProducts) { await db.query('DELETE FROM product_prices WHERE product_id = ?', [id]); await db.query('DELETE FROM product_features WHERE product_id = ?', [id]); await db.query('DELETE FROM products WHERE id = ?', [id]) }
    const keep = snapInstances.map(x => x.id)
    await db.query(`DELETE FROM vps_instances WHERE ${keep.length ? `id NOT IN (${keep.map(() => '?').join(',')})` : '1=1'}`, keep)
    await db.query("UPDATE vps_instances SET link_status = 'unlinked', service_id = NULL, profile_id = NULL WHERE provider_vm_id <> '1564781'")
    await db.query('DELETE FROM vps_sync_runs WHERE created_at >= ?', [started])
    const s = snapSettings
    await db.query('UPDATE vps_provider_settings SET mode = ?, api_url = ?, secret_enc = ?, auto_provision = ?, payment_method_id = ?, options = ?, last_test_ok = ?, last_test_at = ?, last_test_message = ? WHERE id = 1', [s.mode, s.api_url, s.secret_enc, s.auto_provision, s.payment_method_id, s.options, s.last_test_ok, s.last_test_at, s.last_test_message])
    await b.close(); await db.end()
    console.log(`\n${pass} passaram, ${fail} falharam`)
    process.exitCode = fail ? 1 : 0
  }
})()
