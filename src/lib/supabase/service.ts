// Substitui `createClient(url, serviceRoleKey)` de '@supabase/supabase-js' nos route handlers:
// devolve um cliente MariaDB com o papel service (sem RLS). Os argumentos são ignorados.
import 'server-only'
import { serviceClient, type DbClient } from '@/lib/db/server-client'

export function createClient(..._args: unknown[]): DbClient {
  return serviceClient()
}
