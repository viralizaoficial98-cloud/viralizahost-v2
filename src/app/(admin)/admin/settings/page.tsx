'use client'
import { useState, useEffect, useRef } from 'react'
import {
  Settings, Server, Globe, CreditCard, Mail,
  CheckCircle, AlertCircle, Loader2, Wifi, WifiOff,
  RefreshCw, Users, HardDrive, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '9px 13px', borderRadius: 10,
  border: '1px solid #E2E8F0', background: '#F8FAFC',
  color: '#0B0B0D', fontSize: 14, outline: 'none',
}
const labelStyle = {
  display: 'block' as const, fontSize: 12, fontWeight: 600,
  color: '#64748B', marginBottom: 5,
}
const card = {
  background: '#FFFFFF', border: '1px solid #E5E7EB',
  borderRadius: 18, boxShadow: '0 10px 30px rgba(15,23,42,0.06)', padding: 24,
}
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '9px 18px', borderRadius: 12, fontWeight: 700,
  fontSize: 13, color: '#000',
  background: 'linear-gradient(135deg,#F5B700,#D9A300)',
  boxShadow: '0 4px 14px rgba(245,183,0,0.30)',
  cursor: 'pointer', border: 'none',
}
const btnDisabled: React.CSSProperties = {
  ...btnPrimary, opacity: 0.6, cursor: 'not-allowed',
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface WhmConfig {
  url: string
  username: string
  hasToken: boolean
  tokenMask: string
  configured: boolean
}

interface WhmTestSuccess {
  success: true
  hostname?: string
  version?: string
  release?: string
  accountCount?: number
  username: string
  testedAt: string
}

interface WhmTestError {
  success: false
  error: string
  testedAt?: string
}

type WhmResult = WhmTestSuccess | WhmTestError | null

// ── WHM Section ───────────────────────────────────────────────────────────────
function WhmSection() {
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [url,           setUrl]           = useState('')
  const [token,         setToken]         = useState('')
  const [username,      setUsername]      = useState('root')
  const [tokenChanged,  setTokenChanged]  = useState(false)
  const [storedMask,    setStoredMask]    = useState('')
  const [result,        setResult]        = useState<WhmResult>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load existing config on mount
  useEffect(() => {
    fetch('/api/admin/settings/whm', { credentials: 'include' })
      .then(r => r.json())
      .then((data: WhmConfig) => {
        setUrl(data.url ?? '')
        setUsername(data.username ?? 'root')
        setStoredMask(data.tokenMask ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSaveAndTest = async () => {
    if (saving) return
    setResult(null)
    setSaving(true)

    // Abort any previous in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const body: Record<string, unknown> = {
        url,
        username,
        keepToken: !tokenChanged,
      }
      if (tokenChanged) body.token = token

      const res = await fetch('/api/admin/settings/whm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setResult({ success: false, error: data.error ?? 'Erro desconhecido.', testedAt: data.testedAt })
      } else {
        setResult({ success: true, ...data })
        // Update mask — token is now saved
        setStoredMask('••••••••••••••••••••')
        setToken('')
        setTokenChanged(false)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setResult({ success: false, error: 'Erro de comunicação com o servidor.' })
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-AO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm" style={{ color: '#94A3B8' }}>
        <Loader2 size={15} className="animate-spin" /> A carregar configuração…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* URL */}
      <div>
        <label style={labelStyle}>URL do Servidor WHM</label>
        <input
          type="url"
          placeholder="https://servidor.viralizahost.com:2087"
          style={inputStyle}
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={saving}
        />
        <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>
          Será normalizado para HTTPS e porta 2087 automaticamente.
        </p>
      </div>

      {/* Token */}
      <div>
        <label style={labelStyle}>API Token WHM</label>
        <input
          type="password"
          placeholder={storedMask || 'Cole o token gerado no WHM'}
          style={inputStyle}
          value={token}
          onChange={e => {
            setToken(e.target.value)
            setTokenChanged(true)
          }}
          disabled={saving}
          autoComplete="new-password"
        />
        {storedMask && !tokenChanged && (
          <p className="text-[11px] mt-1" style={{ color: '#10B981' }}>
            ✓ Token guardado. Deixe em branco para manter o actual.
          </p>
        )}
      </div>

      {/* Username */}
      <div>
        <label style={labelStyle}>Username Admin</label>
        <input
          type="text"
          placeholder="root"
          style={inputStyle}
          value={username}
          onChange={e => setUsername(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Button */}
      <button
        style={saving ? btnDisabled : btnPrimary}
        onClick={handleSaveAndTest}
        disabled={saving}
        aria-label="Salvar e testar ligação WHM"
      >
        {saving
          ? <><Loader2 size={14} className="animate-spin" /> Testando conexão…</>
          : <><Wifi size={14} /> Salvar &amp; Testar</>
        }
      </button>

      {/* Success result */}
      {result?.success === true && (
        <div className="rounded-xl p-4 space-y-2 mt-3"
          style={{ background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
          <div className="flex items-center gap-2">
            <CheckCircle size={16} style={{ color: '#059669' }} />
            <span className="font-bold text-sm" style={{ color: '#065F46' }}>Conexão estabelecida com sucesso</span>
          </div>
          <div className="text-xs space-y-1" style={{ color: '#047857' }}>
            {result.hostname && (
              <div className="flex gap-2">
                <span className="font-semibold w-36">Servidor:</span>
                <span>{result.hostname}</span>
              </div>
            )}
            {result.version && (
              <div className="flex gap-2">
                <span className="font-semibold w-36">WHM/cPanel:</span>
                <span>{result.version}{result.release ? ` (${result.release})` : ''}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="font-semibold w-36">Utilizador:</span>
              <span>{result.username}</span>
            </div>
            {result.accountCount !== undefined && (
              <div className="flex gap-2">
                <span className="font-semibold w-36">Contas encontradas:</span>
                <span>{result.accountCount}</span>
              </div>
            )}
            {result.testedAt && (
              <div className="flex gap-2">
                <span className="font-semibold w-36">Último teste:</span>
                <span>{formatDate(result.testedAt)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="font-semibold w-36">Estado:</span>
              <span className="font-black" style={{ color: '#059669' }}>Operacional</span>
            </div>
          </div>
        </div>
      )}

      {/* Error result */}
      {result?.success === false && (
        <div className="rounded-xl p-4 space-y-1 mt-3"
          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div className="flex items-center gap-2">
            <WifiOff size={16} style={{ color: '#DC2626' }} />
            <span className="font-bold text-sm" style={{ color: '#991B1B' }}>Falha na ligação</span>
          </div>
          <p className="text-xs" style={{ color: '#B91C1C' }}>{result.error}</p>
          {result.testedAt && (
            <p className="text-[11px]" style={{ color: '#F87171' }}>
              Testado em: {formatDate(result.testedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── WHM Sync Section ──────────────────────────────────────────────────────────

interface SyncResult {
  total: number
  imported: number
  whmAccountsCreated: number
  whmAccountsUpdated: number
  clientsCreated: number
  clientsLinked: number
  servicesCreated: number
  servicesUpdated: number
  pending: number
  suspended: number
  active: number
  markedMissing: number
  errors: Array<{ username: string; error: string }>
  syncedAt: string
}

function WhmSyncSection() {
  const [syncing,  setSyncing]  = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError]  = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    setSyncResult(null)
    setSyncError('')
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/admin/whm/sync', {
        method: 'POST',
        credentials: 'include',
        signal: abortRef.current.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setSyncError(data.error ?? 'Erro ao sincronizar.')
      } else {
        setSyncResult(data as SyncResult)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setSyncError('Erro de comunicação com o servidor.')
    } finally {
      setSyncing(false)
    }
  }

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-AO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: '#64748B' }}>
            Importa e sincroniza todas as contas cPanel existentes no servidor WHM com o portal ViralizaHost.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          style={syncing ? btnDisabled : btnPrimary}
          aria-label="Sincronizar contas WHM"
        >
          {syncing
            ? <><Loader2 size={14} className="animate-spin" /> Sincronizando…</>
            : <><RefreshCw size={14} /> Sincronizar Contas WHM</>
          }
        </button>

        <Link
          href="/admin/servers/whm-accounts"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all"
          style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}
        >
          <ExternalLink size={12} /> Ver Contas Importadas
        </Link>
      </div>

      {syncing && (
        <div className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: '#FFF8E1', border: '1px solid rgba(245,183,0,0.30)' }}>
          <Loader2 size={16} className="animate-spin" style={{ color: '#D9A300' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#92720A' }}>Sincronização em curso…</p>
            <p className="text-xs" style={{ color: '#B45309' }}>A consultar contas no WHM e a atualizar o portal.</p>
          </div>
        </div>
      )}

      {syncError && (
        <div className="rounded-xl p-4 space-y-1"
          style={{ background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={14} style={{ color: '#DC2626' }} />
            <span className="font-bold text-sm" style={{ color: '#991B1B' }}>Erro na sincronização</span>
          </div>
          <p className="text-xs" style={{ color: '#B91C1C' }}>{syncError}</p>
        </div>
      )}

      {syncResult && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
          <div className="flex items-center gap-2">
            <CheckCircle size={16} style={{ color: '#059669' }} />
            <span className="font-bold text-sm" style={{ color: '#065F46' }}>
              Sincronização concluída — {fmtDate(syncResult.syncedAt)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <HardDrive size={13} />,   label: 'Contas encontradas',    value: syncResult.total },
              { icon: <HardDrive size={13} />,   label: 'Contas importadas',     value: syncResult.imported ?? syncResult.total },
              { icon: <Users size={13} />,       label: 'Clientes criados',      value: syncResult.clientsCreated },
              { icon: <Users size={13} />,       label: 'Contas associadas',     value: syncResult.clientsLinked + syncResult.servicesCreated },
              { icon: <Server size={13} />,      label: 'Serviços atualizados',  value: syncResult.servicesUpdated },
              { icon: <CheckCircle size={13} />, label: 'Ativas',                value: syncResult.active },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-xs" style={{ color: '#047857' }}>
                <span style={{ color: '#059669' }}>{item.icon}</span>
                <span className="font-semibold">{item.value}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {syncResult.suspended > 0 && (
            <p className="text-xs" style={{ color: '#B45309' }}>
              ⚠ {syncResult.suspended} conta(s) suspensa(s) no WHM
            </p>
          )}
          {syncResult.markedMissing > 0 && (
            <p className="text-xs" style={{ color: '#64748B' }}>
              {syncResult.markedMissing} conta(s) ausente(s) do WHM (marcadas como inativas)
            </p>
          )}

          {(syncResult.pending ?? 0) > 0 && (
            <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-xs font-bold" style={{ color: '#92720A' }}>
                {syncResult.pending} conta(s) pendente(s) de associação
              </p>
              <p className="text-[11px]" style={{ color: '#B45309' }}>
                Estas contas foram importadas mas não têm e-mail válido.
                Aceda a &quot;Ver Contas Importadas&quot; para associar manualmente.
              </p>
            </div>
          )}

          {syncResult.errors.length > 0 && (
            <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(239,68,68,0.08)' }}>
              <p className="text-xs font-bold" style={{ color: '#DC2626' }}>
                {syncResult.errors.length} erro(s) técnico(s):
              </p>
              {syncResult.errors.slice(0, 5).map(e => (
                <p key={e.username} className="text-[11px]" style={{ color: '#B91C1C' }}>
                  {e.username}: {e.error}
                </p>
              ))}
              {syncResult.errors.length > 5 && (
                <p className="text-[11px]" style={{ color: '#B91C1C' }}>
                  +{syncResult.errors.length - 5} erros adicionais
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Gateways (static for now) ─────────────────────────────────────────────────
const gateways = [
  { name: 'Mercado Pago',              enabled: true  },
  { name: 'PayPal',                    enabled: true  },
  { name: 'Stripe',                    enabled: false },
  { name: 'Referência Multicaixa (AO)', enabled: true },
]

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(100,116,139,0.10)', border: '1px solid rgba(100,116,139,0.20)' }}>
          <Settings size={20} style={{ color: '#475569' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#0B0B0D' }}>Configurações do Sistema</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>Configurações globais da plataforma ViralizaHost</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── WHM / cPanel ─────────────────────────────────────────────────── */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
              <Server size={15} style={{ color: '#D9A300' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>WHM / cPanel API</h2>
          </div>
          <WhmSection />
        </div>

        {/* ── Registrador de Domínios ─────────────────────────────────────── */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.20)' }}>
              <Globe size={15} style={{ color: '#2563EB' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Registrador de Domínios</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Provedor</label>
              <select style={inputStyle}>
                <option>ResellerClub</option>
                <option>Namecheap</option>
                <option>GoDaddy</option>
                <option>ANGT (Angola)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>API Key</label>
              <input type="password" placeholder="••••••••••••••••" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nameservers Padrão</label>
              <input type="text" defaultValue="ns1.viralizahost.com, ns2.viralizahost.com" style={inputStyle} />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <AlertCircle size={13} style={{ color: '#94A3B8' }} />
              <span className="text-[11px]" style={{ color: '#94A3B8' }}>Em desenvolvimento</span>
            </div>
          </div>
        </div>

        {/* ── Gateways de Pagamento ─────────────────────────────────────────── */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)' }}>
              <CreditCard size={15} style={{ color: '#059669' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Gateways de Pagamento</h2>
          </div>
          <div className="space-y-1">
            {gateways.map((gw, i) => (
              <div key={gw.name} className="flex items-center justify-between py-3"
                style={{ borderBottom: i < gateways.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <span className="text-sm font-medium" style={{ color: '#0B0B0D' }}>{gw.name}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={gw.enabled} className="sr-only peer" />
                  <div className="w-10 h-5 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-400"
                    style={{ background: '#E2E8F0' }} />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* ── Email SMTP ───────────────────────────────────────────────────── */}
        <div style={card}>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.20)' }}>
              <Mail size={15} style={{ color: '#7C3AED' }} />
            </div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Email SMTP</h2>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Host SMTP</label>
                <input type="text" placeholder="smtp.gmail.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Porta</label>
                <input type="number" defaultValue={587} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email remetente</label>
              <input type="email" placeholder="noreply@viralizahost.com" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Senha</label>
              <input type="password" placeholder="••••••••" style={inputStyle} />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <AlertCircle size={13} style={{ color: '#94A3B8' }} />
              <span className="text-[11px]" style={{ color: '#94A3B8' }}>Em desenvolvimento</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── WHM Sync (full width) ─────────────────────────────────────────── */}
      <div style={card}>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(245,183,0,0.10)', border: '1px solid rgba(245,183,0,0.20)' }}>
            <RefreshCw size={15} style={{ color: '#D9A300' }} />
          </div>
          <div>
            <h2 className="font-bold text-sm" style={{ color: '#0B0B0D' }}>Sincronização de Contas WHM</h2>
            <p className="text-[11px]" style={{ color: '#94A3B8' }}>Importa clientes e hospedagens do servidor WHM para o portal</p>
          </div>
        </div>
        <WhmSyncSection />
      </div>

    </div>
  )
}
