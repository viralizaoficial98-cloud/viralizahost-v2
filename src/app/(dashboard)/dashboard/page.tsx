import { Metadata } from 'next'
import { Globe, Server, Mail, Ticket, AlertCircle, TrendingUp, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Dashboard — ViralizaHost' }

/* shared card style — white, clean border, soft shadow */
const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [r0, r1, r2, r3, r4, r5, r6] = await Promise.all([
    supabase.from('domains').select('*', { count: 'exact', head: true }).eq('profile_id', user.id).eq('status', 'active'),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('profile_id', user.id).eq('status', 'active'),
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('profile_id', user.id),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('profile_id', user.id).in('status', ['open', 'in_progress'] as any),
    supabase.from('services').select('id, notes, expires_at, plans(name), hosting_accounts(primary_domain)').eq('profile_id', user.id).eq('status', 'active').order('expires_at').limit(5),
    supabase.from('activity_logs').select('action, description, created_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('services').select('id, plans(name, disk_gb, bandwidth_gb), hosting_accounts(primary_domain, disk_used_mb, bandwidth_used_mb), expires_at').eq('profile_id', user.id).eq('status', 'active').limit(4),
  ])

  const domainsCount   = r0.count
  const servicesCount  = r1.count
  const emailsCount    = r2.count
  const ticketsCount   = r3.count
  const expiringItems  = r4.data as any[]
  const recentActivity = r5.data as any[]
  const activeServices = r6.data as any[]

  const now = new Date()
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const hasUrgent = expiringItems?.some(s => s.expires_at && new Date(s.expires_at) < in30days)

  return (
    <div className="space-y-7">

      {/* ── Page title ─────────────────────────────────────── */}
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

      {/* ── Stats grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Domínios Ativos"       value={String(domainsCount  ?? 0)} icon={Globe}   color="yellow" />
        <StatsCard title="Planos de Hospedagem"  value={String(servicesCount ?? 0)} icon={Server}  color="green" />
        <StatsCard title="Contas de Email"        value={String(emailsCount   ?? 0)} icon={Mail}    color="blue" />
        <StatsCard title="Tickets Abertos"        value={String(ticketsCount  ?? 0)} icon={Ticket}  color="red" />
      </div>

      {/* ── Vencimentos + Atividade ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Próximos vencimentos */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
              <Clock size={14} style={{ color: '#D9A300' }} />
            </div>
            <h2 className="text-sm font-bold" style={{ color: '#111827' }}>Próximos Vencimentos</h2>
          </div>
          <div>
            {expiringItems && expiringItems.length > 0 ? expiringItems.map((item: any) => {
              const expires = item.expires_at ? new Date(item.expires_at) : null
              const urgent  = expires ? expires < in30days : false
              const domain  = item.hosting_accounts?.[0]?.primary_domain ?? '—'
              const planName = item.plans?.name ?? 'Serviço'
              return (
                <div key={item.id}
                  className="flex items-center justify-between py-3.5"
                  style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: '#111827' }}>{domain}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{planName}</div>
                  </div>
                  <div className={`text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-full`}
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
        </div>

        {/* Atividade recente */}
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}>
              <TrendingUp size={14} style={{ color: '#2563EB' }} />
            </div>
            <h2 className="text-sm font-bold" style={{ color: '#111827' }}>Atividade Recente</h2>
          </div>
          <div>
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((log: any, i: number) => {
              const when = new Date(log.created_at)
              const diff = Math.round((now.getTime() - when.getTime()) / 60000)
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
      </div>

      {/* ── Serviços ativos ─────────────────────────────────── */}
      {activeServices && activeServices.length > 0 && (
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
            {activeServices.map((svc: any) => {
              const plan   = svc.plans
              const ha     = svc.hosting_accounts?.[0]
              const diskPct = plan && ha ? Math.round((ha.disk_used_mb / (plan.disk_gb * 1024)) * 100) : 0
              const bwPct   = plan?.bandwidth_gb ? Math.round((ha?.bandwidth_used_mb / (plan.bandwidth_gb * 1024)) * 100) : 0
              const expires = svc.expires_at ? new Date(svc.expires_at).toLocaleDateString('pt-BR') : '—'
              return (
                <div key={svc.id} className="rounded-xl p-4 transition-all duration-200"
                  style={{ background: '#F8F9FB', border: '1px solid #E5E7EB' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,183,0,0.40)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-bold text-sm" style={{ color: '#111827' }}>{plan?.name ?? 'Plano'}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{ha?.primary_domain ?? '—'}</div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(245,183,0,0.12)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                      Ativo
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
                        <span>Armazenamento</span><span className="font-semibold" style={{ color: '#6B7280' }}>{diskPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(diskPct, 100)}%`, background: '#F5B700' }} />
                      </div>
                    </div>
                    {plan?.bandwidth_gb > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
                          <span>Bandwidth</span><span className="font-semibold" style={{ color: '#6B7280' }}>{bwPct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(bwPct, 100)}%`, background: '#3B82F6' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 text-xs font-medium" style={{ borderTop: '1px solid #E5E7EB', color: '#9CA3AF' }}>
                    Expira: {expires}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
