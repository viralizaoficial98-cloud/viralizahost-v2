import { NextRequest, NextResponse } from 'next/server'
import { listResellerServices, setSuspended, syncUsage } from '@/lib/reseller/services'
import { confirmAclAndActivate, reconcile, resetAttempts, runProvisioning } from '@/lib/reseller/provisioning'
import { provisioningView } from '@/lib/reseller/requests'
import { getPool } from '@/lib/db/pool'
import { audit } from '@/lib/reseller/settings'
import { adminGuard, fail, noStore } from '@/lib/reseller/http'

export const dynamic = 'force-dynamic'

// Revenda → Revendedores e operações de aprovisionamento. POST { serviceId, action }.
export async function GET(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  try {
    const serviceId = req.nextUrl.searchParams.get('serviceId')
    if (serviceId) return NextResponse.json(await provisioningView(getPool(), serviceId), { headers: noStore })
    if (req.nextUrl.searchParams.get('ops') === '1') {
      const [ops] = await getPool().query(`SELECT o.id, o.service_id, o.status, o.step, o.attempts, o.max_attempts, o.last_error, o.updated_at, r.reference, s.domain
        FROM reseller_provision_ops o JOIN services s ON s.id = o.service_id LEFT JOIN reseller_requests r ON r.id = o.request_id ORDER BY o.updated_at DESC LIMIT 100`)
      return NextResponse.json({ ops }, { headers: noStore })
    }
    return NextResponse.json({ items: await listResellerServices({ status: req.nextUrl.searchParams.get('estado') ?? undefined }) }, { headers: noStore })
  } catch (e) { return fail(e, 'admin/reseller/services') }
}
export async function POST(req: NextRequest) {
  const g = await adminGuard(); if (typeof g !== 'string') return g
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const serviceId = String(b?.serviceId ?? '')
  if (!serviceId || !b?.action) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try {
    switch (b.action) {
      case 'retry': { await audit(g, 'update', 'reseller_service', serviceId, 'Aprovisionamento de revenda repetido pelo administrador'); return NextResponse.json({ outcome: await runProvisioning(serviceId, g) }, { headers: noStore }) }
      case 'reset_attempts': await resetAttempts(g, serviceId); return NextResponse.json({ ok: true })
      case 'confirm_acl': await confirmAclAndActivate(g, serviceId, String(b.confirmText ?? '')); return NextResponse.json({ ok: true })
      case 'suspend': await setSuspended(g, serviceId, true, String(b.reason ?? '')); return NextResponse.json({ ok: true })
      case 'unsuspend': await setSuspended(g, serviceId, false, ''); return NextResponse.json({ ok: true })
      case 'usage': return NextResponse.json({ usage: await syncUsage(serviceId, null) }, { headers: noStore })
      case 'reconcile': return NextResponse.json(await reconcile(serviceId), { headers: noStore })
      default: return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
    }
  } catch (e) { return fail(e, 'admin/reseller/services') }
}
