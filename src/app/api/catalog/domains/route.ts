import { NextResponse } from 'next/server'
import { listExtensions } from '@/lib/commerce/domain-catalog'

export const dynamic = 'force-dynamic'

// Extensões vendidas e preços (registo, renovação, transferência) — fonte: domain_prices.
export async function GET() {
  try {
    return NextResponse.json({ extensions: await listExtensions(), currency: 'AKZ' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[catalog/domains]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível carregar os preços de domínios.' }, { status: 500 })
  }
}
