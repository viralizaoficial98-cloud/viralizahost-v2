import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await params

  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  // Fetch client email
  const { data: profile } = await db.from('profiles').select('email').eq('id', targetUserId).single()
  if (!profile) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin.auth.resetPasswordForEmail((profile as any).email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://viralizahost.com'}/reset-password`,
  })

  if (error) {
    console.error('[admin/clients/send-password-reset]', error.message)
    return NextResponse.json({ error: 'Erro ao enviar reset de senha.' }, { status: 500 })
  }

  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'client',
    entity_id:   targetUserId,
    description: `Admin enviou link de redefinição de senha para ${(profile as any).email}`,
    metadata:    { action: 'password_reset_sent', admin_id: adminId, email: (profile as any).email },
  })).catch(() => {})

  console.info('[ADMIN SEND PASSWORD RESET]', { adminId, email: (profile as any).email })
  return NextResponse.json({ success: true })
}
