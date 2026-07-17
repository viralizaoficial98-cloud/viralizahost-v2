import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { createUserSession } from '@/lib/whm/client'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const mode = (() => { try { return req.json().then(b => String((b as any).mode ?? 'cpanel')) } catch { return Promise.resolve('cpanel') } })()

  const db = createAdminWriteClient()
  const { data: ha } = await db.from('hosting_accounts').select('cpanel_username, primary_domain, status, id, service_id').eq('profile_id', profileId).maybeSingle()
  const { data: wa } = await db.from('whm_accounts').select('whm_username, is_suspended').eq('profile_id', profileId).maybeSingle()
  const username = ha?.cpanel_username ?? wa?.whm_username
  if (!username) return NextResponse.json({ error: 'Conta cPanel não encontrada.' }, { status: 404 })

  const isSuspended = ha?.status === 'suspended' || wa?.is_suspended
  if (isSuspended) return NextResponse.json({ error: 'Conta suspensa — SSO bloqueado.' }, { status: 403 })

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

  try {
    const { url } = await createUserSession(whmCfg.config, username, 'cpaneld')

    // Audit
    await Promise.resolve(db.from('sso_audit_logs').insert({
      profile_id:         adminId,
      service_id:         ha?.service_id ?? null,
      hosting_account_id: ha?.id         ?? null,
      access_type:        'cpanel',
      ip_address:         req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '0.0.0.0',
      user_agent:         req.headers.get('user-agent') ?? '',
      success:            true,
    })).catch(() => {})

    await Promise.resolve(db.from('activity_logs').insert({
      profile_id:  adminId,
      action:      'login',
      entity_type: 'hosting_account',
      entity_id:   profileId,
      description: `Admin abriu cPanel SSO para conta ${username}`,
      metadata:    { action: 'admin_cpanel_sso', admin_id: adminId, username },
    })).catch(() => {})

    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ error: `SSO falhou: ${msg}` }, { status: 502 })
  }
}
