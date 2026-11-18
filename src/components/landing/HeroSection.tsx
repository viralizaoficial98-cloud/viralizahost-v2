import { HeroCarousel } from './HeroCarousel'
import { HeroVideo } from './HeroVideo'
import { getHeroConfig } from './heroConfig'

/**
 * Topo da página inicial.
 *
 * Alterna entre o carrossel original e um vídeo conforme a configuração gravada
 * no painel admin (ver heroConfig.ts). Em modo vídeo o carrossel fica desmontado:
 * sem rotação automática, sem atalhos de teclado e sem pedido de banners ao Supabase.
 */
export async function HeroSection() {
  const config = await getHeroConfig()
  if (config.mode === 'video') return <HeroVideo src={config.videoSrc} />
  return <HeroCarousel />
}
