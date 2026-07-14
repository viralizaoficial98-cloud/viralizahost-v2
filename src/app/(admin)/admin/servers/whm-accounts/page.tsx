import { Metadata } from 'next'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Server, Users, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Search } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Contas WHM — Admin ViralizaHost' }

const card = {
  background: '#FFFFFF', border: '1px solid #E5E7EB',
  borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

interface PageProps {
  searchParams: Promise<{ status?: string; linked?: string; package?: string; search?: string; page?: string }>
}

function DiskBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-xs" style={{ color: '#94A3B8' }}>{used} MB / Ilimitado</span>
  const pct = Math.round((used / limit) * 100)
  const color = pct > 85 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981'
  return (
    <div className="space-y-1">
      <div className="text-xs" style={{ color: '#64748B' }}>
        {(used / 1024).toFixed(1)} GB / {(limit / 1024).toFixed(1)} GB
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9', width: 80 }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <div className="text-[11px]" style={{ color: '#94A3B8' }}>{pct}%</div>
    </div>
  )
}

function StatusBadge({ status, suspended }: { status: string; suspended: boolean }) {
  if (suspended || status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(239,68,68,0.10)', color: '#DC2626' }}>
        <AlertTriangle size={10} /> Suspenso
      </span>
    )
  }
  if (status === 'missing_from_whm') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(100,116,139,0.10)', color: '#64748B' }}>
        Ausente do WHM
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: 'rgba(16,185,129,0.10)', color: '#059669' }}>
      <CheckCircle2 size={10} /> Ativo
    </span>
  )
}

