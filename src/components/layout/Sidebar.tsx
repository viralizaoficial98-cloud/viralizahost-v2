'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Globe, Server, Mail, Ticket, CreditCard, Settings, LogOut, ChevronRight } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/domains', icon: Globe, label: 'Domínios' },
  { href: '/hosting', icon: Server, label: 'Hospedagem' },
  { href: '/email', icon: Mail, label: 'Emails' },
  { href: '/tickets', icon: Ticket, label: 'Suporte' },
  { href: '/billing', icon: CreditCard, label: 'Financeiro' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-[#0A0A0A] border-r border-[#1A1A1A] flex flex-col h-full flex-shrink-0">
      <div className="p-6 border-b border-[#1A1A1A]">
        <Logo size="sm" />
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={`sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'active' : ''}`}>
              <Icon size={18} />
              <span className="font-medium text-sm">{label}</span>
              {active && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-[#1A1A1A]">
        <button onClick={handleLogout} className="sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl w-full transition-all hover:text-red-400 hover:bg-red-400/8">
          <LogOut size={18} />
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </aside>
  )
}
