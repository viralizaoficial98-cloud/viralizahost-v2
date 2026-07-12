import { createAdminClient, createAuthClient } from '@/lib/supabase/server'

export async function requireAdminRole(): Promise<string> {
  const auth = await createAuthClient()
  const { data: { user }, error: authErr } = await auth.auth.getUser()
  if (authErr || !user) throw Object.assign(new Error('Não autenticado'), { status: 401 })

  // profiles is in viralizahost schema — createAdminClient() has db.schema:'viralizahost'
  const supabase = await createAdminClient()
  const { data: profile, error: profileErr } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileErr) {
    console.error('[requireAdminRole] profiles query error:', {
      message: profileErr.message,
      code: profileErr.code,
      details: profileErr.details,
      hint: profileErr.hint,
      userId: user.id,
    })
  }

  console.log('[requireAdminRole] user:', user.id, user.email, '| profile:', profile, '| role:', profile?.role)

  if (profile?.role !== 'admin') {
    throw Object.assign(
      new Error(`Sem permissão de administrador (role actual: ${profile?.role ?? 'sem perfil'})`),
      { status: 403 }
    )
  }

  return user.id
}
