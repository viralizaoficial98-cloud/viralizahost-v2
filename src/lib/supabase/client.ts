import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

// ── DB client — for table queries (viralizahost schema)
// Only use for .from() calls, NOT for auth or storage.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'viralizahost' } }
  )
}

// ── Auth + Storage client — NO db.schema
// Use for: auth.getUser(), auth.signInWithPassword(), auth.signOut(),
//          storage.from(), and any call that must NOT send Content-Profile header.
export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Alias for clarity when used exclusively for storage
export const createStorageClient = createAuthClient
