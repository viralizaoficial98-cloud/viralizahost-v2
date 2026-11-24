import { NextResponse, type NextRequest } from 'next/server'
import { getPool } from '@/lib/db/pool'
import { publicVpsOptions } from '@/lib/vps/settings'

export const dynamic = 'force-dynamic'

// Localizações e opções de instalação compatíveis com um plano Servidor VPS (sem chamar o fornecedor: lê a
// configuração guardada em Integrações → Hostinger VPS). O servidor volta a validar tudo na cotação.
export async function GET(req: NextRequest) {
  const slug = String(req.nextUrl.searchParams.get('plano') ?? '').slice(0, 120)
  try {
    const [[p]] = await getPool().query("SELECT slug, plan_specs FROM products WHERE slug = ? AND active = 1 AND category = 'vps' AND subcategory IS NULL", [slug]) as unknown as [{ slug: string; plan_specs: unknown }[]]
    if (!p) return NextResponse.json({ error: 'Plano VPS não encontrado.' }, { status: 404 })
    let specs: { ramGb?: number | null } = {}
    try { specs = (typeof p.plan_specs === 'string' ? JSON.parse(p.plan_specs) : p.plan_specs) ?? {} } catch { /* sem ficha */ }
    const o = await publicVpsOptions({ slug: p.slug, ramGb: specs.ramGb ?? null })
    return NextResponse.json(o, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[catalog/vps-options]', (e as Error).message)
    return NextResponse.json({ error: 'Catálogo de instalações indisponível de momento.' }, { status: 503 })
  }
}
