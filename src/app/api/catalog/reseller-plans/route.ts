import { NextResponse } from 'next/server'
import { publicFamilyPlans } from '@/lib/commerce/family-plans'

export const dynamic = 'force-dynamic'

// Planos de revenda à venda (nome e slug) — usado no pedido de upgrade da área do revendedor.
export async function GET() {
  const plans = (await publicFamilyPlans('reseller').catch(() => [])).filter(p => !p.onRequest && p.periods.length).map(p => ({ slug: p.slug, name: p.name }))
  return NextResponse.json({ plans }, { headers: { 'Cache-Control': 'no-store' } })
}
