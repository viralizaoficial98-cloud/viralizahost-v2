/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
// Cliente do browser com a mesma API usada pelos componentes ('use client').
// Não fala com a base de dados: envia cada consulta para /api/db, onde o servidor
// identifica o utilizador pelo cookie HttpOnly e aplica as regras de acesso.
import { QueryBuilder, type Row } from '@/lib/db/builder'
import type { DbResult, QueryDescriptor } from '@/lib/db/types'

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin', cache: 'no-store' })
  return res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
}

const execRemote = async (q: QueryDescriptor): Promise<DbResult> => {
  try { return await postJson('/api/db', { q }) } catch (e) {
    return { data: null, error: { message: (e as Error).message, code: 'NETWORK', details: null, hint: null }, count: null, status: 0, statusText: 'Network error' }
  }
}

type Listener = (event: string, session: { user: any } | null) => void

const auth = {
  async getUser() { const r = await fetch('/api/auth/user', { cache: 'no-store', credentials: 'same-origin' }); return r.json() },
  async getSession() { const r = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' }); return r.json() },
  signInWithPassword: (creds: { email: string; password: string }) => postJson('/api/auth/login', creds),
  signUp: (body: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => postJson('/api/auth/signup', body),
  signOut: () => postJson('/api/auth/logout', {}),
  updateUser: (attrs: { password?: string; email?: string; data?: Record<string, unknown> }) => postJson('/api/auth/update', attrs),
  resetPasswordForEmail: (email: string, opts: { redirectTo?: string } = {}) => postJson('/api/auth/recover', { email, redirectTo: opts.redirectTo }),
  /**
   * Emula os eventos do Supabase: se o URL tiver ?type=recovery&token=..., valida o link,
   * cria a sessão e emite PASSWORD_RECOVERY; caso contrário emite INITIAL_SESSION.
   */
  onAuthStateChange(cb: Listener) {
    let active = true
    ;(async () => {
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      const token = url.searchParams.get('token') ?? hash.get('token') ?? url.searchParams.get('code')
      const type = url.searchParams.get('type') ?? hash.get('type') ?? (url.searchParams.get('code') ? 'recovery' : null)
      if (token && type === 'recovery') {
        const r = await postJson('/api/auth/verify', { token })
        url.searchParams.delete('token'); url.searchParams.delete('type'); url.searchParams.delete('code')
        window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''))
        if (active && !r.error) cb('PASSWORD_RECOVERY', { user: r.data.user })
        return
      }
      const s = await auth.getSession()
      if (active) cb(s?.data?.session ? 'INITIAL_SESSION' : 'SIGNED_OUT', s?.data?.session ?? null)
    })()
    return { data: { subscription: { unsubscribe() { active = false } } } }
  },
}

function storageFrom(bucket: string) {
  const objUrl = (path: string) => `/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
  return {
    async upload(path: string, file: Blob | File, opts: { upsert?: boolean; contentType?: string; cacheControl?: string } = {}) {
      const res = await fetch(objUrl(path), {
        method: 'POST', body: file, credentials: 'same-origin',
        headers: { 'Content-Type': opts.contentType || file.type || 'application/octet-stream', 'x-upsert': opts.upsert ? 'true' : 'false' },
      })
      const j = await res.json().catch(() => ({}))
      return res.ok ? { data: { path, id: path, fullPath: `${bucket}/${path}` }, error: null } : { data: null, error: { message: j.message ?? `HTTP ${res.status}`, statusCode: String(res.status) } }
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: `${window.location.origin}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}` } }
    },
    async createSignedUrl(path: string, expiresIn: number) {
      const j = await postJson('/api/storage/sign', { bucket, path, expiresIn })
      return j.error ? { data: null, error: j.error } : { data: { signedUrl: j.signedUrl }, error: null }
    },
    async remove(paths: string[]) {
      const j = await postJson('/api/storage/remove', { bucket, paths })
      return j.error ? { data: null, error: j.error } : { data: paths.map((name) => ({ name })), error: null }
    },
  }
}

const client = {
  from: <T = Row>(table: string) => new QueryBuilder<T[]>(execRemote, table),
  schema: () => client,
  auth,
  storage: { from: storageFrom },
}

export type BrowserClient = typeof client

export function createClient(): BrowserClient { return client }
export function createAuthClient(): BrowserClient { return client }
export const createStorageClient = createAuthClient
