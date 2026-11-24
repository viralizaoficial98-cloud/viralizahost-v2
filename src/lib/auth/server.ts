import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import bcrypt from 'bcryptjs'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { fromDbDatetime } from '@/lib/db/values'

// Autenticação própria (substitui o Supabase Auth / GoTrue).
//
// * auth_users preserva os IDs e os hashes bcrypt ($2a$) do auth.users do Supabase,
//   pelo que as palavras-passe existentes continuam válidas.
// * A sessão é um token aleatório num cookie httpOnly; a base guarda só o SHA-256.
// * Os utilizadores têm de iniciar sessão uma vez após a troca (os cookies sb-* do
//   Supabase deixam de ser reconhecidos).

export const SESSION_COOKIE = 'vh_session'
const SESSION_DAYS = Number(process.env.AUTH_SESSION_DAYS || 30)
const RECOVERY_TTL_MIN = 60
const SIGNUP_TTL_HOURS = 24

export interface AuthUser {
  id: string
  aud: 'authenticated'
  role: 'authenticated'
  email: string
  email_confirmed_at: string | null
  confirmed_at: string | null
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
}

export interface AuthError { message: string; status: number; code: string; name: 'AuthApiError' }

export const authError = (message: string, status = 400, code = 'unexpected_failure'): AuthError =>
  ({ message, status, code, name: 'AuthApiError' })

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')
const dt = (v: string | null) => (v ? fromDbDatetime(v) : null)
const parseJson = (v: unknown) => {
  if (v && typeof v === 'object') return v as Record<string, any>
  try { return JSON.parse(String(v ?? '{}')) } catch { return {} }
}

interface UserRow {
  id: string; email: string; encrypted_password: string | null; email_confirmed_at: string | null; email_verification_exempt?: number | null
  raw_user_meta_data: unknown; raw_app_meta_data: unknown; password_reset_required: number
  banned_until: string | null; last_sign_in_at: string | null; created_at: string; updated_at: string
}

export function toAuthUser(r: UserRow): AuthUser {
  return {
    id: r.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: r.email,
    email_confirmed_at: dt(r.email_confirmed_at),
    confirmed_at: dt(r.email_confirmed_at),
    last_sign_in_at: dt(r.last_sign_in_at),
    created_at: dt(r.created_at)!,
    updated_at: dt(r.updated_at)!,
    user_metadata: parseJson(r.raw_user_meta_data),
    app_metadata: { provider: 'email', providers: ['email'], ...parseJson(r.raw_app_meta_data) },
  }
}

async function userBy(db: Queryable, where: 'id' | 'email', value: string): Promise<UserRow | undefined> {
  const [rows] = await db.query(`SELECT * FROM auth_users WHERE ${where === 'id' ? 'id' : 'email'} = ? LIMIT 1`, [where === 'email' ? value.trim().toLowerCase() : value])
  return (rows as UserRow[])[0]
}

export const getUserById = async (id: string) => {
  const r = await userBy(getPool(), 'id', id)
  return r ? toAuthUser(r) : null
}
export const getUserByEmail = async (email: string) => {
  const r = await userBy(getPool(), 'email', email)
  return r ? toAuthUser(r) : null
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

// ── Sessões ──────────────────────────────────────────────────────────────────
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000)
  let ua: string | null = null, ip: string | null = null
  try {
    const h = await headers()
    ua = h.get('user-agent')?.slice(0, 255) ?? null
    ip = (h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || null)?.slice(0, 45) ?? null
  } catch {}
  await getPool().query(
    'INSERT INTO auth_sessions (id, user_id, token_hash, user_agent, ip, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), userId, sha256(token), ua, ip, expiresAt.toISOString().replace('T', ' ').replace('Z', '')],
  )
  await getPool().query('UPDATE auth_users SET last_sign_in_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [userId])
  return { token, expiresAt }
}

/** Valida um token de sessão. Usado também pelo proxy (runtime Node.js). */
export async function userFromSessionToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token || token.length > 200) return null
  const [rows] = await getPool().query(
    `SELECT u.* FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP(6)
       AND (u.banned_until IS NULL OR u.banned_until < CURRENT_TIMESTAMP(6)) LIMIT 1`,
    [sha256(token)],
  )
  const r = (rows as UserRow[])[0]
  return r ? toAuthUser(r) : null
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroyCurrentSession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await getPool().query('DELETE FROM auth_sessions WHERE token_hash = ?', [sha256(token)])
  try { jar.delete(SESSION_COOKIE) } catch {}
}

/** Utilizador da sessão actual (memorizado por pedido). */
export const getSessionUser = cache(async (): Promise<AuthUser | null> => {
  try {
    const jar = await cookies()
    return await userFromSessionToken(jar.get(SESSION_COOKIE)?.value)
  } catch {
    return null
  }
})

