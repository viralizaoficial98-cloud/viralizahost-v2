#!/usr/bin/env node
/**
 * TESTE — Supabase simulado (Auth + Storage) para validar a aplicação em modo MySQL sem tocar no Supabase real.
 * Qualquer pedido ao PostgREST (/rest/v1) é registado como INESPERADO: em modo MySQL nenhum deve acontecer.
 *
 *   PORT=54321 node mock-supabase.mjs
 *   Depuração: GET /__state · POST /__reset · GET /__recovery?email=… (link do email de recuperação)
 */
import http from 'node:http'
import { randomUUID, createHash } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 54321)
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (user) => {
  const now = Math.floor(Date.now() / 1000)
  return `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now, session_id: randomUUID() })}.sig`
}

const S = {
  users: new Map(),        // id → user (+password)
  tokens: new Map(),       // access_token → user id
  refresh: new Map(),      // refresh_token → user id
  codes: new Map(),        // pkce code → { userId, challenge }
  recoveries: [],          // { email, link }
  objects: new Map(),      // "bucket/path" → { buf, type }
  buckets: new Set(['site-banners', 'site-team', 'payment-proofs', 'invoices', 'site-videos', 'banner-pages']),
  signed: new Map(),       // token → key
  unexpected: [],          // pedidos PostgREST
  emails: [],              // emails enviados pelo Resend simulado
  log: [],
}

