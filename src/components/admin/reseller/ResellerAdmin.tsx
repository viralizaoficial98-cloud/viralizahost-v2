'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

// Painel → Revenda de Hospedagem. Tudo é validado no servidor (estado, modo, permissões); aqui só se mostram
// as acções possíveis no estado actual de cada pedido.

/* eslint-disable @typescript-eslint/no-explicit-any */
const STATUS: Record<string, [string, string]> = {
  submitted: ['Recebido', 'bg-blue-100 text-blue-800'], under_review: ['Em análise', 'bg-indigo-100 text-indigo-800'], technically_approved: ['Aprovado tecnicamente', 'bg-teal-100 text-teal-800'],
  awaiting_payment: ['A aguardar pagamento', 'bg-amber-100 text-amber-800'], paid: ['Pago', 'bg-lime-100 text-lime-800'], provisioning_authorized: ['Activação autorizada', 'bg-cyan-100 text-cyan-800'],
  provisioning: ['Em activação', 'bg-cyan-100 text-cyan-800'], awaiting_confirmation: ['Confirmar ACL', 'bg-orange-100 text-orange-800'], active: ['Activo', 'bg-green-100 text-green-800'],
  rejected: ['Rejeitado', 'bg-red-100 text-red-800'], cancelled: ['Cancelado', 'bg-gray-200 text-gray-700'], failed: ['Falha na activação', 'bg-red-100 text-red-800'],
  suspended: ['Suspenso', 'bg-red-100 text-red-800'],
}
const CYCLE: Record<string, string> = { monthly: 'Mensal', '3months': 'Trimestral', '6months': 'Semestral', '1year': 'Anual', '2years': '2 anos', '3years': '3 anos' }
const MODES: [string, string][] = [['disabled', 'Desactivado — planos com «Em breve»'], ['test', 'Teste — só administradores'], ['request_only', 'Só pedidos — aprovação manual (recomendado)'], ['automatic', 'Automático — checkout directo (exige autorizações)']]
const Badge = ({ s }: { s: string }) => <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS[s]?.[1] ?? 'bg-gray-100'}`} data-testid="rv-status" data-status={s}>{STATUS[s]?.[0] ?? s}</span>
const card = 'bg-white border border-[#E5E7EB] rounded-2xl'
const btn = 'px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50'
const inputBase = 'border border-[#E5E7EB] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#F5B700]'
const input = 'w-full border border-[#E5E7EB] rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:border-[#F5B700]'
const kz = (v: unknown) => (v == null ? '—' : `${Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} Kz`)
const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—')

async function api(url: string, body?: unknown) {
  const r = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: body && (body as any).__method ? (body as any).__method : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`)
  return j
}

export function ResellerAdmin({ initialRef }: { initialRef?: string | null }) {
  const [tab, setTab] = useState<'dash' | 'requests' | 'resellers' | 'ops' | 'settings'>(initialRef ? 'requests' : 'dash')
  const tabs: [typeof tab, string][] = [['dash', 'Painel'], ['requests', 'Pedidos'], ['resellers', 'Revendedores'], ['ops', 'Operações'], ['settings', 'Configurações']]
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 bg-white border border-[#E5E7EB] rounded-xl p-1 w-fit" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`rv-tab-${k}`} className={`px-3.5 py-2 rounded-lg text-sm font-semibold ${tab === k ? 'bg-[#F5B700] text-black' : 'text-[#64748B]'}`}>{l}</button>)}
      </div>
      {tab === 'dash' && <Dashboard go={setTab} />}
      {tab === 'requests' && <Requests initialRef={initialRef ?? null} />}
      {tab === 'resellers' && <Resellers />}
      {tab === 'ops' && <Ops />}
      {tab === 'settings' && <Settings />}
    </div>
  )
}

