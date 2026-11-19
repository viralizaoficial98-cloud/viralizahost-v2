import 'server-only'
import { createServerDb } from '@/lib/db/server-client'

// Camada de compatibilidade: mantém os nomes usados em todo o projecto, mas os
// clientes já não falam com o Supabase — executam em MariaDB (src/lib/db).
// Semântica de acesso preservada:
//   createClient()           → utilizador da sessão (ou anónimo), com políticas (ex-RLS)
//   createAdminClient()      → como no @supabase/ssr com service key: se houver sessão,
//                              actua como esse utilizador (políticas aplicam-se);
//                              sem sessão, privilégios de serviço
//   createAdminWriteClient() → privilégios de serviço (ex-service_role)
//   createRpcClient()        → privilégios de serviço; .rpc() = funções portadas
//   createAuthClient()       → auth da sessão actual
//   createServiceClient()    → substitui createClient(url, SERVICE_ROLE_KEY) do supabase-js

export async function createClient() {
  return createServerDb('session')
}

export async function createAdminClient() {
  return createServerDb('session-or-service')
}

export function createRpcClient() {
  return createServerDb('service')
}

export function createAdminWriteClient() {
  return createServerDb('service')
}

export async function createAuthClient() {
  return createServerDb('session')
}

/** Ignora argumentos (URL/chave do Supabase) — mantidos só para compatibilidade de chamada. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createServiceClient(..._ignored: unknown[]) {
  return createServerDb('service')
}

/** Visitante anónimo sem ler cookies (não torna a página dinâmica) — ex-cliente com anon key. */
export function createAnonClient() {
  return createServerDb('anon')
}
