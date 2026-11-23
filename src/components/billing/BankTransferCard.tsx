'use client'
import { useRef, useState } from 'react'
import { Check, Copy, Landmark } from 'lucide-react'
import type { BankDetails } from '@/lib/billing/bank-details'

// Cartão visual com os dados da transferência bancária (checkout, encomenda e Área do Cliente).
// Representa os DADOS DA TRANSFERÊNCIA: não tem número de cartão, validade nem CVV. Texto seleccionável;
// «Copiar IBAN» e «Copiar entidade» com confirmação anunciada a leitores de ecrã (aria-live).

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true }
  } catch { /* tenta o método alternativo */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}

export function BankTransferCard({ bank, amount, reference, referenceLabel = 'Referência do pedido', className = '' }: {
  bank: BankDetails
  /** Montante a transferir (depois de criar a encomenda / na factura) */
  amount?: string | null
  /** Referência do pedido para identificar a transferência */
  reference?: string | null
  /** «Referência do pedido» (encomenda) ou «Referência da factura» (Área do Cliente) */
  referenceLabel?: string
  className?: string
}) {
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const account = bank.iban ?? bank.accountNumber ?? ''
  const accountLabel = bank.iban ? 'IBAN' : 'N.º de conta'
  const copy = async (key: string, label: string, text: string) => {
    const ok = await copyText(text)
    setCopied({ key, ok })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2500)
    return label
  }
  const DONE: Record<string, string> = { iban: `${accountLabel} copiado.`, holder: 'Entidade copiada.', ref: 'Referência copiada.' }
  const status = copied ? (copied.ok ? DONE[copied.key] : 'Não foi possível copiar. Seleccione o texto e copie manualmente.') : ''
  const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 border border-white/25 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors'

  return (
    <section aria-label={`Transferência bancária — ${bank.bank}`} data-testid="bank-card"
      className={`relative overflow-hidden rounded-2xl text-white shadow-[0_12px_32px_rgba(160,16,32,0.28)] ${className}`}
      style={{ background: 'linear-gradient(135deg, #D7192E 0%, #B3121F 48%, #7E0A15 100%)' }}>
      {/* Desenho decorativo (sem dados) */}
      <div aria-hidden className="absolute -right-16 -top-20 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0) 70%)' }} />
      <div aria-hidden className="absolute -left-10 -bottom-24 w-56 h-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.22), rgba(0,0,0,0) 70%)' }} />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] sm:text-sm font-bold tracking-wide" data-testid="bank-card-label">Transferência bancária — {bank.bank}</p>
          <Landmark aria-hidden size={26} className="shrink-0 text-white/80" />
        </div>

        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">{accountLabel}</dt>
            <dd className="mt-1 font-mono text-[15px] min-[380px]:text-lg sm:text-[22px] font-bold tracking-wide break-all select-text" data-testid="bank-card-iban">{account}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Entidade</dt>
            <dd className="mt-1 text-sm sm:text-base font-bold uppercase select-text" data-testid="bank-card-holder">{bank.holder}</dd>
          </div>
          {(amount || reference) && (
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4 pt-4 border-t border-white/20">
              {amount && <div>
                <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Montante</dt>
                <dd className="mt-1 text-lg font-black select-text" data-testid="bank-card-amount">{amount}</dd>
              </div>}
              {reference && <div>
                <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">{referenceLabel}</dt>
                <dd className="mt-1 font-mono text-base font-bold select-text" data-testid="bank-card-reference">{reference}</dd>
              </div>}
            </div>
          )}
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => copy('iban', accountLabel, account)} data-testid="copy-iban">
            {copied?.key === 'iban' && copied.ok ? <Check size={14} /> : <Copy size={14} />} Copiar {accountLabel === 'IBAN' ? 'IBAN' : 'n.º de conta'}
          </button>
          <button type="button" className={btn} onClick={() => copy('holder', 'Entidade', bank.holder)} data-testid="copy-holder">
            {copied?.key === 'holder' && copied.ok ? <Check size={14} /> : <Copy size={14} />} Copiar entidade
          </button>
          {reference && <button type="button" className={btn} onClick={() => copy('ref', 'Referência', reference)} data-testid="copy-reference">
            {copied?.key === 'ref' && copied.ok ? <Check size={14} /> : <Copy size={14} />} Copiar referência
          </button>}
        </div>
        <p role="status" aria-live="polite" className="min-h-[1.25rem] mt-2 text-xs font-semibold text-white" data-testid="copy-status">{status}</p>
        {reference && <p className="text-[11px] text-white/80">Indique a referência {reference} no descritivo da transferência.</p>}
      </div>
    </section>
  )
}
