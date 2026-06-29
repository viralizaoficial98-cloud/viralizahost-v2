'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Globe, Server, Mail, Ticket, CreditCard, Settings, LogOut, ChevronRight } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'

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
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full flex-shrink-0">
      <div className="p-6 border-b border-slate-800">
        <Logo variant="light" />
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}>
              <Icon size={20} />
              <span className="font-medium">{label}</span>
              {active && <ChevronRight size={16} className="ml-auto" />}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 w-full transition-all">
          <LogOut size={20} />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  )
}
