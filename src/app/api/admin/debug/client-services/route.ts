import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  await requireAdminRole()

  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const db = createAdminWriteClient()

  // 1. Find profile by email
  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('id, email, full_name, role, is_active, created_at')
    .eq('email', email)
    .maybeSingle()

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'Profile not found for ' + email }, { status: 404 })

  const profileId = profile.id

  // 2. Orders (by user_id = profile.id since profiles.id = auth.users.id)
  const { data: orders, error: oErr } = await db
    .from('orders')
    .select('id, user_id, status, amount, billing_cycle, payment_method, domain_name, created_at, updated_at, order_items(id, service_name, service_type, price, quantity)')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(20)

  // 3. Services
  const { data: services, error: sErr } = await db
    .from('services')
    .select('id, profile_id, order_id, service_name, service_type, status, price, billing_cycle, created_at, updated_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  // 4. Hosting accounts
  const { data: hostingAccounts, error: haErr } = await db
    .from('hosting_accounts')
    .select('id, service_id, profile_id, cpanel_username, primary_domain, status, last_synced_at, created_at')
    .eq('profile_id', profileId)

  return NextResponse.json({
    profile,
    profileId,
    note: 'profiles.id = auth.users.id — same UUID used as orders.user_id',
    orders: orders ?? [],
    ordersError: oErr?.message ?? null,
    services: services ?? [],
    servicesError: sErr?.message ?? null,
    hostingAccounts: hostingAccounts ?? [],
    hostingAccountsError: haErr?.message ?? null,
    diagnosis: {
      ordersCount: (orders ?? []).length,
      approvedOrdersCount: (orders ?? []).filter((o: any) => ['active', 'approved', 'paid'].includes(o.status)).length,
      servicesCount: (services ?? []).length,
      hostingAccountsCount: (hostingAccounts ?? []).length,
      ordersWithoutServices: (orders ?? []).filter((o: any) =>
        ['active', 'approved', 'paid'].includes(o.status) &&
        !(services ?? []).some((s: any) => s.order_id === o.id)
      ).map((o: any) => o.id),
    },
  })
}
