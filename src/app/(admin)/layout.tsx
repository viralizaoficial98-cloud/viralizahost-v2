import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'

const adminNav = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/clients', label: 'Clientes' },
  { href: '/admin/financial', label: 'Financeiro' },
  { href: '/admin/tickets', label: 'Tickets' },
  { href: '/admin/settings', label: 'Configurações' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="w-64 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <Logo variant="light" />
          <span className="text-xs text-indigo-400 mt-1 block">Painel Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {adminNav.map(({ href, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-medium">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h1 className="font-semibold text-slate-900">Painel Administrativo</h1>
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-700">Área do Cliente</Link>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
