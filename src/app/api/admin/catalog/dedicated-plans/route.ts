import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { DedicatedPlanError, dedicatedListAction, loadDedicatedPlans, saveDedicatedPlan } from '@/lib/commerce/dedicated-plans'
import { DEDICATED_KINDS, isDedicatedKind, type DedicatedKind } from '@/lib/commerce/dedicated-shared'

export const dynamic = 'force-dynamic'

// Catálogo e Preços → Dedicado Linux / Dedicado Windows (?kind=linux|windows). Só administradores (verificado aqui,
// no servidor); alterações em activity_logs. Sem fornecedor: nada aqui liga os dedicados à compra automática de VPS.
async function guard(): Promise<NextResponse | string> {
  try { return await requireAdminRole() } catch (e) {
    const status = (e as { status?: number }).status === 403 ? 403 : 401
    return NextResponse.json({ error: status === 403 ? 'Sem permissão para alterar o catálogo.' : 'Não autenticado.' }, { status })
  }
}
const kindOf = (req: NextRequest): DedicatedKind | null => { const k = req.nextUrl.searchParams.get('kind'); return isDedicatedKind(k) ? k : null }
const log = (adminId: string, id: string | null, d: string) =>
  getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'product', ?, ?)", [adminId, id, d.slice(0, 500)]).catch(() => {})
const bad = () => NextResponse.json({ error: 'Indique kind=linux ou kind=windows.' }, { status: 400 })

export async function GET(req: NextRequest) {
  const g = await guard(); if (typeof g !== 'string') return g
  const kind = kindOf(req); if (!kind) return bad()
  return NextResponse.json({ plans: await loadDedicatedPlans(kind) }, { headers: { 'Cache-Control': 'no-store' } })
}

async function save(req: NextRequest, create: boolean) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const kind = kindOf(req); if (!kind) return bad()
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (!create && !body.id) return NextResponse.json({ error: 'Indique o plano a editar.' }, { status: 400 })
  try {
    const id = await saveDedicatedPlan(kind, { ...body, id: create ? undefined : String(body.id) })
    await log(adminId, id, `${DEDICATED_KINDS[kind].short}: ${create ? 'criado' : 'editado'} ${String(body.name ?? '').slice(0, 80)} base=${body.baseMonthly} estado=${body.saleStatus}`)
    return NextResponse.json({ ok: true, id, plans: await loadDedicatedPlans(kind) }, { status: create ? 201 : 200 })
  } catch (e) {
    if (e instanceof DedicatedPlanError) return NextResponse.json({ error: e.message, field: e.field ?? null }, { status: 400 })
    console.error('[admin/dedicated-plans]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível guardar o plano.' }, { status: 500 })
  }
}
export const POST = (req: NextRequest) => save(req, true)
export const PUT = (req: NextRequest) => save(req, false)

export async function PATCH(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const kind = kindOf(req); if (!kind) return bad()
  const body = await req.json().catch(() => ({}))
  try {
    await dedicatedListAction(kind, body)
    await log(adminId, body.id ? String(body.id) : null, body.action === 'publish' ? `${DEDICATED_KINDS[kind].short}: ${body.published ? 'publicado' : 'despublicado'}` : `${DEDICATED_KINDS[kind].short}: ordem alterada`)
    return NextResponse.json({ ok: true, plans: await loadDedicatedPlans(kind) })
  } catch (e) {
    if (e instanceof DedicatedPlanError) return NextResponse.json({ error: e.message }, { status: 400 })
    return NextResponse.json({ error: 'Falhou.' }, { status: 500 })
  }
}
