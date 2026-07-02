import { Metadata } from 'next'
import { Users, Server, CreditCard, MessageSquare, TrendingUp, Activity, Globe } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Admin Dashboard — ViralizaHost' }

export default async function AdminPage() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') redirect('/dashboard')

  const [
    { count: totalClients },
    { count: activeServices },
    { count: openTickets },
    { count: totalDomains },
    { data: recentClients },
    { data: serversRaw },
    { data: monthRevenueRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('domains').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('id, full_name, email, created_at, services(plans(name))').eq('role', 'client').order('created_at', { ascending: false }).limit(5),
    supabase.from('servers').select('id, name, is_active, current_load').order('name'),
    supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])

  const monthRevenue = monthRevenueRaw as any[]
  const servers = serversRaw as any[]
  const monthTotal = monthRevenue?.reduce((s: number, i: any) => s + Number(i.total), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Dashboard Administrativo</h1>
        <p className="text-gray-500 text-sm mt-1">Visão geral completa da plataforma ViralizaHost</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total de Clientes" value={String(totalClients ?? 0)} type="clients" />
        <StatsCard title="Planos Ativos"     value={String(activeServices ?? 0)} type="hosting" />
        <StatsCard title="Receita este Mês" value={`$${monthTotal.toFixed(0)}`} type="revenue" />
        <StatsCard title="Tickets Abertos"  value={String(openTickets ?? 0)} type="messages" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-dark rounded-2xl border border-[#222] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Clientes Recentes</h2>
          </div>
          <div className="space-y-0">
            {recentClients && recentClients.length > 0 ? recentClients.map((c: any) => {
              const plan = c.services?.[0]?.plans?.name ?? '—'
              const when = new Date(c.created_at)
              const now = new Date()
              const diff = Math.round((now.getTime() - when.getTime()) / 60000)
              const label = diff < 60 ? `Há ${diff}m` : diff < 1440 ? `Há ${Math.round(diff/60)}h` : `Há ${Math.round(diff/1440)}d`
              return (
                <div key={c.id} className="flex items-center gap-3 py-3 border-b border-[#1A1A1A] last:border-0">
                  <div className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-xs font-bold text-yellow-400">
                    {(c.full_name?.[0] ?? c.email[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{c.full_name || 'Sem nome'}</div>
                    <div className="text-xs text-gray-600 truncate">{c.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="badge-yellow text-xs px-2 py-0.5 rounded-full">{plan}</div>
                    <div className="text-xs text-gray-700 mt-0.5">{label}</div>
                  </div>
                </div>
              )
            }) : (
              <div className="py-8 text-center text-gray-600 text-sm">Nenhum cliente ainda</div>
            )}
          </div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-5">
          <div className="flex items-center gap-2 mb-5">
            <Activity size={16} className="text-yellow-400" />
            <h2 className="font-bold text-white">Status dos Servidores</h2>
          </div>
          <div className="space-y-3">
            {servers && servers.length > 0 ? servers.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-sm text-gray-400">{s.name}</span>
                </div>
                <span className={`text-xs font-medium ${s.is_active ? 'text-green-400' : 'text-red-400'}`}>
                  {s.is_active ? `Load: ${s.current_load}%` : 'Offline'}
                </span>
              </div>
            )) : (
              <div className="py-4 text-center text-gray-600 text-sm">Nenhum servidor configurado</div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-[#1A1A1A] grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-lg font-black text-white">{totalDomains ?? 0}</div>
              <div className="text-xs text-gray-600 flex items-center justify-center gap-1"><Globe size={10} /> Domínios</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-white">{servers?.filter(s => s.is_active).length ?? 0}</div>
              <div className="text-xs text-gray-600 flex items-center justify-center gap-1"><Server size={10} /> Online</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
