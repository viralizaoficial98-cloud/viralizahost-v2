/*
 * Topo da página inicial — tipos, constantes e validação partilhados entre
 * a página pública, as rotas /api/admin/home-hero e o painel de administração.
 * (Sem dependências de servidor: pode ser importado por Client Components.)
 */

export type HomeHeroMode = 'carousel' | 'video'

export const HOME_HERO_TABLE = 'site_home_hero'
export const HOME_HERO_VIDEO_BUCKET = 'site-videos'
export const HOME_HERO_VIDEO_FOLDER = 'home-hero'
export const HOME_HERO_VIDEO_MIME = 'video/mp4'
/** Deve coincidir com o file_size_limit do bucket (migração 20261118_000000_home_hero.sql). */
export const HOME_HERO_VIDEO_MAX_BYTES = 100 * 1024 * 1024
/** Tag usada para revalidar a página inicial quando o admin grava. */
export const HOME_HERO_CACHE_TAG = 'home-hero'

/** Linha da tabela viralizahost.site_home_hero */
export type HomeHeroSettings = {
  mode: HomeHeroMode
  video_url: string | null
  video_storage_path: string | null
  video_file_name: string | null
  video_size_bytes: number | null
  updated_at: string | null
}

/** O que o componente do topo precisa para renderizar. */
export type HeroConfig =
  | { mode: 'carousel' }
  | { mode: 'video'; videoSrc: string }

export function isHomeHeroMode(v: unknown): v is HomeHeroMode {
  return v === 'carousel' || v === 'video'
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Aceita um caminho público ("/videos/x.mp4") ou um URL HTTPS direto.
 * http:// só é aceite para localhost (desenvolvimento).
 * Rejeita "//host", caminhos relativos, javascript:, data:, etc.
 */
export function normalizeVideoSrc(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null

  if (value.startsWith('/')) {
    return value.startsWith('//') || value.includes('\\') ? null : value
  }

  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return url.toString()
    if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) return url.toString()
    return null
  } catch {
    return null
  }
}

/** Converte a linha da base de dados na configuração de renderização. */
export function settingsToHeroConfig(s: Pick<HomeHeroSettings, 'mode' | 'video_url'>): HeroConfig {
  if (s.mode !== 'video') return { mode: 'carousel' }
  const videoSrc = normalizeVideoSrc(s.video_url)
  return videoSrc ? { mode: 'video', videoSrc } : { mode: 'carousel' }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
