import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/server'
import { loadCartLines, saveCartLines } from '@/lib/commerce/cart-server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Carrinho guardado no servidor (escolhas apenas; preços sempre pela cotação).
export async function GET() {
  const user = await getSessionUser()
  return NextResponse.json({ lines: await loadCartLines(user?.id ?? null), loggedIn: !!user }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request) {
  if (!rateLimit(`cart:${clientIp(req)}`, 240, 60_000)) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })
  const body = await req.json().catch(() => null) as { lines?: unknown } | null
  if (!body || !Array.isArray(body.lines)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  const user = await getSessionUser()
  return NextResponse.json({ lines: await saveCartLines(user?.id ?? null, body.lines) })
}
