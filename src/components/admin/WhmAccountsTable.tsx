'use client'
import { useState } from 'react'
import { ExternalLink, Link2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import AssociarClienteModal from './AssociarClienteModal'

interface WhmRow {
  id: string
  whm_username: string
  primary_domain: string
  contact_email?: string | null
  package_name?: string | null
  ip_address?: string | null
  disk_used_mb?: number
  disk_limit_mb?: number | null
  is_suspended?: boolean
  status?: string
  sync_status?: string
  requires_manual_link?: boolean
  last_synced_at?: string | null
  service_id?: string | null
  profile_id?: string | null
  profiles?: { full_name?: string; email?: string } | null
  link_status?: string | null
  link_candidate_reason?: string | null
  candidate?: { id: string; full_name?: string; email?: string } | null
  linked_at?: string | null
  link_method?: string | null
  server_label?: string | null
}

interface Props {
  rows: WhmRow[]
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

function StatusBadge({ status, suspended, syncStatus }: { status: string; suspended: boolean; syncStatus?: string }) {
  if (syncStatus === 'pending_email') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309' }}>
        <Clock size={10} /> Aguardando associação
      </span>
    )
  }
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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function WhmAccountsTable({ rows }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  // Recusa a candidata sugerida pela importação (a confirmação abre o diálogo de associação)
  async function refuse(id: string) {
    if (!window.confirm('Recusar o cliente sugerido por e-mail? A conta fica «Sem cliente».')) return
    setBusy(id)
    const res = await fetch(`/api/admin/whm/accounts/${id}/candidate`, { method: 'POST' })
    setBusy(null)
    if (res.ok) window.location.reload()
    else alert((await res.json().catch(() => ({}))).error ?? 'Falhou.')
  }
  const [modalAccount, setModalAccount] = useState<WhmRow | null>(null)

  return (
    <>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12" style={{ color: '#94A3B8' }}>
                  Nenhuma conta encontrada. Execute a sincronização primeiro.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const prof = row.profiles
              const isPending = !row.profile_id
              const canLink = !row.profile_id && row.status !== 'missing_from_whm'
              return (
                <tr key={row.id} data-testid="whm-row" data-domain={row.primary_domain}
                  style={{ borderBottom: idx < rows.length - 1 ? '1px solid #F8FAFC' : 'none',
                    background: isPending ? 'rgba(245,158,11,0.03)' : undefined }}
                  className="hover:bg-slate-50 transition-colors">

                  {/* Domain / username */}
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: '#0B0B0D' }}>{row.primary_domain}</div>
                    <div className="text-[11px]" style={{ color: '#94A3B8' }}>{row.whm_username}</div>
                  </td>

                  {/* Client */}
                  <td className="px-4 py-3">
                    {prof ? (
                      <span data-testid="whm-client">
                        <Link href={`/admin/clients?q=${encodeURIComponent(prof.email ?? '')}`}
                          className="font-medium text-blue-600 hover:underline text-xs">
                          {prof.full_name || prof.email || '—'}
                        </Link>
                        {prof.email && <span className="block text-[11px]" style={{ color: '#64748B' }}>{prof.email}</span>}
                        {row.linked_at && <span className="block text-[10px]" style={{ color: '#94A3B8' }}>Associado {fmtDate(row.linked_at)}{row.link_method === 'manual' ? ' (manual)' : row.link_method === 'candidate' ? ' (candidata confirmada)' : ''}</span>}
                      </span>
                    ) : (
                      <span style={{ color: '#F59E0B' }} className="text-[11px] font-medium" data-testid="whm-client">Sem cliente</span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3" style={{ color: '#64748B', maxWidth: 160 }}>
                    <span className="truncate block">{row.contact_email ?? '—'}</span>
                  </td>

                  {/* Package */}
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{ background: '#F1F5F9', color: '#475569' }}>
                      {row.package_name ?? '—'}
                    </span>
                  </td>

                  {/* Disk */}
                  <td className="px-4 py-3">
                    <DiskBar used={row.disk_used_mb ?? 0} limit={row.disk_limit_mb ?? null} />
                  </td>

                  {/* IP */}
                  <td className="px-4 py-3" style={{ color: '#64748B' }}>
                    {row.ip_address ?? '—'}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={row.status ?? 'active'}
                      suspended={Boolean(row.is_suspended)}
                      syncStatus={row.sync_status}
                    />
                  </td>

                  {/* Last synced */}
                  <td className="px-4 py-3" style={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>
                    {fmtDate(row.last_synced_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!!row.service_id && (
                        <Link href="/admin/clients"
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#94A3B8' }}
                          title="Abrir cliente">
                          <ExternalLink size={13} />
                        </Link>
                      )}
                      {canLink && row.link_status === 'pending_validation' && row.candidate && (
                        <span className="flex flex-col gap-1 text-[11px]" style={{ color: '#B45309' }}>
                          <span title={row.link_candidate_reason ?? ''}>Sugerido: {row.candidate.email}</span>
                          <span className="flex gap-1">
                            <button disabled={busy === row.id} onClick={() => setModalAccount(row)} className="px-2 py-1 rounded-lg font-bold text-white" style={{ background: '#15803D' }}>Rever e confirmar</button>
                            <button disabled={busy === row.id} onClick={() => refuse(row.id)} className="px-2 py-1 rounded-lg font-bold" style={{ border: '1px solid #E2E8F0', color: '#475569' }}>Recusar</button>
                          </span>
                        </span>
                      )}
                      {canLink && !(row.link_status === 'pending_validation' && row.candidate) && (
                        <button
                          onClick={() => setModalAccount({ ...row, candidate: null })}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#B45309', border: '1px solid rgba(245,158,11,0.30)', cursor: 'pointer' }}
                          data-testid="whm-link-btn"
                          title="Escolher o cliente titular desta conta WHM">
                          <Link2 size={11} /> Associar cliente
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AssociarClienteModal
        account={modalAccount}
        onClose={() => setModalAccount(null)}
        onLinked={() => {
          setModalAccount(null)
          // Refresh the page to reflect the updated state
          window.location.reload()
        }}
      />
    </>
  )
}
