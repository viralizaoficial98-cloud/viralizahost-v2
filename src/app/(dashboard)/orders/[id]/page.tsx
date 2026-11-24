import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle2, Clock, FileText, LifeBuoy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PAYMENT_STATUS, TONE_CLASS, activationState, domainState, kz } from '@/lib/commerce/status'
import { BankTransferCard } from '@/components/billing/BankTransferCard'
import { loadBankDetails } from '@/lib/billing/load-bank-details'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Encomenda' }

const CYCLE: Record<string, string> = { monthly: 'mês', '3months': 'trimestre', '6months': '6 meses', '1year': 'ano', '2years': '2 anos', '3years': '3 anos' }
const SERVICE_STATUS: Record<string, string> = {
  pending: 'Aguarda confirmação do pagamento', in_progress: 'Em activação: a preparar o serviço', active: 'Activo',
  manual_required: 'Activação em tratamento pela equipa', failed: 'Activação falhou — a equipa vai resolver sem nova cobrança',
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string }> }) {
  const { id } = await params
  const { nova } = await searchParams
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')
  // Propriedade: a política de orders só devolve encomendas do próprio cliente
  const { data: order } = await db.from('orders')
    .select('id, order_number, created_at, amount, subtotal, tax_amount, tax_rate, payment_status, activation_status, hold_reason, status, payment_method, order_items(id, service_name, service_type, quantity, unit_price, line_total, renewal_price, billing_cycle, domain_name, domain_operation, availability, domain_case, proposed_domain, options)')
    .eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!order) notFound()
  const [{ data: invoice }, { data: services }, bank] = await Promise.all([
    db.from('invoices').select('id, invoice_number, status, total, due_date').eq('order_id', id).maybeSingle(),
    db.from('services').select('id, order_item_id, service_name, service_type, provisioning_status, domain, next_due_date').eq('order_id', id),
    loadBankDetails(),
  ])
  const p = PAYMENT_STATUS[order.payment_status] ?? PAYMENT_STATUS.unpaid
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const domainItems = (order.order_items ?? []).filter((i: any) => i.availability != null && i.domain_name)
  const pendingDomains = domainItems.filter((i: any) => i.availability === 'confirm').map((i: any) => i.domain_name)
  const reviewItems = domainItems.filter((i: any) => ['manual_review', 'alternative', 'refund_manual'].includes(i.domain_case))
  const legacyHeld = order.hold_reason === 'domain_confirmation' && invoice?.status === 'draft'
  const canPay = (order.payment_status === 'unpaid' || order.payment_status === 'failed') && order.status !== 'cancelled' && !legacyHeld && invoice && invoice.status !== 'cancelled'
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const a = activationState(order, domainItems)
  const box = 'rounded-2xl border border-[#E5E7EB] bg-white shadow-sm p-5'
  return (
    <div className="max-w-4xl space-y-5">
      {nova && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 flex gap-3">
          <CheckCircle2 className="text-green-600 shrink-0" />
          <div>
            <p className="font-bold text-[#0B0B0D]">Encomenda recebida</p>
            <p className="text-sm text-[#334155]">Guardámos a sua encomenda {order.order_number}. Os serviços são activados depois de confirmarmos o pagamento.</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-[#0B0B0D]">Encomenda {order.order_number}</h1>
        <div className="flex gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[p.tone]}`}>{p.label}</span>
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[a.tone]}`}>{a.label}</span>
        </div>
      </div>

      <div className={box}>
        <p className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3">Próximos passos</p>
        {order.hold_reason === 'domain_unavailable' ? (
          <p className="text-sm text-red-700 flex gap-2" data-testid="order-cancelled-domain"><Clock size={16} className="shrink-0" />O domínio pedido já não está livre, por isso a encomenda foi cancelada sem qualquer cobrança. Pode fazer uma nova encomenda com outro nome.</p>
        ) : legacyHeld ? (
          <p className="text-sm text-[#334155] flex gap-2" data-testid="order-held"><Clock size={16} className="text-amber-600 shrink-0" />A equipa está a confirmar a disponibilidade de {pendingDomains.join(', ')}. A factura desta encomenda fica disponível para pagamento depois dessa confirmação.</p>
        ) : (
          <div className="space-y-3">
            {reviewItems.map((it: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
              <div key={it.id} className="text-sm rounded-xl border border-red-200 bg-red-50 p-3 text-[#7F1D1D]" data-testid="order-domain-review">
                <p className="font-bold">O domínio {it.domain_name} não está disponível.</p>
                {it.domain_case === 'alternative' && it.proposed_domain
                  ? <p className="mt-1" data-testid="order-domain-proposal">A nossa equipa propõe <strong>{it.proposed_domain}</strong>, sem custo adicional. Responda num pedido de suporte para aceitar ou pedir o reembolso.</p>
                  : it.domain_case === 'refund_manual'
                    ? <p className="mt-1">O reembolso está a ser tratado pela nossa equipa. Recebe a confirmação na Área do Cliente.</p>
                    : <p className="mt-1">O seu pagamento está registado. A nossa equipa vai contactá-lo para propor outro domínio ou tratar o reembolso.</p>}
              </div>
            ))}
            {pendingDomains.length > 0 && (
              <p className="text-sm text-[#1E3A5F] flex gap-2" data-testid="order-domain-confirm"><Clock size={16} className="text-[#2563EB] shrink-0" />{order.payment_status === 'paid' ? `Pagamento confirmado. A nossa equipa vai confirmar a disponibilidade de ${pendingDomains.join(', ')} antes de o registar.` : 'Pode pagar agora. A nossa equipa vai confirmar a disponibilidade do domínio antes de o registar.'}</p>
            )}
            {canPay ? (
              <>
                <p className="text-sm text-[#334155] flex gap-2"><Clock size={16} className="text-amber-600 shrink-0" />
                  {order.payment_status === 'failed' ? 'O comprovativo foi recusado. ' : ''}Faça a transferência de <strong className="text-[#0B0B0D] mx-1">{kz(order.amount)}</strong> com a referência <strong className="text-[#0B0B0D] mx-1">{order.order_number}</strong> e envie o comprovativo na factura{invoice ? <Link href={`/billing/invoices/${invoice.id}`} className="underline ml-1">{invoice.invoice_number}</Link> : ''}.</p>
                {order.payment_method === 'bank_transfer' && <BankTransferCard bank={bank} amount={kz(order.amount)} reference={order.order_number} className="max-w-xl" />}
              </>
            ) : order.payment_status === 'proof_submitted' ? (
              <p className="text-sm text-[#334155] flex gap-2" data-testid="order-proof-pending"><Clock size={16} className="text-amber-600 shrink-0" />Recebemos o comprovativo: está por validar pela equipa. Recebe a confirmação na Área do Cliente.</p>
            ) : order.payment_status === 'paid' && !reviewItems.length && !pendingDomains.length ? (
              <p className="text-sm text-[#334155] flex gap-2"><CheckCircle2 size={16} className="text-green-600 shrink-0" />Pagamento confirmado. Acompanhe a activação de cada serviço abaixo.</p>
            ) : null}
          </div>
        )}
      </div>

      <div className={box}>
        <p className="text-xs font-black text-[#64748B] uppercase tracking-widest mb-3">Serviços</p>
        <ul className="divide-y divide-[#F1F5F9]">
          {(order.order_items ?? []).map((it: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const svc = (services ?? []).find((s: any) => s.order_item_id === it.id) // eslint-disable-line @typescript-eslint/no-explicit-any
            return (
              <li key={it.id} className="py-3 flex flex-wrap justify-between gap-2 text-sm">
                <div>
                  <p className="text-[#0B0B0D] font-bold">{it.service_name}{it.quantity > 1 ? ` × ${it.quantity}` : ''}</p>
                  {it.domain_name && <p className="text-xs text-[#64748B]">{it.domain_name}</p>}
                  {(() => { try { const o = typeof it.options === 'string' ? JSON.parse(it.options) : it.options; const t = o ? [o.location ? `Localização: ${o.location.label}` : '', o.image ? `Sistema: ${o.image.label}` : ''].filter(Boolean).join(' · ') : ''; return t ? <p className="text-xs text-[#64748B]" data-testid="order-item-options">{t}</p> : null } catch { return null } })()}
                  {it.availability != null && (() => { const d = domainState(it, svc); return <p className="mt-1"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${TONE_CLASS[d.tone]}`} data-testid="order-domain-state">Domínio: {d.label}</span></p> })()}
                  <p className="text-xs text-[#64748B]">Renova por {kz(it.renewal_price)} / {CYCLE[it.billing_cycle] ?? 'ano'}</p>
                  {svc && <p className="text-xs mt-1 text-amber-700" data-testid="order-service-status">{SERVICE_STATUS[svc.provisioning_status] ?? svc.provisioning_status}</p>}
                </div>
                <p className="text-[#0B0B0D] font-bold">{kz(it.line_total ?? it.unit_price)}</p>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-[#E5E7EB] pt-3 mt-2 text-sm space-y-1">
          {Number(order.tax_amount) > 0 && <div className="flex justify-between text-[#64748B]"><span>Imposto ({order.tax_rate}%)</span><span>{kz(order.tax_amount)}</span></div>}
          <div className="flex justify-between font-black text-[#0B0B0D]"><span>Total</span><span>{kz(order.amount)}</span></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {invoice && <Link href={`/billing/invoices/${invoice.id}`} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black bg-[#F5B700]"><FileText size={16} /> Factura {invoice.invoice_number}</Link>}
        <Link href="/tickets" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0B0B0D] border border-[#E5E7EB] bg-white"><LifeBuoy size={16} /> Pedir ajuda</Link>
      </div>
    </div>
  )
}
