'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/hooks/useLocale'
import { CartButton } from '@/components/cart/CartButton'
import {
  Activity, AlertTriangle, Archive, Bot, BookOpen, Building2, Calendar, ChevronDown, ChevronRight, Code, Cpu, Database, Gauge, Globe, Handshake,
  HardDrive, Headphones, HelpCircle, Layers, Lock, Mail, Menu, MessageCircle, Monitor, MoveRight, RefreshCw, RotateCcw, Rss, Search, Server,
  Shield, ShieldCheck, Smartphone, Tag, Users, Workflow, Wrench, X, Zap,
} from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { MAIN_NAV, type NavAside, type NavGroup, type NavItem } from '@/lib/site/navigation'
import type { PageIcon } from '@/lib/site/pages'

// Menu principal — a MESMA configuração (src/lib/site/navigation.ts) no desktop e no telemóvel:
// Hospedagem e site · Domínios · E-mail corporativo · Serviços · Empresa.

const ICONS: Record<PageIcon, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>> = {
  server: Server, users: Users, zap: Zap, code: Code, cpu: Cpu, workflow: Workflow, shield: Shield, message: MessageCircle, bot: Bot, harddrive: HardDrive,
  monitor: Monitor, globe: Globe, search: Search, move: MoveRight, rotate: RotateCcw, gauge: Gauge, lock: Lock, shieldcheck: ShieldCheck, layers: Layers,
  database: Database, book: BookOpen, mail: Mail, alert: AlertTriangle, archive: Archive, activity: Activity, smartphone: Smartphone, calendar: Calendar,
  refresh: RefreshCw, rss: Rss, wrench: Wrench, handshake: Handshake, headphones: Headphones, building: Building2, tag: Tag, help: HelpCircle,
}
const BADGE_STYLE: Record<string, string> = { 'Com IA': 'bg-blue-600 text-white', 'Novo': 'bg-green-600 text-white' }
const isActive = (pathname: string, g: NavGroup) =>
  g.href ? pathname === g.href || pathname.startsWith(`${g.href}/`) : !!g.columns?.some(c => c.items.some(i => pathname === i.href.split('#')[0]))

/* Item do painel escuro (desktop) */
function PanelItem({ item, compact, onClick }: { item: NavItem; compact: boolean; onClick: () => void }) {
  const Icon = ICONS[item.icon] ?? Globe
  return (
    <Link href={item.href} onClick={onClick} data-testid="nav-item"
      className={`group flex items-start gap-3 px-3 ${compact ? 'py-1.5' : 'py-2.5'} rounded-xl transition-colors hover:bg-[rgba(245,183,0,0.07)] focus-visible:bg-[rgba(245,183,0,0.10)] outline-none`}>
      <span className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-lg flex items-center justify-center shrink-0 mt-0.5`} style={{ background: 'rgba(245,183,0,0.10)' }}>
        <Icon size={compact ? 12 : 14} style={{ color: '#F5B700' }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-[13px] font-semibold leading-tight group-hover:text-[#F5B700] transition-colors">{item.label}</span>
          {item.badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[item.badge] ?? 'bg-[#F5B700] text-black'}`}>{item.badge}</span>}
        </span>
        {!compact && <span className="block text-[11px] leading-snug mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>{item.desc}</span>}
      </span>
    </Link>
  )
}

/*
 * Painel com imagem à direita do submenu — recuperado da versão anterior ao PR #48 (mesma imagem, textos, cores e
 * proporções): «hospedagem» = coluna de 260 px com imagem de 148 px; «servicos» = coluna larga com imagem de 170 px;
 * ambos com o cartão «Precisa de ajuda?» por baixo. No telemóvel usa-se a variante compacta (MobileAside).
 */
