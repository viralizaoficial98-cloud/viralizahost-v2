'use client'
import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'
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
      { label: 'Starter Host',   href: '/hospedagem-de-sites' },
      { label: 'Business Cloud', href: '/hospedagem-de-sites' },
      { label: 'Cloud Pro',      href: '/hospedagem-wordpress' },
      { label: 'Revenda WHM',    href: '/revenda-de-hospedagem' },
    ],
  },
  {
    title: 'Servidores',
    links: [
      { label: 'Servidor VPS',         href: '/servidor-vps' },
      { label: 'Servidor Dedicado',    href: '/servidor-dedicado' },
      { label: 'VPS n8n Auto-hospedado', href: '/servidor-vps/n8n' },
      { label: 'Cloud Privado',        href: '/servidor-vps' },
    ],
  },
  {
    title: 'Domínios',
    links: [
      { label: 'Pesquisar Domínio', href: '/dominios/pesquisar' },
      { label: 'Transferir Domínio', href: '/dominios/transferir' },
      { label: 'Domínios .ao',      href: '/dominios/registrar-ao' },
      { label: 'Domínios .com.br',  href: '/dominios/registrar-com-br' },
    ],
  },
  {
    title: 'E-mail Corporativo',
    links: [
      { label: 'Plano Starter',   href: '/email/starter' },
      { label: 'Plano Business',  href: '/email/business' },
      { label: 'Plano Enterprise', href: '/email/enterprise' },
      { label: 'Corporate Pro',   href: '/email/microsoft-365-outlook' },
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
      { label: 'Sobre a ViralizaHost', href: '/servicos' },
      { label: 'Parceiros',            href: '/parcerias' },
      { label: 'Carreiras',            href: '/suporte/contactar' },
      { label: 'Contacto',             href: '/suporte/contactar' },
    ],
  },
]

const socials = [
  { Icon: MessageCircle, href: '#', label: 'Instagram',   color: '#E1306C' },
  { Icon: Users,         href: '#', label: 'Facebook',    color: '#1877F2' },
  { Icon: Globe2,        href: '#', label: 'Twitter / X', color: '#1DA1F2' },
  { Icon: Play,          href: '#', label: 'YouTube',     color: '#FF0000' },
  { Icon: Briefcase,     href: '#', label: 'LinkedIn',    color: '#0A66C2' },
]

/* ── Payment badges ── */
const payments = [
  {
    id: 'visa',
    label: 'Visa',
    bg: '#1A1F71',
    textColor: '#fff',
    icon: (
      <svg viewBox="0 0 38 24" width="36" height="22" aria-hidden="true">
        <rect width="38" height="24" rx="4" fill="#1A1F71"/>
        <text x="19" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="12" fill="#fff" letterSpacing="1">VISA</text>
      </svg>
    ),
  },
  {
    id: 'mastercard',
    label: 'Mastercard',
    bg: '#fff',
    textColor: '#333',
    icon: (
      <svg viewBox="0 0 38 24" width="36" height="22" aria-hidden="true">
        <rect width="38" height="24" rx="4" fill="#fff" stroke="#E0E0E0"/>
        <circle cx="15" cy="12" r="7" fill="#EB001B" opacity="0.9"/>
        <circle cx="23" cy="12" r="7" fill="#F79E1B" opacity="0.9"/>
        <ellipse cx="19" cy="12" rx="3.5" ry="7" fill="#FF5F00" opacity="0.85"/>
      </svg>
    ),
  },
  {
    id: 'paypal',
    label: 'PayPal',
    bg: '#003087',
    textColor: '#fff',
    icon: (
      <svg viewBox="0 0 38 24" width="36" height="22" aria-hidden="true">
        <rect width="38" height="24" rx="4" fill="#003087"/>
        <text x="19" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="#009CDE" letterSpacing="0.5">Pay</text>
        <text x="23" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="#fff" letterSpacing="0.5">Pal</text>
      </svg>
    ),
  },
  {
    id: 'pix',
    label: 'Pix',
    bg: '#32BCAD',
    textColor: '#fff',
    icon: (
      <svg viewBox="0 0 38 24" width="36" height="22" aria-hidden="true">
        <rect width="38" height="24" rx="4" fill="#32BCAD"/>
        {/* Pix diamond shape */}
        <g transform="translate(19,12)">
          <polygon points="0,-7 5,-2 0,3 -5,-2" fill="#fff" opacity="0.95"/>
          <polygon points="0,-3 3,0 0,3 -3,0" fill="#32BCAD"/>
        </g>
        <text x="29" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="8" fill="#fff">PIX</text>
      </svg>
    ),
  },
  {
    id: 'multicaixa',
    label: 'Multicaixa',
    bg: '#E8041C',
    textColor: '#fff',
    icon: (
      <svg viewBox="0 0 38 24" width="36" height="22" aria-hidden="true">
        <rect width="38" height="24" rx="4" fill="#E8041C"/>
        <CreditCard size={12} color="#fff" x="4" y="6"/>
        <text x="24" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="7" fill="#fff" letterSpacing="0.3">MCAIXA</text>
      </svg>
    ),
  },
  {
    id: 'transferencia',
    label: 'Transferência',
    bg: '#0F4C81',
    textColor: '#fff',
    icon: (
      <svg viewBox="0 0 38 24" width="36" height="22" aria-hidden="true">
        <rect width="38" height="24" rx="4" fill="#0F4C81"/>
        <text x="19" y="11" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="7" fill="#fff">BANCO</text>
        <text x="19" y="19" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="7" fill="#93C5FD">TRANSFER</text>
      </svg>
    ),
  },
]

