import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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

export async function getHeroConfig(): Promise<HeroConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return getEnvHeroConfig()

  try {
    // Cliente sem cookies (não torna a página dinâmica) e com fetch cacheado.
    const supabase = createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'viralizahost' },
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          next: { revalidate: REVALIDATE_SECONDS, tags: [HOME_HERO_CACHE_TAG] },
        }),
      },
    })

    const { data, error } = await supabase
      .from(HOME_HERO_TABLE)
      .select('mode, video_url')
      .eq('id', 1)
      .maybeSingle<Pick<HomeHeroSettings, 'mode' | 'video_url'>>()

    if (error) throw error
    if (!data) return getEnvHeroConfig()
    return settingsToHeroConfig(data)
  } catch (err) {
    console.warn('[HeroSection] não foi possível ler site_home_hero, a usar variáveis de ambiente:', (err as Error)?.message ?? err)
    return getEnvHeroConfig()
  }
}
