'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/shared/Logo'
import { LayoutDashboard, Users, CreditCard, MessageSquare, Settings, Server, Globe, Activity, LogOut, ChevronRight, Monitor } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const adminNav = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/clients', icon: Users, label: 'Clientes' },
  { href: '/admin/financial', icon: CreditCard, label: 'Financeiro' },
  { href: '/admin/tickets', icon: MessageSquare, label: 'Tickets' },
  { href: '/admin/servers', icon: Server, label: 'Servidores' },
  { href: '/admin/domains', icon: Globe, label: 'Domínios' },
  { href: '/admin/activity', icon: Activity, label: 'Atividade' },
  { href: '/admin/site', icon: Monitor, label: 'Gestão do Site' },
  { href: '/admin/settings', icon: Settings, label: 'Configurações' },
]

function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-[#0A0A0A] border-r border-[#1A1A1A] flex flex-col flex-shrink-0 h-full">
      <div className="p-5 border-b border-[#1A1A1A]">
        <Logo variant="light" size="sm" />
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          <span className="text-xs text-yellow-400 font-medium">Painel Admin</span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {adminNav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? 'active' : ''}`}>
              <Icon size={16} />
              <span className="font-medium text-sm">{label}</span>
              {active && <ChevronRight size={12} className="ml-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#1A1A1A] space-y-1">
        <Link href="/dashboard" className="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm">
          <LayoutDashboard size={16} /> Área do Cliente
        </Link>
        <button onClick={handleLogout} className="sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl w-full transition-all hover:text-red-400 hover:bg-red-400/8 text-sm">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </aside>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0D0D0D] overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-[#0D0D0D] border-b border-[#1A1A1A] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="font-bold text-white">Painel Administrativo</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Activity size={12} className="text-green-400" />
            <span className="text-green-400">Sistema operacional</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
