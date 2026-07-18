import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/admin/clients ────────────────────────────────────────────────────
// Root cause of previous failure: tickets table has TWO FK refs to profiles
// (profile_id and assigned_to), making PostgREST embedded joins AMBIGUOUS.
// Fix: use separate parallel queries and merge in JS.
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

  // ── 1. Load all profiles ───────────────────────────────────────────────────
  const { data: profiles, error: pErr } = await db
    .from('profiles')
    .select('id, email, full_name, phone, country, role, is_active, created_at')
    .order('created_at', { ascending: false })

  if (pErr) {
    console.error('[ADMIN CLIENTS ERROR] profiles query failed', {
      message: pErr.message, code: pErr.code, details: pErr.details, hint: pErr.hint,
    })
    return NextResponse.json({ error: 'Erro ao carregar clientes.', detail: pErr.message }, { status: 500 })
  }

  const profileIds = (profiles ?? []).map(p => p.id)
  if (profileIds.length === 0) {
    return NextResponse.json({ clients: [], stats: { total:0,active:0,suspended:0,whm:0,no_association:0,pending_payment:0,open_tickets:0 }, total: 0, page, limit })
  }

  // ── 2. Parallel queries — separate tables, no ambiguous joins ─────────────
  const [
    { data: clients,         error: cErr  },
    { data: hostingAccounts, error: haErr },
    { data: whmAccounts,     error: waErr },
    { data: domains,         error: dErr  },
    { data: services,        error: sErr  },
    { data: tickets,         error: tErr  },
    { data: invoices,        error: iErr  },
  ] = await Promise.all([
    db.from('clients').select('profile_id, company_name, currency, credit_balance').in('profile_id', profileIds),
    db.from('hosting_accounts').select('profile_id, id, cpanel_username, primary_domain, status, disk_used_mb, disk_limit_mb, email_count, ip_address, package_name, last_synced_at, service_id').in('profile_id', profileIds),
    db.from('whm_accounts').select('profile_id, id, whm_username, primary_domain, package_name, ip_address, is_suspended, disk_used_mb, disk_limit_mb, last_synced_at, status, php_version').in('profile_id', profileIds),
    db.from('domains').select('profile_id, id').in('profile_id', profileIds),
    db.from('services').select('profile_id, id, status').in('profile_id', profileIds),
    db.from('tickets').select('profile_id, id, status').in('profile_id', profileIds),
    db.from('invoices').select('profile_id, id, status, total, amount_paid').in('profile_id', profileIds),
  ])

  // Log any sub-query errors but don't fail the whole request
  if (cErr)  console.error('[ADMIN CLIENTS ERROR] clients',          { message: cErr.message,  code: cErr.code  })
  if (haErr) console.error('[ADMIN CLIENTS ERROR] hosting_accounts', { message: haErr.message, code: haErr.code })
  if (waErr) console.error('[ADMIN CLIENTS ERROR] whm_accounts',     { message: waErr.message, code: waErr.code })
  if (dErr)  console.error('[ADMIN CLIENTS ERROR] domains',          { message: dErr.message,  code: dErr.code  })
  if (sErr)  console.error('[ADMIN CLIENTS ERROR] services',         { message: sErr.message,  code: sErr.code  })
  if (tErr)  console.error('[ADMIN CLIENTS ERROR] tickets',          { message: tErr.message,  code: tErr.code  })
  if (iErr)  console.error('[ADMIN CLIENTS ERROR] invoices',         { message: iErr.message,  code: iErr.code  })

  // ── 3. Index by profile_id ────────────────────────────────────────────────
  function idx<T extends { profile_id: string }>(rows: T[] | null): Map<string, T[]> {
    const m = new Map<string, T[]>()
    for (const r of rows ?? []) {
      const arr = m.get(r.profile_id) ?? []
      arr.push(r)
      m.set(r.profile_id, arr)
    }
    return m
  }

  const clientMap  = idx(clients  ?? [])
  const haMap      = idx(hostingAccounts ?? [])
  const waMap      = idx(whmAccounts ?? [])
  const domainMap  = idx(domains  ?? [])
  const serviceMap = idx(services ?? [])
  const ticketMap  = idx(tickets  ?? [])
  const invoiceMap = idx(invoices ?? [])

  // ── 4. Merge ───────────────────────────────────────────────────────────────
  let list = (profiles ?? []).map(p => {
    const cl  = clientMap.get(p.id)?.[0]
    const ha  = haMap.get(p.id)?.[0]
    const wa  = waMap.get(p.id)?.[0]
    const doms = domainMap.get(p.id)  ?? []
    const svcs = serviceMap.get(p.id) ?? []
    const tkts = ticketMap.get(p.id)  ?? []
    const invs = invoiceMap.get(p.id) ?? []

    const openTickets   = tkts.filter((t: { status: string }) => ['open', 'in_progress'].includes(t.status)).length
    const pendingInvs   = invs.filter((i: { status: string }) => ['pending', 'overdue'].includes(i.status)).length
    const pendingAmount = invs
      .filter((i: { status: string }) => ['pending', 'overdue'].includes(i.status))
      .reduce((s: number, i: { total?: unknown; amount_paid?: unknown }) => s + Math.max(0, Number(i.total ?? 0) - Number(i.amount_paid ?? 0)), 0)

    return {
      id:               p.id,
      email:            p.email,
      full_name:        p.full_name,
      phone:            p.phone,
      country:          p.country,
      role:             p.role,
      is_active:        p.is_active,
      created_at:       p.created_at,
      company_name:     cl?.company_name   ?? null,
      cpanel_username:  ha?.cpanel_username ?? wa?.whm_username   ?? null,
      primary_domain:   ha?.primary_domain  ?? wa?.primary_domain  ?? null,
      package_name:     ha?.package_name    ?? wa?.package_name    ?? null,
      ip_address:       ha?.ip_address      ?? wa?.ip_address      ?? null,
      disk_used_mb:     ha?.disk_used_mb    ?? wa?.disk_used_mb    ?? 0,
      disk_limit_mb:    ha?.disk_limit_mb   ?? wa?.disk_limit_mb   ?? null,
      email_count:      ha?.email_count     ?? 0,
      last_synced_at:   ha?.last_synced_at  ?? wa?.last_synced_at  ?? null,
      hosting_status:   ha?.status          ?? (wa ? (wa.is_suspended ? 'suspended' : 'active') : null),
      is_whm_suspended: wa?.is_suspended    ?? false,
      has_hosting:      !!(ha || wa),
      has_whm:          !!wa,
      domain_count:     doms.length,
      service_count:    svcs.length,
      open_tickets:     openTickets,
      pending_invoices: pendingInvs,
      pending_amount:   pendingAmount,
      currency:         cl?.currency ?? 'AKZ',
    }
  })

  // ── 5. Text search ─────────────────────────────────────────────────────────
  if (q) {
    list = list.filter(c =>
      c.email?.toLowerCase().includes(q)         ||
      c.full_name?.toLowerCase().includes(q)     ||
      c.company_name?.toLowerCase().includes(q)  ||
      c.primary_domain?.toLowerCase().includes(q)||
      c.cpanel_username?.toLowerCase().includes(q)||
      c.package_name?.toLowerCase().includes(q)
    )
  }

  // ── 6. Filter ──────────────────────────────────────────────────────────────
  switch (filter) {
    case 'active':
      list = list.filter(c => c.is_active !== false && !c.is_whm_suspended)
      break
    case 'suspended':
      list = list.filter(c => c.is_active === false || c.is_whm_suspended)
      break
    case 'whm':
      list = list.filter(c => c.has_whm || c.has_hosting)
      break
    case 'no_hosting':
      list = list.filter(c => !c.has_hosting)
      break
    case 'pending_payment':
      list = list.filter(c => c.pending_invoices > 0)
      break
    case 'open_tickets':
      list = list.filter(c => c.open_tickets > 0)
      break
  }

  // ── 7. Stats (from full merged list, before filter) ───────────────────────
  const all = (profiles ?? []).map(p => {
    const ha = haMap.get(p.id)?.[0]
    const wa = waMap.get(p.id)?.[0]
    const invs = invoiceMap.get(p.id) ?? []
    const tkts = ticketMap.get(p.id)  ?? []
    return {
      is_active:       p.is_active,
      is_whm_suspended: wa?.is_suspended ?? false,
      has_hosting:     !!(ha || wa),
      has_whm:         !!wa,
      pending_invoices: invs.filter((i: { status: string }) => ['pending', 'overdue'].includes(i.status)).length,
      open_tickets:    tkts.filter((t: { status: string }) => ['open', 'in_progress'].includes(t.status)).length,
    }
  })

  const stats = {
    total:           all.length,
    active:          all.filter(c => c.is_active !== false && !c.is_whm_suspended).length,
    suspended:       all.filter(c => c.is_active === false || c.is_whm_suspended).length,
    whm:             all.filter(c => c.has_whm).length,
    no_association:  all.filter(c => !c.has_hosting).length,
    pending_payment: all.filter(c => c.pending_invoices > 0).length,
    open_tickets:    all.filter(c => c.open_tickets > 0).length,
  }

  // ── 8. Paginate ────────────────────────────────────────────────────────────
  const total    = list.length
  const offset   = (page - 1) * limit
  const paginated = list.slice(offset, offset + limit)

  return NextResponse.json({ clients: paginated, stats, total, page, limit })
}
