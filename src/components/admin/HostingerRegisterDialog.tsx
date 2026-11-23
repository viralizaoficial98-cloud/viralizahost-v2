'use client'
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, X } from 'lucide-react'

// «Registar na Hostinger»: pré-visualização (só leituras) e acções explícitas do administrador.
// A compra só é enviada depois de o administrador ver domínio, período, titular, nameservers, custo e
// método de pagamento, e confirmar. O cartão fica na Hostinger: aqui só aparece o rótulo do método.

type Owner = Record<string, string>
interface Preview {
  serviceId: string; orderNumber: string; domain: string; years: number; extension: string | null
  owner: Owner; ownerMissing: string[]; nameservers: string[]; nsDefault: boolean
  cost: { amountMinor: number; renewalMinor: number; amount: number; renewal: number; currency: string; itemId: string; label: string; product: string } | null
  paymentMethod: { id: number; label: string } | null
  availability: string | null
  portfolio: { status: string | null; registered: boolean; verification: string | null } | null
  operation: { provider: string; status: string; providerStatus: string | null; providerOrderId: string | null; providerRef: string | null; nsStatus: string | null; nsMessage: string | null; dnsStatus: string | null; attempts: number; message: string | null; authorizedAt: string | null } | null
  next: 'purchase' | 'setup' | 'reconcile' | 'link' | 'blocked' | 'done'
  blockers: string[]; notes: string[]; confirmToken: string | null
}
const OWNER_FIELDS = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'country', 'tax_id']
const money = (n: number, c: string) => `${n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`
const OP_STATUS: Record<string, string> = { pending: 'Por enviar', submitted: 'Pedido enviado', succeeded: 'Registado', failed: 'Recusado / por repetir', unknown: 'Inconclusivo — revisão manual' }
const PROVIDER_STATUS: Record<string, string> = { payment_pending: 'Pagamento ao fornecedor pendente (HTTP 202)', awaiting_setup: 'Pago — a aguardar configuração', setup_requested: 'Conclusão pedida', registered: 'Registado', requested: 'Compra pedida', no_response: 'Sem resposta (timeout)', released: 'Libertado após revisão' }

