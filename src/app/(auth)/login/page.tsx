'use client'
import { Metadata } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos. Verifique os seus dados.'
          : authError.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="glass-dark rounded-3xl p-8 border border-[#FFC107]/10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <Lock size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Bem-vindo de volta</h1>
          <p className="text-gray-500 text-sm">Entre na sua conta ViralizaHost</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="input-brand pl-10"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-400">Senha</label>
              <Link href="/forgot-password" className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors">
                Esqueci a senha
              </Link>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-brand pl-10 pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="remember" className="w-4 h-4 rounded accent-yellow-400" />
            <label htmlFor="remember" className="text-sm text-gray-500">Lembrar-me neste dispositivo</label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-shimmer btn-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" />A entrar...</> : 'Entrar na Conta →'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#222] text-center">
          <p className="text-gray-600 text-sm">
            Não tem conta?{' '}
            <Link href="/register" className="text-yellow-400 hover:text-yellow-300 font-semibold transition-colors">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-700">
        <span>🔒 SSL Seguro</span>
        <span>•</span>
        <span>✓ Dados protegidos</span>
        <span>•</span>
        <span>24/7 Suporte</span>
      </div>
    </div>
  )
}
