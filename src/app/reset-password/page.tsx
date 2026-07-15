'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { createAuthClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/shared/Logo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createAuthClient()

    // Handle PKCE flow: Supabase sends ?code= query param
    // Handle implicit flow: Supabase sends #access_token= hash
    // onAuthStateChange fires PASSWORD_RECOVERY in both cases after the client processes the URL
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      } else if (event === 'SIGNED_IN' && !ready) {
        // PKCE: session established via code exchange, treat as ready
        setReady(true)
      }
    })

    // Also check existing session (page reload after recovery link clicked)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // Timeout: if no event fires within 5s, the link is invalid/expired
    const timeout = setTimeout(() => {
      setReady(r => {
        if (!r) setInvalidLink(true)
        return r
      })
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
    setLoading(true)
    setError('')
    try {
      const supabase = createAuthClient()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        setDone(true)
        setTimeout(() => router.push('/login'), 3000)
      }
    } catch {
      setError('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="w-full max-w-md glass-dark rounded-3xl p-8 border border-green-500/20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mb-4">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Senha redefinida!</h2>
          <p className="text-gray-500 text-sm mb-6">
            A sua senha foi atualizada com sucesso. A redirecionar para o login…
          </p>
          <Link href="/login" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold">
            Ir para o Login →
          </Link>
        </div>
      </div>
    )
  }

  if (invalidLink) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="w-full max-w-md glass-dark rounded-3xl p-8 border border-red-500/20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">Link inválido ou expirado</h2>
          <p className="text-gray-500 text-sm mb-6">
            O link de recuperação de senha expirou ou já foi utilizado. Solicite um novo.
          </p>
          <Link href="/forgot-password" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold">
            Solicitar novo link →
          </Link>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-yellow-400" />
          <p className="text-gray-400 text-sm">A verificar o link de recuperação…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
        <Logo variant="light" size="sm" />
        <Link href="/login" className="text-sm text-gray-500 hover:text-yellow-400 transition-colors">← Voltar ao login</Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md glass-dark rounded-3xl p-8 border border-[#FFC107]/10">
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 mb-4">
              <Lock size={24} className="text-yellow-400" />
            </div>
            <h1 className="text-2xl font-black text-white mb-1">Nova Senha</h1>
            <p className="text-gray-500 text-sm">Crie uma senha forte para a sua conta</p>
          </div>
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Nova Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Mínimo 8 caracteres"
                  className="input-brand pl-10 pr-10 w-full"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Confirmar Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="Confirme a nova senha"
                  className="input-brand pl-10 w-full"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-shimmer btn-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <><Loader2 size={16} className="animate-spin" />A redefinir…</> : 'Redefinir Senha →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
