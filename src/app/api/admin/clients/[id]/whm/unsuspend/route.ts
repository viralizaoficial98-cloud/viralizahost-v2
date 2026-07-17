import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { unsuspendAccount } from '@/lib/whm/client'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  const { data: wa } = await db.from('whm_accounts').select('whm_username, id').eq('profile_id', profileId).maybeSingle()
  const { data: ha } = await db.from('hosting_accounts').select('cpanel_username, id').eq('profile_id', profileId).maybeSingle()
  const username = wa?.whm_username ?? ha?.cpanel_username
  if (!username) return NextResponse.json({ error: 'Conta WHM não encontrada.' }, { status: 404 })

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

  try {
    await unsuspendAccount(whmCfg.config, username)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Erro WHM: ${msg}` }, { status: 502 })
  }

  const now = new Date().toISOString()
  if (wa?.id) await db.from('whm_accounts').update({ is_suspended: false, suspension_reason: null, updated_at: now }).eq('id', wa.id)
  if (ha?.id) await db.from('hosting_accounts').update({ status: 'active', suspension_reason: null, updated_at: now }).eq('id', ha.id)

  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'hosting_account',
    entity_id:   profileId,
    description: `Admin reativou conta WHM: ${username}`,
    metadata:    { action: 'whm_unsuspend', admin_id: adminId, username },
  })).catch(() => {})

  console.info('[ADMIN WHM UNSUSPEND]', { adminId, profileId, username })
  return NextResponse.json({ success: true })
}
