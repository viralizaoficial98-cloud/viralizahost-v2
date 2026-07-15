import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { createUserSession } from '@/lib/whm/client'

export async function POST(req: NextRequest) {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const { email } = await req.json() as { email?: string }

    const db = createAdminWriteClient()
    const { data: ha } = await db
      .from('hosting_accounts')
      .select('id, cpanel_username, primary_domain, status, service_id')
      .eq('profile_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!ha) return NextResponse.json({ error: 'Conta de hospedagem não encontrada.' }, { status: 404 })
    if ((ha as any).status === 'suspended') return NextResponse.json({ error: 'Conta suspensa.' }, { status: 403 })

    // Verify the email belongs to this domain
    if (email && !(email as string).endsWith(`@${(ha as any).primary_domain}`)) {
      return NextResponse.json({ error: 'Email não pertence ao seu domínio.' }, { status: 403 })
    }

    const whmCfg = await loadWhmConfig()
    if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

    const session = await createUserSession(whmCfg.config, (ha as any).cpanel_username, 'webmaild')

    // Audit log (best-effort)
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '0.0.0.0'
      await db.from('sso_audit_logs').insert({
        profile_id:         user.id,
        service_id:         (ha as any).service_id,
        hosting_account_id: (ha as any).id,
        access_type:        'webmail',
        ip_address:         ip,
        user_agent:         req.headers.get('user-agent') ?? '',
        success:            true,
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ redirectUrl: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[webmail-sso]', msg)
    return NextResponse.json({ error: 'Falha ao gerar sessão Webmail.' }, { status: 500 })
  }
}