function Dashboard({ go }: { go: (t: any) => void }) {
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    Promise.all([api('/api/admin/reseller/requests'), api('/api/admin/reseller/services'), api('/api/admin/reseller/settings'), api('/api/admin/infra/servers')])
      .then(([r, s, st, sv]) => setD({ requests: r.items, services: s.items, settings: st.settings, env: st.env, servers: sv.servers })).catch(e => setD({ error: e.message }))
  }, [])
  if (!d) return <Loader2 className="animate-spin text-[#F5B700]" />
  if (d.error) return <p className="text-red-600 text-sm">{d.error}</p>
  const count = (f: (x: any) => boolean, l: any[]) => l.filter(f).length
  const tiles = [
    ['Pedidos por analisar', count(x => ['submitted', 'under_review'].includes(x.status), d.requests), 'requests'],
    ['Aprovados / a pagar', count(x => ['technically_approved', 'awaiting_payment'].includes(x.status), d.requests), 'requests'],
    ['Pagos por activar', count(x => ['paid', 'provisioning_authorized', 'provisioning', 'awaiting_confirmation', 'failed'].includes(x.status), d.requests), 'requests'],
    ['Revendedores activos', count(x => x.status === 'active', d.services), 'resellers'],
    ['Suspensos', count(x => x.status === 'suspended', d.services), 'resellers'],
    ['Rejeitados / cancelados', count(x => ['rejected', 'cancelled'].includes(x.status), d.requests), 'requests'],
  ] as const
  const rs = d.servers.filter((s: any) => s.services.includes('reseller'))
  return (
    <div className="space-y-4" data-testid="rv-dashboard">
      <div className={`${card} p-4 text-sm flex flex-wrap gap-x-6 gap-y-1`}>
        <span>Modo: <strong data-testid="rv-dash-mode">{MODES.find(m => m[0] === d.settings.mode)?.[1]}</strong></span>
        <span>Venda automática: <strong>{d.settings.automaticReady ? 'autorizada' : 'não autorizada'}</strong></span>
        <span>Escrita WHM neste processo: <strong>{d.env.provisioning ? 'activa' : 'desactivada'}</strong>{d.env.provisioning && !d.env.production ? ' (só servidores de teste)' : ''}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map(([l, n, t]) => <button key={l} onClick={() => go(t)} className={`${card} p-4 text-left hover:border-[#F5B700]`}><p className="text-2xl font-black">{n}</p><p className="text-xs text-[#64748B]">{l}</p></button>)}
      </div>
      <div className={`${card} p-4`}>
        <p className="font-bold text-sm mb-2">Servidores de revenda</p>
        {rs.length === 0 ? <p className="text-xs text-[#64748B]">Nenhum servidor associado à categoria «Revenda de hospedagem» (Servidores).</p> : (
          <ul className="space-y-1 text-xs">{rs.map((s: any) => <li key={s.id}><strong>{s.label}</strong> · {s.environment === 'test' ? 'teste' : 'produção'} · {s.resellerAuthorized ? 'autorizado' : <span className="text-red-700 font-bold">NÃO autorizado</span>} · {s.capacity.determinable ? `${s.capacity.storageFreeMb} MB e ${s.capacity.accountsFree} contas livres` : 'capacidade indeterminada'}</li>)}</ul>
        )}
      </div>
    </div>
  )
}

