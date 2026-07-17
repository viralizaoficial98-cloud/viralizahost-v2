'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard, Download, CheckCircle2, Clock, AlertCircle, TrendingUp,
  Banknote, X, ChevronRight, Loader2, RefreshCw, Copy, Check,
  Building2, Upload, Eye, FileText, ArrowLeft, AlertTriangle,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string
  invoice_number: string
  order_id: string | null
  status: string
  currency: string
  subtotal: number
  discount: number
  tax: number
  total: number
  amount_paid: number
  outstanding: number
  due_date: string
  created_at: string
  notes: string | null
  items: any[]
  profiles?: { full_name: string; email: string }
}

interface Payment {
  id: string
  status: string
  method: string
  amount: number
  created_at: string
  transfer_ref?: string
  proof_url?: string
  proof_filename?: string
  rejection_reason?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAYABLE_STATUSES = ['pending', 'overdue', 'partially_paid', 'rejected', 'under_review']

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string; Icon: any }> = {
  paid:           { label: 'Pago',         bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)',  Icon: CheckCircle2 },
  pending:        { label: 'Pendente',     bg: 'rgba(245,183,0,0.08)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)',   Icon: Clock },
  overdue:        { label: 'Vencido',      bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)',   Icon: AlertCircle },
  under_review:   { label: 'Em análise',   bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)',  Icon: Eye },
  partially_paid: { label: 'Parcial',      bg: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: 'rgba(139,92,246,0.20)', Icon: Clock },
  rejected:       { label: 'Rejeitado',    bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)',   Icon: AlertCircle },
  cancelled:      { label: 'Cancelado',    bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)', Icon: AlertCircle },
  refunded:       { label: 'Reembolsado',  bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)',  Icon: CheckCircle2 },
  draft:          { label: 'Rascunho',     bg: '#F8FAFC',                color: '#94A3B8', border: '#E2E8F0',               Icon: FileText },
}

const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Banco BIC / Transferência', icon: Building2, sub: 'Transferência bancária' },
  { id: 'multicaixa',    label: 'Multicaixa Express',         icon: CreditCard, sub: 'Pagamento por Multicaixa' },
]

const BANK_INFO = {
  titular:    'VIRALIZA FÁCIL ANGOLA, LDA',
  coordenada: '005100002477517910141',
  banco:      'BIC — Banco BIC Angola',
}

type Step = 'select' | 'review' | 'method' | 'proof' | 'done'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number, currency: string) {
  if (currency === 'AKZ') return `${Number(amount).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz`
  if (currency === 'BRL') return `R$ ${Number(amount).toFixed(2)}`
  return `$ ${Number(amount).toFixed(2)}`
}

