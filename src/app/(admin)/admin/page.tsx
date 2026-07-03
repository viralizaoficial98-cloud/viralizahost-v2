import { Metadata } from 'next'
import { Users, Server, Globe, Activity, Image, Mail, UserCheck, LayoutGrid, TrendingUp, CheckCircle2 } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Admin Dashboard — ViralizaHost' }

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

async function fetchAdminData() {
  const supabase = await createAdminClient()

  const results = await Promise.allSettled([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress'] as any),
    supabase.from('domains').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('id, full_name, email, created_at, services(plans(name))').eq('role', 'client').order('created_at', { ascending: false }).limit(5),
    supabase.from('servers').select('id, name, is_active, current_load').order('name'),
    supabase.from('invoices').select('total').eq('status', 'paid').gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    // Site content stats
    supabase.from('site_banners').select('*', { count: 'exact', head: true }),
    supabase.from('site_domains').select('*', { count: 'exact', head: true }),
    supabase.from('site_email_plans').select('*', { count: 'exact', head: true }),
    supabase.from('site_team').select('*', { count: 'exact', head: true }),
    supabase.from('site_hosting_plans').select('*', { count: 'exact', head: true }),
  ])

  const getCount = (r: typeof results[0]) => r.status === 'fulfilled' ? ((r.value as any).count ?? 0) : 0
  const getData  = (r: typeof results[0]): any[] => r.status === 'fulfilled' ? ((r.value as any).data ?? []) : []

  const monthRevenue = getData(results[6])
  const monthTotal   = monthRevenue.reduce((s, i) => s + Number(i.total), 0)

  return {
    totalClients:   getCount(results[0]),
    activeServices: getCount(results[1]),
    openTickets:    getCount(results[2]),
    totalDomains:   getCount(results[3]),
    recentClients:  getData(results[4]),
    servers:        getData(results[5]),
    monthTotal,
    siteBanners:      getCount(results[7]),
    siteDomains:      getCount(results[8]),
    siteEmailPlans:   getCount(results[9]),
    siteTeam:         getCount(results[10]),
    siteHostingPlans: getCount(results[11]),
  }
}

export default async function AdminPage() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  if ((profile as any)?.role !== 'admin') redirect('/dashboard')

  const {
    totalClients, activeServices, openTickets, totalDomains,
    recentClients, servers, monthTotal,
    siteBanners, siteDomains, siteEmailPlans, siteTeam, siteHostingPlans,
  } = await fetchAdminData()

  const now = new Date()

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Dashboard Administrativo</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Visão geral completa da plataforma ViralizaHost</p>
      </div>

      {/* Platform stats */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>Plataforma</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total de Clientes" value={String(totalClients)}  type="clients" />
          <StatsCard title="Planos Ativos"     value={String(activeServices)} type="hosting" />
          <StatsCard title="Receita este Mês"  value={`$${monthTotal.toFixed(0)}`} type="revenue" />
          <StatsCard title="Tickets Abertos"   value={String(openTickets)}   type="messages" />
        </div>
      </div>

      {/* Site content stats */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#94A3B8' }}>Conteúdo do Site</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Banners',        value: siteBanners,      color: '#F5B700', bg: 'rgba(245,183,0,0.08)',   border: 'rgba(245,183,0,0.20)',  Icon: Image },
            { label: 'Domínios',       value: siteDomains,      color: '#3B82F6', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.15)', Icon: Globe },
            { label: 'Planos Email',   value: siteEmailPlans,   color: '#10B981', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)', Icon: Mail },
            { label: 'Equipa',         value: siteTeam,         color: '#8B5CF6', bg: 'rgba(139,92,246,0.06)',  border: 'rgba(139,92,246,0.15)', Icon: UserCheck },
            { label: 'Planos Hosting', value: siteHostingPlans, color: '#EA580C', bg: 'rgba(234,88,12,0.06)',   border: 'rgba(234,88,12,0.15)',  Icon: LayoutGrid },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <div className="flex items-center gap-1.5 mb-2">
                <s.Icon size={13} style={{ color: s.color }} />
                <span className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</span>
              </div>
              <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent clients + Servers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent clients */}
        <div className="lg:col-span-2 p-6" style={card}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
              <Users size={15} style={{ color: '#D9A300' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Clientes Recentes</h2>
          </div>
          {recentClients.length > 0 ? recentClients.map((c: any) => {
            const plan = c.services?.[0]?.plans?.name ?? '—'
            const diff = Math.round((now.getTime() - new Date(c.created_at).getTime()) / 60000)
            const label = diff < 60 ? `Há ${diff}m` : diff < 1440 ? `Há ${Math.round(diff/60)}h` : `Há ${Math.round(diff/1440)}d`
            return (
              <div key={c.id} className="flex items-center gap-3 py-3.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                  style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)', color: '#D9A300' }}>
                  {(c.full_name?.[0] ?? c.email[0]).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>{c.full_name || 'Sem nome'}</div>
                  <div className="text-xs truncate" style={{ color: '#94A3B8' }}>{c.email}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}>
                    {plan}
                  </span>
                  <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>{label}</div>
                </div>
              </div>
            )
          }) : (
            <div className="py-8 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum cliente ainda</div>
          )}
        </div>

        {/* Servers */}
        <div className="p-6" style={card}>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <Activity size={15} style={{ color: '#059669' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Status dos Servidores</h2>
          </div>
          {servers.length > 0 ? (
            <div className="space-y-3">
              {servers.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.is_active ? '#10B981' : '#EF4444' }} />
                    <span className="text-sm font-medium" style={{ color: '#0B0B0D' }}>{s.name}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: s.is_active ? '#059669' : '#DC2626' }}>
                    {s.is_active ? `${s.current_load}%` : 'Offline'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum servidor configurado</div>
          )}
          <div className="mt-5 pt-4 grid grid-cols-2 gap-3" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="text-center py-3 rounded-xl" style={{ background: '#F8FAFC' }}>
              <div className="text-xl font-black" style={{ color: '#0B0B0D' }}>{totalDomains}</div>
              <div className="text-xs font-medium flex items-center justify-center gap-1 mt-0.5" style={{ color: '#64748B' }}>
                <Globe size={10} /> Domínios
              </div>
            </div>
            <div className="text-center py-3 rounded-xl" style={{ background: '#F8FAFC' }}>
              <div className="text-xl font-black" style={{ color: '#0B0B0D' }}>{servers.filter((s: any) => s.is_active).length}</div>
              <div className="text-xs font-medium flex items-center justify-center gap-1 mt-0.5" style={{ color: '#64748B' }}>
                <CheckCircle2 size={10} /> Online
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
