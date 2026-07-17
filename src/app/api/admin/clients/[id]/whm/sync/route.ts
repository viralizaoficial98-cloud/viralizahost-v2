import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { getAccount } from '@/lib/whm/client'

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
  const { data: wa } = await db.from('whm_accounts').select('*').eq('profile_id', profileId).maybeSingle()
  const { data: ha } = await db.from('hosting_accounts').select('*').eq('profile_id', profileId).maybeSingle()
  const username = wa?.whm_username ?? ha?.cpanel_username
  if (!username) return NextResponse.json({ error: 'Conta WHM não encontrada para este cliente.' }, { status: 404 })

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

  let acct: any
  try { acct = await getAccount(whmCfg.config, username) }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Erro WHM: ${msg}` }, { status: 502 })
  }

  if (!acct) return NextResponse.json({ error: 'Conta não encontrada no WHM.' }, { status: 404 })

  const now = new Date().toISOString()

  // Update whm_accounts
  if (wa?.id) {
    await db.from('whm_accounts').update({
      primary_domain:    acct.domain,
      package_name:      acct.plan,
      ip_address:        acct.ip,
      disk_used_mb:      acct.diskused ? parseInt(acct.diskused) : 0,
      is_suspended:      acct.suspended,
      suspension_reason: acct.suspendreason ?? null,
      php_version:       acct.phpversion,
      status:            acct.suspended ? 'suspended' : 'active',
      last_synced_at:    now,
      updated_at:        now,
    }).eq('id', wa.id)
  }

  // Update hosting_accounts
  if (ha?.id) {
    await db.from('hosting_accounts').update({
      primary_domain:    acct.domain,
      package_name:      acct.plan,
      ip_address:        acct.ip,
      disk_used_mb:      acct.diskused ? parseInt(acct.diskused) : 0,
      php_version:       acct.phpversion,
      status:            acct.suspended ? 'suspended' : 'active',
      suspension_reason: acct.suspendreason ?? null,
      last_synced_at:    now,
      updated_at:        now,
    }).eq('id', ha.id)
  }

  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'hosting_account',
    entity_id:   profileId,
    description: `Admin sincronizou conta WHM: ${username}`,
    metadata:    { action: 'whm_sync', admin_id: adminId, username },
  })).catch(() => {})

  return NextResponse.json({ success: true, account: acct })
}
