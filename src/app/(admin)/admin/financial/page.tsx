import { Metadata } from 'next'
import { CreditCard, TrendingUp, TrendingDown, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Financeiro — Admin ViralizaHost' }

const invoices = [
  { client: 'Maria Santos', plan: 'Business', amount: 'Kz 39.900', status: 'Pago',    date: '01 Jun 2026', method: 'Multicaixa' },
  { client: 'João Silva',   plan: 'Pro',      amount: 'Kz 79.900', status: 'Pago',    date: '01 Jun 2026', method: 'Transferência' },
  { client: 'Ana Costa',    plan: 'Starter',  amount: 'Kz 19.900', status: 'Pendente',date: '01 Jul 2026', method: 'Referência' },
  { client: 'Carlos Mendes',plan: 'Business', amount: 'Kz 39.900', status: 'Vencido', date: '01 Mai 2026', method: 'Multicaixa' },
]

const statusConfig: Record<string, { bg: string; color: string; border: string; icon: React.ElementType }> = {
  Pago:     { bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)',  icon: CheckCircle2 },
  Pendente: { bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.20)',   icon: Clock },
  Vencido:  { bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)',   icon: AlertCircle },
}

const thStyle = { padding: '12px 20px', textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }
const card    = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', overflow: 'hidden' as const }

export default function AdminFinancialPage() {
  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(234,88,12,0.10)', border: '1px solid rgba(234,88,12,0.20)' }}>
          <CreditCard size={20} style={{ color: '#EA580C' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Gestão Financeira</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Receitas, faturas e pagamentos da plataforma</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div style={{ ...card, padding: 20 }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} style={{ color: '#059669' }} />
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Receita Mensal — Jun 2026</span>
          </div>
          <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Kz 47.240.000</div>
          <div className="text-xs font-semibold mt-1" style={{ color: '#059669' }}>+15% vs mês anterior</div>
        </div>
        <div style={{ ...card, padding: 20 }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} style={{ color: '#D9A300' }} />
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Faturas Pendentes</span>
          </div>
          <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Kz 3.890.000</div>
          <div className="text-xs" style={{ color: '#94A3B8' }}>23 faturas em aberto</div>
        </div>
        <div style={{ ...card, padding: 20 }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} style={{ color: '#DC2626' }} />
            <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Reembolsos</span>
          </div>
          <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Kz 290.000</div>
          <div className="text-xs" style={{ color: '#94A3B8' }}>2 reembolsos este mês</div>
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <CreditCard size={16} style={{ color: '#EA580C' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Faturas Recentes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>{['Cliente', 'Plano', 'Valor', 'Método', 'Data', 'Status', 'Ações'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const s = statusConfig[inv.status]
                const StatusIcon = s.icon
                return (
                  <tr key={i} style={{ borderBottom: i < invoices.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                    <td style={{ padding: '14px 20px', fontWeight: 600, fontSize: 14, color: '#0B0B0D' }}>{inv.client}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}>{inv.plan}</span>
                    </td>
                    <td style={{ padding: '14px 20px', fontWeight: 700, fontSize: 14, color: '#0B0B0D' }}>{inv.amount}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#64748B' }}>{inv.method}</td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: '#94A3B8' }}>{inv.date}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                        <StatusIcon size={10} /> {inv.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <button className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Ver</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
