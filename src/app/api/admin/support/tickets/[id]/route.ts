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

  // Step 1 — ticket (no multi-FK join to avoid PGRST201)
  const { data: ticketRaw, error: ticketErr } = await db
    .from('tickets')
    .select('id, ticket_number, subject, status, priority, department, category, profile_id, assigned_to, created_at, updated_at, closed_at')
    .eq('id', id)
    .single()

  if (ticketErr || !ticketRaw) {
    return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })
  }

  // Step 2 — profiles for client + assigned_to
  const profileIds = [ticketRaw.profile_id, ticketRaw.assigned_to].filter(Boolean) as string[]
  const { data: profilesRaw } = profileIds.length > 0
    ? await db.from('profiles').select('id, full_name, email, avatar_url, role').in('id', profileIds)
    : { data: [] }

  const profileMap = new Map((profilesRaw ?? []).map((p: { id: string; full_name: string; email: string; avatar_url: string | null; role: string }) => [p.id, p]))

  const ticket = {
    ...ticketRaw,
    profiles:         ticketRaw.profile_id  ? (profileMap.get(ticketRaw.profile_id)  ?? null) : null,
    assigned_profile: ticketRaw.assigned_to ? (profileMap.get(ticketRaw.assigned_to) ?? null) : null,
  }

  // Step 3 — messages with sender profile
  const { data: msgsRaw } = await db
    .from('ticket_messages')
    .select('id, ticket_id, profile_id, message, is_staff, is_internal, attachments, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })

  const msgList = msgsRaw ?? []
  const msgProfileIds = [...new Set(msgList.map((m: { profile_id: string }) => m.profile_id).filter(Boolean) as string[])]
  const { data: msgProfilesRaw } = msgProfileIds.length > 0
    ? await db.from('profiles').select('id, full_name, avatar_url, role').in('id', msgProfileIds)
    : { data: [] }

  const msgProfileMap = new Map((msgProfilesRaw ?? []).map((p: { id: string; full_name: string; avatar_url: string | null; role: string }) => [p.id, p]))

  const messages = msgList.map((m: {
    id: string; ticket_id: string; profile_id: string; message: string;
    is_staff: boolean; is_internal: boolean; attachments: unknown; created_at: string;
  }) => ({
    ...m,
    profiles: m.profile_id ? (msgProfileMap.get(m.profile_id) ?? null) : null,
  }))

  return NextResponse.json({ ticket, messages })
}

// ── PATCH /api/admin/support/tickets/[id] ────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try { await requireAdminRole() } catch (e: unknown) {
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

  if (body.status === 'closed' || body.status === 'resolved') {
    updates.closed_at = new Date().toISOString()
  }

  const { error } = await db.from('tickets').update(updates).eq('id', id)
  if (error) {
    console.error('[admin/tickets/[id] PATCH]', error.message)
    return NextResponse.json({ error: 'Erro ao actualizar ticket.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
