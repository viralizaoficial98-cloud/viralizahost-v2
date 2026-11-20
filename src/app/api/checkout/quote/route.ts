import { NextResponse } from 'next/server'
import { quoteCart, type CartLineInput } from '@/lib/commerce/quote'
import { getSessionUser } from '@/lib/auth/server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Cotação do carrinho (preços, ciclos, disponibilidade e impostos) calculada no servidor.
export async function POST(req: Request) {
  if (!rateLimit(`quote:${clientIp(req)}`, 120, 60_000)) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })
  const body = await req.json().catch(() => ({})) as { lines?: CartLineInput[] }
  const user = await getSessionUser()
  const quote = await quoteCart(body.lines ?? [], { userId: user?.id ?? null, checkAvailability: true })
  // Nunca devolve o código EPP
  return NextResponse.json({ quote })
}
