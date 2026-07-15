'use client'
import { useState, useEffect, useCallback } from 'react'
import { Mail, Plus, HardDrive, ExternalLink, Loader2, Trash2, Key, Settings, AlertCircle, CheckCircle2, X } from 'lucide-react'

interface EmailAccount {
  email: string
  login: string
  domain: string
  diskused: number
  diskquota: number
  humandiskused: string
  humandiskquota: string
  suspended_login: number
}

interface ApiResponse {
  emails?: EmailAccount[]
  domain?: string
  cpanel_username?: string
  error?: string
}

const card = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 18,
  boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
}

type ModalMode = 'create' | 'password' | 'quota' | 'delete' | null

export default function EmailManager() {
  const [emails, setEmails]     = useState<EmailAccount[]>([])
  const [domain, setDomain]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState<{ mode: ModalMode; email?: string }>({ mode: null })
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Form state
  const [newLocalpart, setNewLocalpart] = useState('')
  const [newPassword,  setNewPassword]  = useState('')
  const [newQuota,     setNewQuota]     = useState(500)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/client/email-accounts', { credentials: 'include' })
      const data: ApiResponse = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Erro ao carregar emails.')
        return
      }
      setEmails(data.emails ?? [])
      setDomain(data.domain ?? '')
    } catch {
      setError('Erro de comunicação com o servidor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEmails() }, [fetchEmails])

  const callApi = async (action: string, extra: Record<string, unknown>) => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/client/email-accounts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Operação falhou.')
      return true
    } catch (err: unknown) {
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const openWebmail = async (email: string) => {
    try {
      const res = await fetch('/api/client/email-accounts/webmail-sso', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json() as { redirectUrl?: string; error?: string }
      if (!res.ok || !data.redirectUrl) throw new Error(data.error ?? 'Erro ao abrir Webmail.')
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao abrir Webmail.')
    }
  }

  const handleCreate = async () => {
    if (!newLocalpart || !newPassword) return
    try {
      await callApi('create', { localpart: newLocalpart, password: newPassword, quota: newQuota })
      setModal({ mode: null })
      setNewLocalpart(''); setNewPassword(''); setNewQuota(500)
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

  const totalUsed  = emails.reduce((s, e) => s + (e.diskused ?? 0), 0)
  const totalQuota = emails.reduce((s, e) => s + (e.diskquota === 0 ? 0 : e.diskquota), 0)
  const active     = emails.filter(e => e.suspended_login !== 1).length

  return (
    <div className="space-y-7">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg"
          style={{
            background: toast.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: toast.type === 'success' ? '1px solid #6EE7B7' : '1px solid #FCA5A5',
            maxWidth: 360,
          }}>
          {toast.type === 'success'
            ? <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
            : <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0 }} />}
          <p className="text-sm font-medium flex-1" style={{ color: toast.type === 'success' ? '#065F46' : '#B91C1C' }}>{toast.msg}</p>
          <button onClick={() => setToast(null)}><X size={14} style={{ color: '#94A3B8' }} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Email Corporativo</h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>
            {domain ? `Gerenciando contas @${domain}` : 'Gerencie as suas contas de email profissional'}
          </p>
        </div>
        <button
          onClick={() => { setModal({ mode: 'create' }); setNewLocalpart(''); setNewPassword(''); setNewQuota(500) }}
          disabled={loading || !!error}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#F5B700,#D9A300)', boxShadow: '0 4px 14px rgba(245,183,0,0.35)' }}>
          <Plus size={16} /> Nova Conta
        </button>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Contas ativas',      value: String(active),           accent: '#059669', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)' },
            { label: 'Armazenamento usado', value: `${totalUsed} MB`,        accent: '#2563EB', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.15)' },
            { label: 'Cota total',          value: totalQuota > 0 ? `${totalQuota} MB` : '∞', accent: '#D9A300', bg: 'rgba(245,183,0,0.08)', border: 'rgba(245,183,0,0.20)' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-5" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <div className="text-xs font-semibold mb-1" style={{ color: s.accent }}>{s.label}</div>
              <div className="text-2xl font-black" style={{ color: '#0B0B0D' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Email list */}
      <div style={card}>
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
            <Loader2 size={24} className="animate-spin" style={{ color: '#D9A300' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>A carregar emails do cPanel…</p>
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
              const quota    = em.diskquota === 0 ? null : em.diskquota
              const usedPct  = quota ? Math.min(Math.round((em.diskused / quota) * 100), 100) : 0
              const barColor = usedPct > 80 ? '#EF4444' : usedPct > 60 ? '#F5B700' : '#10B981'
              const isActive = em.suspended_login !== 1

              return (
                <div key={em.email} className="px-6 py-4 flex items-start gap-4"
                  style={{ borderBottom: i < emails.length - 1 ? '1px solid #F8FAFC' : 'none' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <Mail size={17} style={{ color: '#059669' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm" style={{ color: '#0B0B0D' }}>{em.email}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[160px]" style={{ background: '#F1F5F9' }}>
                        <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: barColor }} />
                      </div>
                      <span className="text-xs flex-shrink-0 flex items-center gap-1 font-medium" style={{ color: '#94A3B8' }}>
                        <HardDrive size={10} /> {em.humandiskused} / {quota ? em.humandiskquota : '∞'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={isActive
                        ? { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.20)' }
                        : { background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                      {isActive ? 'Ativo' : 'Suspenso'}
                    </span>
                    <button
                      onClick={() => openWebmail(em.email)}
                      title="Webmail"
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)' }}>
                      <ExternalLink size={13} style={{ color: '#2563EB' }} />
                    </button>
                    <button
                      onClick={() => { setModal({ mode: 'password', email: em.email }); setNewPassword('') }}
                      title="Alterar senha"
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.25)' }}>
                      <Key size={13} style={{ color: '#D9A300' }} />
                    </button>
                    <button
                      onClick={() => { setModal({ mode: 'quota', email: em.email }); setNewQuota(quota ?? 500) }}
                      title="Alterar quota"
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.20)' }}>
                      <Settings size={13} style={{ color: '#6B7280' }} />
                    </button>
                    <button
                      onClick={() => setModal({ mode: 'delete', email: em.email })}
                      title="Excluir conta"
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                      <Trash2 size={13} style={{ color: '#DC2626' }} />
                    </button>
                  </div>
                </div>
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
      {modal.mode && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,0.20)' }}>

            {/* Create */}
            {modal.mode === 'create' && (
              <>
                <h3 className="font-black text-lg mb-5" style={{ color: '#0B0B0D' }}>Nova Conta de Email</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Endereço de email</label>
                    <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                      <input
                        value={newLocalpart} onChange={e => setNewLocalpart(e.target.value.toLowerCase().replace(/[^a-z0-9._%+\-]/g, ''))}
                        placeholder="nome" className="flex-1 px-3 py-2.5 text-sm outline-none" />
                      <span className="px-3 text-sm font-medium shrink-0" style={{ background: '#F9FAFB', color: '#64748B', borderLeft: '1px solid #E5E7EB', padding: '10px 12px' }}>
                        @{domain}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Senha</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }} />
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
                <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>{modal.email}</p>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Nova Senha</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres" className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }} />
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
                <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>{modal.email}</p>
                <div>
                  <label className="text-xs font-semibold mb-1 block" style={{ color: '#64748B' }}>Quota (MB)</label>
                  <input type="number" value={newQuota} min={100} max={100000} onChange={e => setNewQuota(Number(e.target.value))}
                    className="w-full border rounded-xl px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }} />
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
                  Tem a certeza que deseja excluir <strong>{modal.email}</strong>?
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
                    {actionLoading ? <><Loader2 size={14} className="animate-spin" /> Excluindo…</> : 'Excluir'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
