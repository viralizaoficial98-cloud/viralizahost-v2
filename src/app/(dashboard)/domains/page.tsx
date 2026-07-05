import { Metadata } from 'next'
import { Globe, Plus, RefreshCw, Lock, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
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
  expired:     { label: 'Expirado',    bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  pending:     { label: 'Pendente',    bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
  cancelled:   { label: 'Cancelado',   bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
  transferred: { label: 'Transferido', bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
  locked:      { label: 'Bloqueado',   bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
}

async function fetchData(userId: string) {
  const supabase  = await createClient()
  const adminDb   = await createAdminClient()

  // Domains from the domains table (includes pending ones created by RPC)
  const domainsResult = await supabase
    .from('domains')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })

  // Pending orders that have a domain_name but no entry yet in domains table
  // (fallback for edge cases where RPC partial-failed)
  const ordersResult = await (adminDb as any)
    .from('orders')
    .select('id, status, amount, created_at, domain_name')
    .eq('user_id', userId)
    .not('domain_name', 'is', null)
    .in('status', ['pending', 'aguardando_confirmacao'])
    .order('created_at', { ascending: false })

  const domains = (domainsResult.data ?? []) as any[]
  const orders  = ((ordersResult as any).data ?? []) as any[]

  // Only show pending orders that aren't already reflected in the domains table
  const domainNames = new Set(domains.map((d: any) => d.name))
  const orphanOrders = orders.filter((o: any) => o.domain_name && !domainNames.has(o.domain_name))

  return { domains, orphanOrders }
}

export default async function DomainsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { domains, orphanOrders } = await fetchData(user.id)

  const activeCount   = domains.filter(d => d.status === 'active').length
  const expiredCount  = domains.filter(d => d.status === 'expired').length
  const pendingCount  = domains.filter(d => d.status === 'pending').length + orphanOrders.length

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
            {domains.length + orphanOrders.length} domínio{(domains.length + orphanOrders.length) !== 1 ? 's' : ''}
          </span>
        </div>

        {domains.length > 0 || orphanOrders.length > 0 ? (
          <div>
            {/* Domains from domains table */}
            {domains.map((domain: any, i: number) => {
              const s = statusMap[domain.status] ?? statusMap.pending
              const expires = domain.expires_at ? new Date(domain.expires_at).toLocaleDateString('pt-AO') : '—'
              const name = domain.full_domain ?? domain.name ?? '—'
              const isLast = i === domains.length - 1 && orphanOrders.length === 0
              return (
                <div key={domain.id}
                  className="px-6 py-4 flex items-center gap-4"
                  style={{ borderBottom: isLast ? 'none' : '1px solid #F8FAFC' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.15)' }}>
                    <Globe size={17} style={{ color: '#D9A300' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{name}</span>
                      {domain.is_locked && <Lock size={11} style={{ color: '#94A3B8' }} />}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      {domain.status === 'pending'
                        ? 'Aguardando confirmação de pagamento'
                        : `Expira: ${expires}${domain.registrar ? ` · ${domain.registrar}` : ''}`}
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

            {/* Orphan orders (edge case fallback) */}
            {orphanOrders.map((order: any, i: number) => {
              const s = statusMap.pending
              return (
                <div key={order.id}
                  className="px-6 py-4 flex items-center gap-4"
                  style={{ borderBottom: i < orphanOrders.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.15)' }}>
                    <Globe size={17} style={{ color: '#D9A300' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{order.domain_name}</span>
                    <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      Aguardando confirmação de pagamento
                    </div>
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
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhum domínio registado</p>
            <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
              Registe o seu primeiro domínio e comece a construir a sua presença online
            </p>
            <a href="/checkout?plan=domain.com"
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-black inline-block"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
              Registar primeiro domínio
            </a>
          </div>
        )}
      </div>

      {pendingCount > 0 && (
        <p className="text-xs text-center" style={{ color: '#9CA3AF' }}>
          Os pagamentos são verificados em até 24h úteis. Receberá confirmação por e-mail.
        </p>
      )}
    </div>
  )
}
