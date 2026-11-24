import { NextResponse, type NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase/server'
import { VpsManageError, addSshKey, availableInstalls, chooseInstall, getMyVps, listSshKeys, liveStatus, powerAction, reinstall, setRootPassword } from '@/lib/vps/manage'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// Gestão de um VPS do cliente autenticado (a posse é verificada em cada operação; VPS de outro cliente → 404).
// O corpo dos pedidos (palavra-passe root) nunca é registado nem devolvido.
async function uid() { const { data: { user } } = await (await createAuthClient()).auth.getUser(); return user?.id ?? null }
const fail = (e: unknown) => e instanceof VpsManageError
  ? NextResponse.json({ error: e.message }, { status: e.status })
  : (console.error('[client/vps/:id]', (e as Error).message), NextResponse.json({ error: 'Operação indisponível de momento.' }, { status: 500 }))

export async function GET(req: NextRequest, { params }: Ctx) {
  const me = await uid(); if (!me) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const id = (await params).id
  try {
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
  try {
    switch (body.action) {
      case 'start': case 'stop': case 'restart': return NextResponse.json(await powerAction(me, id, String(body.action)))
      case 'root_password': return NextResponse.json(await setRootPassword(me, id, body.password))
      case 'ssh_key': return NextResponse.json(await addSshKey(me, id, body.key))
      case 'reinstall': return NextResponse.json(await reinstall(me, id, { image: body.image, acceptDataLoss: body.acceptDataLoss, confirmText: body.confirmText }))
      case 'choose_install': return NextResponse.json(await chooseInstall(me, id, body.image))
      default: return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 })
    }
  } catch (e) { return fail(e) }
}
