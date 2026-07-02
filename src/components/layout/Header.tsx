'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import {
  Menu, X, ChevronDown, ChevronRight, Server, Globe, Users, Bot, Code, Cpu,
  Workflow, Shield, MessageCircle, HardDrive, Monitor, Zap, Mail, Lock,
  RefreshCw, Gauge, BookOpen, Rss, Wrench, Handshake, Activity, ExternalLink,
  Search, RotateCcw, Database, Layers, Smartphone, Calendar, MoveRight,
  ShieldCheck, AlertTriangle, Archive, Wifi
} from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { CurrencySelector } from '@/components/shared/CurrencySelector'

type ColItemDef = { icon: React.ComponentType<{size?:number;style?:React.CSSProperties;className?:string}>; label:string; desc:string; href:string; badge?:string }
type ColDef = { title: string; items: ColItemDef[] }

/* ── HOSPEDAGEM MEGA ── */
const megaColumns = [
  {
    title: 'Hospedar Sites',
    items: [
      { icon: Server,  label: 'Hospedagem de Sites',    desc: 'cPanel, LiteSpeed, NVMe SSD e SSL grátis',     href: '/hospedagem-de-sites' },
      { icon: Globe,   label: 'Hospedagem WordPress',   desc: 'WordPress otimizado com IA e CDN',             href: '/hospedagem-wordpress', badge: 'Recomendado' },
      { icon: Users,   label: 'Revenda de Hospedagem',  desc: 'WHM/cPanel para revenda profissional',         href: '/revenda-de-hospedagem' },
    ],
  },
  {
    title: 'Criar Sites',
    items: [
      { icon: Zap,  label: 'Criador de Sites com IA', desc: 'Crie um site profissional em minutos',            href: '/criador-de-sites',    badge: 'Com IA' },
      { icon: Code, label: 'Construtor WordPress',     desc: 'WordPress com builder visual e plugins premium', href: '/construtor-wordpress' },
    ],
  },
  {
    title: 'Servidores',
    items: [
      { icon: Cpu,           label: 'Servidor VPS',              desc: 'Alta performance e escalabilidade total',         href: '/servidor-vps' },
      { icon: Workflow,      label: 'VPS n8n Auto-hospedado',    desc: 'Automações e workflows sem código',               href: '/servidor-vps/n8n',              badge: 'Novo' },
      { icon: Shield,        label: 'Servidor VPS OpenClaw',     desc: 'Agentes de IA com autonomia total',              href: '/servidor-vps/openclaw' },
      { icon: MessageCircle, label: 'VPS Evolution API',         desc: 'WhatsApp Business e chatbots',                   href: '/servidor-vps/evolution-api',    badge: 'Novo' },
      { icon: Bot,           label: 'Viraliza AI Cloud',         desc: 'Agentes IA prontos para o negócio',              href: '/servidor-vps/viraliza-ai-cloud',badge: 'Com IA' },
      { icon: HardDrive,     label: 'Servidor Dedicado Linux',   desc: 'Infraestrutura exclusiva de alta performance',   href: '/servidor-dedicado' },
      { icon: Monitor,       label: 'Servidor Dedicado Windows', desc: 'Windows Server com Plesk e acesso remoto',       href: '/servidor-dedicado-windows' },
    ],
  },
]

/* ── SERVIÇOS MEGA ── */
const servicosColumns: ColDef[] = [
  {
    title: 'Produtos',
    items: [
      { icon: Server,    label: 'Hospedagem de Sites',   desc: 'Planos rápidos e seguros',           href: '/hospedagem-de-sites' },
      { icon: Globe,     label: 'Hospedagem WordPress',  desc: 'Optimizado para WordPress',          href: '/hospedagem-wordpress' },
      { icon: Users,     label: 'Revenda de Hospedagem', desc: 'WHM/cPanel para revendedores',       href: '/revenda-de-hospedagem' },
      { icon: Cpu,       label: 'VPS Linux',             desc: 'Servidores VPS de alto desempenho',  href: '/servidor-vps' },
      { icon: HardDrive, label: 'Servidores Dedicados',  desc: 'Máximo poder e performance',         href: '/servidor-dedicado' },
      { icon: Mail,      label: 'E-mail Corporativo',    desc: 'Soluções profissionais de e-mail',   href: '/email-corporativo' },
      { icon: Globe,     label: 'Domínios',              desc: 'Registe o seu domínio ideal',        href: '/dominios' },
    ],
  },
  {
    title: 'Soluções',
    items: [
      { icon: Code,      label: 'Criador de Sites',  desc: 'Crie o seu site facilmente',   href: '/criador-de-sites' },
      { icon: Lock,      label: 'Certificado SSL',   desc: 'Segurança para o seu site',    href: '/certificado-ssl' },
      { icon: RefreshCw, label: 'Backup Cloud',      desc: 'Protecção e backup automático',href: '/backup-cloud' },
      { icon: Shield,    label: 'Protecção de Site', desc: 'Anti-malware e Firewall',      href: '/protecao-de-site' },
      { icon: Zap,       label: 'Migração Grátis',   desc: 'Migração sem custo',           href: '/migracao-gratis' },
      { icon: Gauge,     label: 'CDN Premium',       desc: 'Velocidade global',            href: '/cdn-premium' },
    ],
  },
  {
    title: 'Recursos',
    items: [
      { icon: BookOpen,  label: 'Base de Conhecimento', desc: 'Tutoriais e guias',          href: '/base-conhecimento' },
      { icon: Rss,       label: 'Blog',                 desc: 'Conteúdo e novidades',       href: '/blog' },
      { icon: Wrench,    label: 'Ferramentas',           desc: 'Utilitários e suporte',      href: '/ferramentas' },
      { icon: Handshake, label: 'Parcerias',             desc: 'Seja nosso parceiro',        href: '/parcerias' },
      { icon: Activity,  label: 'Status do Sistema',    desc: 'Verificar disponibilidade',  href: '/suporte/status' },
    ],
  },
]