function fmtDate(d: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(d).toLocaleDateString('pt-PT', opts ?? { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(due: string) { return new Date(due) < new Date() }

// ── Sub-components ───────────────────────────────────────────────────────────

function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm"
      style={{ background: type === 'success' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${type === 'success' ? '#6EE7B7' : '#FCA5A5'}` }}
    >
      {type === 'success' ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                           : <AlertCircle  size={16} style={{ color: '#DC2626', flexShrink: 0 }} />}
      <p className="text-sm font-medium flex-1" style={{ color: type === 'success' ? '#065F46' : '#B91C1C' }}>{msg}</p>
      <button onClick={onClose}><X size={14} style={{ color: '#94A3B8' }} /></button>
    </motion.div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="p-1.5 rounded-lg transition-all hover:opacity-70"
      style={{ background: copied ? 'rgba(16,185,129,0.10)' : '#F3F4F6', border: '1px solid #E5E7EB' }}>
      {copied ? <Check size={13} style={{ color: '#059669' }} /> : <Copy size={13} style={{ color: '#6B7280' }} />}
    </button>
  )
}

function ProgressBar({ step }: { step: Step }) {
  const steps: Step[] = ['select', 'review', 'method', 'proof', 'done']
  const labels = ['Fatura', 'Rever', 'Pagamento', 'Comprovativo', 'Confirmação']
  const idx = steps.indexOf(step)
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
              style={i <= idx
                ? { background: 'linear-gradient(135deg,#F5B700,#D9A300)', color: '#0B0B0D' }
                : { background: '#F1F5F9', color: '#94A3B8' }}>
              {i < idx ? <Check size={11} /> : i + 1}
            </div>
            <span className="text-xs font-semibold hidden sm:block"
              style={{ color: i <= idx ? '#0B0B0D' : '#94A3B8' }}>{labels[i]}</span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-0.5 mx-1 rounded"
              style={{ background: i < idx ? '#F5B700' : '#F1F5F9' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialInvoices: Invoice[]
  totalPaid: number
  totalPending: number
  totalUnderReview: number
  nextDue: string | null
  currency: string
}

export default function BillingManager({
  initialInvoices, totalPaid, totalPending, totalUnderReview, nextDue, currency,
}: Props) {
  const [invoices, setInvoices]         = useState<Invoice[]>(initialInvoices)
  const [allInvoices, setAllInvoices]   = useState<Invoice[]>([])
  const [loadingAll, setLoadingAll]     = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Payment flow state
  const [step, setStep]                 = useState<Step>('select')
  const [payableInvoices, setPayable]   = useState<Invoice[]>([])
  const [loadingPayable, setLoadingPayable] = useState(false)
  const [selected, setSelected]         = useState<Invoice | null>(null)
  const [method, setMethod]             = useState('')
  const [paymentId, setPaymentId]       = useState('')
  const [creating, setCreating]         = useState(false)

  // Proof form
  const [file, setFile]                 = useState<File | null>(null)
  const [transferRef, setTransferRef]   = useState('')
  const [transferDate, setTransferDate] = useState('')
  const [payerName, setPayerName]       = useState('')
  const [payerBank, setPayerBank]       = useState('')
  const [declaredAmt, setDeclaredAmt]   = useState('')
  const [uploading, setUploading]       = useState(false)
  const fileInputRef                    = useRef<HTMLInputElement>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 5000)
  }

  // Load all invoices for the history table
  const loadAllInvoices = useCallback(async () => {
    setLoadingAll(true)
    try {
      const res  = await fetch('/api/client/billing/payable-invoices', { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      // Also load all invoices via dedicated route — for now use payable list as augmentation
      setPayable(data.invoices ?? [])
    } catch { /* silent */ } finally { setLoadingAll(false) }
  }, [])

  useEffect(() => { loadAllInvoices() }, [loadAllInvoices])

  // Open payment modal
  const openPayModal = async () => {
    setLoadingPayable(true)
    setStep('select')
    setSelected(null)
    setMethod('')
    setPaymentId('')
    setFile(null)
    setShowModal(true)

    try {
      const res  = await fetch('/api/client/billing/payable-invoices', { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      const list: Invoice[] = data.invoices ?? []
      setPayable(list)
      if (list.length === 1) {
        setSelected(list[0])
        setStep('review')
      }
    } catch { showToast('error', 'Erro ao carregar faturas.') }
    finally { setLoadingPayable(false) }
  }

  const closeModal = () => {
    setShowModal(false)
    setTimeout(() => { setStep('select'); setSelected(null); setMethod(''); setPaymentId(''); setFile(null) }, 300)
  }

  // Step 2→3: create payment intent
  const createIntent = async () => {
    if (!selected || !method) return
    setCreating(true)
    try {
      const res = await fetch(`/api/client/billing/invoices/${selected.id}/payment-intent`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.existing_payment_id) {
          showToast('error', `Já existe um pagamento ${data.existing_status} para esta fatura.`)
          return
        }
        throw new Error(data.error ?? 'Erro ao criar pagamento.')
      }
      setPaymentId(data.payment.id)
      if (['bank_transfer', 'multicaixa'].includes(method)) {
        setStep('proof')
      } else {
        showToast('error', 'Pagamento automático não configurado ainda.')
      }
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro.')
    } finally { setCreating(false) }
  }

  // Step 4: upload proof
  const uploadProof = async () => {
    if (!file || !selected || !paymentId) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('payment_id', paymentId)
      form.append('transfer_ref', transferRef)
      form.append('transfer_date', transferDate)
      form.append('payer_name', payerName)
      form.append('payer_bank', payerBank)
      form.append('declared_amount', declaredAmt)

      const res = await fetch(`/api/client/billing/invoices/${selected.id}/payment-proof`, {
        method: 'POST', credentials: 'include', body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar comprovativo.')
      setStep('done')
      await loadAllInvoices()
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao enviar comprovativo.')
    } finally { setUploading(false) }
  }

  const fmt = (n: number) => fmtCurrency(n, currency)

  const kpis = [
    { label: 'Total pago',       value: fmt(totalPaid),        accent: '#059669', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)', Icon: TrendingUp },
    { label: 'Pendente',         value: fmt(totalPending),     accent: '#F59E0B', bg: 'rgba(245,159,11,0.06)', border: 'rgba(245,159,11,0.15)', Icon: Clock },
    { label: 'Em análise',       value: fmt(totalUnderReview), accent: '#2563EB', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.15)', Icon: Eye },
    { label: nextDue ? 'Próxima cobrança' : 'Crédito', value: nextDue ? fmtDate(nextDue) : '—', accent: '#D9A300', bg: 'rgba(245,183,0,0.08)', border: 'rgba(245,183,0,0.20)', Icon: Banknote },
  ]

  return (
    <div className="space-y-7">
      <AnimatePresence>
        {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Financeiro</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Faturas, pagamentos e subscrições</p>
        </div>
        <button onClick={openPayModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:opacity-90 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <CreditCard size={16} /> Pagar Fatura
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-4" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.Icon size={12} style={{ color: s.accent }} />
              <span className="text-xs font-semibold" style={{ color: s.accent }}>{s.label}</span>
            </div>
            <div className="text-xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Invoice history */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
            <CreditCard size={15} style={{ color: '#EA580C' }} />
          </div>
          <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Histórico de Faturas</h2>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {invoices.length} fatura{invoices.length !== 1 ? 's' : ''}
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <CreditCard size={28} style={{ color: '#EA580C' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhuma fatura ainda</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>As suas faturas aparecerão aqui após a primeira subscrição</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
                  {['Nº Fatura', 'Vencimento', 'Valor', 'Em aberto', 'Estado', 'Ações'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const s       = STATUS_MAP[inv.status] ?? STATUS_MAP.pending
                  const Icon    = s.Icon
                  const payable = PAYABLE_STATUSES.includes(inv.status)
                  const over    = isOverdue(inv.due_date) && inv.status !== 'paid'
                  return (
                    <tr key={inv.id} style={{ borderBottom: i < invoices.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-xs" style={{ color: '#D9A300' }}>
                          {inv.invoice_number}
                        </div>
                        {inv.notes && <div className="text-xs mt-0.5 truncate max-w-[140px]" style={{ color: '#94A3B8' }}>{inv.notes}</div>}
                      </td>
                      <td className="px-5 py-4 text-xs" style={{ color: over ? '#DC2626' : '#94A3B8' }}>
                        {over && <AlertTriangle size={11} className="inline mr-1" style={{ verticalAlign: 'middle' }} />}
                        {fmtDate(inv.due_date)}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold" style={{ color: '#0B0B0D' }}>
                        {fmtCurrency(inv.total, inv.currency)}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold"
                        style={{ color: inv.outstanding > 0 ? '#DC2626' : '#059669' }}>
                        {inv.outstanding > 0 ? fmtCurrency(inv.outstanding, inv.currency) : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          <Icon size={10} /> {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {payable && (
                            <button onClick={() => { setSelected(inv); setStep('review'); setShowModal(true) }}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg text-black transition-all hover:opacity-80"
                              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
                              Pagar
                            </button>
                          )}
                          <button title="Descarregar PDF"
                            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                            style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
                            <Download size={13} style={{ color: '#6B7280' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Payment Modal ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) closeModal() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-xl rounded-2xl overflow-hidden"
              style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.22)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Modal header */}
              <div className="px-6 pt-5 pb-4 flex items-center justify-between shrink-0"
                style={{ borderBottom: '1px solid #F1F5F9' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
                    <CreditCard size={17} style={{ color: '#D9A300' }} />
                  </div>
                  <div>
                    <h3 className="font-black text-base" style={{ color: '#0B0B0D' }}>Pagar Fatura</h3>
                    {selected && <p className="text-xs mt-0.5 font-mono" style={{ color: '#94A3B8' }}>{selected.invoice_number}</p>}
                  </div>
                </div>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity">
                  <X size={18} style={{ color: '#94A3B8' }} />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 overflow-y-auto flex-1">
                <ProgressBar step={step} />

                {/* ── STEP: select ── */}
                {step === 'select' && (
                  <div className="space-y-3">
                    {loadingPayable ? (
                      <div className="space-y-3 animate-pulse">
                        {[0,1,2].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: '#F3F4F6' }} />)}
                      </div>
                    ) : payableInvoices.length === 0 ? (
                      <div className="py-10 text-center">
                        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                          <CheckCircle2 size={26} style={{ color: '#059669' }} />
                        </div>
                        <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>
                          Não existem faturas pendentes para pagamento.
                        </p>
                        <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
                          Todas as suas faturas estão em dia.
                        </p>
                        <button onClick={closeModal}
                          className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-80"
                          style={{ background: '#F3F4F6', color: '#374151' }}>
                          Fechar
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold mb-3" style={{ color: '#64748B' }}>
                          Selecione a fatura que deseja pagar:
                        </p>
                        {payableInvoices.map(inv => {
                          const s    = STATUS_MAP[inv.status] ?? STATUS_MAP.pending
                          const over = isOverdue(inv.due_date)
                          return (
                            <button key={inv.id} onClick={() => { setSelected(inv); setStep('review') }}
                              className="w-full text-left rounded-xl p-4 flex items-center gap-4 transition-all"
                              style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#F5B700'; (e.currentTarget as HTMLElement).style.background = 'rgba(245,183,0,0.04)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#F1F5F9'; (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}>
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
                                <FileText size={16} style={{ color: '#EA580C' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm font-mono" style={{ color: '#0B0B0D' }}>{inv.invoice_number}</div>
                                <div className="text-xs mt-0.5 flex flex-wrap gap-2" style={{ color: '#94A3B8' }}>
                                  <span>Venc: {fmtDate(inv.due_date)}</span>
                                  {over && <span style={{ color: '#DC2626' }}>● Vencido</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-black text-base" style={{ color: '#0B0B0D' }}>{fmtCurrency(inv.outstanding, inv.currency)}</div>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                              </div>
                              <ChevronRight size={14} style={{ color: '#CBD5E1' }} />
                            </button>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}

                {/* ── STEP: review ── */}
                {step === 'review' && selected && (
                  <div className="space-y-4">
                    <div className="rounded-xl p-4 space-y-3" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Fatura</span>
                        <span className="font-mono font-bold text-sm" style={{ color: '#D9A300' }}>{selected.invoice_number}</span>
                      </div>
                      {/* Items */}
                      {Array.isArray(selected.items) && selected.items.length > 0 && (
                        <div className="space-y-1.5">
                          {selected.items.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span style={{ color: '#64748B' }}>{item.name ?? item.description ?? 'Serviço'}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>
                              <span className="font-semibold" style={{ color: '#0B0B0D' }}>{fmtCurrency((item.unit_price ?? item.price ?? 0) * (item.quantity ?? 1), selected.currency)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }} className="space-y-1">
                        {selected.discount > 0 && (
                          <div className="flex justify-between text-xs" style={{ color: '#64748B' }}>
                            <span>Desconto</span><span>-{fmtCurrency(selected.discount, selected.currency)}</span>
                          </div>
                        )}
                        {selected.tax > 0 && (
                          <div className="flex justify-between text-xs" style={{ color: '#64748B' }}>
                            <span>Impostos</span><span>{fmtCurrency(selected.tax, selected.currency)}</span>
                          </div>
                        )}
                        {selected.amount_paid > 0 && (
                          <div className="flex justify-between text-xs" style={{ color: '#059669' }}>
                            <span>Já pago</span><span>-{fmtCurrency(selected.amount_paid, selected.currency)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-black text-lg pt-1" style={{ color: '#0B0B0D' }}>
                          <span>Saldo em aberto</span>
                          <span style={{ color: '#EA580C' }}>{fmtCurrency(selected.outstanding, selected.currency)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs p-3 rounded-xl"
                      style={{ background: 'rgba(245,183,0,0.06)', border: '1px solid rgba(245,183,0,0.15)', color: '#D9A300' }}>
                      <Clock size={13} style={{ flexShrink: 0 }} />
                      Vencimento: {fmtDate(selected.due_date)} {isOverdue(selected.due_date) ? '(VENCIDO)' : ''}
                    </div>
                    <button onClick={() => setStep('method')}
                      className="w-full py-3 rounded-xl font-bold text-black transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
                      Continuar para pagamento
                    </button>
                  </div>
                )}

                {/* ── STEP: method ── */}
                {step === 'method' && selected && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold" style={{ color: '#64748B' }}>Escolha o método de pagamento:</p>
                    {PAYMENT_METHODS.map(m => (
                      <button key={m.id} onClick={() => setMethod(m.id)}
                        className="w-full text-left rounded-xl p-4 flex items-center gap-4 transition-all"
                        style={{
                          background: method === m.id ? 'rgba(245,183,0,0.06)' : '#F8FAFC',
                          border: `2px solid ${method === m.id ? '#F5B700' : '#F1F5F9'}`,
                        }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: method === m.id ? 'rgba(245,183,0,0.15)' : 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.12)' }}>
                          <m.icon size={18} style={{ color: method === m.id ? '#D9A300' : '#6B7280' }} />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{m.label}</div>
                          <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{m.sub}</div>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: method === m.id ? '#F5B700' : '#E5E7EB' }}>
                          {method === m.id && <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F5B700' }} />}
                        </div>
                      </button>
                    ))}
                    <button onClick={createIntent}
                      disabled={!method || creating}
                      className="w-full py-3 rounded-xl font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
                      {creating ? <><Loader2 size={15} className="animate-spin" /> A criar…</> : 'Continuar'}
                    </button>
                  </div>
                )}

                {/* ── STEP: proof ── */}
                {step === 'proof' && selected && (
                  <div className="space-y-4">
                    {/* Bank details */}
                    {method === 'bank_transfer' && (
                      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(245,183,0,0.04)', border: '1px solid rgba(245,183,0,0.15)' }}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#D9A300' }}>Dados bancários</p>
                        {[
                          { label: 'Banco', value: BANK_INFO.banco },
                          { label: 'Titular', value: BANK_INFO.titular },
                          { label: 'IBAN / Coordenada', value: BANK_INFO.coordenada },
                          { label: 'Valor exato', value: fmtCurrency(selected.outstanding, selected.currency) },
                          { label: 'Referência', value: selected.invoice_number },
                        ].map(r => (
                          <div key={r.label} className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs" style={{ color: '#94A3B8' }}>{r.label}</div>
                              <div className="text-sm font-bold" style={{ color: '#0B0B0D' }}>{r.value}</div>
                            </div>
                            <CopyButton text={r.value} />
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                      Dados da transferência
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold block mb-1" style={{ color: '#64748B' }}>Ref. da transferência</label>
                        <input value={transferRef} onChange={e => setTransferRef(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ borderColor: '#E5E7EB' }} placeholder="Nº doc / ref…" />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1" style={{ color: '#64748B' }}>Data da transferência</label>
                        <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ borderColor: '#E5E7EB' }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold block mb-1" style={{ color: '#64748B' }}>Nome do ordenante</label>
                        <input value={payerName} onChange={e => setPayerName(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ borderColor: '#E5E7EB' }} placeholder="Nome…" />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1" style={{ color: '#64748B' }}>Banco de origem</label>
                        <input value={payerBank} onChange={e => setPayerBank(e.target.value)}
                          className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ borderColor: '#E5E7EB' }} placeholder="Banco…" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: '#64748B' }}>Valor transferido</label>
                      <input value={declaredAmt} onChange={e => setDeclaredAmt(e.target.value)}
                        type="number" step="0.01"
                        className="w-full border rounded-xl px-3 py-2 text-sm outline-none"
                        style={{ borderColor: '#E5E7EB' }}
                        placeholder={String(selected.outstanding)} />
                    </div>

                    {/* File upload */}
                    <div>
                      <label className="text-xs font-bold block mb-1.5" style={{ color: '#64748B' }}>
                        Comprovativo <span style={{ color: '#DC2626' }}>*</span>
                        <span className="font-normal ml-1" style={{ color: '#94A3B8' }}>(PNG, JPG, PDF — máx 10 MB)</span>
                      </label>
                      <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.pdf"
                        className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-xl py-4 flex flex-col items-center gap-2 transition-all"
                        style={{
                          background: file ? 'rgba(16,185,129,0.04)' : '#F8FAFC',
                          border: `2px dashed ${file ? '#6EE7B7' : '#E5E7EB'}`,
                        }}>
                        {file
                          ? <><CheckCircle2 size={20} style={{ color: '#059669' }} /><span className="text-sm font-semibold" style={{ color: '#059669' }}>{file.name}</span></>
                          : <><Upload size={20} style={{ color: '#94A3B8' }} /><span className="text-sm" style={{ color: '#94A3B8' }}>Clique para seleccionar ficheiro</span></>
                        }
                      </button>
                    </div>

                    <button onClick={uploadProof}
                      disabled={!file || uploading}
                      className="w-full py-3 rounded-xl font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
                      {uploading ? <><Loader2 size={15} className="animate-spin" /> A enviar…</> : <><Upload size={15} /> Enviar Comprovativo</>}
                    </button>
                  </div>
                )}

                {/* ── STEP: done ── */}
                {step === 'done' && (
                  <div className="py-8 text-center">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                      style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)' }}>
                      <CheckCircle2 size={38} style={{ color: '#059669' }} />
                    </motion.div>
                    <h3 className="font-black text-xl mb-2" style={{ color: '#0B0B0D' }}>Comprovativo enviado!</h3>
                    <p className="text-sm mb-1" style={{ color: '#64748B' }}>
                      O pagamento encontra-se em análise.
                    </p>
                    <p className="text-xs mb-6" style={{ color: '#94A3B8' }}>
                      A nossa equipa irá validar o pagamento e actualizar o estado da fatura em breve.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                      style={{ background: 'rgba(59,130,246,0.08)', color: '#2563EB', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <Eye size={14} /> Estado: Em análise
                    </div>
                    <div className="mt-5">
                      <button onClick={closeModal}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
                        Fechar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal footer nav */}
              {step !== 'select' && step !== 'done' && (
                <div className="px-6 pb-5 pt-2 shrink-0" style={{ borderTop: '1px solid #F8FAFC' }}>
                  <button
                    onClick={() => {
                      if (step === 'review') setStep(payableInvoices.length > 1 ? 'select' : 'select')
                      else if (step === 'method') setStep('review')
                      else if (step === 'proof') setStep('method')
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-70"
                    style={{ color: '#94A3B8' }}>
                    <ArrowLeft size={13} /> Voltar
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
