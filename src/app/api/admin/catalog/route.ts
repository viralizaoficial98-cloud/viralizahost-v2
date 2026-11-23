import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { createExtension, loadCatalog, reorderFeatured, updateDomainPrice, updateExtension, updateProduct } from '@/lib/commerce/catalog-admin'

export const dynamic = 'force-dynamic'

async function guard() {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}

export async function GET() {
  const g = await guard(); if (typeof g !== 'string') return g
  return NextResponse.json(await loadCatalog())
}

const log = (adminId: string, action: string, entity: string, id: string, description: string) =>
  getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, ?, ?, ?, ?)", [adminId, action, entity, id, description.slice(0, 500)]).catch(() => {})

/** { kind: 'product', id, sale_status?, whm_package?, pricing_note?, prices? } | { kind: 'domain', id, price, status }
 *  | { kind: 'extension', extension, sale?, description?, register?, renew?, transfer?, featured?, badge?, badgeText?, highlight? } */
export async function PATCH(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const body = await req.json().catch(() => null)
  if (body?.kind === 'extension') {
    try {
      const ext = await updateExtension(body.extension, body, adminId)
      const what = ['sale', 'register', 'renew', 'transfer', 'featured', 'badge', 'badgeText', 'highlight', 'description'].filter(k => k in body).map(k => `${k}=${JSON.stringify(body[k])}`).join(' ')
      await log(adminId, 'update', 'domain_extension', ext, `Catálogo: ${ext} ${what}`)
      return NextResponse.json({ ok: true, extension: ext })
    } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  }
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
  if (body?.kind === 'reorder') {
    try {
      await reorderFeatured(body.order, adminId)
      await log(adminId, 'update', 'domain_extension', 'featured', `Catálogo: ordem dos cartões ${JSON.stringify(body.order)}`)
      return NextResponse.json({ ok: true })
    } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  }
  if (body?.kind !== 'extension') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  try {
    const ext = await createExtension(body.extension)
    await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'create', 'domain_price', ?, 'Catálogo: extensão criada em rascunho')", [adminId, ext]).catch(() => {})
    return NextResponse.json({ ok: true, extension: ext })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