export default async function WhmAccountsPage({ searchParams }: PageProps) {
  const authDb = await createClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) redirect('/login')

  const db = createAdminWriteClient()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((profile as { role?: string } | null)?.role !== 'admin') redirect('/dashboard')

  const sp = await searchParams
  const status  = sp.status ?? ''
  const linked  = sp.linked ?? ''
  const pkg     = sp.package ?? ''
  const search  = sp.search?.toLowerCase() ?? ''
  const page    = Math.max(1, parseInt(sp.page ?? '1'))
  const limit   = 50

  let q = db
    .from('whm_accounts')
    .select(`
      id, whm_username, primary_domain, contact_email, package_name,
      ip_address, disk_used_mb, disk_limit_mb, is_suspended, suspension_reason,
      status, last_synced_at, profile_id, service_id, hosting_account_id,
      profiles(id, full_name, email)
    `, { count: 'exact' })
    .order('primary_domain', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)

  if (status) q = q.eq('status', status)
  if (pkg)    q = q.eq('package_name', pkg)
  if (linked === 'true')  q = q.not('profile_id', 'is', null)
  if (linked === 'false') q = q.is('profile_id', null)

  const { data: rawData, count } = await q
  const rows = (rawData ?? []) as Record<string, unknown>[]

  const filtered = search
    ? rows.filter(r =>
        String(r.primary_domain ?? '').toLowerCase().includes(search) ||
        String(r.whm_username   ?? '').toLowerCase().includes(search) ||
        String(r.contact_email  ?? '').toLowerCase().includes(search) ||
        String((r.profiles as Record<string, unknown> | null)?.full_name ?? '').toLowerCase().includes(search)
      )
    : rows

  const total = count ?? 0
  const totalPages = Math.ceil(total / limit)

  // Summary counts
  const { data: summaryRaw } = await db
    .from('whm_accounts')
    .select('status, is_suspended, profile_id')
  const all = (summaryRaw ?? []) as Array<{ status: string; is_suspended: boolean; profile_id: string | null }>
  const summary = {
    total:       all.length,
    active:      all.filter(r => !r.is_suspended && r.status === 'active').length,
    suspended:   all.filter(r => r.is_suspended || r.status === 'suspended').length,
    missing:     all.filter(r => r.status === 'missing_from_whm').length,
    unlinked:    all.filter(r => !r.profile_id).length,
  }

  function filterUrl(extra: Record<string, string>) {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (linked) p.set('linked', linked)
    if (pkg)    p.set('package', pkg)
    if (search) p.set('search', search)
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    const s = p.toString()
    return `/admin/servers/whm-accounts${s ? '?' + s : ''}`
  }

  function fmtDate(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
            <Server size={20} style={{ color: '#D9A300' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Contas WHM</h1>
            <p className="text-sm" style={{ color: '#64748B' }}>Contas importadas do servidor WHM/cPanel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/settings" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
            <RefreshCw size={13} /> Sincronizar
          </Link>
          <Link href="/admin/servers" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
            <Server size={13} /> Servidores
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: summary.total,     color: '#475569', href: filterUrl({ status: '', linked: '' }) },
          { label: 'Ativos', value: summary.active,   color: '#059669', href: filterUrl({ status: 'active', linked: '' }) },
          { label: 'Suspensos', value: summary.suspended, color: '#DC2626', href: filterUrl({ status: 'suspended', linked: '' }) },
          { label: 'Sem cliente', value: summary.unlinked, color: '#D9A300', href: filterUrl({ linked: 'false', status: '' }) },
          { label: 'Ausentes WHM', value: summary.missing, color: '#94A3B8', href: filterUrl({ status: 'missing_from_whm', linked: '' }) },
        ].map(s => (
          <Link key={s.label} href={s.href} className="rounded-2xl p-4 text-center transition-all hover:shadow-md" style={card}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4" style={card}>
        <div className="flex flex-wrap gap-3">
          {/* Search form */}
          <form method="get" action="/admin/servers/whm-accounts" className="flex items-center gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            {linked && <input type="hidden" name="linked" value={linked} />}
            {pkg    && <input type="hidden" name="package" value={pkg} />}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
              <input
                name="search"
                defaultValue={search}
                placeholder="Domínio, username, email…"
                className="pl-8 pr-4 py-2 text-xs rounded-xl"
                style={{ border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0B0B0D', outline: 'none', minWidth: 220 }}
              />
            </div>
            <button type="submit" className="px-3 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#F5B700', color: '#000' }}>
              Pesquisar
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Todos',       href: filterUrl({ status: '', linked: '' }) },
              { label: 'Ativos',      href: filterUrl({ status: 'active' }) },
              { label: 'Suspensos',   href: filterUrl({ status: 'suspended' }) },
              { label: 'Sem cliente', href: filterUrl({ linked: 'false', status: '' }) },
              { label: 'Com cliente', href: filterUrl({ linked: 'true',  status: '' }) },
            ].map(f => {
              const isActive = f.href === `/admin/servers/whm-accounts${new URLSearchParams(
                Object.fromEntries(Object.entries({ status, linked, package: pkg, search }).filter(([,v]) => v))
              ).toString() ? '?' + new URLSearchParams(Object.fromEntries(Object.entries({ status, linked, package: pkg, search }).filter(([,v]) => v))).toString() : ''}`
              return (
                <Link key={f.label} href={f.href}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? '#F5B700' : '#F1F5F9',
                    color: isActive ? '#000' : '#64748B',
                    border: '1px solid transparent',
                  }}>
                  {f.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={card} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                {['Domínio / Username', 'Cliente', 'E-mail', 'Pacote', 'Espaço', 'IP', 'Estado', 'Sincronizado', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12" style={{ color: '#94A3B8' }}>
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    Nenhuma conta encontrada. Execute a sincronização primeiro.
                  </td>
                </tr>
              )}
              {filtered.map((row, idx) => {
                const prof = row.profiles as Record<string, unknown> | null
                return (
                  <tr key={String(row.id)} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                    className="hover:bg-slate-50 transition-colors">

                    {/* Domain / username */}
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: '#0B0B0D' }}>{String(row.primary_domain)}</div>
                      <div className="text-[11px]" style={{ color: '#94A3B8' }}>{String(row.whm_username)}</div>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3">
                      {prof ? (
                        <Link href={`/admin/clients`}
                          className="font-medium text-blue-600 hover:underline text-xs">
                          {String(prof.full_name ?? '—')}
                        </Link>
                      ) : (
                        <span style={{ color: '#F59E0B' }} className="text-[11px] font-medium">Sem cliente</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3" style={{ color: '#64748B', maxWidth: 160 }}>
                      <span className="truncate block">{String(row.contact_email ?? '—')}</span>
                    </td>

                    {/* Package */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: '#F1F5F9', color: '#475569' }}>
                        {String(row.package_name ?? '—')}
                      </span>
                    </td>

                    {/* Disk */}
                    <td className="px-4 py-3">
                      <DiskBar used={Number(row.disk_used_mb ?? 0)} limit={row.disk_limit_mb as number | null} />
                    </td>

                    {/* IP */}
                    <td className="px-4 py-3" style={{ color: '#64748B' }}>
                      {String(row.ip_address ?? '—')}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={String(row.status)} suspended={Boolean(row.is_suspended)} />
                    </td>

                    {/* Last synced */}
                    <td className="px-4 py-3" style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>
                      {fmtDate(row.last_synced_at as string)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!!row.service_id && (
                          <Link href={`/admin/clients`}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#94A3B8' }}
                            title="Abrir cliente">
                            <ExternalLink size={13} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F1F5F9' }}>
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} de {total}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={filterUrl({ page: String(page - 1) })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#F1F5F9', color: '#475569' }}>
                  Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={filterUrl({ page: String(page + 1) })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#F5B700', color: '#000' }}>
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Last sync info */}
      {filtered.length > 0 && (
        <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
          Última sincronização: {fmtDate(String(filtered[0]?.last_synced_at ?? ''))}
          {' · '}
          <Link href="/admin/settings" className="underline">Sincronizar agora</Link>
        </p>
      )}
    </div>
  )
}
