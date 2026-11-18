/*
 * Contexto de autorização das consultas MySQL.
 *
 * O Supabase Auth continua a autenticar (login, sessões, recuperação de palavra-passe). Aqui:
 *   - valida-se o utilizador da sessão com o Supabase Auth (auth.getUser, com cache curta por token);
 *   - garante-se que existe perfil/cliente no MySQL — equivalente ao trigger handle_new_user;
 *   - sincroniza-se o email do perfil — equivalente ao trigger handle_user_email_updated.
 */
import { randomUUID } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from './pool'
import type { DbContext } from './types'

export type CtxMode = 'user' | 'user-or-service' | 'service'

type AuthLike = {
  getSession: () => Promise<{ data: { session: { access_token: string } | null } }>
  getUser: (jwt?: string) => Promise<{ data: { user: User | null }; error: unknown }>
}

const USER_CACHE_MS = 30_000
const userCache = new Map<string, { user: User; exp: number }>()

async function verifiedUser(auth: AuthLike): Promise<User | null> {
  let token: string | undefined
  try { token = (await auth.getSession()).data.session?.access_token } catch { token = undefined }
  if (!token) return null
  const hit = userCache.get(token)
  if (hit && hit.exp > Date.now()) return hit.user
  const { data, error } = await auth.getUser(token)
  if (error || !data.user) return null
  userCache.set(token, { user: data.user, exp: Date.now() + USER_CACHE_MS })
  if (userCache.size > 500) for (const [k, v] of userCache) if (v.exp < Date.now()) userCache.delete(k)
  return data.user
}

/**
 * Cria o perfil e o registo de cliente se ainda não existirem (como o trigger handle_new_user).
 * O papel é sempre 'client' — os metadados do registo são controlados pelo utilizador e não são fiáveis.
 */
export async function ensureProfile(user: Pick<User, 'id' | 'email' | 'user_metadata'>, opts: { role?: string } = {}): Promise<{ role: string }> {
  const pool = getPool()
  const [rows] = await pool.query<RowDataPacket[]>('SELECT `role`, `email` FROM `profiles` WHERE `id` = ?', [user.id])
  if (rows[0]) {
    if (user.email && rows[0].email !== user.email) {
      await pool.query('UPDATE `profiles` SET `email` = ? WHERE `id` = ?', [user.email, user.id]).catch(e => console.warn('[db] sync email', e.message))
    }
    return { role: rows[0].role }
  }
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const role = opts.role ?? 'client'
  await pool.query(
    `INSERT INTO \`profiles\` (\`id\`, \`email\`, \`full_name\`, \`phone\`, \`country\`, \`role\`)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE \`email\` = VALUES(\`email\`), \`full_name\` = COALESCE(VALUES(\`full_name\`), \`full_name\`)`,
    [user.id, user.email ?? '', String(meta.full_name ?? ''), meta.phone ? String(meta.phone) : null, String(meta.country ?? 'AO'), role],
  )
  await pool.query('INSERT INTO `clients` (`id`, `profile_id`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `profile_id` = `profile_id`', [randomUUID(), user.id])
  return { role }
}

/** ensureProfile com cache por processo: corre no máximo uma vez por utilizador/email enquanto o servidor estiver ativo. */
const ensured = new Map<string, string>()
export async function ensureProfileCached(user: Pick<User, 'id' | 'email' | 'user_metadata'>): Promise<void> {
  if (ensured.get(user.id) === (user.email ?? '')) return
  if (process.env.DB_DEBUG) console.info('[db] ensureProfile', user.id, user.email)
  await ensureProfile(user)
  ensured.set(user.id, user.email ?? '')
  if (ensured.size > 10_000) ensured.clear()
}

export async function resolveContext(mode: CtxMode, auth: AuthLike | null): Promise<DbContext> {
  if (mode === 'service' || !auth) return { role: mode === 'service' ? 'service' : 'anon' }
  const user = await verifiedUser(auth)
  if (!user) return mode === 'user-or-service' ? { role: 'service' } : { role: 'anon' }
  await ensureProfileCached(user)
  const [rows] = await getPool().query<RowDataPacket[]>('SELECT `role` FROM `profiles` WHERE `id` = ?', [user.id])
  const role = String(rows[0]?.role ?? 'client')
  return { role: 'authenticated', uid: user.id, isAdmin: role === 'admin', isStaff: role === 'admin' || role === 'reseller' }
}
