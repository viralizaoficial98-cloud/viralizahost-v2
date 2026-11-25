import { NextRequest, NextResponse } from 'next/server'
import { clientRequests } from '@/lib/reseller/requests'
import { changeResellerPassword, clientResellers, resellerSession, syncUsage } from '@/lib/reseller/services'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { currentUserId, fail, noStore } from '@/lib/reseller/http'

export const dynamic = 'force-dynamic'
const LIMIT = Math.min(1000, Math.max(1, Number(process.env.RESELLER_CLIENT_RATE_LIMIT) || 30))

// Área do revendedor: só os pedidos e serviços do utilizador autenticado (propriedade verificada em cada acção).
export async function GET() {
  const uid = await currentUserId()
  if (!uid) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  try { return NextResponse.json({ requests: await clientRequests(uid), resellers: await clientResellers(uid) }, { headers: noStore }) } catch (e) { return fail(e, 'client/reseller') }
}
export async function POST(req: NextRequest) {
  const uid = await currentUserId()
  if (!uid) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const serviceId = String(b?.serviceId ?? '')
  if (!serviceId) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (!rateLimit(`reseller-client:${uid}:${clientIp(req)}`, LIMIT, 10 * 60_000)) return NextResponse.json({ error: 'Demasiados pedidos. Aguarde alguns minutos.' }, { status: 429 })
  try {
    switch (b?.action) {
      case 'whm': case 'cpanel': return NextResponse.json({ url: await resellerSession(serviceId, uid, b.action) }, { headers: noStore })
      case 'usage': return NextResponse.json({ usage: await syncUsage(serviceId, uid) }, { headers: noStore })
      case 'password': await changeResellerPassword(serviceId, uid, String(b.password ?? '')); return NextResponse.json({ ok: true })
      default: return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
    }
  } catch (e) { return fail(e, 'client/reseller') }
}
