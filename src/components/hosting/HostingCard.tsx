'use client'
import React from 'react'
import { motion } from 'framer-motion'
import {
  Server, HardDrive, Wifi, Database, Mail, Globe, FolderOpen,
  Shield, Code2, RefreshCw, AlertCircle, ChevronRight,
  ArrowRight, Settings, Plus, Ticket, RotateCcw
} from 'lucide-react'

interface HostingCardProps {
  ha: {
    id: string
    service_id: string | null
    cpanel_username: string
    primary_domain: string
    status: string
    disk_used_mb: number
    disk_limit_mb: number
    bandwidth_used_mb: number
    email_count: number
    db_count: number
    php_version: string | null
    ssl_enabled: boolean
    package_name: string | null
    ip_address: string | null
    suspension_reason: string | null
    last_synced_at: string | null
  }
  whm: {
    whm_username?: string
    package_name?: string
    ip_address?: string
    php_version?: string
    max_pop?: string
    max_sub?: string
    max_sql?: string
    max_ftp?: string
    account_created_at?: string
    sync_status?: string
  } | null
  pkgName: string
  server: { hostname?: string | null; location?: string | null } | null
  index: number
}

function AnimatedBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, delay, ease: 'easeOut' }}
      />
    </div>
  )
}

function ResourceRow({ icon, label, used, max, color }: {
  icon: React.ReactNode; label: string; used: number | string; max?: string; color: string
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium mb-0.5" style={{ color: '#6B7280' }}>{label}</div>
        <div className="text-sm font-bold" style={{ color: '#111827' }}>
          {used}
          {max && max !== 'unlimited' && max !== '0' && (
            <span className="font-normal text-xs ml-1" style={{ color: '#9CA3AF' }}>/ {max}</span>
          )}
          {(!max || max === 'unlimited' || max === '0') && (
            <span className="font-normal text-xs ml-1" style={{ color: '#10B981' }}>/ ∞</span>
          )}
        </div>
      </div>
    </div>
  )
}

