'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Plus, HardDrive, ExternalLink, Loader2, Trash2, Key,
  Settings, AlertCircle, CheckCircle2, X, RefreshCw,
} from 'lucide-react'
import { formatBytes, usagePct, usageColor } from '@/lib/format'

interface EmailAccount {
  email: string
  login: string
  domain: string
  diskused: number   // bytes (UAPI) or MB (API 2) — server normalises, humandisk* is always readable
  diskquota: number
  humandiskused: string
  humandiskquota: string
  suspended_login: number
}

interface PurchasedEmailService {
  id: string
  service_name: string | null
  service_type: string
  status: string
  created_at: string
  order_id: string | null
}

interface ApiResponse {
  emails?: EmailAccount[]
  domain?: string | null
  cpanel_username?: string | null
  hosting_account_id?: string | null
  email_services?: PurchasedEmailService[]
  provisioning?: boolean
  error?: string
}

type ModalMode = 'create' | 'password' | 'quota' | 'delete' | null

// ─── Webmail icon (inline SVG) ────────────────────────────────────────────────
function WebmailIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="6" fill="#1565C0"/>
      <path d="M5 10h22v12a2 2 0 01-2 2H7a2 2 0 01-2-2V10z" fill="white" fillOpacity=".15"/>
      <path d="M5 10l11 8 11-8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <rect x="5" y="10" width="22" height="14" rx="1.5" stroke="white" strokeWidth="1.5"/>
    </svg>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ type, msg, onClose }: { type: 'success' | 'error'; msg: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
      style={{
        background: type === 'success' ? '#ECFDF5' : '#FEF2F2',
        border: type === 'success' ? '1px solid #6EE7B7' : '1px solid #FCA5A5',
        maxWidth: 360,
      }}
    >
      {type === 'success'
        ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
        : <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />}
      <p className="text-sm font-medium flex-1" style={{ color: type === 'success' ? '#065F46' : '#B91C1C' }}>{msg}</p>
      <button onClick={onClose} aria-label="Fechar"><X size={14} style={{ color: '#94A3B8' }} /></button>
    </motion.div>
  )
}

// ─── Storage bar ─────────────────────────────────────────────────────────────
function StorageBar({ used, total, delay = 0 }: { used: number; total: number; delay?: number }) {
  const pct   = usagePct(used, total)
  const color = usageColor(pct)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80 + delay * 1000)
    return () => clearTimeout(t)
  }, [pct, delay])

  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          background: color,
          transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
        }}
      />
    </div>
  )
}

