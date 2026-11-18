import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
// Substituto do Supabase Auth (GoTrue) sobre a tabela auth_users em MariaDB.
// • Palavras-passe: bcrypt; os hashes $2a$ migrados do Supabase continuam válidos.
// • Sessão: cookie HttpOnly "vh_session" assinado (HMAC) e revogável por session_version.
// • Recuperação/confirmação: links assinados enviados pelo Resend.
import { randomUUID, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import { sql, withTransaction } from '@/lib/db/pool'
import { decodeValue } from '@/lib/db/codec'
import { signToken, verifyToken, SESSION_COOKIE, SESSION_MAX_AGE, sessionCookieOptions } from './token'

export interface AuthUser {
  id: string
  aud: 'authenticated'
  role: 'authenticated'
  email: string | null
  phone: string | null
  email_confirmed_at: string | null
  confirmed_at: string | null
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
}

export interface AuthError { message: string; status: number; code: string; name: 'AuthApiError' }
const authError = (message: string, status = 400, code = 'unexpected_failure'): AuthError => ({ message, status, code, name: 'AuthApiError' })

/** Interface mínima de cookies (next/headers cookies() ou NextRequest/NextResponse). */
export interface CookieJar {
  get(name: string): { value: string } | undefined
  set?(name: string, value: string, opts?: Record<string, unknown>): void
}

const dt = (v: unknown) => decodeValue({ type: 'datetime' }, v) as string | null
const json = (v: unknown) => (decodeValue({ type: 'json' }, v) ?? {}) as Record<string, unknown>

interface UserRow {
  id: string; email: string | null; encrypted_password: string | null; email_confirmed_at: string | null
  phone: string | null; raw_user_meta_data: string | null; raw_app_meta_data: string | null
  last_sign_in_at: string | null; banned_until: string | null; session_version: number
  created_at: string; updated_at: string; deleted_at: string | null
}

function toUser(r: UserRow): AuthUser {
  return {
    id: r.id, aud: 'authenticated', role: 'authenticated', email: r.email, phone: r.phone,
    email_confirmed_at: dt(r.email_confirmed_at), confirmed_at: dt(r.email_confirmed_at),
    last_sign_in_at: dt(r.last_sign_in_at), created_at: dt(r.created_at)!, updated_at: dt(r.updated_at)!,
    user_metadata: json(r.raw_user_meta_data), app_metadata: { provider: 'email', providers: ['email'], ...json(r.raw_app_meta_data) },
  }
}

// Hash no formato $2a$ (o do Supabase/GoTrue e o único aceite pelo pgcrypto) — necessário para o plano de regresso.
const hashPassword = async (pw: string) => (await bcrypt.hash(pw, 10)).replace(/^\$2b\$/, '$2a$')
const normEmail = (e: string) => String(e ?? '').trim().toLowerCase()
const findByEmail = async (email: string) => (await sql<UserRow>('SELECT * FROM auth_users WHERE email = ? AND deleted_at IS NULL LIMIT 1', [normEmail(email)]))[0]
const findById = async (id: string) => (await sql<UserRow>('SELECT * FROM auth_users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [id]))[0]
const fingerprint = (r: UserRow) => createHash('sha256').update(`${r.encrypted_password ?? ''}|${r.session_version}`).digest('base64url').slice(0, 22)
const banned = (r: UserRow) => !!r.banned_until && new Date(r.banned_until.replace(' ', 'T') + 'Z') > new Date()

// ── limitação simples de tentativas (por processo) ─────────────────────────
const attempts = new Map<string, { n: number; until: number }>()
function rateLimitedRaw(key: string, max = 8, windowMs = 10 * 60_000): boolean {
  const now = Date.now()
  const a = attempts.get(key)
  if (!a || a.until < now) { attempts.set(key, { n: 1, until: now + windowMs }); return false }
  a.n++
  return a.n > max
}

// ── sessão ─────────────────────────────────────────────────────────────────
export function issueSession(jar: CookieJar, r: UserRow) {
  const token = signToken({ typ: 'session', sub: r.id, v: r.session_version, email: r.email ?? undefined }, SESSION_MAX_AGE)
  jar.set?.(SESSION_COOKIE, token, sessionCookieOptions)
  return token
}

export function clearSession(jar: CookieJar) {
  jar.set?.(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 })
}

export async function getUserFromJar(jar: CookieJar): Promise<AuthUser | null> {
  const p = verifyToken(jar.get(SESSION_COOKIE)?.value, 'session')
  if (!p) return null
  const r = await findById(p.sub)
  if (!r || Number(r.session_version) !== Number(p.v) || banned(r)) return null
  return toUser(r)
}

// ── e-mail ─────────────────────────────────────────────────────────────────
function siteUrl() { return (process.env.NEXT_PUBLIC_SITE_URL || 'https://viralizahost.com').replace(/\/$/, '') }

async function sendMail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.error('[auth] RESEND_API_KEY em falta — e-mail não enviado para', to); return false }
  const from = process.env.AUTH_EMAIL_FROM || `${process.env.RESEND_FROM_NAME || 'ViralizaHost'} <${process.env.RESEND_FROM_EMAIL || 'comercial@viralizahost.com'}>`
  const { error } = await new Resend(key).emails.send({ from, to: [to], subject, html })
  if (error) { console.error('[auth] erro Resend', error); return false }
  return true
}

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;padding:12px 22px;background:#2563EB;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${label}</a></p><p style="color:#64748B;font-size:12px">Se o botão não funcionar, copie este endereço: ${href}</p>`

