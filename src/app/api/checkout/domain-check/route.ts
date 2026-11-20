import { NextRequest, NextResponse } from 'next/server'
import { checkAvailability, normalizeDomain } from '@/lib/commerce/domains'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

// Disponibilidade via RDAP (ver src/lib/commerce/domains.ts). Sem RDAP para a
// extensão (ex.: .ao) → verified: false (confirmação manual após a encomenda).
export async function GET(req: NextRequest) {
  if (!rateLimit(`domain-check:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'Demasiados pedidos.' }, { status: 429 })
  const domain = normalizeDomain(req.nextUrl.searchParams.get('domain'))
  if (!domain) return NextResponse.json({ available: false, error: 'Formato inválido' }, { status: 400 })
  return NextResponse.json(await checkAvailability(domain))
}
