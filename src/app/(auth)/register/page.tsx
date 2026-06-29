'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, Phone, Globe, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', country: 'AO', password: '', confirm_password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm_password) {
      setError('As senhas não coincidem.')
      return
    }
    if (form.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            phone: form.phone,
            country: form.country,
            role: 'client',
          },
        },
      })
      if (authError) {
        setError(authError.message)
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="glass-dark rounded-3xl p-8 border border-green-500/20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Conta criada com sucesso!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Enviamos um email de confirmação para <strong className="text-white">{form.email}</strong>.
            Verifique a sua caixa de entrada e clique no link para ativar a conta.
          </p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold">
            Ir para o Login →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="glass-dark rounded-3xl p-8 border border-[#FFC107]/10">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <User size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Criar sua conta</h1>
          <p className="text-gray-500 text-sm">Comece hoje com a ViralizaHost — grátis</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nome Completo</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type="text" value={form.full_name} onChange={set('full_name')} required
                placeholder="Seu nome completo" className="input-brand pl-10" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type="email" value={form.email} onChange={set('email')} required
                placeholder="seu@email.com" className="input-brand pl-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Telefone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="tel" value={form.phone} onChange={set('phone')}
                  placeholder="+244 900..." className="input-brand pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">País</label>
              <div className="relative">
                <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <select value={form.country} onChange={set('country')} className="input-brand pl-10 appearance-none">
                  <option value="AO">🇦🇴 Angola</option>
                  <option value="BR">🇧🇷 Brasil</option>
                  <option value="PT">🇵🇹 Portugal</option>
                  <option value="MZ">🇲🇿 Moçambique</option>
                  <option value="OTHER">🌍 Outro</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')}
                required placeholder="Mínimo 8 caracteres" className="input-brand pl-10 pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirmar Senha</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type="password" value={form.confirm_password} onChange={set('confirm_password')}
                required placeholder="Confirme a sua senha" className="input-brand pl-10" />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <input type="checkbox" id="terms" required className="mt-1 w-4 h-4 rounded accent-yellow-400" />
            <label htmlFor="terms" className="text-sm text-gray-500">
              Aceito os{' '}
              <Link href="/terms" className="text-yellow-400 hover:underline">Termos de Serviço</Link>
              {' '}e a{' '}
              <Link href="/privacy" className="text-yellow-400 hover:underline">Política de Privacidade</Link>
            </label>
          </div>

          <button type="submit" disabled={loading}
            className="btn-shimmer btn-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <><Loader2 size={16} className="animate-spin" />A criar conta...</> : 'Criar Conta Grátis →'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#222] text-center">
          <p className="text-gray-600 text-sm">
            Já tem conta?{' '}
            <Link href="/login" className="text-yellow-400 hover:text-yellow-300 font-semibold transition-colors">
              Entrar agora
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
