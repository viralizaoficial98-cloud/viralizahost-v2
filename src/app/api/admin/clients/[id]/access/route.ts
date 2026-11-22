import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { AccountError, setPortalAccess } from '@/lib/admin/client-account'

export const dynamic = 'force-dynamic'

// POST { active: false } → suspende o acesso ao portal (termina sessões); { active: true } → reactiva.
// Não altera a conta no WHM nem facturas/serviços.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e) { const s = (e as { status?: number })?.status === 403 ? 403 : 401; return NextResponse.json({ error: 'Sem permissão.' }, { status: s }) }
  const body = await req.json().catch(() => ({})) as { active?: boolean }
  if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'Indique active: true ou false.' }, { status: 400 })
  try { return NextResponse.json(await setPortalAccess((await params).id, adminId, body.active)) }
  catch (e) {
    if (e instanceof AccountError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    return NextResponse.json({ error: 'Não foi possível alterar o acesso.' }, { status: 500 })
  }
}
