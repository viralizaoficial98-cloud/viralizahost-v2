import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { FamilyPlanError, loadFamilyPlans, saveFamilyPlan } from '@/lib/commerce/family-plans'
import { PLAN_FAMILIES, isPlanFamily } from '@/lib/commerce/plan-families'

export const dynamic = 'force-dynamic'

// Catálogo e Preços → planos de Revenda, Criador de Sites e Construtor WordPress (?family=…). Só administradores.
async function guard() {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}
const familyParam = (req: NextRequest) => { const f = req.nextUrl.searchParams.get('family'); return isPlanFamily(f) ? f : null }

export async function GET(req: NextRequest) {
  const g = await guard(); if (typeof g !== 'string') return g
  const family = familyParam(req)
  if (!family) return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
  return NextResponse.json({ plans: await loadFamilyPlans(family) }, { headers: { 'Cache-Control': 'no-store' } })
}

async function save(req: NextRequest, create: boolean) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const family = familyParam(req)
  if (!family) return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (!create && !body.id) return NextResponse.json({ error: 'Indique o plano a editar.' }, { status: 400 })
  try {
    const id = await saveFamilyPlan(family, { ...body, id: create ? undefined : String(body.id) })
    const per = Array.isArray(body.periods) ? body.periods.map((p: { cycle: string; discount: unknown; publish: unknown }) => `${p.cycle}:${p.discount ?? 'manter'}${p.publish ? '' : '(não publicado)'}`) : []
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, ?, 'product', ?, ?)",
      [adminId, create ? 'create' : 'update', id, `${PLAN_FAMILIES[family].label}: ${String(body.name ?? '').slice(0, 80)} base=${body.baseMonthly ?? '—'} ${per.join(' ')}`.slice(0, 500)]).catch(() => {})
    return NextResponse.json({ ok: true, id, plans: await loadFamilyPlans(family) }, { status: create ? 201 : 200 })
  } catch (e) {
    if (e instanceof FamilyPlanError) return NextResponse.json({ error: e.message, field: e.field ?? null }, { status: 400 })
    console.error('[admin/family-plans]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível guardar o plano.' }, { status: 500 })
  }
}
export const POST = (req: NextRequest) => save(req, true)
export const PUT = (req: NextRequest) => save(req, false)
