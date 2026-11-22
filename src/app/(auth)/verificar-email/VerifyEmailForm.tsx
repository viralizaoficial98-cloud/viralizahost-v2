'use client'
import Link from 'next/link'
import { useState } from 'react'
import { Mail, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'

// Verificação do e-mail: motivo de um link que já não é válido e pedido de novo envio.
// A resposta do reenvio é sempre a mesma (não revela se o endereço tem conta).
const MESSAGES: Record<string, { title: string; text: string; tone: 'warn' | 'ok' }> = {
  expirado: { title: 'Link expirado', text: 'Este link de confirmação já não é válido (expira ao fim de 24 horas ou quando é pedido um novo). Peça um novo e-mail abaixo.', tone: 'warn' },
  utilizado: { title: 'Link já utilizado', text: 'Este link já foi usado. Cada link só funciona uma vez. Se ainda não consegue entrar, peça um novo e-mail abaixo.', tone: 'warn' },
  invalido: { title: 'Link inválido', text: 'Não reconhecemos este link. Confirme que abriu o link completo do e-mail mais recente ou peça um novo abaixo.', tone: 'warn' },
  'ja-confirmado': { title: 'E-mail já confirmado', text: 'A sua conta já está activa. Pode iniciar sessão.', tone: 'ok' },
}

export function VerifyEmailForm({ estado, initialEmail }: { estado: string; initialEmail: string }) {
  const msg = MESSAGES[estado]
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function resend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setResult(null)
    try {
      const r = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const j = await r.json().catch(() => ({}))
      setResult(r.ok ? { ok: true, text: j.message } : { ok: false, text: j.error ?? 'Não foi possível pedir o envio. Tente novamente.' })
    } catch { setResult({ ok: false, text: 'Falha de rede. Tente novamente.' }) } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-md">
      <div className="glass-dark rounded-3xl p-8 border border-[#FFC107]/10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 mb-4">
            <Mail size={24} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">Verificar e-mail</h1>
          <p className="text-gray-500 text-sm">Receba um novo link para activar a sua conta</p>
        </div>

        {msg && (
          <div className={`mb-5 p-3 rounded-xl text-sm border ${msg.tone === 'ok' ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'}`} role="status" data-testid={`verify-state-${estado}`}>
            <p className="font-bold flex items-center gap-1.5">{msg.tone === 'ok' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msg.title}</p>
            <p className="mt-1">{msg.text}</p>
            {msg.tone === 'ok' && <Link href="/login" className="inline-block mt-2 underline text-yellow-400">Iniciar sessão</Link>}
          </div>
        )}

        {result && (
          <div className={`mb-4 p-3 rounded-xl text-sm border ${result.ok ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-red-500/10 border-red-500/20 text-red-400'}`} role="status" data-testid="resend-result">{result.text}</div>
        )}

        <form onSubmit={resend} className="space-y-4">
          <div>
            <label htmlFor="verify-email" className="block text-sm font-medium text-gray-400 mb-1.5">E-mail da conta</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input id="verify-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" className="input-brand pl-10" data-testid="resend-email" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-shimmer btn-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60" data-testid="resend-submit">
            {loading ? <Loader2 size={16} className="animate-spin" /> : null} Reenviar e-mail de verificação
          </button>
        </form>
        <p className="text-center text-gray-500 text-xs mt-5">
          Já confirmou? <Link href="/login" className="text-yellow-400 underline">Iniciar sessão</Link> · Esqueceu a senha? <Link href="/forgot-password" className="text-yellow-400 underline">Recuperar</Link>
        </p>
      </div>
    </div>
  )
}

