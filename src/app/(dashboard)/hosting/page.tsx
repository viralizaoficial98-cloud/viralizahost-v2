import { Metadata } from 'next'
import { Server, HardDrive, Wifi, Shield, ExternalLink, Cpu, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Hospedagem — ViralizaHost' }

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

async function fetchServices(userId: string) {
  const supabase = await createClient()
  const result = await supabase
    .from('services')
    .select('id, expires_at, status, plans(name, disk_gb, bandwidth_gb, php_version), hosting_accounts(primary_domain, disk_used_mb, bandwidth_used_mb, email_count, db_count, cpanel_url)')
    .eq('profile_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  return (result.data ?? []) as any[]
}

export default async function HostingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const services = await fetchServices(user.id)

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Hospedagem</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Gerencie os seus planos de hospedagem</p>
        </div>
        <a href="/billing" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <Server size={16} /> Adicionar Plano
        </a>
      </div>

      {services.length > 0 ? (
        <div className="space-y-5">
          {services.map((svc: any) => {
            const plan = svc.plans
            const ha   = svc.hosting_accounts?.[0]
            const diskGb     = plan?.disk_gb ?? 0
            const diskUsedMb = ha?.disk_used_mb ?? 0
            const diskPct    = diskGb > 0 ? Math.round((diskUsedMb / (diskGb * 1024)) * 100) : 0
            const bwGb       = plan?.bandwidth_gb ?? 0
            const bwUsedMb   = ha?.bandwidth_used_mb ?? 0
            const bwPct      = bwGb > 0 ? Math.round((bwUsedMb / (bwGb * 1024)) * 100) : 0
            const expires    = svc.expires_at ? new Date(svc.expires_at).toLocaleDateString('pt-BR') : '—'
            const diskColor  = diskPct > 80 ? '#EF4444' : '#3B82F6'
            const bwColor    = bwPct > 80 ? '#EF4444' : '#10B981'

            return (
              <div key={svc.id} style={card}>
                {/* Plan header */}
                <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                    <Server size={18} style={{ color: '#2563EB' }} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{plan?.name ?? 'Plano'}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      {ha?.primary_domain ?? '—'} · Expira: {expires}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1"
                      style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
                      <Shield size={10} /> SSL
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                      Ativo
                    </span>
                  </div>
                  {ha?.cpanel_url && (
                    <a href={ha.cpanel_url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg transition-colors ml-1"
                      style={{ color: '#94A3B8' }}>
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>

                {/* Metrics */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Storage */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <HardDrive size={13} style={{ color: '#3B82F6' }} />
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Armazenamento</span>
                    </div>
                    <div className="font-bold text-sm mb-2" style={{ color: '#0B0B0D' }}>
                      {(diskUsedMb / 1024).toFixed(1)} GB / {diskGb} GB
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(diskPct, 100)}%`, background: diskColor }} />
                    </div>
                    <div className="text-xs mt-1 font-medium" style={{ color: '#94A3B8' }}>{diskPct}% usado</div>
                  </div>

                  {/* Bandwidth */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Wifi size={13} style={{ color: '#10B981' }} />
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Bandwidth</span>
                    </div>
                    <div className="font-bold text-sm mb-2" style={{ color: '#0B0B0D' }}>
                      {(bwUsedMb / 1024).toFixed(1)} GB / {bwGb} GB
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(bwPct, 100)}%`, background: bwColor }} />
                    </div>
                    <div className="text-xs mt-1 font-medium" style={{ color: '#94A3B8' }}>{bwPct}% usado</div>
                  </div>

                  {/* PHP & DB */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Cpu size={13} style={{ color: '#8B5CF6' }} />
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>PHP / Databases</span>
                    </div>
                    <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>PHP {plan?.php_version ?? '8.2'}</div>
                    <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                      {ha?.db_count ?? 0} Bases de dados · {ha?.email_count ?? 0} Emails
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <ExternalLink size={12} /> Abrir cPanel
                    </button>
                    <button className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
                      <RefreshCw size={12} /> Backup Agora
                    </button>
                  </div>
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
          <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>Escolha um plano e comece a hospedar o seu site hoje mesmo</p>
          <a href="/billing" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
            Ver Planos Disponíveis
          </a>
        </div>
      )}
    </div>
  )
}