async function sendRecovery(r: UserRow, redirectTo?: string) {
  const token = signToken({ typ: 'recovery', sub: r.id, v: fingerprint(r) }, 60 * 60)
  const base = redirectTo && redirectTo.startsWith(siteUrl()) ? redirectTo : `${siteUrl()}/reset-password`
  const link = `${base}${base.includes('?') ? '&' : '?'}type=recovery&token=${encodeURIComponent(token)}`
  return sendMail(r.email!, 'Redefinir a sua palavra-passe — ViralizaHost',
    `<p>Olá,</p><p>Recebemos um pedido para redefinir a palavra-passe da sua conta ViralizaHost.</p>${button(link, 'Definir nova palavra-passe')}<p>O link é válido durante 1 hora. Se não fez este pedido, ignore este e-mail.</p>`)
}

async function sendConfirmation(r: UserRow) {
  const token = signToken({ typ: 'confirm', sub: r.id, v: r.email ?? '' }, 60 * 60 * 24 * 3)
  const link = `${siteUrl()}/api/auth/confirm?token=${encodeURIComponent(token)}`
  return sendMail(r.email!, 'Confirme o seu e-mail — ViralizaHost',
    `<p>Bem-vindo à ViralizaHost!</p><p>Confirme o seu endereço de e-mail para ativar a conta.</p>${button(link, 'Confirmar e-mail')}`)
}

// ── criação de contas (porta do trigger handle_new_user) ──────────────────
const requireConfirmation = () => (process.env.AUTH_REQUIRE_EMAIL_CONFIRMATION ?? 'true') !== 'false'

