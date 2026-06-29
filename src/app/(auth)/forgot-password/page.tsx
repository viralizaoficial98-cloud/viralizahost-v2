import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Recuperar Senha' }

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Recuperar senha</h1>
      <p className="text-slate-500 mb-8">Informe seu email para receber as instruções de recuperação</p>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" placeholder="seu@email.com" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition-colors">Enviar Instruções</button>
      </form>
      <p className="text-center text-slate-600 text-sm mt-6">
        Lembrou a senha? <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Voltar ao login</Link>
      </p>
    </div>
  )
}