const ASIDE_GRID: Record<NavAside, (cols: number) => string> = {
  hospedagem: () => '1fr 1fr 1.4fr 260px',
  servicos: cols => `repeat(${cols}, minmax(0, 1fr)) minmax(240px, 1.15fr)`,
}
function NavAsidePanel({ kind, onClick }: { kind: NavAside; onClick: () => void }) {
  const big = kind === 'servicos'
  return (
    <div className="flex flex-col gap-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '1.5rem' }} data-testid="nav-aside" data-kind={kind}>
      <div className="flex-1 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(160deg, #111111 0%, #0d0d0d 100%)', border: '1px solid rgba(245,183,0,0.32)', boxShadow: '0 0 32px rgba(245,183,0,0.08), inset 0 1px 0 rgba(245,183,0,0.14)' }}>
        <div className="relative w-full flex items-center justify-center" style={{ height: big ? 170 : 148, background: '#080808', borderBottom: '1px solid rgba(245,183,0,0.14)' }}>
          <Image src="/infrastructure-world-class.png" alt="" aria-hidden width={big ? 260 : 230} height={big ? 155 : 132}
            style={{ objectFit: 'contain', maxHeight: big ? 155 : 132, width: '100%', borderRadius: big ? 10 : 0 }} data-testid="nav-aside-image" />
          <div className="absolute bottom-0 left-0 right-0 h-8" style={{ background: 'linear-gradient(to top, #0d0d0d, transparent)' }} />
        </div>
        <div className="p-4 flex flex-col flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] mb-1.5" style={{ color: 'rgba(245,183,0,0.65)' }}>Infraestrutura Premium</p>
          <p className="text-white font-black text-[13px] leading-tight mb-2">Infraestrutura de <span style={{ color: '#F5B700' }}>Classe Mundial</span></p>
          <p className="text-[11px] leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.42)' }}>Servidores de última geração com desempenho máximo e 99.9% de uptime garantido.</p>
          <Link href="/servidor-dedicado" onClick={onClick} className="block text-center text-xs font-black py-2.5 rounded-xl w-full hover:bg-[#FFD54F]" style={{ background: '#F5B700', color: '#090909' }}>Ver Infraestrutura →</Link>
        </div>
      </div>
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="flex items-center gap-2 mb-1.5"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" /><span className="text-white text-xs font-bold">Precisa de ajuda?</span></p>
        <p className="text-[11px] mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>A nossa equipa está online 24/7 para si.</p>
        <Link href="/suporte/tickets" onClick={onClick} className="block text-center text-[11px] font-bold py-2 rounded-xl w-full hover:text-[#F5B700]" style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.12)' }}>Falar com Suporte →</Link>
      </div>
    </div>
  )
}
/** Telemóvel: o mesmo painel, compacto e por baixo dos links (nenhum link fica escondido, sem rolagem horizontal). */
function MobileAside({ onClick }: { onClick: () => void }) {
  return (
    <Link href="/servidor-dedicado" onClick={onClick} data-testid="mnav-aside" className="mt-2 mx-1 flex items-center gap-3 rounded-2xl overflow-hidden bg-[#0B0B0B] border border-[#F5B700]/30 max-w-full">
      <span className="relative w-28 h-20 shrink-0 bg-[#080808]"><Image src="/infrastructure-world-class.png" alt="" aria-hidden fill sizes="112px" style={{ objectFit: 'contain' }} /></span>
      <span className="min-w-0 py-2 pr-3"><span className="block text-white font-black text-[13px] leading-tight">Infraestrutura de <span className="text-[#F5B700]">Classe Mundial</span></span>
        <span className="block text-[11px] text-white/50 mt-0.5">Ver infraestrutura →</span></span>
    </Link>
  )
}

