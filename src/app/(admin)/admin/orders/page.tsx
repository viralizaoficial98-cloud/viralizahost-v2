'use client'
import { useEffect, useState } from 'react'
import { Check, X, Loader2, Clock, RefreshCw, ExternalLink } from 'lucide-react'

type Order = {
  id: string
  created_at: string
  status: string
  payment_method: string | null
  amount: number
  domain_name: string | null
  transfer_ref: string | null
  proof_file: string | null
  profiles: { full_name: string; email: string } | null
  order_items: { service_name: string; service_type: string; price: number; quantity: number }[]
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  aguardando_confirmacao: { label: 'Aguardando',  color: '#F5B700' },
  pending:                { label: 'Pendente',    color: '#888' },
  active:                 { label: 'Ativo',       color: '#22C55E' },
  rejected:               { label: 'Rejeitado',   color: '#EF4444' },
  cancelled:              { label: 'Cancelado',   color: '#EF4444' },
}

function fmtPrice(n: number) {
  return `Kz ${n.toLocaleString('pt-AO', { minimumFractionDigits: 0 })}`
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'aguardando_confirmacao' | 'active' | 'rejected'>('aguardando_confirmacao')
  const [acting, setActing] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/orders')
    const data = await res.json()
    setOrders(data.orders ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function act(orderId: string, action: 'approve' | 'reject') {
    setActing(orderId + action)
    await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action }),
    })
    await load()
    setActing(null)
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const tabs: { key: typeof filter; label: string }[] = [
    { key: 'aguardando_confirmacao', label: 'Aguardando' },
    { key: 'active',                 label: 'Aprovados' },
    { key: 'rejected',               label: 'Rejeitados' },
    { key: 'all',                    label: 'Todos' },
  ]

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A0A0A]">Pedidos</h1>
          <p className="text-sm text-[#888] mt-1">Gerir pedidos e aprovar pagamentos BIC</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E8E8E8] text-sm text-[#555] hover:border-[#F5B700] transition-colors">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F5F5F5] rounded-xl p-1 mb-6 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter === t.key ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#888] hover:text-[#555]'}`}
          >
            {t.label}
            {t.key !== 'all' && (
              <span className="ml-1.5 text-xs font-black">
                ({orders.filter(o => o.status === t.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-[#F5B700]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#AAA]">
          <Clock size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Nenhum pedido nesta categoria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => {
            const st = STATUS_LABEL[order.status] ?? { label: order.status, color: '#888' }
            const isPending = order.status === 'aguardando_confirmacao'
            return (
              <div key={order.id} className="bg-white border border-[#E8E8E8] rounded-2xl p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#AAA]">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: `${st.color}18`, color: st.color }}
                      >
                        {st.label}
                      </span>
                      <span className="text-xs text-[#AAA]">{new Date(order.created_at).toLocaleDateString('pt-AO')}</span>
                    </div>

                    {/* Client */}
                    <p className="font-bold text-[#0A0A0A]">
                      {order.profiles?.full_name ?? '—'}
                      <span className="text-[#888] font-normal ml-2 text-sm">{order.profiles?.email}</span>
                    </p>

                    {/* Services */}
                    <div className="flex flex-wrap gap-2">
                      {order.order_items.map((item, i) => (
                        <span key={i} className="text-xs bg-[#F5F5F5] px-2 py-1 rounded-lg text-[#555]">
                          {item.service_name} × {item.quantity}
                        </span>
                      ))}
                      {order.domain_name && (
                        <span className="text-xs bg-[#FFF8E1] px-2 py-1 rounded-lg text-[#888]">
                          🌐 {order.domain_name}
                        </span>
                      )}
                    </div>

                    {/* Payment details */}
                    <div className="flex flex-wrap gap-4 text-xs text-[#888] mt-1">
                      <span>Pagamento: <strong className="text-[#555]">{order.payment_method?.replace('_', ' ') ?? '—'}</strong></span>
                      {order.transfer_ref && <span>Ref: <strong className="text-[#555]">{order.transfer_ref}</strong></span>}
                      {order.proof_file && (
                        <a href={order.proof_file} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-[#F5B700] hover:underline font-semibold">
                          <ExternalLink size={11} /> Ver comprovativo
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right: amount + actions */}
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <p className="text-xl font-black text-[#0A0A0A]">{fmtPrice(order.amount)}</p>
                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => act(order.id, 'reject')}
                          disabled={!!acting}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {acting === order.id + 'reject' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                          Rejeitar
                        </button>
                        <button
                          onClick={() => act(order.id, 'approve')}
                          disabled={!!acting}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F5B700] text-[#0A0A0A] text-sm font-black hover:bg-[#D9A300] transition-colors disabled:opacity-40"
                        >
                          {acting === order.id + 'approve' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Aprovar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
