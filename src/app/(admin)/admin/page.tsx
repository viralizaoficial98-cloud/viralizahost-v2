import { Metadata } from 'next'
import { Users, Server, CreditCard, MessageSquare, TrendingUp, Activity, Globe, Shield } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'

export const metadata: Metadata = { title: 'Admin Dashboard — ViralizaHost' }

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Dashboard Administrativo</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral completa da plataforma ViralizaHost</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total de Clientes" value="1.247" change="+12%" changeType="up" icon={Users} color="yellow" />
        <StatsCard title="Planos Ativos" value="3.891" change="+8%" changeType="up" icon={Server} color="green" />
        <StatsCard title="Receita Mensal" value="R$ 47.2k" change="+15%" changeType="up" icon={CreditCard} color="blue" />
        <StatsCard title="Tickets Abertos" value="23" change="-5" changeType="down" icon={MessageSquare} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Receita dos Últimos 6 Meses</h2>
          </div>
          <div className="flex items-end gap-2 h-32">
            {[28, 35, 42, 38, 47, 52].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-yellow-400/80 rounded-t-sm" style={{ height: `${(val / 52) * 100}%` }} />
                <span className="text-xs text-gray-700">{['Jan','Fev','Mar','Abr','Mai','Jun'][i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-600">Valores em R$ mil</div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-5">
          <div className="flex items-center gap-2 mb-5">
            <Activity size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Status do Sistema</h2>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Servidor Principal', status: 'Online', uptime: '99.98%', color: 'green' },
              { name: 'Servidor Backup', status: 'Online', uptime: '99.95%', color: 'green' },
              { name: 'DNS Primário', status: 'Online', uptime: '100%', color: 'green' },
              { name: 'Email Gateway', status: 'Online', uptime: '99.87%', color: 'green' },
              { name: 'API WHM', status: 'Online', uptime: '99.92%', color: 'green' },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full bg-${s.color}-400`} />
                  <span className="text-sm text-gray-400">{s.name}</span>
                </div>
                <span className="text-xs text-green-400 font-medium">{s.uptime}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-dark rounded-2xl border border-[#222] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Novos Clientes</h2>
          </div>
          <div className="space-y-0">
            {[
              { name: 'Maria Santos', email: 'maria@email.com', plan: 'Business', date: 'Hoje, 14:32' },
              { name: 'João Silva', email: 'joao@empresa.ao', plan: 'Pro', date: 'Hoje, 09:15' },
              { name: 'Ana Costa', email: 'ana@loja.com', plan: 'Starter', date: 'Ontem, 18:45' },
            ].map((client) => (
              <div key={client.email} className="flex items-center gap-3 py-3 border-b border-[#1A1A1A] last:border-0">
                <div className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-xs font-bold text-yellow-400">
                  {client.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{client.name}</div>
                  <div className="text-xs text-gray-600 truncate">{client.email}</div>
                </div>
                <div className="text-right">
                  <div className="badge-yellow text-xs px-2 py-0.5 rounded-full">{client.plan}</div>
                  <div className="text-xs text-gray-700 mt-0.5">{client.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Domínios por País</h2>
          </div>
          <div className="space-y-3">
            {[
              { country: '🇦🇴 Angola', domains: 847, pct: 68 },
              { country: '🇧🇷 Brasil', domains: 284, pct: 23 },
              { country: '🇵🇹 Portugal', domains: 89, pct: 7 },
              { country: '🌍 Outros', domains: 27, pct: 2 },
            ].map((item) => (
              <div key={item.country}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{item.country}</span>
                  <span className="text-gray-600">{item.domains} domínios ({item.pct}%)</span>
                </div>
                <div className="h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
