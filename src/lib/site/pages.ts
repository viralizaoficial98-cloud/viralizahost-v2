// Registo ÚNICO das páginas públicas do site (sem dependências de servidor): alimenta o sitemap, o grupo «Serviços»
// do menu principal (desktop e telemóvel) e as secções de ligações das páginas consolidadas. Uma página que deixe de
// estar publicada sai daqui — e desaparece do menu e do sitemap ao mesmo tempo.
// Excluídos por natureza: Área do Cliente, painel, checkout/carrinho, autenticação e rascunhos.

export type PageIcon =
  | 'server' | 'users' | 'zap' | 'code' | 'cpu' | 'workflow' | 'shield' | 'message' | 'bot' | 'harddrive' | 'monitor' | 'globe' | 'search'
  | 'move' | 'rotate' | 'gauge' | 'lock' | 'shieldcheck' | 'layers' | 'database' | 'book' | 'mail' | 'alert' | 'archive' | 'activity'
  | 'smartphone' | 'calendar' | 'refresh' | 'rss' | 'wrench' | 'handshake' | 'headphones' | 'building' | 'tag' | 'help'

/** Categorias do grupo «Serviços» (ordem do menu). */
export const SERVICE_CATEGORIES = [
  { id: 'hospedagem', label: 'Hospedagem e sites' },
  { id: 'servidores', label: 'Servidores' },
  { id: 'dominios', label: 'Domínios' },
  { id: 'email', label: 'E-mail corporativo' },
  { id: 'seguranca', label: 'Segurança e desempenho' },
] as const
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]['id']

export interface PublicPage {
  path: string; title: string; desc: string; icon: PageIcon
  /** Categoria no grupo «Serviços» (só páginas de serviço) */
  service?: ServiceCategory
  /** Secção da página consolidada onde a página é apresentada (ex.: 'dominios-gestao') */
  section?: string
  /** false = não entra no sitemap (ex.: fluxo de compra) */
  sitemap?: boolean
  priority: number; freq: 'daily' | 'weekly' | 'monthly'
}

