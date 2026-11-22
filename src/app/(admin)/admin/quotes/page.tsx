'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2, FileQuestion } from 'lucide-react'

// Pedidos de cotação dos planos «sob consulta» (formulário público).
type Quote = { id: string; reference: string; product_slug: string | null; product_name: string | null; name: string; email: string; phone: string | null; company: string | null; message: string | null; status: string; admin_notes: string | null; created_at: string }
const STATUS: Record<string, string> = { new: 'Novo', contacted: 'Contactado', quoted: 'Proposta enviada', closed: 'Fechado' }

function QuotesInner() {
  const params = useSearchParams()
  const estado = params.get('estado')
  const focus = params.get('ref')
  const [quotes, setQuotes] = useState<Quote[] | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    fetch('/api/admin/quotes', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setQuotes(j.quotes) }).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])
  const update = async (id: string, patch: Partial<Quote>) => {
    const r = await fetch('/api/admin/quotes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    if (r.ok) load(); else setError((await r.json()).error)
  }
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-black text-[#0B0B0D]">Pedidos de cotação</h1>
        <p className="text-sm text-[#64748B]">Pedidos feitos pelos visitantes nos planos «sob consulta» (revenda, dedicados, Microsoft 365, …).</p>
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {!quotes && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>}
      {quotes && !quotes.length && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center"><FileQuestion className="mx-auto text-[#94A3B8] mb-2" /><p className="text-sm text-[#334155]">Ainda não há pedidos de cotação.</p></div>
      )}
      {estado && STATUS[estado] && (
        <p className="text-sm text-[#334155]">A mostrar: <strong>{STATUS[estado]}</strong> · <Link href="/admin/quotes" className="underline">ver todos</Link></p>
      )}
      <ul className="space-y-3">
        {quotes?.filter(q => !estado || !STATUS[estado] || q.status === estado).map(q => (
          <li key={q.id} id={`quote-${q.reference}`} ref={el => { if (el && focus === q.reference) el.scrollIntoView({ block: 'center' }) }}
            className={`rounded-xl border bg-white p-4 ${focus === q.reference ? 'border-[#F5B700] ring-2 ring-[#F5B700]/40' : 'border-[#E5E7EB]'}`} data-testid="quote-row">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <p className="font-bold text-[#0B0B0D]">{q.reference} · {q.product_name ?? q.product_slug ?? 'Sem plano'}</p>
              <select aria-label={`Estado de ${q.reference}`} className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm" value={q.status} onChange={e => update(q.id, { status: e.target.value })}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <p className="text-sm text-[#334155] mt-1">{q.name}{q.company ? ` · ${q.company}` : ''} · <a className="underline" href={`mailto:${q.email}`}>{q.email}</a>{q.phone ? ` · ${q.phone}` : ''}</p>
            {q.message && <p className="text-sm text-[#64748B] mt-1 whitespace-pre-wrap">{q.message}</p>}
            <p className="text-xs text-[#94A3B8] mt-1">{new Date(q.created_at).toLocaleString('pt-PT')}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function QuotesPage() {
  return <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>}><QuotesInner /></Suspense>
}
