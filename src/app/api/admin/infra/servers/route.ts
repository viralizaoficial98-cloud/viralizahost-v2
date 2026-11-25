import { NextRequest, NextResponse } from 'next/server'
import { listServers, saveServer, setResellerAuthorization, syncServer, SERVER_CATEGORIES } from '@/lib/reseller/infra'
import { adminGuard, fail, noStore } from '@/lib/reseller/http'

export const dynamic = 'force-dynamic'

// Infraestrutura → Servidores. Nunca devolve tokens (só se existe credencial). POST { action: save|sync|authorize|revoke }.
export async function GET() {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  try { return NextResponse.json({ servers: await listServers(), categories: SERVER_CATEGORIES, encryptionKey: (process.env.WHM_ENCRYPTION_KEY?.length ?? 0) >= 64 }, { headers: noStore }) }
  catch (e) { return fail(e, 'admin/infra/servers') }
}
export async function POST(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  const b = await req.json().catch(() => null) as Record<string, any> | null // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!b?.action) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try {
    if (b.action === 'save') return NextResponse.json({ id: await saveServer(g, b.server ?? {}), servers: await listServers() }, { headers: noStore })
    if (b.action === 'sync') { const r = await syncServer(g, String(b.id)); return NextResponse.json({ ...r, servers: await listServers() }, { status: r.ok ? 200 : 502, headers: noStore }) }
    if (b.action === 'authorize' || b.action === 'revoke') { await setResellerAuthorization(g, String(b.id), b.action === 'authorize', String(b.note ?? ''), String(b.confirmText ?? '')); return NextResponse.json({ servers: await listServers() }, { headers: noStore }) }
    return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
  } catch (e) { return fail(e, 'admin/infra/servers') }
}