export default function EmailManager() {
  const [emails, setEmails]               = useState<EmailAccount[]>([])
  const [domain, setDomain]               = useState('')
  const [hostingId, setHostingId]         = useState('')
  const [emailServices, setEmailServices] = useState<PurchasedEmailService[]>([])
  const [provisioning, setProvisioning]   = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [modal, setModal]           = useState<{ mode: ModalMode; email?: string; quota?: number }>({ mode: null })
  const [actionLoading, setAction]  = useState(false)
  const [toast, setToast]           = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [webmailLoading, setWmLoad] = useState<Record<string, boolean>>({})

  // Form state
  const [newLocalpart, setNewLocalpart] = useState('')
  const [newPassword,  setNewPassword]  = useState('')
  const [newQuota,     setNewQuota]     = useState(500)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4500)
  }

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/client/email-accounts', { credentials: 'include', cache: 'no-store' })
      const data: ApiResponse = await res.json()
      if (!res.ok || data.error) { setError(data.error ?? 'Erro ao carregar emails.'); return }
      setEmails(data.emails ?? [])
      setDomain(data.domain ?? '')
      setHostingId(data.hosting_account_id ?? '')
      setEmailServices(data.email_services ?? [])
      setProvisioning(data.provisioning ?? false)
    } catch {
      setError('Erro de comunicação com o servidor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEmails() }, [fetchEmails])

  const callApi = async (action: string, extra: Record<string, unknown>) => {
    setAction(true)
    try {
      const res = await fetch('/api/client/email-accounts', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Operação falhou.')
      return true
    } finally {
      setAction(false)
    }
  }

  const openWebmail = async (email: string) => {
    console.log('[WEBMAIL CLICK]', { clickedEmail: email, hostingAccountId: hostingId })
    setWmLoad(prev => ({ ...prev, [email]: true }))
    try {
      const res = await fetch('/api/client/email-accounts/webmail-sso', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, hostingAccountId: hostingId }),
      })
      const data = await res.json() as { redirectUrl?: string; error?: string }
      if (!res.ok || !data.redirectUrl) throw new Error(data.error ?? 'Erro ao abrir Webmail.')
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Não foi possível abrir o Webmail.')
    } finally {
      setWmLoad(prev => ({ ...prev, [email]: false }))
    }
  }

  const handleCreate = async () => {
    if (!newLocalpart || !newPassword) return
    try {
      await callApi('create', { localpart: newLocalpart, password: newPassword, quota: newQuota })
      setModal({ mode: null }); setNewLocalpart(''); setNewPassword(''); setNewQuota(500)
      showToast('success', `${newLocalpart}@${domain} criado com sucesso.`)
      fetchEmails()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao criar email.')
    }
  }

  const handleChangePassword = async () => {
    if (!modal.email || !newPassword) return
    try {
      await callApi('change_password', { email: modal.email, password: newPassword })
      setModal({ mode: null }); setNewPassword('')
      showToast('success', 'Senha alterada com sucesso.')
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao alterar senha.')
    }
  }

  const handleChangeQuota = async () => {
    if (!modal.email) return
    try {
      await callApi('change_quota', { email: modal.email, quota: newQuota })
      setModal({ mode: null })
      showToast('success', 'Quota alterada com sucesso.')
      fetchEmails()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao alterar quota.')
    }
  }

  const handleDelete = async () => {
    if (!modal.email) return
    try {
      await callApi('delete', { email: modal.email })
      setModal({ mode: null })
      showToast('success', `${modal.email} excluído.`)
      fetchEmails()
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir conta.')
    }
  }

  // Storage totals — diskused/diskquota values are in bytes (UAPI normalises to bytes)
  const totalUsedBytes  = emails.reduce((s, e) => s + (e.diskused  ?? 0), 0)
  const totalQuotaBytes = emails.reduce((s, e) => s + (e.diskquota ?? 0), 0)
  const active          = emails.filter(e => e.suspended_login !== 1).length
  const freePct         = totalQuotaBytes > 0 ? 100 - usagePct(totalUsedBytes, totalQuotaBytes) : 100
  const freeBytes       = Math.max(0, totalQuotaBytes - totalUsedBytes)

  return (
    <div className="space-y-7">

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Email Corporativo</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            {domain ? `Gerenciando contas @${domain}` : 'Gerencie as suas contas de email profissional'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEmails}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}
            title="Actualizar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setModal({ mode: 'create' }); setNewLocalpart(''); setNewPassword(''); setNewQuota(500) }}
            disabled={loading || !!error || provisioning || !domain}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}
            title={provisioning ? 'Aguardando configuração do domínio' : undefined}
          >
            <Plus size={16} /> Nova Conta
          </button>
        </div>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Contas ativas',
              value: String(active),
              accent: '#059669', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)',
            },
            {
              label: 'Armazenamento usado',
              value: formatBytes(totalUsedBytes),
              accent: '#2563EB', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.15)',
            },
            {
              label: 'Cota total',
              value: totalQuotaBytes > 0 ? formatBytes(totalQuotaBytes) : '∞',
              accent: '#D9A300', bg: 'rgba(245,183,0,0.08)', border: 'rgba(245,183,0,0.20)',
            },
            {
              label: 'Espaço livre',
              value: totalQuotaBytes > 0 ? `${freePct}% (${formatBytes(freeBytes)})` : '∞',
              accent: '#8B5CF6', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.15)',
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl p-5"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: s.accent }}>{s.label}</div>
              <div className="text-xl font-black leading-tight" style={{ color: '#0B0B0D' }}>{s.value}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Storage summary bar */}
      {!loading && !error && totalQuotaBytes > 0 && emails.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
          <div className="flex items-center justify-between mb-3 text-sm">
            <div className="flex items-center gap-2 font-semibold" style={{ color: '#374151' }}>
              <HardDrive size={14} style={{ color: '#2563EB' }} /> Utilização Total do Armazenamento
            </div>
            <span className="font-bold" style={{ color: usageColor(usagePct(totalUsedBytes, totalQuotaBytes)) }}>
              {usagePct(totalUsedBytes, totalQuotaBytes)}%
            </span>
          </div>
          <StorageBar used={totalUsedBytes} total={totalQuotaBytes} />
          <div className="flex items-center justify-between mt-2 text-xs" style={{ color: '#9CA3AF' }}>
            <span>{formatBytes(totalUsedBytes)} usado</span>
            <span>{formatBytes(totalQuotaBytes)} total</span>
          </div>
        </div>
      )}

      {/* Purchased email packages awaiting provisioning */}
      {!loading && !error && provisioning && emailServices.length > 0 && emailServices.map((svc) => (
        <div key={svc.id} className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFBEB', border: '1px solid rgba(245,183,0,0.35)', boxShadow: '0 2px 12px rgba(245,183,0,0.08)' }}>
          <div className="px-6 py-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,183,0,0.15)', border: '1px solid rgba(245,183,0,0.30)' }}>
              <Mail size={20} style={{ color: '#D9A300' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{svc.service_name ?? 'Pacote de E-mail Corporativo'}</p>
              <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>
                Compra confirmada em {new Date(svc.created_at).toLocaleDateString('pt-AO')}
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap"
              style={{ background: 'rgba(245,183,0,0.15)', color: '#92400E', border: '1px solid rgba(245,183,0,0.30)' }}>
              ⏳ Aguardando configuração
            </span>
          </div>
          <div className="px-6 pb-5">
            <p className="text-xs" style={{ color: '#78350F' }}>
              O seu pacote de e-mail está a ser configurado. Assim que estiver pronto, as caixas de correio ficarão disponíveis aqui.
              Se precisar de ajuda, <a href="/tickets" className="underline font-semibold">abra um ticket de suporte</a>.
            </p>
          </div>
        </div>
      ))}

      {/* Email list */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(15,23,42,0.05)' }}>
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <Mail size={15} style={{ color: '#059669' }} />
          </div>
          <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>
            {loading ? 'Carregando…' : `Contas de Email${domain ? ` @${domain}` : ''}`}
          </h2>
          {!loading && !error && (
            <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#F1F5F9', color: '#64748B' }}>
              {emails.length} conta{emails.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-full px-6 animate-pulse">
                <div className="flex items-center gap-4 py-3">
                  <div className="w-10 h-10 rounded-xl shrink-0" style={{ background: '#F3F4F6' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-48 rounded" style={{ background: '#F3F4F6' }} />
                    <div className="h-2 w-32 rounded" style={{ background: '#F9FAFB' }} />
                  </div>
                  <div className="h-7 w-24 rounded-lg" style={{ background: '#F9FAFB' }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <AlertCircle size={28} style={{ color: '#DC2626' }} />
            <p className="font-semibold text-sm" style={{ color: '#0B0B0D' }}>Erro ao carregar emails</p>
            <p className="text-xs text-center max-w-sm" style={{ color: '#94A3B8' }}>{error}</p>
            <button onClick={fetchEmails} className="mt-2 px-4 py-2 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
              Tentar novamente
            </button>
          </div>
        ) : emails.length > 0 ? (
          <div>
            {emails.map((em, i) => {
              const pct      = usagePct(em.diskused, em.diskquota)
              const barColor = usageColor(pct)
              const isActive = em.suspended_login !== 1
              const wmLoading = webmailLoading[em.email] ?? false

              return (
                <motion.div
                  key={em.email}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="px-6 py-4 flex items-start gap-4 group transition-colors duration-200"
                  style={{ borderBottom: i < emails.length - 1 ? '1px solid #F8FAFC' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <Mail size={17} style={{ color: '#059669' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: '#0B0B0D' }}>{em.email}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <StorageBar used={em.diskused} total={em.diskquota} delay={i * 0.04} />
                      <span className="text-xs shrink-0 font-medium flex items-center gap-1" style={{ color: '#94A3B8' }}>
                        <HardDrive size={10} />
                        {em.humandiskused} / {em.diskquota > 0 ? em.humandiskquota : '∞'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={isActive
                        ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                        : { background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                      {isActive ? 'Ativo' : 'Suspenso'}
                    </span>

                    {/* Webmail */}
                    <button
                      onClick={() => openWebmail(em.email)}
                      disabled={wmLoading}
                      title={`Entrar no Webmail — ${em.email}`}
                      aria-label={`Abrir Webmail de ${em.email}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-150 hover:opacity-80 active:scale-95 disabled:opacity-50"
                      style={{ background: '#1565C0', border: 'none' }}
                    >
                      {wmLoading
                        ? <Loader2 size={13} className="animate-spin" style={{ color: '#fff' }} />
                        : <WebmailIcon size={13} />
                      }
                      <span className="text-[11px] font-bold" style={{ color: '#fff' }}>
                        {wmLoading ? 'Abrindo…' : 'Webmail'}
                      </span>
                    </button>

                    {/* Password */}
                    <button
                      onClick={() => { setModal({ mode: 'password', email: em.email }); setNewPassword('') }}
                      title="Alterar senha"
                      aria-label={`Alterar senha de ${em.email}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
                      style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.25)' }}>
                      <Key size={13} style={{ color: '#D9A300' }} />
                    </button>

                    {/* Quota */}
                    <button
                      onClick={() => { setModal({ mode: 'quota', email: em.email, quota: em.diskquota }); setNewQuota(em.diskquota > 0 ? Math.round(em.diskquota / (1024 * 1024)) : 500) }}
                      title="Alterar quota"
                      aria-label={`Alterar quota de ${em.email}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
                      style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.20)' }}>
                      <Settings size={13} style={{ color: '#6B7280' }} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setModal({ mode: 'delete', email: em.email })}
                      title="Excluir conta"
                      aria-label={`Excluir ${em.email}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                      <Trash2 size={13} style={{ color: '#DC2626' }} />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <Mail size={28} style={{ color: '#059669' }} />
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: '#0B0B0D' }}>Nenhuma conta de email criada</p>
            <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
              Crie o seu primeiro email {domain ? `@${domain}` : 'corporativo'}
            </p>
            <button onClick={() => setModal({ mode: 'create' })}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-black"
              style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.30)' }}>
              Criar primeiro email
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal.mode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setModal({ mode: null }) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}
            >

              {/* Create */}
              {modal.mode === 'create' && (
                <>
                  <h3 className="font-black text-lg mb-5" style={{ color: '#0B0B0D' }}>Nova Conta de Email</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Endereço de email</label>
                      <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                        <input
                          value={newLocalpart}
                          onChange={e => setNewLocalpart(e.target.value.toLowerCase().replace(/[^a-z0-9._%+\-]/g, ''))}
                          placeholder="nome"
                          className="flex-1 px-3 py-2.5 text-sm outline-none"
                          autoFocus
                        />
                        <span className="px-3 text-sm font-medium shrink-0"
                          style={{ background: '#F9FAFB', color: '#64748B', borderLeft: '1px solid #E5E7EB', padding: '10px 12px' }}>
                          @{domain}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Senha</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Quota (MB)</label>
                      <input type="number" value={newQuota} min={100} max={10000} onChange={e => setNewQuota(Number(e.target.value))}
                        className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setModal({ mode: null })} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F3F4F6', color: '#374151' }}>
                      Cancelar
                    </button>
                    <button onClick={handleCreate} disabled={actionLoading || !newLocalpart || !newPassword || newPassword.length < 8}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
                      {actionLoading ? <><Loader2 size={14} className="animate-spin" /> Criando…</> : 'Criar Email'}
                    </button>
                  </div>
                </>
              )}

              {/* Change password */}
              {modal.mode === 'password' && (
                <>
                  <h3 className="font-black text-lg mb-1" style={{ color: '#0B0B0D' }}>Alterar Senha</h3>
                  <p className="text-xs mb-5 font-mono px-2 py-1 rounded-lg inline-block" style={{ color: '#2563EB', background: 'rgba(59,130,246,0.08)' }}>{modal.email}</p>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Nova Senha</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres" autoFocus
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }} />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setModal({ mode: null })} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F3F4F6', color: '#374151' }}>
                      Cancelar
                    </button>
                    <button onClick={handleChangePassword} disabled={actionLoading || !newPassword || newPassword.length < 8}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
                      {actionLoading ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : 'Alterar Senha'}
                    </button>
                  </div>
                </>
              )}

              {/* Change quota */}
              {modal.mode === 'quota' && (
                <>
                  <h3 className="font-black text-lg mb-1" style={{ color: '#0B0B0D' }}>Alterar Quota</h3>
                  <p className="text-xs mb-5 font-mono px-2 py-1 rounded-lg inline-block" style={{ color: '#2563EB', background: 'rgba(59,130,246,0.08)' }}>{modal.email}</p>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>
                      Quota em MB <span style={{ color: '#9CA3AF' }}>(quota actual: {modal.quota && modal.quota > 0 ? formatBytes(modal.quota) : 'ilimitada'})</span>
                    </label>
                    <input type="number" value={newQuota} min={100} max={100000} onChange={e => setNewQuota(Number(e.target.value))}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }} />
                    <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Equivalente a: {formatBytes(newQuota, 'MB')}</p>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setModal({ mode: null })} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F3F4F6', color: '#374151' }}>
                      Cancelar
                    </button>
                    <button onClick={handleChangeQuota} disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)' }}>
                      {actionLoading ? <><Loader2 size={14} className="animate-spin" /> Salvando…</> : 'Salvar Quota'}
                    </button>
                  </div>
                </>
              )}

              {/* Delete */}
              {modal.mode === 'delete' && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                      <Trash2 size={18} style={{ color: '#DC2626' }} />
                    </div>
                    <h3 className="font-black text-lg" style={{ color: '#0B0B0D' }}>Excluir Email</h3>
                  </div>
                  <p className="text-sm mb-2" style={{ color: '#374151' }}>
                    Tem a certeza que deseja excluir <strong className="font-mono" style={{ color: '#DC2626' }}>{modal.email}</strong>?
                  </p>
                  <p className="text-xs mb-6" style={{ color: '#94A3B8' }}>
                    Esta ação é irreversível. Todos os emails desta caixa serão eliminados permanentemente.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setModal({ mode: null })} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F3F4F6', color: '#374151' }}>
                      Cancelar
                    </button>
                    <button onClick={handleDelete} disabled={actionLoading}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
                      {actionLoading ? <><Loader2 size={14} className="animate-spin" /> Excluindo…</> : 'Excluir Permanentemente'}
                    </button>
                  </div>
                </>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
