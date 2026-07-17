import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── POST /api/client/support/tickets/[id]/messages ────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const message = String(body.message ?? '').trim()
  if (!message) return NextResponse.json({ error: 'Mensagem obrigatória.' }, { status: 400 })

  const db = createAdminWriteClient()

  // Verify ownership and ticket is not closed
  const { data: ticket } = await db
    .from('tickets')
    .select('id, status, subject, assigned_to')
    .eq('id', ticketId)
    .eq('profile_id', user.id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })
  if (ticket.status === 'closed')
    return NextResponse.json({ error: 'Este ticket está fechado.' }, { status: 403 })

  // Insert message
  const { data: msg, error: msgErr } = await db
    .from('ticket_messages')
    .insert({
      ticket_id:   ticketId,
      profile_id:  user.id,
      message,
      is_staff:    false,
      is_internal: false,
    })
    .select('id, created_at')
    .single()

  if (msgErr || !msg) {
    console.error('[client/tickets/messages POST]', msgErr?.message)
    return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 500 })
  }

  // Update ticket status to waiting_admin and bump updated_at
  await db
    .from('tickets')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  // Notify assigned admin or all admins (best-effort)
  try {
    let notifyIds: string[] = []
    if (ticket.assigned_to) {
      notifyIds = [ticket.assigned_to]
    } else {
      const { data: admins } = await db
        .from('profiles').select('id').eq('role', 'admin').eq('is_active', true)
      notifyIds = (admins ?? []).map((a: { id: string }) => a.id)
    }
    if (notifyIds.length > 0) {
      await db.from('notifications').insert(
        notifyIds.map(pid => ({
          profile_id: pid,
          type:       'info',
          title:      'Nova resposta de cliente',
          message:    `Ticket ${ticketId.slice(0, 8)}: ${ticket.subject}`,
          link:       `/admin/tickets/${ticketId}`,
        }))
      )
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ message: msg }, { status: 201 })
}
