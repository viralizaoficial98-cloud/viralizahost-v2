'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, CreditCard, MessageSquare, Settings,
  Server, Globe, Activity, LogOut, ChevronRight, Monitor, ShoppingBag, Menu, X, Bot,
} from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/client'

const adminNav = [
  { href: '/admin',           icon: LayoutDashboard, label: 'Dashboard',      exact: true  },
  { href: '/admin/clients',   icon: Users,           label: 'Clientes',       exact: false },
  { href: '/admin/financial', icon: CreditCard,      label: 'Financeiro',     exact: false },
  { href: '/admin/tickets',   icon: MessageSquare,   label: 'Tickets',        exact: false },
  { href: '/admin/servers',   icon: Server,          label: 'Servidores',     exact: false },
  { href: '/admin/domains',   icon: Globe,           label: 'Domínios',       exact: false },
  { href: '/admin/activity',  icon: Activity,        label: 'Atividade',      exact: false },
  { href: '/admin/orders',    icon: ShoppingBag,     label: 'Pedidos',        exact: false },
  { href: '/admin/site',      icon: Monitor,         label: 'Gestão do Site', exact: false },
  { href: '/admin/agent',     icon: Bot,             label: 'Agente IA',      exact: false },
  { href: '/admin/settings',  icon: Settings,        label: 'Configurações',  exact: false },
]

function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = async () => {
    const supabase = createAuthClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex flex-col h-full w-64 flex-shrink-0"
      style={{ background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}>

      {/* Logo */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #E5E7EB' }}>
        <Link href="/" aria-label="ViralizaHost" className="flex flex-col gap-1">
          <Image
            src="/logo-viraliza-yellow.png"
            alt="ViralizaHost"
            width={148} height={38}
            priority
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F5B700' }} />
            <span className="text-[10px] font-semibold" style={{ color: '#92720A' }}>Painel Administrativo</span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 p-1.5 rounded-lg md:hidden transition-colors"
            style={{ color: '#6B7280' }}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav label */}
      <div className="px-5 pt-5 pb-1.5">
        <span className="text-[10px] font-black tracking-widest uppercase"
          style={{ color: '#9CA3AF' }}>Administração</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        {adminNav.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200"
              style={{
                background: active ? '#F5B700' : 'transparent',
                color:      active ? '#111111' : '#6B7280',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = '#FFF8E1'
                  ;(e.currentTarget as HTMLElement).style.color = '#111111'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#6B7280'
                }
              }}
            >
              <Icon size={17} className="shrink-0" />
              <span className="font-medium text-sm">{label}</span>
              {active && <ChevronRight size={13} className="ml-auto" style={{ opacity: 0.6 }} />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 space-y-0.5"
        style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm"
          style={{ color: '#6B7280' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#FFF8E1'
            ;(e.currentTarget as HTMLElement).style.color = '#111111'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#6B7280'
          }}
        >
          <LayoutDashboard size={17} className="shrink-0" />
          <span className="font-medium">Área do Cliente</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full transition-all duration-200 text-left text-sm"
          style={{ color: '#9CA3AF' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)'
            ;(e.currentTarget as HTMLElement).style.color = '#DC2626'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
          }}
        >
          <LogOut size={17} className="shrink-0" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Lock body scroll when drawer open
  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>

      {/* ── Desktop sidebar (always visible md+) ── */}
      <div className="hidden md:flex">
        <AdminSidebar />
      </div>

      {/* ── Mobile drawer overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="fixed inset-y-0 left-0 z-50 flex md:hidden transition-transform duration-300"
        style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        aria-modal="true"
        role="dialog"
        aria-label="Menu de navegação"
      >
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header
          className="px-4 md:px-6 py-3.5 flex items-center justify-between flex-shrink-0"
          style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: '#6B7280' }}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#F5B700' }} />
              <span className="font-bold text-sm" style={{ color: '#111827' }}>Painel Administrativo</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#059669' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="hidden sm:inline">Sistema operacional</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
