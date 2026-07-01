'use client'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { Menu, X, ChevronDown, ChevronRight, Server, Globe, Users, Bot, Code, Cpu, Workflow, Shield, MessageCircle, HardDrive, Monitor, Zap } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { CurrencySelector } from '@/components/shared/CurrencySelector'

const megaColumns = [
  {
    title: 'Hospedar Sites',
    items: [
      { icon: Server, label: 'Hospedagem de Sites', desc: 'cPanel, LiteSpeed, NVMe SSD e SSL grátis', href: '/hospedagem-de-sites' },
      { icon: Globe, label: 'Hospedagem WordPress', desc: 'WordPress otimizado com IA e CDN', href: '/hospedagem-wordpress', badge: 'Recomendado' },
      { icon: Users, label: 'Revenda de Hospedagem', desc: 'WHM/cPanel para revenda profissional', href: '/revenda-de-hospedagem' },
    ],
  },
  {
    title: 'Criar Sites',
    items: [
      { icon: Zap, label: 'Criador de Sites com IA', desc: 'Crie um site profissional em minutos', href: '/criador-de-sites', badge: 'Com IA' },
      { icon: Code, label: 'Construtor WordPress', desc: 'WordPress com builder visual e plugins premium', href: '/construtor-wordpress' },
    ],
  },
  {
    title: 'Servidores',
    items: [
      { icon: Cpu, label: 'Servidor VPS', desc: 'Alta performance e escalabilidade total', href: '/servidor-vps' },
      { icon: Workflow, label: 'VPS n8n Auto-hospedado', desc: 'Automações e workflows sem código', href: '/servidor-vps/n8n', badge: 'Novo' },
      { icon: Shield, label: 'Servidor VPS OpenClaw', desc: 'Agentes de IA com autonomia total', href: '/servidor-vps/openclaw' },
      { icon: MessageCircle, label: 'VPS Evolution API', desc: 'WhatsApp Business e chatbots', href: '/servidor-vps/evolution-api', badge: 'Novo' },
      { icon: Bot, label: 'Viraliza AI Cloud', desc: 'Agentes IA prontos para o negócio', href: '/servidor-vps/viraliza-ai-cloud', badge: 'Com IA' },
      { icon: HardDrive, label: 'Servidor Dedicado Linux', desc: 'Infraestrutura exclusiva de alta performance', href: '/servidor-dedicado' },
      { icon: Monitor, label: 'Servidor Dedicado Windows', desc: 'Windows Server com Plesk e acesso remoto', href: '/servidor-dedicado-windows' },
    ],
  },
]

const navLinks = [
  { label: 'Hospedagem e Sites', href: '/hospedagem-de-sites', mega: true },
  { label: 'Domínios', href: '/#dominios' },
  { label: 'Serviços', href: '/#servicos' },
  { label: 'E-mail Corporativo', href: '/#email-plans' },
  { label: 'Suporte', href: '/tickets' },
]

const BADGE_STYLE: Record<string, string> = {
  'Recomendado': 'bg-[#F5B700] text-black',
  'Com IA': 'bg-blue-600 text-white',
  'Novo': 'bg-green-600 text-white',
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileHostingOpen, setMobileHostingOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const megaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const openMega = () => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current)
    setMegaOpen(true)
  }
  const closeMega = () => {
    megaTimeout.current = setTimeout(() => setMegaOpen(false), 160)
  }

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
                <div key={link.label} className="relative" onMouseEnter={openMega} onMouseLeave={closeMega}>
                  <button className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-all whitespace-nowrap ${
                    megaOpen ? 'text-[#0A0A0A] bg-[#F5F5F5]' : 'text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]'
                  }`}>
                    {link.label}
                    <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} />
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

      {/* ── MEGA MENU (desktop) ── */}
      <div
        onMouseEnter={openMega}
        onMouseLeave={closeMega}
        className={`absolute top-full left-0 right-0 bg-white border-b border-[#F0F0F0] shadow-[0_16px_48px_rgba(0,0,0,0.10)] transition-all duration-200 origin-top hidden lg:block ${
          megaOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{ transitionProperty: 'opacity, transform' }}
      >
        <div className="container mx-auto px-4 lg:px-8 py-7">
          <div className="grid grid-cols-3 gap-10">
            {megaColumns.map((col) => (
              <div key={col.title}>
                <div className="text-[10px] font-black text-[#999] uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                  <div className="w-4 h-px bg-[#F5B700]" />
                  {col.title}
                </div>
                <div className="space-y-0.5">
                  {col.items.map(({ icon: Icon, label, desc, href, badge }) => (
                    <Link key={label} href={href}
                      onClick={() => setMegaOpen(false)}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[#FAFAFA] group transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-[#F5F5F5] group-hover:bg-[#FFFDF0] flex items-center justify-center shrink-0 transition-colors mt-0.5">
                        <Icon size={16} className="text-[#666] group-hover:text-[#B88900] transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[#0A0A0A] text-[13px] font-semibold group-hover:text-[#B88900] transition-colors">
                            {label}
                          </span>
                          {badge && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge] ?? 'bg-[#F5B700] text-black'}`}>
                              {badge}
                            </span>
                          )}
                        </div>
                        <span className="text-gray-400 text-[12px] leading-snug block">{desc}</span>
                      </div>
                      <ChevronRight size={12} className="text-gray-300 group-hover:text-[#F5B700] mt-2 shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-[#F0F0F0] flex items-center justify-between">
            <p className="text-xs text-[#999]">
              Dúvidas?{' '}
              <Link href="/tickets" className="text-[#F5B700] font-semibold hover:underline" onClick={() => setMegaOpen(false)}>
                Fale com um especialista
              </Link>
            </p>
            <div className="flex gap-4 text-xs text-[#999]">
              <span className="flex items-center gap-1.5 text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Uptime 99.9%
              </span>
              <span>Suporte 24/7</span>
              <span>Garantia 30 dias</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE MENU ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#F0F0F0] py-4 space-y-0.5 animate-fade-in bg-white max-h-[85vh] overflow-y-auto">
          {/* Hospedagem accordion */}
          <div>
            <button
              className="w-full flex items-center justify-between text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              onClick={() => setMobileHostingOpen(!mobileHostingOpen)}
            >
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

          {navLinks.slice(1).map((link) => (
            <Link key={link.label} href={link.href}
              className="block text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
              onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}

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
