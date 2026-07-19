import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/client/support/tickets ──────────────────────────────────────────
export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = createAdminWriteClient()
  const { data, error } = await db
    .from('tickets')
    .select('*, ticket_messages(count)')
    .eq('profile_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[client/tickets GET]', error.message)
    return NextResponse.json({ error: 'Erro ao carregar tickets.' }, { status: 500 })
  }

  return NextResponse.json({ tickets: data ?? [] })
}

// ── POST /api/client/support/tickets ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const subject     = String(body.subject     ?? '').trim()
  const category    = String(body.category    ?? '').trim()
  const priority    = String(body.priority    ?? 'medium').trim()
  const description = String(body.description ?? '').trim()

  if (!subject)     return NextResponse.json({ error: 'Assunto obrigatório.' },    { status: 400 })
  if (!category)    return NextResponse.json({ error: 'Categoria obrigatória.' },  { status: 400 })
  if (!description) return NextResponse.json({ error: 'Descrição obrigatória.' },  { status: 400 })

  const validPriorities = ['low', 'medium', 'high', 'critical']
  if (!validPriorities.includes(priority))
    return NextResponse.json({ error: 'Prioridade inválida.' }, { status: 400 })

  console.info('[TICKET_CREATE_START]', { userId: user.id, subject, category, priority })

  const db = createAdminWriteClient()

  // Create ticket (trigger will set ticket_number)
  const { data: ticket, error: ticketErr } = await db
    .from('tickets')
    .insert({
      profile_id:  user.id,
      subject,
      category,
      department:  category,
      priority,
      status:      'open',
      service_id:  (body.service_id as string) ?? null,
    })
    .select('id, ticket_number')
    .single()

  if (ticketErr || !ticket) {
    console.error('[TICKET_CREATE_ERROR] ticket insert failed', {
      userId: user.id,
      subject,
      category,
      priority,
      code:    ticketErr?.code,
      message: ticketErr?.message,
      details: ticketErr?.details,
      hint:    ticketErr?.hint,
    })
    return NextResponse.json({ error: 'Erro ao criar ticket.', code: 'TICKET_CREATE_FAILED' }, { status: 500 })
  }

  // Insert first message (the description)
  const { error: msgErr } = await db
    .from('ticket_messages')
    .insert({
      ticket_id:  ticket.id,
      profile_id: user.id,
      message:    description,
      is_staff:   false,
      is_internal: false,
    })

  if (msgErr) {
    console.error('[TICKET_MESSAGE_INSERT_ERROR]', {
      ticketId: ticket.id,
      code:    msgErr.code,
      message: msgErr.message,
      details: msgErr.details,
      hint:    msgErr.hint,
    })
    // Ticket was created — don't fail entirely, but log
  }

  // Notify admins (best-effort)
  try {
    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)

    if (admins && admins.length > 0) {
      await db.from('notifications').insert(
        admins.map((a: { id: string }) => ({
          profile_id: a.id,
          type:       'info',
          title:      'Novo ticket de suporte',
          message:    `${ticket.ticket_number}: ${subject}`,
          link:       `/admin/tickets/${ticket.id}`,
        }))
      )
    }
  } catch { /* non-fatal */ }

  console.info('[TICKET CREATED]', { ticketId: ticket.id, ticketNumber: ticket.ticket_number, userId: user.id, subject })

  return NextResponse.json({ ticket }, { status: 201 })
}
