import { Metadata } from 'next'
import { Globe, Plus, RefreshCw, Lock, Shield, Server } from 'lucide-react'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Domínios — ViralizaHost' }

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

const statusMap: Record<string, { label: string; bg: string; color: string; border: string }> = {
  active:      { label: 'Ativo',       bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  suspended:   { label: 'Suspenso',    bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  expired:     { label: 'Expirado',    bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  pending:     { label: 'Pendente',    bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
  cancelled:   { label: 'Cancelado',   bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
  transferred: { label: 'Transferido', bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
  locked:      { label: 'Bloqueado',   bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
}

async function fetchDomains(userId: string) {
  const db = createAdminWriteClient()

  const [haResult, domainsResult] = await Promise.allSettled([
    // Primary domains from hosting accounts (WHM)
    db.from('hosting_accounts')
      .select('id, primary_domain, status, last_synced_at, package_name, ip_address')
      .eq('profile_id', userId)
      .not('primary_domain', 'is', null),

    // Portal-registered domains
    db.from('domains')
      .select('id, name, full_domain, extension, status, expires_at, auto_renew, registrar, is_locked, nameservers, registered_at')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const hostingAccounts = haResult.status === 'fulfilled' ? (haResult.value.data ?? []) : []
  const portalDomains   = domainsResult.status === 'fulfilled' ? (domainsResult.value.data ?? []) : []

  // Build domain list: hosting primary domains first, then registered
  const hostingDomains = (hostingAccounts as any[]).map((ha: any) => ({
    id: `ha-${ha.id}`,
    name: ha.primary_domain,
    full_domain: ha.primary_domain,
    status: ha.status === 'suspended' ? 'suspended' : 'active',
    type: 'principal',
    source: 'whm',
    ip_address: ha.ip_address,
    package_name: ha.package_name,
    last_synced_at: ha.last_synced_at,
    expires_at: null,
    auto_renew: null,
    registrar: null,
    is_locked: false,
  }))

  // Avoid duplicates (domain registered AND in hosting)
  const hostingDomainNames = new Set(hostingDomains.map((d: any) => d.full_domain?.toLowerCase()))
  const uniquePortalDomains = (portalDomains as any[]).filter(
    (d: any) => !hostingDomainNames.has((d.full_domain ?? d.name)?.toLowerCase())
  ).map((d: any) => ({ ...d, type: 'registrado', source: 'portal' }))

  const allDomains = [...hostingDomains, ...uniquePortalDomains]

  return allDomains
}

export default async function DomainsPage() {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) redirect('/login')

  const allDomains = await fetchDomains(user.id)

  const activeCount   = allDomains.filter((d: any) => d.status === 'active').length
  const expiredCount  = allDomains.filter((d: any) => d.status === 'expired').length
  const pendingCount  = allDomains.filter((d: any) => d.status === 'pending' || d.status === 'suspended').length

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Domínios</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Gerencie todos os seus domínios registados</p>
        </div>
        <a href="/checkout?plan=domain.com"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <Plus size={16} /> Registar Domínio
        </a>
      </div>

      {/* Stats mini */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ativos',    value: activeCount,  accent: '#059669', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)' },
          { label: 'Expirados', value: expiredCount, accent: '#DC2626', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.15)' },
          { label: 'Pendentes', value: pendingCount, accent: '#D9A300', bg: 'rgba(245,183,0,0.08)',   border: 'rgba(245,183,0,0.20)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: s.accent }}>{s.label}</div>
            <div className="text-3xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div style={card}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
            <Globe size={15} style={{ color: '#D9A300' }} />
          </div>
          <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Meus Domínios</h2>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {allDomains.length} domínio{allDomains.length !== 1 ? 's' : ''}
          </span>
        </div>

        {allDomains.length > 0 ? (
          <div>
            {allDomains.map((domain: any, i: number) => {
              const s = statusMap[domain.status] ?? statusMap.pending
              const expires = domain.expires_at ? new Date(domain.expires_at).toLocaleDateString('pt-AO') : null
              const lastSync = domain.last_synced_at ? new Date(domain.last_synced_at).toLocaleDateString('pt-AO') : null
              const name = domain.full_domain ?? domain.name ?? '—'
              const isLast = i === allDomains.length - 1
              const isWHM = domain.source === 'whm'

              return (
                <div key={domain.id}
                  className="px-6 py-4 flex items-center gap-4"
                  style={{ borderBottom: isLast ? 'none' : '1px solid #F8FAFC' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.15)' }}>
                    <Globe size={17} style={{ color: '#D9A300' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{name}</span>
                      {domain.is_locked && <Lock size={11} style={{ color: '#94A3B8' }} />}
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: isWHM ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)', color: isWHM ? '#2563EB' : '#059669' }}>
                        {domain.type}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 flex items-center gap-3 flex-wrap" style={{ color: '#94A3B8' }}>
                      {domain.ip_address && (
                        <span className="flex items-center gap-1"><Server size={9} /> {domain.ip_address}</span>
                      )}
                      {expires && <span>Expira: {expires}</span>}
                      {lastSync && <span className="flex items-center gap-1"><RefreshCw size={9} /> {lastSync}</span>}
                      {domain.registrar && <span>{domain.registrar}</span>}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3">
                    {domain.auto_renew && domain.status === 'active' && (
                      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#059669' }}>
                        <RefreshCw size={11} /> Auto-renovar
                      </div>
                    )}
                    {domain.status === 'active' && (
                      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#2563EB' }}>
                        <Shield size={11} /> SSL
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.15)' }}>
              <Globe size={28} style={{ color: '#D9A300' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhum domínio encontrado</p>
            <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
              Registe o seu primeiro domínio ou sincronize a sua conta de hospedagem
            </p>
            <a href="/checkout?plan=domain.com"
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-black inline-block"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
              Registar primeiro domínio
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
