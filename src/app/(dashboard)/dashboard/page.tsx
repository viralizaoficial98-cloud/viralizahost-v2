import { Metadata } from 'next'
import { Globe, Server, Mail, TicketIcon, HardDrive, RefreshCw, CheckCircle2, Clock, ExternalLink, ArrowRight, Shield } from 'lucide-react'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Dashboard — ViralizaHost' }

async function fetchDashboardData(userId: string) {
  const db = createAdminWriteClient()

  const [haResult, domainsResult, ticketsResult, activityResult, profileResult] = await Promise.allSettled([
    db.from('hosting_accounts')
      .select('id, primary_domain, disk_used_mb, disk_limit_mb, email_count, status, package_name, ip_address, last_synced_at, service_id, php_version')
      .eq('profile_id', userId)
      .in('status', ['active', 'suspended', 'pending']),
    db.from('domains').select('id, status').eq('profile_id', userId).eq('status', 'active'),
    db.from('tickets').select('id', { count: 'exact', head: true }).eq('profile_id', userId).in('status', ['open', 'in_progress']),
    db.from('sso_audit_logs')
      .select('access_type, created_at, success')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
  ])

  const hostingAccounts = haResult.status === 'fulfilled' ? (haResult.value.data ?? []) : []
  const portalDomains   = domainsResult.status === 'fulfilled' ? (domainsResult.value.data ?? []) : []
  const ticketsCount    = ticketsResult.status === 'fulfilled' ? (ticketsResult.value.count ?? 0) : 0
  const ssoLogs         = activityResult.status === 'fulfilled' ? (activityResult.value.data ?? []) : []
  const profile         = profileResult.status === 'fulfilled' ? (profileResult.value.data) : null

  const primaryDomainNames = new Set((hostingAccounts as any[]).map((h: any) => h.primary_domain?.toLowerCase()))
  const uniquePortalDomains = (portalDomains as any[]).filter((d: any) => !primaryDomainNames.has(d?.id?.toLowerCase()))
  const domainsCount  = (hostingAccounts as any[]).filter((h: any) => h.status !== 'suspended').length + uniquePortalDomains.length
  const servicesCount = (hostingAccounts as any[]).filter((h: any) => h.status !== 'suspended').length
  const emailsCount   = (hostingAccounts as any[]).reduce((s: number, h: any) => s + (h.email_count ?? 0), 0)
  const totalDiskUsed  = (hostingAccounts as any[]).reduce((s: number, h: any) => s + (h.disk_used_mb ?? 0), 0)
  const totalDiskLimit = (hostingAccounts as any[]).reduce((s: number, h: any) => s + (h.disk_limit_mb ?? 0), 0)
  const lastSyncedAt   = (hostingAccounts as any[]).reduce((latest: string | null, h: any) => {
    if (!h.last_synced_at) return latest
    return !latest || h.last_synced_at > latest ? h.last_synced_at : latest
  }, null)

  return { hostingAccounts, domainsCount, servicesCount, emailsCount, ticketsCount, totalDiskUsed, totalDiskLimit, lastSyncedAt, ssoLogs, profile }
}

const statCards = [
  { type: 'domains',  label: 'Domínios Ativos',      href: '/domains',  iconBg: 'rgba(245,183,0,0.12)',  iconBorder: 'rgba(245,183,0,0.25)',  iconColor: '#D9A300', shadow: 'rgba(245,183,0,0.20)' },
  { type: 'hosting',  label: 'Planos de Hospedagem',  href: '/hosting',  iconBg: 'rgba(59,130,246,0.12)', iconBorder: 'rgba(59,130,246,0.25)', iconColor: '#2563EB', shadow: 'rgba(59,130,246,0.20)' },
  { type: 'email',    label: 'Contas de Email',        href: '/email',    iconBg: 'rgba(16,185,129,0.12)', iconBorder: 'rgba(16,185,129,0.25)', iconColor: '#059669', shadow: 'rgba(16,185,129,0.20)' },
  { type: 'tickets',  label: 'Tickets Abertos',        href: '/tickets',  iconBg: 'rgba(239,68,68,0.12)',  iconBorder: 'rgba(239,68,68,0.25)',  iconColor: '#DC2626', shadow: 'rgba(239,68,68,0.20)' },
]

