// Menu principal: UMA configuração para desktop e telemóvel. Exactamente cinco grupos, por esta ordem.
// «Serviços» é gerado a partir do registo de páginas publicadas (src/lib/site/pages.ts).
import { PUBLIC_PAGES, servicePagesByCategory, type PageIcon } from './pages'

export interface NavItem { label: string; desc: string; href: string; icon: PageIcon; badge?: string }
export interface NavColumn { title: string; items: NavItem[] }
export interface NavGroup { id: 'hospedagem' | 'dominios' | 'email' | 'servicos' | 'empresa'; label: string; href?: string; columns?: NavColumn[] }

const page = (path: string, over: Partial<NavItem> = {}): NavItem => {
  const p = PUBLIC_PAGES.find(x => x.path === path)
  if (!p) throw new Error(`Página não registada: ${path}`)
  return { label: p.title, desc: p.desc, href: p.path, icon: p.icon, ...over }
}

export const MAIN_NAV: NavGroup[] = [
  {
    id: 'hospedagem', label: 'Hospedagem e site', columns: [
      { title: 'Hospedagem', items: [page('/hospedagem-de-sites'), page('/revenda-de-hospedagem')] },
      { title: 'Criação de sites', items: [page('/criador-de-sites', { badge: 'Com IA' }), page('/construtor-wordpress')] },
      // Infraestrutura: só estes três (as aplicações pré-configuradas estão na página Servidor VPS)
      { title: 'Infraestrutura', items: [page('/servidor-vps'), page('/servidor-dedicado'), page('/servidor-dedicado-windows')] },
    ],
  },
  { id: 'dominios', label: 'Domínios', href: '/dominios' },
  { id: 'email', label: 'E-mail corporativo', href: '/email-corporativo' },
  {
    id: 'servicos', label: 'Serviços',
    columns: servicePagesByCategory().map(c => ({ title: c.label, items: c.pages.map(p => ({ label: p.title, desc: p.desc, href: p.path, icon: p.icon })) })),
  },
  { id: 'empresa', label: 'Empresa', columns: [{ title: 'Empresa', items: [page('/sobre'), page('/suporte'), page('/parcerias'), page('/blog')] }] },
]
