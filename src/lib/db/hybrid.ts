/*
 * Cliente "híbrido" (servidor): mantém o objeto do supabase-js para Auth e Storage, mas encaminha
 * .from() e .rpc() para o MySQL. Tem a mesma forma que o SupabaseClient, por isso o código existente
 * continua a funcionar sem alterações.
 */
import type { User } from '@supabase/supabase-js'
import { QueryBuilder, rpcResult } from './query'
import { executeQuery } from './executor'
import { callRpc } from './rpc'
import { resolveContext, ensureProfile, ensureProfileCached, type CtxMode } from './context'
import type { DbContext } from './types'

type UserResult = { data?: { user?: User | null } | null }
type AuthFn = (...args: unknown[]) => Promise<UserResult>
type AuthApi = Record<string | symbol, unknown> & { admin: Record<string | symbol, unknown> }
type ClientLike = { auth: AuthApi }

export function makeHybridClient<T extends object>(sb: T | null, mode: CtxMode): T {
  let ctxPromise: Promise<DbContext> | null = null
  const auth = sb ? (sb as unknown as ClientLike).auth : null
  const getCtx = () => (ctxPromise ??= resolveContext(mode, auth as unknown as Parameters<typeof resolveContext>[1]))

  const from = (table: string) => new QueryBuilder(table, async q => executeQuery(q, await getCtx()))
  const rpc = (name: string, args?: Record<string, unknown>) => rpcResult(callRpc(name, args ?? {}))
  const self: Record<string | symbol, unknown> = { from, rpc, schema: () => proxy }
  let wrappedAuth: unknown

  const proxy: T = new Proxy((sb ?? {}) as T, {
    get(target, prop, recv) {
      if (prop in self) return self[prop]
      if (prop === 'auth' && auth) return (wrappedAuth ??= wrapAuth(auth))
      if (!sb) throw new Error(`Cliente MySQL sem Supabase: propriedade ${String(prop)} indisponível`)
      return Reflect.get(target, prop, recv)
    },
  })
  return proxy
}

/** Reproduz no MySQL os triggers de auth.users (criação de perfil e sincronização do email). */
function wrapAuth(auth: AuthApi) {
  const admin = new Proxy(auth.admin, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv)
      if (prop === 'createUser') return async (attrs: unknown) => {
        const r = await (v as AuthFn).call(target, attrs)
        if (r?.data?.user) await ensureProfile(r.data.user as User).catch(e => console.error('[db] ensureProfile após createUser', e))
        return r
      }
      if (prop === 'updateUserById') return async (id: string, attrs: unknown) => {
        const r = await (v as AuthFn).call(target, id, attrs)
        if (r?.data?.user) await ensureProfile(r.data.user as User).catch(e => console.error('[db] sincronizar email', e))
        return r
      }
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
  return new Proxy(auth, {
    get(target, prop, recv) {
      if (prop === 'admin') return admin
      const v = Reflect.get(target, prop, recv)
      // Equivalente ao trigger on_auth_user_created: o primeiro getUser() validado garante perfil + cliente no MySQL
      if (prop === 'getUser') return async (...args: unknown[]) => {
        const r = await (v as AuthFn).apply(target, args)
        if (process.env.DB_DEBUG) console.info('[db] getUser', r?.data?.user?.id ?? null)
        if (r?.data?.user) await ensureProfileCached(r.data.user as User).catch(e => console.error('[db] ensureProfile após getUser', e))
        return r
      }
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
}
