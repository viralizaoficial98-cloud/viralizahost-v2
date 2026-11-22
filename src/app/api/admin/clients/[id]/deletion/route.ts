import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { AccountError, assessClient } from '@/lib/admin/client-account'

export const dynamic = 'force-dynamic'

// GET → conta, se pode ser eliminada e os motivos exactos do bloqueio (só leitura)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch (e) { const s = (e as { status?: number })?.status === 403 ? 403 : 401; return NextResponse.json({ error: 'Sem permissão.' }, { status: s }) }
  try { return NextResponse.json(await assessClient((await params).id, adminId)) }
  catch (e) {
    if (e instanceof AccountError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    return NextResponse.json({ error: 'Erro ao verificar a conta.' }, { status: 500 })
  }
}
