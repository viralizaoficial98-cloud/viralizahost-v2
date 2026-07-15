import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    await requireAdminRole()

    const { searchParams } = new URL(req.url)
    const status  = searchParams.get('status')  // active | suspended | missing_from_whm
    const linked  = searchParams.get('linked')  // true | false
    const search  = searchParams.get('search')?.toLowerCase()
    const pkg     = searchParams.get('package')
    const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit   = 50

    const db = createAdminWriteClient()

    let q = db
      .from('whm_accounts')
      .select(`
        id, server_id, whm_username, primary_domain, contact_email,
        package_name, ip_address, disk_used_mb, disk_limit_mb,
        is_suspended, suspension_reason, status, last_synced_at,
        profile_id, service_id, hosting_account_id,
        profiles(id, full_name, email),
        services(id, status, plan_id, plans(name))
      `, { count: 'exact' })
      .order('primary_domain', { ascending: true })
      .range((page - 1) * limit, page * limit - 1)

    if (status) q = q.eq('status', status)
    if (pkg)    q = q.eq('package_name', pkg)
    if (linked === 'true')  q = q.not('profile_id', 'is', null)
    if (linked === 'false') q = q.is('profile_id', null)

    const { data, count, error } = await q

    if (error) {
      console.error('[whm/accounts GET]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Client-side search filter (PostgREST doesn't support case-insensitive OR easily)
    const rows = data ?? []
    const filtered = search
      ? rows.filter((r: Record<string, unknown>) =>
          String(r.primary_domain ?? '').toLowerCase().includes(search) ||
          String(r.whm_username   ?? '').toLowerCase().includes(search) ||
          String(r.contact_email  ?? '').toLowerCase().includes(search) ||
          String((r.profiles as Record<string, unknown> | null)?.full_name ?? '').toLowerCase().includes(search)
        )
      : rows

    return NextResponse.json({ data: filtered, total: count ?? 0, page, limit })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}
