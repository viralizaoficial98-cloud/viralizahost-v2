import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { createWebmailSessionForMailbox, listCpanelEmails } from '@/lib/whm/client'

export async function POST(req: NextRequest) {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '0.0.0.0'
  const ua = req.headers.get('user-agent') ?? ''

  try {
    const body = await req.json() as { email?: string; hostingAccountId?: string }
    const email = (body.email ?? '').trim().toLowerCase()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Endereço de email inválido.' }, { status: 400 })
    }

    const [localpart, emailDomain] = email.split('@')
    if (!localpart || !emailDomain) {
      return NextResponse.json({ error: 'Formato de email inválido.' }, { status: 400 })
    }

    const db = createAdminWriteClient()

    // Build query — if a specific hosting account ID is supplied, use it; otherwise
    // find the first active hosting account whose primary domain matches the email domain.
    let haQuery = db
      .from('hosting_accounts')
      .select('id, cpanel_username, primary_domain, status, service_id')
      .eq('profile_id', user.id)
      .in('status', ['active', 'suspended', 'pending', 'expired'])

    if (body.hostingAccountId) {
      haQuery = haQuery.eq('id', body.hostingAccountId)
    } else {
      haQuery = haQuery.eq('primary_domain', emailDomain)
    }

    const { data: ha } = await haQuery.limit(1).maybeSingle()

    if (!ha) {
      return NextResponse.json({ error: 'Conta de hospedagem não encontrada para este email.' }, { status: 404 })
    }
    if ((ha as any).status === 'suspended') {
      return NextResponse.json({ error: 'Conta de hospedagem suspensa.' }, { status: 403 })
    }

    // Domain of the email must belong to this hosting account
    if ((ha as any).primary_domain !== emailDomain) {
      return NextResponse.json({ error: 'Este email não pertence ao seu domínio de hospedagem.' }, { status: 403 })
    }

    const whmCfg = await loadWhmConfig()
    if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

    // Verify the mailbox actually exists on the server before creating a session
    let mailboxExists = false
    try {
      const accounts = await listCpanelEmails(whmCfg.config, (ha as any).cpanel_username, (ha as any).primary_domain)
      mailboxExists = accounts.some(a => a.email.toLowerCase() === email)
    } catch (verifyErr) {
      // If the verify call fails, log and continue — session creation will still work
      // for valid accounts; we're protecting against typos/IDOR, not server failures.
      console.warn('[webmail-sso] mailbox verify failed, proceeding:', verifyErr instanceof Error ? verifyErr.message : verifyErr)
      mailboxExists = true
    }

    if (!mailboxExists) {
      return NextResponse.json({ error: 'Esta conta de e-mail não foi encontrada no servidor.' }, { status: 404 })
    }

    // Create a Webmail session pointing to the specific mailbox
    const session = await createWebmailSessionForMailbox(
      whmCfg.config,
      (ha as any).cpanel_username,
      email,
    )

    console.log('[WEBMAIL SSO]', JSON.stringify({
      profile_id:       user.id,
      whm_username:     (ha as any).cpanel_username,
      requested_mailbox: email,
      domain:           emailDomain,
      mailbox_exists:   mailboxExists,
      result:           'success',
    }))

    // Audit log (best-effort)
    try {
      await db.from('sso_audit_logs').insert({
        profile_id:         user.id,
        service_id:         (ha as any).service_id ?? null,
        hosting_account_id: (ha as any).id,
        access_type:        'webmail',
        ip_address:         ip,
        user_agent:         ua,
        success:            true,
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ redirectUrl: session.url })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[webmail-sso]', msg)

    try {
      const db = createAdminWriteClient()
      await db.from('sso_audit_logs').insert({
        profile_id:  user.id,
        access_type: 'webmail',
        ip_address:  ip,
        user_agent:  ua,
        success:     false,
        error_message: msg.slice(0, 500),
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ error: 'Não foi possível criar a sessão segura do Webmail.' }, { status: 502 })
  }
}
