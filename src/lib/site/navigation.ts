// Menu principal: UMA configuração para desktop e telemóvel. Exactamente cinco grupos, por esta ordem.
// «Serviços» é uma lista fixa de dez links; o registo de páginas publicadas (pages.ts) alimenta o sitemap e /servicos.
import { PUBLIC_PAGES, type PageIcon } from './pages'

export interface NavItem { label: string; desc: string; href: string; icon: PageIcon; badge?: string }
export interface NavColumn { title: string; items: NavItem[] }
/** Cartão de imagem dos submenus (um só modelo): imagem + link «Fale com um especialista». */
export type NavAside = 'hospedagem' | 'servicos' | 'empresa'
/** Destino da acção «Fale com um especialista» (o mesmo usado no resto do site). */
export const SPECIALIST_HREF = '/suporte/contactar'
/** Imagem de cada submenu (public/nav/*.webp, 640×480, recorte 4:3 do cartão). */
export const NAV_ASIDE_IMAGE: Record<NavAside, string> = {
  hospedagem: '/nav/hospedagem.webp',  // servidor com janela de navegador
  servicos: '/nav/servicos.webp',      // nuvem, envelope e servidor
  empresa: '/nav/empresa.webp',        // imagem ilustrativa de uma equipa a colaborar
}
export interface NavGroup { id: 'hospedagem' | 'dominios' | 'email' | 'servicos' | 'empresa'; label: string; href?: string; columns?: NavColumn[]; aside?: NavAside }

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
    aside: 'hospedagem',
  },
  { id: 'dominios', label: 'Domínios', href: '/dominios' },
  { id: 'email', label: 'E-mail corporativo', href: '/email-corporativo' },
  // Serviços: lista FIXA de dez links em quatro grupos (os mesmos no desktop e no telemóvel). As restantes páginas
  // continuam publicadas (e no sitemap) e acessíveis a partir das páginas de cada tema e de /servicos.
  {
    id: 'servicos', label: 'Serviços', aside: 'servicos', columns: [
      { title: 'Hospedagem', items: [page('/hospedagem-de-sites', { label: 'Hospedagem de site' }), page('/revenda-de-hospedagem', { label: 'Revenda de hospedagem' })] },
      { title: 'Infraestrutura', items: [page('/servidor-vps', { label: 'Servidor VPS' }), page('/servidor-dedicado', { label: 'Servidor dedicado Linux' }), page('/servidor-dedicado-windows', { label: 'Servidor dedicado Windows' })] },
      { title: 'Domínios', items: [page('/dominios', { label: 'Domínios' }), page('/dominios/transferir', { label: 'Transferir Domínio' }), page('/dominios/renovar', { label: 'Renovar domínio' })] },
      { title: 'E-mail', items: [page('/email-corporativo', { label: 'E-mail corporativo' }), page('/email/microsoft-365-outlook', { label: 'Microsoft 365 Outlook' })] },
    ],
  },
  { id: 'empresa', label: 'Empresa', aside: 'empresa', columns: [{ title: 'Empresa', items: [page('/sobre'), page('/suporte'), page('/parcerias'), page('/blog')] }] },
]
