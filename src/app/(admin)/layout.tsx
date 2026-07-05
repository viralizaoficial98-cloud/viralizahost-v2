'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, CreditCard, MessageSquare, Settings, Server, Globe, Activity, LogOut, ChevronRight, Monitor, ShoppingBag } from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/client'

const adminNav = [
  { href: '/admin',              icon: LayoutDashboard, label: 'Dashboard',       exact: true },
  { href: '/admin/clients',      icon: Users,           label: 'Clientes',        exact: false },
  { href: '/admin/financial',    icon: CreditCard,      label: 'Financeiro',      exact: false },
  { href: '/admin/tickets',      icon: MessageSquare,   label: 'Tickets',         exact: false },
  { href: '/admin/servers',      icon: Server,          label: 'Servidores',      exact: false },
  { href: '/admin/domains',      icon: Globe,           label: 'Domínios',        exact: false },
  { href: '/admin/activity',     icon: Activity,        label: 'Atividade',       exact: false },
  { href: '/admin/orders',        icon: ShoppingBag,     label: 'Pedidos',         exact: false },
  { href: '/admin/site',         icon: Monitor,         label: 'Gestão do Site',  exact: false },
  { href: '/admin/settings',     icon: Settings,        label: 'Configurações',   exact: false },
]

function AdminSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = async () => {
    const supabase = createAuthClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="w-64 flex flex-col h-full flex-shrink-0"
      style={{
        background: 'linear-gradient(180deg, #0A0C10 0%, #0D1018 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="px-6 py-5 flex flex-col gap-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" aria-label="ViralizaHost">
          <Image src="/logotipo_branco.png" alt="ViralizaHost" width={148} height={38} priority
            style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#F5B700' }} />
          <span className="text-xs font-semibold" style={{ color: '#F5B700' }}>Painel Administrativo</span>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-5 pt-6 pb-2">
        <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.20)' }}>
          Administração
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        {adminNav.map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
          return (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative"
              style={{
                background: active ? 'rgba(245,183,0,0.12)' : 'transparent',
                color: active ? '#F5B700' : 'rgba(255,255,255,0.45)',
              }}
              onMouseEnter={e => {
                if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)' }
              }}
              onMouseLeave={e => {
                if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }
              }}
            >
              <Icon size={17} className="shrink-0" />
              <span className="font-medium text-sm">{label}</span>
              {active && <ChevronRight size={13} className="ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
        <Link href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.70)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
        >
          <LayoutDashboard size={17} className="shrink-0" />
          <span className="font-medium">Área do Cliente</span>
        </Link>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full transition-all duration-200 text-left text-sm"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#F87171' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
        >
          <LogOut size={17} className="shrink-0" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-3.5 flex items-center justify-between flex-shrink-0"
          style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: '#F5B700' }} />
            <span className="font-bold text-sm" style={{ color: '#111827' }}>Painel Administrativo</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#059669' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Sistema operacional
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
