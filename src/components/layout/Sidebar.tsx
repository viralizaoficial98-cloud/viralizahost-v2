'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Globe, Server, Mail, Ticket, CreditCard, Settings, LogOut, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { createAuthClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/domains',   icon: Globe,          label: 'Domínios' },
  { href: '/hosting',   icon: Server,         label: 'Hospedagem' },
  { href: '/email',     icon: Mail,           label: 'Emails' },
  { href: '/tickets',   icon: Ticket,         label: 'Suporte' },
  { href: '/billing',   icon: CreditCard,     label: 'Financeiro' },
  { href: '/settings',  icon: Settings,       label: 'Configurações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

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
      <div className="px-6 py-5 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Link href="/" aria-label="ViralizaHost" className="flex items-center">
          <Image
            src="/logotipo_branco.png"
            alt="ViralizaHost"
            width={148}
            height={38}
            priority
            style={{ height: 36, width: 'auto', objectFit: 'contain' }}
          />
        </Link>
      </div>

      {/* Nav label */}
      <div className="px-5 pt-6 pb-2">
        <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.20)' }}>
          Menu Principal
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
              style={{
                background: active ? 'rgba(245,183,0,0.12)' : 'transparent',
                color: active ? '#F5B700' : 'rgba(255,255,255,0.45)',
              }}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'
              }}
            >
              {active && (
                <div className="absolute left-0 w-0.5 h-6 rounded-r-full" style={{ background: '#F5B700' }} />
              )}
              <Icon size={17} className="shrink-0" />
              <span className="font-medium text-sm">{label}</span>
              {active && <ChevronRight size={13} className="ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full transition-all duration-200 text-left"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
            ;(e.currentTarget as HTMLElement).style.color = '#F87171'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'
          }}
        >
          <LogOut size={17} className="shrink-0" />
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </aside>
  )
}
