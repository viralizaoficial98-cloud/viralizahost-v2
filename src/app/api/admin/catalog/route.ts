import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { createExtension, loadCatalog, updateDomainPrice, updateProduct } from '@/lib/commerce/catalog-admin'

export const dynamic = 'force-dynamic'

async function guard() {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}

export async function GET() {
  const g = await guard(); if (typeof g !== 'string') return g
  return NextResponse.json(await loadCatalog())
}

/** { kind: 'product', id, sale_status?, whm_package?, pricing_note?, prices? } | { kind: 'domain', id, price, status } */
export async function PATCH(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null)
  if (!body?.id || !['product', 'domain'].includes(body.kind)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try {
    if (body.kind === 'product') await updateProduct(String(body.id), body)
    else await updateDomainPrice(String(body.id), body)
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', ?, ?, ?)",
      [adminId, body.kind === 'product' ? 'product' : 'domain_price', body.id, 'Catálogo: preços/estado actualizados']).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

/** { kind: 'extension', extension } — cria uma extensão em rascunho. */
export async function POST(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null)
  if (body?.kind !== 'extension') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try {
    const ext = await createExtension(body.extension)
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'create', 'domain_price', ?, 'Catálogo: extensão criada em rascunho')", [adminId, ext]).catch(() => {})
    return NextResponse.json({ ok: true, extension: ext })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
