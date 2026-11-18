import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { isMysqlBackend } from '@/lib/db/backend'
import { makeHybridClient } from '@/lib/db/hybrid'

/*
 * Com NEXT_PUBLIC_DATA_BACKEND=mysql estas fábricas devolvem um cliente híbrido:
 * Auth e Storage continuam no Supabase; .from() e .rpc() vão para o MySQL com as mesmas regras de acesso
 * que o PostgREST aplicava (utilizador da sessão → políticas; service role → sem restrições).
 */

// ── Anon client — reads user session from cookies, db schema for table queries
export async function createClient() {
  const cookieStore = await cookies()
  const sb = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'viralizahost' },
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
  return isMysqlBackend() ? makeHybridClient(sb, 'user') : sb
}

// ── Admin client — service role + db schema for table queries
export async function createAdminClient() {
  const cookieStore = await cookies()
  const sb = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: 'viralizahost' },
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
  return isMysqlBackend() ? makeHybridClient(sb, 'user-or-service') : sb
}

// ── RPC client — service role WITHOUT db.schema
// PostgREST only accepts Content-Profile for schemas listed in "Exposed Schemas".
// RPC functions in the public schema are always accessible without a schema header.
// Use this client for ALL .rpc() calls.
export function createRpcClient() {
  const sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  return isMysqlBackend() ? makeHybridClient(sb, 'service') : sb
}

// ── Admin write client — plain supabase-js, service role, viralizahost schema
// Unlike createAdminClient (which uses @supabase/ssr and injects the user's
// session JWT from cookies), this client ALWAYS sends the service_role JWT.
// Use for all admin INSERT / UPDATE / DELETE operations.
export function createAdminWriteClient() {
  const sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'viralizahost' },
    }
  )
  return isMysqlBackend() ? makeHybridClient(sb, 'service') : sb
}

// ── Auth-only client — reads user session from cookies, NO db.schema
// Use for auth.getUser() so the schema header is never sent to the auth service.
export async function createAuthClient() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
  return isMysqlBackend() ? makeHybridClient(sb, 'user') : sb
}

// ── Cliente service role sem cookies (substitui createClient(url, SERVICE_ROLE_KEY) direto nas rotas)
export function createServiceClient() {
  const sb = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  return isMysqlBackend() ? makeHybridClient(sb, 'service') : sb
}
