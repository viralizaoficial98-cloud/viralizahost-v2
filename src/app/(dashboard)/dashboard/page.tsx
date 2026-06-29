import { Metadata } from 'next'
import { Globe, Server, Mail, Ticket, AlertCircle, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'

export const metadata: Metadata = { title: 'Dashboard — ViralizaHost' }

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Bem-vindo de volta! 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Aqui está um resumo da sua conta ViralizaHost.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-400/10 border border-green-400/20">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">Todos os serviços ativos</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Domínios Ativos" value="3" icon={Globe} color="yellow" change="+1 este mês" changeType="up" />
        <StatsCard title="Planos de Hospedagem" value="2" icon={Server} color="green" />
        <StatsCard title="Contas de Email" value="12" icon={Mail} color="blue" change="8/20 usadas" changeType="neutral" />
        <StatsCard title="Tickets Abertos" value="1" icon={Ticket} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={16} className="text-yellow-400" />
            <h2 className="text-base font-bold text-white">Próximos Vencimentos</h2>
          </div>
          <div className="space-y-0">
            {[
              { name: 'meusite.com', type: 'Domínio', date: '15 Jul 2026', urgent: true },
              { name: 'Plano Business', type: 'Hospedagem', date: '01 Ago 2026', urgent: false },
              { name: 'loja.ao', type: 'Domínio', date: '20 Ago 2026', urgent: false },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between py-3.5 border-b border-[#1A1A1A] last:border-0">
                <div>
                  <div className="font-semibold text-white text-sm">{item.name}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{item.type}</div>
                </div>
                <div className={`text-xs font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-full ${item.urgent ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#1A1A1A] text-gray-500'}`}>
                  {item.urgent && <AlertCircle size={12} />}
                  {item.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-yellow-400" />
            <h2 className="text-base font-bold text-white">Atividade Recente</h2>
          </div>
          <div className="space-y-0">
            {[
              { action: 'Backup realizado', detail: 'meusite.com', time: 'Há 2 horas', ok: true },
              { action: 'SSL renovado', detail: 'loja.ao', time: 'Há 1 dia', ok: true },
              { action: 'Email criado', detail: 'contato@meusite.com', time: 'Há 3 dias', ok: true },
              { action: 'Fatura paga', detail: 'Plano Business — R$ 39,90', time: 'Há 5 dias', ok: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3.5 border-b border-[#1A1A1A] last:border-0">
                <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{item.action}</div>
                  <div className="text-xs text-gray-600 mt-0.5 truncate">{item.detail}</div>
                </div>
                <div className="text-xs text-gray-700 flex-shrink-0">{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-dark rounded-2xl border border-[#222] p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-yellow-400" />
            <h2 className="text-base font-bold text-white">Serviços Ativos</h2>
          </div>
          <span className="text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">2 planos</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Plano Business', domain: 'meusite.com', storage: '60%', bandwidth: '32%', expiry: '01 Ago 2026' },
            { name: 'Plano Starter', domain: 'loja.ao', storage: '20%', bandwidth: '8%', expiry: '20 Ago 2026' },
          ].map((plan) => (
            <div key={plan.name} className="bg-[#111] border border-[#1A1A1A] rounded-xl p-4 hover:border-[#FFC107]/20 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-bold text-white text-sm">{plan.name}</div>
                  <div className="text-xs text-gray-600">{plan.domain}</div>
                </div>
                <span className="badge-yellow text-xs px-2 py-0.5 rounded-full">Ativo</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Armazenamento</span><span>{plan.storage}</span>
                  </div>
                  <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: plan.storage }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Bandwidth</span><span>{plan.bandwidth}</span>
                  </div>
                  <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: plan.bandwidth }} />
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[#222] text-xs text-gray-700">Expira: {plan.expiry}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
