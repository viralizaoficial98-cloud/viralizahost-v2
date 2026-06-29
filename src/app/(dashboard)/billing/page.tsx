import { Metadata } from 'next'
import { CreditCard, Download, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react'

export const metadata: Metadata = { title: 'Financeiro — ViralizaHost' }

const invoices = [
  { id: 'INV-2026-006', description: 'Plano Business — Junho 2026', amount: 'R$ 39,90', status: 'Pago', date: '01 Jun 2026' },
  { id: 'INV-2026-005', description: 'Renovação meusite.com', amount: 'R$ 49,90', status: 'Pago', date: '15 Mai 2026' },
  { id: 'INV-2026-004', description: 'Plano Starter — Maio 2026', amount: 'R$ 19,90', status: 'Pago', date: '01 Mai 2026' },
  { id: 'INV-2026-007', description: 'Plano Business — Julho 2026', amount: 'R$ 39,90', status: 'Pendente', date: '01 Jul 2026' },
]

const statusConfig: Record<string, { class: string; icon: React.ElementType }> = {
  'Pago': { class: 'bg-green-400/10 text-green-400 border-green-400/20', icon: CheckCircle2 },
  'Pendente': { class: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20', icon: Clock },
  'Vencido': { class: 'bg-red-400/10 text-red-400 border-red-400/20', icon: AlertCircle },
}

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Faturas, pagamentos e subscrições</p>
        </div>
        <button className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold">
          <CreditCard size={16} /> Adicionar Método
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-dark rounded-xl border border-green-400/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-400" />
            <span className="text-xs text-gray-600">Total pago este ano</span>
          </div>
          <div className="text-2xl font-black text-white">R$ 349,50</div>
        </div>
        <div className="glass-dark rounded-xl border border-yellow-400/20 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-yellow-400" />
            <span className="text-xs text-gray-600">Pendente</span>
          </div>
          <div className="text-2xl font-black text-white">R$ 39,90</div>
        </div>
        <div className="glass-dark rounded-xl border border-[#222] p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard size={14} className="text-gray-500" />
            <span className="text-xs text-gray-600">Próxima cobrança</span>
          </div>
          <div className="text-2xl font-black text-white">01 Jul 2026</div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#FFC107]/10 p-5">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><CreditCard size={16} className="text-yellow-400" /> Métodos de Pagamento</h3>
        <div className="flex items-center gap-4 p-4 bg-[#111] border border-[#1A1A1A] rounded-xl">
          <div className="w-12 h-8 bg-[#1A1A1A] border border-[#333] rounded-lg flex items-center justify-center">
            <CreditCard size={16} className="text-yellow-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Cartão terminando em 4242</div>
            <div className="text-xs text-gray-600">Visa · Expira 12/2027</div>
          </div>
          <span className="ml-auto badge-yellow text-xs px-2 py-0.5 rounded-full">Principal</span>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] overflow-hidden">
        <div className="p-5 border-b border-[#1A1A1A] flex items-center gap-2">
          <CreditCard size={16} className="text-yellow-400" />
          <h2 className="font-bold text-white">Histórico de Faturas</h2>
        </div>
        <div className="divide-y divide-[#1A1A1A]">
          {invoices.map((inv) => {
            const s = statusConfig[inv.status]
            const StatusIcon = s.icon
            return (
              <div key={inv.id} className="p-5 flex items-center gap-4 hover:bg-[#111] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{inv.description}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{inv.id} · {inv.date}</div>
                </div>
                <div className="font-bold text-white">{inv.amount}</div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 ${s.class}`}>
                  <StatusIcon size={10} /> {inv.status}
                </span>
                <button className="p-2 text-gray-600 hover:text-yellow-400 hover:bg-[#1A1A1A] rounded-lg transition-all">
                  <Download size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
