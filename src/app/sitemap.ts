import type { MetadataRoute } from 'next'

const SITE_URL = 'https://viralizahost.com'

type Entry = [path: string, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly']

// Public marketing pages. Client area, admin, checkout and auth pages are
// intentionally left out (see robots.ts).
const PAGES: Entry[] = [
  ['/', 1, 'weekly'],

  // Hosting & servers
  ['/hospedagem-de-sites', 0.9, 'weekly'],
  ['/hospedagem-wordpress', 0.9, 'weekly'],
  ['/revenda-de-hospedagem', 0.8, 'weekly'],
  ['/servidor-vps', 0.9, 'weekly'],
  ['/servidor-vps/n8n', 0.8, 'weekly'],
  ['/servidor-vps/openclaw', 0.8, 'weekly'],
  ['/servidor-vps/evolution-api', 0.8, 'weekly'],
  ['/servidor-vps/viraliza-ai-cloud', 0.8, 'weekly'],
  ['/servidor-dedicado', 0.8, 'weekly'],
  ['/servidor-dedicado-windows', 0.8, 'weekly'],
  ['/criador-de-sites', 0.8, 'weekly'],
  ['/construtor-wordpress', 0.8, 'weekly'],

  // Domains
  ['/dominios', 0.9, 'weekly'],
  ['/dominios/pesquisar', 0.8, 'monthly'],
  ['/dominios/precos', 0.8, 'weekly'],
  ['/dominios/registrar-ao', 0.8, 'monthly'],
  ['/dominios/registrar-com', 0.8, 'monthly'],
  ['/dominios/registrar-com-br', 0.8, 'monthly'],
  ['/dominios/transferir', 0.7, 'monthly'],
  ['/dominios/renovar', 0.7, 'monthly'],
  ['/dominios/dns-premium', 0.6, 'monthly'],
  ['/dominios/whois', 0.6, 'monthly'],
  ['/dominios/ssl', 0.6, 'monthly'],
  ['/dominios/redirecionamento', 0.5, 'monthly'],
  ['/dominios/subdominios', 0.5, 'monthly'],
  ['/dominios/nameservers', 0.5, 'monthly'],
  ['/dominios/base-conhecimento', 0.5, 'monthly'],
  ['/dominios/suporte', 0.5, 'monthly'],

  // E-mail
  ['/email-corporativo', 0.9, 'weekly'],
  ['/email/starter', 0.8, 'monthly'],
  ['/email/business', 0.8, 'monthly'],
  ['/email/enterprise', 0.8, 'monthly'],
  ['/email/microsoft-365-outlook', 0.8, 'monthly'],
  ['/email/antispam', 0.6, 'monthly'],
  ['/email/spf-dkim-dmarc', 0.6, 'monthly'],
  ['/email/backup', 0.6, 'monthly'],
  ['/email/malware', 0.6, 'monthly'],
  ['/email/alta-disponibilidade', 0.6, 'monthly'],
  ['/email/webmail', 0.6, 'monthly'],
  ['/email/outlook-365', 0.6, 'monthly'],
  ['/email/mobile', 0.6, 'monthly'],
  ['/email/calendario-contactos', 0.6, 'monthly'],
  ['/email/migracao', 0.6, 'monthly'],

  // Services
  ['/servicos', 0.7, 'monthly'],
  ['/certificado-ssl', 0.7, 'monthly'],
  ['/backup-cloud', 0.7, 'monthly'],
  ['/protecao-de-site', 0.7, 'monthly'],
  ['/migracao-gratis', 0.7, 'monthly'],
  ['/cdn-premium', 0.7, 'monthly'],

  // Resources & support
  ['/base-conhecimento', 0.5, 'monthly'],
  ['/blog', 0.5, 'weekly'],
  ['/ferramentas', 0.5, 'monthly'],
  ['/parcerias', 0.5, 'monthly'],
  ['/suporte', 0.6, 'monthly'],
  ['/suporte/contactar', 0.6, 'monthly'],
  ['/suporte/faq', 0.6, 'monthly'],
  ['/suporte/central-ajuda', 0.5, 'monthly'],
  ['/suporte/base-conhecimento', 0.5, 'monthly'],
  ['/suporte/tickets', 0.4, 'monthly'],
  ['/suporte/status', 0.4, 'daily'],
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return PAGES.map(([path, priority, changeFrequency]) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency,
    priority,
  }))
}
