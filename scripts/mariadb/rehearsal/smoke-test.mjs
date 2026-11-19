#!/usr/bin/env node
/**
 * Teste de fumo da ViralizaHost sobre MariaDB (ensaio ou staging).
 *   BASE_URL=http://localhost:3000 node scripts/mariadb/rehearsal/smoke-test.mjs
 * Usa as contas fictícias de seed-source.sql (definir ADMIN_EMAIL/ADMIN_PASSWORD,
 * CLIENT_EMAIL/CLIENT_PASSWORD, CLIENT2_EMAIL/CLIENT2_PASSWORD para outro ambiente).
 * Não imprime dados pessoais — só verificações e contagens.
 */
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const ADMIN = [process.env.ADMIN_EMAIL || 'admin@ensaio.test', process.env.ADMIN_PASSWORD || 'Admin#Teste2026']
const C1 = [process.env.CLIENT_EMAIL || 'cliente1@ensaio.test', process.env.CLIENT_PASSWORD || 'Cliente#Um2026']
const C2 = [process.env.CLIENT2_EMAIL || 'cliente2@ensaio.test', process.env.CLIENT2_PASSWORD || 'Cliente#Dois2026']
const WRITE_TESTS = process.env.SMOKE_WRITE !== 'false'

let pass = 0, failed = 0
const ok = (cond, name, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { failed++; console.log(`  ✗ ${name} ${extra}`) }
}

class Session {
  constructor() { this.cookie = '' }
  async req(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const res = await fetch(BASE + path, {
      method, redirect: 'manual',
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    })
    const set = res.headers.getSetCookie?.() ?? []
    for (const c of set) {
      const [kv] = c.split(';')
      const [k, v] = kv.split('=')
      if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : ''
    }
    if (raw) return res
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text, location: res.headers.get('location') }
  }
  db(q) { return this.req('/api/db', { method: 'POST', body: { conditions: [], order: [], ...q } }) }
  login([email, password]) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}

console.log(`ViralizaHost smoke test → ${BASE}`)

console.log('\n1. Site público')
const anon = new Session()
for (const p of ['/', '/dominios', '/dominios/precos', '/hospedagem-de-sites', '/email-corporativo', '/servidor-vps', '/sitemap.xml']) {
  const r = await anon.req(p)
  ok(r.status === 200, `GET ${p} → 200`, `(${r.status})`)
}
const home = await anon.req('/')
ok(!/supabase\.co/.test(home.text), 'página inicial sem URLs do Supabase')
const domains = await anon.db({ table: 'site_domains', op: 'select', select: '*', conditions: [{ column: 'active', op: 'eq', value: true }], order: [{ column: 'position', ascending: true }] })
ok(domains.status === 200 && Array.isArray(domains.json?.data), 'anon lê site_domains activos', JSON.stringify(domains.json?.error))
const products = await anon.db({ table: 'products', op: 'select', select: '*, product_features(feature, included, position)', conditions: [{ column: 'category', op: 'eq', value: 'hosting' }] })
ok(products.status === 200 && (products.json?.data ?? []).every(p => Array.isArray(p.product_features)), 'anon lê produtos com features (embed)')

console.log('\n2. Restrições de acesso (ex-RLS) para visitantes')
const anonProfiles = await anon.db({ table: 'profiles', op: 'select', select: 'id' })
ok(anonProfiles.json?.data?.length === 0, 'anon não vê perfis')
const anonInvoices = await anon.db({ table: 'invoices', op: 'select', select: 'id' })
ok(anonInvoices.json?.data?.length === 0, 'anon não vê facturas')
const anonWrite = await anon.db({ table: 'site_domains', op: 'insert', values: { extension: '.hack', price_monthly: 1 } })
ok(anonWrite.json?.error?.code === '42501', 'anon não escreve em site_domains', JSON.stringify(anonWrite.json?.error))
const anonAuth = await anon.db({ table: 'auth_users', op: 'select', select: '*' })
ok(!!anonAuth.json?.error, 'tabelas de autenticação inacessíveis via /api/db')
const r1 = await anon.req('/dashboard')
ok(r1.status === 307 && /\/login/.test(r1.location ?? ''), '/dashboard sem sessão → /login')
const rpcTry = await anon.req('/api/client/billing/summary')
ok(rpcTry.status === 401 || rpcTry.status === 403, `API do cliente sem sessão → ${rpcTry.status}`)

