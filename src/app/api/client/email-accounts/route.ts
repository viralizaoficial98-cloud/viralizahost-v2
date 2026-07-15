import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { listCpanelEmails, addCpanelEmail, deleteCpanelEmail, changeCpanelEmailPassword, changeCpanelEmailQuota } from '@/lib/whm/client'

async function getClientHostingAccount(userId: string) {
  const db = createAdminWriteClient()
  const { data, error } = await db
    .from('hosting_accounts')
    .select('id, cpanel_username, primary_domain, status, service_id, email_count')
    .eq('profile_id', userId)
    .neq('status', 'missing_from_whm')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { id: string; cpanel_username: string; primary_domain: string; status: string; service_id: string; email_count: number } | null
}

// GET /api/client/email-accounts — list cPanel emails
export async function GET() {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const ha = await getClientHostingAccount(user.id)
    if (!ha) return NextResponse.json({ error: 'Nenhuma conta de hospedagem encontrada.' }, { status: 404 })
    if (ha.status === 'suspended') return NextResponse.json({ error: 'A sua conta de hospedagem está suspensa.' }, { status: 403 })

    const whmCfg = await loadWhmConfig()
    if (!whmCfg) return NextResponse.json({ error: 'Integração WHM não configurada.' }, { status: 503 })

    const emails = await listCpanelEmails(whmCfg.config, ha.cpanel_username, ha.primary_domain)

    // Update email_count in hosting_accounts (best-effort)
    try {
      const db = createAdminWriteClient()
      await db.from('hosting_accounts').update({ email_count: emails.length, updated_at: new Date().toISOString() }).eq('id', ha.id)
    } catch { /* non-fatal */ }

    return NextResponse.json({ emails, domain: ha.primary_domain, cpanel_username: ha.cpanel_username, hosting_account_id: ha.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email-accounts GET]', msg)
    return NextResponse.json({ error: `Falha ao carregar emails: ${msg}` }, { status: 500 })
  }
}

// POST /api/client/email-accounts — create email OR PATCH/DELETE via action param
export async function POST(req: NextRequest) {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const body = await req.json() as {
      action?: 'create' | 'change_password' | 'change_quota' | 'delete'
      localpart?: string
      email?: string
      password?: string
      quota?: number
    }
    const action = body.action ?? 'create'

    const ha = await getClientHostingAccount(user.id)
    if (!ha) return NextResponse.json({ error: 'Nenhuma conta de hospedagem encontrada.' }, { status: 404 })
    if (ha.status === 'suspended') return NextResponse.json({ error: 'A sua conta de hospedagem está suspensa.' }, { status: 403 })

    const whmCfg = await loadWhmConfig()
    if (!whmCfg) return NextResponse.json({ error: 'Integração WHM não configurada.' }, { status: 503 })

    if (action === 'create') {
      const { localpart, password, quota } = body
      if (!localpart || !password) return NextResponse.json({ error: 'localpart e password são obrigatórios.' }, { status: 400 })
      if (!/^[a-zA-Z0-9._%+\-]+$/.test(localpart)) return NextResponse.json({ error: 'Nome de utilizador inválido.' }, { status: 400 })
      if (password.length < 8) return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })

      await addCpanelEmail(whmCfg.config, ha.cpanel_username, ha.primary_domain, localpart, password, quota ?? 500)
      return NextResponse.json({ success: true, email: `${localpart}@${ha.primary_domain}` })
    }

    if (action === 'change_password') {
      const { email, password } = body
      if (!email || !password) return NextResponse.json({ error: 'email e password são obrigatórios.' }, { status: 400 })
      if (!email.endsWith(`@${ha.primary_domain}`)) return NextResponse.json({ error: 'Este email não pertence ao seu domínio.' }, { status: 403 })
      if (password.length < 8) return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 })
      const localpart = email.split('@')[0]
      await changeCpanelEmailPassword(whmCfg.config, ha.cpanel_username, ha.primary_domain, localpart, password)
      return NextResponse.json({ success: true })
    }

    if (action === 'change_quota') {
      const { email, quota } = body
      if (!email || quota === undefined) return NextResponse.json({ error: 'email e quota são obrigatórios.' }, { status: 400 })
      if (!email.endsWith(`@${ha.primary_domain}`)) return NextResponse.json({ error: 'Este email não pertence ao seu domínio.' }, { status: 403 })
      const localpart = email.split('@')[0]
      await changeCpanelEmailQuota(whmCfg.config, ha.cpanel_username, ha.primary_domain, localpart, quota)
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      const { email } = body
      if (!email) return NextResponse.json({ error: 'email é obrigatório.' }, { status: 400 })
      if (!email.endsWith(`@${ha.primary_domain}`)) return NextResponse.json({ error: 'Este email não pertence ao seu domínio.' }, { status: 403 })
      await deleteCpanelEmail(whmCfg.config, ha.cpanel_username, email)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[email-accounts POST]', msg)
    return NextResponse.json({ error: `Operação falhou: ${msg}` }, { status: 500 })
  }
}
