import { Metadata } from 'next'
import { CreditCard, TrendingUp, Clock, CheckCircle2, AlertCircle, Package } from 'lucide-react'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic   = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Financeiro — Admin ViralizaHost' }

const thStyle = {
  padding: '12px 20px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700,
  color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  background: '#F8FAFC', borderBottom: '1px solid #F1F5F9',
}
const card = {
  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' as const,
}

const ORDER_STATUS: Record<string, { label: string; bg: string; color: string; border: string }> = {
  paid:                  { label: 'Pago',         bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  aprovado:              { label: 'Aprovado',      bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  pending:               { label: 'Pendente',      bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.20)' },
  aguardando_confirmacao:{ label: 'Aguardando',    bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.20)' },
  under_review:          { label: 'Em análise',    bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
  cancelled:             { label: 'Cancelado',     bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  refunded:              { label: 'Reembolsado',   bg: '#F1F5F9',                color: '#94A3B8', border: '#E2E8F0' },
}

function fmtKz(amount: number) {
  return `Kz ${amount.toLocaleString('pt-PT')}`
}

async function fetchData() {
  try { await requireAdminRole() } catch { redirect('/login') }

  const db  = createAdminWriteClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [{ data: orders }, { data: invoices }] = await Promise.all([
    db.from('orders')
      .select('id, amount, status, created_at, profiles(full_name, email), order_items(name, quantity)')
      .order('created_at', { ascending: false })
      .limit(200),
    db.from('invoices')
      .select('id, amount, status, due_date, created_at, profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const ordList = (orders ?? []) as any[]
  const invList = (invoices ?? []) as any[]

  const paidOrders   = ordList.filter(o => ['paid', 'aprovado'].includes(o.status))
  const pendOrders   = ordList.filter(o => ['pending', 'aguardando_confirmacao', 'under_review'].includes(o.status))
  const monthRevenue = paidOrders
    .filter(o => new Date(o.created_at) >= monthStart)
    .reduce((s: number, o: any) => s + Number(o.amount ?? 0), 0)
  const totalRevenue = paidOrders.reduce((s: number, o: any) => s + Number(o.amount ?? 0), 0)
  const pendingAmount = pendOrders.reduce((s: number, o: any) => s + Number(o.amount ?? 0), 0)

  const invPending = invList.filter(i => i.status === 'pending').length
  const invOverdue = invList.filter(i => i.status === 'overdue').length

  return { ordList, invList, stats: { totalRevenue, monthRevenue, pendingAmount, invPending, invOverdue, ordTotal: ordList.length } }
}

export default async function AdminFinancialPage() {
  const { ordList, invList, stats } = await fetchData()

  const kpis = [
    {
      label: 'Receita do mês',
      value: fmtKz(stats.monthRevenue),
      sub: `Total acumulado: ${fmtKz(stats.totalRevenue)}`,
      subColor: '#059669',
      Icon: TrendingUp,
      iconColor: '#059669',
      iconBg: 'rgba(16,185,129,0.10)',
    },
    {
      label: 'Pedidos pendentes',
      value: fmtKz(stats.pendingAmount),
      sub: `${ordList.filter((o: any) => ['pending', 'aguardando_confirmacao', 'under_review'].includes(o.status)).length} pedidos aguardando`,
      subColor: '#94A3B8',
      Icon: Clock,
      iconColor: '#D9A300',
      iconBg: 'rgba(245,183,0,0.10)',
    },
    {
      label: 'Faturas vencidas',
      value: String(stats.invOverdue),
      sub: `${stats.invPending} pendentes de pagamento`,
      subColor: '#94A3B8',
      Icon: AlertCircle,
      iconColor: '#DC2626',
      iconBg: 'rgba(239,68,68,0.10)',
    },
  ]

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(234,88,12,0.10)', border: '1px solid rgba(234,88,12,0.20)' }}>
          <CreditCard size={20} style={{ color: '#EA580C' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Gestão Financeira</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Receitas, faturas e pagamentos da plataforma</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: 20 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: k.iconBg }}>
                <k.Icon size={13} style={{ color: k.iconColor }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{k.label}</span>
            </div>
            <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>{k.value}</div>
            <div className="text-xs font-medium mt-1" style={{ color: k.subColor }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <Package size={16} style={{ color: '#EA580C' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Pedidos Recentes</span>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {ordList.length}
          </span>
        </div>
        {ordList.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Nenhum pedido</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Os pedidos aparecerão aqui quando forem criados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Cliente', 'Itens', 'Valor', 'Data', 'Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordList.slice(0, 50).map((order: any, i: number) => {
                  const s = ORDER_STATUS[order.status] ?? { label: order.status, bg: '#F1F5F9', color: '#94A3B8', border: '#E2E8F0' }
                  const profile   = order.profiles as any
                  const items     = (order.order_items as any[]) ?? []
                  const itemLabel = items.length > 0
                    ? items.map((it: any) => `${it.name}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`).join(', ')
                    : '—'
                  return (
                    <tr key={order.id} style={{ borderBottom: i < Math.min(ordList.length, 50) - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>{profile?.full_name ?? '—'}</div>
                        {profile?.email && <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{profile.email}</div>}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#64748B', maxWidth: 200 }}>
                        <span className="line-clamp-1">{itemLabel}</span>
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 14, color: '#0B0B0D' }}>
                        {fmtKz(Number(order.amount ?? 0))}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#94A3B8' }}>
                        {new Date(order.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices table */}
      {invList.length > 0 && (
        <div style={card}>
          <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <CreditCard size={16} style={{ color: '#EA580C' }} />
            <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Faturas</span>
            <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#F1F5F9', color: '#64748B' }}>
              {invList.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Cliente', 'Valor', 'Vencimento', 'Status'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invList.slice(0, 50).map((inv: any, i: number) => {
                  const invStatusMap: Record<string, { label: string; bg: string; color: string; border: string; Icon: any }> = {
                    paid:    { label: 'Pago',     bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)', Icon: CheckCircle2 },
                    pending: { label: 'Pendente', bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.20)', Icon: Clock },
                    overdue: { label: 'Vencido',  bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)', Icon: AlertCircle },
                  }
                  const s = invStatusMap[inv.status] ?? invStatusMap.pending
                  const profile = inv.profiles as any
                  return (
                    <tr key={inv.id} style={{ borderBottom: i < Math.min(invList.length, 50) - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>{profile?.full_name ?? '—'}</div>
                        {profile?.email && <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{profile.email}</div>}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 14, color: '#0B0B0D' }}>
                        {fmtKz(Number(inv.amount ?? 0))}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 12, color: '#94A3B8' }}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          <s.Icon size={10} /> {s.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
