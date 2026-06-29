import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Criar Conta' }

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Criar sua conta</h1>
      <p className="text-slate-500 mb-8">Comece hoje com a ViralizaHost</p>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
          <input type="text" placeholder="Seu nome completo" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input type="email" placeholder="seu@email.com" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
          <input type="tel" placeholder="+244 900 000 000" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">País</label>
          <select className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            <option value="">Selecione o país</option>
            <option value="AO">🇦🇴 Angola</option>
            <option value="BR">🇧🇷 Brasil</option>
            <option value="PT">🇵🇹 Portugal</option>
            <option value="MZ">🇲🇿 Moçambique</option>
            <option value="OTHER">🌍 Outro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
          <input type="password" placeholder="Mínimo 8 caracteres" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
          <input type="password" placeholder="Confirme a sua senha" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        </div>
        <div className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 rounded" />
          <label className="text-sm text-slate-600">
            Aceito os <Link href="/terms" className="text-indigo-600 hover:underline">Termos de Serviço</Link> e a <Link href="/privacy" className="text-indigo-600 hover:underline">Política de Privacidade</Link>
          </label>
        </div>
        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition-colors">Criar Conta</button>
      </form>
      <p className="text-center text-slate-600 text-sm mt-6">
        Já tem conta? <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Entrar</Link>
      </p>
    </div>
  )
}
