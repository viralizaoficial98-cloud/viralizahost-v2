import { Metadata } from 'next'
import { CreditCard, TrendingUp, TrendingDown, Download, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Financeiro — Admin ViralizaHost' }

const invoices = [
  { client: 'Maria Santos', plan: 'Business', amount: 'R$ 39,90', status: 'Pago', date: '01 Jun 2026', method: 'Cartão' },
  { client: 'João Silva', plan: 'Pro', amount: 'R$ 79,90', status: 'Pago', date: '01 Jun 2026', method: 'PayPal' },
  { client: 'Ana Costa', plan: 'Starter', amount: 'R$ 19,90', status: 'Pendente', date: '01 Jul 2026', method: 'PIX' },
  { client: 'Carlos Mendes', plan: 'Business', amount: 'R$ 39,90', status: 'Vencido', date: '01 Mai 2026', method: 'Cartão' },
]

const statusConfig: Record<string, { class: string; icon: React.ElementType }> = {
  'Pago': { class: 'bg-green-400/10 text-green-400 border-green-400/20', icon: CheckCircle2 },
  'Pendente': { class: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', icon: Clock },
  'Vencido': { class: 'bg-red-400/10 text-red-400 border-red-400/20', icon: AlertCircle },
}

export default function AdminFinancialPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Gestão Financeira</h1>
        <p className="text-gray-500 text-sm mt-1">Receitas, faturas e pagamentos da plataforma</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-dark rounded-xl border border-green-400/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-green-400" />
            <span className="text-xs text-gray-600">Receita Mensal — Jun 2026</span>
          </div>
          <div className="text-2xl font-black text-white">R$ 47.240,00</div>
          <div className="text-xs text-green-400 mt-1">+15% vs mês anterior</div>
        </div>
        <div className="glass-dark rounded-xl border border-yellow-400/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-yellow-400" />
            <span className="text-xs text-gray-600">Faturas Pendentes</span>
          </div>
          <div className="text-2xl font-black text-white">R$ 3.890,00</div>
          <div className="text-xs text-gray-600 mt-1">23 faturas em aberto</div>
        </div>
        <div className="glass-dark rounded-xl border border-red-400/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-xs text-gray-600">Reembolsos</span>
          </div>
          <div className="text-2xl font-black text-white">R$ 290,00</div>
          <div className="text-xs text-gray-600 mt-1">2 reembolsos este mês</div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <CreditCard size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Faturas Recentes</h2>
          <button className="ml-auto flex items-center gap-1.5 text-xs text-gray-600 hover:text-yellow-400 transition-colors px-3 py-1.5 bg-[#1A1A1A] rounded-lg">
            <Download size={12} /> Exportar CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1A1A]">
                {['Cliente', 'Plano', 'Valor', 'Método', 'Data', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {invoices.map((inv, i) => {
                const s = statusConfig[inv.status]
                const StatusIcon = s.icon
                return (
                  <tr key={i} className="hover:bg-[#111] transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-white">{inv.client}</td>
                    <td className="px-5 py-4"><span className="badge-yellow text-xs px-2 py-0.5 rounded-full">{inv.plan}</span></td>
                    <td className="px-5 py-4 text-sm font-bold text-white">{inv.amount}</td>
                    <td className="px-5 py-4 text-xs text-gray-500">{inv.method}</td>
                    <td className="px-5 py-4 text-xs text-gray-600">{inv.date}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 w-fit ${s.class}`}>
                        <StatusIcon size={10} /> {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-xs text-yellow-400 hover:text-yellow-300 font-medium transition-colors">Ver</button>
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
