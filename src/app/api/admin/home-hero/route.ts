import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createAdminWriteClient } from '@/lib/supabase/server'
import {
  HOME_HERO_CACHE_TAG, HOME_HERO_TABLE, HOME_HERO_VIDEO_BUCKET,
  isHomeHeroMode, normalizeVideoSrc,
  type HomeHeroSettings,
} from '@/lib/home-hero'
import { guardAdmin, isManagedVideoPath, storageAdminClient } from '@/lib/home-hero-admin'

/*
 * /api/admin/home-hero — configuração do topo da página inicial.
 *
 *   GET     → definições atuais
 *   PUT     → { mode: 'carousel' | 'video', video?: VideoInput }
 *   DELETE  → remove o vídeo e volta ao carrossel
 *
 *   VideoInput =
 *     | { source: 'storage', storagePath, fileName, sizeBytes }   // enviado pelo painel
 *     | { source: 'url', url }                                     // /caminho ou https://
 *
 * Depois de gravar, a página inicial é revalidada (próxima visita já mostra o novo modo).
 */

const COLUMNS = 'mode, video_url, video_storage_path, video_file_name, video_size_bytes, updated_at'

const DEFAULT_SETTINGS: HomeHeroSettings = {
  mode: 'carousel', video_url: null, video_storage_path: null,
  video_file_name: null, video_size_bytes: null, updated_at: null,
}

type VideoFields = Pick<HomeHeroSettings, 'video_url' | 'video_storage_path' | 'video_file_name' | 'video_size_bytes'>

async function loadSettings() {
  const db = createAdminWriteClient()
  const { data, error } = await db.from(HOME_HERO_TABLE).select(COLUMNS).eq('id', 1).maybeSingle<HomeHeroSettings>()
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
  return data ?? DEFAULT_SETTINGS
}

function dbErrorResponse(err: unknown) {
  const e = err as { message?: string; code?: string }
  console.error('[admin/home-hero]', e)
  // 42P01 / PGRST205 = tabela inexistente → migração por executar
  const missing = e.code === '42P01' || e.code === 'PGRST205' || /site_home_hero/.test(e.message ?? '')
  return NextResponse.json({
    error: missing
      ? 'A tabela site_home_hero não existe. Importe database/mariadb/001_schema.sql no phpMyAdmin.'
      : `Erro na base de dados: ${e.message ?? 'desconhecido'}`,
  }, { status: 500 })
}

/** Apaga um vídeo antigo do bucket (só objetos geridos por este módulo). */
async function removeStoredVideo(path: string | null | undefined) {
  if (!isManagedVideoPath(path)) return
  const { error } = await storageAdminClient().storage.from(HOME_HERO_VIDEO_BUCKET).remove([path])
  if (error) console.warn('[admin/home-hero] não foi possível apagar o vídeo antigo:', path, error.message)
}

export async function GET() {
  const auth = await guardAdmin()
  if ('denied' in auth) return auth.denied
  try {
    return NextResponse.json({ settings: await loadSettings() })
  } catch (err) {
    return dbErrorResponse(err)
  }
}

export async function PUT(req: NextRequest) {
  const auth = await guardAdmin()
  if ('denied' in auth) return auth.denied

  let body: { mode?: unknown; video?: Record<string, unknown> | null }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }

  if (!isHomeHeroMode(body.mode)) {
    return NextResponse.json({ error: 'Modo inválido. Use "carousel" ou "video".' }, { status: 400 })
  }

  let current: HomeHeroSettings
  try { current = await loadSettings() } catch (err) { return dbErrorResponse(err) }

  // ── Vídeo: novo (storage ou URL) ou o atual ──────────────────
  let video: VideoFields = {
    video_url: current.video_url,
    video_storage_path: current.video_storage_path,
    video_file_name: current.video_file_name,
    video_size_bytes: current.video_size_bytes,
  }

  const input = body.video
  if (input && input.source === 'storage') {
    if (!isManagedVideoPath(input.storagePath)) {
      return NextResponse.json({ error: 'Caminho do vídeo inválido.' }, { status: 400 })
    }
    const storage = storageAdminClient().storage.from(HOME_HERO_VIDEO_BUCKET)
    const { data: exists, error: existsErr } = await storage.exists(input.storagePath)
    if (existsErr || !exists) {
      return NextResponse.json({ error: 'O vídeo não foi encontrado no Storage. Envie-o novamente.' }, { status: 400 })
    }
    const { data: pub } = storage.getPublicUrl(input.storagePath)
    video = {
      video_url: pub.publicUrl,
      video_storage_path: input.storagePath,
      video_file_name: typeof input.fileName === 'string' ? input.fileName.slice(0, 200) : null,
      video_size_bytes: typeof input.sizeBytes === 'number' && input.sizeBytes > 0 ? Math.round(input.sizeBytes) : null,
    }
  } else if (input && input.source === 'url') {
    const url = normalizeVideoSrc(typeof input.url === 'string' ? input.url : null)
    if (!url) {
      return NextResponse.json({
        error: 'URL inválido. Use um caminho público (/videos/ficheiro.mp4) ou um URL https:// direto para o MP4.',
      }, { status: 400 })
    }
    video = { video_url: url, video_storage_path: null, video_file_name: null, video_size_bytes: null }
  } else if (input) {
    return NextResponse.json({ error: 'Origem do vídeo inválida.' }, { status: 400 })
  }

  if (body.mode === 'video' && !normalizeVideoSrc(video.video_url)) {
    return NextResponse.json({ error: 'Carregue um vídeo antes de ativar o modo vídeo.' }, { status: 400 })
  }

  const db = createAdminWriteClient()
  const { data, error } = await db
    .from(HOME_HERO_TABLE)
    .upsert({ id: 1, mode: body.mode, ...video, updated_by: auth.userId }, { onConflict: 'id' })
    .select(COLUMNS)
    .single<HomeHeroSettings>()
  if (error) return dbErrorResponse(error)

  // O vídeo anterior deixou de ser usado → libertar espaço no bucket
  if (current.video_storage_path && current.video_storage_path !== video.video_storage_path) {
    await removeStoredVideo(current.video_storage_path)
  }

  revalidatePath('/')
  revalidateTag(HOME_HERO_CACHE_TAG, { expire: 0 })
  return NextResponse.json({ settings: data })
}

export async function DELETE() {
  const auth = await guardAdmin()
  if ('denied' in auth) return auth.denied

  let current: HomeHeroSettings
  try { current = await loadSettings() } catch (err) { return dbErrorResponse(err) }

  const db = createAdminWriteClient()
  const { data, error } = await db
    .from(HOME_HERO_TABLE)
    .upsert({
      id: 1, mode: 'carousel',
      video_url: null, video_storage_path: null, video_file_name: null, video_size_bytes: null,
      updated_by: auth.userId,
    }, { onConflict: 'id' })
    .select(COLUMNS)
    .single<HomeHeroSettings>()
  if (error) return dbErrorResponse(error)

  await removeStoredVideo(current.video_storage_path)
  revalidatePath('/')
  revalidateTag(HOME_HERO_CACHE_TAG, { expire: 0 })
  return NextResponse.json({ settings: data })
}