/** Perfil (role) do utilizador — equivalente a is_admin()/is_staff(). */
export const getProfileRole = cache(async (userId: string): Promise<'client' | 'admin' | 'reseller' | null> => {
  const [rows] = await getPool().query('SELECT role FROM profiles WHERE id = ? LIMIT 1', [userId])
  return ((rows as { role: any }[])[0]?.role ?? null)
})

// ── Credenciais ──────────────────────────────────────────────────────────────
let _dummy: string | undefined
const dummyHash = () => (_dummy ??= bcrypt.hashSync(randomBytes(16).toString('hex'), 10))

export async function signInWithPassword(email: string, password: string): Promise<{ user: AuthUser } | { error: AuthError }> {
  const r = await userBy(getPool(), 'email', email ?? '')
  // Comparação feita mesmo sem utilizador, para não revelar contas por tempo de resposta.
  const hash = r?.encrypted_password || dummyHash()
  const ok = await bcrypt.compare(password ?? '', hash).catch(() => false)
  if (!r || !ok || !r.encrypted_password) return { error: authError('Invalid login credentials', 400, 'invalid_credentials') }
  if (r.banned_until && new Date(fromDbDatetime(r.banned_until)) > new Date()) return { error: authError('User is banned', 400, 'user_banned') }
  // Sem e-mail confirmado só entra quem foi registado com a confirmação desactivada (isenção guardada na conta):
  // mudar a opção depois não altera a situação das contas existentes.
  if (!r.email_confirmed_at && !Number(r.email_verification_exempt)) {
    return { error: authError('Email not confirmed', 400, 'email_not_confirmed') }
  }
  return { user: toAuthUser(r) }
}

export interface CreateUserInput {
  email: string
  password?: string
  email_confirm?: boolean
  /** Registo com a confirmação desactivada: e-mail fica por verificar, mas a conta pode iniciar sessão. */
  email_verification_exempt?: boolean
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
  id?: string
}

/**
 * Cria utilizador + perfil + cliente numa transacção
 * (equivalente a auth.admin.createUser + trigger handle_new_user).
 */
export async function createUser(input: CreateUserInput): Promise<{ user: AuthUser } | { error: AuthError }> {
  const email = String(input.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: authError('Unable to validate email address: invalid format', 400, 'validation_failed') }
  if (input.password != null && input.password.length < 6) return { error: authError('Password should be at least 6 characters.', 422, 'weak_password') }
  const id = input.id ?? randomUUID()
  const meta = input.user_metadata ?? {}
  try {
    await withTransaction(async conn => {
      const [exists] = await conn.query('SELECT id FROM auth_users WHERE email = ? FOR UPDATE', [email])
      if ((exists as unknown[]).length) throw Object.assign(new Error('dup'), { dup: true })
      await conn.query(
        `INSERT INTO auth_users (id, email, encrypted_password, email_confirmed_at, email_verification_exempt, raw_user_meta_data, raw_app_meta_data)
         VALUES (?, ?, ?, ${input.email_confirm ? 'CURRENT_TIMESTAMP(6)' : 'NULL'}, ?, ?, ?)`,
        [id, email, input.password ? await hashPassword(input.password) : null, input.email_verification_exempt ? 1 : 0, JSON.stringify(meta), JSON.stringify(input.app_metadata ?? {})],
      )
      await handleNewUser(conn, id, email, meta)
    })
  } catch (e) {
    if ((e as { dup?: boolean }).dup || (e as { errno?: number }).errno === 1062) {
      return { error: authError('A user with this email address has already been registered', 422, 'email_exists') }
    }
    throw e
  }
  return { user: (await getUserById(id))! }
}

/** viralizahost.handle_new_user() */
async function handleNewUser(conn: Queryable, id: string, email: string, meta: Record<string, any>) {
  const roles = ['client', 'admin', 'reseller']
  const role = roles.includes(meta.role) ? meta.role : 'client'
  await conn.query(
    `INSERT INTO profiles (id, email, full_name, phone, country, role) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), full_name = COALESCE(VALUES(full_name), full_name), updated_at = CURRENT_TIMESTAMP(6)`,
    [id, email, meta.full_name ?? '', meta.phone ?? null, meta.country ?? 'AO', role],
  )
  await conn.query('INSERT IGNORE INTO clients (id, profile_id) VALUES (?, ?)', [randomUUID(), id])
}

