import { Metadata } from 'next'
import { Users, Server, CreditCard, Ticket } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'

export const metadata: Metadata = { title: 'Admin Dashboard' }

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Administrativo</h1>
        <p className="text-slate-500 mt-1">Visão geral da plataforma ViralizaHost</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total Clientes" value="1.247" change="+12%" changeType="up" icon={Users} color="indigo" />
        <StatsCard title="Planos Ativos" value="3.891" change="+8%" changeType="up" icon={Server} color="green" />
        <StatsCard title="Receita Mensal" value="R$ 47.2k" change="+15%" changeType="up" icon={CreditCard} color="purple" />
        <StatsCard title="Tickets Abertos" value="23" change="-5" changeType="down" icon={Ticket} color="orange" />
      </div>
    </div>
  )
}
