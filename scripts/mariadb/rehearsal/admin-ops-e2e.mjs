#!/usr/bin/env node
/**
 * Ensaio do painel administrativo: receita, clientes, estados de serviço, acções pendentes,
 * registrador de domínios (SIMULADO) e WHM (SIMULADO). Base de ENSAIO apenas — cria encomendas,
 * aprova pagamentos e muda configurações de integração (repostas no fim).
 *
 *   BASE_URL=http://localhost:3100 REGISTRAR_SIM_URL=http://127.0.0.1:12089 \
 *     node --env-file=.env.local scripts/mariadb/rehearsal/admin-ops-e2e.mjs
 *
 * O servidor Next de ensaio corre com REGISTRAR_TEST_PROVISIONING=1 e REGISTRAR_TIMEOUT_MS=2000;
 * mock-registrar.mjs com --delay=4000 e MOCK_REGISTRAR_TOKEN (por omissão «registrador-de-ensaio»).
 */
import mysql from 'mysql2/promise'
import { randomBytes, randomUUID } from 'node:crypto'

const BASE = (process.env.BASE_URL || 'http://localhost:3100').replace(/\/$/, '')
const SIM = process.env.REGISTRAR_SIM_URL || 'http://127.0.0.1:12089'
const SIM_TOKEN = process.env.MOCK_REGISTRAR_TOKEN || 'registrador-de-ensaio'
let pass = 0, fail = 0
const ok = (c, n, x = '') => { c ? pass++ : fail++; console.log(`  ${c ? '✓' : '✗'} ${n}${!c && x ? ' — ' + String(x).slice(0, 400) : ''}`) }

class S {
  cookie = ''
  async req(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    for (const c of res.headers.getSetCookie?.() ?? []) { const [k, v] = c.split(';')[0].split('='); if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : '' }
    const text = await res.text(); let json = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text }
  }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
  quote(lines) { return this.req('/api/checkout/quote', { method: 'POST', body: { lines } }) }
  order(lines, total, extra = {}) { return this.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines, acceptedTotal: total, paymentMethod: 'bank_transfer', billingDetails: { name: 'Teste' }, ...extra } }) }
}
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true })
const one = async (sql, p = []) => (await db.query(sql, p))[0][0]
const rnd = () => randomBytes(3).toString('hex')
const digits = s => Number(String(s ?? '').replace(/[^\d]/g, '') || 0)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const c1 = new S(), c2 = new S(), adm = new S(), anon = new S()
ok((await c1.login('cliente1@ensaio.test', 'Cliente#Um2026')).status === 200, 'login cliente 1')
ok((await c2.login('cliente2@ensaio.test', 'Cliente#Dois2026')).status === 200, 'login cliente 2')
ok((await adm.login('admin@ensaio.test', 'Admin#Teste2026')).status === 200, 'login administrador')
const act = body => adm.req('/api/admin/orders', { method: 'POST', body })
const buy = async (s, lines) => { const q = await s.quote(lines); if (!q.json?.quote?.valid) return { error: q.json?.quote?.lines?.map(l => l.error?.code).join(','), quote: q.json?.quote }; const r = await s.order(lines, q.json.quote.total); return { order: r.json?.order, quote: q.json.quote, status: r.status } }
const svcOf = (orderId, type) => one('SELECT * FROM services WHERE order_id = ? AND service_type = ? ORDER BY created_at LIMIT 1', [orderId, type])
const dashboard = async () => {
  const r = await adm.req('/admin')
  const sect = id => { const i = r.text.indexOf(`data-testid="${id}"`); return i < 0 ? '' : r.text.slice(i, i + 4000).replace(/<!-- -->/g, '') }
  const rev = sect('stat-revenue'); const val = (rev.match(/data-testid="stat-revenue-value"[^>]*>(.*?)<\/div>/s)?.[1] ?? '').replace(/<[^>]+>/g, ' ')
  const cl = sect('stat-clients')
  return { status: r.status, html: r.text, revenueText: val, revenueKz: digits(val.match(/Kz\s*[\d\s  .]+/)?.[0]), revenueSection: rev.replace(/<[^>]+>/g, ' '), clients: digits((cl.match(/data-testid="stat-clients-value"[^>]*>(.*?)<\/div>/s)?.[1] ?? '').replace(/<[^>]+>/g, '')), clientsSection: cl.replace(/<[^>]+>/g, ' ') }
}
const pending = async (s = adm) => { const r = await s.req('/api/admin/pending-actions'); return { status: r.status, cats: Object.fromEntries((r.json?.categories ?? []).map(c => [c.key, c])) } }
const simStats = async () => (await (await fetch(`${SIM}/v1/_stats`)).json()).registrations

