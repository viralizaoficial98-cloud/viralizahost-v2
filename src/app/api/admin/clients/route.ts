import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/admin/clients ────────────────────────────────────────────────────
// Returns all profiles (clients) joined with clients, hosting_accounts, whm_accounts,
// open ticket count, pending invoice count.
export async function GET(req: NextRequest) {
  try { await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const { searchParams } = new URL(req.url)
  const q      = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const filter = searchParams.get('filter') ?? 'all'
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit  = 50

  const db = createAdminWriteClient()

  // Main profiles query with joined data
  const { data: profiles, error } = await db
    .from('profiles')
    .select(`
      id, email, full_name, phone, country, role, is_active, created_at,
      clients ( company_name, address, city, credit_balance, currency ),
      hosting_accounts (
        id, cpanel_username, primary_domain, status, disk_used_mb, disk_limit_mb,
        email_count, ip_address, package_name, last_synced_at, suspension_reason,
        server_id
      ),
      whm_accounts (
        id, whm_username, primary_domain, package_name, ip_address, is_suspended,
        suspension_reason, disk_used_mb, disk_limit_mb, last_synced_at, status,
        php_version, account_created_at
      ),
      domains ( id ),
      services ( id, status ),
      tickets ( id, status ),
      invoices ( id, status, total, amount_paid )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/clients GET]', error.message)
    return NextResponse.json({ error: 'Erro ao carregar clientes.' }, { status: 500 })
  }

  let list = (profiles ?? []) as any[]

  // Text search
  if (q) {
    list = list.filter(p => {
      const ha = p.hosting_accounts?.[0]
      const wa = p.whm_accounts?.[0]
      return (
        p.email?.toLowerCase().includes(q)              ||
        p.full_name?.toLowerCase().includes(q)          ||
        p.phone?.toLowerCase().includes(q)              ||
        p.clients?.[0]?.company_name?.toLowerCase().includes(q) ||
        ha?.primary_domain?.toLowerCase().includes(q)  ||
        ha?.cpanel_username?.toLowerCase().includes(q) ||
        wa?.primary_domain?.toLowerCase().includes(q)  ||
        wa?.whm_username?.toLowerCase().includes(q)    ||
        wa?.package_name?.toLowerCase().includes(q)
      )
    })
  }

  // Filter
  switch (filter) {
    case 'active':
      list = list.filter(p => p.is_active !== false)
      break
    case 'suspended':
      list = list.filter(p => p.is_active === false || p.whm_accounts?.[0]?.is_suspended)
      break
    case 'whm':
      list = list.filter(p => p.whm_accounts?.length > 0 || p.hosting_accounts?.length > 0)
      break
    case 'no_hosting':
      list = list.filter(p => !p.hosting_accounts?.length && !p.whm_accounts?.length)
      break
    case 'pending_payment':
      list = list.filter(p =>
        p.invoices?.some((i: any) => ['pending', 'overdue', 'under_review'].includes(i.status))
      )
      break
    case 'open_tickets':
      list = list.filter(p =>
        p.tickets?.some((t: any) => ['open', 'in_progress'].includes(t.status))
      )
      break
  }

  // Stats (from full unfiltered list)
  const all = (profiles ?? []) as any[]
  const stats = {
    total:           all.length,
    active:          all.filter(p => p.is_active !== false && !p.whm_accounts?.[0]?.is_suspended).length,
    suspended:       all.filter(p => p.is_active === false || p.whm_accounts?.[0]?.is_suspended).length,
    whm:             all.filter(p => p.whm_accounts?.length > 0).length,
    no_association:  all.filter(p => !p.hosting_accounts?.length && !p.whm_accounts?.length).length,
    pending_payment: all.filter(p => p.invoices?.some((i: any) => ['pending', 'overdue'].includes(i.status))).length,
    open_tickets:    all.filter(p => p.tickets?.some((t: any) => ['open', 'in_progress'].includes(t.status))).length,
  }

  // Paginate
  const total    = list.length
  const offset   = (page - 1) * limit
  const paginated = list.slice(offset, offset + limit)

  // Simplify each client record
  const clients = paginated.map(p => {
    const ha = p.hosting_accounts?.[0]
    const wa = p.whm_accounts?.[0]
    const openTickets   = p.tickets?.filter((t: any) => ['open', 'in_progress'].includes(t.status)).length ?? 0
    const pendingInvs   = p.invoices?.filter((i: any) => ['pending', 'overdue'].includes(i.status)).length ?? 0
    const pendingAmount = p.invoices
      ?.filter((i: any) => ['pending', 'overdue'].includes(i.status))
      .reduce((s: number, i: any) => s + Math.max(0, Number(i.total) - Number(i.amount_paid ?? 0)), 0) ?? 0
    return {
      id:              p.id,
      email:           p.email,
      full_name:       p.full_name,
      phone:           p.phone,
      country:         p.country,
      role:            p.role,
      is_active:       p.is_active,
      created_at:      p.created_at,
      company_name:    p.clients?.[0]?.company_name ?? null,
      // Hosting
      cpanel_username: ha?.cpanel_username ?? wa?.whm_username ?? null,
      primary_domain:  ha?.primary_domain  ?? wa?.primary_domain ?? null,
      package_name:    ha?.package_name    ?? wa?.package_name   ?? null,
      ip_address:      ha?.ip_address      ?? wa?.ip_address     ?? null,
      disk_used_mb:    ha?.disk_used_mb    ?? wa?.disk_used_mb   ?? 0,
      disk_limit_mb:   ha?.disk_limit_mb   ?? wa?.disk_limit_mb  ?? null,
      email_count:     ha?.email_count     ?? 0,
      last_synced_at:  ha?.last_synced_at  ?? wa?.last_synced_at ?? null,
      hosting_status:  ha?.status          ?? (wa ? (wa.is_suspended ? 'suspended' : 'active') : null),
      is_whm_suspended: wa?.is_suspended   ?? false,
      has_hosting:     !!(ha || wa),
      has_whm:         !!wa,
      domain_count:    p.domains?.length   ?? 0,
      service_count:   p.services?.length  ?? 0,
      open_tickets:    openTickets,
      pending_invoices: pendingInvs,
      pending_amount:  pendingAmount,
      currency:        p.clients?.[0]?.currency ?? 'AKZ',
    }
  })

  return NextResponse.json({ clients, stats, total, page, limit })
}
