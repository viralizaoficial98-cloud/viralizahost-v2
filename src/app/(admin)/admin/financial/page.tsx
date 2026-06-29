import { Metadata } from 'next'

export const metadata: Metadata = { title: 'Financeiro - Admin' }

export default function AdminFinancialPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Gestão Financeira</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Receita Mensal', value: 'R$ 47.240,00', sub: 'Junho 2025', color: 'text-green-600' },
          { label: 'Faturas Pendentes', value: 'R$ 3.890,00', sub: '23 faturas', color: 'text-yellow-600' },
          { label: 'Reembolsos', value: 'R$ 290,00', sub: '2 reembolsos', color: 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="text-sm text-slate-500 mb-1">{stat.label}</div>
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
