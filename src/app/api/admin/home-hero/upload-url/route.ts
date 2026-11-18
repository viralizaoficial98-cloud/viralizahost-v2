import { NextRequest, NextResponse } from 'next/server'
import {
  HOME_HERO_VIDEO_BUCKET, HOME_HERO_VIDEO_FOLDER,
  HOME_HERO_VIDEO_MAX_BYTES, HOME_HERO_VIDEO_MIME, formatBytes,
} from '@/lib/home-hero'
import { ensureVideoBucket, guardAdmin, storageAdminClient } from '@/lib/home-hero-admin'

/**
 * POST /api/admin/home-hero/upload-url
 * Body: { fileName: string, size: number, contentType: string }
 *
 * Emite um URL assinado (válido 2 h) para o browser do admin enviar o MP4
 * diretamente para o Supabase Storage — o ficheiro não passa pelo servidor
 * Node/Apache, evitando limites de tamanho de pedido no cPanel.
 */
export async function POST(req: NextRequest) {
  const auth = await guardAdmin()
  if ('denied' in auth) return auth.denied

  let body: { fileName?: unknown; size?: unknown; contentType?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }

  const fileName = typeof body.fileName === 'string' ? body.fileName : ''
  const size = typeof body.size === 'number' ? body.size : NaN

  if (body.contentType !== HOME_HERO_VIDEO_MIME || !/\.mp4$/i.test(fileName)) {
    return NextResponse.json({ error: 'Formato não suportado. Envie um ficheiro MP4 (H.264).' }, { status: 400 })
  }
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Ficheiro vazio ou tamanho inválido.' }, { status: 400 })
  }
  if (size > HOME_HERO_VIDEO_MAX_BYTES) {
    return NextResponse.json({
      error: `Ficheiro muito grande (${formatBytes(size)}). Máximo: ${formatBytes(HOME_HERO_VIDEO_MAX_BYTES)}.`,
    }, { status: 400 })
  }

  const slug = fileName
    .replace(/\.mp4$/i, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'video'
  const path = `${HOME_HERO_VIDEO_FOLDER}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slug}.mp4`

  try {
    const supabase = storageAdminClient()
    await ensureVideoBucket(supabase)
    const { data, error } = await supabase.storage.from(HOME_HERO_VIDEO_BUCKET).createSignedUploadUrl(path)
    if (error || !data) throw new Error(error?.message ?? 'sem resposta')
    return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl })
  } catch (err) {
    console.error('[home-hero/upload-url]', err)
    return NextResponse.json({ error: `Não foi possível preparar o envio: ${(err as Error).message}` }, { status: 500 })
  }
}
