import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { EmailPlanError, loadEmailPlans, saveEmailPlan } from '@/lib/commerce/email-plans'

export const dynamic = 'force-dynamic'

// Catálogo e Preços → E-mail Corporativo. Só administradores (verificado aqui, no servidor).
async function guard() {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}

export async function GET() {
  const g = await guard(); if (typeof g !== 'string') return g
  return NextResponse.json({ plans: await loadEmailPlans() }, { headers: { 'Cache-Control': 'no-store' } })
}

async function save(req: NextRequest, create: boolean) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (!create && !body.id) return NextResponse.json({ error: 'Indique o plano a editar.' }, { status: 400 })
  try {
    const id = await saveEmailPlan({ ...body, id: create ? undefined : String(body.id) })
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, ?, 'product', ?, ?)",
      [adminId, create ? 'create' : 'update', id, `E-mail: ${String(body.name ?? '').slice(0, 80)} base=${body.baseMonthly} descontos=${JSON.stringify((body.periods ?? []).map((p: { cycle: string; discount: number }) => `${p.cycle}:${p.discount}`))}`.slice(0, 500)]).catch(() => {})
    return NextResponse.json({ ok: true, id, plans: await loadEmailPlans() }, { status: create ? 201 : 200 })
  } catch (e) {
    if (e instanceof EmailPlanError) return NextResponse.json({ error: e.message, field: e.field ?? null }, { status: 400 })
    console.error('[admin/email-plans]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível guardar o plano.' }, { status: 500 })
  }
}
export const POST = (req: NextRequest) => save(req, true)
export const PUT = (req: NextRequest) => save(req, false)
