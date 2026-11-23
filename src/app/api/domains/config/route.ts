import { NextRequest, NextResponse } from 'next/server'
import { domainConfigInfo, hostingOptions } from '@/lib/commerce/domain-catalog'
import { getDefaultNameservers } from '@/lib/commerce/nameserver-settings'
import { validateNameservers } from '@/lib/commerce/nameservers'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// «Configuração do domínio»: período disponível na extensão, preço agora e de renovação,
// nameservers padrão da plataforma e planos de alojamento opcionais.
export async function GET(req: NextRequest) {
  if (!rateLimit(`domain-config:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'Demasiados pedidos. Aguarde um minuto.' }, { status: 429 })
  try {
    const info = await domainConfigInfo(req.nextUrl.searchParams.get('dominio') ?? '')
    if (!info) return NextResponse.json({ error: 'Domínio inválido ou extensão que não vendemos.' }, { status: 400 })
    const [defaultNameservers, hosting] = await Promise.all([getDefaultNameservers(), hostingOptions()])
    return NextResponse.json({ ...info, defaultNameservers, hosting }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[domains/config]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível carregar a configuração do domínio. Tente novamente.' }, { status: 502 })
  }
}

// Validação no servidor antes de guardar no carrinho (o carrinho e a encomenda voltam a validar).
export async function POST(req: NextRequest) {
  if (!rateLimit(`domain-config:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ error: 'Demasiados pedidos. Aguarde um minuto.' }, { status: 429 })
  const body = await req.json().catch(() => ({})) as { domain?: string; years?: number; nameservers?: unknown }
  const info = await domainConfigInfo(String(body.domain ?? ''), { checkAvailability: false })
  if (!info) return NextResponse.json({ error: 'Domínio inválido ou extensão que não vendemos.', field: 'domain' }, { status: 400 })
  if (info.availability === 'on_request') return NextResponse.json({ error: 'Extensão sob consulta: contacte a equipa comercial.', field: 'domain' }, { status: 400 })
  const years = Number(body.years ?? 1)
  if (!info.periods.some(p => p.years === years)) return NextResponse.json({ error: 'Período de registo indisponível para esta extensão.', field: 'years' }, { status: 400 })
  const ns = validateNameservers(body.nameservers, info.domain)
  if (!ns.ok) return NextResponse.json({ error: ns.message, field: 'nameservers', index: ns.field ?? null }, { status: 400 })
  return NextResponse.json({ line: { type: 'domain', domain: info.domain, operation: 'register', years, nameservers: ns.value } })
}
