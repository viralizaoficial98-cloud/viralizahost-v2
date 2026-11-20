/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
// Cliente do navegador (compatível com a API do supabase-js usada no projecto).
// Não contém credenciais: as consultas vão para /api/db, que as executa no
// servidor com a sessão do cookie httpOnly e as políticas de acesso (ex-RLS).
import { QueryBuilder, type DbClient } from '@/lib/db/builder'
import type { DbResponse, QueryDescriptor } from '@/lib/db/types'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body ?? {}),
  })
  try {
    return await res.json() as T
  } catch {
    return { data: null, error: { message: `HTTP ${res.status}`, status: res.status } } as T
  }
}

async function runQuery(q: QueryDescriptor): Promise<DbResponse> {
  try {
    return await postJson<DbResponse>('/api/db', q)
  } catch (e) {
    return { data: null, error: { message: (e as Error).message || 'Falha de rede', code: 'NETWORK', details: null, hint: null }, count: null, status: 0, statusText: 'Error' }
  }
}

export function createClient(): DbClient {
  const client: DbClient = {
    from: <T = any>(table: string) => new QueryBuilder<T>(runQuery, table),
    schema: () => client,
    async rpc<T = any>(): Promise<DbResponse<T>> {
      return { data: null as T, error: { message: 'RPC não disponível no navegador', code: 'PGRST202', details: null, hint: null }, count: null, status: 404, statusText: 'Not Found' }
    },
  }
  return client
}

type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED'
type Listener = (event: AuthEvent, session: { user: any } | null) => void
const listeners = new Set<Listener>()
const emit = (e: AuthEvent, s: { user: any } | null) => listeners.forEach(l => { try { l(e, s) } catch {} })

function createAuth() {
  return {
    async getUser() {
      const r = await postJson<{ user: any }>('/api/auth/user', {})
      return r?.user ? { data: { user: r.user }, error: null } : { data: { user: null }, error: { message: 'Auth session missing!', status: 400 } }
    },
    async getSession() {
      const r = await postJson<{ user: any }>('/api/auth/user', {})
      return { data: { session: r?.user ? { user: r.user } : null }, error: null }
    },
    async signInWithPassword(creds: { email: string; password: string }) {
      const r = await postJson<{ user?: any; error?: any }>('/api/auth/login', creds)
      if (r.error || !r.user) return { data: { user: null, session: null }, error: r.error ?? { message: 'Erro ao iniciar sessão' } }
      emit('SIGNED_IN', { user: r.user })
      return { data: { user: r.user, session: { user: r.user } }, error: null }
    },
    async signUp(input: { email: string; password: string; options?: { data?: Record<string, unknown>; emailRedirectTo?: string } }) {
      const r = await postJson<{ user?: any; session?: any; error?: any }>('/api/auth/signup', input)
      if (r.error) return { data: { user: null, session: null }, error: r.error }
      if (r.session) emit('SIGNED_IN', r.session)
      return { data: { user: r.user ?? null, session: r.session ?? null }, error: null }
    },
    async signOut() {
      await postJson('/api/auth/logout', {})
      emit('SIGNED_OUT', null)
      return { error: null }
    },
    async updateUser(attrs: { password?: string; email?: string; data?: Record<string, unknown> }) {
      const r = await postJson<{ user?: any; error?: any }>('/api/auth/update-user', attrs)
      if (r.error) return { data: { user: null }, error: r.error }
      emit('USER_UPDATED', { user: r.user })
      return { data: { user: r.user }, error: null }
    },
    async resetPasswordForEmail(email: string, opts: { redirectTo?: string } = {}) {
      const r = await postJson<{ error?: any }>('/api/auth/recover', { email, redirectTo: opts.redirectTo })
      return { data: r.error ? null : {}, error: r.error ?? null }
    },
    onAuthStateChange(cb: Listener) {
      listeners.add(cb)
      // Links de recuperação chegam como /reset-password?type=recovery (sessão já criada no servidor)
      queueMicrotask(async () => {
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
        const { data } = await this.getSession()
        if (params?.get('type') === 'recovery' && data.session) cb('PASSWORD_RECOVERY', data.session)
        else cb('INITIAL_SESSION', data.session)
      })
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
    },
  }
}

function createStorage() {
  return {
    from(bucket: string) {
      return {
        async upload(path: string, file: Blob, opts: { upsert?: boolean; contentType?: string } = {}) {
          const fd = new FormData()
          fd.append('bucket', bucket)
          fd.append('path', path)
          fd.append('upsert', opts.upsert ? 'true' : 'false')
          if (opts.contentType) fd.append('contentType', opts.contentType)
          fd.append('file', file)
          try {
            const res = await fetch('/api/storage/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
            const j = await res.json()
            return res.ok ? { data: j.data, error: null } : { data: null, error: j.error ?? { message: `HTTP ${res.status}` } }
          } catch (e) {
            return { data: null, error: { message: (e as Error).message } }
          }
        },
        getPublicUrl(path: string) {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          return { data: { publicUrl: `${origin}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}` } }
        },
      }
    },
  }
}

/** Cliente para auth + storage (mesmo nome de antes). */
export function createAuthClient() {
  return { ...createClient(), auth: createAuth(), storage: createStorage() }
}

export const createStorageClient = createAuthClient
