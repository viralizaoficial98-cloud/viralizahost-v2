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
    .in('status', ['active', 'suspended', 'pending', 'expired'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { id: string; cpanel_username: string; primary_domain: string; status: string; service_id: string; email_count: number } | null
}

// GET /api/client/email-accounts — list cPanel emails or purchased email packages
export async function GET() {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const db = createAdminWriteClient()
    const uid = user.id // profiles.id = auth.users.id — same UUID

    // ── 1. Check services table for email-type services ──────────────────────
    const { data: emailServices, error: svcErr } = await db
      .from('services')
      .select('id, service_name, service_type, status, created_at, order_id')
      .eq('profile_id', uid)
      .eq('service_type', 'email')
      .order('created_at', { ascending: false })
    if (svcErr) console.error('[email-accounts GET] services query error:', svcErr.message)

    // ── 2. Check orders + order_items for email purchases ────────────────────
    //    Fallback for when provision_order_services hasn't run yet.
    //    orders.user_id = auth.users.id = profiles.id
    const { data: orderRows, error: ordErr } = await db
      .from('orders')
      .select('id, status, created_at, billing_cycle, amount, order_items(id, service_name, service_type, price, quantity)')
      .eq('user_id', uid)
      .in('status', ['active', 'approved', 'paid', 'aguardando_confirmacao'])
      .order('created_at', { ascending: false })
    if (ordErr) console.error('[email-accounts GET] orders query error:', ordErr.message)

    const emailOrderItems: any[] = (orderRows ?? []).flatMap((o: any) =>
      (o.order_items ?? [])
        .filter((i: any) => {
          const t = (i.service_type ?? '').toLowerCase()
          const n = (i.service_name ?? '').toLowerCase()
          return t === 'email' || n.includes('email') || n.includes('e-mail') || n.includes('corporativo')
        })
        .map((i: any) => ({
          id: i.id,
          service_name: i.service_name,
          service_type: 'email',
          status: o.status === 'active' ? 'active' : 'pending_provisioning',
          created_at: o.created_at,
          order_id: o.id,
          billing_cycle: o.billing_cycle,
          price: i.price,
          source: 'order',
        }))
    )

    const hasEmailData = (emailServices ?? []).length > 0 || emailOrderItems.length > 0

    // ── 3. Check WHM hosting account ─────────────────────────────────────────
    const ha = await getClientHostingAccount(uid)

    console.log('[email-accounts GET]', {
      uid: uid.slice(0, 8),
      emailServicesCount: (emailServices ?? []).length,
      emailOrderItemsCount: emailOrderItems.length,
      hasHostingAccount: !!ha,
      hasEmailData,
    })

    // ── 4. No hosting, no email services, no email orders → empty (not error) ─
    if (!ha && !hasEmailData) {
      return NextResponse.json({
        emails: [],
        domain: null,
        cpanel_username: null,
        hosting_account_id: null,
        email_services: [],
        email_orders: [],
        provisioning: false,
        empty: true,
      })
    }

    // ── 5. Has email purchases but no WHM → provisioning state ───────────────
    if (!ha) {
      return NextResponse.json({
        emails: [],
        domain: null,
        cpanel_username: null,
        hosting_account_id: null,
        email_services: emailServices ?? [],
        email_orders: emailOrderItems,
        provisioning: true,
      })
    }

    if (ha.status === 'suspended') {
      return NextResponse.json({ error: 'A sua conta de hospedagem está suspensa.' }, { status: 403 })
    }

    // ── 6. Has hosting account → try WHM ────────────────────────────────────
    const whmCfg = await loadWhmConfig()
    if (!whmCfg) {
      return NextResponse.json({
        emails: [],
        domain: ha.primary_domain,
        cpanel_username: ha.cpanel_username,
        hosting_account_id: ha.id,
        email_services: emailServices ?? [],
        email_orders: emailOrderItems,
        provisioning: true,
      })
    }

    const emails = await listCpanelEmails(whmCfg.config, ha.cpanel_username, ha.primary_domain)

    try {
      await db.from('hosting_accounts').update({ email_count: emails.length, updated_at: new Date().toISOString() }).eq('id', ha.id)
    } catch { /* non-fatal */ }

    return NextResponse.json({
      emails,
      domain: ha.primary_domain,
      cpanel_username: ha.cpanel_username,
      hosting_account_id: ha.id,
      email_services: emailServices ?? [],
      email_orders: emailOrderItems,
      provisioning: false,
    })
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