async function createUserRow(opts: { email: string; password?: string; confirmed: boolean; metadata?: Record<string, unknown>; appMetadata?: Record<string, unknown> }): Promise<UserRow | AuthError> {
  const email = normEmail(opts.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError('Unable to validate email address: invalid format', 400, 'validation_failed')
  if (opts.password !== undefined && opts.password.length < 6) return authError('Password should be at least 6 characters.', 422, 'weak_password')
  if (await findByEmail(email)) return authError('A user with this email address has already been registered', 422, 'email_exists')
  const id = randomUUID()
  const hash = opts.password ? await hashPassword(opts.password) : null
  const meta = { ...(opts.metadata ?? {}) }
  // Segurança: o papel nunca vem dos metadados enviados pelo browser.
  const role = 'client'
  meta.role = role
  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
       VALUES (?, ?, ?, ${opts.confirmed ? 'UTC_TIMESTAMP(6)' : 'NULL'}, ?, ?)`,
      [id, email, hash, JSON.stringify(meta), JSON.stringify({ provider: 'email', providers: ['email'], ...(opts.appMetadata ?? {}) })],
    )
    await conn.query(
      `INSERT INTO profiles (id, email, full_name, phone, country, role) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), full_name = COALESCE(NULLIF(VALUES(full_name), ''), full_name), updated_at = UTC_TIMESTAMP(6)`,
      [id, email, String(meta.full_name ?? ''), meta.phone ?? null, String(meta.country ?? 'AO'), role],
    )
    await conn.query('INSERT IGNORE INTO clients (id, profile_id) VALUES (?, ?)', [randomUUID(), id])
  })
  return (await findById(id))!
}

// ── API pública (formato supabase-js) ─────────────────────────────────────
export function authApi(jar: CookieJar, ip = 'local') {
  // chamadas internas do servidor (ip 'local', ex.: admin a enviar reset) não são limitadas
  const rateLimited = (key: string, max?: number, windowMs?: number) => ip !== 'local' && rateLimitedRaw(key, max, windowMs)
  return {
    async getUser() {
      const user = await getUserFromJar(jar)
      return user ? { data: { user }, error: null } : { data: { user: null }, error: authError('Auth session missing!', 401, 'session_not_found') }
    },
    async getSession() {
      const user = await getUserFromJar(jar)
      const token = jar.get(SESSION_COOKIE)?.value
      return { data: { session: user ? { user, access_token: token, token_type: 'bearer', expires_in: SESSION_MAX_AGE } : null }, error: null }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      if (rateLimited(`login:${ip}:${normEmail(email)}`)) return { data: { user: null, session: null }, error: authError('Too many login attempts. Try again later.', 429, 'over_request_rate_limit') }
      const r = await findByEmail(email)
      const ok = !!r && !!r.encrypted_password && (await bcrypt.compare(String(password ?? ''), r.encrypted_password.replace(/^\$2y\$/, '$2a$')))
      if (!r || !ok) return { data: { user: null, session: null }, error: authError('Invalid login credentials', 400, 'invalid_credentials') }
      if (banned(r)) return { data: { user: null, session: null }, error: authError('User is banned', 400, 'user_banned') }
      if (!r.email_confirmed_at && requireConfirmation()) return { data: { user: null, session: null }, error: authError('Email not confirmed', 400, 'email_not_confirmed') }
      await sql('UPDATE auth_users SET last_sign_in_at = UTC_TIMESTAMP(6) WHERE id = ?', [r.id])
      issueSession(jar, r)
      const user = toUser(r)
      return { data: { user, session: { user } }, error: null }
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
      if (rateLimited(`signup:${ip}`, 10, 60 * 60_000)) return { data: { user: null, session: null }, error: authError('Email rate limit exceeded', 429, 'over_email_send_rate_limit') }
      const confirmed = !requireConfirmation()
      const r = await createUserRow({ email, password, confirmed, metadata: options?.data })
      if ('code' in r && 'name' in r) return { data: { user: null, session: null }, error: r }
      const row = r as UserRow
      if (confirmed) { issueSession(jar, row); return { data: { user: toUser(row), session: { user: toUser(row) } }, error: null } }
      await sendConfirmation(row)
      return { data: { user: toUser(row), session: null }, error: null }
    },
    async signOut() { clearSession(jar); return { error: null } },
    async updateUser(attrs: { password?: string; email?: string; data?: Record<string, unknown> }) {
      const current = await getUserFromJar(jar)
      if (!current) return { data: { user: null }, error: authError('Auth session missing!', 401, 'session_not_found') }
      const res = await adminUpdate(current.id, { password: attrs.password, email: attrs.email, user_metadata: attrs.data })
      if (res.error) return res
      const r = await findById(current.id)
      if (attrs.password && r) issueSession(jar, r) // nova versão de sessão; mantém este browser ligado
      return { data: { user: r ? toUser(r) : null }, error: null }
    },
    async resetPasswordForEmail(email: string, opts: { redirectTo?: string } = {}) {
      if (rateLimited(`recover:${ip}`, 5, 60 * 60_000)) return { data: {}, error: authError('Email rate limit exceeded', 429, 'over_email_send_rate_limit') }
      const r = await findByEmail(email)
      if (r && !banned(r)) await sendRecovery(r, opts.redirectTo)
      return { data: {}, error: null } // não revela se o e-mail existe
    },
    /** Link de recuperação → sessão (substitui exchangeCodeForSession / PASSWORD_RECOVERY). */
    async verifyRecovery(token: string) {
      const p = verifyToken(token, 'recovery')
      const r = p ? await findById(p.sub) : undefined
      if (!p || !r || fingerprint(r) !== p.v) return { data: { user: null }, error: authError('Email link is invalid or has expired', 403, 'otp_expired') }
      if (!r.email_confirmed_at) await sql('UPDATE auth_users SET email_confirmed_at = UTC_TIMESTAMP(6) WHERE id = ?', [r.id])
      issueSession(jar, r)
      return { data: { user: toUser(r) }, error: null }
    },
    async verifyConfirmation(token: string) {
      const p = verifyToken(token, 'confirm')
      const r = p ? await findById(p.sub) : undefined
      if (!p || !r || (r.email ?? '') !== p.v) return { data: { user: null }, error: authError('Email link is invalid or has expired', 403, 'otp_expired') }
      await sql('UPDATE auth_users SET email_confirmed_at = COALESCE(email_confirmed_at, UTC_TIMESTAMP(6)) WHERE id = ?', [r.id])
      issueSession(jar, (await findById(r.id))!)
      return { data: { user: toUser(r) }, error: null }
    },
    async exchangeCodeForSession(code: string) {
      const rec = await this.verifyRecovery(code)
      if (!rec.error) return { data: { user: rec.data.user, session: { user: rec.data.user } }, error: null }
      const conf = await this.verifyConfirmation(code)
      return conf.error ? { data: { user: null, session: null }, error: conf.error } : { data: { user: conf.data.user, session: { user: conf.data.user } }, error: null }
    },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } },
    admin: adminApi,
  }
}

async function adminUpdate(id: string, attrs: { password?: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown>; email_confirm?: boolean; ban_duration?: string }) {
  const r = await findById(id)
  if (!r) return { data: { user: null }, error: authError('User not found', 404, 'user_not_found') }
  const sets: string[] = []
  const params: unknown[] = []
  if (attrs.password !== undefined) {
    if (attrs.password.length < 6) return { data: { user: null }, error: authError('Password should be at least 6 characters.', 422, 'weak_password') }
    sets.push('encrypted_password = ?', 'session_version = session_version + 1'); params.push(await hashPassword(attrs.password))
  }
  let newEmail: string | null = null
  if (attrs.email !== undefined && normEmail(attrs.email) !== r.email) {
    newEmail = normEmail(attrs.email)
    if (await findByEmail(newEmail)) return { data: { user: null }, error: authError('A user with this email address has already been registered', 422, 'email_exists') }
    sets.push('email = ?'); params.push(newEmail)
  }
  if (attrs.user_metadata) { sets.push('raw_user_meta_data = ?'); params.push(JSON.stringify({ ...json(r.raw_user_meta_data), ...attrs.user_metadata, role: json(r.raw_user_meta_data).role ?? 'client' })) }
  if (attrs.app_metadata) { sets.push('raw_app_meta_data = ?'); params.push(JSON.stringify({ ...json(r.raw_app_meta_data), ...attrs.app_metadata })) }
  if (attrs.email_confirm) sets.push('email_confirmed_at = COALESCE(email_confirmed_at, UTC_TIMESTAMP(6))')
  if (attrs.ban_duration !== undefined) {
    if (attrs.ban_duration === 'none') sets.push('banned_until = NULL')
    else { const h = Number(String(attrs.ban_duration).replace(/h$/, '')) || 876000; sets.push(`banned_until = UTC_TIMESTAMP(6) + INTERVAL ${Math.trunc(h)} HOUR`, 'session_version = session_version + 1') }
  }
  if (!sets.length) return { data: { user: toUser(r) }, error: null }
  sets.push('updated_at = UTC_TIMESTAMP(6)')
  await withTransaction(async (conn) => {
    await conn.query(`UPDATE auth_users SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
    // porta do trigger handle_user_email_updated
    if (newEmail) await conn.query('UPDATE profiles SET email = ?, updated_at = UTC_TIMESTAMP(6) WHERE id = ?', [newEmail, id])
  })
  return { data: { user: toUser((await findById(id))!) }, error: null }
}