function Requests({ initialRef }: { initialRef: string | null }) {
  // Ligação directa (?pedido=REF, ex.: notificação): procura em todos os estados
  const [filter, setFilter] = useState(initialRef ? '' : 'open')
  const [q, setQ] = useState(initialRef ?? '')
  const [items, setItems] = useState<any[] | null>(null)
  const [open, setOpen] = useState<string | null>(initialRef)
  const load = useCallback(() => { api(`/api/admin/reseller/requests?estado=${filter}&q=${encodeURIComponent(q)}`).then(j => setItems(j.items)).catch(() => setItems([])) }, [filter, q])
  useEffect(load, [load])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select className={`${inputBase} w-auto`} value={filter} onChange={e => setFilter(e.target.value)} data-testid="rv-filter">
          <option value="open">Em aberto</option><option value="">Todos</option>
          {Object.entries(STATUS).filter(([k]) => k !== 'suspended').map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input className={`${inputBase} w-full sm:w-64`} placeholder="Referência, e-mail, domínio…" value={q} onChange={e => setQ(e.target.value)} data-testid="rv-search" />
        <button className={`${btn} border`} onClick={load}><RefreshCw size={13} /></button>
      </div>
      {!items ? <Loader2 className="animate-spin text-[#F5B700]" /> : items.length === 0 ? <p className={`${card} p-6 text-sm text-[#64748B]`} data-testid="rv-requests-empty">Sem pedidos neste filtro.</p> : (
        <ul className="space-y-2">
          {items.map(r => (
            <li key={r.id} className={card} data-testid="rv-request-row" data-ref={r.reference}>
              <button className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-1" onClick={() => setOpen(open === r.reference ? null : r.reference)}>
                <span className="font-mono text-xs font-bold">{r.reference}</span><Badge s={r.status} />{Number(r.is_test) ? <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 rounded">TESTE</span> : null}
                <span className="text-sm font-semibold">{r.full_name}{r.company ? ` · ${r.company}` : ''}</span>
                <span className="text-xs text-[#64748B]">{r.plan_name} · {CYCLE[r.cycle]} · {r.domain} · {dt(r.created_at)}</span>
              </button>
              {open === r.reference && <RequestDetail id={r.id} onChange={load} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RequestDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [note, setNote] = useState('')
  const [server, setServer] = useState('')
  const [aclText, setAclText] = useState('')
  const load = useCallback(() => api(`/api/admin/reseller/requests?id=${id}`).then(j => { setD(j); setServer(j.request.server_id ?? '') }).catch(e => setMsg({ ok: false, t: e.message })), [id])
  useEffect(() => { load() }, [load])
  const act = async (action: string, extra: Record<string, unknown> = {}, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setBusy(action); setMsg(null)
    try {
      const j = await api('/api/admin/reseller/requests', { id, action, note, ...extra })
      if (j.request) setD(j); else await load()
      setMsg({ ok: !(j.outcome && ['failed', 'blocked'].includes(j.outcome.status)), t: j.outcome?.message ?? 'Feito.' }); setNote(''); onChange()
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(null) }
  }
  const svcAct = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action); setMsg(null)
    try { const j = await api('/api/admin/reseller/services', { serviceId: d.request.service_id, action, ...extra }); setMsg({ ok: !(j.outcome && ['failed', 'blocked'].includes(j.outcome.status)), t: j.outcome?.message ?? 'Feito.' }); await load(); onChange() }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(null) }
  }
  if (!d) return <div className="px-4 pb-4"><Loader2 className="animate-spin text-[#F5B700]" />{msg && <p className="text-xs text-red-600">{msg.t}</p>}</div>
  const r = d.request, st = r.status as string
  const B = ({ a, label, cls = 'bg-[#0A0A0A] text-white', extra, confirm }: { a: string; label: string; cls?: string; extra?: Record<string, unknown>; confirm?: string }) => // função de render (não componente)
    <button className={`${btn} ${cls}`} disabled={!!busy} onClick={() => act(a, extra, confirm)} data-testid={`rv-act-${a}`}>{busy === a ? '…' : label}</button>
  const prov = d.provisioning
  return (
    <div className="border-t border-[#EEE] p-4 space-y-4 text-sm" data-testid="rv-detail">
      <div className="grid md:grid-cols-3 gap-4">
        <div><p className="text-[11px] uppercase text-[#64748B] font-bold mb-1">Cliente</p>
          <p>{r.full_name}{r.company ? ` (${r.company})` : ''}</p><p className="text-xs">{r.email} · {r.phone}</p>
          <p className="text-xs text-[#64748B]">{r.profile_id ? 'Com conta' : 'Sem conta (é ligada pelo e-mail ao encaminhar para pagamento)'}</p>
          <p className="text-xs mt-1">Clientes estimados: {r.estimated_clients ?? '—'} · Negócio: {r.business_type ?? '—'}</p>
          {r.notes && <p className="text-xs mt-1 whitespace-pre-wrap bg-[#F8FAFC] rounded p-2">{r.notes}</p>}
        </div>
        <div><p className="text-[11px] uppercase text-[#64748B] font-bold mb-1">Plano</p>
          <p>{r.plan_name} · {CYCLE[r.cycle]} · {kz(r.quoted_total)}</p><p className="text-xs">Domínio: <strong>{r.domain}</strong>{r.kind === 'upgrade' ? ' · UPGRADE' : ''}</p>
          {d.profile && <p className="text-xs mt-1" data-testid="rv-profile">{d.profile.storageMb} MB · {d.profile.maxAccounts} contas · {d.profile.bandwidthMb} MB tráfego · principal {d.profile.mainQuotaMb} MB · ACL {d.profile.aclName ?? '—'}{!d.profile.complete && <span className="text-red-700 font-bold"> · perfil incompleto: {d.profile.missing.join(', ')}</span>}</p>}
          {d.need && <p className="text-xs text-[#64748B]">Necessário: {d.need.storageMb} MB e {d.need.accounts} contas licenciadas</p>}
        </div>
        <div><p className="text-[11px] uppercase text-[#64748B] font-bold mb-1">Pagamento</p>
          {r.order_number ? <><p className="text-xs">Encomenda {r.order_number} · factura {r.invoice_number}</p><p className="text-xs">Estado: <strong data-testid="rv-payment">{r.payment_status === 'paid' ? 'pago' : r.payment_status ?? '—'}</strong></p><a className="text-xs underline" href={`/admin/orders?encomenda=${r.order_number}`}>Abrir no Financeiro / Pedidos</a></> : <p className="text-xs text-[#64748B]">Sem factura (só depois da aprovação técnica).</p>}
          {d.reservation && <p className="text-xs mt-1">Reserva: {d.reservation.storage_mb} MB, {d.reservation.accounts} contas ({d.reservation.status})</p>}
        </div>
      </div>

      {['submitted', 'under_review'].includes(st) && (
        <div className="space-y-2" data-testid="rv-servers">
          <p className="text-[11px] uppercase text-[#64748B] font-bold">Servidor (capacidade: espaço + compromissos + licença + reserva)</p>
          {d.servers.map((s: any) => (
            <label key={s.id} className={`flex items-start gap-2 p-2 rounded-lg border ${server === s.id ? 'border-[#F5B700] bg-amber-50' : 'border-[#EEE]'}`} data-testid="rv-server-option" data-eligible={s.problems.length ? '0' : '1'}>
              <input type="radio" name={`srv-${id}`} checked={server === s.id} onChange={() => setServer(s.id)} className="mt-1" />
              <span className="text-xs"><strong>{s.label}</strong> · {s.environment === 'test' ? 'teste' : 'produção'} · {s.capacity.determinable ? `${s.capacity.storageFreeMb} MB / ${s.capacity.accountsFree} contas livres` : 'capacidade indeterminada'}
                {s.problems.length ? <span className="block text-red-700">{s.problems.join(' ')}</span> : <span className="block text-green-700 font-bold">Elegível</span>}</span>
            </label>
          ))}
          <button className={`${btn} border`} disabled={!server || server === r.server_id || !!busy} onClick={() => act('select_server', { serverId: server })} data-testid="rv-act-select_server">Guardar servidor</button>
        </div>
      )}

      <div><label className="text-[11px] uppercase text-[#64748B] font-bold">Nota interna / motivo</label>
        <textarea className={`${input} min-h-[60px]`} value={note} onChange={e => setNote(e.target.value)} data-testid="rv-note" placeholder="Nota interna (ou motivo de rejeição/cancelamento, enviado ao cliente)" /></div>
      <div className="flex flex-wrap gap-2">
        {st === 'submitted' && B({ a: "start_review", label: "Iniciar análise" })}
        {st === 'under_review' && B({ a: "approve_technical", label: "Aprovar tecnicamente (reserva capacidade)", cls: "bg-green-700 text-white" })}
        {st === 'technically_approved' && B({ a: "send_to_payment", label: "Encaminhar para pagamento (emite factura)", cls: "bg-[#F5B700] text-black", confirm: "Criar a encomenda e a factura para o cliente?" })}
        {st === 'awaiting_payment' && B({ a: "refresh_payment", label: "Verificar pagamento" })}
        {st === 'awaiting_payment' && Number(r.is_test) === 1 && B({ a: "simulate_payment", label: "Simular pagamento (teste)", cls: "bg-amber-500 text-black" })}
        {st === 'paid' && B({ a: "authorize_provisioning", label: "Autorizar aprovisionamento", cls: "bg-green-700 text-white", confirm: `Criar o revendedor ${r.domain} no WHM do servidor seleccionado?` })}
        {B({ a: "note", label: "Guardar nota", cls: "border" })}
        {['submitted', 'under_review', 'technically_approved'].includes(st) && B({ a: "reject", label: "Rejeitar", cls: "bg-red-600 text-white" })}
        {['submitted', 'under_review', 'technically_approved', 'awaiting_payment'].includes(st) && B({ a: "cancel", label: "Cancelar", cls: "border border-red-300 text-red-700", confirm: "Cancelar o pedido (e a factura por pagar)?" })}
      </div>
      {msg && <p className={`text-xs font-semibold ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role="status" data-testid="rv-msg">{msg.t}</p>}

      {prov?.op && (
        <div className="rounded-xl border border-[#EEE] p-3 space-y-2" data-testid="rv-prov">
          <p className="text-[11px] uppercase text-[#64748B] font-bold">Aprovisionamento: <span data-testid="rv-op-status">{prov.op.status}</span> · passo {prov.op.step} · tentativas {prov.op.attempts}/{prov.op.max_attempts}{prov.op.state?.username ? ` · utilizador ${prov.op.state.username}` : ''}</p>
          {prov.op.last_error && <p className="text-xs text-red-700" data-testid="rv-op-error">{prov.op.last_error}</p>}
          <ol className="text-[11px] font-mono max-h-48 overflow-auto bg-[#F8FAFC] rounded p-2">{prov.events.map((e: any, i: number) => <li key={i} className={e.outcome === 'error' ? 'text-red-700' : ''}>{dt(e.created_at)} [{e.step}] {e.outcome} {e.message}{e.duration_ms != null ? ` (${e.duration_ms} ms)` : ''}</li>)}</ol>
          {prov.reseller?.verification && <details className="text-xs"><summary className="cursor-pointer font-semibold">Verificação</summary><ul>{Object.entries(prov.reseller.verification).map(([k, v]: any) => <li key={k}>{v.ok === false ? '✗' : v.ok === null ? '?' : '✓'} {k}: esperado {String(v.expected)} · obtido {String(v.actual)}</li>)}</ul></details>}
          <div className="flex flex-wrap gap-2 items-center">
            {['failed', 'blocked'].includes(prov.op.status) && <><button className={`${btn} bg-[#0A0A0A] text-white`} disabled={!!busy} onClick={() => svcAct('retry')} data-testid="rv-retry">Repetir (retoma no passo)</button>
              <button className={`${btn} border`} disabled={!!busy} onClick={() => svcAct('reset_attempts')} data-testid="rv-reset">Repor tentativas</button></>}
            {prov.op.status === 'awaiting_confirmation' && <>
              <input className={`${inputBase} w-56`} placeholder="Escreva ACL CONFIRMADA" value={aclText} onChange={e => setAclText(e.target.value)} data-testid="rv-acl-text" />
              <button className={`${btn} bg-green-700 text-white`} disabled={!!busy} onClick={() => svcAct('confirm_acl', { confirmText: aclText })} data-testid="rv-confirm-acl">Confirmar ACL e activar</button>
              <span className="text-[11px] text-[#64748B]">Verifique no WHM → «Edit Reseller Nameservers and Privileges» de {prov.reseller?.whm_username} que a ACL efectiva é «{prov.reseller?.acl_name}».</span></>}
          </div>
        </div>
      )}
      <details className="text-xs"><summary className="cursor-pointer font-semibold">Histórico ({d.events.length})</summary>
        <ul className="mt-1 space-y-0.5" data-testid="rv-history">{d.events.map((e: any) => <li key={e.id}>{dt(e.created_at)} · {e.action}{e.to_status && e.to_status !== e.from_status ? ` → ${STATUS[e.to_status]?.[0] ?? e.to_status}` : ''}{e.actor_name ? ` · ${e.actor_name}` : ''}{e.note ? ` — ${e.note}` : ''}</li>)}</ul>
        {r.internal_notes && <pre className="whitespace-pre-wrap bg-[#F8FAFC] rounded p-2 mt-2">{r.internal_notes}</pre>}
      </details>
    </div>
  )
}

function Resellers() {
  const [items, setItems] = useState<any[] | null>(null)
  const [msg, setMsg] = useState<Record<string, string>>({})
  const load = useCallback(() => { api('/api/admin/reseller/services').then(j => setItems(j.items)).catch(() => setItems([])) }, [])
  useEffect(load, [load])
  const act = async (serviceId: string, action: string, extra: Record<string, unknown> = {}) => {
    try {
      const j = await api('/api/admin/reseller/services', { serviceId, action, ...extra })
      const t = action === 'usage' ? `Uso: ${j.usage.diskUsedMb ?? 0} MB, ${j.usage.accountsUsed}/${j.usage.accountsLimit} contas` : action === 'reconcile' ? (j.ok ? 'Sem diferenças entre a base e o WHM.' : `Diferenças: ${j.diffs.join(' ')}`) : 'Feito.'
      setMsg(m => ({ ...m, [serviceId]: t })); load()
    } catch (e) { setMsg(m => ({ ...m, [serviceId]: (e as Error).message })) }
  }
  if (!items) return <Loader2 className="animate-spin text-[#F5B700]" />
  if (!items.length) return <p className={`${card} p-6 text-sm text-[#64748B]`} data-testid="rv-resellers-empty">Ainda não há revendedores.</p>
  return (
    <ul className="space-y-2">
      {items.map(s => {
        const u = s.last_usage ?? null
        return (
          <li key={s.id} className={`${card} p-4 space-y-2`} data-testid="rv-reseller-row" data-user={s.whm_username}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><strong className="font-mono">{s.whm_username}</strong><Badge s={s.status} /><span className="text-sm">{s.domain}</span>
              <span className="text-xs text-[#64748B]">{s.plan_name} · {s.client_name} ({s.client_email}) · {s.server_name === '__whm_config__' ? s.server_host : s.server_name} · vence {s.next_due_date ? String(s.next_due_date).slice(0, 10) : '—'}</span></div>
            <p className="text-xs text-[#64748B]">Limites: {s.storage_mb} MB · {s.max_accounts} contas · {s.bandwidth_mb} MB tráfego · ACL {s.acl_name}{u ? ` · uso: ${u.disk ?? 0} MB, ${u.accounts ?? 0} contas (${dt(u.at)})` : ''}{s.suspended_reason ? ` · suspensa: ${s.suspended_reason}` : ''}</p>
            <div className="flex flex-wrap gap-2">
              <button className={`${btn} border`} onClick={() => act(s.service_id, 'usage')} data-testid="rv-usage">Actualizar consumo</button>
              <button className={`${btn} border`} onClick={() => act(s.service_id, 'reconcile')} data-testid="rv-reconcile">Reconciliar</button>
              {s.status === 'active' && <button className={`${btn} bg-red-600 text-white`} data-testid="rv-suspend" onClick={() => { const reason = window.prompt('Motivo da suspensão (enviado ao cliente):'); if (reason) act(s.service_id, 'suspend', { reason }) }}>Suspender</button>}
              {s.status === 'suspended' && <button className={`${btn} bg-green-700 text-white`} data-testid="rv-unsuspend" onClick={() => act(s.service_id, 'unsuspend')}>Reactivar</button>}
            </div>
            {msg[s.service_id] && <p className="text-xs font-semibold" data-testid="rv-reseller-msg">{msg[s.service_id]}</p>}
          </li>
        )
      })}
    </ul>
  )
}

function Ops() {
  const [ops, setOps] = useState<any[] | null>(null)
  useEffect(() => { api('/api/admin/reseller/services?ops=1').then(j => setOps(j.ops)).catch(() => setOps([])) }, [])
  if (!ops) return <Loader2 className="animate-spin text-[#F5B700]" />
  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-xs min-w-[640px]" data-testid="rv-ops">
        <thead><tr className="text-left text-[#64748B] uppercase"><th className="p-3">Pedido</th><th>Domínio</th><th>Estado</th><th>Passo</th><th>Tentativas</th><th>Último erro</th><th>Actualizado</th></tr></thead>
        <tbody>{ops.length === 0 ? <tr><td className="p-3" colSpan={7}>Sem operações de aprovisionamento.</td></tr> : ops.map(o => (
          <tr key={o.id} className="border-t border-[#F1F5F9]"><td className="p-3 font-mono">{o.reference ?? '—'}</td><td>{o.domain}</td><td>{o.status}</td><td>{o.step}</td><td>{o.attempts}/{o.max_attempts}</td><td className="text-red-700 max-w-xs">{o.last_error ?? ''}</td><td>{dt(o.updated_at)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function Settings() {
  const [d, setD] = useState<any>(null)
  const [f, setF] = useState<any>({})
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const load = useCallback(() => api('/api/admin/reseller/settings').then(j => { setD(j); setF({ mode: j.settings.mode, notifyEmails: j.settings.notifyEmails.join(', '), requestNotice: j.settings.requestNotice ?? '', defaultNameservers: j.settings.defaultNameservers.join(', '), maxOpenPerEmail: j.settings.maxOpenPerEmail, confirmText: '', infraApprovalNote: '' }) }), [])
  useEffect(() => { load() }, [load])
  const save = async (body: Record<string, unknown>) => {
    setMsg(null)
    try { await api('/api/admin/reseller/settings', { __method: 'PUT', ...body }); setMsg({ ok: true, t: 'Guardado.' }); load() } catch (e) { setMsg({ ok: false, t: (e as Error).message }) }
  }
  if (!d) return <Loader2 className="animate-spin text-[#F5B700]" />
  const s = d.settings
  return (
    <div className="space-y-4 max-w-2xl" data-testid="rv-settings">
      <div className={`${card} p-4 space-y-3`}>
        <p className="font-bold">Modo comercial</p>
        {MODES.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="mode" checked={f.mode === k} onChange={() => setF({ ...f, mode: k })} data-testid={`rv-mode-${k}`} />{l}</label>)}
        {f.mode === 'automatic' && !s.automaticAuthorizedAt && <div className="text-xs space-y-1 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p>Autorização expressa: a venda automática cria revendedores no WHM sem intervenção. Exige aprovação técnica da infraestrutura registada abaixo.</p>
          <input className={input} placeholder="Escreva AUTORIZO VENDA AUTOMATICA" value={f.confirmText} onChange={e => setF({ ...f, confirmText: e.target.value })} data-testid="rv-auto-confirm" /></div>}
        <button className={`${btn} bg-[#0A0A0A] text-white`} onClick={() => save({ mode: f.mode, ...(f.mode === 'automatic' && !s.automaticAuthorizedAt ? { authorizeAutomatic: true, confirmText: f.confirmText } : {}) })} data-testid="rv-mode-save">Guardar modo</button>
        <p className="text-xs text-[#64748B]">Venda automática autorizada: {s.automaticAuthorizedAt ? `${dt(s.automaticAuthorizedAt)}` : 'não'}{s.automaticAuthorizedAt && <button className="underline ml-2" onClick={() => save({ revokeAutomatic: true })}>revogar</button>}</p>
      </div>
      <div className={`${card} p-4 space-y-2`}>
        <p className="font-bold">Aprovação técnica da infraestrutura</p>
        <p className="text-xs text-[#64748B]">{s.infraApprovedAt ? `Registada em ${dt(s.infraApprovedAt)}: ${s.infraApprovalNote}` : 'Não registada. Necessária para a venda automática (testes de contas-filhas, isolamento, ACL auditada).'}</p>
        {!s.infraApprovedAt ? <><textarea className={input} placeholder="Descreva a validação técnica feita" value={f.infraApprovalNote} onChange={e => setF({ ...f, infraApprovalNote: e.target.value })} data-testid="rv-infra-note" />
          <button className={`${btn} bg-green-700 text-white`} onClick={() => save({ infraApproval: true, infraApprovalNote: f.infraApprovalNote })} data-testid="rv-infra-approve">Registar aprovação técnica</button></>
          : <button className={`${btn} border border-red-300 text-red-700`} onClick={() => save({ infraApproval: false })}>Retirar aprovação</button>}
      </div>
      <div className={`${card} p-4 space-y-2`}>
        <p className="font-bold">Notificações e formulário</p>
        <label className="text-xs block">E-mails da equipa (novos pedidos, pagamentos, falhas)<input className={input} value={f.notifyEmails} onChange={e => setF({ ...f, notifyEmails: e.target.value })} data-testid="rv-notify" /></label>
        <label className="text-xs block">Aviso no formulário público (opcional)<textarea className={input} value={f.requestNotice} onChange={e => setF({ ...f, requestNotice: e.target.value })} /></label>
        <label className="text-xs block">Nameservers indicados aos revendedores<input className={input} value={f.defaultNameservers} onChange={e => setF({ ...f, defaultNameservers: e.target.value })} placeholder="ns1.viralizahost.com, ns2.viralizahost.com" /></label>
        <label className="text-xs block">Pedidos em aberto por e-mail (máx.)<input type="number" min={1} max={20} className={`${input} w-24`} value={f.maxOpenPerEmail} onChange={e => setF({ ...f, maxOpenPerEmail: e.target.value })} /></label>
        <button className={`${btn} bg-[#0A0A0A] text-white`} onClick={() => save({ notifyEmails: f.notifyEmails, requestNotice: f.requestNotice, defaultNameservers: f.defaultNameservers, maxOpenPerEmail: Number(f.maxOpenPerEmail) })} data-testid="rv-settings-save">Guardar</button>
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role="status" data-testid="rv-settings-msg">{msg.t}</p>}
      <p className="text-xs text-[#64748B]">Escrita no WHM neste processo: {d.env.provisioning ? 'activa' : 'desactivada (RESELLER_PROVISIONING_ENABLED)'} · servidores de produção: {d.env.production ? 'permitidos' : 'bloqueados (RESELLER_PRODUCTION_PROVISIONING)'}.</p>
    </div>
  )
}