/* ── Inline SVG icons for payment (React-compatible) ── */
function VisaBadge() {
  return (
    <div className="group flex flex-col items-center gap-1.5 cursor-default">
      <div className="flex items-center justify-center w-[58px] h-[36px] rounded-lg border border-[#E0E0E0] bg-[#1A1F71] shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-[#F5B700]/40">
        <span className="text-white font-black text-sm tracking-widest">VISA</span>
      </div>
      <span className="text-[10px] text-[#999]">Visa</span>
    </div>
  )
}

function MastercardBadge() {
  return (
    <div className="group flex flex-col items-center gap-1.5 cursor-default">
      <div className="flex items-center justify-center w-[58px] h-[36px] rounded-lg border border-[#E0E0E0] bg-white shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-[#F5B700]/40">
        <svg width="36" height="22" viewBox="0 0 36 22" fill="none" aria-label="Mastercard">
          <circle cx="13" cy="11" r="9" fill="#EB001B"/>
          <circle cx="23" cy="11" r="9" fill="#F79E1B"/>
          <path d="M18 4.6a9 9 0 0 1 0 12.8A9 9 0 0 1 18 4.6z" fill="#FF5F00"/>
        </svg>
      </div>
      <span className="text-[10px] text-[#999]">Mastercard</span>
    </div>
  )
}

function PayPalBadge() {
  return (
    <div className="group flex flex-col items-center gap-1.5 cursor-default">
      <div className="flex items-center justify-center w-[58px] h-[36px] rounded-lg border border-[#E0E0E0] bg-[#003087] shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-[#F5B700]/40 px-1.5">
        <span className="font-black text-[11px]">
          <span style={{ color: '#009CDE' }}>Pay</span><span className="text-white">Pal</span>
        </span>
      </div>
      <span className="text-[10px] text-[#999]">PayPal</span>
    </div>
  )
}

function PixBadge() {
  return (
    <div className="group flex flex-col items-center gap-1.5 cursor-default">
      <div className="flex items-center justify-center gap-1.5 w-[58px] h-[36px] rounded-lg border border-[#E0E0E0] bg-[#32BCAD] shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-[#F5B700]/40">
        {/* Pix logo diamond */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 0L10.5 3.5L7 7L3.5 3.5Z" fill="white"/>
          <path d="M7 7L10.5 10.5L7 14L3.5 10.5Z" fill="white"/>
          <path d="M0 7L3.5 3.5L7 7L3.5 10.5Z" fill="white" opacity="0.85"/>
          <path d="M7 7L10.5 3.5L14 7L10.5 10.5Z" fill="white" opacity="0.85"/>
        </svg>
        <span className="text-white font-black text-xs">PIX</span>
      </div>
      <span className="text-[10px] text-[#999]">Pix</span>
    </div>
  )
}

function MulticaixaBadge() {
  return (
    <div className="group flex flex-col items-center gap-1.5 cursor-default">
      <div className="flex items-center justify-center w-[58px] h-[36px] rounded-lg border border-[#E0E0E0] bg-white shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-[#F5B700]/40 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/multicaixa.jpg"
          alt="Multicaixa"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      <span className="text-[10px] text-[#999]">Multicaixa</span>
    </div>
  )
}

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
              Hospedagem web premium com LiteSpeed, NVMe SSD e suporte 24/7. Servindo Angola, Brasil e o mundo.
            </p>
            <div className="space-y-2 text-sm">
              {[
                { Icon: Mail,    text: 'suporte@viralizahost.com' },
                { Icon: Phone,   text: '+244 923 000 000' },
                { Icon: MapPin,  text: 'Luanda, Angola · São Paulo, Brasil' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-[#555] hover:text-[#0A0A0A] transition-colors">
                  <Icon size={13} className="text-[#F5B700] shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 pt-1">
              {socials.map(({ Icon, href, label, color }) => (
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
            <p className="text-xs text-[#999] font-semibold uppercase tracking-wider">Métodos de Pagamento Aceites</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <VisaBadge />
            <MastercardBadge />
            <PayPalBadge />
            <PixBadge />
            <MulticaixaBadge />
            <TransferBadge />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#999]">
          <p>© {new Date().getFullYear()} ViralizaHost. Todos os direitos reservados.</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['Termos de Serviço', 'Política de Privacidade', 'Política de Cookies', 'LGPD'].map(l => (
              <Link key={l} href="#" className="hover:text-[#0A0A0A] transition-colors">{l}</Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span>🇦🇴 Angola</span>
            <span>🇧🇷 Brasil</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" />
              <span className="text-green-600">Sistemas operacionais</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
