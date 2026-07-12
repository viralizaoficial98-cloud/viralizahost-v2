import { createAuthClient, createRpcClient } from '@/lib/supabase/server'

export async function requireAdminRole(): Promise<string> {
  const auth = await createAuthClient()
  const { data: { user }, error: authErr } = await auth.auth.getUser()
  if (authErr || !user) throw Object.assign(new Error('Não autenticado'), { status: 401 })

  // profiles is in the public schema — use createRpcClient() (no db.schema header)
  const supabase = createRpcClient()
  const { data: profile, error: profileErr } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileErr) {
    console.error('[requireAdminRole] profiles query error:', profileErr.message, profileErr.code)
  }

  if (profile?.role !== 'admin') {
    throw Object.assign(new Error('Sem permissão de administrador'), { status: 403 })
  }

  return user.id
}