function StatCard({ label, value, href, iconBg, iconBorder, iconColor, shadow, Icon }: {
  label: string; value: number; href: string; iconBg: string; iconBorder: string; iconColor: string; shadow: string; Icon: React.ElementType
}) {
  return (
    <a href={href} className="block group">
      <div className="rounded-2xl p-6 transition-all duration-300 group-hover:-translate-y-1 cursor-pointer"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${shadow}, 0 2px 8px rgba(0,0,0,0.04)` }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
            style={{ background: iconBg, border: `1px solid ${iconBorder}` }}>
            <Icon size={22} style={{ color: iconColor }} />
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
            style={{ background: iconBg }}>
            <ArrowRight size={14} style={{ color: iconColor }} />
          </div>
        </div>
        <div className="text-3xl font-black mb-1.5 tabular-nums" style={{ color: '#111827' }}>{value}</div>
        <div className="text-sm font-medium" style={{ color: '#6B7280' }}>{label}</div>
      </div>
    </a>
  )
}

function ActivityIcon({ type, success }: { type: string; success: boolean }) {
  const iconMap: Record<string, { emoji: string; bg: string; color: string }> = {
    cpanel:  { emoji: '⚙️', bg: 'rgba(245,183,0,0.10)', color: '#D9A300' },
    webmail: { emoji: '📧', bg: 'rgba(59,130,246,0.10)', color: '#2563EB' },
    default: { emoji: '🔄', bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  }
  const cfg = iconMap[type] ?? iconMap.default
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
      style={{ background: success ? cfg.bg : 'rgba(239,68,68,0.10)' }}>
      {success ? cfg.emoji : '❌'}
    </div>
  )
}

export default async function DashboardPage() {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) redirect('/login')

  const { hostingAccounts, domainsCount, servicesCount, emailsCount, ticketsCount, totalDiskUsed, totalDiskLimit, lastSyncedAt, ssoLogs, profile } = await fetchDashboardData(user.id)

  const now = new Date()
  const diskPct = totalDiskLimit > 0 ? Math.min(Math.round((totalDiskUsed / totalDiskLimit) * 100), 100) : 0
  const diskColor = diskPct > 80 ? '#EF4444' : diskPct > 60 ? '#F5B700' : '#10B981'
  const firstName = (profile as any)?.full_name?.split(' ')[0] ?? 'Cliente'

  const statsData = [
    { ...statCards[0], value: domainsCount, Icon: Globe },
    { ...statCards[1], value: servicesCount, Icon: Server },
    { ...statCards[2], value: emailsCount, Icon: Mail },
    { ...statCards[3], value: ticketsCount, Icon: TicketIcon },
  ]

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up { animation: fadeInUp 0.4s ease both; }
        .fade-in-up-1 { animation: fadeInUp 0.4s 0.05s ease both; }
        .fade-in-up-2 { animation: fadeInUp 0.4s 0.10s ease both; }
        .fade-in-up-3 { animation: fadeInUp 0.4s 0.15s ease both; }
        .fade-in-up-4 { animation: fadeInUp 0.4s 0.20s ease both; }
        .fade-in-up-5 { animation: fadeInUp 0.4s 0.25s ease both; }
      `}</style>

      <div className="space-y-6">

        {/* Header */}
        <div className="fade-in-up flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#111827' }}>Bem-vindo, {firstName}! 👋</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Painel de controlo da sua conta ViralizaHost</p>
          </div>
          {servicesCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)' }}>
              <div className="w-2 h-2 rounded-full bg-green-500" style={{ boxShadow: '0 0 0 3px rgba(16,185,129,0.20)', animation: 'pulse 2s infinite' }} />
              <span className="text-xs font-semibold" style={{ color: '#059669' }}>Todos os serviços online</span>
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsData.map((card, i) => (
            <div key={card.type} className={`fade-in-up-${i + 1}`}>
              <StatCard {...card} />
            </div>
          ))}
        </div>

        {/* Hosting plans */}
        {(hostingAccounts as any[]).length > 0 && (
          <div className="fade-in-up-2 space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#374151' }}>
              <Server size={14} style={{ color: '#6B7280' }} /> Planos Ativos
            </h2>
            {(hostingAccounts as any[]).map((ha: any) => {
              const diskUsed  = ha.disk_used_mb ?? 0
              const diskLimit = ha.disk_limit_mb ?? 0
              const pct       = diskLimit > 0 ? Math.min(Math.round((diskUsed / diskLimit) * 100), 100) : 0
              const barColor  = pct > 80 ? '#EF4444' : pct > 60 ? '#F5B700' : '#10B981'
              const isOk      = ha.status === 'active'
              return (
                <div key={ha.id} className="rounded-2xl overflow-hidden"
                  style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div className="px-5 py-4 flex items-center gap-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: isOk ? 'rgba(59,130,246,0.10)' : 'rgba(239,68,68,0.10)', border: `1px solid ${isOk ? 'rgba(59,130,246,0.20)' : 'rgba(239,68,68,0.20)'}` }}>
                      <Server size={18} style={{ color: isOk ? '#2563EB' : '#DC2626' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm" style={{ color: '#111827' }}>{ha.primary_domain ?? '—'}</span>
                        {ha.package_name && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#F3F4F6', color: '#6B7280' }}>{ha.package_name}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#9CA3AF' }}>
                        {ha.ip_address && <span>{ha.ip_address}</span>}
                        <span className="flex items-center gap-1"><Mail size={9} /> {ha.email_count ?? 0} emails</span>
                        {ha.php_version && <span>PHP {ha.php_version}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={isOk
                          ? { background: 'rgba(16,185,129,0.10)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                          : { background: 'rgba(239,68,68,0.10)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                        {isOk ? '● Ativo' : '● Suspenso'}
                      </span>
                      <a href="/hosting"
                        className="hidden sm:flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                        style={{ background: 'rgba(245,183,0,0.12)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                        Gerenciar <ArrowRight size={11} />
                      </a>
                    </div>
                  </div>
                  {/* Disk bar */}
                  <div className="px-5 py-3 flex items-center gap-3">
                    <HardDrive size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: '#6B7280' }}>Armazenamento</span>
                        <span className="text-xs font-semibold" style={{ color: '#374151' }}>
                          {(diskUsed / 1024).toFixed(2)} GB
                          {diskLimit > 0 ? ` / ${(diskLimit / 1024).toFixed(2)} GB` : ' utilizado'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: diskLimit > 0 ? `${pct}%` : '0%', background: `linear-gradient(90deg, ${barColor}cc, ${barColor})` }} />
                      </div>
                    </div>
                    {diskLimit > 0 && (
                      <span className="text-[11px] font-bold shrink-0" style={{ color: barColor }}>{pct}%</span>
                    )}
                    {diskLimit === 0 && (
                      <span className="text-[11px] font-semibold shrink-0" style={{ color: '#10B981' }}>Ilimitado</span>
                    )}
                    {ha.last_synced_at && (
                      <span className="hidden sm:flex items-center gap-1 text-[11px] shrink-0" style={{ color: '#D1D5DB' }}>
                        <RefreshCw size={9} /> {new Date(ha.last_synced_at).toLocaleDateString('pt-AO')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {(hostingAccounts as any[]).length === 0 && (
          <div className="fade-in-up-3 rounded-2xl py-16 text-center"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.15)' }}>
              <Server size={28} style={{ color: '#D9A300' }} />
            </div>
            <p className="font-bold text-sm mb-1" style={{ color: '#111827' }}>Conta em configuração</p>
            <p className="text-xs mb-5" style={{ color: '#9CA3AF' }}>O seu plano de hospedagem está a ser ativado</p>
            <a href="/billing" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
              Ver Planos Disponíveis
            </a>
          </div>
        )}

        {/* Bottom row: stats + activity */}
        <div className="fade-in-up-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Quick stats */}
          <div className="rounded-2xl p-5"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: '#111827' }}>
              <Shield size={14} style={{ color: '#059669' }} /> Estado da Conta
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Domínios ativos',     value: domainsCount,  color: '#D9A300', href: '/domains' },
                { label: 'Planos de hospedagem', value: servicesCount, color: '#2563EB', href: '/hosting' },
                { label: 'Contas de email',      value: emailsCount,   color: '#059669', href: '/email' },
                { label: 'Tickets abertos',      value: ticketsCount,  color: '#DC2626', href: '/tickets' },
              ].map(item => (
                <a key={item.label} href={item.href}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors hover:bg-gray-50 group"
                  style={{ border: '1px solid transparent' }}>
                  <span className="text-sm" style={{ color: '#374151' }}>{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black tabular-nums" style={{ color: item.color }}>{item.value}</span>
                    <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: item.color }} />
                  </div>
                </a>
              ))}
            </div>
            {lastSyncedAt && (
              <div className="mt-4 pt-3 flex items-center gap-2 text-xs" style={{ borderTop: '1px solid #F3F4F6', color: '#9CA3AF' }}>
                <RefreshCw size={11} />
                Última sync: {new Date(lastSyncedAt).toLocaleString('pt-AO', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="rounded-2xl p-5"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h2 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: '#111827' }}>
              <Clock size={14} style={{ color: '#6B7280' }} /> Atividade Recente
            </h2>
            {(ssoLogs as any[]).length > 0 ? (
              <div className="space-y-1">
                {(ssoLogs as any[]).map((log: any, i: number) => {
                  const diff  = Math.round((now.getTime() - new Date(log.created_at).getTime()) / 60000)
                  const time  = diff < 60 ? `${diff}m atrás` : diff < 1440 ? `${Math.round(diff / 60)}h atrás` : `${Math.round(diff / 1440)}d atrás`
                  const label = log.access_type === 'cpanel' ? 'Acesso ao cPanel' : log.access_type === 'webmail' ? 'Acesso ao Webmail' : 'Sincronização'
                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl" style={{ background: i % 2 === 0 ? '#FAFAFA' : 'transparent' }}>
                      <ActivityIcon type={log.access_type} success={log.success} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: '#111827' }}>{label}</div>
                      </div>
                      <span className="text-xs shrink-0 font-medium" style={{ color: '#D1D5DB' }}>{time}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="text-3xl mb-2">🕐</div>
                <p className="text-sm font-medium mb-1" style={{ color: '#374151' }}>Sem atividade ainda</p>
                <p className="text-xs" style={{ color: '#9CA3AF' }}>Os acessos ao cPanel e Webmail aparecerão aqui</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="fade-in-up-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Gerenciar Hospedagem', href: '/hosting', emoji: '🖥️', color: '#2563EB', bg: 'rgba(59,130,246,0.06)' },
            { label: 'Contas de Email',       href: '/email',   emoji: '📧', color: '#059669', bg: 'rgba(16,185,129,0.06)' },
            { label: 'Meus Domínios',         href: '/domains', emoji: '🌐', color: '#D9A300', bg: 'rgba(245,183,0,0.06)' },
            { label: 'Abrir Ticket',          href: '/tickets', emoji: '🎫', color: '#DC2626', bg: 'rgba(239,68,68,0.06)' },
          ].map(link => (
            <a key={link.href} href={link.href}
              className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5 group"
              style={{ background: link.bg, border: `1px solid ${link.color}20` }}>
              <span className="text-lg">{link.emoji}</span>
              <span className="text-xs font-bold flex-1" style={{ color: link.color }}>{link.label}</span>
              <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: link.color }} />
            </a>
          ))}
        </div>

      </div>
    </>
  )
}
