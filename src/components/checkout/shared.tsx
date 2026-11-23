'use client'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Check, ChevronRight, Loader2 } from 'lucide-react'
import { useCart, toApiLine, type CartLine, type Cycle, type DomainMode } from '@/store/cartStore'

// Peças comuns ao carrinho, à configuração do domínio e ao checkout (mesmo aspecto ViralizaHost).

export interface QuoteLine {
  index: number; type: 'product' | 'domain' | 'renewal'; slug?: string; name: string; serviceType: string
  cycle?: Cycle; months?: number; quantity: number; quantityUnit?: string | null; maxQuantity?: number
  unitPrice: number; lineTotal: number; renewalPrice: number; domain?: string; domainMode?: DomainMode
  operation?: 'register' | 'transfer' | 'renew'; extension?: string
  availability?: { status: 'available' | 'unavailable' | 'confirm'; available: boolean; verified: boolean; note?: string }; years?: number
  nameservers?: { useDefault: boolean; ns: string[] }
  cycles?: { cycle: Cycle; months: number; price: number; renewal: number }[]
  error?: { code: string; message: string }
}
export interface Quote { currency: 'AKZ'; lines: QuoteLine[]; subtotal: number; taxRate: number; taxLabel: string; tax: number; total: number; valid: boolean; needsConfirmation?: boolean }

export const CYCLE_LABEL: Record<Cycle, string> = { monthly: 'Mensal', '3months': 'Trimestral', '6months': 'Semestral', '1year': 'Anual', '2years': '2 anos', '3years': '3 anos' }
export const CYCLE_PER: Record<Cycle, string> = { monthly: 'mês', '3months': 'trimestre', '6months': '6 meses', '1year': 'ano', '2years': '2 anos', '3years': '3 anos' }
export const yearsLabel = (y: number) => `${y} ${y === 1 ? 'ano' : 'anos'}`

export const kz = (n: number) => `Kz ${Number(n).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ /g, ' ')}`
export const card = 'bg-white border border-[#E8E8E8] rounded-2xl p-5 sm:p-6 shadow-sm'
export const btnPrimary = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-[#0A0A0A] bg-[#F5B700] hover:bg-[#E5A800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
export const btnGhost = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-[#555] border border-[#E8E8E8] bg-white hover:border-[#F5B700] disabled:opacity-50 transition-colors'
export const input = 'w-full border border-[#E2E2E2] rounded-xl px-3.5 py-3 text-sm text-[#0A0A0A] bg-white focus:outline-none focus:border-[#F5B700] focus:ring-2 focus:ring-[#F5B700]/20'
export const label = 'block text-sm font-semibold text-[#333]'

/** true depois de ler o carrinho do localStorage (evita diferenças entre servidor e navegador). */
export function useCartHydrated() {
  return useSyncExternalStore(cb => useCart.persist.onFinishHydration(cb), () => useCart.persist.hasHydrated(), () => false)
}

/** Cotação do servidor (preços, períodos, disponibilidade, impostos) com pequena espera entre alterações. */
export function useQuote(lines: CartLine[], enabled = true) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const body = useMemo(() => JSON.stringify({ lines: lines.map(toApiLine) }), [lines])
  const seq = useRef(0)
  const refresh = useCallback(async () => {
    const my = ++seq.current
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
      const j = await res.json()
      if (my !== seq.current) return
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`)
      setQuote(j.quote)
    } catch (e) {
      if (my === seq.current) setError((e as Error).message === 'Failed to fetch' ? 'Sem ligação. Verifique a internet e tente novamente.' : (e as Error).message || 'Falha ao calcular os preços.')
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [body])
  useEffect(() => { if (!enabled) return; const t = setTimeout(refresh, 300); return () => clearTimeout(t) }, [refresh, enabled])
  return { quote, setQuote, loading, error, refresh }
}

/** Período de um item: anos (domínios) ou ciclo (serviços). */
export function periodOf(l: QuoteLine) {
  if (l.type === 'domain') return l.operation === 'transfer' ? 'Transferência (inclui 1 ano)' : yearsLabel(l.years ?? 1)
  return l.cycle ? CYCLE_LABEL[l.cycle] : '—'
}
export function renewalOf(l: QuoteLine) {
  if (l.type === 'domain') return `${kz(l.renewalPrice)}/ano`
  return l.cycle ? `${kz(l.renewalPrice)}/${CYCLE_PER[l.cycle]}` : kz(l.renewalPrice)
}

export function Summary({ quote, loading, title = 'Resumo' }: { quote: Quote | null; loading: boolean; title?: string }) {
  return (
    <div className={card} data-testid="cart-summary">
      <p className="text-xs font-black text-[#999] uppercase tracking-widest mb-4">{title}</p>
      {!quote ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div> : (
        <>
          <ul className="space-y-3 mb-4">
            {quote.lines.filter(l => !l.error).map(l => (
              <li key={l.index} className="flex justify-between gap-3 text-sm">
                <span className="text-[#333] min-w-0 break-words">{l.name}{l.quantity > 1 ? ` × ${l.quantity}` : ''}<span className="block text-xs text-[#999]">{periodOf(l)} · renova por {renewalOf(l)}</span></span>
                <span className="font-bold whitespace-nowrap">{kz(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-[#F0F0F0] pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[#888]">Subtotal</span><span data-testid="summary-subtotal">{kz(quote.subtotal)}</span></div>
            {quote.taxRate > 0 && <div className="flex justify-between"><span className="text-[#888]">{quote.taxLabel} ({quote.taxRate}%)</span><span>{kz(quote.tax)}</span></div>}
            <div className="flex justify-between gap-3 text-base font-black pt-1"><span>{quote.needsConfirmation ? "Total (pago após confirmação)" : "Total a pagar agora"}</span><span data-testid="summary-total">{kz(quote.total)}</span></div>
            {quote.needsConfirmation && <p className="text-[11px] text-amber-800 mt-1" data-testid="summary-held">Há domínios a confirmar pela equipa: o pagamento só é pedido depois dessa confirmação.</p>}
            {quote.taxRate === 0 && <p className="text-[11px] text-[#999]">Sem impostos aplicados.</p>}
          </div>
          {loading && <p className="text-xs text-[#999] mt-2 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> A actualizar…</p>}
        </>
      )}
    </div>
  )
}

export const PURCHASE_STEPS = ['Domínio', 'Configuração', 'Carrinho', 'Dados', 'Pagamento'] as const
export function PurchaseSteps({ current, steps = PURCHASE_STEPS }: { current: string; steps?: readonly string[] }) {
  const at = steps.indexOf(current)
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs sm:text-sm mb-6" aria-label="Passos da compra">
      {steps.map((s, i) => {
        const done = i < at, active = i === at
        return (
          <li key={s} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${done ? 'bg-[#0A0A0A] text-white' : active ? 'bg-[#F5B700] text-[#0A0A0A]' : 'bg-[#EFEFEF] text-[#999]'}`}>{done ? <Check size={13} /> : i + 1}</span>
            <span className={active ? 'font-bold text-[#0A0A0A]' : 'text-[#888]'}>{s}</span>
            {i < steps.length - 1 && <ChevronRight size={14} className="text-[#CCC]" />}
          </li>
        )
      })}
    </ol>
  )
}
