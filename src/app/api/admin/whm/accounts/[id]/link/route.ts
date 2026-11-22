import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { LinkError, linkPreview, linkWhmAccount } from '@/lib/whm/link'

export const dynamic = 'force-dynamic'

// GET  → dados para a confirmação (domínio, utilizador cPanel, servidor, contacto WHM, titular actual)
// POST { profile_id, confirmed: true } → associação manual a um cliente elegível.
// Nunca cria contas de cliente nem associa por coincidência de e-mail.
type Ctx = { params: Promise<{ id: string }> }

async function admin() { try { return await requireAdminRole() } catch (e) { return { status: (e as { status?: number })?.status === 403 ? 403 : 401 } } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const a = await admin(); if (typeof a !== 'string') return NextResponse.json({ error: 'Sem permissão.' }, { status: a.status })
  const preview = await linkPreview((await params).id)
  return preview ? NextResponse.json({ account: preview }) : NextResponse.json({ error: 'Conta WHM não encontrada.' }, { status: 404 })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const adminId = await admin(); if (typeof adminId !== 'string') return NextResponse.json({ error: 'Sem permissão.' }, { status: adminId.status })
  const body = await req.json().catch(() => ({})) as { profile_id?: string; confirmed?: boolean }
  if (!body.profile_id) return NextResponse.json({ error: 'Seleccione um cliente registado.' }, { status: 400 })
  try {
    const r = await linkWhmAccount({ whmAccountId: (await params).id, profileId: String(body.profile_id), adminId, confirmed: body.confirmed === true })
    return NextResponse.json({ success: true, ...r })
  } catch (e) {
    if (e instanceof LinkError) return NextResponse.json({ error: e.message, code: e.code, conflict: e.details }, { status: e.status })
    console.error('[whm/link]', (e as Error).message)
    return NextResponse.json({ error: 'Erro ao associar.' }, { status: 500 })
  }
}
