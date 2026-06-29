import { Metadata } from 'next'
import { Globe, Server, Mail, Ticket, AlertCircle, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Dashboard — ViralizaHost' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    r0, r1, r2, r3, r4, r5, r6
  ] = await Promise.all([
    supabase.from('domains').select('*', { count: 'exact', head: true }).eq('profile_id', user.id).eq('status', 'active'),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('profile_id', user.id).eq('status', 'active'),
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('profile_id', user.id),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('profile_id', user.id).in('status', ['open', 'in_progress'] as any),
    supabase.from('services').select('id, notes, expires_at, plans(name), hosting_accounts(primary_domain)').eq('profile_id', user.id).eq('status', 'active').order('expires_at').limit(5),
    supabase.from('activity_logs').select('action, description, created_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('services').select('id, plans(name, disk_gb, bandwidth_gb), hosting_accounts(primary_domain, disk_used_mb, bandwidth_used_mb), expires_at').eq('profile_id', user.id).eq('status', 'active').limit(4),
  ])
  const domainsCount = r0.count
  const servicesCount = r1.count
  const emailsCount = r2.count
  const ticketsCount = r3.count
  const expiringItems = r4.data as any[]
  const recentActivity = r5.data as any[]
  const activeServices = r6.data as any[]

  const now = new Date()
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const hasUrgent = expiringItems?.some(s => s.expires_at && new Date(s.expires_at) < in30days)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Bem-vindo de volta! 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Aqui está um resumo da sua conta ViralizaHost.</p>
        </div>
        {!hasUrgent && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-400/10 border border-green-400/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Todos os serviços ativos</span>
          </div>
        )}
        {hasUrgent && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-400/10 border border-red-400/20">
            <AlertCircle size={12} className="text-red-400" />
            <span className="text-xs text-red-400 font-medium">Serviços a vencer em breve</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Domínios Ativos" value={String(domainsCount ?? 0)} icon={Globe} color="yellow" />
        <StatsCard title="Planos de Hospedagem" value={String(servicesCount ?? 0)} icon={Server} color="green" />
        <StatsCard title="Contas de Email" value={String(emailsCount ?? 0)} icon={Mail} color="blue" />
        <StatsCard title="Tickets Abertos" value={String(ticketsCount ?? 0)} icon={Ticket} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={16} className="text-yellow-400" />
            <h2 className="text-base font-bold text-white">Próximos Vencimentos</h2>
          </div>
          <div className="space-y-0">
            {expiringItems && expiringItems.length > 0 ? expiringItems.map((item: any) => {
              const expires = item.expires_at ? new Date(item.expires_at) : null
              const urgent = expires ? expires < in30days : false
              const domain = item.hosting_accounts?.[0]?.primary_domain ?? '—'
              const planName = item.plans?.name ?? 'Serviço'
              return (
                <div key={item.id} className="flex items-center justify-between py-3.5 border-b border-[#1A1A1A] last:border-0">
                  <div>
                    <div className="font-semibold text-white text-sm">{domain}</div>
                    <div className="text-xs text-gray-600 mt-0.5">{planName}</div>
                  </div>
                  <div className={`text-xs font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-full ${urgent ? 'bg-red-400/10 text-red-400 border border-red-400/20' : 'bg-[#1A1A1A] text-gray-500'}`}>
                    {urgent && <AlertCircle size={12} />}
                    {expires ? expires.toLocaleDateString('pt-BR') : 'N/D'}
                  </div>
                </div>
              )
            }) : (
              <div className="py-8 text-center text-gray-600 text-sm">Nenhum vencimento próximo</div>
            )}
          </div>
        </div>

        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-yellow-400" />
            <h2 className="text-base font-bold text-white">Atividade Recente</h2>
          </div>
          <div className="space-y-0">
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((log: any, i: number) => {
              const when = new Date(log.created_at)
              const diff = Math.round((now.getTime() - when.getTime()) / 60000)
              const timeLabel = diff < 60 ? `Há ${diff}m` : diff < 1440 ? `Há ${Math.round(diff/60)}h` : `Há ${Math.round(diff/1440)}d`
              return (
                <div key={i} className="flex items-center gap-3 py-3.5 border-b border-[#1A1A1A] last:border-0">
                  <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white capitalize">{log.action}</div>
                    <div className="text-xs text-gray-600 mt-0.5 truncate">{log.description}</div>
                  </div>
                  <div className="text-xs text-gray-700 flex-shrink-0">{timeLabel}</div>
                </div>
              )
            }) : (
              <div className="py-8 text-center text-gray-600 text-sm">Sem atividade recente</div>
            )}
          </div>
        </div>
      </div>

      {activeServices && activeServices.length > 0 && (
        <div className="glass-dark rounded-2xl border border-[#222] p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-yellow-400" />
              <h2 className="text-base font-bold text-white">Serviços Ativos</h2>
            </div>
            <span className="text-xs text-gray-600 bg-[#1A1A1A] px-2.5 py-1 rounded-full">{activeServices.length} planos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeServices.map((svc: any) => {
              const plan = svc.plans
              const ha = svc.hosting_accounts?.[0]
              const diskPct = plan && ha ? Math.round((ha.disk_used_mb / (plan.disk_gb * 1024)) * 100) : 0
              const bwPct = plan?.bandwidth_gb ? Math.round((ha?.bandwidth_used_mb / (plan.bandwidth_gb * 1024)) * 100) : 0
              const expires = svc.expires_at ? new Date(svc.expires_at).toLocaleDateString('pt-BR') : '—'
              return (
                <div key={svc.id} className="bg-[#111] border border-[#1A1A1A] rounded-xl p-4 hover:border-[#FFC107]/20 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-white text-sm">{plan?.name ?? 'Plano'}</div>
                      <div className="text-xs text-gray-600">{ha?.primary_domain ?? '—'}</div>
                    </div>
                    <span className="badge-yellow text-xs px-2 py-0.5 rounded-full">Ativo</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Armazenamento</span><span>{diskPct}%</span>
                      </div>
                      <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${Math.min(diskPct, 100)}%` }} />
                      </div>
                    </div>
                    {plan?.bandwidth_gb > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Bandwidth</span><span>{bwPct}%</span>
                        </div>
                        <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.min(bwPct, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#222] text-xs text-gray-700">Expira: {expires}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