export const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', title: 'Início', desc: 'ViralizaHost', icon: 'globe', priority: 1, freq: 'weekly' },

  // Hospedagem e sites
  { path: '/hospedagem-de-sites', title: 'Hospedagem de Sites', desc: 'cPanel, NVMe e SSL — com planos WordPress', icon: 'server', service: 'hospedagem', priority: 0.9, freq: 'weekly' },
  { path: '/revenda-de-hospedagem', title: 'Revenda de Hospedagem', desc: 'WHM/cPanel para revenda profissional', icon: 'users', service: 'hospedagem', priority: 0.8, freq: 'weekly' },
  { path: '/criador-de-sites', title: 'Criador de Sites com IA', desc: 'Crie um site profissional em minutos', icon: 'zap', service: 'hospedagem', priority: 0.8, freq: 'weekly' },
  { path: '/construtor-wordpress', title: 'Construtor WordPress', desc: 'WordPress com builder visual e plugins premium', icon: 'code', service: 'hospedagem', priority: 0.8, freq: 'weekly' },

  // Servidores (infraestrutura)
  { path: '/servidor-vps', title: 'Servidor VPS', desc: 'Alta performance, recursos escaláveis e acesso root', icon: 'cpu', service: 'servidores', priority: 0.9, freq: 'weekly' },
  { path: '/servidor-vps/n8n', title: 'VPS n8n Auto-hospedado', desc: 'Automações e workflows sem código', icon: 'workflow', service: 'servidores', section: 'vps-apps', priority: 0.8, freq: 'weekly' },
  { path: '/servidor-vps/openclaw', title: 'Servidor VPS OpenClaw', desc: 'Agentes de IA com autonomia total', icon: 'shield', service: 'servidores', section: 'vps-apps', priority: 0.8, freq: 'weekly' },
  { path: '/servidor-vps/evolution-api', title: 'VPS Evolution API', desc: 'WhatsApp Business, chatbots e integrações', icon: 'message', service: 'servidores', section: 'vps-apps', priority: 0.8, freq: 'weekly' },
  { path: '/servidor-vps/viraliza-ai-cloud', title: 'Viraliza AI Cloud', desc: 'Agentes IA prontos para o negócio', icon: 'bot', service: 'servidores', section: 'vps-apps', priority: 0.8, freq: 'weekly' },
  { path: '/servidor-dedicado', title: 'Servidor Dedicado Linux', desc: 'Hardware exclusivo com root, cPanel/WHM e Docker', icon: 'harddrive', service: 'servidores', priority: 0.8, freq: 'weekly' },
  { path: '/servidor-dedicado-windows', title: 'Servidor Dedicado Windows', desc: 'Windows Server com Plesk, MS SQL e RDP', icon: 'monitor', service: 'servidores', priority: 0.8, freq: 'weekly' },

  // Domínios
  { path: '/dominios', title: 'Domínios', desc: 'Pesquisar, registar, transferir e renovar', icon: 'globe', service: 'dominios', priority: 0.9, freq: 'weekly' },
  { path: '/dominios/pesquisar', title: 'Pesquisar domínio', desc: 'Verifique a disponibilidade e registe', icon: 'search', section: 'dominios-registo', priority: 0.8, freq: 'monthly' },
  { path: '/dominios/registrar-ao', title: 'Registar domínio .ao', desc: 'Domínio oficial de Angola', icon: 'globe', service: 'dominios', section: 'dominios-registo', priority: 0.8, freq: 'monthly' },
  { path: '/dominios/registrar-com', title: 'Registar domínio .com', desc: 'O domínio mais popular do mundo', icon: 'globe', service: 'dominios', section: 'dominios-registo', priority: 0.8, freq: 'monthly' },
  { path: '/dominios/registrar-com-br', title: 'Registar domínio .com.br', desc: 'Domínio oficial do Brasil', icon: 'globe', service: 'dominios', section: 'dominios-registo', priority: 0.8, freq: 'monthly' },
  { path: '/dominios/transferir', title: 'Transferir domínio', desc: 'Traga o seu domínio com o código EPP', icon: 'move', service: 'dominios', section: 'dominios-registo', priority: 0.7, freq: 'monthly' },
  { path: '/dominios/renovar', title: 'Renovar domínio', desc: 'Renove antes do prazo', icon: 'rotate', service: 'dominios', section: 'dominios-registo', priority: 0.7, freq: 'monthly' },
  { path: '/dominios/dns-premium', title: 'DNS Premium', desc: 'Propagação rápida e fiável', icon: 'gauge', service: 'dominios', section: 'dominios-gestao', priority: 0.6, freq: 'monthly' },
  { path: '/dominios/whois', title: 'Protecção e consulta WHOIS', desc: 'Oculte os seus dados e consulte domínios', icon: 'lock', service: 'dominios', section: 'dominios-gestao', priority: 0.6, freq: 'monthly' },
  { path: '/dominios/ssl', title: 'SSL para o domínio', desc: 'HTTPS gratuito para o seu domínio', icon: 'shieldcheck', service: 'dominios', section: 'dominios-gestao', priority: 0.6, freq: 'monthly' },
  { path: '/dominios/redirecionamento', title: 'Redirecionamento', desc: 'Redirecione domínios com facilidade', icon: 'move', service: 'dominios', section: 'dominios-gestao', priority: 0.5, freq: 'monthly' },
  { path: '/dominios/subdominios', title: 'Subdomínios', desc: 'Crie subdomínios ilimitados', icon: 'layers', service: 'dominios', section: 'dominios-gestao', priority: 0.5, freq: 'monthly' },
  { path: '/dominios/nameservers', title: 'Gestão de nameservers', desc: 'Controle total dos seus nameservers', icon: 'database', service: 'dominios', section: 'dominios-gestao', priority: 0.5, freq: 'monthly' },
  { path: '/dominios/precos', title: 'Preços de domínios', desc: 'Tabela completa de registo e renovação', icon: 'tag', section: 'dominios-recursos', priority: 0.8, freq: 'weekly' },
  { path: '/dominios/base-conhecimento', title: 'Guias de domínios', desc: 'Tutoriais e guias', icon: 'book', section: 'dominios-recursos', priority: 0.5, freq: 'monthly' },
  { path: '/dominios/suporte', title: 'Suporte para domínios', desc: 'Equipa técnica especializada', icon: 'headphones', section: 'dominios-recursos', priority: 0.5, freq: 'monthly' },

  // E-mail
  { path: '/email-corporativo', title: 'E-mail Corporativo', desc: 'Planos, períodos e compra online', icon: 'mail', service: 'email', priority: 0.9, freq: 'weekly' },
  // Planos de e-mail: o fluxo de compra de cada plano (/email/starter|business|enterprise encaminham para aqui)
  { path: '/comprar/email-starter', title: 'E-mail Starter', desc: 'Plano de entrada, preço por caixa', icon: 'mail', section: 'email-planos', sitemap: false, priority: 0.8, freq: 'monthly' },
  { path: '/comprar/email-standard', title: 'E-mail Standard', desc: 'Mais espaço, preço por caixa', icon: 'zap', section: 'email-planos', sitemap: false, priority: 0.8, freq: 'monthly' },
  { path: '/comprar/email-premium', title: 'E-mail Premium', desc: 'Máximo espaço, preço por caixa', icon: 'server', section: 'email-planos', sitemap: false, priority: 0.8, freq: 'monthly' },
  { path: '/email/microsoft-365-outlook', title: 'Microsoft 365 Outlook', desc: 'Outlook, Teams e OneDrive', icon: 'monitor', service: 'email', section: 'email-planos', priority: 0.8, freq: 'monthly' },
  { path: '/email/antispam', title: 'AntiSpam Premium', desc: 'Bloqueio avançado de spam', icon: 'alert', service: 'email', section: 'email-seguranca', priority: 0.6, freq: 'monthly' },
  { path: '/email/spf-dkim-dmarc', title: 'SPF / DKIM / DMARC', desc: 'Autenticação de e-mail profissional', icon: 'shieldcheck', service: 'email', section: 'email-seguranca', priority: 0.6, freq: 'monthly' },
  { path: '/email/backup', title: 'Backup de e-mails', desc: 'Cópias diárias automáticas', icon: 'archive', service: 'email', section: 'email-seguranca', priority: 0.6, freq: 'monthly' },
  { path: '/email/malware', title: 'Protecção contra malware', desc: 'Análise e quarentena de ameaças', icon: 'shield', service: 'email', section: 'email-seguranca', priority: 0.6, freq: 'monthly' },
  { path: '/email/alta-disponibilidade', title: 'Alta disponibilidade', desc: 'Infraestrutura redundante', icon: 'activity', service: 'email', section: 'email-seguranca', priority: 0.6, freq: 'monthly' },
  { path: '/email/webmail', title: 'Webmail profissional', desc: 'E-mail em qualquer browser', icon: 'globe', service: 'email', section: 'email-produtividade', priority: 0.6, freq: 'monthly' },
  { path: '/email/outlook-365', title: 'Outlook 365', desc: 'Cliente desktop da Microsoft', icon: 'monitor', service: 'email', section: 'email-produtividade', priority: 0.6, freq: 'monthly' },
  { path: '/email/mobile', title: 'Sincronização mobile', desc: 'IMAP/ActiveSync para iOS e Android', icon: 'smartphone', service: 'email', section: 'email-produtividade', priority: 0.6, freq: 'monthly' },
  { path: '/email/calendario-contactos', title: 'Calendário e contactos', desc: 'Agenda partilhada e sincronizada', icon: 'calendar', service: 'email', section: 'email-produtividade', priority: 0.6, freq: 'monthly' },
  { path: '/email/migracao', title: 'Migração de e-mails', desc: 'Migre sem perder dados', icon: 'move', service: 'email', section: 'email-produtividade', priority: 0.6, freq: 'monthly' },

  // Segurança e desempenho
  { path: '/certificado-ssl', title: 'Certificado SSL', desc: 'Segurança para o seu site', icon: 'lock', service: 'seguranca', priority: 0.7, freq: 'monthly' },
  { path: '/backup-cloud', title: 'Backup Cloud', desc: 'Protecção e backup automático', icon: 'refresh', service: 'seguranca', priority: 0.7, freq: 'monthly' },
  { path: '/protecao-de-site', title: 'Protecção de Site', desc: 'Anti-malware e firewall', icon: 'shield', service: 'seguranca', priority: 0.7, freq: 'monthly' },
  { path: '/cdn-premium', title: 'CDN Premium', desc: 'Velocidade global', icon: 'gauge', service: 'seguranca', priority: 0.7, freq: 'monthly' },
  { path: '/migracao-gratis', title: 'Migração Grátis', desc: 'Migração sem custo', icon: 'zap', service: 'seguranca', priority: 0.7, freq: 'monthly' },

  // Empresa e recursos
  { path: '/servicos', title: 'Todos os serviços', desc: 'Catálogo completo', icon: 'layers', priority: 0.7, freq: 'monthly' },
  { path: '/sobre', title: 'Sobre nós', desc: 'Quem somos e onde estamos', icon: 'building', priority: 0.6, freq: 'monthly' },
  { path: '/suporte', title: 'Suporte', desc: 'Ajuda, tickets e contactos', icon: 'headphones', priority: 0.6, freq: 'monthly' },
  { path: '/parcerias', title: 'Parceria', desc: 'Programa de parceiros e afiliados', icon: 'handshake', priority: 0.5, freq: 'monthly' },
  { path: '/blog', title: 'Blog', desc: 'Novidades e artigos', icon: 'rss', priority: 0.5, freq: 'weekly' },
  { path: '/base-conhecimento', title: 'Base de conhecimento', desc: 'Tutoriais e guias', icon: 'book', priority: 0.5, freq: 'monthly' },
  { path: '/ferramentas', title: 'Ferramentas', desc: 'Utilitários', icon: 'wrench', priority: 0.5, freq: 'monthly' },
  { path: '/suporte/contactar', title: 'Contactar', desc: 'Fale com a equipa', icon: 'message', priority: 0.6, freq: 'monthly' },
  { path: '/suporte/faq', title: 'Perguntas frequentes', desc: 'Respostas rápidas', icon: 'help', priority: 0.6, freq: 'monthly' },
  { path: '/suporte/central-ajuda', title: 'Central de ajuda', desc: 'Guias de utilização', icon: 'book', priority: 0.5, freq: 'monthly' },
  { path: '/suporte/base-conhecimento', title: 'Tutoriais', desc: 'Passo a passo', icon: 'book', priority: 0.5, freq: 'monthly' },
  { path: '/suporte/tickets', title: 'Tickets', desc: 'Abrir um pedido de suporte', icon: 'headphones', priority: 0.4, freq: 'monthly' },
  { path: '/suporte/status', title: 'Estado do sistema', desc: 'Disponibilidade dos serviços', icon: 'activity', priority: 0.4, freq: 'daily' },
]

/** Páginas de serviço publicadas, por categoria (grupo «Serviços» do menu). */
export function servicePagesByCategory() {
  return SERVICE_CATEGORIES.map(c => ({ ...c, pages: PUBLIC_PAGES.filter(p => p.service === c.id) })).filter(c => c.pages.length)
}
export const pagesInSection = (section: string) => PUBLIC_PAGES.filter(p => p.section === section)

/**
 * URLs consolidados pela reorganização do menu: o antigo endereço encaminha (308) para a secção equivalente.
 * Os restantes URLs antigos mantêm-se porque continuam a ter função própria (ver docs/menu-e-paginas.md).
 */
export const CONSOLIDATED_REDIRECTS: { source: string; destination: string }[] = [
  { source: '/hospedagem-wordpress', destination: '/hospedagem-de-sites#planos-wordpress' },
]
