import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/client/support/tickets/[id] ─────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = createAdminWriteClient()

  // Fetch ticket — enforce profile_id ownership
  const { data: ticket, error: ticketErr } = await db
    .from('tickets')
    .select('*')
    .eq('id', id)
    .eq('profile_id', user.id)
    .single()

  if (ticketErr || !ticket) {
    return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })
  }

  // Fetch messages (exclude internal)
  const { data: messages, error: msgErr } = await db
    .from('ticket_messages')
    .select('*, profiles(full_name, avatar_url, role)')
    .eq('ticket_id', id)
    .eq('is_internal', false)
    .order('created_at', { ascending: true })

  if (msgErr) {
    console.error('[client/tickets/[id] GET] messages:', msgErr.message)
    return NextResponse.json({ error: 'Erro ao carregar mensagens.' }, { status: 500 })
  }

  return NextResponse.json({ ticket, messages: messages ?? [] })
}

// ── PATCH /api/client/support/tickets/[id] — reopen/close ────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const db = createAdminWriteClient()

  // Verify ownership
  const { data: ticket } = await db
    .from('tickets')
    .select('id, status')
    .eq('id', id)
    .eq('profile_id', user.id)
    .single()

  if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  const allowed: Record<string, string[]> = {
    resolved: ['open'],
    open:     ['resolved', 'closed'],
  }

  const newStatus = String(body.status ?? '')
  if (!newStatus) return NextResponse.json({ error: 'Status obrigatório.' }, { status: 400 })

  const { error } = await db
    .from('tickets')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('profile_id', user.id)

  if (error) {
    console.error('[client/tickets/[id] PATCH]', error.message)
    return NextResponse.json({ error: 'Erro ao actualizar ticket.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
