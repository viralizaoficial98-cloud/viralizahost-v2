import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { FlowError, OWNER_LABEL, applyNameservers, checkDns, completeSetup, linkRegistered, preview, purchase, reconcile, releaseAfterReview, saveOwner } from '@/lib/registrar/hostinger-flow'

export const dynamic = 'force-dynamic'

// «Registar na Hostinger» (só administradores). GET: pré-visualização (só leituras na Hostinger).
// POST: acções explícitas — purchase (pode debitar o método de pagamento predefinido da conta Hostinger),
// reconcile, setup (sem nova compra), link, nameservers, dns, release, owner.
export async function GET(req: NextRequest) {
  try { await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const serviceId = req.nextUrl.searchParams.get('serviceId') ?? ''
  try {
    return NextResponse.json({ preview: await preview(serviceId), labels: OWNER_LABEL }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof FlowError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status })
    console.error('[registrar/hostinger] preview', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível preparar o registo.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const b = await req.json().catch(() => ({})) as { action?: string; serviceId?: string; confirmToken?: string; note?: string; owner?: Record<string, string> }
  const serviceId = String(b.serviceId ?? '')
  const log = (d: string) => getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'service', ?, ?)", [adminId, serviceId, `hostinger ${b.action}: ${d}`.slice(0, 500)]).catch(() => {})
  try {
    let r
    switch (b.action) {
      case 'purchase': r = await purchase(serviceId, String(b.confirmToken ?? ''), adminId); break
      case 'reconcile': r = await reconcile(serviceId, adminId); break
      case 'setup': r = await completeSetup(serviceId, adminId); break
      case 'link': r = await linkRegistered(serviceId, adminId); break
      case 'nameservers': r = await applyNameservers(serviceId, adminId); break
      case 'release': r = await releaseAfterReview(serviceId, String(b.note ?? ''), adminId); break
      case 'dns': { const d = await checkDns(serviceId); r = { ok: d.status === 'confirmed', outcome: d.status, message: d.status === 'confirmed' ? 'Delegação DNS confirmada.' : `DNS pendente${d.found.length ? ` (responde: ${d.found.join(', ')})` : ''}.` }; break }
      case 'owner': await saveOwner(serviceId, b.owner ?? {}, adminId); r = { ok: true, outcome: 'saved', message: 'Dados do titular guardados.' }; break
      default: return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
    }
    await log(`${r.outcome} — ${r.message}`)
    return NextResponse.json({ ...r, preview: r.preview ?? await preview(serviceId).catch(() => undefined) })
  } catch (e) {
    if (e instanceof FlowError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status })
    console.error('[registrar/hostinger]', b.action, (e as Error).message)
    return NextResponse.json({ error: 'Falha inesperada: nenhuma compra foi repetida. Consulte o estado.' }, { status: 500 })
  }
}
