import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from './config'
import { createUserSession } from '@/lib/whm/client'


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
      .select('id, cpanel_username, status, profile_id, server_id')
      .eq('service_id', serviceId)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!ha) {
      return NextResponse.json({ error: 'Conta de hospedagem não encontrada.' }, { status: 404 })
    }

    const haTyped = ha as { id: string; cpanel_username: string; status: string; profile_id: string; server_id: string | null }

    if (haTyped.status === 'suspended') {
      return NextResponse.json({ error: 'Esta conta de hospedagem está suspensa.' }, { status: 403 })
    }

    // ── 4. Credenciais do servidor da conta (mecanismo único: loadWhmConfig) ──
    // Contas antigas podem apontar para um servidor sem credenciais próprias: usa a configuração principal
    const whmCfg = (haTyped.server_id ? await loadWhmConfig(haTyped.server_id) : null) ?? await loadWhmConfig()
    if (!whmCfg) {
      return NextResponse.json({ error: 'Integração WHM não configurada.' }, { status: 503 })
    }

    // ── 5. Call WHM to create session ─────────────────────────────────────────
    const whmService = accessType === 'cpanel' ? 'cpaneld' : 'webmaild'
    const session = await createUserSession(
      whmCfg.config,
      haTyped.cpanel_username,
      whmService,
    )

    // ── 6. Write audit log (best-effort — never fails the SSO) ───────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('x-real-ip')
      ?? '0.0.0.0'
    const ua = req.headers.get('user-agent') ?? ''

    try {
      await db.from('sso_audit_logs').insert({
        profile_id:         user.id,
        service_id:         serviceId,
        hosting_account_id: haTyped.id,
        access_type:        accessType,
        ip_address:         ip,
        user_agent:         ua,
        success:            true,
      })
    } catch { /* audit log failure is non-fatal */ }

    return NextResponse.json({ redirectUrl: session.url })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sso/${accessType}]`, msg)

    // Log the failure (best-effort — ignore if table doesn't exist)
    try {
      await db.from('sso_audit_logs').insert({
        profile_id:    user.id,
        service_id:    serviceId,
        access_type:   accessType,
        success:       false,
        error_message: msg,
      })
    } catch { /* ignore */ }

    return NextResponse.json({ error: 'Falha ao gerar sessão SSO.' }, { status: 500 })
  }
}
