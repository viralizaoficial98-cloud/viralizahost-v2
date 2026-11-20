'use client'
import { useState } from 'react'
import { CheckCircle2, Loader2, Send, AlertCircle } from 'lucide-react'

// Pedido de cotação (planos «sob consulta»). Fica registado no painel em «Cotações».
export function QuoteRequestForm({ product, productName, note }: { product: string; productName: string; note?: string | null }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ref, setRef] = useState<string | null>(null)
  const input = 'w-full border border-[#E2E2E2] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/20'
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, product }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setRef(j.reference)
    } catch (err) { setError((err as Error).message || 'Não foi possível enviar.') } finally { setBusy(false) }
  }
  if (ref) return (
    <div className="bg-white rounded-2xl border border-green-200 p-6" role="status" data-testid="quote-confirmation">
      <CheckCircle2 className="text-green-600 mb-2" />
      <p className="font-black text-[#0A0A0A] text-lg">Pedido de cotação recebido</p>
      <p className="text-sm text-[#555] mt-1">Referência <strong>{ref}</strong> — {productName}. A equipa comercial responde para {f.email} com a proposta.</p>
    </div>
  )
  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-5 sm:p-7 space-y-3">
      <h1 className="text-2xl font-black text-[#0A0A0A]">{productName} — sob consulta</h1>
      <p className="text-sm text-[#666]">{note ?? 'Este plano não tem preço público.'} Envie o pedido e recebe uma proposta.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm font-semibold">Nome *<input className={`${input} mt-1`} required value={f.name} onChange={e => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
        <label className="text-sm font-semibold">E-mail *<input className={`${input} mt-1`} type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
        <label className="text-sm font-semibold">Telefone<input className={`${input} mt-1`} type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></label>
        <label className="text-sm font-semibold">Empresa<input className={`${input} mt-1`} value={f.company} onChange={e => setF({ ...f, company: e.target.value })} autoComplete="organization" /></label>
      </div>
      <label className="block text-sm font-semibold">O que precisa?<textarea className={`${input} mt-1`} rows={4} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /></label>
      {error && <p className="text-sm text-red-700 flex gap-1" role="alert"><AlertCircle size={16} /> {error}</p>}
      <button className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-[#F5B700] text-[#0A0A0A] disabled:opacity-50" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Pedir proposta</button>
    </form>
  )
}
