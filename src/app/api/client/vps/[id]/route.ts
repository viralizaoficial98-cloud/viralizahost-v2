import { NextResponse, type NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase/server'
import { VpsManageError, addSshKey, availableInstalls, chooseInstall, getMyVps, listSshKeys, liveStatus, powerAction, reinstall, setRootPassword, vpsBackupOp, vpsBackups, vpsDetails, vpsFirewall, vpsFirewallOp, vpsMetrics } from '@/lib/vps/manage'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// Gestão de um VPS do cliente autenticado (a posse é verificada em cada operação; VPS de outro cliente → 404).
// O corpo dos pedidos (palavra-passe root) nunca é registado nem devolvido.
// Limite por cliente e IP (as leituras ao vivo e as operações chamam a API do fornecedor)
const LIMIT = Math.min(5000, Math.max(10, Number(process.env.VPS_CLIENT_RATE_LIMIT) || 120))
const limited = (me: string, req: NextRequest) => !rateLimit(`vps-client:${me}:${clientIp(req)}`, LIMIT, 10 * 60_000)
async function uid() { const { data: { user } } = await (await createAuthClient()).auth.getUser(); return user?.id ?? null }
const fail = (e: unknown) => e instanceof VpsManageError
  ? NextResponse.json({ error: e.message }, { status: e.status })
  : (console.error('[client/vps/:id]', (e as Error).message), NextResponse.json({ error: 'Operação indisponível de momento.' }, { status: 500 }))

export async function GET(req: NextRequest, { params }: Ctx) {
  const me = await uid(); if (!me) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const id = (await params).id
  if (limited(me, req)) return NextResponse.json({ error: 'Demasiados pedidos. Aguarde alguns minutos.' }, { status: 429 })
  try {
    const view = req.nextUrl.searchParams.get('view')
    const ns = { headers: { 'Cache-Control': 'no-store' } }
    if (view === 'details') return NextResponse.json(await vpsDetails(me, id), ns)
    if (view === 'metrics') return NextResponse.json(await vpsMetrics(me, id, req.nextUrl.searchParams.get('range') === '7d' ? '7d' : '24h'), ns)
    if (view === 'backups') return NextResponse.json(await vpsBackups(me, id), ns)
    if (view === 'firewall') return NextResponse.json(await vpsFirewall(me, id), ns)
    if (req.nextUrl.searchParams.get('live') === '1') return NextResponse.json(await liveStatus(me, id), { headers: { 'Cache-Control': 'no-store' } })
    const vps = await getMyVps(me, id)
    const [installs, keys] = await Promise.all([
      vps.awaitingChoice || vps.manageable ? availableInstalls(me, id) : Promise.resolve([]),
      vps.manageable ? listSshKeys(me, id).catch(() => []) : Promise.resolve([]),
    ])
    return NextResponse.json({ vps, installs, sshKeys: keys }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) { return fail(e) }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const me = await uid(); if (!me) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const id = (await params).id
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  if (limited(me, req)) return NextResponse.json({ error: 'Demasiados pedidos. Aguarde alguns minutos.' }, { status: 429 })
  try {
    switch (body.action) {
      case 'start': case 'stop': case 'restart': return NextResponse.json(await powerAction(me, id, String(body.action)))
      case 'root_password': return NextResponse.json(await setRootPassword(me, id, body.password))
      case 'ssh_key': return NextResponse.json(await addSshKey(me, id, body.key))
      case 'reinstall': return NextResponse.json(await reinstall(me, id, { image: body.image, acceptDataLoss: body.acceptDataLoss, confirmText: body.confirmText }))
      case 'choose_install': return NextResponse.json(await chooseInstall(me, id, body.image))
      case 'backup_op': return NextResponse.json(await vpsBackupOp(me, id, { op: body.op, backupId: body.backupId, confirmText: body.confirmText }))
      case 'firewall_op': return NextResponse.json(await vpsFirewallOp(me, id, body))
      default: return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 })
    }
  } catch (e) { return fail(e) }
}
