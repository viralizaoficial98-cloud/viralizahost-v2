import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminWriteClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import { createUserSession } from '@/lib/whm/client'

const WHM_CONFIG_NAME = '__whm_config__'

export async function handleSso(
  req: NextRequest,
  serviceId: string,
  accessType: 'cpanel' | 'webmail',
): Promise<NextResponse> {
  // ── 1. Authenticate the user ──────────────────────────────────────────────
  const userDb = await createClient()
  const { data: { user } } = await userDb.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const db = createAdminWriteClient()

  try {
    // ── 2. Verify service belongs to this user (IDOR protection) ─────────────
    const { data: service } = await db
      .from('services')
      .select('id, profile_id, server_id, status')
      .eq('id', serviceId)
      .maybeSingle()

    if (!service || (service as Record<string, unknown>).profile_id !== user.id) {
      return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 })
    }

    if ((service as Record<string, unknown>).status === 'suspended') {
      return NextResponse.json({ error: 'Este serviço está suspenso.' }, { status: 403 })
    }

    // ── 3. Get hosting account (also verifies profile_id) ────────────────────
    const { data: ha } = await db
      .from('hosting_accounts')
      .select('id, cpanel_username, status, profile_id')
      .eq('service_id', serviceId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!ha) {
      return NextResponse.json({ error: 'Conta de hospedagem não encontrada.' }, { status: 404 })
    }

    const haTyped = ha as { id: string; cpanel_username: string; status: string; profile_id: string }

    if (haTyped.status === 'suspended') {
      return NextResponse.json({ error: 'Esta conta de hospedagem está suspensa.' }, { status: 403 })
    }

    // ── 4. Load WHM config ────────────────────────────────────────────────────
    const { data: serverRow } = await db
      .from('servers')
      .select('whm_url, whm_api_token, whm_username')
      .eq('name', WHM_CONFIG_NAME)
      .maybeSingle()

    if (!serverRow?.whm_url || !serverRow?.whm_api_token) {
      return NextResponse.json({ error: 'Integração WHM não configurada.' }, { status: 503 })
    }

    const token = decryptSecret(serverRow.whm_api_token as string)
    if (!token) {
      return NextResponse.json({ error: 'Erro interno de configuração.' }, { status: 503 })
    }

    // ── 5. Call WHM to create session ─────────────────────────────────────────
    const whmService = accessType === 'cpanel' ? 'cpaneld' : 'webmaild'
    const session = await createUserSession(
      { url: serverRow.whm_url as string, token, username: (serverRow.whm_username as string) ?? 'root' },
      haTyped.cpanel_username,
      whmService,
    )

    // ── 6. Write audit log ────────────────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('x-real-ip')
      ?? '0.0.0.0'
    const ua = req.headers.get('user-agent') ?? ''

    await db.from('sso_audit_logs').insert({
      profile_id:         user.id,
      service_id:         serviceId,
      hosting_account_id: haTyped.id,
      access_type:        accessType,
      ip_address:         ip,
      user_agent:         ua,
      success:            true,
    })

    return NextResponse.json({ redirectUrl: session.url })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sso/${accessType}]`, msg)

    // Log the failure (best-effort)
    try {
      await db.from('sso_audit_logs').insert({
        profile_id:  user.id,
        service_id:  serviceId,
        access_type: accessType,
        success:     false,
        error_message: msg,
      })
    } catch { /* ignore log failure */ }

    return NextResponse.json({ error: 'Falha ao gerar sessão SSO.' }, { status: 500 })
  }
}
