import { NextRequest, NextResponse } from 'next/server'
import { listRequests, requestAction, requestDetail } from '@/lib/reseller/requests'
import { adminGuard, fail, noStore } from '@/lib/reseller/http'

export const dynamic = 'force-dynamic'

// Revenda → Pedidos. GET ?estado=&q= (lista) ou ?id= (detalhe). POST { id, action, ...payload } (transições).
export async function GET(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  const id = req.nextUrl.searchParams.get('id')
  try {
    if (id) {
      const d = await requestDetail(id)
      return d ? NextResponse.json(d, { headers: noStore }) : NextResponse.json({ error: 'Pedido inexistente.' }, { status: 404 })
    }
    return NextResponse.json({ items: await listRequests({ status: req.nextUrl.searchParams.get('estado') ?? undefined, q: req.nextUrl.searchParams.get('q') ?? undefined }) }, { headers: noStore })
  } catch (e) { return fail(e, 'admin/reseller/requests') }
}
export async function POST(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b?.id || !b.action) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try { return NextResponse.json(await requestAction(g, String(b.id), String(b.action), b), { headers: noStore }) } catch (e) { return fail(e, 'admin/reseller/requests') }
}
