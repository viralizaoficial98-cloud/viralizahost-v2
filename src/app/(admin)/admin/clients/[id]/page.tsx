'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, RefreshCw, User, Server, Globe, Mail, ShoppingBag,
  CreditCard, MessageSquare, Activity, Building2, Phone, MapPin,
  Calendar, Shield, ExternalLink, Key, Lock, Unlock, Package,
  HardDrive, AlertTriangle, CheckCircle2, Clock, Loader2, Eye,
  ChevronRight, MoreVertical, Download,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClientDetail {
  profile: any
  client: any
  hosting: any[]
  whm: any[]
  domains: any[]
  services: any[]
  tickets: any[]
  invoices: any[]
  payments: any[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(n: number, currency = 'AOA') {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency }).format(n)
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    active:        { bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
    suspended:     { bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
    pending:       { bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
    paid:          { bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
    overdue:       { bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
    open:          { bg: 'rgba(59,130,246,0.08)',  color: '#2563EB', border: 'rgba(59,130,246,0.20)' },
    closed:        { bg: '#F1F5F9',                color: '#64748B', border: '#E2E8F0' },
    under_review:  { bg: 'rgba(245,183,0,0.10)',   color: '#D9A300', border: 'rgba(245,183,0,0.25)' },
    approved:      { bg: 'rgba(16,185,129,0.08)',  color: '#059669', border: 'rgba(16,185,129,0.20)' },
    rejected:      { bg: 'rgba(239,68,68,0.08)',   color: '#DC2626', border: 'rgba(239,68,68,0.20)' },
  }
  const s = map[status] ?? { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
  return (
    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {label ?? status}
    </span>
  )
}

// ── Tab content components ─────────────────────────────────────────────────────

function OverviewTab({ data }: { data: ClientDetail }) {
  const { profile, client, hosting, whm } = data
  const ha = hosting[0]
  const wa = whm[0]
  const initials = (profile.full_name?.[0] ?? profile.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24 }}>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.10)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.20)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-black" style={{ color: '#0B0B0D' }}>{profile.full_name || 'Sem nome'}</h2>
              <StatusBadge status={profile.is_active !== false ? 'active' : 'suspended'}
                label={profile.is_active !== false ? 'Ativo' : 'Suspenso'} />
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                {profile.role ?? 'client'}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>{profile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {[
            { icon: <Phone size={14} />, label: 'Telefone',  value: profile.phone   || '—' },
            { icon: <MapPin size={14} />, label: 'País',     value: profile.country || '—' },
            { icon: <Building2 size={14} />, label: 'Empresa', value: client?.company_name || '—' },
            { icon: <Calendar size={14} />, label: 'Membro desde', value: fmt(profile.created_at) },
          ].map(({ icon, label, value }) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>
                {icon} {label}
              </div>
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {[
          { label: 'Domínios',    value: data.domains.length,  icon: <Globe size={16} />,        color: '#7C3AED' },
          { label: 'Serviços',   value: data.services.length,  icon: <ShoppingBag size={16} />,  color: '#2563EB' },
          { label: 'Tickets',    value: data.tickets.length,   icon: <MessageSquare size={16} />, color: '#059669' },
          { label: 'Faturas',    value: data.invoices.length,  icon: <CreditCard size={16} />,   color: '#D9A300' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 16 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>{label}</span>
              <span style={{ color }}>{icon}</span>
            </div>
            <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Hosting summary */}
      {(ha || wa) && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24 }}>
          <div className="flex items-center gap-2 mb-4">
            <Server size={16} style={{ color: '#7C3AED' }} />
            <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Hospedagem</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {[
              { label: 'Usuário cPanel', value: ha?.cpanel_username ?? wa?.whm_username ?? '—' },
              { label: 'Domínio',        value: ha?.primary_domain  ?? wa?.primary_domain ?? '—' },
              { label: 'Pacote',         value: ha?.package_name    ?? wa?.package_name   ?? '—' },
              { label: 'IP',             value: ha?.ip_address      ?? wa?.ip_address     ?? '—' },
              { label: 'Disco usado',    value: ha ? `${ha.disk_used_mb ?? 0} MB / ${ha.disk_limit_mb ? ha.disk_limit_mb + ' MB' : '∞'}` : '—' },
              { label: 'Última sync',   value: fmt(ha?.last_synced_at ?? wa?.last_synced_at) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>{label}</div>
                <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface WhmDetails {
  username: string
  domain: string
  synced_at: string
  elapsed_ms: number
  account: any
  emails: any[]
  domains: any[]
  databases: any[]
  ftp: any[]
  ssl: any
  cron_count: number
  counts: { emails: number; domains: number; databases: number; ftp: number; crons: number }
  errors: Record<string, string> | null
}

function HostingTab({ data, clientId, onRefresh }: { data: ClientDetail; clientId: string; onRefresh: () => void }) {
  const ha = data.hosting[0]
  const wa = data.whm[0]
  const [loading, setLoading]           = useState<string | null>(null)
  const [pkg, setPkg]                   = useState('')
  const [pkgList, setPkgList]           = useState<any[]>([])
  const [msg, setMsg]                   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [newPwd, setNewPwd]             = useState('')
  const [suspendReason, setSuspendReason] = useState('')
  const [whmDetails, setWhmDetails]     = useState<WhmDetails | null>(null)
  const [whmLoading, setWhmLoading]     = useState(false)
  const [whmError, setWhmError]         = useState<string | null>(null)

  const fetchWhmDetails = useCallback(async () => {
    setWhmLoading(true); setWhmError(null)
    try {
      const r = await fetch(`/api/admin/clients/${clientId}/whm/details`)
      const d = await r.json()
      if (!r.ok) { setWhmError(d.error ?? 'Erro ao carregar dados do WHM'); return }
      setWhmDetails(d)
    } catch { setWhmError('Erro de rede.') }
    finally { setWhmLoading(false) }
  }, [clientId])

  useEffect(() => {
    fetch(`/api/admin/clients/${clientId}/whm/change-package`)
      .then(r => r.json())
      .then(d => { if (d.packages) setPkgList(d.packages) })
      .catch(() => {})
    // Auto-fetch live WHM details on mount
    if (ha || wa) fetchWhmDetails()
  }, [clientId, ha, wa, fetchWhmDetails])

  const isSuspended = ha?.status === 'suspended' || wa?.is_suspended

  async function doAction(action: string, body?: Record<string, unknown>) {
    setLoading(action); setMsg(null)
    try {
      const r = await fetch(`/api/admin/clients/${clientId}/whm/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const d = await r.json()
      if (!r.ok) { setMsg({ type: 'err', text: d.error ?? 'Erro' }); return }
      setMsg({ type: 'ok', text: 'Operação realizada com sucesso.' })
      onRefresh()
    } catch { setMsg({ type: 'err', text: 'Erro de rede.' }) }
    finally { setLoading(null) }
  }

  if (!ha && !wa) return (
    <div className="p-14 text-center text-sm" style={{ color: '#94A3B8' }}>
      Nenhuma conta de hospedagem associada.
    </div>
  )

  return (
    <div className="space-y-5">
      {msg && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                   color: msg.type === 'ok' ? '#059669' : '#DC2626',
                   border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)'}` }}>
          {msg.text}
        </div>
      )}

      {/* Info card */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server size={16} style={{ color: '#7C3AED' }} />
            <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Conta WHM/cPanel</span>
          </div>
          <StatusBadge status={isSuspended ? 'suspended' : 'active'}
            label={isSuspended ? 'Suspensa' : 'Ativa'} />
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {[
            { label: 'Usuário',    value: ha?.cpanel_username  ?? wa?.whm_username   ?? '—' },
            { label: 'Domínio',   value: ha?.primary_domain   ?? wa?.primary_domain  ?? '—' },
            { label: 'Pacote',    value: ha?.package_name     ?? wa?.package_name    ?? '—' },
            { label: 'IP',        value: ha?.ip_address       ?? wa?.ip_address      ?? '—' },
            { label: 'PHP',       value: ha?.php_version      ?? wa?.php_version     ?? '—' },
            { label: 'Disco',     value: ha ? `${ha.disk_used_mb ?? 0} MB` : '—' },
            { label: 'E-mails',   value: whmDetails ? whmDetails.counts.emails : (ha?.email_count ?? '—') },
            { label: 'Bancos',    value: whmDetails ? whmDetails.counts.databases : (ha?.db_count ?? '—') },
            { label: 'FTP',       value: whmDetails ? whmDetails.counts.ftp : '—' },
            { label: 'Sync',      value: fmt(whmDetails?.synced_at ?? ha?.last_synced_at ?? wa?.last_synced_at) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>{label}</div>
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live WHM data section */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RefreshCw size={15} style={{ color: '#7C3AED' }} />
            <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Dados em Tempo Real do WHM</span>
          </div>
          <div className="flex items-center gap-2">
            {whmDetails && (
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                {new Date(whmDetails.synced_at).toLocaleTimeString('pt-PT')} · {whmDetails.elapsed_ms}ms
              </span>
            )}
            {whmLoading
              ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                  <Loader2 size={10} className="animate-spin" /> Atualizando
                </span>
              : whmError
                ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                    Erro
                  </span>
                : whmDetails
                  ? <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
                      <CheckCircle2 size={10} /> Sincronizado
                    </span>
                  : null
            }
            <button
              onClick={fetchWhmDetails}
              disabled={whmLoading}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl"
              style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
              <RefreshCw size={11} className={whmLoading ? 'animate-spin' : ''} />
              Recarregar
            </button>
          </div>
        </div>

        {whmError && !whmDetails && (
          <div className="rounded-xl px-4 py-3 text-sm mb-4"
            style={{ background: 'rgba(239,68,68,0.06)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.15)' }}>
            {whmError}
          </div>
        )}

        {whmDetails && (
          <div className="space-y-5">
            {/* SSL status */}
            {whmDetails.ssl && (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: whmDetails.ssl.valid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                         border: `1px solid ${whmDetails.ssl.valid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
                <Shield size={16} style={{ color: whmDetails.ssl.valid ? '#059669' : '#DC2626', flexShrink: 0 }} />
                <div>
                  <span className="text-sm font-bold" style={{ color: whmDetails.ssl.valid ? '#059669' : '#DC2626' }}>
                    SSL {whmDetails.ssl.valid ? 'Ativo' : 'Inativo'}
                  </span>
                  {whmDetails.ssl.issuer && (
                    <span className="text-xs ml-2" style={{ color: '#64748B' }}>{whmDetails.ssl.issuer}</span>
                  )}
                  {whmDetails.ssl.not_after && (
                    <span className="text-xs ml-2" style={{ color: '#94A3B8' }}>
                      Expira: {new Date(whmDetails.ssl.not_after).toLocaleDateString('pt-PT')}
                    </span>
                  )}
                  {whmDetails.ssl.is_lets_encrypt && (
                    <span className="text-xs ml-2 font-bold" style={{ color: '#059669' }}>Let&apos;s Encrypt</span>
                  )}
                </div>
              </div>
            )}

            {/* Domains from cPanel */}
            {whmDetails.domains.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={14} style={{ color: '#7C3AED' }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                    Domínios cPanel ({whmDetails.domains.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {whmDetails.domains.map((d: any) => (
                    <div key={d.domain} className="flex items-center gap-3 rounded-lg px-3 py-2"
                      style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <span className="text-sm font-mono font-semibold flex-1" style={{ color: '#0B0B0D' }}>{d.domain}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: d.type === 'main' ? 'rgba(124,58,237,0.08)' : '#F1F5F9',
                                 color: d.type === 'main' ? '#7C3AED' : '#64748B' }}>
                        {d.type === 'main' ? 'Principal' : d.type === 'addon' ? 'Addon' : d.type === 'parked' ? 'Alias' : 'Subdomínio'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email accounts */}
            {whmDetails.emails.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail size={14} style={{ color: '#7C3AED' }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                    Contas de E-mail ({whmDetails.emails.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {whmDetails.emails.map((em: any) => (
                    <div key={em.email} className="flex items-center gap-3 rounded-lg px-3 py-2"
                      style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                      <span className="text-sm font-mono flex-1 truncate" style={{ color: '#0B0B0D' }}>{em.email}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{em.humandiskused}</span>
                      {em.diskquota > 0 && (
                        <span className="text-xs" style={{ color: '#CBD5E1' }}>/ {em.humandiskquota}</span>
                      )}
                      {em.suspended_login === 1 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626' }}>Suspenso</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Databases */}
            {whmDetails.databases.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive size={14} style={{ color: '#7C3AED' }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                    Bancos de Dados MySQL ({whmDetails.databases.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {whmDetails.databases.map((db: any) => (
                    <span key={db.name} className="text-xs font-mono px-2.5 py-1 rounded-lg"
                      style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', color: '#64748B' }}>
                      {db.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* FTP */}
            {whmDetails.ftp.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Download size={14} style={{ color: '#7C3AED' }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>
                    Contas FTP ({whmDetails.ftp.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {whmDetails.ftp.map((f: any) => (
                    <span key={f.user} className="text-xs font-mono px-2.5 py-1 rounded-lg"
                      style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', color: '#64748B' }}>
                      {f.user}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Cron jobs */}
            {whmDetails.cron_count > 0 && (
              <div className="flex items-center gap-2">
                <Clock size={14} style={{ color: '#7C3AED' }} />
                <span className="text-xs" style={{ color: '#64748B' }}>
                  <span className="font-bold" style={{ color: '#0B0B0D' }}>{whmDetails.cron_count}</span> tarefa{whmDetails.cron_count !== 1 ? 's' : ''} cron agendada{whmDetails.cron_count !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* API errors (non-fatal) */}
            {whmDetails.errors && (
              <div className="rounded-xl px-4 py-3 text-xs"
                style={{ background: 'rgba(245,183,0,0.06)', border: '1px solid rgba(245,183,0,0.20)', color: '#D9A300' }}>
                <div className="font-bold mb-1">Alguns dados WHM não disponíveis:</div>
                {Object.entries(whmDetails.errors).map(([k, v]) => (
                  <div key={k}>{k}: {String(v)}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {!whmDetails && !whmLoading && !whmError && (
          <div className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>
            Nenhum dado WHM carregado. Clique em Recarregar.
          </div>
        )}

        {whmLoading && !whmDetails && (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 size={18} className="animate-spin" style={{ color: '#7C3AED' }} />
            <span className="text-sm" style={{ color: '#64748B' }}>Carregando dados do WHM…</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24 }}>
        <div className="font-bold text-sm mb-4" style={{ color: '#0B0B0D' }}>Ações WHM</div>
        <div className="space-y-4">
          {/* SSO */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Acessar cPanel (SSO)</div>
              <div className="text-xs" style={{ color: '#94A3B8' }}>Abre sessão cPanel sem senha</div>
            </div>
            <button
              disabled={!!loading || isSuspended}
              onClick={async () => {
                setLoading('sso'); setMsg(null)
                try {
                  const r = await fetch(`/api/admin/clients/${clientId}/whm/cpanel-sso`, { method: 'POST' })
                  const d = await r.json()
                  if (d.url) window.open(d.url, '_blank', 'noopener')
                  else setMsg({ type: 'err', text: d.error ?? 'Erro SSO' })
                } catch { setMsg({ type: 'err', text: 'Erro de rede.' }) }
                finally { setLoading(null) }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.20)' }}>
              {loading === 'sso' ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
              Abrir cPanel
            </button>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9' }} />

          {/* Sync */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Sincronizar com WHM</div>
              <div className="text-xs" style={{ color: '#94A3B8' }}>Actualiza dados locais com o servidor</div>
            </div>
            <button
              disabled={!!loading}
              onClick={() => doAction('sync')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
              {loading === 'sync' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Sincronizar
            </button>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9' }} />

          {/* Change password */}
          <div className="space-y-2">
            <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Alterar senha cPanel</div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Nova senha (min. 8 chars, A-z, 0-9)"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                className="flex-1 rounded-xl text-sm px-3 py-2"
                style={{ border: '1px solid #E2E8F0', outline: 'none' }}
              />
              <button
                disabled={!!loading || !newPwd}
                onClick={() => doAction('change-password', { password: newPwd }).then(() => setNewPwd(''))}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                {loading === 'change-password' ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9' }} />

          {/* Change package */}
          {pkgList.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Alterar pacote</div>
              <div className="flex gap-2">
                <select
                  value={pkg}
                  onChange={e => setPkg(e.target.value)}
                  className="flex-1 rounded-xl text-sm px-3 py-2"
                  style={{ border: '1px solid #E2E8F0', outline: 'none' }}>
                  <option value="">Selecionar pacote…</option>
                  {pkgList.map((p: any) => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
                <button
                  disabled={!!loading || !pkg}
                  onClick={() => doAction('change-package', { package: pkg }).then(() => setPkg(''))}
                  className="px-4 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.20)' }}>
                  {loading === 'change-package' ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                </button>
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #F1F5F9' }} />

          {/* Suspend / Unsuspend */}
          {isSuspended ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Reativar conta</div>
                <div className="text-xs" style={{ color: '#94A3B8' }}>Remove a suspensão WHM</div>
              </div>
              <button
                disabled={!!loading}
                onClick={() => doAction('unsuspend')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
                {loading === 'unsuspend' ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                Reativar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>Suspender conta WHM</div>
              <div className="flex gap-2">
                <input
                  placeholder="Motivo da suspensão"
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                  className="flex-1 rounded-xl text-sm px-3 py-2"
                  style={{ border: '1px solid #E2E8F0', outline: 'none' }}
                />
                <button
                  disabled={!!loading}
                  onClick={() => doAction('suspend', { reason: suspendReason })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                  {loading === 'suspend' ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                  Suspender
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DomainsTab({ data, clientId }: { data: ClientDetail; clientId: string }) {
  const [whmDomains, setWhmDomains] = useState<any[]>([])
  const [loadingWhm, setLoadingWhm] = useState(false)
  const fetched = useRef(false)

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true
    // Only auto-fetch if no DB domains (saves a WHM call when we have registered domains)
    setLoadingWhm(true)
    fetch(`/api/admin/clients/${clientId}/whm/details`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.domains)) setWhmDomains(d.domains) })
      .catch(() => {})
      .finally(() => setLoadingWhm(false))
  }, [clientId])

  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' as const }

  return (
    <div className="space-y-5">
      {/* Registered domains from DB */}
      {data.domains.length > 0 && (
        <div style={card}>
          <div className="px-5 py-3 font-bold text-sm" style={{ borderBottom: '1px solid #F1F5F9', color: '#0B0B0D' }}>
            Domínios Registados ({data.domains.length})
          </div>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                {['Domínio', 'Tipo', 'Estado', 'Expira em', 'Criado'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.domains.map((d: any, i: number) => (
                <tr key={d.id} style={{ borderBottom: i < data.domains.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td className="px-5 py-3 text-sm font-semibold" style={{ color: '#0B0B0D' }}>{d.domain_name ?? d.full_domain ?? `${d.name}${d.extension}`}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#64748B' }}>{d.domain_type ?? '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={d.status ?? 'active'} /></td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>{fmt(d.expires_at)}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>{fmt(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* cPanel domains from WHM (addon, parked, subdomains) */}
      <div style={card}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>
            Domínios cPanel {whmDomains.length > 0 ? `(${whmDomains.length})` : ''}
          </span>
          {loadingWhm && <Loader2 size={14} className="animate-spin" style={{ color: '#7C3AED' }} />}
        </div>

        {loadingWhm && whmDomains.length === 0 ? (
          <div className="py-10 text-center">
            <Loader2 size={20} className="animate-spin mx-auto mb-2" style={{ color: '#7C3AED' }} />
            <p className="text-xs" style={{ color: '#94A3B8' }}>Carregando do WHM…</p>
          </div>
        ) : whmDomains.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>
            Nenhum domínio encontrado no WHM/cPanel.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                {['Domínio', 'Tipo'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {whmDomains.map((d: any, i: number) => (
                <tr key={d.domain} style={{ borderBottom: i < whmDomains.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td className="px-5 py-3 text-sm font-mono font-semibold" style={{ color: '#0B0B0D' }}>{d.domain}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: d.type === 'main' ? 'rgba(124,58,237,0.08)' : '#F1F5F9',
                               color: d.type === 'main' ? '#7C3AED' : '#64748B',
                               border: `1px solid ${d.type === 'main' ? 'rgba(124,58,237,0.20)' : '#E2E8F0'}` }}>
                      {d.type === 'main' ? 'Principal' : d.type === 'addon' ? 'Addon' : d.type === 'parked' ? 'Alias' : 'Subdomínio'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ServicesTab({ data }: { data: ClientDetail }) {
  if (!data.services.length) return (
    <div className="p-14 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum serviço contratado.</div>
  )
  return (
    <div className="space-y-3">
      {data.services.map((s: any) => (
        <div key={s.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{s.plans?.name ?? s.plan_id ?? 'Serviço'}</div>
              <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{s.plans?.type ?? '—'} · desde {fmt(s.created_at)}</div>
            </div>
            <StatusBadge status={s.status ?? 'active'} />
          </div>
          {s.next_due_date && (
            <div className="mt-3 text-xs" style={{ color: '#64748B' }}>
              Próximo vencimento: <span className="font-semibold">{fmt(s.next_due_date)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function FinancialTab({ data }: { data: ClientDetail }) {
  const totalPaid    = data.payments.filter((p: any) => p.status === 'approved').reduce((a: number, p: any) => a + (p.amount ?? 0), 0)
  const totalPending = data.invoices.filter((i: any) => ['pending', 'overdue'].includes(i.status)).reduce((a: number, i: any) => a + (i.total ?? 0), 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.20)', borderRadius: 14, padding: 20 }}>
          <div className="text-xs font-medium mb-1" style={{ color: '#059669' }}>Total pago</div>
          <div className="text-2xl font-black" style={{ color: '#059669' }}>{fmtMoney(totalPaid)}</div>
        </div>
        <div style={{ background: 'rgba(245,183,0,0.05)', border: '1px solid rgba(245,183,0,0.25)', borderRadius: 14, padding: 20 }}>
          <div className="text-xs font-medium mb-1" style={{ color: '#D9A300' }}>Pendente</div>
          <div className="text-2xl font-black" style={{ color: '#D9A300' }}>{fmtMoney(totalPending)}</div>
        </div>
      </div>

      {/* Invoices */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden' }}>
        <div className="px-5 py-3 font-bold text-sm" style={{ borderBottom: '1px solid #F1F5F9', color: '#0B0B0D' }}>Faturas</div>
        {data.invoices.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhuma fatura.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Nº', 'Valor', 'Vencimento', 'Estado'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: '#94A3B8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv: any, i: number) => (
                <tr key={inv.id} style={{ borderBottom: i < data.invoices.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{inv.invoice_number ?? inv.id.slice(0, 8)}</td>
                  <td className="px-5 py-3 text-sm font-bold" style={{ color: '#0B0B0D' }}>{fmtMoney(inv.total ?? 0, inv.currency)}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: '#94A3B8' }}>{fmt(inv.due_date)}</td>
                  <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function TicketsTab({ data }: { data: ClientDetail }) {
  const router = useRouter()
  if (!data.tickets.length) return (
    <div className="p-14 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum ticket aberto.</div>
  )
  return (
    <div className="space-y-3">
      {data.tickets.map((t: any) => (
        <div key={t.id}
          onClick={() => router.push(`/admin/tickets/${t.id}`)}
          className="cursor-pointer"
          style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 20 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold" style={{ color: '#7C3AED' }}>{t.ticket_number ?? t.id.slice(0, 8)}</span>
                <StatusBadge status={t.status} />
              </div>
              <div className="text-sm font-semibold mt-1" style={{ color: '#0B0B0D' }}>{t.subject}</div>
              <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{fmt(t.updated_at)}</div>
            </div>
            <ChevronRight size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function PortalTab({ data, clientId, onRefresh }: { data: ClientDetail; clientId: string; onRefresh: () => void }) {
  const { profile } = data
  const [newPwd, setNewPwd] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [msg, setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function doAction(action: string, body?: Record<string, unknown>) {
    setLoading(action); setMsg(null)
    try {
      const r = await fetch(`/api/admin/clients/${clientId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const d = await r.json()
      if (!r.ok) { setMsg({ type: 'err', text: d.error ?? 'Erro' }); return }
      setMsg({ type: 'ok', text: 'Operação realizada com sucesso.' })
      onRefresh()
    } catch { setMsg({ type: 'err', text: 'Erro de rede.' }) }
    finally { setLoading(null) }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: msg.type === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                   color: msg.type === 'ok' ? '#059669' : '#DC2626',
                   border: `1px solid ${msg.type === 'ok' ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)'}` }}>
          {msg.text}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24 }}>
        <div className="font-bold text-sm mb-4" style={{ color: '#0B0B0D' }}>Conta do Portal</div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {[
            { label: 'E-mail',    value: profile.email },
            { label: 'Nome',      value: profile.full_name || '—' },
            { label: 'Role',      value: profile.role ?? 'client' },
            { label: 'Membro desde', value: fmt(profile.created_at) },
            { label: 'Último login',  value: fmt(profile.last_sign_in_at) },
            { label: 'Estado',    value: profile.is_active !== false ? 'Ativo' : 'Inativo' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>{label}</div>
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Password actions */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 24 }}>
        <div className="font-bold text-sm mb-4" style={{ color: '#0B0B0D' }}>Gestão de Senha</div>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium" style={{ color: '#0B0B0D' }}>Definir nova senha do portal</div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Nova senha (min. 8 chars, A-z, 0-9, especial)"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                className="flex-1 rounded-xl text-sm px-3 py-2"
                style={{ border: '1px solid #E2E8F0', outline: 'none' }}
              />
              <button
                disabled={!!loading || !newPwd}
                onClick={() => doAction('portal-password', { password: newPwd }).then(() => setNewPwd(''))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.20)' }}>
                {loading === 'portal-password' ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
                Definir
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9' }} />

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium" style={{ color: '#0B0B0D' }}>Enviar e-mail de redefinição</div>
              <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Envia link de reset para {profile.email}</div>
            </div>
            <button
              disabled={!!loading}
              onClick={() => doAction('send-password-reset')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
              {loading === 'send-password-reset' ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
              Enviar e-mail
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityTab({ clientId }: { clientId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/clients/${clientId}/activity`)
      .then(r => r.json())
      .then(d => { if (d.logs) setLogs(d.logs) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  if (loading) return (
    <div className="p-14 text-center">
      <Loader2 size={24} className="animate-spin mx-auto" style={{ color: '#7C3AED' }} />
    </div>
  )

  if (!logs.length) return (
    <div className="p-14 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhuma actividade registada.</div>
  )

  return (
    <div className="space-y-2">
      {logs.map((log: any) => (
        <div key={log.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 16 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{log.description}</div>
              <div className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                {log.action} · {log.entity_type} · {fmt(log.created_at)}
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
              {log.action}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Visão Geral',    icon: <Eye size={14} /> },
  { id: 'portal',    label: 'Portal',          icon: <Shield size={14} /> },
  { id: 'hosting',   label: 'Hospedagem WHM',  icon: <Server size={14} /> },
  { id: 'domains',   label: 'Domínios',        icon: <Globe size={14} /> },
  { id: 'services',  label: 'Serviços',        icon: <ShoppingBag size={14} /> },
  { id: 'financial', label: 'Financeiro',      icon: <CreditCard size={14} /> },
  { id: 'tickets',   label: 'Tickets',         icon: <MessageSquare size={14} /> },
  { id: 'activity',  label: 'Actividade',      icon: <Activity size={14} /> },
]

export default function AdminClientDetailPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const router = useRouter()
  const [tab, setTab]     = useState('overview')
  const [data, setData]   = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/admin/clients/${clientId}`)
      if (!r.ok) { const d = await r.json(); setError(d.error ?? 'Erro'); return }
      setData(await r.json())
    } catch { setError('Erro de rede.') }
    finally { setLoading(false) }
  }, [clientId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin" style={{ color: '#7C3AED' }} />
    </div>
  )

  if (error || !data) return (
    <div className="p-14 text-center">
      <div className="text-sm font-semibold" style={{ color: '#DC2626' }}>{error ?? 'Erro desconhecido'}</div>
      <button onClick={() => router.back()} className="mt-4 text-xs underline" style={{ color: '#7C3AED' }}>Voltar</button>
    </div>
  )

  const { profile } = data
  const initials = (profile.full_name?.[0] ?? profile.email?.[0] ?? '?').toUpperCase()
  const openTickets = data.tickets.filter((t: any) => t.status === 'open').length
  const pendingInvoices = data.invoices.filter((i: any) => ['pending', 'overdue'].includes(i.status)).length

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium mt-1"
          style={{ color: '#64748B' }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex-1 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
              style={{ background: 'rgba(139,92,246,0.10)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.20)' }}>
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-black" style={{ color: '#0B0B0D' }}>{profile.full_name || 'Sem nome'}</h1>
              <p className="text-sm" style={{ color: '#64748B' }}>{profile.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {openTickets > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                {openTickets} ticket{openTickets !== 1 ? 's' : ''} aberto{openTickets !== 1 ? 's' : ''}
              </span>
            )}
            {pendingInvoices > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.25)' }}>
                {pendingInvoices} fatura{pendingInvoices !== 1 ? 's' : ''} pendente{pendingInvoices !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl"
              style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap" style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 1 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors"
            style={tab === t.id
              ? { background: '#7C3AED', color: '#fff' }
              : { background: 'transparent', color: '#64748B' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}>
          {tab === 'overview'  && <OverviewTab  data={data} />}
          {tab === 'portal'    && <PortalTab    data={data} clientId={clientId} onRefresh={load} />}
          {tab === 'hosting'   && <HostingTab   data={data} clientId={clientId} onRefresh={load} />}
          {tab === 'domains'   && <DomainsTab   data={data} clientId={clientId} />}
          {tab === 'services'  && <ServicesTab  data={data} />}
          {tab === 'financial' && <FinancialTab data={data} />}
          {tab === 'tickets'   && <TicketsTab   data={data} />}
          {tab === 'activity'  && <ActivityTab  clientId={clientId} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
