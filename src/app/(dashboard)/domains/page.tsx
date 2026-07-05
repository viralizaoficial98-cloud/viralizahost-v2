import { Metadata } from 'next'
import { Globe, Plus, RefreshCw, Lock, Shield, Clock } from 'lucide-react'
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
  active:                  { label: 'Ativo',        bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
  expired:                 { label: 'Expirado',     bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  pending:                 { label: 'Pendente',     bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
  aguardando_confirmacao:  { label: 'A confirmar',  bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
  rejected:                { label: 'Rejeitado',    bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  transferred:             { label: 'Transferido',  bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
  locked:                  { label: 'Bloqueado',    bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.20)' },
}

async function fetchData(userId: string) {
  const supabase = await createClient()
  const adminDb  = await createAdminClient()

  const [domainsResult, ordersResult] = await Promise.allSettled([
    supabase.from('domains').select('*').eq('profile_id', userId).order('created_at', { ascending: false }),
    (adminDb as any).from('orders')
      .select('id, status, amount, created_at, domain_name, billing_cycle, order_items(service_name, service_type)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const domains = domainsResult.status === 'fulfilled' ? (domainsResult.value.data ?? []) : []
  const allOrders = ordersResult.status === 'fulfilled' ? ((ordersResult.value as any).data ?? []) : []

  // Domain orders: orders that have a domain_name or items of type 'domain'
  const domainOrders = allOrders.filter((o: any) => {
    const items: any[] = o.order_items ?? []
    return o.domain_name || items.some((i: any) => i.service_type === 'domain')
  })

  return { domains: domains as any[], domainOrders: domainOrders as any[] }
}

export default async function DomainsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { domains, domainOrders } = await fetchData(user.id)

  const activeCount  = domains.filter(d => d.status === 'active').length
  const expiredCount = domains.filter(d => d.status === 'expired').length
  const pendingOrderCount = domainOrders.filter((o: any) =>
    o.status === 'aguardando_confirmacao' || o.status === 'pending'
  ).length

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Domínios</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Gerencie todos os seus domínios registados</p>
        </div>
        <a href="/checkout?plan=domain.com" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <Plus size={16} /> Registar Domínio
        </a>
      </div>

      {/* Stats mini */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Ativos',     value: activeCount,       accent: '#059669', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)' },
          { label: 'Expirados',  value: expiredCount,      accent: '#DC2626', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.15)' },
          { label: 'Pendentes',  value: pendingOrderCount, accent: '#D9A300', bg: 'rgba(245,183,0,0.08)',   border: 'rgba(245,183,0,0.20)' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: s.accent }}>{s.label}</div>
            <div className="text-3xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pending orders */}
      {domainOrders.filter((o: any) => o.status === 'aguardando_confirmacao' || o.status === 'pending').length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(245,183,0,0.05)', border: '1px solid rgba(245,183,0,0.20)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} style={{ color: '#D9A300' }} />
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Pedidos Aguardando Confirmação</h2>
          </div>
          <div className="space-y-3">
            {domainOrders
              .filter((o: any) => o.status === 'aguardando_confirmacao' || o.status === 'pending')
              .map((order: any) => {
                const domainLabel = order.domain_name ??
                  order.order_items?.find((i: any) => i.service_type === 'domain')?.service_name ?? 'Domínio'
                const date = new Date(order.created_at).toLocaleDateString('pt-AO')
                const fmtAmt = `Kz ${Math.round(order.amount).toLocaleString('pt-AO')}`
                return (
                  <div key={order.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-white"
                    style={{ border: '1px solid rgba(245,183,0,0.25)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
                        <Globe size={15} style={{ color: '#D9A300' }} />
                      </div>
                      <div>
                        <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{domainLabel}</div>
                        <div className="text-xs" style={{ color: '#94A3B8' }}>Enviado em {date}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm" style={{ color: '#0B0B0D' }}>{fmtAmt}</span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(245,183,0,0.15)', color: '#D9A300' }}>
                        A confirmar
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>
          <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>
            O seu pagamento está a ser verificado. Será notificado por email após confirmação (até 24h úteis).
          </p>
        </div>
      )}

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
            {domains.length} domínio{domains.length !== 1 ? 's' : ''}
          </span>
        </div>

        {domains.length > 0 ? (
          <div>
            {domains.map((domain: any, i: number) => {
              const s = statusMap[domain.status] ?? statusMap.pending
              const expires = domain.expires_at ? new Date(domain.expires_at).toLocaleDateString('pt-BR') : '—'
              const name = domain.full_domain ?? ((domain.name ?? '') + (domain.extension ?? ''))
              return (
                <div key={domain.id}
                  className="px-6 py-4 flex items-center gap-4"
                  style={{ borderBottom: i < domains.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
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
                      Expira: {expires}{domain.registrar ? ` · ${domain.registrar}` : ''}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3">
                    {domain.auto_renew && (
                      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#059669' }}>
                        <RefreshCw size={11} /> Auto-renovar
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#2563EB' }}>
                      <Shield size={11} /> SSL
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
            <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>Registe o seu primeiro domínio e comece a construir a sua presença online</p>
            <a href="/checkout?plan=domain.com" className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
              Registar primeiro domínio
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
