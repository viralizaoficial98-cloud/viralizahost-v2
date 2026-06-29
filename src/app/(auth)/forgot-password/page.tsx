'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Mail, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (authError) {
        setError(authError.message)
      } else {
        setSent(true)
      }
    } catch {
      setError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="glass-dark rounded-3xl p-8 border border-green-500/20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Email enviado!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Enviamos as instruções de recuperação para{' '}
            <strong className="text-white">{email}</strong>.
            Verifique a sua caixa de entrada.
          </p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold">
            <ArrowLeft size={16} /> Voltar ao Login
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
            <Mail size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Recuperar senha</h1>
          <p className="text-gray-500 text-sm">Informe o seu email para receber as instruções</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email da conta</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="seu@email.com" className="input-brand pl-10" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="btn-shimmer btn-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <><Loader2 size={16} className="animate-spin" />A enviar...</> : 'Enviar Instruções →'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-[#222] text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:text-yellow-400 transition-colors flex items-center justify-center gap-1">
            <ArrowLeft size={14} /> Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}
