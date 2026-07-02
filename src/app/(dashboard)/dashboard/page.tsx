import { Metadata } from 'next'
import { AlertCircle, TrendingUp, CheckCircle2, Clock, Server } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ServiceCard } from '@/components/dashboard/ServiceCard'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Dashboard — ViralizaHost' }

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
}

// Todas as queries isoladas — falha individual nunca quebra a página
async function fetchDashboardData(userId: string) {
  const supabase = await createClient()

  const results = await Promise.allSettled([
    supabase.from('domains').select('*', { count: 'exact', head: true }).eq('profile_id', userId).eq('status', 'active'),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('profile_id', userId).eq('status', 'active'),
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('profile_id', userId),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('profile_id', userId).in('status', ['open', 'in_progress'] as any),
    supabase.from('services')
      .select('id, expires_at, plans(name), hosting_accounts(primary_domain)')
      .eq('profile_id', userId).eq('status', 'active').order('expires_at').limit(5),
    supabase.from('activity_logs')
      .select('action, description, created_at')
      .eq('profile_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('services')
      .select('id, plans(name, disk_gb, bandwidth_gb), hosting_accounts(primary_domain, disk_used_mb, bandwidth_used_mb), expires_at')
      .eq('profile_id', userId).eq('status', 'active').limit(4),
  ])

  const getCount = (r: typeof results[0]) =>
    r.status === 'fulfilled' ? ((r.value as any).count ?? 0) : 0
  const getData = (r: typeof results[0]): any[] =>
    r.status === 'fulfilled' ? ((r.value as any).data ?? []) : []

  return {
    domainsCount:  getCount(results[0]),
    servicesCount: getCount(results[1]),
    emailsCount:   getCount(results[2]),
    ticketsCount:  getCount(results[3]),
    expiringItems:  getData(results[4]),
    recentActivity: getData(results[5]),
    activeServices: getData(results[6]),
  }
}

export default async function DashboardPage() {
  // redirect() DEVE estar fora de qualquer try/catch
  // (usa exceção interna do Next.js que não pode ser capturada)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const {
    domainsCount, servicesCount, emailsCount, ticketsCount,
    expiringItems, recentActivity, activeServices,
  } = await fetchDashboardData(user.id)

  const now = new Date()
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const hasUrgent = expiringItems.some((s: any) => s.expires_at && new Date(s.expires_at) < in30days)

  return (
    <div className="space-y-7">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#111827' }}>Bem-vindo de volta! 👋</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Aqui está um resumo da sua conta ViralizaHost.</p>
        </div>
        {!hasUrgent ? (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold" style={{ color: '#059669' }}>Todos os serviços ativos</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
            <AlertCircle size={12} style={{ color: '#DC2626' }} />
            <span className="text-xs font-semibold" style={{ color: '#DC2626' }}>Serviços a vencer em breve</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Domínios Ativos"      value={String(domainsCount)}  type="domains" />
        <StatsCard title="Planos de Hospedagem" value={String(servicesCount)} type="hosting" />
        <StatsCard title="Contas de Email"       value={String(emailsCount)}   type="email" />
        <StatsCard title="Tickets Abertos"       value={String(ticketsCount)}  type="tickets" />
      </div>

      {/* Vencimentos + Atividade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
              <Clock size={14} style={{ color: '#D9A300' }} />
            </div>
            <h2 className="text-sm font-bold" style={{ color: '#111827' }}>Próximos Vencimentos</h2>
          </div>
          {expiringItems.length > 0 ? expiringItems.map((item: any) => {
            const expires = item.expires_at ? new Date(item.expires_at) : null
            const urgent  = expires ? expires < in30days : false
            return (
              <div key={item.id} className="flex items-center justify-between py-3.5"
                style={{ borderBottom: '1px solid #F3F4F6' }}>
                <div>
                  <div className="font-semibold text-sm" style={{ color: '#111827' }}>
                    {item.hosting_accounts?.[0]?.primary_domain ?? '—'}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{item.plans?.name ?? 'Serviço'}</div>
                </div>
                <div className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                  style={urgent
                    ? { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }
                    : { background: '#F3F4F6', color: '#6B7280' }}>
                  {urgent && <AlertCircle size={11} />}
                  {expires ? expires.toLocaleDateString('pt-BR') : 'N/D'}
                </div>
              </div>
            )
          }) : (
            <div className="py-8 text-center text-sm" style={{ color: '#9CA3AF' }}>Nenhum vencimento próximo</div>
          )}
        </div>

        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}>
              <TrendingUp size={14} style={{ color: '#2563EB' }} />
            </div>
            <h2 className="text-sm font-bold" style={{ color: '#111827' }}>Atividade Recente</h2>
          </div>
          {recentActivity.length > 0 ? recentActivity.map((log: any, i: number) => {
            const diff = Math.round((now.getTime() - new Date(log.created_at).getTime()) / 60000)
            const timeLabel = diff < 60 ? `Há ${diff}m` : diff < 1440 ? `Há ${Math.round(diff/60)}h` : `Há ${Math.round(diff/1440)}d`
            return (
              <div key={i} className="flex items-center gap-3 py-3.5"
                style={{ borderBottom: '1px solid #F3F4F6' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)' }}>
                  <CheckCircle2 size={13} style={{ color: '#059669' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold capitalize" style={{ color: '#111827' }}>{log.action}</div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{log.description}</div>
                </div>
                <div className="text-xs shrink-0 font-medium" style={{ color: '#D1D5DB' }}>{timeLabel}</div>
              </div>
            )
          }) : (
            <div className="py-8 text-center text-sm" style={{ color: '#9CA3AF' }}>Sem atividade recente</div>
          )}
        </div>
      </div>

      {/* Serviços ativos */}
      {activeServices.length > 0 && (
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
                <Server size={14} style={{ color: '#D9A300' }} />
              </div>
              <h2 className="text-sm font-bold" style={{ color: '#111827' }}>Serviços Ativos</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#F3F4F6', color: '#6B7280' }}>
              {activeServices.length} planos
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeServices.map((svc: any) => <ServiceCard key={svc.id} svc={svc} />)}
          </div>
        </div>
      )}
    </div>
  )
}
