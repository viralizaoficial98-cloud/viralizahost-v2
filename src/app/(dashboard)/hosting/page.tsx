import { Metadata } from 'next'
import { Server, Mail } from 'lucide-react'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HostingCard } from '@/components/hosting/HostingCard'

export const metadata: Metadata = { title: 'Hospedagem — ViralizaHost' }

async function fetchHostingData(userId: string) {
  const db = createAdminWriteClient()

  const { data: hostingAccounts, error: haErr } = await db
    .from('hosting_accounts')
    .select('id, service_id, cpanel_username, primary_domain, status, disk_used_mb, disk_limit_mb, bandwidth_used_mb, email_count, db_count, php_version, ssl_enabled, package_name, ip_address, suspension_reason, last_synced_at')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })

  if (haErr) console.error('[hosting] hosting_accounts error:', haErr.message)

  const accounts = (hostingAccounts ?? []) as any[]

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

  const { data: mappings } = await db
    .from('whm_package_mappings')
    .select('whm_package_name, label, plan_id, plans(name)')

  const packageLabel: Record<string, string> = {}
  for (const m of (mappings ?? []) as any[]) {
    packageLabel[m.whm_package_name] = m.label ?? m.plans?.name ?? m.whm_package_name
  }

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
          {accounts.map((ha: any, index: number) => {
            const whm    = whmData[ha.id] ?? null
            const pkgRaw = whm?.package_name ?? ha.package_name
            const pkgName = pkgRaw ? (packageLabel[pkgRaw] ?? pkgRaw) : 'Plano Importado do WHM'
            return (
              <HostingCard
                key={ha.id}
                ha={ha}
                whm={whm}
                pkgName={pkgName}
                server={server}
                index={index}
              />
            )
          })}
        </div>
      ) : (
        <div className="py-16 text-center rounded-2xl"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(15,23,42,0.06)' }}>
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