console.log('\n3. Login')
const bad = await new Session().login([C1[0], 'senha-errada'])
ok(bad.json?.error?.message === 'Invalid login credentials', 'senha errada → "Invalid login credentials"')
const c1 = new Session()
const l1 = await c1.login(C1)
ok(l1.status === 200 && !!c1.cookie, 'cliente inicia sessão com a senha antiga (hash bcrypt migrado)', JSON.stringify(l1.json?.error))
const c2 = new Session()
ok((await c2.login(C2)).status === 200, 'segundo cliente inicia sessão')
const adm = new Session()
ok((await adm.login(ADMIN)).status === 200, 'admin inicia sessão')
const me = await c1.req('/api/auth/user')
ok(me.json?.user?.email === C1[0], 'GET /api/auth/user devolve o utilizador da sessão')
ok((await c1.req('/dashboard')).status === 200, 'cliente abre /dashboard')
ok((await c1.req('/login')).status === 307, 'cliente com sessão em /login → redireccionado')

console.log('\n4. Isolamento entre clientes')
const myId = me.json?.user?.id
const inv1 = await c1.db({ table: 'invoices', op: 'select', select: 'id, profile_id' })
ok((inv1.json?.data ?? []).length > 0 && inv1.json.data.every(i => i.profile_id === myId), 'cliente 1 só vê as suas facturas')
const prof = await c1.db({ table: 'profiles', op: 'select', select: 'id, role' })
ok(prof.json?.data?.length === 1 && prof.json.data[0].id === myId, 'cliente 1 só vê o seu perfil')
const other = await c2.req('/api/auth/user')
const steal = await c1.db({ table: 'invoices', op: 'select', select: 'id', conditions: [{ column: 'profile_id', op: 'eq', value: other.json?.user?.id }] })
ok(steal.json?.data?.length === 0, 'cliente 1 não lê facturas do cliente 2 mesmo filtrando pelo id')
const escalate = await c1.db({ table: 'profiles', op: 'update', values: { role: 'admin' }, conditions: [{ column: 'id', op: 'eq', value: other.json?.user?.id }], returning: true, select: 'id' })
ok((escalate.json?.data ?? []).length === 0, 'cliente 1 não altera o perfil do cliente 2')
const sum = await c1.req('/api/client/billing/summary')
ok(sum.status === 200, 'resumo financeiro do cliente (RPC portada)', sum.text.slice(0, 120))
const list = await c1.req('/api/client/billing/invoices')
ok(list.status === 200, 'lista de facturas do cliente (RPC portada)', list.text.slice(0, 120))
const adminApiAsClient = await c1.req('/api/admin/clients')
ok(adminApiAsClient.status === 401 || adminApiAsClient.status === 403, `cliente bloqueado na API admin (${adminApiAsClient.status})`)
const siteWriteClient = await c1.db({ table: 'site_team', op: 'update', values: { bio: 'x' }, conditions: [], returning: true, select: 'id' })
ok((siteWriteClient.json?.data ?? []).length === 0, 'cliente não edita a Gestão do Site (antes era permitido a qualquer autenticado)')

console.log('\n5. Administração')
ok((await adm.req('/admin')).status === 200, 'admin abre /admin')
for (const p of ['/admin/site', '/admin/site/domains', '/admin/site/team', '/admin/site/banners', '/admin/site/hero', '/admin/clients', '/admin/financial', '/admin/orders', '/admin/tickets']) {
  const r = await adm.req(p)
  ok(r.status === 200, `admin GET ${p}`, `(${r.status})`)
}
const clients = await adm.req('/api/admin/clients')
ok(clients.status === 200, 'API admin de clientes', clients.text.slice(0, 120))
const allInv = await adm.db({ table: 'invoices', op: 'select', select: 'id', conditions: [] })
ok((allInv.json?.data ?? []).length >= 2, 'admin vê facturas de todos os clientes')
const seedStatus = await adm.req('/api/admin/seed-site')
ok(seedStatus.status === 200, 'estado da Gestão do Site (seed-site GET)', seedStatus.text.slice(0, 160))
const hero = await adm.req('/api/admin/home-hero')
ok(hero.status === 200, 'definições do topo da página inicial', hero.text.slice(0, 120))

