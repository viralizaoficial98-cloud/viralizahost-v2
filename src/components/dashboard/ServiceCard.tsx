'use client'

interface ServiceCardProps {
  svc: any
}

export function ServiceCard({ svc }: ServiceCardProps) {
  const plan = svc.plans
  const ha = svc.hosting_accounts?.[0]
  const diskPct = plan && ha ? Math.round((ha.disk_used_mb / (plan.disk_gb * 1024)) * 100) : 0
  const bwPct = plan?.bandwidth_gb ? Math.round((ha?.bandwidth_used_mb / (plan.bandwidth_gb * 1024)) * 100) : 0
  const expires = svc.expires_at ? new Date(svc.expires_at).toLocaleDateString('pt-BR') : '—'

  return (
    <div
      key={svc.id}
      className="rounded-xl p-4 transition-all duration-200"
      style={{ background: '#F8F9FB', border: '1px solid #E5E7EB' }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,183,0,0.40)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
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
            <span>Armazenamento</span>
            <span className="font-semibold" style={{ color: '#6B7280' }}>{diskPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(diskPct, 100)}%`, background: '#F5B700' }} />
          </div>
        </div>
        {plan?.bandwidth_gb > 0 && (
          <div>
            <div className="flex justify-between text-xs mb-1.5" style={{ color: '#9CA3AF' }}>
              <span>Bandwidth</span>
              <span className="font-semibold" style={{ color: '#6B7280' }}>{bwPct}%</span>
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
}
