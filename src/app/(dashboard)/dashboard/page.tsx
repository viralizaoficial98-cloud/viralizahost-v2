import { Metadata } from 'next'
import { Globe, Server, Mail, Ticket, AlertCircle } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'

export const metadata: Metadata = { title: 'Dashboard' }

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bem-vindo, Usuário!</h1>
        <p className="text-slate-500 mt-1">Aqui está um resumo da sua conta ViralizaHost.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Domínios Ativos" value="3" icon={Globe} color="indigo" />
        <StatsCard title="Planos Ativos" value="2" icon={Server} color="green" />
        <StatsCard title="Contas de Email" value="12" icon={Mail} color="purple" />
        <StatsCard title="Tickets Abertos" value="1" icon={Ticket} color="orange" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Próximos Vencimentos</h2>
          <div className="space-y-3">
            {[
              { name: 'meusite.com', type: 'Domínio', date: '15 Jul 2025', urgent: true },
              { name: 'Plano Business', type: 'Hospedagem', date: '01 Ago 2025', urgent: false },
              { name: 'loja.ao', type: 'Domínio', date: '20 Ago 2025', urgent: false },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div>
                  <div className="font-medium text-slate-900">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.type}</div>
                </div>
                <div className={`text-sm font-medium flex items-center gap-1 ${item.urgent ? 'text-red-600' : 'text-slate-600'}`}>
                  {item.urgent && <AlertCircle size={14} />}
                  {item.date}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Atividade Recente</h2>
          <div className="space-y-3">
            {[
              { action: 'Backup realizado', detail: 'meusite.com', time: 'Há 2 horas' },
              { action: 'SSL renovado', detail: 'loja.ao', time: 'Há 1 dia' },
              { action: 'Email criado', detail: 'contato@meusite.com', time: 'Há 3 dias' },
              { action: 'Fatura paga', detail: 'Plano Business - R$ 39,90', time: 'Há 5 dias' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
                <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{item.action}</div>
                  <div className="text-xs text-slate-500">{item.detail}</div>
                </div>
                <div className="text-xs text-slate-400">{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
