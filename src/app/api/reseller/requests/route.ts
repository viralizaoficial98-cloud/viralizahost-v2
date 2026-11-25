import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { createRequest } from '@/lib/reseller/requests'
import { currentUserId, fail, noStore } from '@/lib/reseller/http'

export const dynamic = 'force-dynamic'

// Pedido público de contratação de Revenda (/revenda-de-hospedagem). Modo, validação, anti-spam e duplicados no
// servidor. Anti-spam: campo isco («website»), tempo mínimo de preenchimento, limite por IP e por e-mail.
// Nunca pede senhas WHM nem dados de pagamento.
const LIMIT = Math.min(1000, Math.max(1, Number(process.env.RESELLER_REQUEST_RATE_LIMIT) || 5))
const MAIL_LIMIT = Math.min(1000, Math.max(1, Number(process.env.RESELLER_REQUEST_EMAIL_LIMIT) || 3))
const MIN_FILL_MS = 3000

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (!rateLimit(`reseller-req:${ip}`, LIMIT, 15 * 60_000)) return NextResponse.json({ error: 'Demasiados pedidos. Tente dentro de alguns minutos.' }, { status: 429, headers: noStore })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  // Isco preenchido ou formulário submetido depressa demais: resposta neutra sem gravar
  const started = Number(b.startedAt)
  if (String(b.website ?? '').trim() || !Number.isFinite(started) || Date.now() - started < MIN_FILL_MS) {
    return NextResponse.json({ error: 'Não foi possível validar o formulário. Reveja os dados e tente novamente.' }, { status: 400, headers: noStore })
  }
  if (!rateLimit(`reseller-req-mail:${String(b.email ?? '').toLowerCase()}`, MAIL_LIMIT, 60 * 60_000)) return NextResponse.json({ error: 'Demasiados pedidos para este e-mail. Aguarde a resposta da equipa.' }, { status: 429, headers: noStore })
  try {
    const r = await createRequest(b as never, { userId: await currentUserId(), ip })
    return NextResponse.json({ ok: true, ...r }, { status: r.duplicate ? 200 : 201, headers: noStore })
  } catch (e) { return fail(e, 'reseller/requests') }
}