if (WRITE_TESTS) {
  console.log('\n6. Edição no painel → site público')
  const before = await anon.db({ table: 'site_domains', op: 'select', select: 'id, price_annual', conditions: [{ column: 'extension', op: 'eq', value: '.ao' }], single: 'maybe' })
  const d = before.json?.data
  if (d) {
    const upd = await adm.db({ table: 'site_domains', op: 'update', values: { price_annual: 26000.5 }, conditions: [{ column: 'id', op: 'eq', value: d.id }], returning: true, select: 'price_annual', single: 'single' })
    ok(upd.json?.data?.price_annual === 26000.5, 'admin actualiza preço de domínio (.ao)', JSON.stringify(upd.json?.error))
    const after = await anon.db({ table: 'site_domains', op: 'select', select: 'price_annual', conditions: [{ column: 'id', op: 'eq', value: d.id }], single: 'single' })
    ok(after.json?.data?.price_annual === 26000.5, 'visitante vê o novo preço')
    await adm.db({ table: 'site_domains', op: 'update', values: { price_annual: d.price_annual }, conditions: [{ column: 'id', op: 'eq', value: d.id }] })
  } else ok(true, 'sem domínio .ao para testar edição (ignorado)')

  console.log('\n7. Tickets e encomendas')
  const t = await c1.req('/api/client/support/tickets', { method: 'POST', body: { subject: 'Teste de fumo — ção', description: 'Mensagem com acentuação: ã é ü 🚀', category: 'technical', priority: 'low' } })
  ok(t.status === 200 || t.status === 201, 'cliente abre ticket', t.text.slice(0, 160))
  const tn = t.json?.ticket?.ticket_number ?? t.json?.data?.ticket_number ?? t.json?.ticket_number
  ok(!tn || /^VH-TKT-\d{4}-\d{6}$/.test(tn), `número do ticket gerado (${tn ?? 'não devolvido'})`)
  const order = await c1.req('/api/checkout/orders', { method: 'POST', body: {
    items: [{ id: 'hosting-start', name: 'Plano Start', type: 'hosting', price: 19900, quantity: 1 }],
    billingCycle: 'monthly', domainName: '', paymentMethod: 'bank_transfer', amount: 19900, userData: {},
  } })
  ok(order.status === 200 || order.status === 201, 'checkout cria encomenda (RPC create_order)', order.text.slice(0, 200))
  const orderId = order.json?.id ?? order.json?.order?.id ?? order.json?.orderId
  if (orderId) {
    const ap = await adm.req('/api/admin/orders', { method: 'POST', body: { orderId, action: 'approve' } })
    ok(ap.status === 200, 'admin aprova encomenda (RPC approve_order)', ap.text.slice(0, 160))
    const invs = await c1.db({ table: 'invoices', op: 'select', select: 'status, amount_paid, total', conditions: [{ column: 'order_id', op: 'eq', value: orderId }], single: 'single' })
    ok(invs.json?.data?.status === 'paid' && invs.json?.data?.amount_paid === invs.json?.data?.total, 'factura da encomenda fica paga')
  }

  console.log('\n8. Ficheiros')
  const fd = new FormData()
  fd.append('bucket', 'payment-proofs'); fd.append('path', `smoke/${Date.now()}_teste.pdf`)
  fd.append('file', new Blob([Buffer.from('%PDF-1.4 smoke')], { type: 'application/pdf' }), 'teste.pdf')
  const up = await anon.req('/api/storage/upload', { method: 'POST', body: fd })
  ok(up.status === 200 && up.json?.data?.path, 'visitante envia comprovativo (payment-proofs)', up.text.slice(0, 120))
  const fd2 = new FormData()
  fd2.append('bucket', 'site-banners'); fd2.append('path', 'smoke/x.png'); fd2.append('file', new Blob([Buffer.from('x')], { type: 'image/png' }))
  ok((await anon.req('/api/storage/upload', { method: 'POST', body: fd2 })).status === 403, 'visitante não envia para site-banners')
}

const vid = (home.text.match(/\/storage\/v1\/object\/public\/site-videos\/[^"\\]+\.mp4/) ?? [])[0]
if (vid) {
  const rr = await anon.req(vid, { raw: true, headers: { range: 'bytes=0-99' } })
  ok(rr.status === 206 && rr.headers.get('content-range')?.startsWith('bytes 0-99/'), 'vídeo do topo servido com Range (206)')
}
const priv = await anon.req('/storage/v1/object/sign/payment-proofs/2026/02/x.pdf?token=falso', { raw: true })
ok(priv.status === 400, 'URL assinado inválido rejeitado')

console.log('\n9. Fim de sessão')
await c1.req('/api/auth/logout', { method: 'POST' })
const afterLogout = await c1.req('/api/auth/user')
ok(!afterLogout.json?.user, 'logout invalida a sessão')

console.log(`\n${pass} verificações OK, ${failed} falhadas`)
process.exit(failed ? 1 : 0)
