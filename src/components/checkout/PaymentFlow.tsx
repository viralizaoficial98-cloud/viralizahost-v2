'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, CheckCircle2, ChevronRight, Copy, Loader2, Lock, ShoppingCart, Upload } from 'lucide-react'
import { useCart, toApiLine } from '@/store/cartStore'
import { createAuthClient } from '@/lib/supabase/client'
import { PurchaseSteps, Summary, btnGhost, btnPrimary, card, input, kz, periodOf, renewalOf, useCartHydrated, useQuote } from './shared'

// Pagamento e confirmação (cliente com sessão e dados completos). Reaproveita o pagamento por
// transferência e a revisão do checkout anterior. Antes de criar a encomenda, o servidor volta a
// calcular preços, períodos e disponibilidade; a chave de idempotência impede encomendas duplicadas.

interface PayMethod { id: string; label: string; available: boolean; reason?: string; requiresProof?: boolean; bank?: Record<string, string | null> }
export interface CustomerSummary { email: string; name: string; phone: string; address: string; city: string; country: string; nif: string | null; company: string | null }

export function PaymentFlow({ customer, verified }: { customer: CustomerSummary; verified: boolean }) {
  const router = useRouter()
  const hydrated = useCartHydrated()
  const cart = useCart()
  const { quote, setQuote, loading, error: quoteError, refresh } = useQuote(cart.lines, hydrated && cart.lines.length > 0)
  const [stage, setStage] = useState<'pay' | 'review'>('pay')
  const [methods, setMethods] = useState<PayMethod[] | null>(null)
  const [method, setMethod] = useState('bank_transfer')
  const [proof, setProof] = useState<{ path: string; name: string } | null>(null)
  const [transferRef, setTransferRef] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [copied, setCopied] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [waited, setWaited] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetch('/api/checkout/payment-methods').then(r => r.json()).then(j => setMethods(j.methods ?? [])).catch(() => setMethods([])) }, [])
  // Carrinho vazio neste navegador: dá tempo à recuperação do carrinho guardado na conta
  useEffect(() => { const t = setTimeout(() => setWaited(true), 2500); return () => clearTimeout(t) }, [])

  const held = !!quote?.needsConfirmation
  const bank = methods?.find(m => m.id === 'bank_transfer')?.bank

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 20 * 1024 * 1024) { setUploadErr('Ficheiro demasiado grande (máx. 20 MB).'); return }
    setUploading(true); setUploadErr('')
    const now = new Date()
    const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { data, error } = await createAuthClient().storage.from('payment-proofs').upload(path, f)
    setUploading(false)
    if (error || !data) { setUploadErr(error?.message ?? 'Falha no envio.'); return }
    setProof({ path: data.path, name: f.name })
  }

  const submit = async () => {
    if (!quote) return
    setSubmitting(true); setSubmitError('')
    const idempotencyKey = cart.ensureIdempotencyKey()
    try {
      const res = await fetch('/api/checkout/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey, lines: cart.lines.map(toApiLine), acceptedTotal: quote.total, paymentMethod: method, proofFile: held ? null : proof?.path ?? null, transferRef: transferRef || null }),
      })
      const j = await res.json()
      if ((res.status === 401 || j.code === 'customer_incomplete') && j.next) { router.push(j.next); return }
      if (res.status === 409 && j.quote) { setQuote(j.quote); setSubmitError(j.error); return }
      if (!res.ok) { setSubmitError(j.error ?? 'Não foi possível concluir a encomenda.'); return }
      cart.clear()
      router.push(`/orders/${j.order.id}?nova=1`)
    } catch {
      setSubmitError('Falha de rede. A encomenda não foi duplicada: pode tentar de novo com segurança.')
    } finally { setSubmitting(false) }
  }

  if (!hydrated || (!cart.lines.length && !waited)) return <div className="flex justify-center py-16" role="status"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  if (!cart.lines.length) {
    return (
      <div className={`${card} max-w-xl mx-auto text-center py-10`}>
        <ShoppingCart className="mx-auto text-[#CCC] mb-3" size={36} />
        <h1 className="text-xl font-black mb-2">O carrinho está vazio</h1>
        <Link href="/dominios/pesquisar" className={btnPrimary}>Pesquisar domínio</Link>
      </div>
    )
  }

  return (
    <div>
      <PurchaseSteps current="Pagamento" />
      {verified && <p className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800 flex gap-2" role="status" data-testid="verified-banner"><CheckCircle2 size={16} className="shrink-0 mt-0.5" /> E-mail confirmado. A sua compra continua com o mesmo carrinho.</p>}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full space-y-5">
          <section className={card} aria-label="Titular">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="text-sm">
                <p className="text-xs font-black text-[#999] uppercase tracking-widest mb-1">Titular e facturação</p>
                <p className="font-bold text-[#0A0A0A]" data-testid="payment-customer">{customer.company || customer.name}</p>
                <p className="text-[#555]">{customer.email} · {customer.phone}</p>
                <p className="text-[#555]">{customer.address}, {customer.city} · {customer.country}{customer.nif ? ` · NIF ${customer.nif}` : ''}</p>
              </div>
              <Link href="/checkout/dados?editar=1" className="text-xs underline text-[#666]" data-testid="edit-customer">Alterar dados</Link>
            </div>
          </section>

          {stage === 'pay' ? (
            <section className={card} aria-labelledby="pay-title">
              <h1 id="pay-title" className="text-2xl font-black text-[#0A0A0A] mb-5">Pagamento</h1>
              {held && (
                <p className="mb-5 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3" data-testid="pay-after-confirmation">
                  Ainda não pague: há domínios a confirmar pela equipa. A encomenda fica registada sem cobrança; depois da confirmação, a factura fica disponível na Área do Cliente para pagar e enviar o comprovativo.
                </p>
              )}
              {!methods ? <Loader2 className="animate-spin text-[#F5B700]" /> : (
                <div className="grid sm:grid-cols-2 gap-3 mb-6" role="radiogroup" aria-label="Método de pagamento">
                  {methods.map(m => (
                    <button key={m.id} role="radio" aria-checked={method === m.id} disabled={!m.available} onClick={() => setMethod(m.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${method === m.id ? 'border-[#F5B700] bg-[#FFFBEB]' : 'border-[#E8E8E8] bg-white'} ${m.available ? 'hover:border-[#F5B700]/50' : 'opacity-60 cursor-not-allowed'}`}>
                      <p className="text-sm font-bold">{m.label}</p>
                      <p className="text-xs text-[#888] mt-0.5">{m.available ? 'Disponível' : `Indisponível — ${m.reason}`}</p>
                    </button>
                  ))}
                </div>
              )}
              {method === 'bank_transfer' && bank && !held && (
                <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 sm:p-5 space-y-3 mb-6">
                  <p className="text-sm font-bold">Dados para transferência — {bank.bank_name}</p>
                  {[['Titular', bank.account_holder], ['Conta / Coordenada', bank.account_number], ['IBAN', bank.iban], ['SWIFT', bank.swift]].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 bg-white border border-[#EEE] rounded-lg px-3 py-2">
                      <div className="min-w-0"><p className="text-[10px] font-black text-[#999] uppercase tracking-widest">{k}</p><p className="text-sm font-bold font-mono break-all">{v}</p></div>
                      <button className="text-[#888] hover:text-[#0A0A0A] p-1" aria-label={`Copiar ${k}`} onClick={() => { navigator.clipboard?.writeText(String(v)); setCopied(String(k)); setTimeout(() => setCopied(''), 1500) }}>{copied === k ? <Check size={14} /> : <Copy size={14} />}</button>
                    </div>
                  ))}
                  {bank.payment_instructions && <p className="text-xs text-[#666]">{bank.payment_instructions}</p>}
                  <p className="text-xs text-[#888]">A encomenda fica pendente até validarmos o comprovativo. Pode enviá-lo agora ou depois, na Área do Cliente.</p>
                  <input className={input} placeholder="Referência da transferência (opcional)" value={transferRef} onChange={e => setTransferRef(e.target.value)} />
                  <button className={`${btnGhost} w-full border-dashed`} onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : proof ? <Check size={14} className="text-green-600" /> : <Upload size={14} />}{proof ? `Comprovativo: ${proof.name}` : 'Enviar comprovativo (imagem/PDF)'}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={upload} />
                  {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
                </div>
              )}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                <Link href="/carrinho" className={btnGhost}>Voltar ao carrinho</Link>
                <button className={btnPrimary} disabled={!methods?.find(m => m.id === method && m.available) || !quote?.valid} onClick={() => { setStage('review'); window.scrollTo({ top: 0 }) }} data-testid="to-review">Rever encomenda <ChevronRight size={16} /></button>
              </div>
            </section>
          ) : (
            <section className={card} aria-labelledby="rev-title">
              <h1 id="rev-title" className="text-2xl font-black text-[#0A0A0A] mb-5">Rever e confirmar</h1>
              {!quote ? <Loader2 className="animate-spin text-[#F5B700]" /> : (
                <>
                  <ul className="divide-y divide-[#F0F0F0] mb-4" data-testid="review-lines">
                    {quote.lines.map(l => (
                      <li key={l.index} className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                        <span className="min-w-0 break-words">{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ''}
                          <span className="block text-xs text-[#888]">{periodOf(l)} · renova por {renewalOf(l)}{l.nameservers ? ` · NS ${l.nameservers.ns.join(', ')}` : ''}</span>
                          {l.error && <span className="block text-xs text-red-700">{l.error.message}</span>}
                        </span>
                        <strong className="whitespace-nowrap">{kz(l.lineTotal)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="text-sm space-y-1 mb-4">
                    <div className="flex justify-between"><span className="text-[#888]">Subtotal</span><span>{kz(quote.subtotal)}</span></div>
                    {quote.taxRate > 0 && <div className="flex justify-between"><span className="text-[#888]">{quote.taxLabel} ({quote.taxRate}%)</span><span>{kz(quote.tax)}</span></div>}
                    <div className="flex justify-between text-lg font-black"><span>{held ? 'Total (a pagar depois da confirmação)' : 'Total a pagar'}</span><span data-testid="review-total">{kz(quote.total)}</span></div>
                    <p className="text-xs text-[#888]">{held ? 'Sem cobrança agora: a equipa confirma primeiro a disponibilidade dos domínios.' : `Pagamento por transferência bancária${proof ? ' (comprovativo enviado)' : ' (comprovativo a enviar)'}. Os serviços são activados depois de confirmarmos o pagamento.`}</p>
                  </div>
                  <label className="flex items-start gap-2 text-sm mb-4">
                    <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1" data-testid="accept-terms" />
                    <span>Confirmo os serviços, os períodos e os valores de renovação indicados e aceito os <a href="/terms" target="_blank" className="underline">Termos de Serviço</a>.</span>
                  </label>
                </>
              )}
              {submitError && <p className="text-sm text-red-700 mb-4 flex gap-1" role="alert" data-testid="submit-error"><AlertCircle size={16} className="shrink-0" />{submitError}</p>}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
                <button className={btnGhost} onClick={() => setStage('pay')} disabled={submitting}>Voltar</button>
                <button className={btnPrimary} disabled={!accepted || submitting || !quote?.valid} onClick={submit} data-testid="confirm-order">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} {held ? 'Registar encomenda' : 'Confirmar encomenda'}
                </button>
              </div>
            </section>
          )}
          {quoteError && <p className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700" role="alert">{quoteError} <button className="underline font-bold" onClick={refresh}>Tentar novamente</button></p>}
        </div>
        <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-6"><Summary quote={quote} loading={loading} /></aside>
      </div>
    </div>
  )
}
