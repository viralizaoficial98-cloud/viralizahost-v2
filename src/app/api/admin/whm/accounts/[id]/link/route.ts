import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

interface LinkByProfile { profile_id: string }
interface LinkByEmail   { email: string; full_name?: string }
type LinkBody = LinkByProfile | LinkByEmail

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminRole()
    const { id: whmAccountId } = await params
    const body = await req.json() as LinkBody

    const db = createAdminWriteClient()
    const now = new Date().toISOString()

    // Load the whm_account
    const { data: whmAcct, error: whmErr } = await db
      .from('whm_accounts')
      .select('id, server_id, whm_username, primary_domain, package_name, ip_address, disk_used_mb, disk_limit_mb, is_suspended, php_version, account_created_at')
      .eq('id', whmAccountId)
      .maybeSingle()

    if (whmErr) return NextResponse.json({ error: whmErr.message }, { status: 500 })
    if (!whmAcct) return NextResponse.json({ error: 'Conta WHM não encontrada.' }, { status: 404 })

    const acct = whmAcct as {
      id: string; server_id: string; whm_username: string; primary_domain: string
      package_name: string | null; ip_address: string | null; disk_used_mb: number
      disk_limit_mb: number | null; is_suspended: boolean; php_version: string | null
      account_created_at: string | null
    }

    let profileId: string

    if ('profile_id' in body) {
      // ── Link to existing profile ────────────────────────────────────────────
      const { data: prof, error: profErr } = await db
        .from('profiles')
        .select('id')
        .eq('id', body.profile_id)
        .maybeSingle()
      if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })
      if (!prof) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
      profileId = (prof as { id: string }).id

    } else {
      // ── Create new profile from email ───────────────────────────────────────
      const email = body.email?.trim().toLowerCase()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
      }

      // Check if profile already exists with this email
      const { data: existingProf } = await db
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingProf) {
        profileId = (existingProf as { id: string }).id
      } else {
        const fullName = body.full_name?.trim() ||
          (acct.primary_domain.split('.')[0] ?? acct.whm_username)

        const { data: authData, error: authErr } = await db.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, source: 'whm_manual_link' },
        })
        if (authErr) return NextResponse.json({ error: `[auth] ${authErr.message}` }, { status: 500 })
        if (!authData?.user) return NextResponse.json({ error: '[auth] No user returned' }, { status: 500 })

        const newUserId = authData.user.id

        const { data: profRow, error: profInsErr } = await db
          .from('profiles')
          .upsert({
            id: newUserId, email, full_name: fullName,
            role: 'client', is_active: true,
            created_at: now, updated_at: now,
          }, { onConflict: 'id' })
          .select('id').single()

        if (profInsErr) return NextResponse.json({ error: `[profiles] ${profInsErr.message}` }, { status: 500 })
        if (!profRow) return NextResponse.json({ error: '[profiles] No row returned' }, { status: 500 })

        profileId = (profRow as { id: string }).id

        await db.from('clients').upsert({
          profile_id: newUserId, notes: 'Criado via associação manual WHM',
          created_at: now, updated_at: now,
        }, { onConflict: 'profile_id' })
      }
    }

    // ── Load server to get plan fallback ──────────────────────────────────────
    const { data: mappingRow } = await db
      .from('whm_package_mappings')
      .select('plan_id')
      .eq('server_id', acct.server_id)
      .eq('whm_package_name', acct.package_name ?? '')
      .maybeSingle()

    const { data: fallbackPlan } = await db
      .from('plans')
      .select('id')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1).maybeSingle()

    const planId: string | null =
      (mappingRow as { plan_id?: string | null } | null)?.plan_id ??
      (fallbackPlan as { id?: string } | null)?.id ??
      null

    // ── Check if hosting_account already exists ───────────────────────────────
    const { data: existingHa } = await db
      .from('hosting_accounts')
      .select('id')
      .eq('cpanel_username', acct.whm_username)
      .maybeSingle()

    let haId: string

    if (existingHa) {
      haId = (existingHa as { id: string }).id
      await db.from('hosting_accounts').update({
        profile_id: profileId, updated_at: now,
      }).eq('id', haId)
    } else {
      // ── Create service ──────────────────────────────────────────────────────
      const { data: newSvc, error: svcErr } = await db
        .from('services')
        .insert({
          profile_id:    profileId,
          plan_id:       planId,
          server_id:     acct.server_id,
          status:        acct.is_suspended ? 'suspended' : 'active',
          billing_cycle: 'monthly',
          price:         0,
          currency:      'AKZ',
          started_at:    acct.account_created_at ?? now,
          notes:         `WHM manual link — pacote: ${acct.package_name || 'desconhecido'}`,
          created_at:    now, updated_at: now,
        })
        .select('id').single()

      if (svcErr) return NextResponse.json({ error: `[services] ${svcErr.message}` }, { status: 500 })
      if (!newSvc) return NextResponse.json({ error: '[services] No row returned' }, { status: 500 })

      const serviceId = (newSvc as { id: string }).id

      // ── Create hosting_account ──────────────────────────────────────────────
      const { data: newHa, error: haErr } = await db
        .from('hosting_accounts')
        .insert({
          service_id:        serviceId,
          profile_id:        profileId,
          server_id:         acct.server_id,
          cpanel_username:   acct.whm_username,
          primary_domain:    acct.primary_domain,
          status:            acct.is_suspended ? 'suspended' : 'active',
          disk_used_mb:      acct.disk_used_mb,
          bandwidth_used_mb: 0,
          email_count:       0,
          db_count:          0,
          php_version:       acct.php_version || '8.2',
          ssl_enabled:       false,
        })
        .select('id').single()

      if (haErr) return NextResponse.json({ error: `[hosting_accounts] ${haErr.message}` }, { status: 500 })
      if (!newHa) return NextResponse.json({ error: '[hosting_accounts] No row returned' }, { status: 500 })

      haId = (newHa as { id: string }).id

      await db.from('hosting_accounts').update({
        disk_limit_mb: acct.disk_limit_mb,
        package_name:  acct.package_name,
        ip_address:    acct.ip_address,
        last_synced_at: now,
      }).eq('id', haId)

      // Update service with hosting_account reference if column exists
      await db.from('services').update({ updated_at: now }).eq('id', serviceId)
    }

    // ── Update whm_account links ───────────────────────────────────────────────
    const { error: updateErr } = await db.from('whm_accounts').update({
      profile_id:           profileId,
      hosting_account_id:   haId,
      sync_status:          'linked',
      link_status:          'linked',
      requires_manual_link: false,
      notes:                null,
      updated_at:           now,
    }).eq('id', whmAccountId)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}
