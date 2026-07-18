import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { getAccount, listCpanelEmails, listCpanelDatabases } from '@/lib/whm/client'

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
  const username   = (wa as any)?.whm_username ?? (ha as any)?.cpanel_username
  const mainDomain = (ha as any)?.primary_domain ?? (wa as any)?.primary_domain ?? username

  if (!username) return NextResponse.json({ error: 'Conta WHM não encontrada para este cliente.' }, { status: 404 })

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

  const cfg = whmCfg.config

  let acct: Awaited<ReturnType<typeof getAccount>>
  try { acct = await getAccount(cfg, username) }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Erro WHM: ${msg}` }, { status: 502 })
  }

  if (!acct) return NextResponse.json({ error: 'Conta não encontrada no WHM.' }, { status: 404 })

  // Fetch email count and db count from cPanel UAPI in parallel
  const [emailsResult, dbsResult] = await Promise.allSettled([
    listCpanelEmails(cfg, username, mainDomain),
    listCpanelDatabases(cfg, username),
  ])

  const emailCount = emailsResult.status === 'fulfilled' ? emailsResult.value.length : null
  const dbCount    = dbsResult.status    === 'fulfilled' ? dbsResult.value.length    : null

  console.log(`[WHM SYNC][${username}] account OK | emails=${emailCount ?? 'err'} dbs=${dbCount ?? 'err'}`)

  const now = new Date().toISOString()

  // Update whm_accounts
  if ((wa as any)?.id) {
    await db.from('whm_accounts').update({
      primary_domain:    acct.domain,
      package_name:      acct.plan,
      ip_address:        acct.ip,
      disk_used_mb:      acct.diskused ? parseInt(acct.diskused) : 0,
      is_suspended:      acct.suspended,
      suspension_reason: (acct as any).suspendreason ?? null,
      php_version:       acct.phpversion,
      status:            acct.suspended ? 'suspended' : 'active',
      last_synced_at:    now,
      updated_at:        now,
    }).eq('id', (wa as any).id)
  }

  // Update hosting_accounts — include live email_count and db_count
  if ((ha as any)?.id) {
    const updates: Record<string, unknown> = {
      primary_domain:    acct.domain,
      package_name:      acct.plan,
      ip_address:        acct.ip,
      disk_used_mb:      acct.diskused ? parseInt(acct.diskused) : 0,
      php_version:       acct.phpversion,
      status:            acct.suspended ? 'suspended' : 'active',
      suspension_reason: (acct as any).suspendreason ?? null,
      last_synced_at:    now,
      updated_at:        now,
    }
    if (emailCount !== null) updates.email_count = emailCount
    if (dbCount    !== null) updates.db_count    = dbCount
    await db.from('hosting_accounts').update(updates).eq('id', (ha as any).id)
  }

  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'hosting_account',
    entity_id:   profileId,
    description: `Admin sincronizou conta WHM: ${username} (emails=${emailCount ?? '?'}, dbs=${dbCount ?? '?'})`,
    metadata:    { action: 'whm_sync', admin_id: adminId, username, email_count: emailCount, db_count: dbCount },
  })).catch(() => {})

  return NextResponse.json({
    success: true,
    account: acct,
    email_count: emailCount,
    db_count: dbCount,
  })
}
