import Link from 'next/link'
import { Logo } from '@/components/shared/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
        <Logo variant="light" size="sm" />
        <Link href="/" className="text-sm text-gray-500 hover:text-yellow-400 transition-colors">← Voltar ao site</Link>
      </header>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-40 w-80 h-80 bg-yellow-400/4 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-40 w-80 h-80 bg-yellow-400/4 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-mesh opacity-40" />
      </div>
      <main className="flex-1 flex items-center justify-center px-4 py-12 relative">
        {children}
      </main>
      <footer className="text-center py-4 text-xs text-gray-700 border-t border-[#1A1A1A]">
        © {new Date().getFullYear()} ViralizaHost — Todos os direitos reservados
      </footer>
    </div>
  )
}
