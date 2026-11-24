import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { VpsPlanError, loadVpsPlans, saveVpsPlan, vpsListAction } from '@/lib/commerce/vps-plans'
import { providerCatalog } from '@/lib/vps/settings'
import { specsFromMetadata } from '@/lib/vps/hostinger-vps'

export const dynamic = 'force-dynamic'

// Catálogo e Preços → VPS. Só administradores (verificado aqui, no servidor). Alterações em activity_logs.
async function guard(): Promise<NextResponse | string> {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}
const log = (adminId: string, action: string, id: string | null, d: string) =>
  getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, ?, 'product', ?, ?)", [adminId, action, id, d.slice(0, 500)]).catch(() => {})

/** GET ?provider=1 junta o catálogo VPS da Hostinger (leitura) com as especificações lidas dos metadados. */
export async function GET(req: NextRequest) {
  const g = await guard(); if (typeof g !== 'string') return g
  const plans = await loadVpsPlans()
  let provider: { error?: string; items: { id: string; name: string; specs: ReturnType<typeof specsFromMetadata>; prices: { id: string; currency: string; price: number; first_period_price?: number | null; period: number; period_unit: string }[] }[] } | null = null
  if (req.nextUrl.searchParams.get('provider') === '1') {
    const c = await providerCatalog()
    provider = { error: c.error, items: c.items.map(i => ({ id: i.id, name: i.name, specs: specsFromMetadata(i.metadata), prices: i.prices })) }
  }
  return NextResponse.json({ plans, provider }, { headers: { 'Cache-Control': 'no-store' } })
}

async function save(req: NextRequest, create: boolean) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (!create && !body.id) return NextResponse.json({ error: 'Indique o plano a editar.' }, { status: 400 })
  try {
    const id = await saveVpsPlan({ ...body, id: create ? undefined : String(body.id) })
    await log(adminId, create ? 'create' : 'update', id, `VPS: ${String(body.name ?? '').slice(0, 80)} base=${body.baseMonthly} estado=${body.saleStatus} fornecedor=${body.providerProductId ?? '—'} (${body.providerMode ?? 'manual'})`)
    const plans = await loadVpsPlans(), saved = plans.find(p => p.id === id)
    return NextResponse.json({ ok: true, id, plans, warnings: saved?.specWarnings ?? [], unverified: saved?.specUnverified ?? [] }, { status: create ? 201 : 200 })
  } catch (e) {
    if (e instanceof VpsPlanError) return NextResponse.json({ error: e.message, field: e.field ?? null }, { status: e.status })
    console.error('[admin/vps-plans]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível guardar o plano.' }, { status: 500 })
  }
}
export const POST = (req: NextRequest) => save(req, true)
export const PUT = (req: NextRequest) => save(req, false)

/** Publicar/despublicar ou ordenar a lista. */
export async function PATCH(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => ({}))
  try {
    await vpsListAction(body)
    await log(adminId, 'update', body.id ? String(body.id) : null, body.action === 'publish' ? `VPS: ${body.published ? 'publicado' : 'despublicado'}` : 'VPS: ordem alterada')
    return NextResponse.json({ ok: true, plans: await loadVpsPlans() })
  } catch (e) {
    if (e instanceof VpsPlanError) return NextResponse.json({ error: e.message }, { status: 400 })
    return NextResponse.json({ error: 'Falhou.' }, { status: 500 })
  }
}
