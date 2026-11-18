#!/usr/bin/env node
/**
 * Testes de fumo HTTP contra uma instância a correr (base de TESTE).
 *   BASE_URL=http://localhost:3100 \
 *   CLIENT_EMAIL=... CLIENT_PASSWORD=... OTHER_CLIENT_EMAIL=... OTHER_CLIENT_PASSWORD=... \
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/mariadb/smoke-test.mjs
 * Cria registos de teste (ticket, encomenda de convidado). Não usar contra produção.
 */
const BASE = process.env.BASE_URL || 'http://localhost:3100'
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? '✔' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`) }

class Session {
  constructor() { this.cookie = '' }
  async req(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const h = { ...headers }
    if (this.cookie) h.cookie = this.cookie
    if (body !== undefined && !(body instanceof Blob) && !(body instanceof FormData)) { h['content-type'] = 'application/json'; body = JSON.stringify(body) }
    const res = await fetch(BASE + path, { method, body, headers: h, redirect: 'manual' })
    const set = res.headers.getSetCookie?.() ?? []
    for (const c of set) { const [kv] = c.split(';'); const [k, v] = kv.split('='); if (k === 'vh_session') this.cookie = v ? `vh_session=${v}` : '' }
    if (raw) return res
    const text = await res.text()
    try { return { status: res.status, json: JSON.parse(text) } } catch { return { status: res.status, text } }
  }
  db(q) { return this.req('/api/db', { method: 'POST', body: { q: { filters: [], orders: [], ...q } } }).then((r) => r.json) }
  login(email, password) { return this.req('/api/auth/login', { method: 'POST', body: { email, password } }) }
}

const C = { email: process.env.CLIENT_EMAIL, pw: process.env.CLIENT_PASSWORD }
const O = { email: process.env.OTHER_CLIENT_EMAIL, pw: process.env.OTHER_CLIENT_PASSWORD }
const A = { email: process.env.ADMIN_EMAIL, pw: process.env.ADMIN_PASSWORD }

const anon = new Session(), cli = new Session(), other = new Session(), adm = new Session()

// ── Autenticação ────────────────────────────────────────────────────────────
ok((await cli.login(C.email, 'errada')).json.error?.message === 'Invalid login credentials', 'login com palavra-passe errada é recusado')
const lr = await cli.login(C.email, C.pw)
ok(!lr.json.error && cli.cookie, 'login do cliente com a palavra-passe migrada (hash bcrypt do Supabase)')
await other.login(O.email, O.pw)
await adm.login(A.email, A.pw)
ok(!!adm.cookie, 'login do admin')
const me = (await cli.req('/api/auth/user')).json
ok(me.data?.user?.email === C.email, 'auth.getUser() devolve o utilizador da sessão')
ok((await anon.req('/api/auth/user')).json.data?.user === null, 'sem sessão → user null')
ok((await anon.req('/dashboard', { raw: true })).status === 307, 'proxy redireciona /dashboard sem sessão')
ok((await cli.req('/dashboard', { raw: true })).status === 200, '/dashboard com sessão → 200')
ok((await cli.req('/admin', { raw: true })).status !== 500, '/admin como cliente não rebenta')

// ── Regras de acesso (RLS) ──────────────────────────────────────────────────
const myId = me.data.user.id
const profs = await cli.db({ table: 'profiles', op: 'select', select: 'id,email,role' })
ok(profs.data?.length === 1 && profs.data[0].id === myId, 'cliente só vê o próprio perfil', `${profs.data?.length} linha(s)`)
const allProfs = await adm.db({ table: 'profiles', op: 'select', select: 'id' })
ok(allProfs.data?.length >= 3, 'admin vê todos os perfis', `${allProfs.data?.length}`)
const otherId = (await other.req('/api/auth/user')).json.data.user.id
const upOther = await cli.db({ table: 'profiles', op: 'update', values: { full_name: 'HACK' }, returning: true, select: 'id', filters: [{ kind: 'op', column: 'id', op: 'eq', value: otherId }] })
ok(Array.isArray(upOther.data) && upOther.data.length === 0, 'cliente não altera o perfil de outro cliente')
const esc = await cli.db({ table: 'profiles', op: 'update', values: { role: 'admin' }, filters: [{ kind: 'op', column: 'id', op: 'eq', value: myId }] })
ok(esc.error?.code === '42501', 'cliente não consegue promover-se a admin', esc.error?.code)
const upOwn = await cli.db({ table: 'profiles', op: 'update', values: { phone: '+244 900 000 000' }, returning: true, select: 'phone', filters: [{ kind: 'op', column: 'id', op: 'eq', value: myId }], single: 'one' })
ok(upOwn.data?.phone === '+244 900 000 000', 'cliente altera o próprio perfil')
const inv = await cli.db({ table: 'invoices', op: 'select', select: 'id, profile_id, total' })
ok(inv.data?.length > 0 && inv.data.every((i) => i.profile_id === myId), 'faturas: só as do cliente', `${inv.data?.length}`)
const invOther = await other.db({ table: 'invoices', op: 'select', select: 'id', filters: [{ kind: 'op', column: 'id', op: 'in', value: inv.data.map((i) => i.id) }] })
ok(invOther.data?.length === 0, 'outro cliente não vê essas faturas')
const ords = await other.db({ table: 'orders', op: 'select', select: 'id,user_id' })
ok(ords.data.every((o) => o.user_id === otherId), 'encomendas: só as próprias')
const items = await other.db({ table: 'order_items', op: 'select', select: 'order_id' })
ok(items.data.every((i) => ords.data.some((o) => o.id === i.order_id)), 'itens de encomenda: só das próprias encomendas')
const pays = await other.db({ table: 'payments', op: 'select', select: 'id' })
ok(pays.data?.length === 0, 'pagamentos: outro cliente não vê os do primeiro')
const tks = await cli.db({ table: 'tickets', op: 'select', select: 'id, profile_id, ticket_messages(id, is_internal)' })
ok(tks.data.every((t) => t.profile_id === myId), 'tickets: só os próprios')
ok(tks.data.every((t) => t.ticket_messages.every((m) => !m.is_internal)), 'mensagens internas de staff ficam ocultas ao cliente')
const otherTicket = await other.db({ table: 'tickets', op: 'select', select: 'id' })
const injMsg = await cli.db({ table: 'ticket_messages', op: 'insert', values: { ticket_id: otherTicket.data[0]?.id, profile_id: myId, message: 'x' } })
ok(injMsg.error?.code === '42501', 'cliente não escreve em tickets de outro cliente', injMsg.error?.code)
const fakeTicket = await cli.db({ table: 'tickets', op: 'insert', values: { profile_id: otherId, subject: 'x' } })
ok(fakeTicket.error?.code === '42501', 'cliente não cria tickets em nome de outro')
ok((await anon.db({ table: 'profiles', op: 'select', select: 'id' })).data?.length === 0, 'anónimo não vê perfis')
const sd = await anon.db({ table: 'site_domains', op: 'select', select: 'extension, active' })
ok(sd.data.length > 0 && sd.data.every((d) => d.active), 'site_domains: anónimo só vê ativos')
const banW = await cli.db({ table: 'site_banners', op: 'update', values: { title: 'HACK' }, filters: [{ kind: 'op', column: 'position', op: 'gte', value: 0 }], returning: true, select: 'id' })
ok(banW.data?.length === 0, 'cliente não altera banners do site (era permitido no Supabase)')
ok((await anon.db({ table: 'auth_users', op: 'select', select: 'id' })).error, 'auth_users inacessível pelo browser')
ok((await cli.db({ table: 'servers', op: 'select', select: 'id' })).data?.length === 0, 'servidores só para admin')

// ── Funcionalidades do portal do cliente ────────────────────────────────────
const bi = await cli.req('/api/client/billing/invoices')
ok(bi.status === 200 && (bi.json.invoices ?? bi.json.data?.invoices ?? bi.json)?.length !== undefined, 'GET /api/client/billing/invoices (RPC get_client_invoices)', `HTTP ${bi.status}`)
const bs = await cli.req('/api/client/billing/summary')
ok(bs.status === 200, 'GET /api/client/billing/summary (RPC get_client_financial_summary)', JSON.stringify(bs.json).slice(0, 140))
const invId = inv.data[0].id
const one = await cli.req(`/api/client/billing/invoices/${invId}`)
ok(one.status === 200, 'detalhe da própria fatura')
ok((await other.req(`/api/client/billing/invoices/${invId}`)).status >= 400, 'detalhe da fatura de outro cliente é recusado')
const pdf = await cli.req(`/api/client/billing/invoices/${invId}/pdf`, { raw: true })
ok(pdf.status === 200 && (pdf.headers.get('content-type') ?? '').includes('pdf'), 'PDF da fatura', `HTTP ${pdf.status}`)
const tkl = await cli.req('/api/client/support/tickets')
ok(tkl.status === 200, 'lista de tickets do cliente', `HTTP ${tkl.status}`)
const nt = await cli.req('/api/client/support/tickets', { method: 'POST', body: { subject: 'Teste migração — ç ã é', description: 'Mensagem com acentuação: ação, coração', priority: 'medium', category: 'technical' } })
const ntId = nt.json?.ticket?.id ?? nt.json?.id ?? nt.json?.data?.id
ok(nt.status < 300 && ntId, 'criar ticket', `HTTP ${nt.status} ${JSON.stringify(nt.json).slice(0, 160)}`)
if (ntId) {
  const tn = await cli.db({ table: 'tickets', op: 'select', select: 'ticket_number, subject', filters: [{ kind: 'op', column: 'id', op: 'eq', value: ntId }], single: 'one' })
  ok(/^VH-TKT-\d{4}-\d{6}$/.test(tn.data?.ticket_number ?? ''), 'número de ticket gerado (porta do trigger)', tn.data?.ticket_number)
  ok(tn.data?.subject === 'Teste migração — ç ã é', 'acentos preservados no ticket')
  const rep = await cli.req(`/api/client/support/tickets/${ntId}/messages`, { method: 'POST', body: { message: 'Resposta do cliente' } })
  ok(rep.status < 300, 'responder ao ticket', `HTTP ${rep.status}`)
  const arep = await adm.req(`/api/admin/support/tickets/${ntId}/messages`, { method: 'POST', body: { message: 'Resposta do suporte', is_internal: false } })
  ok(arep.status < 300, 'admin responde ao ticket', `HTTP ${arep.status}`)
}

// ── Painel administrativo ───────────────────────────────────────────────────
for (const p of ['/api/admin/orders', '/api/admin/clients', '/api/admin/financial/summary', '/api/admin/products', '/api/admin/support/tickets', '/api/admin/billing-settings', '/api/admin/home-hero', '/api/admin/whm/accounts', '/api/admin/banner-pages']) {
  const r = await adm.req(p)
  ok(r.status === 200, `admin GET ${p}`, `HTTP ${r.status}${r.status !== 200 ? ' ' + JSON.stringify(r.json ?? r.text).slice(0, 160) : ''}`)
  if (p === '/api/admin/orders' && r.json?.orders?.[0]?.proof_url) {
    const signed = await anon.req(r.json.orders.find((o) => o.proof_url).proof_url.replace(/^https?:\/\/[^/]+/, ''), { raw: true })
    ok(signed.status === 200, 'URL assinado do comprovativo (bucket privado) abre', `HTTP ${signed.status}`)
  }
}
ok((await cli.req('/api/admin/orders')).status === 401, 'cliente não acede a /api/admin/orders')
for (const p of ['/admin', '/admin/clients', '/admin/orders', '/admin/financial', '/admin/tickets', '/admin/site/hero', '/admin/email-logs', '/admin/servers/whm-accounts', '/admin/activity']) {
  const r = await adm.req(p, { raw: true })
  ok(r.status === 200, `página ${p}`, `HTTP ${r.status}`)
}
for (const p of ['/dashboard', '/billing', '/tickets', '/hosting', '/domains', '/email', '/settings', `/billing/invoices/${invId}`]) {
  const r = await cli.req(p, { raw: true })
  ok(r.status === 200, `portal ${p}`, `HTTP ${r.status}`)
}

// ── Topo da página inicial: troca Vídeo ⇄ Carrossel ─────────────────────────
const toCarousel = await adm.req('/api/admin/home-hero', { method: 'PUT', body: { mode: 'carousel' } })
ok(toCarousel.status === 200, 'admin muda o topo para Carrossel', `HTTP ${toCarousel.status} ${JSON.stringify(toCarousel.json).slice(0, 120)}`)
let home = await anon.req('/')
ok(!/<video[^>]+home-hero/.test(home.text), 'página inicial mostra o carrossel')
const toVideo = await adm.req('/api/admin/home-hero', { method: 'PUT', body: { mode: 'video', video: { source: 'url', url: '/videos/hero.mp4' } } })
ok(toVideo.status === 200, 'admin muda o topo para Vídeo (URL)', `HTTP ${toVideo.status} ${JSON.stringify(toVideo.json).slice(0, 120)}`)
home = await anon.req('/')
ok(/<video[^>]+\/videos\/hero\.mp4/.test(home.text), 'página inicial mostra o vídeo')
// envio do MP4 por URL assinado (como o painel)
const mp4 = new Blob([new Uint8Array(2048).fill(7)], { type: 'video/mp4' })
const up = await adm.req('/api/admin/home-hero/upload-url', { method: 'POST', body: { fileName: 'Vídeo Teste.mp4', size: mp4.size, contentType: 'video/mp4' } })
ok(up.status === 200 && up.json.signedUrl, 'URL assinado para envio do vídeo', `HTTP ${up.status}`)
if (up.json.signedUrl) {
  const fd = new FormData(); fd.append('cacheControl', '31536000'); fd.append('', mp4, 'v.mp4')
  const put = await fetch(up.json.signedUrl.replace(/^https?:\/\/[^/]+/, BASE), { method: 'PUT', body: fd, headers: { 'x-upsert': 'false' } })
  ok(put.ok, 'envio do MP4 para o URL assinado', `HTTP ${put.status}`)
  const save = await adm.req('/api/admin/home-hero', { method: 'PUT', body: { mode: 'video', video: { source: 'storage', storagePath: up.json.path, fileName: 'Vídeo Teste.mp4', sizeBytes: mp4.size } } })
  ok(save.status === 200, 'gravar vídeo enviado', `HTTP ${save.status} ${JSON.stringify(save.json).slice(0, 160)}`)
  const vurl = save.json?.settings?.video_url ?? save.json?.video_url
  if (vurl) {
    const rg = await anon.req(vurl.replace(/^https?:\/\/[^/]+/, ''), { raw: true, headers: { range: 'bytes=0-99' } })
    ok(rg.status === 206 && rg.headers.get('content-range') === `bytes 0-99/${mp4.size}`, 'vídeo servido com Range (206)', `HTTP ${rg.status} ${rg.headers.get('content-range')}`)
  }
}

// ── Uploads privados (comprovativo) ─────────────────────────────────────────
const proof = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], { type: 'image/png' })
const path = `${myId}/teste-${Date.now()}.png`
const upl = await cli.req(`/storage/v1/object/payment-proofs/${path}`, { method: 'POST', body: proof, headers: { 'content-type': 'image/png' } })
ok(upl.status === 200, 'cliente envia comprovativo (bucket privado)', `HTTP ${upl.status}`)
ok((await anon.req(`/storage/v1/object/public/payment-proofs/${path}`, { raw: true })).status === 404, 'bucket privado não é público')
ok((await cli.req(`/storage/v1/object/authenticated/payment-proofs/${path}`, { raw: true })).status === 200, 'dono lê o próprio comprovativo')
ok((await other.req(`/storage/v1/object/authenticated/payment-proofs/${path}`, { raw: true })).status === 404, 'outro cliente não lê o comprovativo')
ok((await adm.req(`/storage/v1/object/authenticated/payment-proofs/${path}`, { raw: true })).status === 200, 'admin lê o comprovativo')
ok((await anon.req('/storage/v1/object/public/site-videos/../../etc/passwd', { raw: true })).status >= 400, 'caminho com ../ é recusado')
const exe = await cli.req(`/storage/v1/object/payment-proofs/${myId}/x.html`, { method: 'POST', body: new Blob(['<script>'], { type: 'text/html' }), headers: { 'content-type': 'text/html' } })
ok(exe.status === 415, 'tipo de ficheiro não permitido é recusado', `HTTP ${exe.status}`)

// ── Checkout (convidado cria conta + encomenda + fatura) ────────────────────
const guestEmail = `convidado.${Date.now()}@example.ao`
const co = await anon.req('/api/checkout/orders', { method: 'POST', body: {
  userData: { email: guestEmail, password: 'Convidado#2026', name: 'Convidado Teste', phone: '+244900000001' },
  items: [{ id: 'email-starter', name: 'Email Starter', type: 'email', price: 1500, quantity: 1 }, { id: 'domain-ao', name: 'Domínio convidado-teste.ao', type: 'domain', price: 15000, quantity: 1 }],
  billingCycle: 'monthly', domainName: 'convidado-teste.ao', domainAction: 'register', paymentMethod: 'bic_transfer', amount: 16500.5, proofFileUrl: '', transferRef: 'REF-1', useDefaultNs: true,
} })
ok(co.status < 300, 'checkout como convidado', `HTTP ${co.status} ${JSON.stringify(co.json).slice(0, 200)}`)
const g = new Session()
ok(!(await g.login(guestEmail, 'Convidado#2026')).json.error, 'convidado consegue entrar com a conta criada no checkout')
const gInv = await g.db({ table: 'invoices', op: 'select', select: 'invoice_number,total,status' })
ok(gInv.data?.length === 1 && gInv.data[0].total === 16500 && /^VH-\d{6}-\d{4}$/.test(gInv.data[0].invoice_number), 'fatura criada pela RPC create_order', JSON.stringify(gInv.data))

// ── Recuperação de conta ────────────────────────────────────────────────────
const rec = await anon.req('/api/auth/recover', { method: 'POST', body: { email: C.email, redirectTo: `${BASE}/reset-password` } })
ok(rec.status === 200 && !rec.json.error, 'pedido de recuperação de palavra-passe aceite')
ok((await anon.req('/api/auth/verify', { method: 'POST', body: { token: 'invalido.x' } })).json.error, 'token de recuperação inválido é recusado')
if (process.env.RECOVERY_TOKEN) {
  const r = new Session()
  const v = await r.req('/api/auth/verify', { method: 'POST', body: { token: process.env.RECOVERY_TOKEN } })
  ok(!v.json.error && r.cookie, 'link de recuperação válido cria sessão')
  const u = await r.req('/api/auth/update', { method: 'POST', body: { password: 'NovaSenha#2026' } })
  ok(!u.json.error, 'definir nova palavra-passe')
  ok((await r.req('/api/auth/verify', { method: 'POST', body: { token: process.env.RECOVERY_TOKEN } })).json.error, 'link de recuperação só pode ser usado uma vez')
  ok((await cli.req('/api/auth/user')).json.data?.user === null, 'sessões antigas terminam após mudar a palavra-passe')
  ok(!(await new Session().login(C.email, 'NovaSenha#2026')).json.error, 'login com a nova palavra-passe')
}
ok((await new Session().login('convite@example.ao', 'qualquer')).json.error, 'conta sem palavra-passe não entra (tem de recuperar)')

console.log(`\n${pass} passou, ${fail} falhou`)
process.exitCode = fail ? 1 : 0
