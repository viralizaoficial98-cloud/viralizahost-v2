'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Globe, Server, Mail, Ticket, CreditCard, Settings, LogOut, ChevronRight, X } from 'lucide-react'
import Image from 'next/image'
import { createAuthClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'     },
  { href: '/domains',   icon: Globe,           label: 'Domínios'      },
  { href: '/hosting',   icon: Server,          label: 'Hospedagem'    },
  { href: '/email',     icon: Mail,            label: 'Emails'        },
  { href: '/tickets',   icon: Ticket,          label: 'Suporte'       },
  { href: '/billing',   icon: CreditCard,      label: 'Financeiro'    },
  { href: '/settings',  icon: Settings,        label: 'Configurações' },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = async () => {
    const supabase = createAuthClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 flex flex-col h-full flex-shrink-0"
      style={{ background: '#FFFFFF', borderRight: '1px solid #E5E7EB' }}>

      {/* Logo */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #E5E7EB' }}>
        <Link href="/" aria-label="ViralizaHost">
          <Image
            src="/logo-viraliza-yellow.png"
            alt="ViralizaHost"
            width={148} height={38}
            priority
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg md:hidden transition-colors"
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
          style={{ color: '#9CA3AF' }}>Menu Principal</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
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

      {/* Logout */}
      <div className="px-3 pb-5" style={{ borderTop: '1px solid #E5E7EB', paddingTop: '1rem' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl w-full transition-all duration-200 text-left"
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
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </aside>
  )
}
