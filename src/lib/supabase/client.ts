import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'
import { isMysqlBackend } from '@/lib/db/backend'
import { makeBrowserHybrid } from '@/lib/db/remote'

// ── DB client — for table queries (viralizahost schema)
// Only use for .from() calls, NOT for auth or storage.
// Com NEXT_PUBLIC_DATA_BACKEND=mysql, .from() passa por /api/db (servidor) em vez de ir ao PostgREST.
export function createClient() {
  const sb = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'viralizahost' } }
  )
  return isMysqlBackend() ? makeBrowserHybrid(sb) : sb
}

// ── Auth + Storage client — NO db.schema
// Use for: auth.getUser(), auth.signInWithPassword(), auth.signOut(),
//          storage.from(), and any call that must NOT send Content-Profile header.
export function createAuthClient() {
  const sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  // Algumas páginas (ex.: Definições) fazem .from() neste cliente: no MySQL vai para o schema da aplicação
  return isMysqlBackend() ? makeBrowserHybrid(sb) : sb
}

// Alias for clarity when used exclusively for storage
export const createStorageClient = createAuthClient
