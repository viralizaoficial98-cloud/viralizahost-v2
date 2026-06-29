import { Metadata } from 'next'
import { CreditCard, Download } from 'lucide-react'

export const metadata: Metadata = { title: 'Financeiro' }

const invoices = [
  { id: 'INV-2025-001', description: 'Plano Business - Junho 2025', amount: 39.90, currency: 'BRL', status: 'paid', date: '01/06/2025' },
  { id: 'INV-2025-002', description: 'Domínio meusite.com - Renovação', amount: 49.90, currency: 'BRL', status: 'pending', date: '15/07/2025' },
]

const statusConfig: Record<string, { label: string; class: string }> = {
  paid: { label: 'Pago', class: 'bg-green-100 text-green-700' },
  pending: { label: 'Pendente', class: 'bg-yellow-100 text-yellow-700' },
  failed: { label: 'Falhou', class: 'bg-red-100 text-red-700' },
}

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Financeiro</h1>
        <p className="text-slate-500 mt-1">Gerencie suas faturas e formas de pagamento</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="text-sm text-slate-500 mb-1">Saldo em Aberto</div>
          <div className="text-3xl font-bold text-slate-900">R$ 49,90</div>
          <button className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-sm font-medium transition-colors">Pagar Agora</button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="text-sm text-slate-500 mb-1">Total Pago (2025)</div>
          <div className="text-3xl font-bold text-green-600">R$ 239,40</div>
          <div className="mt-4 text-xs text-slate-400">6 faturas pagas</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1"><CreditCard size={14} /> Forma de Pagamento</div>
          <div className="text-lg font-semibold text-slate-900">Mercado Pago</div>
          <button className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium">Alterar</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Histórico de Faturas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                {['Fatura','Descrição','Valor','Status','Data','Ação'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase px-6 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const status = statusConfig[inv.status]
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{inv.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{inv.description}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{inv.currency} {inv.amount.toFixed(2)}</td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.class}`}>{status.label}</span></td>
                    <td className="px-6 py-4 text-sm text-slate-500">{inv.date}</td>
                    <td className="px-6 py-4"><button className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><Download size={12} /> PDF</button></td>
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
