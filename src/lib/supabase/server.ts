/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
// Mantém os nomes usados em todo o projeto, agora sobre MariaDB (src/lib/db).
//   createClient()           → sessão do utilizador; aplica as regras RLS (src/lib/db/policies.ts)
//   createAdminClient()      → papel service (sem RLS), como a service_role key
//   createAdminWriteClient() → papel service
//   createRpcClient()        → papel service (funções RPC portadas em src/lib/db/rpc.ts)
//   createAuthClient()       → auth.getUser() / signIn / signOut com o cookie de sessão
import 'server-only'
import { cookies } from 'next/headers'
import { makeDbClient, ctxFromJar, type DbClient } from '@/lib/db/server-client'
import type { CookieJar } from '@/lib/auth/server'

async function cookieJar(): Promise<CookieJar> {
  const store = await cookies()
  return {
    get: (name) => store.get(name),
    set: (name, value, opts) => {
      try { store.set(name, value, opts as any) } catch { /* Server Component: só leitura */ }
    },
  }
}

export async function createClient(): Promise<DbClient> {
  const jar = await cookieJar()
  return makeDbClient(() => ctxFromJar(jar), jar)
}

export async function createAdminClient(): Promise<DbClient> {
  const jar = await cookieJar()
  return makeDbClient(async () => ({ role: 'service' }), jar)
}

export function createRpcClient(): DbClient {
  return makeDbClient(async () => ({ role: 'service' }))
}

export function createAdminWriteClient(): DbClient {
  return makeDbClient(async () => ({ role: 'service' }))
}

export async function createAuthClient(): Promise<DbClient> {
  const jar = await cookieJar()
  return makeDbClient(() => ctxFromJar(jar), jar)
}
