'use client'
import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
import { useLocale } from '@/hooks/useLocale'
import {
  Mail, Phone, MapPin, MessageCircle, Globe2, Play, Briefcase, Users,
  Server, Cpu, Globe, Bot, BookOpen, Headphones, Building2,
  ChevronRight, CreditCard, Landmark, ArrowRightLeft,
} from 'lucide-react'

/* ── Column icon map ── */
const COL_ICONS: Record<string, React.ElementType> = {
  'Hospedagem':      Server,
  'Servidores':      Cpu,
  'Domínios':        Globe,
  'E-mail Corporativo': Mail,
  'IA & Automação':  Bot,
  'Recursos':        BookOpen,
  'Suporte':         Headphones,
  'Empresa':         Building2,
}

/* ── Column accent colors ── */
const COL_COLORS: Record<string, string> = {
  'Hospedagem':         '#F5B700',
  'Servidores':         '#3B82F6',
  'Domínios':           '#10B981',
  'E-mail Corporativo': '#F59E0B',
  'IA & Automação':     '#8B5CF6',
  'Recursos':           '#06B6D4',
  'Suporte':            '#EF4444',
  'Empresa':            '#64748B',
}

const columns = [
  {
    title: 'Hospedagem',
    links: [
      { label: 'Hospedagem de Sites',  href: '/hospedagem-de-sites' },
      { label: 'Hospedagem WordPress', href: '/hospedagem-de-sites#wordpress' },
      { label: 'Criador de Sites',     href: '/criador-de-sites' },
      { label: 'Revenda WHM',          href: '/revenda-de-hospedagem' },
    ],
  },
  {
    title: 'Servidores',
    links: [
      { label: 'Servidor VPS',         href: '/servidor-vps' },
      { label: 'Servidor Dedicado',    href: '/servidor-dedicado' },
      { label: 'VPS n8n Auto-hospedado', href: '/servidor-vps/n8n' },
      { label: 'Viraliza AI Cloud',    href: '/servidor-vps/viraliza-ai-cloud' },
    ],
  },
  {
    title: 'Domínios',
    links: [
      { label: 'Pesquisar Domínio', href: '/dominios/pesquisar' },
      { label: 'Transferir Domínio', href: '/dominios/transferir' },
      { label: 'Domínios .ao',      href: '/dominios/registrar-ao' },
      { label: 'Preços de domínios', href: '/dominios/precos' },
    ],
  },
  {
    title: 'E-mail Corporativo',
    links: [
      { label: 'Planos de e-mail',  href: '/email-corporativo#planos' },
      { label: 'E-mail Starter',    href: '/email/starter' },
      { label: 'E-mail Business',   href: '/email/business' },
      { label: 'Microsoft 365',     href: '/email/microsoft-365-outlook' },
    ],
  },
  {
    title: 'IA & Automação',
    links: [
      { label: 'Agentes de IA',  href: '/servidor-vps/viraliza-ai-cloud' },
      { label: 'n8n Gerido',     href: '/servidor-vps/n8n' },
      { label: 'Integrações',    href: '/servicos' },
      { label: 'Consultoria IA', href: '/suporte/contactar' },
    ],
  },
  {
    title: 'Recursos',
    links: [
      { label: 'Blog',          href: '/blog' },
      { label: 'Documentação',  href: '/base-conhecimento' },
      { label: 'Tutoriais',     href: '/suporte/base-conhecimento' },
      { label: 'Afiliados',     href: '/parcerias' },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Central de Ajuda',  href: '/suporte/central-ajuda' },
      { label: 'Abrir Ticket',      href: '/suporte/tickets' },
      { label: 'Chat ao Vivo',      href: '/suporte/contactar' },
      { label: 'Status do Sistema', href: '/suporte/status' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Sobre nós',            href: '/sobre' },
      { label: 'Suporte',              href: '/suporte' },
      { label: 'Parceria',             href: '/parcerias' },
      { label: 'Blog',                 href: '/blog' },
      { label: 'Carreiras',            href: '/suporte/contactar' },
      { label: 'Contacto',             href: '/suporte/contactar' },
    ],
  },
]

// Redes sociais: só aparecem as que têm URL oficial (href diferente de '#')
const socials = [
  { Icon: MessageCircle, href: '#', label: 'Instagram',   color: '#E1306C' },
  { Icon: Users,         href: '#', label: 'Facebook',    color: '#1877F2' },
  { Icon: Globe2,        href: '#', label: 'Twitter / X', color: '#1DA1F2' },
  { Icon: Play,          href: '#', label: 'YouTube',     color: '#FF0000' },
  { Icon: Briefcase,     href: '#', label: 'LinkedIn',    color: '#0A66C2' },
]

/* ── Inline SVG icons for payment (React-compatible) ── */
function TransferBadge() {
  return (
    <div className="group flex flex-col items-center gap-1.5 cursor-default">
      <div className="flex flex-col items-center justify-center w-[58px] h-[36px] rounded-lg border border-[#E0E0E0] bg-[#0F4C81] shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-[#F5B700]/40 px-1">
        <Landmark size={11} className="text-white mb-0.5 shrink-0" />
        <span className="text-white font-bold text-[8px] leading-none tracking-tight">TRANSF.</span>
      </div>
      <span className="text-[10px] text-[#999]">Transferência</span>
    </div>
  )
}

export function Footer() {
  const { t } = useLocale()
  return (
    <footer className="bg-[#F5F5F5] border-t border-[#E8E8E8]">
      {/* Top yellow accent */}
      <div className="h-1 bg-[#F5B700]" />

      <div className="container mx-auto px-4 pt-14 pb-8">
        {/* Brand + contact */}
        <div className="flex flex-col lg:flex-row gap-10 mb-12 pb-12 border-b border-[#E0E0E0]">
          <div className="lg:w-72 shrink-0 space-y-5">
            <Logo variant="dark" size="sm" />
            <p className="text-[#555] text-sm leading-relaxed">
              {t('home.heroSubtitle') !== 'home.heroSubtitle'
                ? t('home.heroSubtitle')
                : 'Premium web hosting with LiteSpeed, NVMe SSD and 24/7 support.'}
            </p>
            <div className="space-y-2 text-sm">
              {[
                { Icon: Mail,    text: 'suporte@viralizahost.com' },
                { Icon: Phone,   text: '+244 951 008 653' },
                { Icon: MapPin,  text: 'Luanda, Angola · São Paulo, Brasil' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-[#555] hover:text-[#0A0A0A] transition-colors">
                  <Icon size={13} className="text-[#F5B700] shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 pt-1">
              {socials.filter(x => x.href !== '#').map(({ Icon, href, label, color }) => (
                <a key={label} href={href} aria-label={label}
                  className="w-9 h-9 bg-white border border-[#E0E0E0] hover:border-[#F5B700] rounded-xl flex items-center justify-center transition-all duration-200 hover:shadow-md hover:scale-105"
                  style={{ '--hover-color': color } as React.CSSProperties}
                  onMouseEnter={e => { (e.currentTarget.querySelector('svg') as SVGElement | null)?.setAttribute('color', color) }}
                  onMouseLeave={e => { (e.currentTarget.querySelector('svg') as SVGElement | null)?.setAttribute('color', '#666') }}
                >
                  <Icon size={15} color="#666" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns grid */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-8">
            {columns.map(({ title, links }) => {
              const ColIcon = COL_ICONS[title] ?? Server
              const colColor = COL_COLORS[title] ?? '#F5B700'
              return (
                <div key={title}>
                  {/* Column header with icon */}
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${colColor}18` }}
                    >
                      <ColIcon size={13} style={{ color: colColor }} />
                    </div>
                    <h4 className="text-[#0A0A0A] font-bold text-sm leading-none">{title}</h4>
                  </div>

                  <ul className="space-y-2">
                    {links.map(({ label, href }) => (
                      <li key={label}>
                        <Link
                          href={href}
                          className="group flex items-center gap-1.5 text-[#666] hover:text-[#0A0A0A] text-[13px] transition-colors"
                        >
                          <ChevronRight
                            size={11}
                            className="text-[#F5B700] opacity-0 group-hover:opacity-100 -ml-1 transition-all duration-150 shrink-0"
                          />
                          <span className="group-hover:translate-x-0.5 transition-transform duration-150">
                            {label}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment methods */}
        <div className="mb-8 pb-8 border-b border-[#E0E0E0]">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ArrowRightLeft size={13} className="text-[#F5B700]" />
            <p className="text-xs text-[#999] font-semibold uppercase tracking-wider">{t('footer.paymentMethods')}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {/* Só os métodos disponíveis no checkout (cartão / Multicaixa Express sem gateway contratado) */}
            <TransferBadge />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#999]">
          <p>© {new Date().getFullYear()} ViralizaHost. {t('footer.rights')}</p>
          <div className="flex flex-wrap justify-center gap-4">
            {[['Termos de Serviço', '/terms'], ['Política de Privacidade', '/privacy'], ['Cookies', '/privacy#cookies']].map(([l, h]) => (
              <Link key={l} href={h} className="hover:text-[#0A0A0A] transition-colors">{l}</Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span>🇦🇴 Angola</span>
            <span>🇧🇷 Brasil</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" />
              <span className="text-green-600">{t('status.success') !== 'status.success' ? 'Online' : 'Online'}</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