const cors = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'apikey,authorization,x-upsert,content-type,x-client-info,accept-profile,content-profile,prefer,range,cache-control,x-metadata,accept,x-supabase-api-version',
  'Access-Control-Expose-Headers': 'content-range,content-length,accept-ranges',
}
const send = (res, status, body, headers = {}) => {
  const isBuf = Buffer.isBuffer(body)
  res.writeHead(status, { ...cors, ...(isBuf ? {} : { 'Content-Type': 'application/json' }), ...headers })
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body))
}
const readBody = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))) })
const json = async req => { const b = await readBody(req); try { return JSON.parse(b.toString() || '{}') } catch { return {} } }
const publicUser = u => { const { password, ...rest } = u; return rest }
const bearerUser = req => { const t = (req.headers.authorization ?? '').replace(/^Bearer /, ''); const id = S.tokens.get(t); return id ? S.users.get(id) : null }
const session = u => {
  const access_token = jwt(u); const refresh_token = randomUUID()
  S.tokens.set(access_token, u.id); S.refresh.set(refresh_token, u.id)
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token, user: publicUser(u) }
}
function createUser({ email, password, user_metadata = {}, id }) {
  email = String(email).toLowerCase()
  for (const u of S.users.values()) if (u.email === email) return null
  const u = { id: id ?? randomUUID(), aud: 'authenticated', role: 'authenticated', email, password, email_confirmed_at: new Date().toISOString(),
    phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  S.users.set(u.id, u)
  return u
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname
  S.log.push(`${req.method} ${p}${url.search}`); if (S.log.length > 2000) S.log.shift()
  if (req.method === 'OPTIONS') return send(res, 204)

  /* ── depuração ── */
  if (p === '/__state') return send(res, 200, { users: [...S.users.values()].map(publicUser), objects: [...S.objects.keys()], unexpected: S.unexpected, recoveries: S.recoveries, emails: S.emails, log: S.log.slice(-300) })
  if (p === '/__reset') { S.unexpected = []; S.log = []; return send(res, 200, {}) }
  if (p === '/__recovery') return send(res, 200, [...S.recoveries].reverse().find(r => r.email === url.searchParams.get('email')) ?? null)
  if (p === '/__seed_user' && req.method === 'POST') { const b = await json(req); const u = createUser(b) ?? [...S.users.values()].find(x => x.email === b.email); return send(res, 200, publicUser(u)) }

  /* ── Resend simulado (RESEND_BASE_URL=http://localhost:54321/resend) ── */
  if (p.startsWith('/resend/emails') && req.method === 'POST') {
    const b = await json(req); const id = `re_test_${randomUUID().slice(0, 8)}`
    S.emails.push({ id, to: b.to, subject: b.subject, attachments: (b.attachments ?? []).length })
    return send(res, 200, { id })
  }

  /* ── Auth (GoTrue) ── */
  if (p === '/auth/v1/token') {
    const g = url.searchParams.get('grant_type'); const b = await json(req)
    if (g === 'password') {
      const u = [...S.users.values()].find(x => x.email === String(b.email).toLowerCase())
      if (!u || u.password !== b.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      return send(res, 200, session(u))
    }
    if (g === 'refresh_token') { const id = S.refresh.get(b.refresh_token); return id ? send(res, 200, session(S.users.get(id))) : send(res, 400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }) }
    if (g === 'pkce') {
      const c = S.codes.get(b.auth_code)
      if (!c) return send(res, 400, { error_code: 'flow_state_not_found', msg: 'invalid flow state' })
      const ok = !c.challenge || createHash('sha256').update(b.code_verifier ?? '').digest('base64url') === c.challenge || c.challenge === b.code_verifier
      if (!ok) return send(res, 400, { error_code: 'bad_code_verifier', msg: 'code challenge does not match' })
      S.codes.delete(b.auth_code)
      return send(res, 200, session(S.users.get(c.userId)))
    }
    return send(res, 400, { msg: 'unsupported grant' })
  }
  if (p === '/auth/v1/user') {
    const u = bearerUser(req)
    if (!u) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' })
    if (req.method === 'PUT') { const b = await json(req); if (b.password) u.password = b.password; if (b.email) u.email = b.email; if (b.data) u.user_metadata = { ...u.user_metadata, ...b.data }; u.updated_at = new Date().toISOString() }
    return send(res, 200, publicUser(u))
  }
  if (p === '/auth/v1/signup') {
    const b = await json(req)
    const u = createUser({ email: b.email, password: b.password, user_metadata: b.data ?? {} })
    if (!u) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' })
    return send(res, 200, session(u))
  }
  if (p === '/auth/v1/recover') {
    const b = await json(req)
    const u = [...S.users.values()].find(x => x.email === String(b.email).toLowerCase())
    if (u) {
      const code = randomUUID()
      S.codes.set(code, { userId: u.id, challenge: b.code_challenge ?? null })
      const redirect = url.searchParams.get('redirect_to') ?? b.redirect_to ?? 'http://localhost:3105'
      S.recoveries.push({ email: u.email, link: `${redirect}${redirect.includes('?') ? '&' : '?'}code=${code}`, challenge: b.code_challenge ?? null })
    }
    return send(res, 200, {})
  }
  if (p === '/auth/v1/logout') return send(res, 204)
  if (p === '/auth/v1/admin/users' && req.method === 'POST') {
    const b = await json(req)
    const u = createUser({ email: b.email, password: b.password ?? randomUUID(), user_metadata: b.user_metadata ?? {} })
    if (!u) return send(res, 422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' })
    return send(res, 200, publicUser(u))
  }
  let m
  if ((m = p.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/))) {
    const u = S.users.get(m[1]); if (!u) return send(res, 404, { msg: 'User not found' })
    if (req.method === 'PUT') { const b = await json(req); if (b.password) u.password = b.password; if (b.email) u.email = b.email; if (b.user_metadata) u.user_metadata = { ...u.user_metadata, ...b.user_metadata } }
    if (req.method === 'DELETE') { S.users.delete(u.id); return send(res, 200, {}) }
    return send(res, 200, publicUser(u))
  }
  if (p.startsWith('/auth/v1/')) return send(res, 200, {})

  /* ── PostgREST: não deve ser usado em modo MySQL ── */
  if (p.startsWith('/rest/v1/')) {
    S.unexpected.push(`${req.method} ${p}${url.search}`)
    return send(res, 500, { code: 'MOCK', message: `PostgREST chamado em modo MySQL: ${req.method} ${p}` })
  }

  /* ── Storage ── */
  if (p === '/storage/v1/bucket') {
    if (req.method === 'GET') return send(res, 200, [...S.buckets].map(id => ({ id, name: id, public: !['payment-proofs', 'invoices'].includes(id) })))
    const b = await json(req); S.buckets.add(b.id ?? b.name); return send(res, 200, { name: b.name })
  }
  if ((m = p.match(/^\/storage\/v1\/object\/upload\/sign\/([^/]+)\/(.+)$/))) {
    const key = `${m[1]}/${decodeURIComponent(m[2])}`
    if (req.method === 'POST') { const t = randomUUID(); S.signed.set(t, key); return send(res, 200, { url: `/object/upload/sign/${m[1]}/${m[2]}?token=${t}` }) }
    if (S.signed.get(url.searchParams.get('token')) !== key) return send(res, 400, { message: 'invalid signature' })
    return storeUpload(req, res, key)
  }
  if ((m = p.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/))) {
    const key = `${m[1]}/${decodeURIComponent(m[2])}`
    if (req.method === 'POST') {
      if (!S.objects.has(key)) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      const t = randomUUID(); S.signed.set(t, key); return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=${t}` })
    }
    return serve(res, S.signed.get(url.searchParams.get('token')) === key ? key : null, req)
  }
  if ((m = p.match(/^\/storage\/v1\/object\/public\/(.+)$/))) return serve(res, decodeURIComponent(m[1]), req)
  if ((m = p.match(/^\/storage\/v1\/object\/list\/([^/]+)$/))) {
    const b = await json(req); const pre = `${m[1]}/${b.prefix ? b.prefix.replace(/\/?$/, '/') : ''}`
    return send(res, 200, [...S.objects.keys()].filter(k => k.startsWith(pre)).map(k => ({ name: k.slice(pre.length), id: randomUUID(), metadata: { size: S.objects.get(k).buf.length } })))
  }
  if ((m = p.match(/^\/storage\/v1\/object\/([^/]+)$/)) && req.method === 'DELETE') {
    const b = await json(req); for (const x of b.prefixes ?? []) S.objects.delete(`${m[1]}/${x}`)
    return send(res, 200, (b.prefixes ?? []).map(name => ({ name })))
  }
  if ((m = p.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/))) {
    const key = `${m[1]}/${decodeURIComponent(m[2])}`
    if (req.method === 'HEAD') return send(res, S.objects.has(key) ? 200 : 404)
    if (req.method === 'GET') return serve(res, key, req)
    if (req.method === 'POST' || req.method === 'PUT') {
      if (S.objects.has(key) && req.headers['x-upsert'] !== 'true' && req.method === 'POST') return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
      return storeUpload(req, res, key)
    }
  }
  return send(res, 404, { message: `mock: rota não implementada ${req.method} ${p}` })
}).listen(PORT, () => console.log(`mock supabase em ${PORT}`))

async function storeUpload(req, res, key) {
  const raw = await readBody(req)
  const ct = req.headers['content-type'] ?? ''
  let buf = raw, type = ct
  if (ct.startsWith('multipart/form-data')) {
    const fd = await new Request('http://x', { method: 'POST', headers: { 'content-type': ct }, body: raw }).formData()
    const file = [...fd.values()].find(v => typeof v !== 'string')
    buf = Buffer.from(await file.arrayBuffer()); type = file.type
  }
  S.objects.set(key, { buf, type: type || 'application/octet-stream' })
  return send(res, 200, { Key: key, Id: randomUUID() })
}

function serve(res, key, req) {
  const obj = key && S.objects.get(key)
  if (!obj) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
  const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/)
  if (range) {
    const start = Number(range[1]), end = range[2] ? Number(range[2]) : obj.buf.length - 1
    return send(res, 206, obj.buf.subarray(start, end + 1), { 'Content-Type': obj.type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${obj.buf.length}`, 'Content-Length': end - start + 1 })
  }
  return send(res, 200, obj.buf, { 'Content-Type': obj.type, 'Accept-Ranges': 'bytes', 'Content-Length': obj.buf.length })
}