export const adminApi = {
  async createUser(attrs: { email: string; password?: string; email_confirm?: boolean; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }) {
    const r = await createUserRow({ email: attrs.email, password: attrs.password, confirmed: !!attrs.email_confirm, metadata: attrs.user_metadata, appMetadata: attrs.app_metadata })
    if ('name' in r) return { data: { user: null }, error: r }
    return { data: { user: toUser(r as UserRow) }, error: null }
  },
  updateUserById: adminUpdate,
  async getUserById(id: string) {
    const r = await findById(id)
    return r ? { data: { user: toUser(r) }, error: null } : { data: { user: null }, error: authError('User not found', 404, 'user_not_found') }
  },
  async deleteUser(id: string) {
    await sql('DELETE FROM auth_users WHERE id = ?', [id])
    return { data: {}, error: null }
  },
  async listUsers(opts: { page?: number; perPage?: number } = {}) {
    const per = Math.min(opts.perPage ?? 50, 1000)
    const page = Math.max(opts.page ?? 1, 1)
    const rows = await sql<UserRow>('SELECT * FROM auth_users WHERE deleted_at IS NULL ORDER BY created_at LIMIT ? OFFSET ?', [per, (page - 1) * per])
    return { data: { users: rows.map(toUser) }, error: null }
  },
  async generateLink(opts: { type: 'recovery'; email: string; options?: { redirectTo?: string } }) {
    const r = await findByEmail(opts.email)
    if (!r) return { data: null, error: authError('User not found', 404, 'user_not_found') }
    const token = signToken({ typ: 'recovery', sub: r.id, v: fingerprint(r) }, 60 * 60)
    return { data: { properties: { action_link: `${siteUrl()}/reset-password?type=recovery&token=${encodeURIComponent(token)}` }, user: toUser(r) }, error: null }
  },
}
