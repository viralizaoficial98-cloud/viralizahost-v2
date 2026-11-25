import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase/server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { createVpsRequest } from '@/lib/vps/requests'
import { CloudError } from '@/lib/vps/cloud'

export const dynamic = 'force-dynamic'

// Configurador Cloud VPS → «Solicitar VPS». Validação, preço e modo decididos no servidor; exige sessão (o VPS é
// gerido na Área do Cliente). Nunca recebe senhas: só a chave PÚBLICA SSH opcional.
const LIMIT = Math.min(1000, Math.max(1, Number(process.env.VPS_REQUEST_RATE_LIMIT) || 6))
export async function POST(req: NextRequest) {
  if (!rateLimit(`vps-req:${clientIp(req)}`, LIMIT, 15 * 60_000)) return NextResponse.json({ error: 'Demasiados pedidos. Tente dentro de alguns minutos.' }, { status: 429 })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  if (String(b.website ?? '').trim()) return NextResponse.json({ error: 'Não foi possível validar o pedido.' }, { status: 400 })
  const { data: { user } } = await (await createAuthClient()).auth.getUser()
  try {
    const r = await createVpsRequest(b, { userId: user?.id ?? null, ip: clientIp(req) })
    return NextResponse.json({ ok: true, ...r }, { status: r.duplicate ? 200 : 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof CloudError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    console.error('[vps/requests]', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível registar o pedido.' }, { status: 500 })
  }
}
