import { Metadata } from 'next'
import { AlertCircle, TrendingUp, CheckCircle2, Clock, Server, Globe, Mail, HardDrive, RefreshCw } from 'lucide-react'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Dashboard — ViralizaHost' }

const cardStyle = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
}

async function fetchDashboardData(userId: string) {
  // Always use service_role client to bypass RLS — security enforced by userId filter
  const db = createAdminWriteClient()

  const [haResult, domainsResult, ticketsResult, activityResult] = await Promise.allSettled([
    // Hosting accounts (primary source of truth for WHM clients)
    db.from('hosting_accounts')
      .select('id, primary_domain, disk_used_mb, disk_limit_mb, email_count, status, package_name, ip_address, last_synced_at, service_id')
      .eq('profile_id', userId),

    // Portal domains (registered through checkout)
    db.from('domains')
      .select('id, full_domain, status, expires_at, auto_renew, registrar')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false }),

    // Support tickets
    db.from('tickets')
      .select('id, status', { count: 'exact', head: true })
      .eq('profile_id', userId)
      .in('status', ['open', 'in_progress']),

    // Recent activity
    db.from('activity_logs')
      .select('action, description, created_at')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const hostingAccounts = haResult.status === 'fulfilled' ? (haResult.value.data ?? []) : []
  const portalDomains   = domainsResult.status === 'fulfilled' ? (domainsResult.value.data ?? []) : []
  const ticketsCount    = ticketsResult.status === 'fulfilled' ? (ticketsResult.value.count ?? 0) : 0
  const recentActivity  = activityResult.status === 'fulfilled' ? (activityResult.value.data ?? []) : []

  // Merge: primary domains from hosting accounts + portal-registered domains
  const hostingDomains = hostingAccounts
    .filter((ha: any) => ha.primary_domain)
    .map((ha: any) => ({
      id: ha.id,
      full_domain: ha.primary_domain,
      status: ha.status === 'suspended' ? 'suspended' : 'active',
      type: 'primary',
      hosting_account_id: ha.id,
    }))

  const allDomains = [
    ...hostingDomains,
    ...portalDomains.map((d: any) => ({ ...d, type: 'registered' })),
  ]

  const domainsCount  = allDomains.filter((d: any) => d.status === 'active').length
  const servicesCount = hostingAccounts.filter((ha: any) => ha.status !== 'suspended').length
  const emailsCount   = hostingAccounts.reduce((s: number, ha: any) => s + (ha.email_count ?? 0), 0)

  // Disk usage aggregate
  const totalDiskUsed  = hostingAccounts.reduce((s: number, ha: any) => s + (ha.disk_used_mb ?? 0), 0)
  const totalDiskLimit = hostingAccounts.reduce((s: number, ha: any) => s + (ha.disk_limit_mb ?? 0), 0)
  const lastSyncedAt   = hostingAccounts.reduce((latest: string | null, ha: any) => {
    if (!ha.last_synced_at) return latest
    if (!latest) return ha.last_synced_at
    return ha.last_synced_at > latest ? ha.last_synced_at : latest
  }, null)

  return {
    domainsCount,
    servicesCount,
    emailsCount,
    ticketsCount,
    hostingAccounts,
    allDomains,
    recentActivity,
    totalDiskUsed,
    totalDiskLimit,
    lastSyncedAt,
  }
}