export interface UpdateUserInput {
  email?: string
  password?: string
  email_confirm?: boolean
  user_metadata?: Record<string, any>
  data?: Record<string, any>
  ban_duration?: string
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<{ user: AuthUser } | { error: AuthError }> {
  const sets: string[] = []
  const params: unknown[] = []
  if (input.password != null) {
    if (input.password.length < 6) return { error: authError('Password should be at least 6 characters.', 422, 'weak_password') }
    sets.push('encrypted_password = ?', 'password_reset_required = 0'); params.push(await hashPassword(input.password))
  }
  if (input.email) { sets.push('email = ?'); params.push(input.email.trim().toLowerCase()) }
  if (input.email_confirm) sets.push('email_confirmed_at = COALESCE(email_confirmed_at, CURRENT_TIMESTAMP(6))')
  const meta = input.user_metadata ?? input.data
  if (meta) { sets.push('raw_user_meta_data = JSON_MERGE_PATCH(raw_user_meta_data, ?)'); params.push(JSON.stringify(meta)) }
  if (input.ban_duration) {
    sets.push(input.ban_duration === 'none' ? 'banned_until = NULL' : 'banned_until = CURRENT_TIMESTAMP(6) + INTERVAL 100 YEAR')
  }
  if (!sets.length) {
    const u = await getUserById(id)
    return u ? { user: u } : { error: authError('User not found', 404, 'user_not_found') }
  }
  try {
    await withTransaction(async conn => {
      const [res] = await conn.query(`UPDATE auth_users SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
      if (!(res as { affectedRows: number }).affectedRows) throw Object.assign(new Error('nf'), { notFound: true })
      // viralizahost.handle_user_email_updated()
      if (input.email) await conn.query('UPDATE profiles SET email = ? WHERE id = ?', [input.email.trim().toLowerCase(), id])
      // Ao mudar a palavra-passe, termina as outras sessões
      if (input.password != null) {
        let keep: string | undefined
        try { keep = (await cookies()).get(SESSION_COOKIE)?.value } catch {}
        await conn.query('DELETE FROM auth_sessions WHERE user_id = ? AND token_hash <> ?', [id, keep ? sha256(keep) : ''])
      }
    })
  } catch (e) {
    if ((e as { notFound?: boolean }).notFound) return { error: authError('User not found', 404, 'user_not_found') }
    if ((e as { errno?: number }).errno === 1062) return { error: authError('A user with this email address has already been registered', 422, 'email_exists') }
    throw e
  }
  return { user: (await getUserById(id))! }
}

export async function deleteUser(id: string) {
  // profiles → auth_users ON DELETE CASCADE (como no Supabase)
  await getPool().query('DELETE FROM auth_users WHERE id = ?', [id])
}

// ── Tokens de uso único ─────────────────────────────────────────────────────
export async function issueToken(userId: string, type: 'recovery' | 'signup' | 'invite', redirectTo?: string | null) {
  const token = newToken()
  const ttlMs = type === 'recovery' ? RECOVERY_TTL_MIN * 60_000 : SIGNUP_TTL_HOURS * 3600_000
  await getPool().query(
    'INSERT INTO auth_tokens (id, user_id, type, token_hash, redirect_to, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), userId, type, sha256(token), redirectTo ?? null, new Date(Date.now() + ttlMs).toISOString().replace('T', ' ').replace('Z', '')],
  )
  return token
}

/** Consome um token (uma única vez). Devolve o utilizador ou null. */
export async function consumeToken(token: string, type: 'recovery' | 'signup' | 'invite'): Promise<{ userId: string; redirectTo: string | null } | null> {
  return withTransaction(async conn => {
    const [rows] = await conn.query(
      'SELECT id, user_id, redirect_to FROM auth_tokens WHERE token_hash = ? AND type = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP(6) FOR UPDATE',
      [sha256(token), type],
    )
    const t = (rows as { id: string; user_id: string; redirect_to: string | null }[])[0]
    if (!t) return null
    await conn.query('UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [t.id])
    if (type === 'signup' || type === 'invite' || type === 'recovery') {
      // Abrir um link enviado por e-mail confirma o endereço (como o GoTrue)
      await conn.query('UPDATE auth_users SET email_confirmed_at = COALESCE(email_confirmed_at, CURRENT_TIMESTAMP(6)) WHERE id = ?', [t.user_id])
    }
    return { userId: t.user_id, redirectTo: t.redirect_to }
  })
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://viralizahost.com').replace(/\/$/, '')
}

/** Só permite redirecionar para o próprio site. */
export function safeRedirect(to: string | null | undefined, fallback: string): string {
  if (!to) return fallback
  try {
    const base = new URL(siteUrl())
    const u = new URL(to, base)
    if (u.host !== base.host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.host)) return fallback
    return u.pathname + u.search
  } catch {
    return fallback
  }
}
