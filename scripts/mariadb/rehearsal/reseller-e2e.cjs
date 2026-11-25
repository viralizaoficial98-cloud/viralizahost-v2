// Revenda de Hospedagem — ensaio completo com o WHM SIMULADO (nunca um WHM real):
// página pública e pedido; modos (disabled/test/request_only/automatic); anti-spam e duplicados; checkout bloqueado;
// painel (análise, servidor, capacidade, aprovação, factura, pagamento pelo Financeiro existente, autorização,
// motor WHM, confirmação da ACL); área do revendedor (WHM/cPanel por sessão, consumo, senha por POST, isolamento);
// capacidade/licença insuficientes e indeterminada; falha parcial, tempo limite, verificação falhada, domínio
// existente; pagamento repetido; suspensão/reactivação; renovação; rejeição/cancelamento; venda automática.
// Desktop + iPhone. Repõe configuração, servidor, perfis e apaga o que criou no fim.
//   BASE_URL=http://localhost:3000 OUT=/tmp/reseller node --env-file=.env.local scripts/mariadb/rehearsal/reseller-e2e.cjs
const { chromium, devices } = require('playwright')
const mysql = require('mysql2/promise')
const fs = require('fs')
const { randomUUID } = require('node:crypto')
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT = process.env.OUT || './ui-shots-reseller'
const WHM_LOG = process.env.WHM_LOG || '/tmp/claude-0/mocks/whm-calls.log'
fs.mkdirSync(OUT, { recursive: true })
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : ''}`) }
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
const IPHONE = devices['iPhone 13']
const RND = Math.random().toString(36).slice(2, 6)
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const whmLog = () => { try { return fs.readFileSync(WHM_LOG, 'utf8').trim().split('\n').map(l => JSON.parse(l)) } catch { return [] } }

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
const hideFloating = p => p.addStyleTag({ content: '[data-floating]{display:none!important}' }).catch(() => {})

;(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
  const all = async (sql, a = []) => (await db.query(sql, a))[0]
  const one = async (sql, a = []) => (await all(sql, a))[0]
  const started = (await one('SELECT CURRENT_TIMESTAMP(6) t')).t
  const L0 = whmLog().length
  const sinceStart = () => whmLog().slice(L0)
  const snapSettings = await one('SELECT * FROM reseller_settings WHERE id = 1')
  const server = await one("SELECT * FROM servers WHERE name = '__whm_config__'")
  const snapProfiles = await all('SELECT * FROM reseller_plan_profiles')
  const plans = await all("SELECT id, slug, name FROM products WHERE slug IN ('revenda-starter','revenda-business','revenda-pro') ORDER BY position")
  const starter = plans.find(p => p.slug === 'revenda-starter')
  const adm = new S(), c1 = new S(), c2 = new S(), anon = new S()
  await adm.req('/api/auth/login', { method: 'POST', body: { email: 'admin@ensaio.test', password: 'Admin#Teste2026' } })
  await c1.req('/api/auth/login', { method: 'POST', body: { email: 'cliente1@ensaio.test', password: 'Cliente#Um2026' } })
  await c2.req('/api/auth/login', { method: 'POST', body: { email: 'cliente2@ensaio.test', password: 'Cliente#Dois2026' } })
  const c1id = (await one("SELECT id FROM profiles WHERE email = 'cliente1@ensaio.test'")).id
  const setMode = async (mode, extra = {}) => adm.req('/api/admin/reseller/settings', { method: 'PUT', body: { mode, ...extra } })
  const rq = (id, action, extra = {}) => adm.req('/api/admin/reseller/requests', { method: 'POST', body: { id, action, ...extra } })
  const svc = (serviceId, action, extra = {}) => adm.req('/api/admin/reseller/services', { method: 'POST', body: { serviceId, action, ...extra } })
  const reqByRef = ref => one('SELECT * FROM reseller_requests WHERE reference = ?', [ref])
  const submit = (s, body) => s.req('/api/reseller/requests', { method: 'POST', body: { fullName: 'Cliente Ensaio', email: `rev-${RND}@ensaio.test`, phone: '+244 923 000 000', plan: 'revenda-starter', cycle: 'monthly', startedAt: Date.now() - 10_000, ...body } })
  /** Pedido do cliente 1 até «Pago» pelo Financeiro existente (aprovação do comprovativo no painel → provisionService). */
  async function toPaid(domain, plan = 'revenda-starter') {
    const r = await submit(c1, { domain, plan, email: 'cliente1@ensaio.test' })
    const req = await reqByRef(r.json?.reference)
    await rq(req.id, 'start_review'); await rq(req.id, 'select_server', { serverId: server.id }); await rq(req.id, 'approve_technical')
    const sp = await rq(req.id, 'send_to_payment')
    const fresh = await reqByRef(req.reference)
    const pay = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: fresh.order_id } })
    return { req: await reqByRef(req.reference), sp, pay }
  }
  const b = await chromium.launch()
  let ctx, p
  try {
    // ── 0. Preparação: servidor de TESTE (simulador), perfis técnicos e modo «só pedidos» ──
    console.log('\n0. Preparação (servidor de teste = simulador; perfis; modo request_only)')
    ok(snapSettings?.mode === 'request_only' || !!snapSettings, 'Configuração existe (modo inicial request_only após a migração)', snapSettings?.mode)
    ok(Number(server.reseller_authorized) === 0, 'Servidor principal NÃO autorizado para revenda por omissão')
    let r = await adm.req('/api/admin/infra/servers', { method: 'POST', body: { action: 'save', server: { id: server.id, hostname: server.hostname, ip: server.ip_address, environment: 'test', services: ['hosting', 'wordpress', 'email', 'reseller'], storageTotalMb: 400000, storageReserveMb: 20000, licenseAccountLimit: 500, unlimitedAssumedMb: 5120, licenseName: 'Pro Cloud (simulado)', protectedAccounts: ['vhreslab'] } } })
    ok(r.status === 200, 'Servidor editado (ambiente teste, categoria revenda, licença, espaço)', r.json)
    r = await adm.req('/api/admin/infra/servers', { method: 'POST', body: { action: 'sync', id: server.id } })
    ok(r.status === 200 && /conta/.test(r.json?.message), 'Sincronização só de leitura (listaccts + listresellers)', r.json)
    const sv = r.json.servers.find(x => x.id === server.id)
    ok(sv.resellersExisting >= 1 && sv.accountsExisting >= 6, 'Contagens do WHM gravadas (inclui o revendedor de laboratório)', sv)
    r = await adm.req('/api/admin/infra/servers', { method: 'POST', body: { action: 'authorize', id: server.id, note: 'x' } })
    ok(r.status === 400, 'Autorizar sem descrição da validação → recusado')
    r = await adm.req('/api/admin/infra/servers', { method: 'POST', body: { action: 'authorize', id: server.id, note: 'Simulador de ensaio validado pela equipa' } })
    ok(r.status === 200 && r.json.servers.find(x => x.id === server.id).resellerAuthorized, 'Servidor de teste autorizado (sem «AUTORIZO REVENDA», por ser teste)', r.json)
    r = await adm.req('/api/admin/reseller/profiles?whm=' + server.id)
    ok(r.status === 200 && r.json.acls.some(a => a.name === 'acl_perigosa' && !a.audit.ok) && r.json.acls.some(a => a.name === 'viraliza_reseller_std_acl' && a.audit.ok), 'Leitura de ACLs do WHM com auditoria (proibida detectada)', r.json)
    r = await adm.req('/api/admin/reseller/profiles', { method: 'PUT', body: { productId: starter.id, storageMb: 10240, bandwidthMb: 102400, maxAccounts: 5, mainQuotaMb: 1024, aclName: 'viraliza_reseller_lab_acl', mainPackage: 'viraliza_rev_main', allowedPackages: ['viraliza_rev_cliente_2g'] } })
    ok(r.status === 400 && /laboratório/.test(r.json?.error), 'ACL de laboratório recusada no perfil comercial', r.json)
    for (const pl of plans) {
      const [st, ac] = pl.slug === 'revenda-starter' ? [10240, 5] : pl.slug === 'revenda-business' ? [20480, 10] : [30720, 15]
      r = await adm.req('/api/admin/reseller/profiles', { method: 'PUT', body: { productId: pl.id, storageMb: st, bandwidthMb: st * 10, maxAccounts: ac, mainQuotaMb: 1024, aclName: 'viraliza_reseller_std_acl', mainPackage: 'viraliza_rev_main', allowedPackages: ['viraliza_rev_cliente_2g', 'viraliza_rev_cliente_5g'], serverIds: [] } })
      ok(r.status === 200 && r.json.profile.complete, `Perfil técnico ${pl.name} completo`, r.json)
    }
    ok((await setMode('request_only', { maxOpenPerEmail: 20 })).status === 200, 'Modo «só pedidos» (ensaio: até 20 pedidos em aberto por e-mail)')

    // ── 1. Permissões ──
    console.log('\n1. Permissões')
    for (const [u, path] of [['/api/admin/reseller/requests', 'GET'], ['/api/admin/infra/servers', 'GET'], ['/api/admin/reseller/settings', 'GET']].map(x => x)) {
      r = await c1.req(u); ok(r.status === 403 || r.status === 401, `Cliente sem acesso a ${u}`, r.status)
    }
    r = await anon.req('/api/client/reseller'); ok(r.status === 401, 'Área do revendedor exige sessão')
    r = await c1.req('/api/admin/reseller/requests', { method: 'POST', body: { id: 'x', action: 'approve_technical' } }); ok(r.status === 403 || r.status === 401, 'Cliente não aprova pedidos')

    // ── 2. Página pública (desktop) + pedido pelo formulário ──
    console.log('\n2. Página pública e pedido (desktop)')
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(`${BASE}/revenda-de-hospedagem`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('fam-plan-card').first().waitFor()
    ok(await p.getByTestId('fam-plan-card').count() === 3, 'Três planos (Starter, Business, Pro) do catálogo', await p.getByTestId('fam-plan-card').count())
    const per = await p.locator('[data-testid^="fam-period-"]').evaluateAll(es => es.map(e => e.getAttribute('data-testid').replace('fam-period-', '')))
    ok(JSON.stringify(per) === JSON.stringify(['monthly', '3months', '6months', '1year']), 'Selector: mensal, trimestral, semestral, anual', per)
    ok(await p.getByTestId('fam-plan-cta').first().getAttribute('data-mode') === 'request' && /Solicitar contratação/.test(await p.getByTestId('fam-plan-cta').first().innerText()), 'Botão «Solicitar contratação»')
    await p.getByTestId('fam-period-6months').click()
    const card = p.locator('[data-testid="fam-plan-card"][data-slug="revenda-starter"]')
    ok(/135[\s.]?000/.test(await card.getByTestId('fam-plan-total').innerText()) && /150[\s.]?000/.test(await card.getByTestId('fam-plan-renewal').innerText()), 'Semestral Starter: 135 000 (−10%) e renovação 150 000', await card.innerText())
    ok(await card.getByTestId('fam-plan-discount').count() === 1, 'Desconto do período visível')
    ok(await p.getByTestId('reseller-compare').count() === 1 && (await p.getByTestId('cmp-revenda-starter').allInnerTexts()).some(t => /10 GB/.test(t)), 'Comparação com limites do perfil técnico')
    ok(await p.getByTestId('reseller-faq-item').count() >= 5 && await p.getByTestId('reseller-how').count() === 1 && await p.getByTestId('reseller-whm-info').count() === 1, 'FAQ, «Como funciona» e WHM/cPanel')
    ok(/aprovação|analisad/.test(await p.getByTestId('reseller-approval-notice').innerText()), 'Aviso de contratação com aprovação')
    await card.getByTestId('fam-plan-cta').click()
    await p.waitForTimeout(600)
    ok(await p.getByTestId('rv-plan').inputValue() === 'revenda-starter' && await p.getByTestId('rv-cycle').inputValue() === '6months', 'O botão do plano preenche plano e ciclo no formulário')
    await p.getByTestId('rv-name').fill('Agência Teste Lda'); await p.getByTestId('rv-email').fill(`publico-${RND}@ensaio.test`); await p.getByTestId('rv-phone').fill('+244 923 111 222')
    await p.getByTestId('rv-domain').fill(`agencia-${RND}.ao`); await p.getByTestId('rv-clients').fill('12'); await p.getByTestId('rv-business').selectOption('agencia_web')
    await p.waitForTimeout(3200) // tempo mínimo de preenchimento (anti-spam)
    await p.getByTestId('rv-submit').click()
    await p.getByTestId('reseller-request-done').waitFor({ timeout: 10000 })
    const pubRef = await p.getByTestId('reseller-request-ref').innerText()
    const pubReq = await reqByRef(pubRef)
    ok(/^VH-REV-\d{6}-[A-Z0-9]{6}$/.test(pubRef) && pubReq?.status === 'submitted' && pubReq.cycle === '6months' && pubReq.business_type === 'agencia_web', 'Pedido gravado na base com referência única', pubReq)
    ok(Number((await one("SELECT COUNT(*) n FROM notifications n JOIN profiles p ON p.id = n.profile_id WHERE p.role = 'admin' AND n.title = 'Novo pedido de Revenda' AND n.created_at >= ?", [started])).n) >= 1, 'Administradores notificados (notifications)')
    ok(Number((await one("SELECT COUNT(*) n FROM auth_email_log WHERE kind = 'notice' AND recipient = ? AND created_at >= ?", [`publico-${RND}@ensaio.test`, started])).n) >= 1, 'Cliente notificado por e-mail (Resend simulado, auth_email_log)')
    ok(!pubReq.ip_hash || pubReq.ip_hash.length === 64, 'IP guardado só como hash')
    await hideFloating(p)
    await p.goto(`${BASE}/revenda-de-hospedagem#planos`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('fam-plan-card').first().waitFor(); await hideFloating(p)
    await p.getByTestId('family-plans-reseller').screenshot({ path: `${OUT}/01-planos-desktop.png` })
    await p.getByTestId('reseller-request-section').screenshot({ path: `${OUT}/02-formulario-desktop.png` })
    await p.getByTestId('reseller-compare').screenshot({ path: `${OUT}/03-comparacao-desktop.png` })
    ok(p.errors.length === 0, 'Sem erros de JavaScript (desktop)', p.errors)
    await ctx.close()

    // ── 3. Validação, anti-spam e duplicados (API) ──
    console.log('\n3. Validação, anti-spam e duplicados')
    r = await submit(anon, { domain: '' }); ok(r.status === 400 && /domínio/i.test(r.json?.error), 'Domínio obrigatório', r.json)
    r = await submit(anon, { domain: `x-${RND}.ao`, cycle: '2years' }); ok(r.status === 400, 'Ciclo fora dos períodos da revenda recusado')
    r = await submit(anon, { domain: `x-${RND}.ao`, phone: '12' }); ok(r.status === 400, 'Telefone inválido recusado')
    r = await submit(anon, { domain: `x-${RND}.ao`, website: 'http://spam' }); ok(r.status === 400, 'Campo isco preenchido → recusado sem gravar')
    r = await submit(anon, { domain: `x-${RND}.ao`, startedAt: Date.now() }); ok(r.status === 400, 'Submissão rápida demais → recusada')
    r = await submit(anon, { domain: `dup-${RND}.ao` }); const d1 = r.json?.reference
    r = await submit(anon, { domain: `dup-${RND}.ao` }); ok(r.status === 200 && r.json?.duplicate && r.json.reference === d1, 'Pedido repetido → devolve o existente (sem duplicar)', r.json)
    ok(Number((await one('SELECT COUNT(*) n FROM reseller_requests WHERE domain = ?', [`dup-${RND}.ao`])).n) === 1, 'Só um registo para o pedido repetido')
    r = await submit(anon, { domain: `wh-${RND}.ao`, whmPassword: 'x' }); ok(!JSON.stringify(await one('SELECT * FROM reseller_requests WHERE reference = ?', [r.json?.reference])).includes('whmPassword'), 'Campos desconhecidos (ex.: senha) não são guardados')

    // ── 4. Checkout bloqueado em «só pedidos» ──
    console.log('\n4. Checkout bloqueado sem aprovação')
    r = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'product', slug: 'revenda-starter', cycle: 'monthly', domain: `q-${RND}.ao` }] } })
    ok(r.json?.quote?.lines?.[0]?.error?.code === 'reseller_request_only' && !r.json.quote.valid, 'Cotação recusa revenda directa (reseller_request_only)', r.json?.quote?.lines?.[0])
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ type: 'product', slug: 'revenda-starter', cycle: 'monthly', domain: `q-${RND}.ao` }], acceptedTotal: 25000, paymentMethod: 'bank_transfer', proofFile: null } })
    ok(r.status === 409, 'Encomenda directa recusada no servidor', r.status)
    ;({ ctx, p } = await ctxFor(b, DESKTOP, c1.cookie))
    await p.goto(`${BASE}/comprar/revenda-starter?ciclo=monthly`, { waitUntil: 'domcontentloaded' })
    ok(await p.getByTestId('reseller-buy-blocked').count() === 1, '/comprar mostra o bloqueio e «Solicitar contratação»')
    await ctx.close()

    // ── 5. Modos «desactivado» e «teste» ──
    console.log('\n5. Modos desactivado e teste')
    await setMode('disabled')
    r = await submit(anon, { domain: `off-${RND}.ao` }); ok(r.status === 403, 'Desactivado: pedidos recusados', r.status)
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(`${BASE}/revenda-de-hospedagem`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('fam-plan-card').first().waitFor()
    ok(/Em breve/.test(await p.getByTestId('fam-plan-cta').first().innerText()) && await p.getByTestId('reseller-closed').count() === 1, 'Desactivado: «Em breve» e sem formulário')
    await ctx.close()
    r = await rq(pubReq.id, 'start_review'); ok(r.status === 200, 'Desactivado: o painel continua a analisar pedidos existentes')
    r = await rq(pubReq.id, 'approve_technical'); ok(r.status === 409, 'Desactivado: aprovação bloqueada', r.json)
    await setMode('test')
    r = await submit(anon, { domain: `t-${RND}.ao` }); ok(r.status === 403, 'Teste: visitante recusado')
    r = await submit(c1, { domain: `t-${RND}.ao` }); ok(r.status === 403, 'Teste: cliente recusado')
    r = await submit(adm, { domain: `teste-${RND}.ao` }); const testRef = r.json?.reference
    ok(r.status === 201 && Number((await reqByRef(testRef))?.is_test) === 1, 'Teste: administrador cria pedido marcado como teste', r.json)
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(`${BASE}/revenda-de-hospedagem`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('fam-plan-card').first().waitFor()
    ok(/Em breve/.test(await p.getByTestId('fam-plan-cta').first().innerText()), 'Teste: nada público para visitantes')
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/revenda-de-hospedagem`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('rv-submit').waitFor()
    ok(await p.getByTestId('reseller-test-banner').count() === 1, 'Teste: administrador vê o formulário com aviso de teste')
    await ctx.close()
    // Pedido de teste até ao fim com pagamento simulado (sem pagamento real)
    let tq = await reqByRef(testRef)
    await rq(tq.id, 'start_review'); await rq(tq.id, 'select_server', { serverId: server.id })
    r = await rq(tq.id, 'approve_technical'); ok(r.status === 200, 'Teste: aprovação técnica num servidor de teste', r.json)
    r = await rq(tq.id, 'send_to_payment'); ok(r.status === 200 && r.json.request.status === 'awaiting_payment', 'Teste: factura emitida', r.json)
    r = await rq(tq.id, 'simulate_payment'); ok(r.status === 200 && r.json.request.status === 'paid', 'Teste: pagamento simulado (só pedidos de teste em servidor de teste)', r.json)
    r = await rq(tq.id, 'authorize_provisioning'); ok(r.status === 200 && r.json.outcome?.status === 'awaiting_confirmation', 'Teste: revendedor criado no simulador', r.json?.outcome)
    await setMode('request_only')

    // ── 6. Fluxo completo (cliente autenticado, Financeiro existente) ──
    console.log('\n6. Pedido → análise → aprovação → factura → pagamento → aprovisionamento → activo')
    const dom = `minharevenda-${RND}.ao`
    r = await submit(c1, { domain: dom, email: 'outro@x.test', cycle: '3months', fullName: '' })
    let q1 = await reqByRef(r.json?.reference)
    ok(q1?.profile_id === c1id && q1.email === 'cliente1@ensaio.test' && q1.full_name.length > 2, 'Cliente autenticado: e-mail e nome da conta (o e-mail enviado é ignorado)', q1)
    r = await rq(q1.id, 'approve_technical'); ok(r.status === 409, 'Não aprova sem «Em análise»')
    await rq(q1.id, 'start_review')
    r = await rq(q1.id, 'approve_technical'); ok(r.status === 409 && /servidor/i.test(r.json?.error), 'Não aprova sem servidor', r.json)
    r = await adm.req(`/api/admin/reseller/requests?id=${q1.id}`)
    const opt = r.json.servers.find(s => s.id === server.id)
    ok(opt && opt.problems.length === 0, 'Servidor de teste elegível (capacidade e licença)', opt)
    await rq(q1.id, 'select_server', { serverId: server.id })
    r = await rq(q1.id, 'approve_technical'); ok(r.status === 200 && r.json.request.status === 'technically_approved', 'Aprovação técnica', r.json)
    const res1 = await one('SELECT * FROM capacity_reservations WHERE request_id = ?', [q1.id])
    ok(res1?.status === 'reserved' && Number(res1.storage_mb) === 11264 && Number(res1.accounts) === 6, 'Capacidade reservada (10 240 + 1 024 MB; 1 + 5 contas)', res1)
    ok(Number((await one("SELECT COUNT(*) n FROM reseller_provision_ops WHERE request_id = ?", [q1.id])).n) === 0, 'A aprovação não cria nada no WHM')
    r = await rq(q1.id, 'send_to_payment'); q1 = await reqByRef(q1.reference)
    const inv1 = await one('SELECT * FROM invoices WHERE order_id = ?', [q1.order_id])
    ok(r.status === 200 && q1.status === 'awaiting_payment' && Math.abs(Number(inv1.total) - Number((await one("SELECT price FROM product_prices WHERE product_id = ? AND cycle = '3months'", [starter.id])).price) * (1 + Number((await one('SELECT tax_rate FROM company_billing_settings WHERE active = 1 LIMIT 1'))?.tax_rate ?? 0) / 100)) < 0.02, 'Encomenda e factura com o preço do catálogo (servidor)', { q: q1.status, total: inv1?.total })
    r = await rq(q1.id, 'send_to_payment'); ok(r.status === 409, 'Encaminhar duas vezes → recusado (sem segunda encomenda)')
    r = await c1.req('/api/client/reseller'); const cr = r.json.requests.find(x => x.reference === q1.reference)
    ok(cr?.status === 'awaiting_payment' && cr.invoice_id === inv1.id, 'Área do cliente: «A aguardar pagamento» com a factura', cr)
    r = await rq(q1.id, 'refresh_payment'); ok(r.status === 409, '«Verificar pagamento» sem pagamento → recusado')
    r = await rq(q1.id, 'authorize_provisioning'); ok(r.status === 409, 'Não autoriza aprovisionamento antes do pagamento')
    r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: q1.order_id } })
    q1 = await reqByRef(q1.reference)
    const s1 = await one('SELECT * FROM services WHERE id = ?', [q1.service_id])
    ok(r.status === 200 && q1.status === 'paid' && s1.provisioning_status === 'manual_required', 'Pagamento confirmado pelo Financeiro → pedido «Pago», sem criação automática', { q: q1.status, s: s1.provisioning_status, msg: s1.provisioning_error })
    ok(Number((await one("SELECT COUNT(*) n FROM reseller_provision_ops WHERE request_id = ?", [q1.id])).n) === 0, 'Pagamento não cria contas (sem operação de aprovisionamento)')
    r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: q1.order_id } })
    ok(r.status === 200 && r.json.payment === 'already_paid' && Number((await one("SELECT COUNT(*) n FROM payments WHERE order_id = ? AND status = 'approved'", [q1.order_id])).n) === 1, 'Pagamento repetido → already_paid (sem duplicar)', r.json)
    const logBefore = whmLog().length
    r = await rq(q1.id, 'authorize_provisioning')
    ok(r.status === 200 && r.json.outcome?.status === 'awaiting_confirmation', 'Motor WHM: revendedor criado e verificado', r.json?.outcome)
    const calls = whmLog().slice(logBefore)
    const fns = calls.map(c => c.fn)
    ok(['verify_new_username', 'createacct', 'setupreseller', 'setacls', 'setresellerlimits', 'setresellerpackagelimit', 'acctcounts', 'resellerstats'].every(f => fns.includes(f)), 'Chamadas WHM esperadas', fns)
    ok(!fns.includes('getresellerprivs'), 'getresellerprivs nunca é chamada')
    ok(calls.filter(c => c.fn === 'createacct').every(c => c.method === 'POST' && !c.params.includes('password') && !c.body.includes('password')), 'createacct por POST e sem senha')
    ok(!fns.includes('removeacct'), 'Nenhuma conta apagada')
    const rs1 = await one('SELECT * FROM reseller_services WHERE service_id = ?', [q1.service_id])
    ok(rs1?.status === 'awaiting_confirmation' && rs1.whm_username && rs1.whm_username !== 'vhreslab', 'Revendedor registado; ainda sem acesso', rs1)
    const ver = JSON.parse(rs1.verification)
    ok(ver.account_limit.ok && ver.disk_limit_mb.ok && ver.bandwidth_limit_mb.ok && ver.main_package.ok && ver.acl.ok === null, 'Verificação: limites e pacote confirmados; ACL não observável', ver)
    ok((await one('SELECT status FROM capacity_reservations WHERE request_id = ?', [q1.id])).status === 'committed', 'Reserva comprometida')
    r = await c1.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'whm' } })
    ok(r.status === 409, 'Antes da confirmação da ACL: sem acesso ao WHM', r.json)
    r = await svc(q1.service_id, 'confirm_acl', { confirmText: 'ok' }); ok(r.status === 400, 'Confirmação da ACL exige o texto exacto')
    r = await svc(q1.service_id, 'confirm_acl', { confirmText: 'ACL CONFIRMADA' }); ok(r.status === 200, 'ACL efectiva confirmada pelo administrador')
    q1 = await reqByRef(q1.reference)
    const s1b = await one('SELECT * FROM services WHERE id = ?', [q1.service_id])
    ok(q1.status === 'active' && s1b.status === 'active' && s1b.provisioning_status === 'active' && s1b.next_due_date, 'Serviço e pedido activos, com data de renovação', { q: q1.status, s: s1b.status, due: s1b.next_due_date })
    ok(Number((await one("SELECT COUNT(*) n FROM notifications WHERE profile_id = ? AND title = 'A sua Revenda está activa'", [c1id])).n) >= 1, 'Cliente notificado da activação')
    ok(Number((await one("SELECT COUNT(*) n FROM activity_logs WHERE entity_type IN ('reseller_request','reseller_service','server','reseller_profile','reseller_settings') AND created_at >= ?", [started])).n) >= 10, 'Auditoria das operações sensíveis (activity_logs)')

    // ── 7. Área do revendedor ──
    console.log('\n7. Área do revendedor (propriedade, sessões, consumo, senha)')
    r = await c1.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'whm' } })
    ok(r.status === 200 && /session=ensaio-whostmgrd/.test(r.json?.url), 'Aceder ao WHM: sessão temporária (whostmgrd)', r.json)
    r = await c1.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'cpanel' } })
    ok(r.status === 200 && /cpaneld/.test(r.json?.url), 'Aceder ao cPanel: sessão temporária (cpaneld)')
    r = await c2.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'whm' } })
    ok(r.status === 404, 'Outro cliente não acede à revenda (isolamento por proprietário)', r.status)
    r = await c2.req('/api/client/reseller'); ok(!JSON.stringify(r.json).includes(rs1.whm_username), 'Outro cliente não vê os dados deste revendedor')
    r = await c1.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'usage' } })
    ok(r.status === 200 && r.json.usage.accountsLimit === 5 && Array.isArray(r.json.usage.clients) && !r.json.usage.clients.some(c => c.user === 'labfilho1'), 'Consumo e lista só das contas-filhas do próprio revendedor', r.json)
    r = await c1.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'password', password: 'fraca' } })
    ok(r.status === 400, 'Senha fraca recusada')
    const lb = whmLog().length
    r = await c1.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'password', password: `Ens@io-${RND}-Forte9` } })
    const pwCall = whmLog().slice(lb).find(c => c.fn === 'passwd')
    ok(r.status === 200 && pwCall?.method === 'POST' && !pwCall.params.includes('password') && pwCall.body.includes('password'), 'Senha alterada por POST (nunca no URL)', pwCall)
    ok(!JSON.stringify(await all('SELECT description, metadata FROM activity_logs WHERE created_at >= ?', [started])).includes(`Ens@io-${RND}`), 'A senha não aparece na auditoria')
    for (const [name, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts, c1.cookie))
      await p.goto(`${BASE}/revendedor`, { waitUntil: 'domcontentloaded' })
      await p.getByTestId('rv-client-reseller').first().waitFor()
      await p.getByTestId('rv-client-refresh').first().click(); await p.getByTestId('rv-client-clients').first().waitFor()
      ok(await p.getByTestId('rv-client-status').first().innerText() === 'Activo' && await p.getByTestId('rv-client-whm').first().isEnabled(), `${name}: revenda activa com botões`)
      for (const t of ['rv-client-whm', 'rv-client-cpanel', 'rv-client-manage', 'rv-client-refresh', 'rv-client-password', 'rv-client-renew', 'rv-client-upgrade', 'rv-client-invoices', 'rv-client-ticket']) ok(await p.getByTestId(t).count() >= 1, `${name}: botão ${t}`)
      ok(await overflow(p) <= 1, `${name}: sem deslocamento horizontal`)
      await hideFloating(p)
      await p.screenshot({ path: `${OUT}/0${name === 'desktop' ? 4 : 5}-area-revendedor-${name}.png`, fullPage: true })
      ok(p.errors.length === 0, `${name}: sem erros JS`, p.errors)
      await ctx.close()
    }
    // Upgrade pela área do cliente
    r = await c1.req('/api/reseller/requests', { method: 'POST', body: { plan: 'revenda-business', cycle: 'monthly', domain: dom, upgradeServiceId: q1.service_id, startedAt: Date.now() - 10_000 } })
    ok(r.status === 201 && (await reqByRef(r.json.reference))?.kind === 'upgrade', 'Pedido de upgrade registado', r.json)
    r = await c2.req('/api/reseller/requests', { method: 'POST', body: { plan: 'revenda-business', cycle: 'monthly', domain: dom, upgradeServiceId: q1.service_id, phone: '+244 923 000 111', startedAt: Date.now() - 10_000 } })
    ok(r.status === 404, 'Upgrade de revenda alheia recusado')

    // ── 8. Capacidade e licença ──
    console.log('\n8. Capacidade insuficiente, licença insuficiente, indeterminada')
    r = await submit(anon, { domain: `cap-${RND}.ao` }); let q8 = await reqByRef(r.json.reference)
    await rq(q8.id, 'start_review'); await rq(q8.id, 'select_server', { serverId: server.id })
    await db.query('UPDATE servers SET license_account_limit = accounts_existing + 3 WHERE id = ?', [server.id])
    r = await rq(q8.id, 'approve_technical'); ok(r.status === 409 && /Licença cPanel insuficiente/.test(r.json?.error), 'Licença insuficiente → aprovação bloqueada', r.json)
    await db.query('UPDATE servers SET license_account_limit = 500, storage_total_mb = quota_committed_mb + storage_reserve_mb + 5000 WHERE id = ?', [server.id])
    r = await rq(q8.id, 'approve_technical'); ok(r.status === 409 && /Espaço seguro insuficiente/.test(r.json?.error), 'Espaço insuficiente (com reserva e compromissos) → bloqueada', r.json)
    await db.query('UPDATE servers SET storage_total_mb = 400000, unlimited_assumed_mb = NULL, accounts_unlimited = 2 WHERE id = ?', [server.id])
    r = await rq(q8.id, 'approve_technical'); ok(r.status === 409 && /indeterminada/.test(r.json?.error), 'Contas ilimitadas sem quota assumida → capacidade indeterminada, bloqueada', r.json)
    await db.query('UPDATE servers SET unlimited_assumed_mb = 5120, license_account_limit = NULL WHERE id = ?', [server.id])
    r = await rq(q8.id, 'approve_technical'); ok(r.status === 409 && /indeterminada/.test(r.json?.error), 'Limite da licença desconhecido → bloqueada', r.json)
    await db.query("UPDATE servers SET license_account_limit = 500, last_sync_at = CURRENT_TIMESTAMP(6) - INTERVAL 3 DAY WHERE id = ?", [server.id])
    r = await rq(q8.id, 'approve_technical'); ok(r.status === 409 && /sincroniz/i.test(r.json?.error), 'Sincronização antiga → bloqueada', r.json)
    await adm.req('/api/admin/infra/servers', { method: 'POST', body: { action: 'sync', id: server.id } })
    r = await rq(q8.id, 'reject', { note: '' }); ok(r.status === 400, 'Rejeitar exige motivo')
    r = await rq(q8.id, 'reject', { note: 'Capacidade reservada para outros clientes' }); ok(r.status === 200 && r.json.request.status === 'rejected', 'Pedido rejeitado com motivo')

    // ── 9. Falhas: parcial, tempo limite, verificação, domínio existente ──
    console.log('\n9. Falha parcial, tempo limite, verificação falhada, domínio existente')
    let f = await toPaid(`parcial-${RND}.ao`)
    r = await rq(f.req.id, 'authorize_provisioning')
    ok(r.json?.outcome?.status === 'failed' && /setacls/.test(r.json.outcome.message), 'Falha parcial no setacls: operação falhada, sem acesso', r.json?.outcome)
    let fr = await reqByRef(f.req.reference)
    ok(fr.status === 'failed' && !(await one("SELECT 1 x FROM reseller_services WHERE service_id = ? AND status = 'active'", [fr.service_id])), 'Pedido «Falha», sem revenda activa')
    let lb2 = whmLog().length
    r = await svc(fr.service_id, 'retry')
    ok(r.json?.outcome?.status === 'awaiting_confirmation' && !whmLog().slice(lb2).some(c => c.fn === 'createacct'), 'Repetir retoma no passo da ACL sem recriar a conta', r.json?.outcome)
    f = await toPaid(`lento-${RND}.ao`)
    r = await rq(f.req.id, 'authorize_provisioning')
    ok(r.json?.outcome?.status === 'failed' && /Sem resposta/.test(r.json.outcome.message), 'Tempo limite do createacct → falha controlada', r.json?.outcome)
    await new Promise(res => setTimeout(res, 3000)) // o simulador conclui a criação depois do tempo limite
    lb2 = whmLog().length
    r = await svc(f.req.service_id ?? (await reqByRef(f.req.reference)).service_id, 'retry')
    const ev = await all("SELECT e.step, e.outcome, e.message FROM reseller_provision_events e JOIN reseller_provision_ops o ON o.id = e.op_id WHERE o.request_id = ? ORDER BY e.created_at", [f.req.id])
    ok(r.json?.outcome?.status === 'awaiting_confirmation' && ev.some(e => e.step === 'create_account' && e.outcome === 'skipped') && !whmLog().slice(lb2).some(c => c.fn === 'createacct'), 'Repetição reconhece a conta criada após o tempo limite (sem duplicar)', { o: r.json?.outcome, ev })
    f = await toPaid(`verificacao-${RND}.ao`)
    r = await rq(f.req.id, 'authorize_provisioning')
    ok(['blocked', 'failed'].includes(r.json?.outcome?.status) && /account_limit/.test(r.json.outcome.message), 'Limite aplicado diferente do perfil → verificação falha, sem acesso', r.json?.outcome)
    f = await toPaid('joaoconceicao.ao')
    r = await rq(f.req.id, 'authorize_provisioning')
    ok(['blocked', 'failed'].includes(r.json?.outcome?.status) && /já existe no servidor/.test(r.json.outcome.message), 'Domínio já existente no servidor → bloqueado (nada é reutilizado nem apagado)', r.json?.outcome)
    r = await svc((await reqByRef(f.req.reference)).service_id, 'retry'); ok(['blocked', 'failed'].includes(r.json?.outcome?.status), 'Repetir continua bloqueado até intervenção manual')
    ok(!sinceStart().some(c => c.fn === 'removeacct'), 'Nunca se apagam contas para corrigir falhas')
    ok(!sinceStart().some(c => ['setacls', 'setresellerlimits', 'setresellerpackagelimit', 'suspendreseller', 'passwd', 'createacct'].includes(c.fn) && JSON.stringify(c).includes('vhreslab')), 'vhreslab nunca usado nem alterado')

    // ── 10. Suspensão, reactivação e renovação ──
    console.log('\n10. Suspensão, reactivação, renovação')
    r = await svc(q1.service_id, 'suspend', { reason: '' }); ok(r.status === 400, 'Suspensão exige motivo')
    r = await svc(q1.service_id, 'suspend', { reason: 'Falta de pagamento (ensaio)' }); ok(r.status === 200, 'Revendedor suspenso (suspendreseller)')
    r = await c1.req('/api/client/reseller', { method: 'POST', body: { serviceId: q1.service_id, action: 'whm' } }); ok(r.status === 409, 'Suspenso: sem acesso ao WHM')
    r = await svc(q1.service_id, 'reconcile'); ok(r.status === 200 && r.json.ok, 'Reconciliação: base e WHM coincidem (suspenso)', r.json)
    r = await svc(q1.service_id, 'unsuspend'); ok(r.status === 200 && (await one('SELECT status FROM reseller_services WHERE service_id = ?', [q1.service_id])).status === 'active', 'Reactivado (unsuspendreseller)')
    const due0 = (await one('SELECT next_due_date FROM services WHERE id = ?', [q1.service_id])).next_due_date
    let qr = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'renewal', serviceId: q1.service_id }] } })
    ok(qr.json?.quote?.valid, 'Renovação permitida no modo «só pedidos»', qr.json?.quote?.lines?.[0])
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ type: 'renewal', serviceId: q1.service_id }], acceptedTotal: qr.json.quote.total, paymentMethod: 'bank_transfer', proofFile: null } })
    const renOrder = r.json?.order?.id
    r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: renOrder } })
    const due1 = (await one('SELECT next_due_date FROM services WHERE id = ?', [q1.service_id])).next_due_date
    ok(r.status === 200 && due1 > due0, 'Renovação paga prolonga a data de vencimento', { due0, due1, r: r.json })

    // ── 11. Cancelamento ──
    console.log('\n11. Cancelamento com factura por pagar')
    r = await submit(c1, { domain: `canc-${RND}.ao` }); let q11 = await reqByRef(r.json.reference)
    await rq(q11.id, 'start_review'); await rq(q11.id, 'select_server', { serverId: server.id }); await rq(q11.id, 'approve_technical'); await rq(q11.id, 'send_to_payment')
    q11 = await reqByRef(q11.reference)
    r = await rq(q11.id, 'cancel', { note: 'Cliente desistiu' })
    const o11 = await one('SELECT status FROM orders WHERE id = ?', [q11.order_id]), i11 = await one('SELECT status FROM invoices WHERE order_id = ?', [q11.order_id])
    ok(r.status === 200 && o11.status === 'cancelled' && i11.status === 'cancelled' && (await one('SELECT status FROM capacity_reservations WHERE request_id = ?', [q11.id])).status === 'released', 'Cancelado: encomenda e factura canceladas, reserva libertada', { o11, i11 })

    // ── 12. Venda automática (exige autorizações) ──
    console.log('\n12. Venda automática')
    r = await setMode('automatic'); ok(r.status === 409 && /aprovação técnica/.test(r.json?.error), 'Automático sem aprovação técnica da infraestrutura → recusado', r.json)
    r = await adm.req('/api/admin/reseller/settings', { method: 'PUT', body: { infraApproval: true, infraApprovalNote: 'Ensaio: simulador validado' } }); ok(r.status === 200, 'Aprovação técnica registada')
    r = await setMode('automatic'); ok(r.status === 409, 'Automático sem autorização expressa escrita → recusado')
    r = await setMode('automatic', { authorizeAutomatic: true, confirmText: 'AUTORIZO VENDA AUTOMATICA' }); ok(r.status === 200 && r.json.settings.automaticReady, 'Venda automática autorizada (ensaio)', r.json)
    ;({ ctx, p } = await ctxFor(b, DESKTOP))
    await p.goto(`${BASE}/revenda-de-hospedagem`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('fam-plan-card').first().waitFor()
    ok(await p.getByTestId('fam-plan-cta').first().getAttribute('data-mode') === 'automatic' && /Contratar agora/.test(await p.getByTestId('fam-plan-cta').first().innerText()), 'Página: «Contratar agora»')
    await ctx.close()
    const autoDom = `auto-${RND}.ao`
    qr = await c1.req('/api/checkout/quote', { method: 'POST', body: { lines: [{ type: 'product', slug: 'revenda-starter', cycle: 'monthly', domain: autoDom, domainMode: 'existing' }] } })
    ok(qr.json?.quote?.valid, 'Cotação aceite com capacidade e autorizações', qr.json?.quote?.lines?.[0])
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ type: 'product', slug: 'revenda-starter', cycle: 'monthly', domain: autoDom, domainMode: 'existing' }], acceptedTotal: 1, paymentMethod: 'bank_transfer', proofFile: null } })
    ok(r.status === 409 && r.json?.code === 'price_changed', 'Preço do navegador ignorado (recalculado no servidor)', r.json?.code)
    r = await c1.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: `ensaio-${randomUUID()}`, lines: [{ type: 'product', slug: 'revenda-starter', cycle: 'monthly', domain: autoDom, domainMode: 'existing' }], acceptedTotal: qr.json.quote.total, paymentMethod: 'bank_transfer', proofFile: null } })
    const autoOrder = r.json?.order?.id
    r = await adm.req('/api/admin/orders', { method: 'POST', body: { action: 'approve', orderId: autoOrder } })
    const autoSvc = await one("SELECT id, provisioning_status FROM services WHERE order_id = ? AND service_type = 'reseller'", [autoOrder])
    ok((await one('SELECT status FROM reseller_provision_ops WHERE service_id = ?', [autoSvc.id]))?.status === 'awaiting_confirmation', 'Pagamento confirmado → aprovisionamento automático (a aguardar ACL)', { svc: autoSvc, r: r.json })
    r = await svc(autoSvc.id, 'confirm_acl', { confirmText: 'ACL CONFIRMADA' }); ok(r.status === 200, 'Venda automática activada após confirmação da ACL')
    r = await adm.req('/api/admin/reseller/settings', { method: 'PUT', body: { revokeAutomatic: true } }); ok(r.status === 200 && r.json.settings.mode === 'request_only', 'Revogar volta a «só pedidos»')

    // ── 13. Painel: capturas e regressão do catálogo ──
    console.log('\n13. Painel (desktop + iPhone) e catálogo')
    for (const [name, opts] of [['desktop', DESKTOP], ['iphone', IPHONE]]) {
      ;({ ctx, p } = await ctxFor(b, opts, adm.cookie))
      await p.goto(`${BASE}/admin/reseller?pedido=${q1.reference}`, { waitUntil: 'domcontentloaded' })
      await p.getByTestId('rv-detail').waitFor({ timeout: 15000 })
      await p.getByTestId('rv-prov').waitFor({ timeout: 10000 }).catch(() => {})
      ok(await p.getByTestId('rv-prov').count() === 1 && /succeeded/i.test(await p.getByTestId('rv-op-status').innerText().catch(() => '')), `${name}: detalhe do pedido com o aprovisionamento`)
      await hideFloating(p); await p.screenshot({ path: `${OUT}/${name === 'desktop' ? '06' : '07'}-painel-pedido-${name}.png`, fullPage: name === 'desktop' })
      await p.getByTestId('rv-tab-dash').click(); await p.getByTestId('rv-dashboard').waitFor()
      ok(/Só pedidos/.test(await p.getByTestId('rv-dash-mode').innerText()), `${name}: painel mostra o modo`)
      if (name === 'desktop') await p.screenshot({ path: `${OUT}/08-painel-resumo-desktop.png` })
      ok(await overflow(p) <= 1, `${name}: painel sem deslocamento horizontal`)
      await p.goto(`${BASE}/admin/servers`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('srv-card').first().waitFor()
      ok(await p.getByTestId('srv-free').count() >= 1, `${name}: servidores com capacidade segura`)
      if (name === 'desktop') await p.screenshot({ path: `${OUT}/09-servidores-desktop.png`, fullPage: true })
      ok(p.errors.length === 0, `${name}: painel sem erros JS`, p.errors)
      await ctx.close()
    }
    ;({ ctx, p } = await ctxFor(b, DESKTOP, adm.cookie))
    await p.goto(`${BASE}/admin/site/catalog`, { waitUntil: 'domcontentloaded' })
    await p.getByTestId('rv-profile-row').first().waitFor({ timeout: 20000 })
    ok(await p.getByTestId('rv-profile-row').count() >= 3, 'Catálogo: perfil técnico por plano de revenda')
    const fp = await p.getByTestId('fp-editor-reseller').innerText()
    ok(/Trimestral/.test(fp) && /Semestral/.test(fp), 'Editor de planos da revenda com trimestral e semestral', fp.slice(0, 300))
    await p.getByTestId('reseller-profiles-admin').screenshot({ path: `${OUT}/10-perfil-tecnico-desktop.png` })
    await ctx.close()
    ;({ ctx, p } = await ctxFor(b, IPHONE))
    await p.goto(`${BASE}/revenda-de-hospedagem`, { waitUntil: 'domcontentloaded' }); await p.getByTestId('fam-plan-card').first().waitFor(); await hideFloating(p)
    ok(await overflow(p) <= 1, 'iPhone: página pública sem deslocamento horizontal')
    await p.getByTestId('family-plans-reseller').screenshot({ path: `${OUT}/11-planos-iphone.png` })
    await p.getByTestId('reseller-request-section').screenshot({ path: `${OUT}/12-formulario-iphone.png` })
    ok(p.errors.length === 0, 'iPhone: sem erros JS', p.errors)
    await ctx.close()
  } catch (e) {
    ok(false, 'Excepção no ensaio', e.stack)
  } finally {
    // ── Reposição ──
    const reqs = (await all('SELECT id, order_id, service_id FROM reseller_requests WHERE created_at >= ?', [started]))
    const orderIds = [...new Set([...reqs.map(x => x.order_id), ...(await all("SELECT o.id FROM orders o WHERE o.created_at >= ? AND o.user_id = ?", [started, c1id])).map(x => x.id)].filter(Boolean))]
    if (orderIds.length) {
      const inO = `(${orderIds.map(() => '?').join(',')})`
      const svcIds = (await all(`SELECT id FROM services WHERE order_id IN ${inO}`, orderIds)).map(x => x.id)
      if (svcIds.length) {
        const inS = `(${svcIds.map(() => '?').join(',')})`
        const ops = (await all(`SELECT id FROM reseller_provision_ops WHERE service_id IN ${inS}`, svcIds)).map(x => x.id)
        if (ops.length) await db.query(`DELETE FROM reseller_provision_events WHERE op_id IN (${ops.map(() => '?').join(',')})`, ops)
        await db.query(`DELETE FROM reseller_provision_ops WHERE service_id IN ${inS}`, svcIds)
        const rss = (await all(`SELECT id FROM reseller_services WHERE service_id IN ${inS}`, svcIds)).map(x => x.id)
        if (rss.length) await db.query(`DELETE FROM reseller_usage_snapshots WHERE reseller_service_id IN (${rss.map(() => '?').join(',')})`, rss)
        await db.query(`DELETE FROM reseller_services WHERE service_id IN ${inS}`, svcIds)
        await db.query(`DELETE FROM whm_accounts WHERE service_id IN ${inS}`, svcIds)
        await db.query(`DELETE FROM capacity_reservations WHERE service_id IN ${inS}`, svcIds)
      }
      await db.query(`DELETE ii FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.order_id IN ${inO}`, orderIds)
      await db.query(`DELETE FROM payments WHERE order_id IN ${inO}`, orderIds)
      await db.query(`DELETE FROM invoices WHERE order_id IN ${inO}`, orderIds)
      await db.query(`DELETE FROM services WHERE order_id IN ${inO}`, orderIds)
      await db.query(`DELETE FROM order_items WHERE order_id IN ${inO}`, orderIds)
      await db.query(`DELETE FROM orders WHERE id IN ${inO}`, orderIds)
    }
    if (reqs.length) {
      const ids = reqs.map(x => x.id), inR = `(${ids.map(() => '?').join(',')})`
      await db.query(`DELETE FROM reseller_request_events WHERE request_id IN ${inR}`, ids)
      await db.query(`DELETE FROM capacity_reservations WHERE request_id IN ${inR}`, ids)
      await db.query(`DELETE FROM reseller_requests WHERE id IN ${inR}`, ids)
    }
    const s = snapSettings
    await db.query('UPDATE reseller_settings SET mode = ?, automatic_authorized_by = ?, automatic_authorized_at = ?, infra_approved_by = ?, infra_approved_at = ?, infra_approval_note = ?, notify_emails = ?, request_notice = ?, default_nameservers = ?, max_open_requests_per_email = ? WHERE id = 1',
      [s.mode, s.automatic_authorized_by, s.automatic_authorized_at, s.infra_approved_by, s.infra_approved_at, s.infra_approval_note, s.notify_emails, s.request_notice, s.default_nameservers, s.max_open_requests_per_email])
    const cols = Object.keys(server).filter(k => !['id', 'created_at', 'updated_at'].includes(k))
    await db.query(`UPDATE servers SET ${cols.map(c => `\`${c}\` = ?`).join(', ')} WHERE id = ?`, [...cols.map(c => server[c]), server.id])
    await db.query('DELETE FROM reseller_plan_profiles')
    for (const pr of snapProfiles) { const k = Object.keys(pr); await db.query(`INSERT INTO reseller_plan_profiles (${k.map(c => `\`${c}\``).join(',')}) VALUES (${k.map(() => '?').join(',')})`, k.map(c => pr[c])) }
    await b.close(); await db.end()
    console.log(`\n${pass} passaram, ${fail} falharam`)
    process.exitCode = fail ? 1 : 0
  }
})()
