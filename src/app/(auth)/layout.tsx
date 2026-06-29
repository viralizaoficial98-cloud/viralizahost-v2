import { Logo } from '@/components/shared/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo variant="light" size="lg" />
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">{children}</div>
        <p className="text-center text-slate-400 text-sm mt-6">© 2025 ViralizaHost. Todos os direitos reservados.</p>
      </div>
    </div>
  )
}
