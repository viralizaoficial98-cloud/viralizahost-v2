import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { HostingPlanError, loadHostingPlans, saveHostingPlan } from '@/lib/commerce/hosting-plans'
import { loadWhmConfig } from '@/lib/whm/config'
import { listPackages } from '@/lib/whm/client'

export const dynamic = 'force-dynamic'

// Catálogo e Preços → Hospedagem Premium. Só administradores (verificado aqui, no servidor).
async function guard() {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}

/** GET ?packages=1 junta os limites dos pacotes WHM (só leitura: listpkgs) para o editor comparar com a ficha. */
export async function GET(req: NextRequest) {
  const g = await guard(); if (typeof g !== 'string') return g
  const plans = await loadHostingPlans()
  let packages: { name: string; quota: string; bwlimit: string; maxpop: string; maxaddon: string }[] | null = null
  let packagesError: string | null = null
  if (req.nextUrl.searchParams.get('packages') === '1') {
    try {
      const cfg = await loadWhmConfig()
      if (!cfg) packagesError = 'WHM não configurado (Integrações → WHM/cPanel).'
      else packages = (await listPackages(cfg.config)).map(p => ({ name: p.name, quota: p.quota, bwlimit: p.bwlimit, maxpop: p.maxpop, maxaddon: p.maxaddon }))
    } catch { packagesError = 'Não foi possível ler os pacotes do WHM agora.' }
  }
  return NextResponse.json({ plans, packages, packagesError }, { headers: { 'Cache-Control': 'no-store' } })
}

async function save(req: NextRequest, create: boolean) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (!create && !body.id) return NextResponse.json({ error: 'Indique o plano a editar.' }, { status: 400 })
  try {
    const id = await saveHostingPlan({ ...body, id: create ? undefined : String(body.id) })
    const per = Array.isArray(body.periods) ? body.periods.map((p: { cycle: string; discount: unknown; publish: unknown }) => `${p.cycle}:${p.discount ?? 'manter'}${p.publish ? '' : '(não publicado)'}`) : []
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, ?, 'product', ?, ?)",
      [adminId, create ? 'create' : 'update', id, `Hospedagem: ${String(body.name ?? '').slice(0, 80)} base=${body.baseMonthly} ${per.join(' ')}`.slice(0, 500)]).catch(() => {})
    return NextResponse.json({ ok: true, id, plans: await loadHostingPlans() }, { status: create ? 201 : 200 })
  } catch (e) {
    if (e instanceof HostingPlanError) return NextResponse.json({ error: e.message, field: e.field ?? null }, { status: 400 })
    console.error('[admin/hosting-plans]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível guardar o plano.' }, { status: 500 })
  }
}
export const POST = (req: NextRequest) => save(req, true)
export const PUT = (req: NextRequest) => save(req, false)