/* ── DOMÍNIOS MEGA ── */
const dominiosColumns: ColDef[] = [
  {
    title: 'Registo de Domínios',
    items: [
      { icon: Search,    label: 'Pesquisar Domínio',        desc: 'Verifique a disponibilidade do seu domínio', href: '/dominios/pesquisar' },
      { icon: Globe,     label: 'Registar Domínio .ao',     desc: 'Domínio oficial de Angola',                  href: '/dominios/registrar-ao' },
      { icon: Globe,     label: 'Registar Domínio .com',    desc: 'O domínio mais popular do mundo',            href: '/dominios/registrar-com' },
      { icon: Globe,     label: 'Registar Domínio .com.br', desc: 'Domínio oficial do Brasil',                  href: '/dominios/registrar-com-br' },
      { icon: MoveRight, label: 'Transferir Domínio',       desc: 'Transfira o seu domínio com segurança',      href: '/dominios/transferir' },
      { icon: RotateCcw, label: 'Renovar Domínio',          desc: 'Renove antes do prazo e poupe',              href: '/dominios/renovar' },
    ],
  },
  {
    title: 'Segurança e Gestão',
    items: [
      { icon: Gauge,    label: 'DNS Premium',              desc: 'Propagação ultrarrápida e fiável',      href: '/dominios/dns-premium' },
      { icon: Lock,     label: 'Proteção WHOIS',           desc: 'Oculte os seus dados de contacto',     href: '/dominios/whois' },
      { icon: ShieldCheck, label: 'Certificado SSL',       desc: 'HTTPS gratuito para o seu domínio',    href: '/dominios/ssl' },
      { icon: MoveRight, label: 'Redirecionamento',        desc: 'Redirecione domínios com facilidade',  href: '/dominios/redirecionamento' },
      { icon: Layers,   label: 'Subdomínios',              desc: 'Crie subdomínios ilimitados',          href: '/dominios/subdominios' },
      { icon: Database, label: 'Gestão de Nameservers',    desc: 'Controle total dos seus nameservers',  href: '/dominios/nameservers' },
    ],
  },
  {
    title: 'Recursos',
    items: [
      { icon: BookOpen,  label: 'Preços de Domínios',      desc: 'Tabela completa de preços',            href: '/dominios/precos' },
      { icon: Search,    label: 'Consulta WHOIS',          desc: 'Quem é o dono do domínio?',            href: '/dominios/whois' },
      { icon: Wrench,    label: 'Base de Conhecimento',    desc: 'Guias e tutoriais de domínios',        href: '/dominios/base-conhecimento' },
      { icon: Handshake, label: 'Suporte para Domínios',   desc: 'Equipa técnica especializada',         href: '/suporte/tickets' },
      { icon: Rss,       label: 'Perguntas Frequentes',    desc: 'Respostas às dúvidas mais comuns',     href: '/suporte/faq' },
    ],
  },
]

/* ── E-MAIL MEGA ── */
const emailColumns: ColDef[] = [
  {
    title: 'Planos de E-mail',
    items: [
      { icon: Mail,    label: 'E-mail Starter',         desc: '5 contas, webmail premium e SSL',             href: '/email/starter' },
      { icon: Zap,     label: 'E-mail Business',        desc: '15 contas, backup diário e DMARC',            href: '/email/business', badge: 'Popular' },
      { icon: Server,  label: 'E-mail Enterprise',      desc: '50 contas, IP dedicada e SLA garantido',      href: '/email/enterprise' },
      { icon: Monitor, label: 'Microsoft 365 Outlook',  desc: 'Outlook, Teams e OneDrive 1 TB incluídos',    href: '/email/microsoft-365-outlook', badge: 'Microsoft' },
    ],
  },
  {
    title: 'Segurança',
    items: [
      { icon: AlertTriangle, label: 'AntiSpam Premium',          desc: 'Bloqueio avançado de spam',                  href: '/email/antispam' },
      { icon: ShieldCheck,   label: 'SPF / DKIM / DMARC',       desc: 'Autenticação de e-mail profissional',        href: '/email/spf-dkim-dmarc' },
      { icon: Archive,       label: 'Backup de E-mails',         desc: 'Cópias de segurança diárias automáticas',    href: '/email/backup' },
      { icon: Shield,        label: 'Proteção contra Malware',   desc: 'Análise e quarentena de ameaças',            href: '/email/malware' },
      { icon: Activity,      label: 'Alta Disponibilidade',      desc: 'Infraestrutura redundante 99.9% uptime',     href: '/email/alta-disponibilidade' },
    ],
  },
  {
    title: 'Produtividade',
    items: [
      { icon: Globe,      label: 'Webmail Profissional',    desc: 'Acesso ao e-mail em qualquer browser',   href: '/email/webmail' },
      { icon: Monitor,    label: 'Outlook 365',             desc: 'Cliente desktop premium da Microsoft',   href: '/email/outlook-365' },
      { icon: Smartphone, label: 'Sincronização Mobile',    desc: 'IMAP/ActiveSync para iOS e Android',     href: '/email/mobile' },
      { icon: Calendar,   label: 'Calendário e Contactos',  desc: 'Agenda partilhada e sincronizada',       href: '/email/calendario-contactos' },
      { icon: MoveRight,  label: 'Migração de E-mails',     desc: 'Migre os seus e-mails sem perder dados', href: '/email/migracao' },
    ],
  },
]

