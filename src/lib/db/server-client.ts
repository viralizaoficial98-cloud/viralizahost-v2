import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
import { QueryBuilder, type Row } from './builder'
import { executeQuery } from './executor'
import { callRpc } from './rpc'
import { sql } from './pool'
import type { AuthCtx } from './policies'
import type { DbResult } from './types'
import { authApi, getUserFromJar, type CookieJar } from '@/lib/auth/server'
import { storageApi } from '@/lib/storage/server'

/** Contexto de acesso a partir do cookie de sessão (papel authenticated ou anon). */
export async function ctxFromJar(jar: CookieJar): Promise<AuthCtx> {
  const user = await getUserFromJar(jar).catch(() => null)
  if (!user) return { role: 'anon' }
  const [p] = await sql<{ role: string | null }>('SELECT role FROM profiles WHERE id = ? LIMIT 1', [user.id])
  return { role: 'authenticated', uid: user.id, email: user.email, profileRole: p?.role ?? null }
}

type RpcPromise = Promise<DbResult> & { single(): Promise<DbResult>; maybeSingle(): Promise<DbResult> }

export interface DbClient {
  from<T = Row>(table: string): QueryBuilder<T[]>
  schema(_name: string): DbClient
  rpc(fn: string, args?: Record<string, unknown>): RpcPromise
  auth: ReturnType<typeof authApi>
  storage: typeof storageApi
}

/**
 * Cliente com a mesma superfície do supabase-js.
 * resolveCtx: 'service' ignora as regras RLS (equivalente à service_role key).
 */
export function makeDbClient(resolveCtx: () => Promise<AuthCtx>, jar: CookieJar = { get: () => undefined }): DbClient {
  let cached: Promise<AuthCtx> | null = null
  const ctx = () => (cached ??= resolveCtx())
  const client: DbClient = {
    from: <T = Row>(table: string) => new QueryBuilder<T[]>((q) => ctx().then((c) => executeQuery(q, c)), table),
    schema: () => client,
    rpc(fn, args) {
      const p = callRpc(fn, args ?? {}) as RpcPromise
      p.single = () => p
      p.maybeSingle = () => p
      return p
    },
    auth: authApi(jar),
    storage: storageApi,
  }
  return client
}

export const serviceClient = () => makeDbClient(async () => ({ role: 'service' }))
