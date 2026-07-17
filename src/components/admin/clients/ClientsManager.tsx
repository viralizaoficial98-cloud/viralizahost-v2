'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, UserCheck, UserX, Search, Filter, RefreshCw, ChevronRight,
  Server, Globe, Mail, AlertCircle, CheckCircle2, Clock, Eye,
  MoreVertical, ExternalLink, Lock, Unlock, Key, X, Loader2,
  ChevronLeft, Building2, ShieldCheck, AlertTriangle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Client {
  id: string
  email: string
  full_name: string
  phone: string | null
  country: string | null
  role: string
  is_active: boolean
  created_at: string
  company_name: string | null
  cpanel_username: string | null
  primary_domain: string | null
  package_name: string | null
  ip_address: string | null
  disk_used_mb: number
  disk_limit_mb: number | null
  email_count: number
  last_synced_at: string | null
  hosting_status: string | null
  is_whm_suspended: boolean
  has_hosting: boolean
  has_whm: boolean
  domain_count: number
  service_count: number
  open_tickets: number
  pending_invoices: number
  pending_amount: number
  currency: string
}

interface Stats {
  total: number
  active: number
  suspended: number
  whm: number
  no_association: number
  pending_payment: number
  open_tickets: number
}

const FILTERS = [
  { key: 'all',             label: 'Todos' },
  { key: 'active',          label: 'Ativos' },
  { key: 'suspended',       label: 'Suspensos' },
  { key: 'whm',             label: 'Com WHM' },
  { key: 'no_hosting',      label: 'Sem hospedagem' },
  { key: 'pending_payment', label: 'Pagamento pendente' },
  { key: 'open_tickets',    label: 'Tickets abertos' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string | null, email: string) {
  const src = name ?? email
  return src.split(/[\s@]/)[0][0]?.toUpperCase() ?? '?'
}

function diskPct(used: number, limit: number | null) {
  if (!limit) return null
  return Math.round((used / limit) * 100)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm"
      style={{ background: type === 'success' ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${type === 'success' ? '#6EE7B7' : '#FCA5A5'}` }}>
      {type === 'success' ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                           : <AlertCircle  size={16} style={{ color: '#DC2626', flexShrink: 0 }} />}
      <p className="text-sm font-medium flex-1" style={{ color: type === 'success' ? '#065F46' : '#B91C1C' }}>{msg}</p>
      <button onClick={onClose}><X size={14} style={{ color: '#94A3B8' }} /></button>
    </motion.div>
  )
}

function StatCard({ label, value, color, bg, border, Icon }: { label: string; value: number; color: string; bg: string; border: string; Icon: any }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} style={{ color }} />
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>
      <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>{value}</div>
    </div>
  )
}

// ── Action dropdown ───────────────────────────────────────────────────────────

function ActionMenu({ client, onAction }: { client: Client; onAction: (action: string, client: Client) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const actions = [
    { id: 'view',           label: 'Ver detalhes',        icon: Eye },
    { id: 'cpanel_sso',     label: 'Abrir cPanel',         icon: ExternalLink, disabled: !client.has_hosting || client.is_whm_suspended },
    { id: 'portal_password',label: 'Alterar senha portal', icon: Key },
    { id: 'cpanel_password',label: 'Alterar senha cPanel', icon: Lock, disabled: !client.has_hosting },
    { id: 'sync',           label: 'Sincronizar',          icon: RefreshCw, disabled: !client.has_whm && !client.has_hosting },
    client.is_whm_suspended || client.is_active === false
      ? { id: 'unsuspend', label: 'Reativar conta WHM',   icon: Unlock, disabled: !client.has_hosting }
      : { id: 'suspend',   label: 'Suspender conta WHM',  icon: AlertTriangle, disabled: !client.has_hosting, danger: true },
  ]

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg transition-colors hover:opacity-70"
        style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
        <MoreVertical size={14} style={{ color: '#6B7280' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1 w-52 rounded-xl overflow-hidden z-20"
            style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}>
            {actions.map(a => (
              <button key={a.id}
                disabled={a.disabled}
                onClick={() => { onAction(a.id, client); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left disabled:opacity-40 transition-colors"
                style={{ color: (a as any).danger ? '#DC2626' : '#374151' }}
                onMouseEnter={e => { if (!(a as any).disabled) (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <a.icon size={14} style={{ color: (a as any).danger ? '#DC2626' : '#94A3B8', flexShrink: 0 }} />
                {a.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Modal: Portal password ────────────────────────────────────────────────────

function PortalPasswordModal({ client, onClose, onSuccess }: { client: Client; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [pw, setPw]         = useState('')
  const [pw2, setPw2]       = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const submit = async () => {
    if (pw !== pw2) { setErr('As senhas não coincidem.'); return }
    setSaving(true); setErr('')
    try {
      const res  = await fetch(`/api/admin/clients/${client.id}/portal-password`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao alterar senha.')
      onSuccess('Senha do Portal alterada com sucesso.')
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
        <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 className="font-black text-base" style={{ color: '#0B0B0D' }}>Alterar Senha do Portal</h3>
          <button onClick={onClose}><X size={18} style={{ color: '#94A3B8' }} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm" style={{ color: '#64748B' }}>
            Cliente: <strong style={{ color: '#0B0B0D' }}>{client.full_name || client.email}</strong>
          </p>
          <div>
            <label className="text-xs font-bold block mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Nova senha</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: '#E5E7EB' }} placeholder="Mín 8 chars, maiúscula, minúscula, número, especial" />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Confirmar senha</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: '#E5E7EB' }} />
          </div>
          {err && <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>{err}</p>}
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            A senha é alterada via Supabase Admin Auth no servidor. Nunca é guardada em texto simples nem registada em logs.
          </p>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#F3F4F6', color: '#374151' }}>Cancelar</button>
          <button onClick={submit} disabled={saving || !pw || !pw2}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> A alterar…</> : 'Alterar Senha'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Modal: cPanel password ────────────────────────────────────────────────────

function CpanelPasswordModal({ client, onClose, onSuccess }: { client: Client; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [pw, setPw]         = useState('')
  const [pw2, setPw2]       = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const generate = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%'
    let p = ''
    for (let i = 0; i < 16; i++) p += chars[Math.floor(Math.random() * chars.length)]
    setPw(p); setPw2(p)
  }

  const submit = async () => {
    if (pw !== pw2) { setErr('As senhas não coincidem.'); return }
    setSaving(true); setErr('')
    try {
      const res  = await fetch(`/api/admin/clients/${client.id}/whm/change-password`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro.')
      onSuccess('Senha cPanel alterada com sucesso.')
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro.')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
        <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 className="font-black text-base" style={{ color: '#0B0B0D' }}>Alterar Senha cPanel</h3>
          <button onClick={onClose}><X size={18} style={{ color: '#94A3B8' }} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm" style={{ color: '#64748B' }}>
            Conta: <strong className="font-mono" style={{ color: '#0B0B0D' }}>{client.cpanel_username}</strong>
          </p>
          <div>
            <label className="text-xs font-bold block mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Nova senha</label>
            <div className="flex gap-2">
              <input type="text" value={pw} onChange={e => setPw(e.target.value)}
                className="flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
                style={{ borderColor: '#E5E7EB' }} />
              <button onClick={generate}
                className="px-3 py-2.5 rounded-xl text-xs font-bold"
                style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280' }}>
                Gerar
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold block mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Confirmar</label>
            <input type="text" value={pw2} onChange={e => setPw2(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none font-mono"
              style={{ borderColor: '#E5E7EB' }} />
          </div>
          {err && <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>{err}</p>}
          <p className="text-xs" style={{ color: '#94A3B8' }}>Alteração via WHM API. A senha nunca é guardada em logs.</p>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#F3F4F6', color: '#374151' }}>Cancelar</button>
          <button onClick={submit} disabled={saving || !pw || !pw2}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> A alterar…</> : 'Alterar Senha'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Modal: Suspend ────────────────────────────────────────────────────────────

function SuspendModal({ client, onClose, onSuccess }: { client: Client; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/whm/suspend`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Suspended by administrator' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro.')
      onSuccess('Conta WHM suspensa.')
      onClose()
    } catch (e: unknown) {
      console.error(e)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>
        <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <h3 className="font-black text-base" style={{ color: '#DC2626' }}>Suspender Conta WHM</h3>
          <button onClick={onClose}><X size={18} style={{ color: '#94A3B8' }} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-sm font-semibold" style={{ color: '#B91C1C' }}>
              Atenção: Esta acção irá suspender a conta cPanel de <strong>{client.cpanel_username ?? client.email}</strong>. O cliente perderá acesso ao site e e-mails.
            </p>
          </div>
          <div>
            <label className="text-xs font-bold block mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Motivo (opcional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: '#E5E7EB' }} placeholder="Fatura em atraso, violação de TOS…" />
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#F3F4F6', color: '#374151' }}>Cancelar</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: '#DC2626' }}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> A suspender…</> : 'Confirmar Suspensão'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientsManager() {
  const router = useRouter()
  const [clients, setClients]   = useState<Client[]>([])
  const [stats, setStats]       = useState<Stats | null>(null)
  const [loading, setLoading]   = useState(true)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [q, setQ]               = useState('')
  const [filter, setFilter]     = useState('all')
  const [toast, setToast]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [modal, setModal]       = useState<{ type: string; client: Client } | null>(null)
  const [busy, setBusy]         = useState<string | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 5000)
  }

  const load = useCallback(async (p = page, qv = q, fv = filter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), filter: fv })
      if (qv) params.set('q', qv)
      const res  = await fetch(`/api/admin/clients?${params}`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClients(data.clients ?? [])
      setStats(data.stats ?? null)
      setTotal(data.total ?? 0)
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao carregar clientes.')
    } finally { setLoading(false) }
  }, [page, q, filter])

  useEffect(() => { load() }, [load])

  const handleSearch = (v: string) => { setQ(v); setPage(1); setTimeout(() => load(1, v, filter), 300) }
  const handleFilter = (f: string) => { setFilter(f); setPage(1); load(1, q, f) }

  const handleAction = async (action: string, client: Client) => {
    if (action === 'view') { router.push(`/admin/clients/${client.id}`); return }
    if (action === 'portal_password') { setModal({ type: 'portal_password', client }); return }
    if (action === 'cpanel_password') { setModal({ type: 'cpanel_password', client }); return }
    if (action === 'suspend')          { setModal({ type: 'suspend', client }); return }

    if (action === 'unsuspend') {
      if (!confirm(`Reativar conta WHM de ${client.cpanel_username ?? client.email}?`)) return
      setBusy(client.id + '_unsuspend')
      try {
        const res  = await fetch(`/api/admin/clients/${client.id}/whm/unsuspend`, { method: 'POST', credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        showToast('success', 'Conta reativada.')
        await load()
      } catch (e: unknown) { showToast('error', e instanceof Error ? e.message : 'Erro.') }
      finally { setBusy(null) }
      return
    }

    if (action === 'sync') {
      setBusy(client.id + '_sync')
      try {
        const res  = await fetch(`/api/admin/clients/${client.id}/whm/sync`, { method: 'POST', credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        showToast('success', 'Cliente sincronizado com sucesso.')
        await load()
      } catch (e: unknown) { showToast('error', e instanceof Error ? e.message : 'Erro.') }
      finally { setBusy(null) }
      return
    }

    if (action === 'cpanel_sso') {
      setBusy(client.id + '_sso')
      try {
        const res  = await fetch(`/api/admin/clients/${client.id}/whm/cpanel-sso`, { method: 'POST', credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } catch (e: unknown) { showToast('error', e instanceof Error ? e.message : 'Erro SSO.') }
      finally { setBusy(null) }
      return
    }
  }

  const LIMIT = 50

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}>
            <Users size={20} style={{ color: '#7C3AED' }} />
          </div>
          <div>
            <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Clientes</h1>
            <p className="text-sm" style={{ color: '#64748B' }}>Gerencie clientes do Portal e contas WHM</p>
          </div>
        </div>
        <button onClick={() => load()}
          className="p-2.5 rounded-xl transition-all hover:opacity-80"
          style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: '#6B7280' }} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total"           value={stats.total}           color="#7C3AED" bg="rgba(139,92,246,0.06)" border="rgba(139,92,246,0.15)" Icon={Users} />
          <StatCard label="Ativos"          value={stats.active}          color="#059669" bg="rgba(16,185,129,0.06)" border="rgba(16,185,129,0.15)" Icon={UserCheck} />
          <StatCard label="Suspensos"       value={stats.suspended}       color="#DC2626" bg="rgba(239,68,68,0.06)"  border="rgba(239,68,68,0.15)"  Icon={UserX} />
          <StatCard label="Com WHM"         value={stats.whm}             color="#2563EB" bg="rgba(59,130,246,0.06)" border="rgba(59,130,246,0.15)" Icon={Server} />
          <StatCard label="Sem hospedagem"  value={stats.no_association}  color="#D9A300" bg="rgba(245,183,0,0.06)"  border="rgba(245,183,0,0.15)"  Icon={AlertTriangle} />
          <StatCard label="Pagt. pendente"  value={stats.pending_payment} color="#EA580C" bg="rgba(234,88,12,0.06)"  border="rgba(234,88,12,0.15)"  Icon={Clock} />
          <StatCard label="Tickets abertos" value={stats.open_tickets}    color="#7C3AED" bg="rgba(139,92,246,0.06)" border="rgba(139,92,246,0.15)" Icon={ShieldCheck} />
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input value={q} onChange={e => handleSearch(e.target.value)}
            placeholder="Pesquisar por nome, e-mail, domínio, username cPanel…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', color: '#0B0B0D' }} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => handleFilter(f.key)}
              className="px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
              style={filter === f.key
                ? { background: '#0B0B0D', color: '#fff' }
                : { background: '#F1F5F9', color: '#64748B' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <Users size={15} style={{ color: '#7C3AED' }} />
          <span className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Lista de Clientes</span>
          <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: '#F1F5F9', color: '#64748B' }}>
            {total} cliente{total !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="py-12 px-6 space-y-4 animate-pulse">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full shrink-0" style={{ background: '#F3F4F6' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 rounded" style={{ background: '#F3F4F6' }} />
                  <div className="h-2 w-32 rounded" style={{ background: '#F9FAFB' }} />
                </div>
                <div className="h-6 w-20 rounded-full" style={{ background: '#F3F4F6' }} />
              </div>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
            <p className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>Nenhum cliente encontrado</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              {q ? 'Tente alterar a pesquisa.' : 'Os clientes aparecerão aqui após o registo ou sincronização WHM.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                  {['Cliente', 'Domínio / cPanel', 'Hospedagem', 'Tickets / Faturas', 'Estado', 'Ações'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => {
                  const pct     = diskPct(c.disk_used_mb, c.disk_limit_mb)
                  const active  = c.is_active !== false && !c.is_whm_suspended
                  const isBusy  = busy?.startsWith(c.id)
                  return (
                    <tr key={c.id}
                      style={{ borderBottom: i < clients.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      {/* Cliente */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                            style={{ background: 'rgba(139,92,246,0.10)', color: '#7C3AED', border: '1px solid rgba(139,92,246,0.15)' }}>
                            {initials(c.full_name, c.email)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-sm truncate" style={{ color: '#0B0B0D' }}>
                              {c.full_name || '(Sem nome)'}
                            </div>
                            <div className="text-xs truncate" style={{ color: '#94A3B8' }}>{c.email}</div>
                            {c.company_name && (
                              <div className="text-xs truncate" style={{ color: '#64748B' }}>
                                <Building2 size={10} className="inline mr-0.5" style={{ verticalAlign: 'middle' }} />
                                {c.company_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Domínio */}
                      <td className="px-5 py-4">
                        {c.primary_domain ? (
                          <div>
                            <div className="font-semibold text-xs flex items-center gap-1" style={{ color: '#0B0B0D' }}>
                              <Globe size={11} style={{ color: '#7C3AED' }} />
                              {c.primary_domain}
                            </div>
                            {c.cpanel_username && (
                              <div className="text-xs font-mono mt-0.5" style={{ color: '#94A3B8' }}>{c.cpanel_username}</div>
                            )}
                            {c.package_name && (
                              <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>{c.package_name}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: '#94A3B8' }}>Sem hospedagem</span>
                        )}
                      </td>
                      {/* Hosting stats */}
                      <td className="px-5 py-4">
                        {c.has_hosting ? (
                          <div className="space-y-1">
                            <div className="text-xs" style={{ color: '#64748B' }}>
                              <Server size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                              {c.disk_used_mb} MB {c.disk_limit_mb ? `/ ${c.disk_limit_mb} MB` : ''}
                            </div>
                            {pct !== null && (
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9', width: 80 }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  background: pct > 80 ? '#DC2626' : pct > 60 ? '#F59E0B' : '#059669',
                                }} />
                              </div>
                            )}
                            <div className="text-xs" style={{ color: '#94A3B8' }}>
                              <Mail size={10} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
                              {c.email_count} e-mails
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>
                      {/* Tickets / invoices */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          {c.open_tickets > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,183,0,0.10)', color: '#D9A300', border: '1px solid rgba(245,183,0,0.20)' }}>
                              {c.open_tickets} ticket{c.open_tickets > 1 ? 's' : ''}
                            </span>
                          )}
                          {c.pending_invoices > 0 && (
                            <div className="block">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                                {c.pending_invoices} fatura{c.pending_invoices > 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                          {c.open_tickets === 0 && c.pending_invoices === 0 && (
                            <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
                          )}
                        </div>
                      </td>
                      {/* Estado */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                          style={active
                            ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                            : { background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.20)' }}>
                          {active ? 'Ativo' : c.is_whm_suspended ? 'Suspenso WHM' : 'Inativo'}
                        </span>
                        {c.last_synced_at && (
                          <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                            Sync: {fmtDate(c.last_synced_at)}
                          </div>
                        )}
                      </td>
                      {/* Ações */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => router.push(`/admin/clients/${c.id}`)}
                            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                            style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                            <ChevronRight size={14} style={{ color: '#7C3AED' }} />
                          </button>
                          {isBusy
                            ? <Loader2 size={14} className="animate-spin" style={{ color: '#94A3B8' }} />
                            : <ActionMenu client={c} onAction={handleAction} />
                          }
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid #F1F5F9' }}>
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} de {total}
            </span>
            <div className="flex gap-1.5">
              <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}
                className="p-2 rounded-lg disabled:opacity-40 hover:opacity-70"
                style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
                <ChevronLeft size={13} style={{ color: '#6B7280' }} />
              </button>
              <button disabled={page * LIMIT >= total} onClick={() => { const p = page + 1; setPage(p); load(p) }}
                className="p-2 rounded-lg disabled:opacity-40 hover:opacity-70"
                style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}>
                <ChevronRight size={13} style={{ color: '#6B7280' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === 'portal_password' && (
          <PortalPasswordModal client={modal.client} onClose={() => setModal(null)}
            onSuccess={msg => { showToast('success', msg); setModal(null) }} />
        )}
        {modal?.type === 'cpanel_password' && (
          <CpanelPasswordModal client={modal.client} onClose={() => setModal(null)}
            onSuccess={msg => { showToast('success', msg); setModal(null) }} />
        )}
        {modal?.type === 'suspend' && (
          <SuspendModal client={modal.client} onClose={() => setModal(null)}
            onSuccess={async msg => { showToast('success', msg); setModal(null); await load() }} />
        )}
      </AnimatePresence>
    </div>
  )
}
