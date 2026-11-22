'use client'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Link2, Loader2, Search, X } from 'lucide-react'

// Associação manual de uma conta WHM a um cliente registado no portal.
// Pesquisa só clientes (contas administrativas excluídas no servidor); antes de gravar
// mostra domínio, utilizador cPanel, servidor, contacto WHM e cliente, e exige confirmação.
// Não cria contas de cliente: sem cliente registado e confirmado, a conta fica «Sem cliente».

export interface WhmAccountForLink {
  id: string
  whm_username: string
  primary_domain: string
  contact_email?: string | null
  server_label?: string | null
  candidate?: { id: string; full_name?: string; email?: string } | null
}
type Client = { id: string; full_name: string; email: string; eligible: boolean; reason: string | null }
type Conflict = { currentClient?: { full_name?: string; email?: string } | null; serviceId?: string | null }

interface Props {
  account: WhmAccountForLink | null
  onClose: () => void
  onLinked: () => void
}

export default function AssociarClienteModal({ account, onClose, onLinked }: Props) {
  if (!account) return null
  return <Dialog key={account.id} account={account} onClose={onClose} onLinked={onLinked} />
}

function Dialog({ account, onClose, onLinked }: { account: WhmAccountForLink } & Omit<Props, 'account'>) {
  const pre = account.candidate?.email ? { id: account.candidate.id, full_name: account.candidate.full_name ?? '', email: account.candidate.email, eligible: true, reason: null } : null
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Client[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Client | null>(pre)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) return
    timer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await fetch(`/api/admin/profiles/search?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
        const j = await r.json()
        setResults(r.ok ? j.data ?? [] : [])
        if (!r.ok) setError(j.error ?? 'Erro na pesquisa.')
      } catch { setError('Falha de rede na pesquisa.') } finally { setSearching(false) }
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  async function save() {
    if (!selected || !confirmed) return
    setSaving(true); setError(null); setConflict(null)
    try {
      const r = await fetch(`/api/admin/whm/accounts/${account.id}/link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: selected.id, confirmed: true }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) { onLinked(); return }
      setError(j.error ?? 'Não foi possível associar.')
      if (r.status === 409) setConflict(j.conflict ?? {})
    } catch { setError('Falha de rede.') } finally { setSaving(false) }
  }

  const row = (label: string, value: React.ReactNode, testId?: string) => (
    <div className="flex justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
      <span className="text-xs" style={{ color: '#64748B' }}>{label}</span>
      <span className="text-xs font-semibold text-right break-all" style={{ color: '#0B0B0D' }} data-testid={testId}>{value}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.45)' }} role="dialog" aria-modal="true" aria-labelledby="link-title" data-testid="link-dialog">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id="link-title" className="font-black text-base flex items-center gap-2" style={{ color: '#0B0B0D' }}><Link2 size={16} /> Associar cliente</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-1 rounded-lg" style={{ color: '#64748B' }}><X size={18} /></button>
        </div>

        <label className="text-xs font-bold" style={{ color: '#334155' }} htmlFor="client-search">Cliente registado (nome ou e-mail)</label>
        <div className="relative mt-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input id="client-search" value={query} onChange={e => { setQuery(e.target.value); setResults([]) }} placeholder="Pesquisar cliente…" autoComplete="off"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl" style={{ border: '1px solid #E2E8F0' }} data-testid="client-search" />
          {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: '#F5B700' }} />}
        </div>
        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <p className="text-xs mt-2" style={{ color: '#64748B' }} data-testid="no-clients">Nenhum cliente registado encontrado. A conta continua «Sem cliente» até o titular ter conta no portal.</p>
        )}
        {results.length > 0 && (
          <ul className="mt-2 rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            {results.map(c => (
              <li key={c.id}>
                <button type="button" disabled={!c.eligible} onClick={() => { setSelected(c); setConfirmed(false); setConflict(null); setError(null) }}
                  className="w-full text-left px-3 py-2 text-xs disabled:opacity-60" data-testid="client-option"
                  style={{ background: selected?.id === c.id ? '#FFF8E1' : '#FFF', borderBottom: '1px solid #F1F5F9', cursor: c.eligible ? 'pointer' : 'not-allowed' }}>
                  <span className="font-bold block" style={{ color: '#0B0B0D' }}>{c.full_name || 'Sem nome'}</span>
                  <span style={{ color: '#64748B' }}>{c.email}</span>
                  {c.reason && <span className="block" style={{ color: '#B45309' }}>Não elegível: {c.reason}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }} data-testid="link-summary">
          <p className="text-xs font-black mb-1" style={{ color: '#0B0B0D' }}>Confirmar associação</p>
          {row('Domínio', account.primary_domain, 'sum-domain')}
          {row('Utilizador cPanel', account.whm_username, 'sum-user')}
          {row('Servidor', account.server_label ?? '—', 'sum-server')}
          {row('Contacto no WHM', account.contact_email ?? '—', 'sum-contact')}
          {row('Cliente seleccionado', selected ? <>{selected.full_name || 'Sem nome'}<br />{selected.email}</> : <span style={{ color: '#B45309' }}>nenhum</span>, 'sum-client')}
          {selected && account.contact_email && selected.email.toLowerCase() !== account.contact_email.toLowerCase() && (
            <p className="text-[11px] mt-2" style={{ color: '#92720A' }}>O e-mail do cliente é diferente do contacto no WHM. O contacto do WHM fica como está; confirme a titularidade por outro meio.</p>
          )}
        </div>

        <label className="flex items-start gap-2 mt-3 text-xs" style={{ color: '#334155' }}>
          <input type="checkbox" checked={confirmed} disabled={!selected} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5" data-testid="link-confirm" />
          Confirmo que verifiquei que este cliente é o titular desta hospedagem. Ele passa a vê-la na Área do Cliente e a poder abrir o cPanel/Webmail.
        </label>

        {error && (
          <div role="alert" className="mt-3 p-3 rounded-xl text-xs" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FCA5A5' }} data-testid="link-error">
            <p className="font-bold flex items-center gap-1"><AlertTriangle size={13} /> {error}</p>
            {conflict?.currentClient && <p className="mt-1">Vínculo actual: {conflict.currentClient.full_name || 'Sem nome'} ({conflict.currentClient.email ?? '—'}). Reveja antes de alterar — nada foi gravado.</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: '#F1F5F9', color: '#475569' }}>Cancelar</button>
          <button onClick={save} disabled={!selected || !confirmed || saving} data-testid="link-save"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50" style={{ background: '#F5B700', color: '#111' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Associar cliente
          </button>
        </div>
      </div>
    </div>
  )
}
