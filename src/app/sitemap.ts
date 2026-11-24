import type { MetadataRoute } from 'next'
import { PUBLIC_PAGES } from '@/lib/site/pages'

const SITE_URL = 'https://viralizahost.com'

// Páginas públicas a partir do registo único (src/lib/site/pages.ts) — o mesmo que alimenta o menu «Serviços».
// Área do Cliente, painel, checkout e autenticação ficam de fora (ver robots.ts). URLs encaminhados não entram.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PUBLIC_PAGES.filter(p => p.sitemap !== false).map(({ path, priority, freq }) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency: freq,
    priority,
  }))
}
