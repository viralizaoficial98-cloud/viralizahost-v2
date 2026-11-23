import { NextResponse } from 'next/server'
import { featuredExtensions } from '@/lib/commerce/domain-catalog'

export const dynamic = 'force-dynamic'

// Compatibilidade: antes lia site_domains (preços duplicados). Agora devolve os cartões do catálogo
// (preços de domain_prices; destaque, ordem e etiqueta de domain_extensions).
export async function GET() {
  try {
    const domains = (await featuredExtensions()).map(e => ({ extension: e.extension, price_annual: e.register, renewal: e.renew, currency: 'AKZ', popular: e.highlight, badge: e.badge, description: e.description, active: true }))
    return NextResponse.json({ domains }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
