import { NextRequest, NextResponse } from 'next/server'
import { listProfiles, saveProfile, whmCatalog, FORBIDDEN_PRIVILEGES, LAB_ACL_REFERENCE } from '@/lib/reseller/profiles'
import { listServers } from '@/lib/reseller/infra'
import { adminGuard, fail, noStore } from '@/lib/reseller/http'

export const dynamic = 'force-dynamic'

// Catálogo e Preços → Revenda → perfil técnico (limites, ACL, pacotes, servidores). ?whm=<serverId> lê pacotes e ACLs.
export async function GET(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  try {
    const sid = req.nextUrl.searchParams.get('whm')
    if (sid) return NextResponse.json(await whmCatalog(sid), { headers: noStore })
    const servers = (await listServers()).filter(s => s.services.includes('reseller')).map(s => ({ id: s.id, label: s.label, environment: s.environment, authorized: s.resellerAuthorized }))
    return NextResponse.json({ profiles: await listProfiles(), servers, forbidden: FORBIDDEN_PRIVILEGES, labReference: LAB_ACL_REFERENCE }, { headers: noStore })
  } catch (e) { return fail(e, 'admin/reseller/profiles') }
}
export async function PUT(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try { return NextResponse.json({ profile: await saveProfile(g, b) }, { headers: noStore }) } catch (e) { return fail(e, 'admin/reseller/profiles') }
}
