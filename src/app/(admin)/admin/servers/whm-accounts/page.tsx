import { Metadata } from 'next'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Server, Users, RefreshCw, ExternalLink, Search, AlertTriangle, Database } from 'lucide-react'
import Link from 'next/link'
import WhmAccountsTable from '@/components/admin/WhmAccountsTable'
import WhmMigrateButton from '@/components/admin/WhmMigrateButton'

export const metadata: Metadata = { title: 'Contas WHM — Admin ViralizaHost' }

const card = {
  background: '#FFFFFF', border: '1px solid #E5E7EB',
  borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

interface PageProps {
  searchParams: Promise<{ status?: string; linked?: string; package?: string; search?: string; page?: string }>
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

  // ── Diagnose: check if migration is applied ──────────────────────────────────
  const { error: tableCheckErr } = await db
    .from('whm_accounts')
    .select('id', { head: true, count: 'exact' })

  const { error: colCheckErr } = await db
    .from('whm_accounts')
    .select('sync_status')
    .limit(1)

  const { count: hostingCount } = await db
    .from('hosting_accounts')
    .select('id', { count: 'exact', head: true })

  const tableMissing   = !!tableCheckErr
  const columnsMissing = !tableMissing && !!colCheckErr
  const migrationNeeded = tableMissing || columnsMissing

  // If migration not applied, show diagnostic page
  if (migrationNeeded) {
    const issues: string[] = []
    if (tableMissing)   issues.push('Tabela whm_accounts não existe no banco de dados.')
    if (columnsMissing) issues.push('Colunas sync_status / requires_manual_link / link_status não existem (migração 2 não aplicada).')

    return (
      <div className="space-y-6">
        {/* Header */}
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

        {/* Migration needed banner */}
        <div className="rounded-2xl p-6 space-y-4" style={{ background: '#FFF8E1', border: '2px solid rgba(245,183,0,0.40)' }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} style={{ color: '#D9A300', flexShrink: 0, marginTop: 1 }} />
            <div>
              <h2 className="text-base font-black" style={{ color: '#92720A' }}>Migrações WHM necessárias</h2>
              <p className="text-sm mt-1" style={{ color: '#B45309' }}>
                As tabelas de suporte à sincronização WHM não foram criadas na base de dados.
                Clique no botão abaixo para as aplicar automaticamente.
              </p>
            </div>
          </div>

          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(245,183,0,0.08)', border: '1px solid rgba(245,183,0,0.20)' }}>
            <p className="text-xs font-bold" style={{ color: '#92720A' }}>Problemas detectados:</p>
            {issues.map((issue, i) => (
              <p key={i} className="text-xs flex items-start gap-2" style={{ color: '#B45309' }}>
                <span className="mt-0.5">•</span> {issue}
              </p>
            ))}
            {(hostingCount ?? 0) > 0 && (
              <p className="text-xs mt-2" style={{ color: '#B45309' }}>
                ℹ {hostingCount} conta(s) já importada(s) em hosting_accounts.
                Após aplicar as migrações, sincronize novamente para popular whm_accounts.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <WhmMigrateButton />
            <Link href="/admin/settings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}>
              <RefreshCw size={13} /> Ir para Configurações
            </Link>
          </div>
        </div>

        {/* SQL for manual application */}
        <div className="rounded-2xl p-5 space-y-3" style={card}>
          <div className="flex items-center gap-2">
            <Database size={16} style={{ color: '#64748B' }} />
            <h3 className="text-sm font-bold" style={{ color: '#0B0B0D' }}>SQL alternativo — Supabase SQL Editor</h3>
          </div>
          <p className="text-xs" style={{ color: '#64748B' }}>
            Se o botão não funcionar, execute este SQL manualmente no
            <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer"
              className="underline mx-1" style={{ color: '#F5B700' }}>Supabase SQL Editor</a>:
          </p>
          <pre className="text-[10px] rounded-xl p-4 overflow-x-auto"
            style={{ background: '#0F172A', color: '#E2E8F0', lineHeight: 1.5 }}>
{`POST /api/admin/whm/migrate
(botão acima chama este endpoint)

-- Ou manualmente:
ALTER TABLE viralizahost.hosting_accounts
  ADD COLUMN IF NOT EXISTS disk_limit_mb     INTEGER,
  ADD COLUMN IF NOT EXISTS package_name      TEXT,
  ADD COLUMN IF NOT EXISTS ip_address        TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cpanel_url        TEXT;

ALTER TABLE viralizahost.services
  ALTER COLUMN plan_id DROP NOT NULL;

-- (ver endpoint /api/admin/whm/migrate para SQL completo)`}
          </pre>
        </div>
      </div>
    )
  }

  // ── Normal page (migration applied) ───────────────────────────────────────
  let q = db
    .from('whm_accounts')
    .select(`
      id, whm_username, primary_domain, contact_email, package_name,
      ip_address, disk_used_mb, disk_limit_mb, is_suspended, suspension_reason,
      status, sync_status, requires_manual_link, link_status,
      last_synced_at, profile_id, service_id, hosting_account_id,
      profiles(id, full_name, email)
    `, { count: 'exact' })
    .order('primary_domain', { ascending: true })
    .range((page - 1) * limit, page * limit - 1)

  if (status) q = q.eq('status', status)
  if (pkg)    q = q.eq('package_name', pkg)
  if (linked === 'true')    q = q.not('profile_id', 'is', null)
  if (linked === 'false')   q = q.is('profile_id', null)
  if (linked === 'pending') q = q.eq('sync_status', 'pending_email')

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
    .select('status, is_suspended, profile_id, sync_status')
  const all = (summaryRaw ?? []) as Array<{ status: string; is_suspended: boolean; profile_id: string | null; sync_status: string }>
  const summary = {
    total:     all.length,
    active:    all.filter(r => !r.is_suspended && r.status === 'active' && r.sync_status !== 'pending_email').length,
    suspended: all.filter(r => r.is_suspended || r.status === 'suspended').length,
    missing:   all.filter(r => r.status === 'missing_from_whm').length,
    unlinked:  all.filter(r => !r.profile_id && r.sync_status !== 'pending_email').length,
    pending:   all.filter(r => r.sync_status === 'pending_email').length,
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

  const tableRows = filtered.map(r => ({
    id:                   String(r.id ?? ''),
    whm_username:         String(r.whm_username ?? ''),
    primary_domain:       String(r.primary_domain ?? ''),
    contact_email:        r.contact_email != null ? String(r.contact_email) : null,
    package_name:         r.package_name  != null ? String(r.package_name)  : null,
    ip_address:           r.ip_address    != null ? String(r.ip_address)    : null,
    disk_used_mb:         Number(r.disk_used_mb ?? 0),
    disk_limit_mb:        r.disk_limit_mb != null ? Number(r.disk_limit_mb) : null,
    is_suspended:         Boolean(r.is_suspended),
    status:               String(r.status ?? 'active'),
    sync_status:          String(r.sync_status ?? 'linked'),
    requires_manual_link: Boolean(r.requires_manual_link),
    last_synced_at:       r.last_synced_at != null ? String(r.last_synced_at) : null,
    service_id:           r.service_id  != null ? String(r.service_id)  : null,
    profile_id:           r.profile_id  != null ? String(r.profile_id)  : null,
    profiles: (() => {
      const prof = r.profiles as Record<string, unknown> | null
      if (!prof) return null
      return {
        full_name: prof.full_name != null ? String(prof.full_name) : undefined,
        email:     prof.email     != null ? String(prof.email)     : undefined,
      }
    })(),
  }))

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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total',        value: summary.total,     color: '#475569', href: filterUrl({ status: '', linked: '' }) },
          { label: 'Ativos',       value: summary.active,    color: '#059669', href: filterUrl({ status: 'active', linked: '' }) },
          { label: 'Suspensos',    value: summary.suspended, color: '#DC2626', href: filterUrl({ status: 'suspended', linked: '' }) },
          { label: 'Pendentes',    value: summary.pending,   color: '#B45309', href: filterUrl({ linked: 'pending', status: '' }) },
          { label: 'Sem cliente',  value: summary.unlinked,  color: '#D9A300', href: filterUrl({ linked: 'false', status: '' }) },
          { label: 'Ausentes WHM', value: summary.missing,   color: '#94A3B8', href: filterUrl({ status: 'missing_from_whm', linked: '' }) },
        ].map(s => (
          <Link key={s.label} href={s.href} className="rounded-2xl p-4 text-center transition-all hover:shadow-md" style={card}>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Pending accounts warning */}
      {summary.pending > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)' }}>
          <AlertTriangle size={18} style={{ color: '#D9A300', flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: '#92720A' }}>
              {summary.pending} conta{summary.pending > 1 ? 's' : ''} aguardando associação manual
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>
              Estas contas foram importadas do WHM mas não possuem e-mail válido.
              Clique em &quot;Associar&quot; na tabela para ligar cada conta a um cliente.
            </p>
          </div>
          <Link href={filterUrl({ linked: 'pending', status: '' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#92720A', border: '1px solid rgba(245,158,11,0.30)' }}>
            <ExternalLink size={12} /> Ver pendentes
          </Link>
        </div>
      )}

      {/* Empty state — migration is OK but no data yet */}
      {summary.total === 0 && (
        <div className="rounded-2xl p-8 text-center space-y-3" style={card}>
          <Users size={32} className="mx-auto opacity-30" style={{ color: '#94A3B8' }} />
          <p className="text-sm font-semibold" style={{ color: '#475569' }}>Nenhuma conta importada ainda.</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Vá a <Link href="/admin/settings" className="underline" style={{ color: '#F5B700' }}>Configurações</Link> e clique em &quot;Sincronizar Contas WHM&quot;.
          </p>
        </div>
      )}

      {/* Filters */}
      {summary.total > 0 && (
        <div className="rounded-2xl p-4" style={card}>
          <div className="flex flex-wrap gap-3">
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
                { label: 'Todos',        href: filterUrl({ status: '', linked: '' }) },
                { label: 'Ativos',       href: filterUrl({ status: 'active' }) },
                { label: 'Suspensos',    href: filterUrl({ status: 'suspended' }) },
                { label: 'Pendentes',    href: filterUrl({ linked: 'pending', status: '' }) },
                { label: 'Sem cliente',  href: filterUrl({ linked: 'false', status: '' }) },
                { label: 'Com cliente',  href: filterUrl({ linked: 'true',  status: '' }) },
              ].map(f => (
                <Link key={f.label} href={f.href}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid transparent' }}>
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {summary.total > 0 && (
        <div style={card} className="overflow-hidden">
          <WhmAccountsTable rows={tableRows} />

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
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
          <Link href="/admin/settings" className="underline">Sincronizar agora</Link>
          {' · '}
          <Link href="/admin/servers/whm-accounts" className="underline">Recarregar</Link>
        </p>
      )}
    </div>
  )
}
