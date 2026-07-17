import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── POST /api/admin/support/tickets/[id]/messages ────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await params

  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const message     = String(body.message     ?? '').trim()
  const is_internal = Boolean(body.is_internal ?? false)
  if (!message) return NextResponse.json({ error: 'Mensagem obrigatória.' }, { status: 400 })

  const db = createAdminWriteClient()

  // Verify ticket exists
  const { data: ticket } = await db
    .from('tickets')
    .select('id, status, subject, profile_id')
    .eq('id', ticketId)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  // Insert admin message
  const { data: msg, error: msgErr } = await db
    .from('ticket_messages')
    .insert({
      ticket_id:   ticketId,
      profile_id:  adminId,
      message,
      is_staff:    true,
      is_internal,
    })
    .select('id, created_at')
    .single()

  if (msgErr || !msg) {
    console.error('[admin/tickets/messages POST]', msgErr?.message)
    return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 500 })
  }

  // Update ticket status (only for public replies)
  if (!is_internal) {
    const newStatus = ticket.status === 'closed' ? 'open' : 'in_progress'
    await db
      .from('tickets')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    // Notify client (best-effort)
    try {
      await db.from('notifications').insert({
        profile_id: ticket.profile_id,
        type:       'success',
        title:      'Resposta no seu ticket',
        message:    `A equipa de suporte respondeu ao ticket: ${ticket.subject}`,
        link:       `/tickets/${ticketId}`,
      })
    } catch { /* non-fatal */ }
  }

  console.info('[ADMIN TICKET REPLY]', { ticketId, adminId, is_internal })
  return NextResponse.json({ message: msg }, { status: 201 })
}
