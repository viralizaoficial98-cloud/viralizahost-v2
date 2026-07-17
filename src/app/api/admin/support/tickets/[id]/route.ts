import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/admin/support/tickets/[id] ──────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try { await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  const { data: ticket, error: ticketErr } = await db
    .from('tickets')
    .select('*, profiles(full_name, email, avatar_url, role), assigned_profile:profiles!tickets_assigned_to_fkey(full_name, email)')
    .eq('id', id)
    .single()

  if (ticketErr || !ticket) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })

  const { data: messages } = await db
    .from('ticket_messages')
    .select('*, profiles(full_name, avatar_url, role)')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ ticket, messages: messages ?? [] })
}

// ── PATCH /api/admin/support/tickets/[id] ────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const db = createAdminWriteClient()

  const allowed = ['status', 'priority', 'assigned_to', 'category', 'department']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (body.status === 'closed') updates.closed_at = new Date().toISOString()
  if (body.status === 'resolved') updates.closed_at = new Date().toISOString()

  const { error } = await db.from('tickets').update(updates).eq('id', id)
  if (error) {
    console.error('[admin/tickets/[id] PATCH]', error.message)
    return NextResponse.json({ error: 'Erro ao actualizar ticket.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
