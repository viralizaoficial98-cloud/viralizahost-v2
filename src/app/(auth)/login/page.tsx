import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Entrar' }

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo de volta</h1>
      <p className="text-slate-500 mb-8">Entre na sua conta ViralizaHost</p>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" placeholder="seu@email.com" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
          <input type="password" placeholder="••••••••" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="rounded" /> Lembrar-me</label>
          <Link href="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700">Esqueci a senha</Link>
        </div>
        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition-colors">Entrar</button>
      </form>
      <p className="text-center text-slate-600 text-sm mt-6">
        Não tem conta? <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">Criar conta</Link>
      </p>
    </div>
  )
}
