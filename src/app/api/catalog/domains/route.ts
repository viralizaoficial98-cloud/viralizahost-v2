import { NextResponse } from 'next/server'
import { featuredExtensions, listExtensions } from '@/lib/commerce/domain-catalog'

export const dynamic = 'force-dynamic'

// Extensões vendidas e preços (registo, renovação, transferência) — fonte: domain_prices.
// featured: cartões da página inicial (domain_extensions), só extensões à venda, pela ordem do administrador.
export async function GET() {
  try {
    const extensions = await listExtensions()
    return NextResponse.json({ extensions, featured: await featuredExtensions(extensions), currency: 'AKZ' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[catalog/domains]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível carregar os preços de domínios.' }, { status: 500 })
  }
}
