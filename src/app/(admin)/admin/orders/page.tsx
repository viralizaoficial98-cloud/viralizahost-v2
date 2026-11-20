'use client'
import { useEffect, useState } from 'react'
import { Check, ExternalLink, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react'
import { ACTIVATION_STATUS, PAYMENT_STATUS, TONE_CLASS, kz } from '@/lib/commerce/status'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Service = { id: string; order_item_id: string; service_name: string; service_type: string; provisioning_status: string; provisioning_error: string | null; provisioning_attempts: number; external_ref: string | null; domain: string | null }
type Order = {
  id: string; order_number: string | null; created_at: string; status: string; payment_status: string; activation_status: string; hold_reason?: string | null
  amount: number; payment_method: string | null; transfer_ref: string | null; proof_url: string | null
  profiles: { full_name: string; email: string } | null
  order_items: { id: string; service_name: string; quantity: number; line_total: number | null; unit_price: number | null; renewal_price: number | null; billing_cycle: string | null; domain_name: string | null; availability?: string | null; years?: number | null }[]
  services: Service[]; invoice: { invoice_number: string; status: string } | null
}
type Filter = 'todo' | 'activation' | 'done' | 'all'

const SVC_LABEL: Record<string, string> = { pending: 'Pendente', in_progress: 'Em curso', active: 'Activo', manual_required: 'Manual', failed: 'Falhou' }

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('todo')
  const [acting, setActing] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/orders'); const j = await res.json()
      if (!res.ok || j.error) setError(j.error ?? `HTTP ${res.status}`)
      setOrders(j.orders ?? [])
    } catch { setError('Falha de rede.') } finally { setLoading(false) }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial dos dados
  useEffect(() => { load() }, [])

  async function act(key: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setActing(key); setNotice(null)
    try {
      const res = await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) setNotice({ ok: false, text: j.error ?? 'Falhou.' })
      else if (j.provisioning) {
        const counts = j.provisioning.reduce((a: any, r: any) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})
        setNotice({ ok: true, text: `Pagamento ${j.payment === 'paid' ? 'confirmado' : 'já estava confirmado'}. Activação: ${Object.entries(counts).map(([k, v]) => `${v} ${SVC_LABEL[k] ?? k}`).join(', ')}.` })
      } else if (j.result) setNotice({ ok: j.ok, text: `${j.result.status === 'active' ? 'Activado' : 'Não activado'}: ${j.result.message}` })
      else setNotice({ ok: true, text: 'Feito.' })
      await load()
    } catch { setNotice({ ok: false, text: 'Falha de rede.' }) } finally { setActing(null) }
  }

  const filtered = orders.filter(o => filter === 'all' ? true
    : filter === 'todo' ? o.status !== 'rejected' && o.payment_status !== 'paid'
    : filter === 'activation' ? o.payment_status === 'paid' && !['active', 'cancelled'].includes(o.activation_status)
    : o.activation_status === 'active' || o.status === 'rejected')
  const tabs: [Filter, string][] = [['todo', 'Por pagar / validar'], ['activation', 'Activação pendente'], ['done', 'Concluídas'], ['all', 'Todas']]

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A0A0A]">Encomendas</h1>
          <p className="text-sm text-[#888] mt-1">Validar pagamentos e acompanhar a activação dos serviços</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E8E8E8] text-sm text-[#555] hover:border-[#F5B700]"><RefreshCw size={14} /> Actualizar</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-4 py-2 rounded-xl text-sm font-bold ${filter === k ? 'bg-[#F5B700] text-black' : 'bg-white border border-[#E8E8E8] text-[#555]'}`}>
            {label} <span className="opacity-60">({orders.filter(o => k === 'all' ? true : k === 'todo' ? o.status !== 'rejected' && o.payment_status !== 'paid' : k === 'activation' ? o.payment_status === 'paid' && !['active', 'cancelled'].includes(o.activation_status) : o.activation_status === 'active' || o.status === 'rejected').length})</span>
          </button>
        ))}
      </div>
      {notice && <div role="status" className={`mb-4 p-3 rounded-xl text-sm ${notice.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{notice.text}</div>}
      {error && <div className="mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-700">{error}</div>}
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>
        : filtered.length === 0 ? <div className="text-center py-16 text-[#888] bg-white rounded-2xl border border-[#E8E8E8]">Nenhuma encomenda nesta lista.</div>
        : (
          <ul className="space-y-4">
            {filtered.map(o => {
              const p = PAYMENT_STATUS[o.payment_status] ?? PAYMENT_STATUS.unpaid
              const a = ACTIVATION_STATUS[o.activation_status] ?? ACTIVATION_STATUS.pending
              return (
                <li key={o.id} className="bg-white border border-[#E8E8E8] rounded-2xl p-5" data-testid="admin-order">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[#0A0A0A]">{o.order_number ?? o.id.slice(0, 8)} · {kz(o.amount)}</p>
                      <p className="text-xs text-[#888]">{new Date(o.created_at).toLocaleString('pt-PT')} · {o.profiles?.full_name ?? '—'} ({o.profiles?.email ?? 'sem perfil'}){o.invoice ? ` · Factura ${o.invoice.invoice_number}` : ''}</p>
                      {o.transfer_ref && <p className="text-xs text-[#555] mt-1">Ref. transferência: {o.transfer_ref}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[p.tone]}`}>{p.label}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[a.tone]}`}>{a.label}</span>
                      {o.status === 'rejected' && <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-50 text-red-700">Cancelada</span>}
                    </div>
                  </div>
                  <table className="w-full text-sm mt-4">
                    <tbody>
                      {o.order_items.map(it => {
                        const s = o.services.find(x => x.order_item_id === it.id)
                        return (
                          <tr key={it.id} className="border-t border-[#F3F3F3] align-top">
                            <td className="py-2 pr-2">{it.service_name}{it.quantity > 1 ? ` × ${it.quantity}` : ''}{it.domain_name ? <span className="block text-xs text-[#888]">{it.domain_name}</span> : null}
                              {it.availability === 'confirm' && (
                                <span className="mt-1 flex flex-wrap items-center gap-1" data-testid="domain-confirm">
                                  <span className="text-xs font-bold text-amber-800">Disponibilidade a confirmar:</span>
                                  <button disabled={!!acting} onClick={() => act(it.id + 'ok', { action: 'domain_availability', orderItemId: it.id, available: true }, `Confirma que ${it.domain_name} está livre? O cliente passa a poder pagar.`)} className="px-2 py-0.5 rounded bg-green-600 text-white text-xs">Livre</button>
                                  <button disabled={!!acting} onClick={() => act(it.id + 'no', { action: 'domain_availability', orderItemId: it.id, available: false }, `${it.domain_name} está ocupado? A encomenda é cancelada sem cobrança.`)} className="px-2 py-0.5 rounded bg-red-600 text-white text-xs">Ocupado</button>
                                </span>
                              )}
                              {it.availability === 'confirmed' && <span className="block text-xs text-green-700">Disponibilidade confirmada</span>}
                            </td>
                            <td className="py-2 pr-2 whitespace-nowrap">{kz(it.line_total ?? it.unit_price)}</td>
                            <td className="py-2 pr-2">
                              {s && <span className="text-xs font-bold">{SVC_LABEL[s.provisioning_status] ?? s.provisioning_status}{s.external_ref ? ` · ${s.external_ref}` : ''}</span>}
                              {s?.provisioning_error && <span className="block text-xs text-[#B45309]">{s.provisioning_error}</span>}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              {s && o.payment_status === 'paid' && s.provisioning_status !== 'active' && (
                                <span className="inline-flex gap-1">
                                  <button disabled={!!acting} onClick={() => act(s.id + 'p', { action: 'provision', serviceId: s.id })} className="px-2 py-1 rounded-lg border border-[#E8E8E8] text-xs hover:border-[#F5B700]" title="Repetir activação automática (sem nova cobrança)">
                                    {acting === s.id + 'p' ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                  </button>
                                  <button disabled={!!acting} onClick={() => { const ref = window.prompt('Referência da activação manual (ex.: utilizador, IP, n.º no registrador):') ?? ''; act(s.id + 'm', { action: 'mark_active', serviceId: s.id, externalRef: ref || null, notes: 'Activação manual' }) }} className="px-2 py-1 rounded-lg bg-green-600 text-white text-xs">Activo</button>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {o.proof_url && <a href={o.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#2563EB] underline"><ExternalLink size={14} /> Ver comprovativo</a>}
                    {o.payment_status !== 'paid' && o.status !== 'rejected' && (
                      <>
                        <button disabled={!!acting} onClick={() => act(o.id + 'a', { action: 'approve', orderId: o.id }, `Confirmar o pagamento de ${kz(o.amount)} e activar os serviços?`)} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold">
                          {acting === o.id + 'a' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar pagamento
                        </button>
                        {o.payment_status === 'proof_submitted' && (
                          <button disabled={!!acting} onClick={() => { const reason = window.prompt('Motivo da rejeição do comprovativo:'); if (reason) act(o.id + 'r', { action: 'reject_proof', orderId: o.id, reason }) }} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-red-300 text-red-700 text-sm font-bold">
                            <X size={14} /> Rejeitar comprovativo
                          </button>
                        )}
                        <button disabled={!!acting} onClick={() => act(o.id + 'c', { action: 'cancel', orderId: o.id }, 'Cancelar esta encomenda?')} className="px-4 py-2 rounded-xl border border-[#E8E8E8] text-sm text-[#555]">Cancelar</button>
                      </>
                    )}
                    {o.payment_status === 'paid' && !['active', 'cancelled'].includes(o.activation_status) && (
                      <button disabled={!!acting} onClick={() => act(o.id + 'a', { action: 'approve', orderId: o.id })} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-[#E8E8E8] text-sm"><RotateCcw size={14} /> Repetir activação</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}
