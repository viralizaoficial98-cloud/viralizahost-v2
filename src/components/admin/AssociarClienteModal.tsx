'use client'
import { useState, useEffect, useRef } from 'react'
import { X, Search, UserPlus, Link2, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface WhmRow {
  id: string
  whm_username: string
  primary_domain: string
  contact_email?: string | null
}

interface Profile {
  id: string
  full_name: string
  email: string
}

interface Props {
  account: WhmRow | null
  onClose: () => void
  onLinked: () => void
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 50,
  background: 'rgba(0,0,0,0.45)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 16,
}

const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480,
  boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 13px', borderRadius: 10,
  border: '1px solid #E2E8F0', background: '#F8FAFC',
  color: '#0B0B0D', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 18px', borderRadius: 12, fontWeight: 700,
  fontSize: 13, color: '#000', cursor: 'pointer', border: 'none',
  background: 'linear-gradient(135deg,#F5B700,#D9A300)',
  boxShadow: '0 4px 14px rgba(245,183,0,0.30)',
}

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: '#F1F5F9', color: '#475569',
  boxShadow: 'none', border: '1px solid #E2E8F0',
}

type Tab = 'existing' | 'new'

// Inner component — remounts on each new account (via key), so no reset effect needed
function ModalContent({ account, onClose, onLinked }: Omit<Props, 'account'> & { account: WhmRow }) {
  const [tab, setTab]         = useState<Tab>('existing')
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected]   = useState<Profile | null>(null)
  const [newEmail, setNewEmail]   = useState('')
  const [newName, setNewName]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [done, setDone]           = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced search — only fetches; never calls setState synchronously
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)

    if (tab !== 'existing' || query.length < 2) return

    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/admin/profiles/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
        const json = await res.json() as { data?: Profile[] }
        setResults(json.data ?? [])
      } catch { /* ignore */ } finally {
        setSearching(false)
      }
    }, 300)

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, tab])

  // Clear results when query is short (derived from render, not effect)
  const visibleResults = tab === 'existing' && query.length >= 2 && !selected ? results : []

  const handleLink = async () => {
    if (saving) return
    setError('')

    let body: Record<string, string>
    if (tab === 'existing') {
      if (!selected) { setError('Selecione um cliente.'); return }
      body = { profile_id: selected.id }
    } else {
      const email = newEmail.trim().toLowerCase()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Introduza um e-mail válido.'); return
      }
      body = { email, full_name: newName.trim() }
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/whm/accounts/${account.id}/link`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || json.error) {
        setError(json.error ?? 'Erro ao associar conta.')
      } else {
        setDone(true)
        setTimeout(() => { onLinked(); onClose() }, 1200)
      }
    } catch {
      setError('Erro de comunicação com o servidor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-black" style={{ color: '#0B0B0D' }}>Associar Cliente</h2>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              {account.primary_domain} · <span className="font-mono">{account.whm_username}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            style={{ color: '#94A3B8', border: 'none', background: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <CheckCircle size={40} style={{ color: '#059669' }} />
            <p className="font-bold" style={{ color: '#065F46' }}>Conta associada com sucesso!</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              {([
                { id: 'existing' as Tab, label: 'Cliente existente', icon: <Search size={13} /> },
                { id: 'new'      as Tab, label: 'Novo cliente',       icon: <UserPlus size={13} /> },
              ]).map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setError('') }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: tab === t.id ? '#F5B700' : '#F1F5F9',
                    color:      tab === t.id ? '#000'    : '#64748B',
                    border: '1px solid transparent', cursor: 'pointer',
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {tab === 'existing' ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                  <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSelected(null) }}
                    placeholder="Pesquisar por nome ou e-mail…"
                    style={{ ...inputStyle, paddingLeft: 36 }}
                    autoFocus
                  />
                </div>

                {searching && (
                  <div className="flex items-center gap-2 py-2 text-xs" style={{ color: '#94A3B8' }}>
                    <Loader2 size={13} className="animate-spin" /> Pesquisando…
                  </div>
                )}

                {visibleResults.length > 0 && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                    {visibleResults.map(p => (
                      <button key={p.id} onClick={() => { setSelected(p); setQuery(p.email) }}
                        className="w-full flex flex-col px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>
                        <span className="text-sm font-semibold" style={{ color: '#0B0B0D' }}>{p.full_name}</span>
                        <span className="text-xs" style={{ color: '#64748B' }}>{p.email}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selected && (
                  <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
                    <CheckCircle size={16} style={{ color: '#059669' }} />
                    <div>
                      <div className="text-sm font-bold" style={{ color: '#065F46' }}>{selected.full_name}</div>
                      <div className="text-xs" style={{ color: '#047857' }}>{selected.email}</div>
                    </div>
                    <button onClick={() => { setSelected(null); setQuery('') }}
                      className="ml-auto p-1 rounded hover:bg-green-200 transition-colors"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#059669' }}>
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#64748B' }}>
                    E-mail *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#64748B' }}>
                    Nome completo (opcional)
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nome do cliente"
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl p-3 mt-3"
                style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                <AlertCircle size={14} style={{ color: '#DC2626' }} />
                <span className="text-xs" style={{ color: '#B91C1C' }}>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={onClose} style={btnSecondary}>Cancelar</button>
              <button onClick={handleLink} disabled={saving}
                style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving
                  ? <><Loader2 size={13} className="animate-spin" /> Associando…</>
                  : <><Link2 size={13} /> Associar conta</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AssociarClienteModal({ account, onClose, onLinked }: Props) {
  if (!account) return null
  // key=account.id causes React to remount ModalContent whenever the account changes,
  // resetting all internal state without needing a useEffect setState call.
  return <ModalContent key={account.id} account={account} onClose={onClose} onLinked={onLinked} />
}
