import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await params

  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const newPassword = String(body.password ?? '').trim()
  if (!newPassword) return NextResponse.json({ error: 'Senha obrigatória.' }, { status: 400 })
  if (!PASSWORD_RE.test(newPassword)) {
    return NextResponse.json({
      error: 'A senha deve ter ≥8 caracteres, maiúscula, minúscula, número e caractere especial.',
    }, { status: 400 })
  }

  // Use Supabase Admin Auth (service_role) — never exposed to browser
  const supabaseAdmin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  })

  if (error) {
    console.error('[admin/clients/portal-password]', error.message)
    return NextResponse.json({ error: 'Erro ao alterar senha.' }, { status: 500 })
  }

  // Audit — never log the password
  const db = createAdminWriteClient()
  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'client',
    entity_id:   targetUserId,
    description: `Admin alterou senha do Portal para utilizador ${targetUserId}`,
    metadata:    { action: 'portal_password_change', admin_id: adminId, target_user_id: targetUserId },
  })).catch(() => {})

  console.info('[ADMIN PORTAL PASSWORD CHANGE]', { adminId, targetUserId })
  return NextResponse.json({ success: true })
}
