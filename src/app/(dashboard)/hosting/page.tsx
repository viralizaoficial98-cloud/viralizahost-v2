import { Metadata } from 'next'
import { Server, HardDrive, Wifi, Shield, Cpu, Globe, Mail, Database, RefreshCw, AlertCircle } from 'lucide-react'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SSOButtons } from '@/components/hosting/SSOButtons'

export const metadata: Metadata = { title: 'Hospedagem — ViralizaHost' }

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

async function fetchHostingData(userId: string) {
  // Use service_role client to bypass RLS — security enforced by profile_id filter
  const db = createAdminWriteClient()

  // Get hosting accounts for this user
  const { data: hostingAccounts, error: haErr } = await db
    .from('hosting_accounts')
    .select('id, service_id, cpanel_username, primary_domain, status, disk_used_mb, disk_limit_mb, bandwidth_used_mb, email_count, db_count, php_version, ssl_enabled, package_name, ip_address, suspension_reason, last_synced_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })

  if (haErr) console.error('[hosting] hosting_accounts error:', haErr.message)

  const accounts = (hostingAccounts ?? []) as any[]

  // Enrich with whm_accounts data (server hostname, plan details)
  const whmData: Record<string, any> = {}
  if (accounts.length > 0) {
    const haIds = accounts.map((a: any) => a.id)
    const { data: whmRows } = await db
      .from('whm_accounts')
      .select('hosting_account_id, whm_username, primary_domain, package_name, ip_address, php_version, max_pop, max_sub, max_sql, max_ftp, account_created_at, last_synced_at, sync_status')
      .in('hosting_account_id', haIds)
    for (const w of (whmRows ?? []) as any[]) {
      if (w.hosting_account_id) whmData[w.hosting_account_id] = w
    }
  }

  // Get plan mappings for human-readable package names
  const { data: mappings } = await db
    .from('whm_package_mappings')
    .select('whm_package_name, label, plan_id, plans(name)')

  const packageLabel: Record<string, string> = {}
  for (const m of (mappings ?? []) as any[]) {
    packageLabel[m.whm_package_name] = m.label ?? m.plans?.name ?? m.whm_package_name
  }

  // Get server info
  const { data: serverRow } = await db
    .from('servers')
    .select('hostname, location')
    .eq('name', '__whm_config__')
    .maybeSingle()

  return { accounts, whmData, packageLabel, server: serverRow }
}

export default async function HostingPage() {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) redirect('/login')

  const { accounts, whmData, packageLabel, server } = await fetchHostingData(user.id)

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Hospedagem</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Gerencie os seus planos de hospedagem cPanel</p>
        </div>
        <a href="/email" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <Mail size={16} /> Gerir Emails
        </a>
      </div>

      {accounts.length > 0 ? (
        <div className="space-y-6">
          {accounts.map((ha: any) => {
            const whm         = whmData[ha.id]
            const diskUsed    = ha.disk_used_mb ?? 0
            const diskLimit   = ha.disk_limit_mb ?? 0
            const diskPct     = diskLimit > 0 ? Math.min(Math.round((diskUsed / diskLimit) * 100), 100) : 0
            const diskColor   = diskPct > 80 ? '#EF4444' : '#3B82F6'
            const bwUsed      = ha.bandwidth_used_mb ?? 0
            const pkgRaw      = whm?.package_name ?? ha.package_name
            const pkgName     = pkgRaw ? (packageLabel[pkgRaw] ?? pkgRaw) : 'Plano Importado do WHM'
            const isSuspended = ha.status === 'suspended'
            const lastSync    = ha.last_synced_at ? new Date(ha.last_synced_at) : null
            const ipAddress   = whm?.ip_address ?? ha.ip_address
            const emailCount  = ha.email_count ?? 0
            const dbCount     = ha.db_count ?? 0

            return (
              <div key={ha.id} style={card}>
                {/* Plan header */}
                <div className="px-6 py-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: isSuspended ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)', border: `1px solid ${isSuspended ? 'rgba(239,68,68,0.20)' : 'rgba(59,130,246,0.15)'}` }}>
                    <Server size={18} style={{ color: isSuspended ? '#DC2626' : '#2563EB' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{pkgName}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: '#94A3B8' }}>
                      <span className="flex items-center gap-1"><Globe size={10} /> {ha.primary_domain}</span>
                      {ipAddress && <span>IP: {ipAddress}</span>}
                      {server?.hostname && <span>Servidor: {server.hostname}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isSuspended && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
                        <Shield size={10} /> SSL
                      </span>
                    )}
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={isSuspended
                        ? { background: 'rgba(239,68,68,0.10)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)' }
                        : { background: 'rgba(16,185,129,0.10)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}>
                      {isSuspended ? 'Suspenso' : 'Ativo'}
                    </span>
                  </div>
                </div>

                {/* Suspension notice */}
                {isSuspended && ha.suspension_reason && (
                  <div className="mx-6 mt-4 flex items-start gap-2 p-3 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                    <AlertCircle size={14} style={{ color: '#DC2626', marginTop: 1 }} />
                    <p className="text-xs" style={{ color: '#B91C1C' }}>
                      Motivo da suspensão: {ha.suspension_reason}
                    </p>
                  </div>
                )}

                {/* Metrics */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Storage */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <HardDrive size={13} style={{ color: '#3B82F6' }} />
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Armazenamento</span>
                    </div>
                    <div className="font-bold text-sm mb-2" style={{ color: '#0B0B0D' }}>
                      {(diskUsed / 1024).toFixed(2)} GB
                      {diskLimit > 0 ? ` / ${(diskLimit / 1024).toFixed(2)} GB` : ' / Ilimitado'}
                    </div>
                    {diskLimit > 0 && (
                      <>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${diskPct}%`, background: diskColor }} />
                        </div>
                        <div className="text-xs mt-1 font-medium" style={{ color: '#94A3B8' }}>{diskPct}% usado</div>
                      </>
                    )}
                  </div>

                  {/* Resources */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Cpu size={13} style={{ color: '#8B5CF6' }} />
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Recursos</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#0B0B0D' }}>
                        <Mail size={11} style={{ color: '#94A3B8' }} />
                        <span className="font-semibold">{emailCount}</span>
                        <span style={{ color: '#94A3B8' }}>contas de email</span>
                        {whm?.max_pop && whm.max_pop !== 'unlimited' && (
                          <span style={{ color: '#94A3B8' }}>/ {whm.max_pop}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#0B0B0D' }}>
                        <Database size={11} style={{ color: '#94A3B8' }} />
                        <span className="font-semibold">{dbCount}</span>
                        <span style={{ color: '#94A3B8' }}>bases de dados</span>
                        {whm?.max_sql && whm.max_sql !== 'unlimited' && (
                          <span style={{ color: '#94A3B8' }}>/ {whm.max_sql}</span>
                        )}
                      </div>
                      {(ha.php_version || whm?.php_version) && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: '#0B0B0D' }}>
                          <Wifi size={11} style={{ color: '#94A3B8' }} />
                          <span>PHP {whm?.php_version ?? ha.php_version}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Access */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Server size={13} style={{ color: '#F5B700' }} />
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Acesso Direto</span>
                    </div>
                    {ha.service_id ? (
                      <SSOButtons serviceId={ha.service_id} />
                    ) : (
                      <p className="text-xs" style={{ color: '#94A3B8' }}>SSO não disponível</p>
                    )}
                    {pkgRaw && pkgRaw !== pkgName && (
                      <div className="text-[11px] mt-2" style={{ color: '#CBD5E1' }}>
                        Pacote WHM: {pkgRaw}
                      </div>
                    )}
                  </div>
                </div>

                {/* Details footer */}
                <div className="px-6 pb-4 flex items-center gap-4 flex-wrap" style={{ borderTop: '1px solid #F8FAFC' }}>
                  {lastSync && (
                    <div className="flex items-center gap-1.5 pt-3 text-xs" style={{ color: '#94A3B8' }}>
                      <RefreshCw size={11} />
                      Sincronizado: {lastSync.toLocaleString('pt-AO', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}
                  <a href="/email" className="pt-3 text-xs font-semibold flex items-center gap-1" style={{ color: '#2563EB' }}>
                    <Mail size={11} /> Ver emails
                  </a>
                  <a href="/tickets" className="pt-3 text-xs font-semibold flex items-center gap-1" style={{ color: '#D9A300' }}>
                    Abrir ticket
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-16 text-center" style={card}>
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <Server size={28} style={{ color: '#2563EB' }} />
          </div>
          <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhum plano de hospedagem ativo</p>
          <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
            A sua conta de hospedagem está a ser configurada ou ainda não possui um plano ativo
          </p>
          <a href="/billing" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
            Ver Planos Disponíveis
          </a>
        </div>
      )}
    </div>
  )
}