export default async function DashboardPage() {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) redirect('/login')

  const {
    domainsCount, servicesCount, emailsCount, ticketsCount,
    hostingAccounts, recentActivity, totalDiskUsed, totalDiskLimit, lastSyncedAt,
  } = await fetchDashboardData(user.id)

  const now = new Date()
  const diskPct = totalDiskLimit > 0 ? Math.round((totalDiskUsed / totalDiskLimit) * 100) : 0
  const diskColor = diskPct > 80 ? '#EF4444' : diskPct > 60 ? '#F5B700' : '#10B981'

  return (
    <div className="space-y-7">

      {/* Título */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#111827' }}>Bem-vindo de volta! 👋</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Aqui está um resumo da sua conta ViralizaHost.</p>
        </div>
        {servicesCount > 0 ? (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold" style={{ color: '#059669' }}>Todos os serviços ativos</span>
          </div>
        ) : null}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Domínios Ativos"      value={String(domainsCount)}  type="domains" />
        <StatsCard title="Planos de Hospedagem" value={String(servicesCount)} type="hosting" />
        <StatsCard title="Contas de Email"       value={String(emailsCount)}   type="email" />
        <StatsCard title="Tickets Abertos"       value={String(ticketsCount)}  type="tickets" />
      </div>

      {/* Hosting accounts */}
      {hostingAccounts.length > 0 && (
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
                <Server size={14} style={{ color: '#D9A300' }} />
              </div>
              <h2 className="text-sm font-bold" style={{ color: '#111827' }}>Planos Ativos</h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#F3F4F6', color: '#6B7280' }}>
              {hostingAccounts.length} plano{hostingAccounts.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-4">
            {hostingAccounts.map((ha: any) => {
              const diskUsed  = ha.disk_used_mb ?? 0
              const diskLimit = ha.disk_limit_mb ?? 0
              const pct       = diskLimit > 0 ? Math.min(Math.round((diskUsed / diskLimit) * 100), 100) : 0
              const color     = pct > 80 ? '#EF4444' : pct > 60 ? '#F5B700' : '#3B82F6'
              const isActive  = ha.status !== 'suspended'
              return (
                <div key={ha.id} className="flex items-center gap-4 py-3 px-4 rounded-xl"
                  style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: isActive ? 'rgba(59,130,246,0.10)' : 'rgba(239,68,68,0.10)', border: `1px solid ${isActive ? 'rgba(59,130,246,0.20)' : 'rgba(239,68,68,0.20)'}` }}>
                    <Server size={15} style={{ color: isActive ? '#2563EB' : '#DC2626' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: '#111827' }}>{ha.primary_domain ?? '—'}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={isActive
                          ? { background: 'rgba(16,185,129,0.08)', color: '#059669' }
                          : { background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>
                        {isActive ? 'Ativo' : 'Suspenso'}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: '#9CA3AF' }}>
                      {ha.package_name && <span>{ha.package_name}</span>}
                      {ha.ip_address && <span>IP: {ha.ip_address}</span>}
                      <span className="flex items-center gap-1">
                        <Mail size={10} /> {ha.email_count ?? 0} emails
                      </span>
                    </div>
                    {diskLimit > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                          {(diskUsed/1024).toFixed(1)}GB / {(diskLimit/1024).toFixed(1)}GB
                        </span>
                      </div>
                    )}
                  </div>
                  <a href="/hosting" className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                    Gerenciar
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Disk usage + last sync */}
      {totalDiskLimit > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={14} style={{ color: '#3B82F6' }} />
              <span className="text-sm font-bold" style={{ color: '#111827' }}>Uso de Disco</span>
            </div>
            <div className="text-2xl font-black mb-1" style={{ color: '#111827' }}>
              {(totalDiskUsed / 1024).toFixed(1)} <span className="text-base font-semibold" style={{ color: '#9CA3AF' }}>/ {(totalDiskLimit / 1024).toFixed(1)} GB</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden mt-3 mb-1" style={{ background: '#F3F4F6' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${diskPct}%`, background: diskColor }} />
            </div>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>{diskPct}% utilizado</p>
          </div>

          <div className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw size={14} style={{ color: '#10B981' }} />
              <span className="text-sm font-bold" style={{ color: '#111827' }}>Última Sincronização</span>
            </div>
            {lastSyncedAt ? (
              <>
                <div className="text-2xl font-black mb-1" style={{ color: '#111827' }}>
                  {new Date(lastSyncedAt).toLocaleDateString('pt-AO')}
                </div>
                <p className="text-xs mt-3" style={{ color: '#9CA3AF' }}>
                  {new Date(lastSyncedAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </>
            ) : (
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Nunca sincronizado</p>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {hostingAccounts.length === 0 && (
        <div className="rounded-2xl py-16 text-center" style={cardStyle}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.15)' }}>
            <Server size={28} style={{ color: '#D9A300' }} />
          </div>
          <p className="font-semibold text-sm mb-1" style={{ color: '#111827' }}>Nenhum serviço ativo</p>
          <p className="text-xs mb-5" style={{ color: '#9CA3AF' }}>A sua conta de hospedagem ainda está a ser configurada</p>
          <a href="/billing" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
            Ver Planos Disponíveis
          </a>
        </div>
      )}

      {/* Atividade Recente */}
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
              style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
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
  )
}
