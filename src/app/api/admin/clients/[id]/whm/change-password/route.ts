import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { changePassword } from '@/lib/whm/client'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const password = String(body.password ?? '').trim()
  if (!PASSWORD_RE.test(password)) {
    return NextResponse.json({ error: 'Senha inválida. Mínimo 8 caracteres, maiúscula, minúscula e número.' }, { status: 400 })
  }

  const db = createAdminWriteClient()
  const { data: wa } = await db.from('whm_accounts').select('whm_username').eq('profile_id', profileId).maybeSingle()
  const { data: ha } = await db.from('hosting_accounts').select('cpanel_username').eq('profile_id', profileId).maybeSingle()
  const username = wa?.whm_username ?? ha?.cpanel_username
  if (!username) return NextResponse.json({ error: 'Conta WHM não encontrada.' }, { status: 404 })

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

  try {
    await changePassword(whmCfg.config, username, password)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Erro WHM: ${msg}` }, { status: 502 })
  }

  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'hosting_account',
    entity_id:   profileId,
    description: `Admin alterou senha cPanel para conta: ${username}`,
    metadata:    { action: 'cpanel_password_change', admin_id: adminId, username },
    // NOTE: password is NEVER logged
  })).catch(() => {})

  console.info('[ADMIN CPANEL PASSWORD CHANGE]', { adminId, profileId, username })
  return NextResponse.json({ success: true })
}
