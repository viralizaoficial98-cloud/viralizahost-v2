import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/admin/support/tickets ────────────────────────────────────────────
export async function GET() {
  try {
    await requireAdminRole()
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  const { data, error } = await db
    .from('tickets')
    .select(`
      *,
      profiles ( full_name, email, avatar_url ),
      assigned_profile:profiles!tickets_assigned_to_fkey ( full_name, email ),
      ticket_messages ( count )
    `)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[admin/tickets GET]', error.message)
    return NextResponse.json({ error: 'Erro ao carregar tickets.' }, { status: 500 })
  }

  const tickets = data ?? []

  // Compute stats
  const open        = tickets.filter((t: any) => t.status === 'open').length
  const in_progress = tickets.filter((t: any) => t.status === 'in_progress').length
  const resolved    = tickets.filter((t: any) => t.status === 'resolved').length
  const closed      = tickets.filter((t: any) => t.status === 'closed').length
  const critical    = tickets.filter((t: any) => t.priority === 'critical').length

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const newToday = tickets.filter((t: any) => new Date(t.created_at) >= todayStart).length
  const resolvedToday = tickets.filter((t: any) =>
    t.status === 'resolved' && t.updated_at && new Date(t.updated_at) >= todayStart
  ).length

  return NextResponse.json({
    tickets,
    stats: { open, in_progress, resolved, closed, critical, newToday, resolvedToday },
  })
}
