import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireAdminRole } from '@/lib/api/require-admin'
import {
  HOME_HERO_VIDEO_BUCKET, HOME_HERO_VIDEO_FOLDER,
  HOME_HERO_VIDEO_MAX_BYTES, HOME_HERO_VIDEO_MIME,
} from '@/lib/home-hero'

/** Devolve uma resposta 401/403 se o utilizador não for admin; senão o id do utilizador. */
export async function guardAdmin(): Promise<{ userId: string } | { denied: NextResponse }> {
  try {
    return { userId: await requireAdminRole() }
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    const status = err.status === 403 ? 403 : 401
    return { denied: NextResponse.json({ error: err.message ?? 'Sem permissão.' }, { status }) }
  }
}

/** Cliente service role sem db.schema (a Storage API não usa o cabeçalho de schema). */
export function storageAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Cria o bucket se a migração ainda não o tiver criado. */
export async function ensureVideoBucket(supabase: ReturnType<typeof storageAdminClient>) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error(`Não foi possível listar os buckets: ${error.message}`)
  if (buckets?.some(b => b.id === HOME_HERO_VIDEO_BUCKET)) return
  const { error: createErr } = await supabase.storage.createBucket(HOME_HERO_VIDEO_BUCKET, {
    public: true,
    fileSizeLimit: HOME_HERO_VIDEO_MAX_BYTES,
    allowedMimeTypes: [HOME_HERO_VIDEO_MIME],
  })
  if (createErr) throw new Error(`Não foi possível criar o bucket ${HOME_HERO_VIDEO_BUCKET}: ${createErr.message}`)
}

/** Só aceitamos objetos criados por /upload-url: home-hero/<nome>.mp4 */
export function isManagedVideoPath(path: unknown): path is string {
  return typeof path === 'string'
    && new RegExp(`^${HOME_HERO_VIDEO_FOLDER}/[a-z0-9][a-z0-9-]{0,120}\\.mp4$`).test(path)
}
