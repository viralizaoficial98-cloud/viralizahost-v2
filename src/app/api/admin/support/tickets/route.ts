import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/admin/support/tickets ───────────────────────────────────────────
// NOTE: tickets has TWO FKs to profiles (profile_id + assigned_to) → PGRST201
// when both are joined simultaneously. Fetch profiles separately instead.
export async function GET() {
  try {
    await requireAdminRole()
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  // Step 1 — tickets (no profile joins to avoid PGRST201)
  const { data: ticketsRaw, error: tErr } = await db
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, department, category, profile_id, assigned_to, created_at, updated_at, closed_at')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (tErr) {
    console.error('[admin/tickets GET] tickets query failed', tErr.message)
    return NextResponse.json({ error: 'Erro ao carregar tickets.' }, { status: 500 })
  }

  const ticketList = ticketsRaw ?? []

  // Step 2 — message counts per ticket
  const ticketIds = ticketList.map((t: { id: string }) => t.id)
  let msgCountMap: Record<string, number> = {}
  if (ticketIds.length > 0) {
    const { data: msgs } = await db
      .from('ticket_messages')
      .select('ticket_id')
      .in('ticket_id', ticketIds)

    if (msgs) {
      for (const m of msgs as { ticket_id: string }[]) {
        msgCountMap[m.ticket_id] = (msgCountMap[m.ticket_id] ?? 0) + 1
      }
    }
  }

  // Step 3 — profiles (client + assigned_to)
  const profileIds = [
    ...new Set([
      ...ticketList.map((t: { profile_id: string | null }) => t.profile_id),
      ...ticketList.map((t: { assigned_to: string | null }) => t.assigned_to),
    ].filter(Boolean) as string[]),
  ]

  const { data: profilesRaw } = profileIds.length > 0
    ? await db.from('profiles').select('id, full_name, email, avatar_url').in('id', profileIds)
    : { data: [] }

  const profileMap = new Map((profilesRaw ?? []).map((p: { id: string; full_name: string; email: string; avatar_url: string | null }) => [p.id, p]))

  // Step 4 — merge
  const tickets = ticketList.map((t: {
    id: string; ticket_number: string | null; subject: string; status: string; priority: string;
    department: string | null; category: string | null; profile_id: string | null;
    assigned_to: string | null; created_at: string; updated_at: string | null; closed_at: string | null;
  }) => ({
    ...t,
    profiles:          t.profile_id  ? (profileMap.get(t.profile_id)  ?? null) : null,
    assigned_profile:  t.assigned_to ? (profileMap.get(t.assigned_to) ?? null) : null,
    message_count:     msgCountMap[t.id] ?? 0,
  }))

  // Stats
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const open          = tickets.filter(t => t.status === 'open').length
  const in_progress   = tickets.filter(t => t.status === 'in_progress').length
  const resolved      = tickets.filter(t => t.status === 'resolved').length
  const closed        = tickets.filter(t => t.status === 'closed').length
  const critical      = tickets.filter(t => t.priority === 'critical').length
  const newToday      = tickets.filter(t => new Date(t.created_at) >= todayStart).length
  const resolvedToday = tickets.filter(t => t.status === 'resolved' && t.updated_at && new Date(t.updated_at) >= todayStart).length

  return NextResponse.json({
    tickets,
    stats: { open, in_progress, resolved, closed, critical, newToday, resolvedToday, total: tickets.length },
  })
}
