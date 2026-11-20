import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'contacted', 'quoted', 'closed']

export async function GET() {
  try { await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
  const [rows] = await getPool().query('SELECT id, reference, product_slug, product_name, name, email, phone, company, message, status, admin_notes, created_at FROM quote_requests ORDER BY created_at DESC LIMIT 300')
  return NextResponse.json({ quotes: rows })
}

export async function PATCH(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
  const b = await req.json().catch(() => null) as { id?: string; status?: string; admin_notes?: string } | null
  if (!b?.id || (b.status && !STATUSES.includes(b.status))) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  const db = getPool()
  await db.query('UPDATE quote_requests SET status = COALESCE(?, status), admin_notes = COALESCE(?, admin_notes) WHERE id = ?', [b.status ?? null, b.admin_notes?.slice(0, 3000) ?? null, b.id])
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'quote_request', ?, ?)", [adminId, b.id, `Cotação: ${b.status ?? 'notas'}`]).catch(() => {})
  return NextResponse.json({ ok: true })
}