// Estado inicial das integrações (reposto no fim)
const regBefore = await one('SELECT * FROM registrar_settings WHERE id = 1')
const prodBefore = (await db.query("SELECT id, provisioning, whm_package, whm_server_id FROM products WHERE slug IN ('hosting-turbo','hosting-start')"))[0]

try {
  console.log('\n1. Permissões administrativas')
  for (const [path, method] of [['/api/admin/pending-actions', 'GET'], ['/api/admin/integrations/registrar', 'GET'], ['/api/admin/integrations/whm', 'GET'], ['/api/admin/integrations/registrar', 'POST'], ['/api/admin/integrations/whm', 'POST']]) {
    const a = await anon.req(path, { method, body: method === 'POST' ? { action: 'test' } : undefined })
    const c = await c1.req(path, { method, body: method === 'POST' ? { action: 'test' } : undefined })
    ok([401, 403].includes(a.status) && [401, 403].includes(c.status), `${method} ${path}: visitante ${a.status}, cliente ${c.status}`)
  }
  let r = await c1.req('/admin')
  ok(r.status === 307 || r.status === 308 || r.status === 302, `cliente em /admin é redireccionado (${r.status})`)
  r = await anon.req('/api/checkout/orders', { method: 'POST', body: { idempotencyKey: randomUUID(), lines: [], acceptedTotal: 0, paymentMethod: 'bank_transfer' } })
  ok(r.status === 401, 'encomenda sem conta é recusada (o checkout exige sessão)')

  console.log('\n2. Receita do mês em AKZ, pendentes e duplicados')
  let d0 = await dashboard()
  ok(d0.status === 200 && !/\$\s?\d/.test(d0.revenueText) && /Kz/.test(d0.revenueText), `receita em Kz, sem «$» (${d0.revenueText.trim()})`)
  const expected = Number((await one(`SELECT COALESCE(SUM(LEAST(x.paid, x.total)),0) v FROM (SELECT i.id, i.total, SUM(p.amount) paid, COALESCE(MAX(o.review_flag = 'test'), 0) t FROM payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN orders o ON o.id = i.order_id
    WHERE p.status = 'approved' AND i.currency = 'AKZ' AND p.paid_at >= DATE_FORMAT(UTC_TIMESTAMP() + INTERVAL 1 HOUR, '%Y-%m-01') - INTERVAL 1 HOUR GROUP BY i.id, i.total) x WHERE NOT x.t`)).v)
  // + facturas marcadas pagas no mês sem movimento de pagamento (assinaladas no cartão)
  const orphan = Number((await one(`SELECT COALESCE(SUM(i.total),0) v, COUNT(*) n FROM invoices i LEFT JOIN orders o ON o.id = i.order_id WHERE i.status = 'paid' AND i.currency = 'AKZ'
    AND i.paid_at >= DATE_FORMAT(UTC_TIMESTAMP() + INTERVAL 1 HOUR, '%Y-%m-01') - INTERVAL 1 HOUR AND COALESCE(o.review_flag, '') <> 'test'
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id AND p.status = 'approved')`)).v)
  ok(Math.abs(d0.revenueKz - expected - orphan) <= 1, `receita = pagamentos aprovados no mês${orphan ? ' + facturas pagas sem movimento' : ''} (painel ${d0.revenueKz}, base ${expected + orphan})`)
  if (orphan) ok(/sem registo de pagamento/.test(d0.revenueSection), 'facturas pagas sem movimento de pagamento são assinaladas')
  const domA = `receita-${rnd()}.com`
  const A = await buy(c1, [{ type: 'product', slug: 'hosting-start', cycle: 'monthly', domain: domA, domainMode: 'existing' }])
  ok(!!A.order, `encomenda por pagar criada (${A.order?.order_number})`, A.error)
  let d1 = await dashboard()
  ok(d1.revenueKz === d0.revenueKz, 'pagamento pendente não conta na receita')
  // comprovativo → «Comprovativos por validar»
  const proofPath = `ensaio/${Date.now()}_painel.pdf`
  const fd = new FormData(); fd.append('bucket', 'payment-proofs'); fd.append('path', proofPath); fd.append('file', new Blob([Buffer.from('%PDF-1.4 ensaio')], { type: 'application/pdf' }), 'c.pdf')
  await fetch(BASE + '/api/storage/upload', { method: 'POST', body: fd, headers: { cookie: c2.cookie } })
  const domB = `comprov-${rnd()}.com`
  const qB = await c2.quote([{ type: 'product', slug: 'hosting-start', cycle: 'monthly', domain: domB, domainMode: 'existing' }])
  const B = (await c2.order([{ type: 'product', slug: 'hosting-start', cycle: 'monthly', domain: domB, domainMode: 'existing' }], qB.json.quote.total, { proofFile: proofPath, transferRef: 'TRF-PAINEL' })).json?.order
  let p = await pending()
  ok(p.status === 200 && Object.keys(p.cats).length === 5, 'acções pendentes: 5 categorias')
  const proofItem = p.cats.proofs?.items.find(i => i.ref === B?.order_number)
  ok(!!proofItem && /filtro=comprovativos/.test(proofItem.href) && proofItem.href.includes(B.order_number) && proofItem.since, `comprovativo ${B?.order_number} listado com referência, antiguidade e ligação ao registo`)
  const proofsBefore = p.cats.proofs.count
  r = await act({ action: 'approve', orderId: B.id })
  ok(r.status === 200 && r.json?.payment === 'paid', 'admin valida o comprovativo')
  p = await pending()
  ok(p.cats.proofs.count === proofsBefore - 1 && !p.cats.proofs.items.some(i => i.ref === B.order_number), 'contagem de comprovativos actualizada depois de resolver')
  let d2 = await dashboard()
  ok(d2.revenueKz === d0.revenueKz + Number(qB.json.quote.total), `receita sobe exactamente o valor validado (+${qB.json.quote.total})`)
  // pagamento duplicado na mesma factura (simulado na base) não soma
  const invB = await one('SELECT id, total, profile_id FROM invoices WHERE order_id = ?', [B.id])
  await db.query("INSERT INTO payments (id, invoice_id, profile_id, order_id, method, amount, currency, status, paid_at) VALUES (?, ?, ?, ?, 'bank_transfer', ?, 'AKZ', 'approved', UTC_TIMESTAMP(6))", [randomUUID(), invB.id, invB.profile_id, B.id, invB.total])
  let d3 = await dashboard()
  ok(d3.revenueKz === d2.revenueKz && /Excluído por duplicado/.test(d3.revenueSection), 'pagamento duplicado excluído e assinalado')
  await db.query("DELETE FROM payments WHERE invoice_id = ? AND proof_url IS NULL AND reviewed_by IS NULL AND status = 'approved' ORDER BY created_at DESC LIMIT 1", [invB.id])
  // encomenda marcada como teste pela equipa sai da receita, sem tocar em facturas/pagamentos
  const payBefore = (await db.query('SELECT id, status, amount FROM payments WHERE order_id = ? ORDER BY id', [B.id]))[0]
  r = await act({ action: 'review', orderId: B.id, flag: 'test', notes: 'ensaio' })
  let d4 = await dashboard()
  ok(r.status === 200 && d4.revenueKz === d0.revenueKz && /Excluídas 1 encomenda/.test(d4.revenueSection), 'encomenda marcada «teste» sai da receita e é indicada')
  const payAfter = (await db.query('SELECT id, status, amount FROM payments WHERE order_id = ? ORDER BY id', [B.id]))[0]
  ok(JSON.stringify(payBefore) === JSON.stringify(payAfter) && (await one('SELECT status FROM invoices WHERE order_id = ?', [B.id])).status === 'paid', 'marcação não altera factura nem pagamentos')
  ok(!!(await one("SELECT 1 x FROM activity_logs WHERE entity_id = ? AND description LIKE 'review:%'", [B.id])), 'marcação fica no histórico (activity_logs)')
  await act({ action: 'review', orderId: B.id, flag: null })
  ok((await dashboard()).revenueKz === d2.revenueKz, 'retirar a marcação repõe a receita')

  console.log('\n3. Clientes registados, compradores e contas da equipa')
  const reg = Number((await one("SELECT COUNT(*) n FROM profiles WHERE role = 'client'")).n)
  ok(d4.clients === reg, `«Clientes registados» = contas de cliente na base (${reg})`)
  const S1 = await buy(adm, [{ type: 'product', slug: 'vps-nvme2', cycle: 'monthly' }])
  ok(!!S1.order, `encomenda feita com conta da equipa (${S1.order?.order_number})`, S1.error)
  r = await adm.req('/api/admin/orders')
  const so = r.json?.orders?.find(o => o.id === S1.order?.id)
  ok(so?.profiles?.role === 'admin' && so.review_flag === null, 'encomenda da equipa identificada (papel admin) e sem marcação automática')
  const d5 = await dashboard()
  ok(/encomenda\(s\) feitas com contas da equipa/.test(d5.clientsSection) && /o checkout exige sessão/.test(d5.clientsSection), 'cartão distingue clientes, compradores, contas da equipa e compras sem conta')
  ok(/data-testid="recent-accounts"/.test(d5.html) && d5.html.includes('Conta da equipa'), '«Clientes e compradores recentes» mostra a conta da equipa assinalada')
  await act({ action: 'cancel', orderId: S1.order.id })

  console.log('\n4. Domínio pago mas ainda não registado (sem integração para .com)')
  const domM = `manual-${rnd()}.com`
  const M = await buy(c1, [{ type: 'domain', domain: domM, operation: 'register' }])
  ok(!!M.order, `domínio ${domM} encomendado`, M.error)
  r = await act({ action: 'approve', orderId: M.order.id })
  let sm = await svcOf(M.order.id, 'domain')
  ok(r.status === 200 && sm.provisioning_status === 'manual_required' && sm.status !== 'active', 'pago → serviço do domínio «a aguardar registo», não activo')
  ok((await one('SELECT status FROM domains WHERE CONCAT(name, extension) = ?', [domM])).status === 'pending', 'registo local do domínio continua «pending»')
  p = await pending()
  const actItem = p.cats.activations.items.find(i => i.detail.includes(domM)) ?? (p.cats.activations.count > 5 ? { status: 'Domínio pago, a aguardar registo', href: 'filtro=activacao' } : null)
  ok(!!actItem && /a aguardar registo/.test(actItem.status) && /filtro=activacao/.test(actItem.href), 'aparece em «Encomendas pagas por activar» como «Domínio pago, a aguardar registo»')
  r = await act({ action: 'mark_active', serviceId: sm.id, externalRef: '' })
  ok(r.status === 400 && /referência/.test(r.json?.error ?? ''), 'marcar activo sem referência do registo é recusado')
  r = await c1.req('/api/admin/orders', { method: 'POST', body: { action: 'mark_active', serviceId: sm.id, externalRef: 'X-1' } })
  ok(r.status === 401, 'cliente não pode marcar o domínio como activo')
  r = await act({ action: 'mark_active', serviceId: sm.id, externalRef: 'REG-MANUAL-123' })
  sm = await svcOf(M.order.id, 'domain')
  const admId = (await one("SELECT id FROM profiles WHERE email = 'admin@ensaio.test'")).id
  ok(r.status === 200 && sm.provisioning_status === 'active' && sm.activation_source === 'manual' && sm.activated_by === admId && sm.external_ref === 'REG-MANUAL-123', 'com referência → activo, origem «manual», administrador registado')
  ok((await one('SELECT status FROM domains WHERE CONCAT(name, extension) = ?', [domM])).status === 'active', 'domínio activo só depois da marcação com referência')
  r = await act({ action: 'mark_active', serviceId: sm.id, externalRef: 'REG-OUTRA' })
  ok(r.status === 409, 'segunda marcação recusada (já activo)')

  console.log('\n5. Registrador de domínios (simulado)')
  r = await adm.req('/api/admin/integrations/registrar', { method: 'POST', body: { action: 'save', provider: 'simulado', mode: 'live', apiUrl: SIM, secret: 'x' } })
  ok(r.status === 400 && /ensaio/.test(r.json?.error ?? ''), 'simulador não pode ficar em modo de produção')
  r = await adm.req('/api/admin/integrations/registrar', { method: 'POST', body: { action: 'save', provider: 'simulado', mode: 'test', apiUrl: SIM, secret: 'chave-errada', extensions: ['.net', '.co.ao'], enabled: true } })
  ok(r.status === 400 && /Teste a ligação/.test(r.json?.error ?? ''), 'não activa sem teste de ligação bem-sucedido')
  await adm.req('/api/admin/integrations/registrar', { method: 'POST', body: { action: 'save', provider: 'simulado', mode: 'test', apiUrl: SIM, secret: 'chave-errada', extensions: ['.net', '.co.ao'] } })
  r = await adm.req('/api/admin/integrations/registrar', { method: 'POST', body: { action: 'test' } })
  ok(r.status === 200 && r.json?.ok === false, `teste com credencial errada falha: ${r.json?.message}`)
  await adm.req('/api/admin/integrations/registrar', { method: 'POST', body: { action: 'save', provider: 'simulado', mode: 'test', apiUrl: SIM, secret: SIM_TOKEN, extensions: ['.net', '.co.ao'] } })
  const statsBeforeTest = JSON.stringify(await simStats())
  r = await adm.req('/api/admin/integrations/registrar', { method: 'POST', body: { action: 'test' } })
  ok(r.json?.ok === true && JSON.stringify(await simStats()) === statsBeforeTest, `«Testar ligação» OK sem registar nada (${r.json?.message})`)
  r = await adm.req('/api/admin/integrations/registrar', { method: 'POST', body: { action: 'save', provider: 'simulado', mode: 'test', apiUrl: SIM, extensions: ['.net', '.co.ao'], enabled: true } })
  ok(r.status === 200 && r.json?.state?.settings?.enabled, 'integração activada (modo ensaio) para .net e .co.ao')
  r = await adm.req('/api/admin/integrations/registrar')
  ok(!r.text.includes(SIM_TOKEN) && !r.text.includes('enc:') && r.json?.settings?.hasSecret === true, 'a chave nunca é devolvida ao navegador (só «guardada»)')
  ok(String((await one('SELECT secret_enc FROM registrar_settings WHERE id = 1')).secret_enc).startsWith('enc:'), 'chave guardada cifrada na base')

  let q = await c1.quote([{ type: 'domain', domain: `ocupado-${rnd()}.net`, operation: 'register' }])
  ok(q.json?.quote?.lines?.[0]?.error?.code === 'domain_unavailable', 'consulta pelo registrador: domínio ocupado recusado')
  q = await c1.quote([{ type: 'domain', domain: `incerto-${rnd()}.net`, operation: 'register' }])
  ok(q.json?.quote?.lines?.[0]?.availability?.status === 'confirm', 'resposta inconclusiva do registrador → «A confirmar pela equipa» (nunca disponível)')
  const coao = `ensaio${rnd()}.co.ao`
  q = await c1.quote([{ type: 'domain', domain: coao, operation: 'register' }])
  ok(q.json?.quote?.valid && q.json.quote.lines[0].availability?.status === 'available' && !q.json.quote.needsConfirmation, `.co.ao automatizado: ${coao} disponível pelo registrador, sem retenção`)

  const regBuy = async label => { const dn = `${label}-${rnd()}.net`; const o = await buy(c1, [{ type: 'domain', domain: dn, operation: 'register' }]); if (o.order) await act({ action: 'approve', orderId: o.order.id }); return { dn, o, svc: o.order ? await svcOf(o.order.id, 'domain') : null } }
  const ok1 = await regBuy('registo')
  ok(ok1.svc?.provisioning_status === 'active' && ok1.svc.activation_source === 'registrar' && /^SIM-REGISTER-/.test(ok1.svc.external_ref ?? ''), `pago → registado pelo registrador (${ok1.svc?.external_ref})`, JSON.stringify(ok1.svc?.provisioning_error ?? ok1.o.error))
  ok((await one('SELECT status FROM domains WHERE CONCAT(name, extension) = ?', [ok1.dn])).status === 'active', 'domínio activo após confirmação do registrador')
  await act({ action: 'approve', orderId: ok1.o.order.id })
  await act({ action: 'provision', serviceId: ok1.svc.id })
  ok((await simStats())[ok1.dn] === 1, 'repetir aprovação/activação não regista segunda vez')

  const slow = await regBuy('lento')
  ok(slow.svc?.provisioning_status === 'manual_required' && /não respondeu a tempo/.test(slow.svc.provisioning_error ?? ''), 'timeout → inconclusivo, sem activar', slow.svc?.provisioning_error)
  ok((await one('SELECT status FROM registrar_operations WHERE service_id = ?', [slow.svc.id])).status === 'unknown', 'operação guardada como «unknown»')
  await sleep(2500)
  r = await act({ action: 'provision', serviceId: slow.svc.id })
  const slowAfter = await svcOf(slow.o.order.id, 'domain')
  ok(slowAfter.provisioning_status === 'active' && (await simStats())[slow.dn] === 1, 'repetir consulta o estado → confirmado, sem segundo registo')

  const lost = await regBuy('perdido')
  ok(lost.svc?.provisioning_status === 'manual_required', 'pedido perdido (timeout) não activa')
  await sleep(2500)
  await act({ action: 'provision', serviceId: lost.svc.id })
  ok((await svcOf(lost.o.order.id, 'domain')).provisioning_status === 'active' && (await simStats())[lost.dn] === 1, 'fornecedor não tinha o pedido → novo pedido seguro, registado uma vez')

  const amb = await regBuy('ambiguo')
  await sleep(2500)
  await act({ action: 'provision', serviceId: amb.svc.id })
  const ambAfter = await svcOf(amb.o.order.id, 'domain')
  ok(ambAfter.provisioning_status === 'manual_required' && /inconclusivo/i.test(ambAfter.provisioning_error ?? '') && (await simStats())[amb.dn] === 1, 'estado inconclusivo na consulta → intervenção manual, sem novo pedido')

  const pend = await regBuy('pendente')
  ok(pend.svc?.provisioning_status === 'manual_required' && /aguardar confirmação/.test(pend.svc.provisioning_error ?? ''), 'registo aceite mas pendente → não activo')
  await act({ action: 'provision', serviceId: pend.svc.id })
  ok((await svcOf(pend.o.order.id, 'domain')).provisioning_status === 'active', 'consulta seguinte confirma → activo')

  const ref = await regBuy('recusa')
  ok(ref.svc?.provisioning_status === 'failed' && /Recusado pelo registrador/.test(ref.svc.provisioning_error ?? ''), 'registo recusado → «falhou» com motivo')

  // Renovação de um domínio registado pelo registrador
  q = await c1.quote([{ type: 'domain', domain: ok1.dn, operation: 'renew' }])
  if (q.json?.quote?.valid) {
    const rn = (await c1.order([{ type: 'domain', domain: ok1.dn, operation: 'renew' }], q.json.quote.total)).json?.order
    await act({ action: 'approve', orderId: rn.id })
    const rs = await one('SELECT provisioning_status, activation_source, external_ref FROM services WHERE order_id = ?', [rn.id])
    ok(rs.provisioning_status === 'active' && rs.activation_source === 'registrar' && /^SIM-RENEW-/.test(rs.external_ref ?? ''), `renovação confirmada pelo registrador (${rs.external_ref})`)
  } else ok(false, 'renovação do domínio cotada', JSON.stringify(q.json?.quote?.lines?.[0]?.error))

  const logText = process.env.APP_LOG ? (await import('node:fs')).readFileSync(process.env.APP_LOG, 'utf8') : ''
  if (process.env.APP_LOG) ok(!logText.includes(SIM_TOKEN) && !logText.includes('chave-errada'), 'chave do registrador não aparece nos logs da aplicação')

  console.log('\n6. WHM/cPanel (simulado)')
  r = await adm.req('/api/admin/integrations/whm')
  const primary = r.json?.servers?.find(s => s.primary)
  ok(r.status === 200 && primary?.hasToken && primary.tokenEncrypted && !r.text.includes('token-de-ensaio') && !r.text.includes('enc:'), 'estado: servidor e token cifrado, sem expor o token')
  r = await adm.req('/api/admin/integrations/whm', { method: 'POST', body: { action: 'test' } })
  const names = (r.json?.packages ?? []).map(x => x.name)
  ok(r.json?.ok && names.includes('start') && names.includes('email5'), `«Testar ligação» só leitura: ${r.json?.message} (${names.join(', ')})`)
  const turbo = await one("SELECT id FROM products WHERE slug = 'hosting-turbo'")
  r = await adm.req('/api/admin/integrations/whm', { method: 'POST', body: { action: 'map', productId: turbo.id, provisioning: 'whm', whmPackage: 'nao-existe' } })
  ok(r.status === 400 && /não existe/.test(r.json?.error ?? ''), 'pacote inexistente no WHM é recusado')
  r = await adm.req('/api/admin/integrations/whm', { method: 'POST', body: { action: 'map', productId: turbo.id, provisioning: 'whm', whmPackage: 'business' } })
  ok(r.status === 200 && (await one('SELECT whm_package FROM products WHERE id = ?', [turbo.id])).whm_package === 'business', 'plano hosting-turbo associado ao pacote «business»')
  // Falha transitória → repetir sem criar segunda conta
  const domR = `retentar-${rnd()}.com`
  const R = await buy(c1, [{ type: 'product', slug: 'hosting-turbo', cycle: 'monthly', domain: domR, domainMode: 'existing' }])
  await act({ action: 'approve', orderId: R.order.id })
  let sr = await svcOf(R.order.id, 'hosting')
  ok(sr.provisioning_status === 'failed' && /Falha na activação/.test(sr.provisioning_error ?? ''), `falha do WHM registada com motivo: ${sr.provisioning_error}`)
  p = await pending()
  ok(p.cats.activations.items.some(i => i.status === 'Activação falhada') || p.cats.activations.count > 5, 'falha aparece em «Encomendas pagas por activar»')
  await act({ action: 'provision', serviceId: sr.id })
  await act({ action: 'provision', serviceId: sr.id })
  sr = await svcOf(R.order.id, 'hosting')
  const accs = Number((await one('SELECT COUNT(*) n FROM hosting_accounts WHERE service_id = ?', [sr.id])).n)
  ok(sr.provisioning_status === 'active' && sr.activation_source === 'whm' && accs === 1, `repetir → activo (cPanel ${sr.external_ref}), uma única conta`)
  // Acesso só ao próprio cPanel (SSO pelo mecanismo único de credenciais)
  r = await c2.req(`/api/client/hosting/${sr.id}/cpanel-sso`, { method: 'POST' })
  ok(r.status === 404, 'outro cliente não abre este cPanel (404)')
  r = await c1.req(`/api/client/hosting/${sr.id}/cpanel-sso`, { method: 'POST' })
  ok(r.status === 200 && /cpsess/.test(r.json?.redirectUrl ?? ''), 'o dono abre o seu cPanel (token decifrado no servidor)')
  r = await c1.req(`/api/client/hosting/${sr.id}/webmail-sso`, { method: 'POST' })
  ok(r.status === 200 && !!r.json?.redirectUrl, 'o dono abre o seu Webmail')
  // Importação: pré-visualização sem gravar
  const before = Number((await one('SELECT COUNT(*) n FROM whm_accounts')).n)
  r = await adm.req('/api/admin/whm/import')
  const plan = r.json?.plan
  ok(r.status === 200 && plan?.found >= 4 && Array.isArray(plan.conflicts) && Number((await one('SELECT COUNT(*) n FROM whm_accounts')).n) === before, `pré-visualização: ${plan?.found} contas, ${plan?.new} novas, ${plan?.pendingValidation} candidatas, ${plan?.conflicts?.length} conflito(s) — nada gravado`)
  ok(plan?.items?.every(i => i.link !== 'linked' || i.linkedProfile) && !plan?.items?.some(i => i.candidateProfile && i.link === 'linked' && !i.linkedProfile), 'e-mail coincidente só gera candidato (sem associação automática)')
  r = await adm.req('/api/admin/whm/sync', { method: 'POST' })
  r = await adm.req('/api/whm/accounts')
  ok(r.status === 200 && r.json?.servers?.some(s => s.accounts?.length > 0) && !r.text.includes('token-de-ensaio'), 'lista de contas WHM pelo mecanismo único (token decifrado no servidor)')

  console.log('\n7. Pedidos de cotação e tickets por responder')
  const qr = await anon.req('/api/quotes', { method: 'POST', body: { name: 'Teste Painel', email: 'painel@ensaio.test', product: 'ded-16', message: 'ensaio' } })
  p = await pending()
  ok(qr.json?.reference && (p.cats.quotes.items.some(i => i.ref === qr.json.reference) || p.cats.quotes.count > 5), `cotação ${qr.json?.reference} aparece por responder`)
  const qi = p.cats.quotes.items.find(i => i.ref === qr.json?.reference)
  ok(!qi || /\/admin\/quotes\?estado=new&ref=/.test(qi.href), 'ligação leva à cotação filtrada')
  const tk = await c1.req('/api/client/support/tickets', { method: 'POST', body: { subject: `Ticket painel ${rnd()}`, description: 'Preciso de ajuda (ensaio)', category: 'technical', priority: 'medium' } })
  p = await pending()
  const tkId = tk.json?.ticket?.id ?? tk.json?.id
  ok(tk.status < 300 && (p.cats.tickets.items.some(i => i.id === tkId) || p.cats.tickets.count > 5), `ticket novo do cliente aparece por responder (${p.cats.tickets.count})`, tk.text.slice(0, 200))
  if (tkId) {
    await adm.req(`/api/admin/support/tickets/${tkId}/messages`, { method: 'POST', body: { message: 'Resposta da equipa (ensaio)', is_internal: false } })
    const p2 = await pending()
    ok(!p2.cats.tickets.items.some(i => i.id === tkId), 'depois da resposta da equipa sai da lista')
  }
  ok(Object.values(p.cats).every(c => typeof c.count === 'number' && !c.error), 'todas as categorias carregadas (sem «falha ao carregar»)')
} finally {
  // Repor integrações como estavam
  if (regBefore) await db.query('UPDATE registrar_settings SET provider = ?, mode = ?, enabled = ?, api_url = ?, username = ?, secret_enc = ?, extensions = ? WHERE id = 1', [regBefore.provider, regBefore.mode, regBefore.enabled, regBefore.api_url, regBefore.username, regBefore.secret_enc, typeof regBefore.extensions === 'string' ? regBefore.extensions : JSON.stringify(regBefore.extensions ?? [])])
  else await db.query('DELETE FROM registrar_settings WHERE id = 1')
  for (const pr of prodBefore) await db.query('UPDATE products SET provisioning = ?, whm_package = ?, whm_server_id = ? WHERE id = ?', [pr.provisioning, pr.whm_package, pr.whm_server_id, pr.id])
  await db.end()
}
console.log(`\n${pass} passaram, ${fail} falharam`)
process.exit(fail ? 1 : 0)
