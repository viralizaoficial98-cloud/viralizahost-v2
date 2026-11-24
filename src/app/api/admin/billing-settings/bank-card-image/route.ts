import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { getPool } from '@/lib/db/pool'
import { CARD_IMAGE_BUCKET, cardImageUrl } from '@/lib/billing/bank-details'

export const dynamic = 'force-dynamic'

// Imagem DECORATIVA do cartão de transferência (Configurações → Facturação). Só administradores.
// Validação no servidor: PNG, JPEG ou WebP pelo conteúdo real do ficheiro (não só pela extensão/tipo), até 2 MB.
// A imagem nova é gravada primeiro; só depois a configuração passa a apontar para ela e a anterior é apagada.
// Qualquer falha antes disso mantém a imagem anterior. Cada alteração fica em activity_logs.
const MAX_BYTES = 2 * 1024 * 1024
const KINDS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const

function sniff(b: Buffer): keyof typeof KINDS | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

async function guard(): Promise<NextResponse | string> {
  try { return await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }
}
const audit = (adminId: string, action: 'create' | 'update' | 'delete', id: string | null, description: string) =>
  getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, ?, 'billing_settings', ?, ?)", [adminId, action, id, description]).catch(() => {})

async function current() {
  const [rows] = await getPool().query('SELECT id, bank_card_image_path FROM company_billing_settings WHERE active = 1 LIMIT 1') as unknown as [{ id: string; bank_card_image_path: string | null }[]]
  return rows[0] ?? null
}

export async function POST(req: NextRequest) {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Escolha uma imagem (PNG, JPEG ou WebP).', field: 'file' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'O ficheiro está vazio.', field: 'file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `Imagem demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo: 2 MB.`, field: 'file' }, { status: 400 })
  const buf = Buffer.from(await file.arrayBuffer())
  const kind = sniff(buf)
  // O tipo declarado tem de ser PNG/JPEG/WebP E coincidir com o conteúdo real (ex.: um .png que é texto é recusado)
  if (!kind || file.type !== kind) {
    return NextResponse.json({ error: 'Formato não aceite: use uma imagem PNG, JPEG ou WebP verdadeira.', field: 'file' }, { status: 400 })
  }
  const cur = await current()
  if (!cur) return NextResponse.json({ error: 'Guarde primeiro os dados de facturação.' }, { status: 409 })

  const storage = createServiceClient().storage
  const { data: buckets } = await storage.listBuckets()
  if (!buckets?.some((x: { id: string }) => x.id === CARD_IMAGE_BUCKET)) {
    const { error } = await storage.createBucket(CARD_IMAGE_BUCKET, { public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: Object.keys(KINDS) })
    if (error) return NextResponse.json({ error: 'Não foi possível preparar o armazenamento. A imagem anterior mantém-se.' }, { status: 500 })
  }
  const path = `bank-card/${randomUUID()}.${KINDS[kind]}`
  const up = await storage.from(CARD_IMAGE_BUCKET).upload(path, buf, { contentType: kind, upsert: false, cacheControl: '31536000' })
  if (up.error) return NextResponse.json({ error: 'Falha ao guardar a imagem. A imagem anterior mantém-se.' }, { status: 500 })
  try {
    await getPool().query('UPDATE company_billing_settings SET bank_card_image_path = ?, updated_by = ? WHERE id = ?', [path, adminId, cur.id])
  } catch {
    await storage.from(CARD_IMAGE_BUCKET).remove([path]).catch(() => {})
    return NextResponse.json({ error: 'Falha ao guardar a imagem. A imagem anterior mantém-se.' }, { status: 500 })
  }
  if (cur.bank_card_image_path) await storage.from(CARD_IMAGE_BUCKET).remove([cur.bank_card_image_path]).catch(() => {})
  await audit(adminId, cur.bank_card_image_path ? 'update' : 'create', cur.id, `Facturação: imagem do cartão ${cur.bank_card_image_path ? 'substituída' : 'carregada'} (${kind}, ${Math.round(file.size / 1024)} KB)`)
  return NextResponse.json({ ok: true, cardImageUrl: cardImageUrl(path), path })
}

export async function DELETE() {
  const adminId = await guard(); if (typeof adminId !== 'string') return adminId
  const cur = await current()
  if (!cur?.bank_card_image_path) return NextResponse.json({ ok: true, cardImageUrl: null })
  await getPool().query('UPDATE company_billing_settings SET bank_card_image_path = NULL, updated_by = ? WHERE id = ?', [adminId, cur.id])
  await createServiceClient().storage.from(CARD_IMAGE_BUCKET).remove([cur.bank_card_image_path]).catch(() => {})
  await audit(adminId, 'delete', cur.id, 'Facturação: imagem do cartão removida (os dados bancários continuam visíveis)')
  return NextResponse.json({ ok: true, cardImageUrl: null })
}