type MegaType = 'hosting' | 'services' | 'domains' | 'email' | null

const navLinks = [
  { label: 'Hospedagem e Sites', href: '/hospedagem-de-sites', mega: 'hosting'   as MegaType },
  { label: 'Domínios',           href: '/dominios',            mega: 'domains'   as MegaType },
  { label: 'Serviços',           href: '/servicos',            mega: 'services'  as MegaType },
  { label: 'E-mail Corporativo', href: '/email-corporativo',   mega: 'email'     as MegaType },
  { label: 'Suporte',            href: '/suporte',             mega: null },
]

const BADGE_STYLE: Record<string, string> = {
  'Recomendado': 'bg-[#F5B700] text-black',
  'Com IA':      'bg-blue-600 text-white',
  'Novo':        'bg-green-600 text-white',
  'Popular':     'bg-[#F5B700] text-black',
  'Microsoft':   'bg-blue-700 text-white',
}

/* Shared: dark mega column item */
function DarkColItem({ icon: Icon, label, desc, href, badge, onClick }: {
  icon: React.ComponentType<{size?:number;style?:React.CSSProperties}>
  label: string; desc: string; href: string; badge?: string
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
      style={{ background: 'transparent' }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'rgba(245,183,0,0.07)'
        el.style.boxShadow  = 'inset 0 0 0 1px rgba(245,183,0,0.18)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = 'transparent'
        el.style.boxShadow  = 'none'
      }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all duration-150"
        style={{ background: 'rgba(245,183,0,0.10)' }}>
        <Icon size={14} style={{ color: '#F5B700' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-[13px] font-semibold leading-tight group-hover:text-[#F5B700] transition-colors duration-150">
            {label}
          </span>
          {badge && (
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>
              {badge}
            </span>
          )}
        </div>
        <div className="text-[11px] leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {desc}
        </div>
      </div>
    </Link>
  )
}

/* Shared: dark mega menu shell */
function DarkMegaShell({ open, onEnter, onLeave, children }: {
  open: boolean; onEnter: () => void; onLeave: () => void; children: React.ReactNode
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`absolute top-full left-0 right-0 hidden lg:block transition-all duration-200 origin-top ${
        open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}
      style={{
        transitionProperty: 'opacity, transform',
        background: '#0B0B0B',
        borderBottom: '1px solid rgba(245,183,0,0.30)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(245,183,0,0.12), inset 0 0 80px rgba(245,183,0,0.03)',
      }}
    >
      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #F5B700, transparent)', opacity: 0.6 }} />
      {children}
      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #F5B700, transparent)', opacity: 0.3 }} />
    </div>
  )
}

/* Shared: dark mega bottom bar */
function DarkMegaFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex gap-5 text-[11px]">
        <span className="flex items-center gap-1.5 text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Uptime 99.9%</span>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>Suporte 24/7</span>
        <span style={{ color: 'rgba(255,255,255,0.35)' }}>Garantia 30 dias</span>
      </div>
      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
        Dúvidas?{' '}
        <Link href="/suporte/tickets" onClick={onClose} style={{ color: '#F5B700' }} className="font-semibold hover:underline">
          Fale com um especialista
        </Link>
      </p>
    </div>
  )
}

export function Header() {
  const [mobileOpen,          setMobileOpen]          = useState(false)
  const [mobileHostingOpen,   setMobileHostingOpen]   = useState(false)
  const [mobileServicesOpen,  setMobileServicesOpen]  = useState(false)
  const [mobileDomainsOpen,   setMobileDomainsOpen]   = useState(false)
  const [mobileEmailOpen,     setMobileEmailOpen]     = useState(false)
  const [scrolled,            setScrolled]            = useState(false)
  const [megaOpen,            setMegaOpen]            = useState<MegaType>(null)
  const megaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const openMega  = (type: MegaType) => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current)
    setMegaOpen(type)
  }
  const closeMega = () => { megaTimeout.current = setTimeout(() => setMegaOpen(null), 160) }
  const killMega  = () => setMegaOpen(null)

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white shadow-[0_1px_24px_rgba(0,0,0,0.09)] border-b border-[#F0F0F0]'
        : 'bg-white border-b border-[#F0F0F0]'
    }`}>
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-[68px]">

          <div className="hidden sm:block"><Logo variant="dark" size="md" /></div>
          <div className="block sm:hidden"><Logo variant="dark" size="sm" /></div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center max-w-2xl mx-auto">
            {navLinks.map((link) =>
              link.mega ? (
                <div key={link.label} className="relative"
                  onMouseEnter={() => openMega(link.mega)}
                  onMouseLeave={closeMega}
                >
                  <button className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-all whitespace-nowrap ${
                    megaOpen === link.mega ? 'text-[#0A0A0A] bg-[#F5F5F5]' : 'text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]'
                  }`}>
                    {link.label}
                    <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${megaOpen === link.mega ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              ) : (
                <Link key={link.label} href={link.href}
                  className="flex items-center gap-1 text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-all whitespace-nowrap">
                  {link.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <CurrencySelector />
            <Link href="/login" className="text-[#3D3D3D] hover:text-[#0A0A0A] px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-[#F5F5F5]">
              Entrar
            </Link>
            <Link href="/register"
              className="btn-shimmer btn-primary px-5 py-2.5 text-sm rounded-xl shadow-[0_4px_12px_rgba(245,183,0,0.28)] hover:shadow-[0_6px_20px_rgba(245,183,0,0.38)]">
              Começar Grátis →
            </Link>
          </div>

          <button className="lg:hidden p-2 rounded-xl text-[#444] hover:bg-[#F5F5F5] transition-all"
            onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── MEGA MENU — HOSPEDAGEM (preto premium) ── */}
      <div
        onMouseEnter={() => openMega('hosting')}
        onMouseLeave={closeMega}
        className={`absolute top-full left-0 right-0 hidden lg:block transition-all duration-220 origin-top ${
          megaOpen === 'hosting' ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{
          transitionProperty: 'opacity, transform',
          background: '#090909',
          borderBottom: '1px solid rgba(245,183,0,0.28)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,183,0,0.10), inset 0 0 120px rgba(245,183,0,0.025)',
        }}
      >
        {/* top glow line */}
        <div style={{ height: 1, background: 'linear-gradient(to right, transparent 0%, #F5B700 40%, #F5B700 60%, transparent 100%)', opacity: 0.55 }} />

        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="grid gap-8" style={{ gridTemplateColumns: '1fr 1fr 1.4fr 260px' }}>

            {/* ── COL 1: HOSPEDAGEM ── */}
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.20em] mb-5 flex items-center gap-2.5" style={{ color: '#F5B700' }}>
                <div className="w-3 h-px" style={{ background: '#F5B700' }} />
                Hospedagem
              </div>
              <div className="space-y-1">
                {([
                  { icon: Server, label: 'Hospedagem de Sites',   desc: 'cPanel, LiteSpeed, NVMe SSD e SSL grátis',    href: '/hospedagem-de-sites' },
                  { icon: Globe,  label: 'Hospedagem WordPress',  desc: 'WordPress otimizado com IA e CDN',            href: '/hospedagem-wordpress', badge: 'Recomendado' },
                  { icon: Users,  label: 'Revenda de Hospedagem', desc: 'WHM/cPanel para revenda profissional',        href: '/revenda-de-hospedagem' },
                ] as ColItemDef[]).map(({ icon: Icon, label, desc, href, badge }) => (
                  <Link key={label} href={href} onClick={killMega}
                    className="group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(245,183,0,0.07)'; el.style.boxShadow = 'inset 0 0 0 1px rgba(245,183,0,0.18)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.boxShadow = 'none' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-all duration-150"
                      style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.15)' }}>
                      <Icon size={16} style={{ color: '#F5B700' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-[13px] font-semibold leading-tight group-hover:text-[#F5B700] transition-colors duration-150">{label}</span>
                        {badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>{badge}</span>}
                      </div>
                      <span className="text-[11px] leading-snug mt-0.5 block" style={{ color: 'rgba(255,255,255,0.38)' }}>{desc}</span>
                    </div>
                    <ChevronRight size={11} className="shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-150" style={{ color: '#F5B700' }} />
                  </Link>
                ))}
              </div>
            </div>

            {/* ── COL 2: CRIAÇÃO DE SITES ── */}
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '2rem' }}>
              <div className="text-[10px] font-black uppercase tracking-[0.20em] mb-5 flex items-center gap-2.5" style={{ color: '#F5B700' }}>
                <div className="w-3 h-px" style={{ background: '#F5B700' }} />
                Criação de Sites
              </div>
              <div className="space-y-1">
                {([
                  { icon: Zap,  label: 'Criador de Sites com IA', desc: 'Crie um site profissional em minutos',           href: '/criador-de-sites',    badge: 'Com IA' },
                  { icon: Code, label: 'Construtor WordPress',     desc: 'WordPress com builder visual e plugins premium', href: '/construtor-wordpress' },
                ] as ColItemDef[]).map(({ icon: Icon, label, desc, href, badge }) => (
                  <Link key={label} href={href} onClick={killMega}
                    className="group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(245,183,0,0.07)'; el.style.boxShadow = 'inset 0 0 0 1px rgba(245,183,0,0.18)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.boxShadow = 'none' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-all duration-150"
                      style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.15)' }}>
                      <Icon size={16} style={{ color: '#F5B700' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-[13px] font-semibold leading-tight group-hover:text-[#F5B700] transition-colors duration-150">{label}</span>
                        {badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>{badge}</span>}
                      </div>
                      <span className="text-[11px] leading-snug mt-0.5 block" style={{ color: 'rgba(255,255,255,0.38)' }}>{desc}</span>
                    </div>
                    <ChevronRight size={11} className="shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-150" style={{ color: '#F5B700' }} />
                  </Link>
                ))}
              </div>
            </div>

            {/* ── COL 3: INFRAESTRUTURA ── */}
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '2rem' }}>
              <div className="text-[10px] font-black uppercase tracking-[0.20em] mb-5 flex items-center gap-2.5" style={{ color: '#F5B700' }}>
                <div className="w-3 h-px" style={{ background: '#F5B700' }} />
                Infraestrutura
              </div>
              <div className="space-y-1">
                {([
                  { icon: Cpu,           label: 'Servidor VPS',              desc: 'Alta performance e escalabilidade total',          href: '/servidor-vps' },
                  { icon: Workflow,      label: 'VPS n8n Auto-hospedado',    desc: 'Automações e workflows sem código',                href: '/servidor-vps/n8n',              badge: 'Novo' },
                  { icon: Shield,        label: 'Servidor VPS OpenClaw',     desc: 'Agentes de IA com autonomia total',               href: '/servidor-vps/openclaw' },
                  { icon: MessageCircle, label: 'VPS Evolution API',         desc: 'WhatsApp Business e chatbots',                    href: '/servidor-vps/evolution-api',    badge: 'Novo' },
                  { icon: Bot,           label: 'Viraliza AI Cloud',         desc: 'Agentes IA prontos para o negócio',               href: '/servidor-vps/viraliza-ai-cloud',badge: 'Com IA' },
                  { icon: HardDrive,     label: 'Servidor Dedicado Linux',   desc: 'Infraestrutura exclusiva de alta performance',    href: '/servidor-dedicado' },
                  { icon: Monitor,       label: 'Servidor Dedicado Windows', desc: 'Windows Server com Plesk e acesso remoto',        href: '/servidor-dedicado-windows' },
                ] as ColItemDef[]).map(({ icon: Icon, label, desc, href, badge }) => (
                  <Link key={label} href={href} onClick={killMega}
                    className="group flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 cursor-pointer"
                    style={{ background: 'transparent' }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(245,183,0,0.07)'; el.style.boxShadow = 'inset 0 0 0 1px rgba(245,183,0,0.18)' }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.boxShadow = 'none' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-all duration-150"
                      style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.14)' }}>
                      <Icon size={14} style={{ color: '#F5B700' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-[13px] font-semibold leading-tight group-hover:text-[#F5B700] transition-colors duration-150">{label}</span>
                        {badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>{badge}</span>}
                      </div>
                      <span className="text-[11px] leading-snug mt-0.5 block" style={{ color: 'rgba(255,255,255,0.38)' }}>{desc}</span>
                    </div>
                    <ChevronRight size={11} className="shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-150" style={{ color: '#F5B700' }} />
                  </Link>
                ))}
              </div>
            </div>

            {/* ── COL 4: CARD LATERAL PREMIUM ── */}
            <div className="flex flex-col gap-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '1.5rem' }}>

              {/* Card principal com imagem */}
              <div className="flex-1 rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: 'linear-gradient(160deg, #111111 0%, #0d0d0d 100%)',
                  border: '1px solid rgba(245,183,0,0.32)',
                  boxShadow: '0 0 32px rgba(245,183,0,0.08), inset 0 1px 0 rgba(245,183,0,0.14)',
                }}>
                {/* Imagem */}
                <div className="relative w-full flex items-center justify-center"
                  style={{ height: 148, background: '#080808', borderBottom: '1px solid rgba(245,183,0,0.14)' }}>
                  <Image
                    src="/infrastructure-world-class.png"
                    alt="Infraestrutura Premium"
                    width={230} height={132}
                    style={{ objectFit: 'contain', maxHeight: 132, width: '100%' }}
                    priority={false}
                  />
                  {/* gradient overlay bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-8"
                    style={{ background: 'linear-gradient(to top, #0d0d0d, transparent)' }} />
                </div>

                {/* Conteúdo */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] mb-1.5" style={{ color: 'rgba(245,183,0,0.65)' }}>
                    Infraestrutura Premium
                  </div>
                  <h4 className="text-white font-black text-[13px] leading-tight mb-2">
                    Infraestrutura de{' '}
                    <span style={{ color: '#F5B700' }}>Classe Mundial</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.42)' }}>
                    Servidores de última geração com desempenho máximo e 99.9% de uptime garantido.
                  </p>
                  <Link href="/servidor-dedicado" onClick={killMega}
                    className="block text-center text-xs font-black py-2.5 rounded-xl transition-all duration-150 w-full"
                    style={{ background: '#F5B700', color: '#090909' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFD54F' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F5B700' }}
                  >
                    Ver Infraestrutura →
                  </Link>
                </div>
              </div>

              {/* Card suporte */}
              <div className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <span className="text-white text-xs font-bold">Precisa de ajuda?</span>
                </div>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Nossa equipa está online 24/7 para si.
                </p>
                <Link href="/suporte/tickets" onClick={killMega}
                  className="block text-center text-[11px] font-bold py-2 rounded-xl transition-all duration-150 w-full"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.12)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,183,0,0.15)'; (e.currentTarget as HTMLElement).style.color = '#F5B700'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,183,0,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.78)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
                >
                  Falar com Suporte →
                </Link>
              </div>
            </div>
          </div>

          {/* ── BARRA INFERIOR ── */}
          <div className="mt-7 pt-5 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5 text-[11px] text-green-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                Uptime 99.9%
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
                <Shield size={11} style={{ color: '#F5B700' }} /> Proteção avançada
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
                <Zap size={11} style={{ color: '#F5B700' }} /> LiteSpeed Enterprise
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.38)' }}>
                <Archive size={11} style={{ color: '#F5B700' }} /> Backup diário
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Dúvidas?{' '}
              <Link href="/suporte/tickets" onClick={killMega}
                className="font-semibold hover:underline transition-colors"
                style={{ color: '#F5B700' }}>
                Fale com um especialista →
              </Link>
            </p>
          </div>
        </div>

        {/* bottom glow line */}
        <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #F5B700, transparent)', opacity: 0.28 }} />
      </div>

      {/* ── MEGA MENU — DOMÍNIOS (preto + dourado) ── */}
      <DarkMegaShell open={megaOpen === 'domains'} onEnter={() => openMega('domains')} onLeave={closeMega}>
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="grid grid-cols-4 gap-8">

            {dominiosColumns.map((col, i) => (
              <div key={col.title} className={i < 2 ? 'border-r border-white/[0.06] pr-8' : ''}>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-5 flex items-center gap-2" style={{ color: '#F5B700' }}>
                  <div className="w-4 h-px" style={{ background: '#F5B700' }} />
                  {col.title}
                </div>
                <div className="space-y-1">
                  {col.items.map(({ icon, label, desc, href, badge }) => (
                    <DarkColItem key={label} icon={icon} label={label} desc={desc} href={href} badge={badge} onClick={killMega} />
                  ))}
                </div>
              </div>
            ))}

            {/* Card lateral — Domínios */}
            <div className="flex flex-col gap-4 pl-2">
              <div
                className="flex-1 rounded-2xl p-5 flex flex-col justify-between"
                style={{
                  background: 'linear-gradient(145deg, rgba(245,183,0,0.10) 0%, rgba(245,183,0,0.03) 100%)',
                  border: '1px solid rgba(245,183,0,0.32)',
                  boxShadow: '0 0 28px rgba(245,183,0,0.08), inset 0 1px 0 rgba(245,183,0,0.12)',
                }}
              >
                <div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(245,183,0,0.15)', border: '1px solid rgba(245,183,0,0.25)' }}>
                    <Globe size={20} style={{ color: '#F5B700' }} />
                  </div>
                  <h4 className="text-white font-black text-sm leading-snug mb-2">
                    Domínio ideal para sua marca
                  </h4>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Pesquise, registe e proteja o nome do seu negócio com segurança.
                  </p>
                  <div className="mt-4 space-y-2">
                    {['.com', '.ao', '.com.br', '.net'].map(ext => (
                      <div key={ext} className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="text-white font-bold">{ext}</span>
                        <span style={{ color: '#F5B700' }} className="font-semibold">Disponível</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Link href="/dominios/pesquisar" onClick={killMega}
                  className="mt-5 inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-150 w-full justify-center"
                  style={{ background: '#F5B700', color: '#0B0B0B' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFD54F' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F5B700' }}
                >
                  Pesquisar Domínio →
                </Link>
              </div>

              {/* Mini card suporte */}
              <div className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <span className="text-white text-xs font-bold">Precisa de ajuda?</span>
                </div>
                <p className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Equipa disponível 24/7 para si.
                </p>
                <Link href="/suporte/tickets" onClick={killMega}
                  className="block text-center text-xs font-bold py-2 rounded-xl transition-all duration-150 w-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.12)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,183,0,0.15)'; (e.currentTarget as HTMLElement).style.color = '#F5B700' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)' }}
                >
                  Falar com Suporte →
                </Link>
              </div>
            </div>
          </div>
          <DarkMegaFooter onClose={killMega} />
        </div>
      </DarkMegaShell>

      {/* ── MEGA MENU — SERVIÇOS (preto + dourado) ── */}
      <DarkMegaShell open={megaOpen === 'services'} onEnter={() => openMega('services')} onLeave={closeMega}>
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="grid grid-cols-4 gap-8">

            {servicosColumns.map((col, colIdx) => (
              <div key={col.title} className={colIdx < 2 ? 'border-r border-white/[0.06] pr-8' : ''}>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-5 flex items-center gap-2" style={{ color: '#F5B700' }}>
                  <div className="w-4 h-px" style={{ background: '#F5B700' }} />
                  {col.title}
                </div>
                <div className="space-y-1">
                  {col.items.map(({ icon, label, desc, href, badge }) => (
                    <DarkColItem key={label} icon={icon} label={label} desc={desc} href={href} badge={badge} onClick={killMega} />
                  ))}
                </div>
              </div>
            ))}

            {/* Coluna 4 — Card Infra */}
            <div className="flex flex-col gap-4 pl-2">
              <div className="flex-1 rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: '#0B0B0B',
                  border: '1px solid rgba(245,183,0,0.35)',
                  boxShadow: '0 0 24px rgba(245,183,0,0.10), inset 0 1px 0 rgba(245,183,0,0.12)',
                }}>
                <div className="w-full flex items-center justify-center"
                  style={{ height: 170, background: '#060606', borderBottom: '1px solid rgba(245,183,0,0.15)' }}>
                  <Image
                    src="/infrastructure-world-class.png"
                    alt="Infraestrutura de Classe Mundial"
                    width={260} height={155}
                    style={{ objectFit: 'contain', maxHeight: 155, width: '100%', borderRadius: 10 }}
                    priority={false}
                  />
                </div>
                <div className="p-5 flex flex-col flex-1 justify-between">
                  <div>
                    <h4 className="text-white font-black text-sm leading-snug mb-2">Infraestrutura de Classe Mundial</h4>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Servidores de última geração com desempenho máximo e 99.9% uptime garantido.
                    </p>
                  </div>
                  <Link href="/servidor-dedicado" onClick={killMega}
                    className="mt-4 inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-150"
                    style={{ background: '#F5B700', color: '#0B0B0B' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFD54F' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F5B700' }}
                  >
                    Ver Infraestrutura → <ExternalLink size={11} />
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <span className="text-white text-xs font-bold">Precisa de ajuda?</span>
                </div>
                <p className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>A nossa equipa está online 24/7 para si.</p>
                <Link href="/suporte/tickets" onClick={killMega}
                  className="block text-center text-xs font-bold py-2 rounded-xl transition-all duration-150 w-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.12)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,183,0,0.15)'; (e.currentTarget as HTMLElement).style.color = '#F5B700' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)' }}
                >
                  Falar com Suporte →
                </Link>
              </div>
            </div>
          </div>
          <DarkMegaFooter onClose={killMega} />
        </div>
      </DarkMegaShell>

      {/* ── MEGA MENU — E-MAIL CORPORATIVO (preto + dourado) ── */}
      <DarkMegaShell open={megaOpen === 'email'} onEnter={() => openMega('email')} onLeave={closeMega}>
        <div className="container mx-auto px-4 lg:px-8 py-8">
          <div className="grid grid-cols-4 gap-8">

            {emailColumns.map((col, i) => (
              <div key={col.title} className={i < 2 ? 'border-r border-white/[0.06] pr-8' : ''}>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] mb-5 flex items-center gap-2" style={{ color: '#F5B700' }}>
                  <div className="w-4 h-px" style={{ background: '#F5B700' }} />
                  {col.title}
                </div>
                <div className="space-y-1">
                  {col.items.map(({ icon, label, desc, href, badge }) => (
                    <DarkColItem key={label} icon={icon} label={label} desc={desc} href={href} badge={badge} onClick={killMega} />
                  ))}
                </div>
              </div>
            ))}

            {/* Card lateral — E-mail */}
            <div className="flex flex-col gap-4 pl-2">
              <div
                className="flex-1 rounded-2xl p-5 flex flex-col justify-between"
                style={{
                  background: 'linear-gradient(145deg, rgba(245,183,0,0.10) 0%, rgba(245,183,0,0.03) 100%)',
                  border: '1px solid rgba(245,183,0,0.32)',
                  boxShadow: '0 0 28px rgba(245,183,0,0.08), inset 0 1px 0 rgba(245,183,0,0.12)',
                }}
              >
                <div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(245,183,0,0.15)', border: '1px solid rgba(245,183,0,0.25)' }}>
                    <Mail size={20} style={{ color: '#F5B700' }} />
                  </div>
                  <h4 className="text-white font-black text-sm leading-snug mb-2">
                    E-mail profissional para empresas
                  </h4>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Comunicação segura, moderna e com domínio personalizado.
                  </p>
                  <div className="mt-4 space-y-2">
                    {['Starter — Kz 8.500/mês','Business — Kz 18.500/mês','Enterprise — Kz 35.000/mês'].map(plan => (
                      <div key={plan} className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#F5B700] shrink-0" />
                        <span className="text-white">{plan}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Link href="/email-corporativo" onClick={killMega}
                  className="mt-5 inline-flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-150 w-full justify-center"
                  style={{ background: '#F5B700', color: '#0B0B0B' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FFD54F' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F5B700' }}
                >
                  Ver Planos de E-mail →
                </Link>
              </div>

              <div className="rounded-2xl p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
                  <span className="text-white text-xs font-bold">Activação imediata</span>
                </div>
                <p className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  Configure o seu e-mail corporativo em minutos.
                </p>
                <Link href="/email/business" onClick={killMega}
                  className="block text-center text-xs font-bold py-2 rounded-xl transition-all duration-150 w-full"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.12)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,183,0,0.15)'; (e.currentTarget as HTMLElement).style.color = '#F5B700' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)' }}
                >
                  Começar Agora →
                </Link>
              </div>
            </div>
          </div>
          <DarkMegaFooter onClose={killMega} />
        </div>
      </DarkMegaShell>

      {/* ── MOBILE MENU ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#F0F0F0] py-4 space-y-0.5 animate-fade-in bg-white max-h-[85vh] overflow-y-auto">

          {/* Hospedagem */}
          <div>
            <button className="w-full flex items-center justify-between text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              onClick={() => setMobileHostingOpen(!mobileHostingOpen)}>
              Hospedagem e Sites
              <ChevronDown size={14} className={`transition-transform ${mobileHostingOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileHostingOpen && (
              <div className="ml-3 mt-1 border-l-2 border-[#F5B700]/25 pl-3 space-y-1">
                {megaColumns.map(col => (
                  <div key={col.title}>
                    <div className="text-[9px] font-black text-[#BBB] uppercase tracking-wider px-3 py-1.5">{col.title}</div>
                    {col.items.map(({ label, href, badge }) => (
                      <Link key={label} href={href}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm text-[#555] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                        onClick={() => { setMobileOpen(false); setMobileHostingOpen(false) }}>
                        <span>{label}</span>
                        {badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>{badge}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Domínios mobile accordion */}
          <div>
            <button className="w-full flex items-center justify-between text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              onClick={() => setMobileDomainsOpen(!mobileDomainsOpen)}>
              Domínios
              <ChevronDown size={14} className={`transition-transform ${mobileDomainsOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileDomainsOpen && (
              <div className="ml-3 mt-1 border-l-2 border-[#F5B700]/25 pl-3 space-y-1">
                {dominiosColumns.map(col => (
                  <div key={col.title}>
                    <div className="text-[9px] font-black text-[#BBB] uppercase tracking-wider px-3 py-1.5">{col.title}</div>
                    {col.items.map(({ label, href, badge }) => (
                      <Link key={label} href={href}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm text-[#555] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                        onClick={() => { setMobileOpen(false); setMobileDomainsOpen(false) }}>
                        <span>{label}</span>
                        {badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>{badge}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Serviços mobile accordion */}
          <div>
            <button className="w-full flex items-center justify-between text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              onClick={() => setMobileServicesOpen(!mobileServicesOpen)}>
              Serviços
              <ChevronDown size={14} className={`transition-transform ${mobileServicesOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileServicesOpen && (
              <div className="ml-3 mt-1 border-l-2 border-[#F5B700]/25 pl-3 space-y-1">
                {servicosColumns.map(col => (
                  <div key={col.title}>
                    <div className="text-[9px] font-black text-[#BBB] uppercase tracking-wider px-3 py-1.5">{col.title}</div>
                    {col.items.map(({ label, href }) => (
                      <Link key={label} href={href}
                        className="block px-3 py-2 rounded-xl text-sm text-[#555] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                        onClick={() => { setMobileOpen(false); setMobileServicesOpen(false) }}>
                        {label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* E-mail Corporativo mobile accordion */}
          <div>
            <button className="w-full flex items-center justify-between text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              onClick={() => setMobileEmailOpen(!mobileEmailOpen)}>
              E-mail Corporativo
              <ChevronDown size={14} className={`transition-transform ${mobileEmailOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileEmailOpen && (
              <div className="ml-3 mt-1 border-l-2 border-[#F5B700]/25 pl-3 space-y-1">
                {emailColumns.map(col => (
                  <div key={col.title}>
                    <div className="text-[9px] font-black text-[#BBB] uppercase tracking-wider px-3 py-1.5">{col.title}</div>
                    {col.items.map(({ label, href, badge }) => (
                      <Link key={label} href={href}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-sm text-[#555] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                        onClick={() => { setMobileOpen(false); setMobileEmailOpen(false) }}>
                        <span>{label}</span>
                        {badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>{badge}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suporte */}
          <Link href="/suporte"
            className="block text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
            onClick={() => setMobileOpen(false)}>
            Suporte
          </Link>

          <div className="pt-4 border-t border-[#F0F0F0] space-y-3 px-1">
            <CurrencySelector />
            <div className="flex gap-3">
              <Link href="/login"
                className="flex-1 text-center text-[#0A0A0A] border border-[#E8E8E8] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F8F8F8] transition-colors">
                Entrar
              </Link>
              <Link href="/register"
                className="flex-1 text-center btn-primary py-2.5 text-sm rounded-xl flex items-center justify-center font-bold">
                Começar
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