export function HostingerRegisterDialog({ serviceId, onClose }: { serviceId: string; onClose: (changed: boolean) => void }) {
  const [p, setP] = useState<Preview | null>(null)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; message: string; errors?: Record<string, unknown> } | null>(null)
  const [accept, setAccept] = useState(false)
  const [owner, setOwner] = useState<Owner | null>(null)
  const [changed, setChanged] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    try {
      const r = await fetch(`/api/admin/registrar/hostinger?serviceId=${encodeURIComponent(serviceId)}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setErr(j.error ?? `HTTP ${r.status}`); return }
      setP(j.preview); setLabels(j.labels ?? {}); setAccept(false)
    } catch { setErr('Falha de rede.') }
  }, [serviceId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial
  useEffect(() => { load() }, [load])

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setResult(null)
    try {
      const r = await fetch('/api/admin/registrar/hostinger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, serviceId, ...extra }) })
      const j = await r.json()
      if (!r.ok) setResult({ ok: false, message: j.error ?? `HTTP ${r.status}` })
      else { setResult({ ok: j.ok, message: j.message, errors: j.errors }); if (j.preview) setP(j.preview); setChanged(true) }
    } catch { setResult({ ok: false, message: 'Falha de rede: nenhuma compra foi repetida. Consulte o estado.' }) }
    finally { setBusy(null); setAccept(false) }
  }

  const op = p?.operation
  const btn = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="hst-title" data-testid="hostinger-dialog">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#EEE] sticky top-0 bg-white">
          <h2 id="hst-title" className="font-black text-[#0B0B0D]">Registar na Hostinger{p ? ` — ${p.domain}` : ''}</h2>
          <button onClick={() => onClose(changed)} aria-label="Fechar" className="p-1 rounded-lg hover:bg-[#F5F5F5]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {err && <p className="p-3 rounded-xl bg-red-50 text-red-700" role="alert">{err}</p>}
          {!p && !err && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#F5B700]" /></div>}
          {p && (
            <>
              <dl className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-x-4 gap-y-2" data-testid="hostinger-summary">
                <dt className="text-[#64748B]">Encomenda</dt><dd className="font-semibold">{p.orderNumber}</dd>
                <dt className="text-[#64748B]">Domínio</dt><dd className="font-semibold">{p.domain}</dd>
                <dt className="text-[#64748B]">Período</dt><dd>{p.years} {p.years === 1 ? 'ano' : 'anos'}</dd>
                <dt className="text-[#64748B]">Titular</dt>
                <dd data-testid="hostinger-owner">{[`${p.owner.first_name} ${p.owner.last_name}`.trim(), p.owner.company_name].filter(Boolean).join(' · ')}<span className="block text-xs text-[#555]">{[p.owner.email, p.owner.phone].filter(Boolean).join(' · ')}</span><span className="block text-xs text-[#555]">{[p.owner.address, p.owner.city, p.owner.state, p.owner.zip, p.owner.country].filter(Boolean).join(', ')}</span></dd>
                <dt className="text-[#64748B]">Nameservers</dt><dd className="font-mono text-xs" data-testid="hostinger-ns">{p.nameservers.join(', ')}{p.nsDefault ? ' (padrão ViralizaHost)' : ' (do cliente)'}</dd>
                <dt className="text-[#64748B]">Custo na Hostinger</dt>
                <dd data-testid="hostinger-cost">{p.cost ? <><strong>{money(p.cost.amount, p.cost.currency)}</strong> <span className="text-xs text-[#555]">(sem IVA; renovação {money(p.cost.renewal, p.cost.currency)}) · {p.cost.product} · {p.cost.itemId}</span></> : p.next === 'purchase' || p.next === 'blocked' ? <span className="text-amber-800">Não confirmado</span> : <span className="text-[#888]">Sem nova compra</span>}</dd>
                <dt className="text-[#64748B]">Pagamento</dt><dd data-testid="hostinger-payment">{p.paymentMethod ? `${p.paymentMethod.label} (predefinido na conta Hostinger)` : '—'}</dd>
              </dl>

              {op && (
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1" data-testid="hostinger-operation">
                  <p><strong>Estado:</strong> {OP_STATUS[op.status] ?? op.status}{op.providerStatus && op.providerStatus !== 'registered' ? ` · ${PROVIDER_STATUS[op.providerStatus] ?? op.providerStatus}` : ''}</p>
                  {op.providerOrderId && <p className="text-xs">Encomenda Hostinger: {op.providerOrderId}</p>}
                  {op.message && <p className="text-xs text-[#555]">{op.message}</p>}
                  {op.nsStatus && <p className={`text-xs ${op.nsStatus === 'failed' ? 'text-red-700' : 'text-[#555]'}`} data-testid="hostinger-ns-status">Nameservers: {op.nsStatus === 'applied' ? 'aplicados' : op.nsStatus === 'failed' ? 'falha ao aplicar' : 'por aplicar'}{op.nsMessage ? ` — ${op.nsMessage}` : ''}</p>}
                  {op.status === 'succeeded' && <p className={`text-xs font-bold ${op.dnsStatus === 'confirmed' ? 'text-green-700' : 'text-amber-800'}`} data-testid="hostinger-dns-status">{op.dnsStatus === 'confirmed' ? 'DNS confirmado' : 'DNS pendente'}</p>}
                  <p className="text-[11px] text-[#888]">{op.attempts} pedido(s) de compra{op.authorizedAt ? ` · autorizado em ${op.authorizedAt.slice(0, 16)}` : ''}</p>
                </div>
              )}

              {p.notes.map(n => <p key={n} className="p-3 rounded-xl bg-blue-50 text-blue-900 border border-blue-200">{n}</p>)}
              {p.blockers.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900" role="alert" data-testid="hostinger-blockers">
                  <p className="font-bold flex items-center gap-1"><AlertTriangle size={15} /> Revisão manual — nada será comprado</p>
                  <ul className="list-disc pl-5 mt-1">{p.blockers.map(b => <li key={b}>{b}</li>)}</ul>
                </div>
              )}

              {(p.ownerMissing.length > 0 || owner) && (
                <div className="p-3 rounded-xl border border-[#E2E8F0] space-y-2" data-testid="hostinger-owner-form">
                  <p className="font-bold">Corrigir dados do titular</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {OWNER_FIELDS.map(f => (
                      <label key={f} className="text-xs text-[#555]">{labels[f] ?? f}{p.ownerMissing.includes(f) ? ' *' : ''}
                        <input className={`w-full mt-0.5 rounded-lg border px-2 py-1.5 text-sm ${p.ownerMissing.includes(f) ? 'border-amber-400' : 'border-[#E2E8F0]'}`} name={f}
                          value={(owner ?? p.owner)[f] ?? ''} onChange={e => setOwner({ ...(owner ?? p.owner), [f]: e.target.value })} data-testid={`owner-${f}`} />
                      </label>
                    ))}
                  </div>
                  <button disabled={!!busy || !owner} className={`${btn} bg-[#0B0B0D] text-white`} onClick={async () => { await act('owner', { owner }); setOwner(null); await load() }} data-testid="owner-save">Guardar dados do titular</button>
                </div>
              )}

              {result && (
                <div className={`p-3 rounded-xl border ${result.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`} role="status" data-testid="hostinger-result">
                  {result.ok ? <CheckCircle2 size={15} className="inline mr-1" /> : <AlertTriangle size={15} className="inline mr-1" />}{result.message}
                  {result.errors && Object.keys(result.errors).length > 0 && <pre className="mt-2 text-[11px] whitespace-pre-wrap">{JSON.stringify(result.errors, null, 1)}</pre>}
                </div>
              )}

              {p.next === 'purchase' && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2" data-testid="hostinger-purchase">
                  <p className="text-red-900 flex gap-2"><ShieldAlert size={16} className="shrink-0 mt-0.5" /><span>Ao confirmar, a Hostinger cria a encomenda e pode <strong>debitar o método de pagamento predefinido da conta Hostinger</strong> ({p.paymentMethod?.label}) em {p.cost && money(p.cost.amount, p.cost.currency)} (mais IVA, se aplicável). A ViralizaHost não guarda nem pede dados do cartão.</span></p>
                  <label className="flex items-start gap-2"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} className="mt-1" data-testid="hostinger-accept" /> Confirmo o registo de {p.domain} por {p.years} {p.years === 1 ? 'ano' : 'anos'} com os dados acima.</label>
                  <button disabled={!accept || !!busy} onClick={() => act('purchase', { confirmToken: p.confirmToken })} className={`${btn} bg-red-600 text-white`} data-testid="hostinger-confirm">
                    {busy === 'purchase' ? <Loader2 size={14} className="animate-spin" /> : null} Confirmar e registar na Hostinger
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {p.next === 'setup' && <button disabled={!!busy} onClick={() => act('setup')} className={`${btn} bg-[#F5B700] text-black`} data-testid="hostinger-setup">{busy === 'setup' && <Loader2 size={14} className="animate-spin" />} Concluir registo (sem nova compra)</button>}
                {p.next === 'link' && <button disabled={!!busy} onClick={() => act('link')} className={`${btn} bg-[#F5B700] text-black`} data-testid="hostinger-link">{busy === 'link' && <Loader2 size={14} className="animate-spin" />} Associar domínio já registado (sem nova compra)</button>}
                {(p.next === 'reconcile' || ((op?.status === 'unknown' || op?.status === 'submitted') && op?.provider === 'hostinger')) && <button disabled={!!busy} onClick={() => act('reconcile')} className={`${btn} border border-[#E2E8F0]`} data-testid="hostinger-reconcile">{busy === 'reconcile' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Consultar estado na Hostinger</button>}
                {op?.status === 'succeeded' && op.nsStatus !== 'applied' && <button disabled={!!busy} onClick={() => act('nameservers')} className={`${btn} border border-[#E2E8F0]`} data-testid="hostinger-apply-ns">Aplicar nameservers</button>}
                {op?.status === 'succeeded' && op.dnsStatus !== 'confirmed' && <button disabled={!!busy} onClick={() => act('dns')} className={`${btn} border border-[#E2E8F0]`} data-testid="hostinger-check-dns">Verificar DNS</button>}
                {(op?.status === 'unknown' || (op && op.provider !== 'hostinger' && op.status === 'submitted')) && <button disabled={!!busy} onClick={() => { const note = window.prompt(op?.provider !== 'hostinger' ? `Confirme que no fornecedor «${op?.provider}» não houve registo de ${p.domain}:` : 'Confirme o que verificou no hPanel (ex.: «sem encomenda nem domínio na conta»):'); if (note) act('release', { note }) }} className={`${btn} border border-amber-400 text-amber-900`} data-testid="hostinger-release">Libertar nova tentativa…</button>}
                {p.ownerMissing.length === 0 && !owner && p.next !== 'done' && <button onClick={() => setOwner({ ...p.owner })} className={`${btn} border border-[#E2E8F0] text-[#555]`}>Editar titular</button>}
                <button disabled={!!busy} onClick={load} className={`${btn} border border-[#E2E8F0] text-[#555]`}><RefreshCw size={14} /> Actualizar</button>
              </div>
              <p className="text-[11px] text-[#888]">«Registado» só depois de a Hostinger o confirmar. Em caso de timeout, a consulta de estado é obrigatória antes de qualquer nova compra. Para registos feitos fora daqui continue a usar «Marcar como registado…» (nunca gera cobrança).</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
