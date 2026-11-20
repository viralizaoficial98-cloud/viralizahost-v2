import { NextRequest, NextResponse } from 'next/server'
import { searchDomains } from '@/lib/commerce/domain-catalog'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Pesquisa de domínio: nome exacto + alternativas, cada um com estado
// (available | unavailable | confirm | on_request). A disponibilidade volta a ser
// verificada no servidor ao criar a encomenda.
export async function GET(req: NextRequest) {
  if (!rateLimit(`domain-search:${clientIp(req)}`, 30, 60_000)) return NextResponse.json({ error: 'Demasiadas pesquisas. Aguarde um minuto.' }, { status: 429 })
  const q = req.nextUrl.searchParams.get('q') ?? ''
  try {
    const r = await searchDomains(q)
    if (!r) return NextResponse.json({ error: 'Escreva um nome válido (letras, números e hífen) ou um domínio com uma extensão vendida.' }, { status: 400 })
    return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[domains/search]', (e as Error).message)
    return NextResponse.json({ error: 'A pesquisa de domínios falhou. Tente novamente.' }, { status: 502 })
  }
}
