import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getPool } from '@/lib/db/pool'
import { VPS_IMAGE_BUCKET, vpsImageUrl } from '@/lib/commerce/vps-plans'

export const dynamic = 'force-dynamic'

// Imagem de um plano VPS (faixa da página /servidor-vps). Só administradores. PNG/JPEG/WebP até 2 MB, verificados
// pelo conteúdo; a nova é gravada antes de trocar (falha mantém a anterior). Armazenamento existente (lib/storage).
const MAX = 2 * 1024 * 1024
const KINDS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const
function sniff(b: Buffer): keyof typeof KINDS | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}
async function guard(): Promise<NextResponse | string> {
  try { return await requireAdminRole() } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 401 }) }
}
async function plan(id: string) {
  const [rows] = await getPool().query("SELECT id, name, image_path FROM products WHERE id = ? AND category = 'vps' AND subcategory IS NULL", [id]) as unknown as [{ id: string; name: string; image_path: string | null }[]]
  return rows[0] ?? null
}
const audit = (a: string, id: string, d: string) => getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'product', ?, ?)", [a, id, d]).catch(() => {})

export async function POST(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const form = await req.formData().catch(() => null)
  const p = await plan(String(form?.get('productId') ?? ''))
  if (!p) return NextResponse.json({ error: 'Plano VPS inexistente.' }, { status: 404 })
  const file = form?.get('file')
  if (!file || typeof file === 'string' || file.size === 0) return NextResponse.json({ error: 'Escolha uma imagem (PNG, JPEG ou WebP).' }, { status: 400 })
  if (file.size > MAX) return NextResponse.json({ error: 'Imagem demasiado grande (máx. 2 MB).' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer()); const kind = sniff(buf)
  if (!kind || file.type !== kind) return NextResponse.json({ error: 'Formato não aceite: use uma imagem PNG, JPEG ou WebP verdadeira.' }, { status: 400 })
  const storage = createServiceClient().storage
  const { data: buckets } = await storage.listBuckets()
  if (!buckets?.some((x: { id: string }) => x.id === VPS_IMAGE_BUCKET)) {
    const { error } = await storage.createBucket(VPS_IMAGE_BUCKET, { public: true, fileSizeLimit: MAX, allowedMimeTypes: Object.keys(KINDS) })
    if (error) return NextResponse.json({ error: 'Não foi possível preparar o armazenamento. A imagem anterior mantém-se.' }, { status: 500 })
  }
  const path = `vps/${randomUUID()}.${KINDS[kind]}`
  const up = await storage.from(VPS_IMAGE_BUCKET).upload(path, buf, { contentType: kind, upsert: false, cacheControl: '31536000' })
  if (up.error) return NextResponse.json({ error: 'Falha ao guardar a imagem. A imagem anterior mantém-se.' }, { status: 500 })
  try { await getPool().query('UPDATE products SET image_path = ? WHERE id = ?', [path, p.id]) } catch {
    await storage.from(VPS_IMAGE_BUCKET).remove([path]).catch(() => {}); return NextResponse.json({ error: 'Falha ao guardar a imagem. A imagem anterior mantém-se.' }, { status: 500 })
  }
  if (p.image_path) await storage.from(VPS_IMAGE_BUCKET).remove([p.image_path]).catch(() => {})
  await audit(adminId, p.id, `VPS ${p.name}: imagem ${p.image_path ? 'substituída' : 'carregada'}`)
  return NextResponse.json({ ok: true, imageUrl: vpsImageUrl(path) })
}

export async function DELETE(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const p = await plan(req.nextUrl.searchParams.get('productId') ?? '')
  if (!p) return NextResponse.json({ error: 'Plano VPS inexistente.' }, { status: 404 })
  if (p.image_path) {
    await getPool().query('UPDATE products SET image_path = NULL WHERE id = ?', [p.id])
    await createServiceClient().storage.from(VPS_IMAGE_BUCKET).remove([p.image_path]).catch(() => {})
    await audit(adminId, p.id, `VPS ${p.name}: imagem removida`)
  }
  return NextResponse.json({ ok: true, imageUrl: null })
}