export function Header() {
  const { t } = useLocale()
  const pathname = usePathname() ?? '/'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileGroup, setMobileGroup] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState<NavGroup['id'] | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { document.documentElement.classList.toggle('vh-menu-open', mobileOpen); return () => document.documentElement.classList.remove('vh-menu-open') }, [mobileOpen])
  // Fechar com Escape e ao clicar fora
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setMobileOpen(false) } }
    const onDown = (e: MouseEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null) }
    window.addEventListener('keydown', onKey); window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown) }
  }, [])
  const openedAt = useRef(0)
  const show = (id: NavGroup['id']) => { if (timer.current) clearTimeout(timer.current); setOpen(o => { if (o !== id) openedAt.current = Date.now(); return id }) }
  // Clique: abre; fecha só se já estava aberto antes (não logo a seguir à abertura pelo rato)
  const toggle = (id: NavGroup['id']) => setOpen(o => (o === id && Date.now() - openedAt.current > 400 ? null : (o !== id && (openedAt.current = Date.now()), id)))
  const hide = () => { timer.current = setTimeout(() => setOpen(null), 160) }
  const close = () => { setOpen(null); setMobileOpen(false); setMobileGroup(null) }
  const openGroup = MAIN_NAV.find(g => g.id === open)

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white border-b border-[#F0F0F0] ${scrolled ? 'shadow-[0_1px_24px_rgba(0,0,0,0.09)]' : ''}`}>
      <div ref={navRef}>
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-[68px]">
            <div className="hidden sm:block"><Logo variant="dark" size="md" /></div>
            <div className="block sm:hidden"><Logo variant="dark" size="sm" /></div>

            {/* Desktop */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center max-w-3xl mx-auto" aria-label="Menu principal" data-testid="main-nav">
              {MAIN_NAV.map(g => {
                const current = isActive(pathname, g)
                const base = `flex items-center gap-1 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-all whitespace-nowrap ${open === g.id || current ? 'text-[#0A0A0A] bg-[#F5F5F5]' : 'text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]'}`
                return g.href ? (
                  <Link key={g.id} href={g.href} className={base} aria-current={current ? 'page' : undefined} data-testid={`nav-${g.id}`} onClick={close}>{g.label}</Link>
                ) : (
                  <div key={g.id} onMouseEnter={() => show(g.id)} onMouseLeave={hide}>
                    <button type="button" className={base} aria-expanded={open === g.id} aria-controls="nav-panel" data-testid={`nav-${g.id}`}
                      onClick={() => toggle(g.id)}>
                      {g.label}
                      <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 ${open === g.id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )
              })}
            </nav>

            <div className="hidden lg:flex items-center gap-2.5 shrink-0">
              <CurrencySelector />
              <CartButton />
              <Link href="/login" className="text-[#3D3D3D] hover:text-[#0A0A0A] px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-[#F5F5F5]">{t('nav.login')}</Link>
              <Link href="/register" className="btn-shimmer btn-primary px-5 py-2.5 text-sm rounded-xl shadow-[0_4px_12px_rgba(245,183,0,0.28)] hover:shadow-[0_6px_20px_rgba(245,183,0,0.38)]">{t('cta.start')} →</Link>
            </div>

            <CartButton className="lg:hidden ml-auto mr-1" onClick={() => setMobileOpen(false)} />
            <button className="lg:hidden p-2 rounded-xl text-[#444] hover:bg-[#F5F5F5] transition-all" onClick={() => setMobileOpen(o => !o)}
              aria-label="Menu" aria-expanded={mobileOpen} aria-controls="mobile-menu" data-testid="mobile-menu-toggle">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Painel do grupo aberto (desktop) */}
        <div id="nav-panel" onMouseEnter={() => open && show(open)} onMouseLeave={hide} data-testid="nav-panel" data-group={open ?? ''}
          className={`absolute top-full left-0 right-0 hidden lg:block transition-all duration-200 origin-top ${openGroup?.columns ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
          style={{ background: '#0B0B0B', borderBottom: '1px solid rgba(245,183,0,0.30)', boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(245,183,0,0.12)' }}
          aria-hidden={!openGroup?.columns}>
          <div style={{ height: 1, background: 'linear-gradient(to right, transparent, #F5B700, transparent)', opacity: 0.6 }} />
          {openGroup?.columns && (() => {
            const compact = openGroup.columns.some(c => c.items.length > 5)
            return (
              <div className="container mx-auto px-4 lg:px-8 py-7 max-h-[calc(100vh-72px)] overflow-y-auto">
                <div className="grid gap-6" data-testid="nav-panel-grid" style={{ gridTemplateColumns: openGroup.aside ? ASIDE_GRID[openGroup.aside](openGroup.columns.length) : `repeat(${Math.max(openGroup.columns.length, openGroup.id === 'empresa' ? 1 : 3)}, minmax(0, 1fr))` }}>
                  {openGroup.columns.map((col, i) => (
                    <div key={col.title} style={i ? { borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '1.25rem' } : undefined} data-testid="nav-column">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2.5" style={{ color: '#F5B700' }}>
                        <span className="w-3 h-px inline-block" style={{ background: '#F5B700' }} />{col.title}
                      </p>
                      <div className={`space-y-0.5 ${openGroup.id === 'empresa' ? 'grid grid-cols-4 gap-2 space-y-0' : ''}`}>
                        {col.items.map(item => <PanelItem key={item.href} item={item} compact={compact} onClick={close} />)}
                      </div>
                    </div>
                  ))}
                  {openGroup.aside && <NavAsidePanel kind={openGroup.aside} onClick={close} />}
                </div>
                <div className="mt-6 pt-4 flex items-center justify-between text-[11px]" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>Suporte 24/7 · Preços em Kz</span>
                  <Link href="/suporte/contactar" onClick={close} className="font-semibold hover:underline" style={{ color: '#F5B700' }}>Fale com um especialista</Link>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Telemóvel: os mesmos grupos, em acordeão */}
      {mobileOpen && (
        <nav id="mobile-menu" aria-label="Menu principal" className="lg:hidden border-t border-[#F0F0F0] py-3 px-2 space-y-0.5 bg-white max-h-[calc(100vh-68px)] overflow-y-auto overscroll-contain" data-testid="mobile-nav">
          {MAIN_NAV.map(g => g.href ? (
            <Link key={g.id} href={g.href} onClick={close} data-testid={`mnav-${g.id}`}
              className="flex items-center justify-between text-[#222] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-[15px] font-semibold">
              {g.label}<ChevronRight size={15} className="text-gray-400" />
            </Link>
          ) : (
            <div key={g.id}>
              <button type="button" onClick={() => { setMobileGroup(m => (m === g.id ? null : g.id)) }} aria-expanded={mobileGroup === g.id} data-testid={`mnav-${g.id}`}
                className="w-full flex items-center justify-between text-[#222] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-[15px] font-semibold">
                {g.label}<ChevronDown size={15} className={`text-gray-400 transition-transform ${mobileGroup === g.id ? 'rotate-180' : ''}`} />
              </button>
              {mobileGroup === g.id && (
                <div className="ml-4 mt-0.5 mb-1 border-l-2 border-[#F5B700]/30 pl-2 space-y-0.5" data-testid="mnav-panel">
                  {g.columns!.map(col => (
                    <div key={col.title}>
                      {g.columns!.length > 1 && <p className="text-[10px] font-black text-[#AAA] uppercase tracking-wider px-3 pt-2 pb-1" data-testid="mnav-column-title">{col.title}</p>}
                      {col.items.map(item => (
                        <Link key={item.href} href={item.href} onClick={close} data-testid="mnav-item"
                          className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-[#555] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]">
                          <span>{item.label}</span>
                          {item.badge && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${BADGE_STYLE[item.badge] ?? 'bg-[#F5B700] text-black'}`}>{item.badge}</span>}
                        </Link>
                      ))}
                    </div>
                  ))}
                  {g.aside && <MobileAside onClick={close} />}
                </div>
              )}
            </div>
          ))}
          <div className="pt-4 mt-2 border-t border-[#F0F0F0] space-y-3 px-2">
            <CurrencySelector />
            <div className="flex gap-3">
              <Link href="/login" onClick={close} className="flex-1 text-center text-[#0A0A0A] border border-[#E8E8E8] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F8F8F8]">Entrar</Link>
              <Link href="/register" onClick={close} className="flex-1 text-center btn-primary py-2.5 text-sm rounded-xl flex items-center justify-center font-bold">Começar</Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
