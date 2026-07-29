'use client'
import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowLeft, Download, Printer, Eye, CheckCircle2, Clock, AlertCircle,
  FileText, CreditCard, Building2, Calendar, User, Globe, RefreshCw,
  Loader2,
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
  due_date: string | null
  issue_date: string | null
  paid_at: string | null
  notes: string | null
  proof_file: string | null
  items: any[]
  created_at: string
}

interface Profile {
  full_name: string | null
  email: string | null
  phone: string | null
  country: string | null
}

interface Order {
  id: string
  billing_cycle: string | null
  domain_name: string | null
  domain_action: string | null
  payment_method: string | null
  transfer_ref: string | null
  amount: number
  status: string
}

interface OrderItem {
  id: string
  service_name: string
  service_type: string
  price: number
  quantity: number
}

interface Payment {
  id: string
  status: string
  method: string
  amount: number
  currency: string
  created_at: string
  transfer_ref: string | null
  proof_url: string | null
  proof_filename: string | null
  rejection_reason: string | null
  payer_name: string | null
  payer_bank: string | null
  transfer_date: string | null
  declared_amount: number | null
}

interface Props {
  invoice: Invoice
  profile: Profile
  order: Order | null
  orderItems: OrderItem[]
  payments: Payment[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string; Icon: any }> = {
  paid:           { label: 'Pago',        color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.20)', Icon: CheckCircle2 },
  pending:        { label: 'Pendente',    color: '#D9A300', bg: 'rgba(245,183,0,0.08)',  border: 'rgba(245,183,0,0.25)',  Icon: Clock },
  under_review:   { label: 'Em análise', color: '#2563EB', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.20)', Icon: Eye },
  overdue:        { label: 'Vencido',    color: '#DC2626', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.20)',  Icon: AlertCircle },
  partially_paid: { label: 'Parcial',    color: '#7C3AED', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.20)', Icon: Clock },
  rejected:       { label: 'Rejeitado',  color: '#DC2626', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.20)',  Icon: AlertCircle },
  cancelled:      { label: 'Cancelado',  color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.20)', Icon: AlertCircle },
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Transferência BIC',
  multicaixa:    'Multicaixa Express',
  credit_card:   'Cartão de Crédito',
  paypal:        'PayPal',
  pix:           'PIX',
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  hosting:   'Hospedagem Web',
  email:     'Email Corporativo',
  domain:    'Domínio',
  vps:       'VPS',
  dedicated: 'Servidor Dedicado',
  reseller:  'Revenda',
  ssl:       'Certificado SSL',
  other:     'Serviço',
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly:   'Mensal',
  '6months': '6 Meses',
  '1year':   '1 Ano',
  '2years':  '2 Anos',
  '3years':  '3 Anos',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string) {
  if (currency === 'AKZ') return `${Number(n).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz`
  if (currency === 'BRL') return `R$ ${Number(n).toFixed(2)}`
  return `$ ${Number(n).toFixed(2)}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function InvoiceDetail({ invoice, profile, order, orderItems, payments }: Props) {
  const [loadingProof, setLoadingProof] = useState(false)
  const [loadingPdf,   setLoadingPdf]   = useState(false)
  const [toastMsg,     setToastMsg]     = useState<string | null>(null)

  const s = STATUS_MAP[invoice.status] ?? STATUS_MAP.pending
  const Icon = s.Icon

  // Build display items from orderItems, fallback to invoice.items JSONB
  const displayItems: { name: string; type: string; qty: number; unit: number; sub: number }[] =
    orderItems.length > 0
      ? orderItems.map(oi => ({
          name: oi.service_name,
          type: SERVICE_TYPE_LABELS[oi.service_type] ?? oi.service_type,
          qty:  oi.quantity,
          unit: Number(oi.price),
          sub:  Number(oi.price) * oi.quantity,
        }))
      : (Array.isArray(invoice.items) ? invoice.items : []).map((it: any) => ({
          name: it.name ?? it.description ?? 'Serviço',
          type: SERVICE_TYPE_LABELS[it.type ?? it.service_type ?? ''] ?? (it.type ?? ''),
          qty:  it.quantity ?? 1,
          unit: Number(it.unit_price ?? it.price ?? 0),
          sub:  Number(it.unit_price ?? it.price ?? 0) * (it.quantity ?? 1),
        }))

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 4000) }

  const openProof = async () => {
    setLoadingProof(true)
    try {
      const res  = await fetch(`/api/client/billing/invoices/${invoice.id}/proof`, { credentials: 'include' })
      const data = await res.json()
      if (data.url) window.open(data.url, '_blank')
      else showToast(data.error ?? 'Erro ao abrir comprovativo.')
    } catch { showToast('Erro ao abrir comprovativo.') }
    finally { setLoadingProof(false) }
  }

  const downloadPdf = async () => {
    setLoadingPdf(true)
    try {
      const res = await fetch(`/api/client/billing/invoices/${invoice.id}/pdf`, { credentials: 'include' })
      if (!res.ok) { showToast('Erro ao gerar PDF.'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `factura-${invoice.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch { showToast('Erro ao gerar PDF.') }
    finally { setLoadingPdf(false) }
  }

  const printPage = () => window.print()

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">

      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold"
          style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FCA5A5' }}>
          {toastMsg}
        </div>
      )}

      {/* Back + actions */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link href="/billing"
          className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#64748B' }}>
          <ArrowLeft size={15} /> Voltar ao Financeiro
        </Link>
        <div className="flex items-center gap-2">
          {invoice.proof_file && (
            <button onClick={openProof} disabled={loadingProof}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: 'rgba(59,130,246,0.08)', color: '#2563EB', border: '1px solid rgba(59,130,246,0.20)' }}>
              {loadingProof ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
              Ver Comprovativo
            </button>
          )}
          <button onClick={printPage}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' }}>
            <Printer size={13} /> Imprimir
          </button>
          <button onClick={downloadPdf} disabled={loadingPdf}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-black transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 12px rgba(245,183,0,0.30)' }}>
            {loadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Download PDF
          </button>
        </div>
      </div>

      {/* Invoice card */}
      <div className="rounded-2xl overflow-hidden print:shadow-none"
        style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 10px 40px rgba(15,23,42,0.08)' }}>

        {/* Yellow header bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg,#F5B700,#D9A300)' }} />

        {/* Header */}
        <div className="px-8 py-7 flex items-start justify-between gap-6"
          style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>ViralizaHost</div>
            <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>Hospedagem Web · Domínios · E-mails Corporativos</div>
            <div className="text-xs mt-3 space-y-0.5" style={{ color: '#64748B' }}>
              <div>suporte@viralizahost.com</div>
              <div>www.viralizahost.com</div>
              <div>+244 951 008 653</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black" style={{ color: '#F5B700', letterSpacing: 1 }}>FACTURA</div>
            <div className="text-sm font-mono font-bold mt-1" style={{ color: '#374151' }}>{invoice.invoice_number}</div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mt-2"
              style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
              <Icon size={11} /> {s.label}
            </span>
          </div>
        </div>

        {/* Billing parties */}
        <div className="px-8 py-6 grid grid-cols-2 gap-8" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#F5B700' }}>De</div>
            <div className="text-sm font-bold" style={{ color: '#0B0B0D' }}>VIRALIZA FÁCIL ANGOLA, LDA</div>
            <div className="text-xs mt-1 space-y-0.5" style={{ color: '#64748B' }}>
              <div>suporte@viralizahost.com</div>
              <div>www.viralizahost.com</div>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#F5B700' }}>Para</div>
            <div className="text-sm font-bold" style={{ color: '#0B0B0D' }}>{profile.full_name ?? 'Cliente'}</div>
            <div className="text-xs mt-1 space-y-0.5" style={{ color: '#64748B' }}>
              {profile.email  && <div>{profile.email}</div>}
              {profile.phone  && <div>{profile.phone}</div>}
              {profile.country && <div>{profile.country}</div>}
            </div>
          </div>
        </div>

        {/* Dates + metadata row */}
        <div className="px-8 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4" style={{ borderBottom: '1px solid #F1F5F9', background: '#F8FAFC' }}>
          {[
            { label: 'Data de Emissão',   value: fmtDate(invoice.issue_date ?? invoice.created_at), Icon: Calendar },
            { label: 'Data de Vencimento', value: fmtDate(invoice.due_date), Icon: Calendar },
            { label: 'Data de Pagamento',  value: invoice.paid_at ? fmtDate(invoice.paid_at) : '—', Icon: CheckCircle2 },
            { label: 'Método',             value: order?.payment_method ? (PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method) : '—', Icon: CreditCard },
          ].map(({ label, value, Icon: I }) => (
            <div key={label}>
              <div className="flex items-center gap-1 mb-1">
                <I size={11} style={{ color: '#F5B700' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{label}</span>
              </div>
              <div className="text-sm font-semibold" style={{ color: '#374151' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Order info */}
        {order && (order.domain_name || order.billing_cycle) && (
          <div className="px-8 py-4 flex items-center gap-6" style={{ borderBottom: '1px solid #F1F5F9' }}>
            {order.domain_name && (
              <div className="flex items-center gap-2">
                <Globe size={13} style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#64748B' }}>Domínio</span>
                <span className="text-sm font-bold font-mono" style={{ color: '#0B0B0D' }}>{order.domain_name}</span>
              </div>
            )}
            {order.billing_cycle && (
              <div className="flex items-center gap-2">
                <RefreshCw size={13} style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#64748B' }}>Período</span>
                <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{BILLING_CYCLE_LABELS[order.billing_cycle] ?? order.billing_cycle}</span>
              </div>
            )}
            {order.transfer_ref && (
              <div className="flex items-center gap-2">
                <FileText size={13} style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#64748B' }}>Referência</span>
                <span className="text-sm font-mono font-semibold" style={{ color: '#0B0B0D' }}>{order.transfer_ref}</span>
              </div>
            )}
          </div>
        )}

        {/* Items table */}
        <div className="px-8 py-6">
          <table className="w-full">
            <thead>
              <tr style={{ background: '#0B0B0D', borderRadius: 8 }}>
                {['Descrição', 'Tipo', 'Qtd', 'Preço Unit.', 'Subtotal'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide"
                    style={{ color: '#F5B700' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm" style={{ color: '#94A3B8' }}>
                    Sem itens
                  </td>
                </tr>
              ) : displayItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 1 ? '#FAFAFA' : '#FFFFFF' }}>
                  <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: '#0B0B0D' }}>{item.name}</td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: '#64748B' }}>{item.type || '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-center" style={{ color: '#374151' }}>{item.qty}</td>
                  <td className="px-4 py-3.5 text-sm text-right" style={{ color: '#374151' }}>{fmt(item.unit, invoice.currency)}</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-right" style={{ color: '#0B0B0D' }}>{fmt(item.sub, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 pb-6 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm" style={{ color: '#64748B' }}>
              <span>Subtotal</span><span>{fmt(invoice.subtotal, invoice.currency)}</span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-sm" style={{ color: '#059669' }}>
                <span>Desconto</span><span>- {fmt(invoice.discount, invoice.currency)}</span>
              </div>
            )}
            {Number(invoice.tax) > 0 && (
              <div className="flex justify-between text-sm" style={{ color: '#64748B' }}>
                <span>IVA / Imposto</span><span>{fmt(invoice.tax, invoice.currency)}</span>
              </div>
            )}
            {Number(invoice.amount_paid) > 0 && (
              <div className="flex justify-between text-sm" style={{ color: '#059669' }}>
                <span>Pago</span><span>- {fmt(invoice.amount_paid, invoice.currency)}</span>
              </div>
            )}
            <div className="flex justify-between items-center font-black text-base px-3 py-2.5 rounded-xl mt-2"
              style={{ background: '#0B0B0D', color: '#F5B700' }}>
              <span>TOTAL</span><span>{fmt(invoice.total, invoice.currency)}</span>
            </div>
            {invoice.outstanding > 0 && (
              <div className="flex justify-between text-sm font-bold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.06)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.15)' }}>
                <span>Em aberto</span><span>{fmt(invoice.outstanding, invoice.currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="px-8 pb-6">
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Notas</div>
            <div className="text-sm" style={{ color: '#64748B' }}>{invoice.notes}</div>
          </div>
        )}

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="px-8 pb-6" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="pt-5 mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>
              Histórico de Pagamentos
            </div>
            <div className="space-y-2">
              {payments.map(pay => {
                const ps = pay.status === 'approved' ? { label: 'Aprovado', color: '#059669', bg: 'rgba(16,185,129,0.08)' }
                         : pay.status === 'under_review' ? { label: 'Em análise', color: '#2563EB', bg: 'rgba(59,130,246,0.08)' }
                         : pay.status === 'rejected' ? { label: 'Rejeitado', color: '#DC2626', bg: 'rgba(239,68,68,0.08)' }
                         : { label: pay.status, color: '#6B7280', bg: '#F3F4F6' }
                return (
                  <div key={pay.id} className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                    style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                    <div className="flex items-center gap-3">
                      <CreditCard size={14} style={{ color: '#94A3B8' }} />
                      <div>
                        <div className="text-sm font-semibold" style={{ color: '#374151' }}>
                          {PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}
                          {pay.transfer_ref ? ` · Ref: ${pay.transfer_ref}` : ''}
                        </div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>
                          {fmtDate(pay.created_at)}
                          {pay.payer_name ? ` · ${pay.payer_name}` : ''}
                          {pay.payer_bank ? ` · ${pay.payer_bank}` : ''}
                        </div>
                        {pay.rejection_reason && (
                          <div className="text-xs mt-0.5" style={{ color: '#DC2626' }}>
                            Motivo: {pay.rejection_reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-sm font-bold" style={{ color: '#0B0B0D' }}>
                        {fmt(Number(pay.declared_amount ?? pay.amount), pay.currency ?? invoice.currency)}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: ps.bg, color: ps.color }}>
                        {ps.label}
                      </span>
                      {pay.proof_url && (
                        <button
                          onClick={async () => {
                            // For payments proof, fetch via invoice proof endpoint (which reads invoices.proof_file)
                            // Or open directly if it's a public URL — it's private bucket so use our endpoint
                            setLoadingProof(true)
                            try {
                              const res  = await fetch(`/api/client/billing/invoices/${invoice.id}/proof`, { credentials: 'include' })
                              const data = await res.json()
                              if (data.url) window.open(data.url, '_blank')
                            } catch {}
                            finally { setLoadingProof(false) }
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-70"
                          style={{ background: 'rgba(59,130,246,0.08)', color: '#2563EB', border: '1px solid rgba(59,130,246,0.15)' }}>
                          <Eye size={11} /> Comprovativo
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bank info (when pending) */}
        {['pending', 'overdue', 'partially_paid'].includes(invoice.status) && (
          <div className="mx-8 mb-6 rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(245,183,0,0.04)', border: '1px solid rgba(245,183,0,0.20)' }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#D9A300' }}>
              Dados para Pagamento por Transferência
            </div>
            {[
              ['Banco',     'BIC — Banco BIC Angola'],
              ['Titular',   'VIRALIZA FÁCIL ANGOLA, LDA'],
              ['Coordenada','005100002477517910141'],
              ['Referência', invoice.invoice_number],
              ['Valor Exacto', fmt(invoice.outstanding, invoice.currency)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#94A3B8' }}>{k}</span>
                <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 text-center text-xs" style={{ borderTop: '1px solid #F1F5F9', color: '#CBD5E1', background: '#F8FAFC' }}>
          ViralizaHost · suporte@viralizahost.com · www.viralizahost.com
        </div>
      </div>

      {/* Back link bottom */}
      <div className="print:hidden">
        <Link href="/billing"
          className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: '#64748B' }}>
          <ArrowLeft size={15} /> Voltar ao Financeiro
        </Link>
      </div>
    </div>
  )
}
