import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
import { QueryBuilder, type DbClient } from './builder'
import { execute } from './executor'
import { callRpc } from './rpc'
import type { AuthContext } from './policies'
import type { DbResponse } from './types'
import {
  authError, createSession, createUser, deleteUser, destroyCurrentSession, getProfileRole, getSessionUser,
  getUserById, issueToken, setSessionCookie, signInWithPassword, siteUrl, updateUser, getUserByEmail,
  type AuthUser, type CreateUserInput, type UpdateUserInput,
} from '@/lib/auth/server'
import { sendAuthEmail } from '@/lib/auth/email'
import { createStorageApi } from '@/lib/storage/server'
import { getPool } from './pool'

export type ContextMode = 'session' | 'service' | 'session-or-service' | 'anon'

/** Resolve o AuthContext a partir do cookie de sessão. */
export async function resolveContext(mode: ContextMode): Promise<AuthContext> {
  if (mode === 'service') return { kind: 'service' }
  if (mode === 'anon') return { kind: 'anon' }
  const user = await getSessionUser()
  if (!user) return mode === 'session-or-service' ? { kind: 'service' } : { kind: 'anon' }
  return { kind: 'user', userId: user.id, role: await getProfileRole(user.id), email: user.email }
}

const noSession = () => ({ message: 'Auth session missing!', status: 400, code: 'session_missing', name: 'AuthSessionMissingError' as const })

function createAuthApi() {
  return {
    async getUser() {
      const user = await getSessionUser()
      return user ? { data: { user }, error: null } : { data: { user: null }, error: noSession() }
    },
    async getSession() {
      const user = await getSessionUser()
      return { data: { session: user ? { user, access_token: '', token_type: 'bearer' } : null }, error: null }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const r = await signInWithPassword(email, password)
      if ('error' in r) return { data: { user: null, session: null }, error: r.error }
      const s = await createSession(r.user.id)
      await setSessionCookie(s.token, s.expiresAt)
      return { data: { user: r.user, session: { user: r.user } }, error: null }
    },
    async signOut() {
      await destroyCurrentSession()
      return { error: null }
    },
    async updateUser(attrs: UpdateUserInput) {
      const user = await getSessionUser()
      if (!user) return { data: { user: null }, error: noSession() }
      const r = await updateUser(user.id, attrs)
      return 'error' in r ? { data: { user: null }, error: r.error } : { data: { user: r.user }, error: null }
    },
    async resetPasswordForEmail(email: string, opts: { redirectTo?: string } = {}) {
      return requestPasswordRecovery(email, opts.redirectTo)
    },
    async exchangeCodeForSession() {
      return { data: { session: null, user: null }, error: authError('Fluxo PKCE do Supabase já não é suportado', 400, 'flow_state_not_found') }
    },
    admin: {
      async createUser(input: CreateUserInput) {
        const r = await createUser(input)
        return 'error' in r ? { data: { user: null }, error: r.error } : { data: { user: r.user }, error: null }
      },
      async updateUserById(id: string, attrs: UpdateUserInput) {
        const r = await updateUser(id, attrs)
        return 'error' in r ? { data: { user: null }, error: r.error } : { data: { user: r.user }, error: null }
      },
      async getUserById(id: string) {
        const user = await getUserById(id)
        return user ? { data: { user }, error: null } : { data: { user: null }, error: authError('User not found', 404, 'user_not_found') }
      },
      async deleteUser(id: string) {
        await deleteUser(id)
        return { data: { user: null }, error: null }
      },
      async listUsers({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) {
        const [rows] = await getPool().query('SELECT id FROM auth_users ORDER BY created_at LIMIT ? OFFSET ?', [perPage, (page - 1) * perPage])
        const users: AuthUser[] = []
        for (const r of rows as { id: string }[]) users.push((await getUserById(r.id))!)
        return { data: { users }, error: null }
      },
    },
  }
}

/** Envia o e-mail de recuperação. Nunca revela se a conta existe. */
export async function requestPasswordRecovery(email: string, redirectTo?: string) {
  const user = await getUserByEmail(String(email ?? ''))
  if (user) {
    const target = (() => {
      try { return new URL(redirectTo ?? `${siteUrl()}/reset-password`).pathname } catch { return '/reset-password' }
    })()
    const token = await issueToken(user.id, 'recovery', target)
    const link = `${siteUrl()}/api/auth/verify?type=recovery&token_hash=${encodeURIComponent(token)}`
    const sent = await sendAuthEmail('recovery', user.email, link)
    if (!sent.ok) return { data: null, error: authError('Error sending recovery email', 500, 'unexpected_failure') }
  }
  return { data: {}, error: null }
}

export interface ServerDbClient extends DbClient {
  auth: ReturnType<typeof createAuthApi>
  storage: ReturnType<typeof createStorageApi>
}

/** Cliente com a mesma superfície usada do supabase-js (from/rpc/auth/storage). */
export function createServerDb(mode: ContextMode): ServerDbClient {
  let ctxPromise: Promise<AuthContext> | undefined
  const ctx = () => (ctxPromise ??= resolveContext(mode))
  const client: ServerDbClient = {
    from: <T = any>(table: string) => new QueryBuilder<T>(async d => execute(d, await ctx()), table),
    schema: () => client,
    async rpc<T = any>(fn: string, args?: Record<string, unknown>): Promise<DbResponse<T>> {
      // As funções eram SECURITY DEFINER: correm sempre com privilégios de serviço.
      return callRpc(fn, args) as Promise<DbResponse<T>>
    },
    auth: createAuthApi(),
    storage: createStorageApi(),
  }
  return client
}
