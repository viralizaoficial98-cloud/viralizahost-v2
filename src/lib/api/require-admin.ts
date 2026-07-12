import { createAdminClient, createAuthClient } from '@/lib/supabase/server'

export async function requireAdminRole(): Promise<string> {
  const auth = await createAuthClient()
  const { data: { user }, error: authErr } = await auth.auth.getUser()
  if (authErr || !user) throw Object.assign(new Error('Não autenticado'), { status: 401 })

  const supabase = await createAdminClient()
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw Object.assign(new Error('Sem permissão de administrador'), { status: 403 })
  }

  return user.id
}
