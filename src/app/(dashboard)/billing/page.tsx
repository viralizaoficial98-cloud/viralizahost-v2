import { Metadata } from 'next'
import { CreditCard, Download, CheckCircle2, Clock, AlertCircle, TrendingUp, Banknote } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Financeiro — ViralizaHost' }

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

const statusMap: Record<string, { label: string; bg: string; color: string; border: string; Icon: typeof CheckCircle2 }> = {
  paid:      { label: 'Pago',        bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)',  Icon: CheckCircle2 },
  pending:   { label: 'Pendente',    bg: 'rgba(245,183,0,0.08)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)',   Icon: Clock },
  overdue:   { label: 'Vencido',     bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)',   Icon: AlertCircle },
  cancelled: { label: 'Cancelado',   bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)', Icon: AlertCircle },
  refunded:  { label: 'Reembolsado', bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)',  Icon: CheckCircle2 },
}

async function fetchBillingData(userId: string) {
  const supabase = await createClient()
  const [invoicesRes, profileRes, clientRes] = await Promise.allSettled([
    supabase.from('invoices').select('*').eq('profile_id', userId).order('created_at', { ascending: false }),
    supabase.from('profiles').select('currency').eq('id', userId).single(),
    supabase.from('clients').select('credit_balance').eq('profile_id', userId).single(),
  ])
  return {
    invoices: invoicesRes.status === 'fulfilled' ? ((invoicesRes.value.data ?? []) as any[]) : [],
    currency: profileRes.status === 'fulfilled' ? ((profileRes.value.data as any)?.currency ?? 'USD') : 'USD',
    creditBalance: clientRes.status === 'fulfilled' ? ((clientRes.value.data as any)?.credit_balance ?? 0) : 0,
  }
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { invoices, currency, creditBalance } = await fetchBillingData(user.id)

  const fmt = (n: number) =>
    currency === 'BRL' ? `R$ ${n.toFixed(2)}` :
    currency === 'AKZ' ? `${n.toFixed(0)} Kz` :
    `$ ${n.toFixed(2)}`

  const totalPaid    = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.total), 0)
  const nextDue      = invoices.filter(i => i.status === 'pending').sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Financeiro</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Faturas, pagamentos e subscrições</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <CreditCard size={16} /> Pagar Fatura
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total pago',       value: fmt(totalPaid),    accent: '#059669', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)', Icon: TrendingUp },
          { label: 'Pendente',         value: fmt(totalPending), accent: '#F59E0B', bg: 'rgba(245,159,11,0.06)', border: 'rgba(245,159,11,0.15)', Icon: Clock },
          { label: creditBalance ? 'Crédito disponível' : 'Próxima cobrança',
            value: creditBalance ? fmt(creditBalance) : nextDue ? new Date(nextDue.due_date).toLocaleDateString('pt-BR') : '—',
            accent: '#D9A300', bg: 'rgba(245,183,0,0.08)', border: 'rgba(245,183,0,0.20)', Icon: Banknote },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="flex items-center gap-1.5 mb-1">
              <s.Icon size={13} style={{ color: s.accent }} />
              <span className="text-xs font-semibold" style={{ color: s.accent }}>{s.label}</span>
            </div>
            <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Invoices table */}
      <div style={card}>
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

        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {['Nº Fatura', 'Descrição', 'Vencimento', 'Valor', 'Estado', ''].map((h, i) => (
                    <th key={h} className={`px-6 py-3 text-left text-xs font-semibold ${i === 1 ? 'hidden sm:table-cell' : ''} ${i === 2 ? 'hidden md:table-cell' : ''} ${i === 3 ? 'text-right' : ''} ${i === 4 || i === 5 ? 'text-center' : ''}`}
                      style={{ color: '#64748B' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any, i: number) => {
                  const s = statusMap[inv.status] ?? statusMap.pending
                  const Icon = s.Icon
                  const due = new Date(inv.due_date).toLocaleDateString('pt-BR')
                  return (
                    <tr key={inv.id} style={{ borderBottom: i < invoices.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                      <td className="px-6 py-4 text-sm font-mono font-bold" style={{ color: '#D9A300' }}>{inv.invoice_number}</td>
                      <td className="px-6 py-4 text-sm hidden sm:table-cell" style={{ color: '#64748B' }}>{inv.notes ?? 'Fatura de serviço'}</td>
                      <td className="px-6 py-4 text-sm hidden md:table-cell" style={{ color: '#94A3B8' }}>{due}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right" style={{ color: '#0B0B0D' }}>{fmt(Number(inv.total))}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                          <Icon size={10} /> {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {inv.status === 'pending' ? (
                          <button className="text-xs font-bold px-3 py-1.5 rounded-lg text-black"
                            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
                            Pagar
                          </button>
                        ) : (
                          <button style={{ color: '#94A3B8' }}>
                            <Download size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <CreditCard size={28} style={{ color: '#EA580C' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhuma fatura ainda</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>As suas faturas aparecerão aqui após a primeira subscrição</p>
          </div>
        )}
      </div>
    </div>
  )
}
