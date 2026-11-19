import { unstable_cache } from 'next/cache'
import { createAnonClient } from '@/lib/supabase/server'
import {
  HOME_HERO_CACHE_TAG, HOME_HERO_TABLE,
  normalizeVideoSrc, settingsToHeroConfig,
  type HeroConfig, type HomeHeroSettings,
} from '@/lib/home-hero'

/*
 * Decide o que o topo da página inicial mostra.
 *
 * 1. Painel admin (Gestão do Site → Topo da Página Inicial), tabela
 *    viralizahost.site_home_hero — fonte principal.
 * 2. Se a base de dados não responder ou a tabela ainda não existir:
 *    variáveis HOME_HERO_MODE / HOME_HERO_VIDEO_SRC (.env.local).
 * 3. Em qualquer outro caso: carrossel.
 *
 * A leitura é cacheada (ISR): a página é regenerada quando o admin grava
 * (revalidatePath('/')) e, por segurança, no máximo a cada 60 s.
 */

const REVALIDATE_SECONDS = 60

export function getEnvHeroConfig(env: Record<string, string | undefined> = process.env): HeroConfig {
  const mode = env.HOME_HERO_MODE?.trim().toLowerCase()
  if (mode !== 'video') return { mode: 'carousel' }

  const videoSrc = normalizeVideoSrc(env.HOME_HERO_VIDEO_SRC)
  if (!videoSrc) {
    console.warn('[HeroSection] HOME_HERO_MODE=video sem HOME_HERO_VIDEO_SRC válido — a usar o carrossel.')
    return { mode: 'carousel' }
  }
  return { mode: 'video', videoSrc }
}

// Leitura cacheada (sem cookies — não torna a página dinâmica), invalidada pela tag.
const readHomeHero = unstable_cache(
  async () => {
    const { data, error } = await createAnonClient()
      .from(HOME_HERO_TABLE)
      .select('mode, video_url')
      .eq('id', 1)
      .maybeSingle<Pick<HomeHeroSettings, 'mode' | 'video_url'>>()
    if (error) throw Object.assign(new Error(error.message), { code: error.code })
    return data
  },
  ['home-hero-settings'],
  { revalidate: REVALIDATE_SECONDS, tags: [HOME_HERO_CACHE_TAG] },
)

export async function getHeroConfig(): Promise<HeroConfig> {
  if (!process.env.DB_NAME) return getEnvHeroConfig()

  try {
    const data = await readHomeHero()
    if (!data) return getEnvHeroConfig()
    return settingsToHeroConfig(data)
  } catch (err) {
    console.warn('[HeroSection] não foi possível ler site_home_hero, a usar variáveis de ambiente:', (err as Error)?.message ?? err)
    return getEnvHeroConfig()
  }
}
