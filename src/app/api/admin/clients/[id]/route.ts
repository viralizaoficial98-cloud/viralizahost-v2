import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// ── GET /api/admin/clients/[id] ───────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  const { data: profile, error: pErr } = await db
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()
  if (pErr || !profile) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const [
    { data: client },
    { data: hosting },
    { data: whm },
    { data: domains },
    { data: services },
    { data: tickets },
    { data: invoices },
    { data: payments },
  ] = await Promise.all([
    db.from('clients').select('*').eq('profile_id', id).maybeSingle(),
    db.from('hosting_accounts').select('*').eq('profile_id', id),
    db.from('whm_accounts').select('*').eq('profile_id', id),
    db.from('domains').select('*').eq('profile_id', id),
    db.from('services').select('*, plans(name, slug, type)').eq('profile_id', id),
    db.from('tickets').select('*, ticket_messages(count)').eq('profile_id', id).order('updated_at', { ascending: false }),
    db.from('invoices').select('*').eq('profile_id', id).order('created_at', { ascending: false }),
    db.from('payments').select('*').eq('profile_id', id).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    profile,
    client:    client ?? null,
    hosting:   hosting ?? [],
    whm:       whm ?? [],
    domains:   domains ?? [],
    services:  services ?? [],
    tickets:   tickets ?? [],
    invoices:  invoices ?? [],
    payments:  payments ?? [],
  })
}

// ── PUT /api/admin/clients/[id] ───────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const db = createAdminWriteClient()

  // Profile fields
  const profileFields: Record<string, unknown> = {}
  const profileAllowed = ['full_name', 'phone', 'country', 'is_active', 'role']
  for (const k of profileAllowed) if (k in body) profileFields[k] = body[k]

  if (Object.keys(profileFields).length > 0) {
    profileFields.updated_at = new Date().toISOString()
    const { error } = await db.from('profiles').update(profileFields).eq('id', id)
    if (error) return NextResponse.json({ error: 'Erro ao actualizar perfil.' }, { status: 500 })
  }

  // Client fields (company, address)
  const clientFields: Record<string, unknown> = {}
  const clientAllowed = ['company_name', 'tax_id', 'address', 'city', 'state', 'postal_code', 'notes']
  for (const k of clientAllowed) if (k in body) clientFields[k] = body[k]

  if (Object.keys(clientFields).length > 0) {
    clientFields.updated_at = new Date().toISOString()
    await db.from('clients').upsert({ profile_id: id, ...clientFields }, { onConflict: 'profile_id' })
  }

  // Audit
  await Promise.resolve(db.from('activity_logs').insert({
    profile_id:  adminId,
    action:      'update',
    entity_type: 'client',
    entity_id:   id,
    description: `Admin actualizou dados do cliente ${id}`,
    metadata:    { changed: Object.keys({ ...profileFields, ...clientFields }) },
  })).catch(() => {})

  return NextResponse.json({ success: true })
}