export function HostingCard({ ha, whm, pkgName, server, index }: HostingCardProps) {
  const diskUsed    = ha.disk_used_mb ?? 0
  const diskLimit   = ha.disk_limit_mb ?? 0
  const diskPct     = diskLimit > 0 ? Math.min(Math.round((diskUsed / diskLimit) * 100), 100) : 0
  const bwUsed      = ha.bandwidth_used_mb ?? 0
  const isSuspended = ha.status === 'suspended'
  const ipAddress   = whm?.ip_address ?? ha.ip_address
  const phpVersion  = whm?.php_version ?? ha.php_version
  const lastSync    = ha.last_synced_at ? new Date(ha.last_synced_at) : null

  const diskColor = diskPct > 85 ? '#EF4444' : diskPct > 65 ? '#F59E0B' : '#10B981'
  const statusColor = isSuspended ? { bg: 'rgba(239,68,68,0.10)', text: '#DC2626', border: 'rgba(239,68,68,0.25)' }
    : { bg: 'rgba(16,185,129,0.10)', text: '#059669', border: 'rgba(16,185,129,0.25)' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: 'easeOut' }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #fafafa 100%)',
        border: '1px solid #E5E7EB',
        boxShadow: '0 4px 24px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.04)',
      }}
    >
      {/* ── HEADER ── */}
      <div className="px-6 py-5" style={{
        background: isSuspended
          ? 'linear-gradient(135deg,rgba(239,68,68,0.05),rgba(239,68,68,0.02))'
          : 'linear-gradient(135deg,rgba(59,130,246,0.05),rgba(245,183,0,0.03))',
        borderBottom: '1px solid #F3F4F6',
      }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* Server Icon */}
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: isSuspended ? 'rgba(239,68,68,0.10)' : 'rgba(59,130,246,0.10)',
                border: `1px solid ${isSuspended ? 'rgba(239,68,68,0.20)' : 'rgba(59,130,246,0.20)'}`,
                boxShadow: `0 4px 12px ${isSuspended ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)'}`,
              }}>
              <Server size={22} style={{ color: isSuspended ? '#DC2626' : '#2563EB' }} />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-black text-base" style={{ color: '#111827' }}>{pkgName}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}` }}>
                  {isSuspended ? '● Suspenso' : '● Ativo'}
                </span>
                {ha.ssl_enabled && !isSuspended && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                    style={{ background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }}>
                    <Shield size={10} /> SSL
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: '#6B7280' }}>
                <span className="flex items-center gap-1 font-medium">
                  <Globe size={11} /> {ha.primary_domain}
                </span>
                {ipAddress && <span className="flex items-center gap-1"><Server size={10} /> {ipAddress}</span>}
                {server?.hostname && <span>🖥 {server.hostname}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {lastSync && (
              <span className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg"
                style={{ background: '#F9FAFB', color: '#9CA3AF', border: '1px solid #F3F4F6' }}>
                <RefreshCw size={10} />
                Sync {lastSync.toLocaleDateString('pt-AO')}
              </span>
            )}
          </div>
        </div>

        {/* Suspension reason */}
        {isSuspended && ha.suspension_reason && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <AlertCircle size={14} style={{ color: '#DC2626', marginTop: 1, flexShrink: 0 }} />
            <p className="text-xs" style={{ color: '#B91C1C' }}>Motivo: {ha.suspension_reason}</p>
          </motion.div>
        )}
      </div>

      {/* ── BODY ── */}
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Storage + Bandwidth */}
        <div className="md:col-span-2 space-y-5">
          {/* Storage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <HardDrive size={13} style={{ color: diskColor }} />
                <span className="text-xs font-semibold" style={{ color: '#374151' }}>Armazenamento</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: diskColor }}>
                  {diskPct}%
                </span>
                <span className="text-xs" style={{ color: '#6B7280' }}>
                  {(diskUsed / 1024).toFixed(2)} GB
                  {diskLimit > 0 ? ` / ${(diskLimit / 1024).toFixed(2)} GB` : ' / Ilimitado'}
                </span>
              </div>
            </div>
            <AnimatedBar pct={diskLimit > 0 ? diskPct : 0} color={diskColor} delay={0.3 + index * 0.08} />
          </div>

          {/* Bandwidth */}
          {bwUsed > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Wifi size={13} style={{ color: '#8B5CF6' }} />
                  <span className="text-xs font-semibold" style={{ color: '#374151' }}>Largura de Banda</span>
                </div>
                <span className="text-xs" style={{ color: '#6B7280' }}>
                  {(bwUsed / 1024).toFixed(2)} GB utilizado
                </span>
              </div>
              <AnimatedBar pct={Math.min(Math.round((bwUsed / (1024 * 100)) * 100), 100)} color="#8B5CF6" delay={0.4 + index * 0.08} />
            </div>
          )}

          {/* Resources grid */}
          <div className="grid grid-cols-2 gap-1 pt-1" style={{ borderTop: '1px solid #F3F4F6' }}>
            <ResourceRow icon={<Mail size={14} style={{ color: '#059669' }} />}    label="Contas Email" used={ha.email_count ?? 0} max={whm?.max_pop}  color="#059669" />
            <ResourceRow icon={<Database size={14} style={{ color: '#2563EB' }} />} label="Bases de Dados" used={ha.db_count ?? 0}    max={whm?.max_sql}  color="#2563EB" />
            <ResourceRow icon={<Code2 size={14} style={{ color: '#F59E0B' }} />}    label="PHP Version"   used={phpVersion ?? '—'}                           color="#F59E0B" />
            <ResourceRow icon={<FolderOpen size={14} style={{ color: '#8B5CF6' }} />} label="FTP Accounts" used="—" max={whm?.max_ftp} color="#8B5CF6" />
          </div>
        </div>

        {/* Access + Quick Actions */}
        <div className="space-y-4">
          {/* cPanel SSO */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2.5" style={{ color: '#9CA3AF' }}>
              Acesso Direto
            </p>
            <div className="space-y-2">
              {ha.service_id ? (
                <>
                  <CpanelButton serviceId={ha.service_id} type="cpanel" />
                  <CpanelButton serviceId={ha.service_id} type="webmail" />
                </>
              ) : (
                <p className="text-xs py-2" style={{ color: '#94A3B8' }}>SSO não disponível</p>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '1rem' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-2.5" style={{ color: '#9CA3AF' }}>
              Ações Rápidas
            </p>
            <div className="space-y-1">
              {[
                { label: 'Gerir Emails',  href: '/email',   icon: <Mail size={13} />,       color: '#059669' },
                { label: 'Criar Email',   href: '/email',   icon: <Plus size={13} />,       color: '#2563EB' },
                { label: 'Abrir Ticket', href: '/tickets', icon: <Ticket size={13} />,     color: '#D9A300' },
                { label: 'Ver Domínios', href: '/domains', icon: <Globe size={13} />,      color: '#8B5CF6' },
              ].map(action => (
                <a key={action.label} href={action.href}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 group hover:opacity-90"
                  style={{ background: `${action.color}08`, border: `1px solid ${action.color}18` }}>
                  <span style={{ color: action.color }}>{action.icon}</span>
                  <span className="text-xs font-semibold flex-1" style={{ color: action.color }}>{action.label}</span>
                  <ChevronRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: action.color }} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
        <div className="flex items-center gap-4 text-xs" style={{ color: '#94A3B8' }}>
          {ha.cpanel_username && (
            <span className="flex items-center gap-1">
              <Settings size={10} /> {ha.cpanel_username}
            </span>
          )}
          {server?.location && <span>🌍 {server.location}</span>}
        </div>
        <RefreshSyncButton hostingAccountId={ha.id} />
      </div>
    </motion.div>
  )
}

// ─── Branded cPanel / Webmail buttons ────────────────────────────────────────
function CpanelButton({ serviceId, type }: { serviceId: string; type: 'cpanel' | 'webmail' }) {
  return (
    <SSOButtonInner serviceId={serviceId} type={type} />
  )
}

function SSOButtonInner({ serviceId, type }: { serviceId: string; type: 'cpanel' | 'webmail' }) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  async function handleClick() {
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/client/hosting/${serviceId}/${type}-sso`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json() as { redirectUrl?: string; error?: string }
      if (!res.ok || !data.redirectUrl) { setError(data.error ?? 'Erro ao gerar sessão.'); return }
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
    } catch { setError('Erro de comunicação.') } finally { setLoading(false) }
  }

  const isCpanel = type === 'cpanel'

  return (
    <div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all disabled:opacity-60"
        style={isCpanel
          ? { background: 'linear-gradient(135deg,#F5B700,#D9A300)', color: '#000', boxShadow: '0 3px 12px rgba(245,183,0,0.30)' }
          : { background: '#F8FAFC', color: '#374151', border: '1px solid #E2E8F0' }
        }
      >
        {loading
          ? <Loader size={14} className="animate-spin" />
          : isCpanel
            ? <CpanelLogo />
            : <WebmailLogo />
        }
        <span className="flex-1 text-left">
          {loading ? 'Abrindo…' : isCpanel ? 'Entrar no cPanel' : 'Entrar no Webmail'}
        </span>
        {!loading && <ArrowRight size={12} className="opacity-40" />}
      </motion.button>
      {error && <p className="text-[11px] mt-1 font-medium" style={{ color: '#DC2626' }}>{error}</p>}
    </div>
  )
}

// ─── Inline SVG logos ─────────────────────────────────────────────────────────
function CpanelLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#F5821F"/>
      <text x="3" y="23" fontSize="17" fontWeight="900" fill="white" fontFamily="Arial, sans-serif">cP</text>
    </svg>
  )
}

function WebmailLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#1565C0"/>
      <path d="M5 10h22v12a2 2 0 01-2 2H7a2 2 0 01-2-2V10z" fill="white" fillOpacity=".15"/>
      <path d="M5 10l11 8 11-8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <rect x="5" y="10" width="22" height="14" rx="1.5" stroke="white" strokeWidth="1.5"/>
    </svg>
  )
}

function Loader({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25"/>
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Sync button ──────────────────────────────────────────────────────────────
function RefreshSyncButton({ hostingAccountId }: { hostingAccountId: string }) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleSync() {
    setState('loading')
    try {
      const res = await fetch('/api/client/sync-hosting', { method: 'POST', credentials: 'include' })
      setState(res.ok ? 'done' : 'error')
      setTimeout(() => setState('idle'), 3000)
    } catch { setState('error'); setTimeout(() => setState('idle'), 3000) }
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleSync}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      style={{
        background: state === 'done' ? 'rgba(16,185,129,0.08)' : state === 'error' ? 'rgba(239,68,68,0.08)' : '#F3F4F6',
        color:      state === 'done' ? '#059669'                : state === 'error' ? '#DC2626'                : '#6B7280',
        border:     state === 'done' ? '1px solid rgba(16,185,129,0.20)' : '1px solid transparent',
      }}
    >
      <RotateCcw size={11} className={state === 'loading' ? 'animate-spin' : ''} />
      {state === 'idle'    && 'Sincronizar'}
      {state === 'loading' && 'Sincronizando…'}
      {state === 'done'    && 'Atualizado!'}
      {state === 'error'   && 'Erro na sync'}
    </motion.button>
  )
}

