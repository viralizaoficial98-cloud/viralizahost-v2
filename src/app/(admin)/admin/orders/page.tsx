'use client'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ExternalLink, FlaskConical, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react'
import { HostingerRegisterDialog } from '@/components/admin/HostingerRegisterDialog'
import { PAYMENT_STATUS, TONE_CLASS, activationState, domainState, kz } from '@/lib/commerce/status'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Service = { id: string; order_item_id: string; service_name: string; service_type: string; provisioning_status: string; provisioning_error: string | null; provisioning_attempts: number; external_ref: string | null; domain: string | null; activation_source: string | null
  registrar_op?: { provider: string; status: string; provider_status: string | null; provider_order_id: string | null; ns_status: string | null; dns_status: string | null; cost_amount: number | null; cost_currency: string | null } | null
  /** Calculado no servidor com a configuração actual do registrador. */
  hostinger?: { eligible: boolean; reason: string | null } | null }
type Order = {
  id: string; order_number: string | null; created_at: string; paid_at: string | null; status: string; payment_status: string; activation_status: string; hold_reason?: string | null
  review_flag: 'test' | 'real' | null; review_note: string | null
  amount: number; currency: string | null; payment_method: string | null; transfer_ref: string | null; proof_url: string | null
  profiles: { full_name: string; email: string; role: string } | null
  order_items: { id: string; service_name: string; quantity: number; line_total: number | null; unit_price: number | null; renewal_price: number | null; billing_cycle: string | null; domain_case?: string | null; domain_case_note?: string | null; proposed_domain?: string | null; domain_name: string | null; domain_operation: string | null; availability?: string | null; years?: number | null; nameservers?: unknown }[]
  services: Service[]; invoice: { invoice_number: string; status: string } | null
  payments: { id: string; status: string; amount: number; currency: string; paid_at: string | null; created_at: string }[]
  domain_events?: { order_item_id: string; action: string; domain: string | null; proposed_domain: string | null; note: string | null; created_at: string; admin_name: string | null }[]
}

// Filtros com nome na URL (?filtro=…) para que o dashboard e os favoritos levem à lista certa.
const FILTERS = {
  'por-pagar': { label: 'Por pagar / validar', test: (o: Order) => o.status !== 'rejected' && o.status !== 'cancelled' && o.payment_status !== 'paid' },
  comprovativos: { label: 'Comprovativos por validar', test: (o: Order) => o.payment_status === 'proof_submitted' && !['rejected', 'cancelled'].includes(o.status) },
  dominios: { label: 'Domínios a confirmar / em tratamento', test: (o: Order) => !['rejected', 'cancelled'].includes(o.status) && o.order_items.some(i => i.availability === 'confirm' || ['manual_review', 'alternative', 'refund_manual'].includes(i.domain_case ?? '')) },
  activacao: { label: 'Activação pendente', test: (o: Order) => o.payment_status === 'paid' && o.services.some(s => ['pending', 'manual_required', 'failed'].includes(s.provisioning_status)) },
  concluidas: { label: 'Concluídas', test: (o: Order) => o.activation_status === 'active' || ['rejected', 'cancelled'].includes(o.status) },
  todas: { label: 'Todas', test: () => true },
} as const
type Filter = keyof typeof FILTERS

const EVENT_LABEL: Record<string, string> = {
  confirmed_available: 'Disponibilidade confirmada', unavailable_cancelled: 'Indisponível — encomenda cancelada (sem pagamento)',
  unavailable_manual_review: 'Indisponível após pagamento — caso manual aberto', alternative_proposed: 'Outro domínio proposto',
  domain_replaced: 'Domínio substituído', refund_forwarded: 'Encaminhado para reembolso (manual)', case_resolved: 'Caso encerrado',
}
const OPEN_CASE = ['manual_review', 'alternative', 'refund_manual']

// Estado do serviço (texto) — distinto dos botões de acção
const svcLabel = (s: Service) => {
  if (s.provisioning_status === 'active') return s.activation_source === 'registrar' ? 'Activo — confirmado pelo registrador' : s.activation_source === 'manual' ? 'Activo — marcado pela equipa' : 'Activo'
  if (s.service_type === 'domain') return s.provisioning_status === 'failed' ? 'Registo falhou' : 'A aguardar registo'
  return { pending: 'Activação por iniciar', in_progress: 'Em activação', manual_required: 'Activação manual pendente', failed: 'Activação falhou' }[s.provisioning_status] ?? s.provisioning_status
}

function OrdersInner() {
  const router = useRouter()
  const params = useSearchParams()
  const filter: Filter = (params.get('filtro') as Filter) in FILTERS ? (params.get('filtro') as Filter) : 'por-pagar'
  const focus = params.get('encomenda')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [hostinger, setHostinger] = useState<string | null>(null)
  const scrolled = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store' }); const j = await res.json()
      if (!res.ok || j.error) setError(j.error ?? `HTTP ${res.status}`)
      setOrders(j.orders ?? [])
    } catch { setError('Falha de rede.') } finally { setLoading(false) }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial dos dados
  useEffect(() => { load() }, [load])

  // Leva o administrador ao registo indicado pelo dashboard
  useEffect(() => {
    if (!focus || loading || scrolled.current === focus) return
    const el = document.getElementById(`order-${focus}`)
    if (el) { el.scrollIntoView({ block: 'center' }); scrolled.current = focus }
  }, [focus, loading, orders])

  const setFilter = (f: Filter) => router.push(f === 'por-pagar' ? '/admin/orders' : `/admin/orders?filtro=${f}`, { scroll: false })

  async function act(key: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setActing(key); setNotice(null)
    try {
      const res = await fetch('/api/admin/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) setNotice({ ok: false, text: j.error ?? 'Falhou.' })
      else if (j.provisioning) {
        const counts = j.provisioning.reduce((a: any, r: any) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {})
        const L: Record<string, string> = { active: 'activo(s)', manual_required: 'manual(is)', failed: 'falhado(s)', skipped: 'em espera' }
        setNotice({ ok: true, text: `Pagamento ${j.payment === 'paid' ? 'confirmado' : 'já estava confirmado'}. Activação: ${Object.entries(counts).map(([k, v]) => `${v} ${L[k] ?? k}`).join(', ')}.` })
      } else if (j.result) setNotice({ ok: j.ok, text: `${j.result.status === 'active' ? 'Activado' : 'Não activado'}: ${j.result.message}` })
      else setNotice({ ok: true, text: 'Feito.' })
      await load()
    } catch { setNotice({ ok: false, text: 'Falha de rede.' }) } finally { setActing(null) }
  }

  function markActive(o: Order, s: Service) {
    const isDomain = s.service_type === 'domain'
    const ref = window.prompt(isDomain
      ? `Marcar ${s.domain ?? 'o domínio'} como registado.\nIndique a referência do registo no registrador (obrigatória):`
      : `Marcar «${s.service_name}» como activado manualmente.\nReferência (utilizador cPanel, IP, n.º no fornecedor):`)
    if (ref === null) return
    if (isDomain && ref.trim().length < 3) { setNotice({ ok: false, text: 'Sem referência do registo, o domínio não pode ser marcado como activo.' }); return }
    act(s.id + 'm', { action: 'mark_active', serviceId: s.id, externalRef: ref.trim() || null, notes: `Activação manual (${o.order_number})` })
  }

  // «Registar na Hostinger»: decidido no servidor (GET /api/admin/orders → services[].hostinger), com a
  // configuração actual e o domínio normalizado. A interface não repete a regra.
  const hostingerEligible = (o: Order, s: Service) => !!s.hostinger?.eligible && o.payment_status === 'paid'
  // Mensagem gravada numa tentativa anterior (antes de a Hostinger estar activa) já não se aplica
  const staleManual = (s: Service) => !!s.hostinger?.eligible && s.provisioning_status === 'manual_required' && /sem integração automática activa/.test(s.provisioning_error ?? '')
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, orders.filter(f.test).length])), [orders])
  const filtered = orders.filter(FILTERS[filter].test)

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0A0A0A]">Encomendas</h1>
          <p className="text-sm text-[#888] mt-1">Validar pagamentos, confirmar domínios e acompanhar a activação dos serviços</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E8E8E8] text-sm text-[#555] hover:border-[#F5B700]"><RefreshCw size={14} /> Actualizar</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4" role="tablist">
        {(Object.keys(FILTERS) as Filter[]).map(k => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} data-testid={`orders-filter-${k}`}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${filter === k ? 'bg-[#F5B700] text-black' : 'bg-white border border-[#E8E8E8] text-[#555]'}`}>
            {FILTERS[k].label} <span className="opacity-60">({counts[k] ?? 0})</span>
          </button>
        ))}
      </div>
      {hostinger && <HostingerRegisterDialog serviceId={hostinger} onClose={changed => { setHostinger(null); if (changed) void load() }} />}
      {notice && <div role="status" className={`mb-4 p-3 rounded-xl text-sm ${notice.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{notice.text}</div>}
      {error && <div className="mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-700" role="alert">Falha ao carregar: {error}</div>}
      {loading && !orders.length ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>
        : filtered.length === 0 ? <div className="text-center py-16 text-[#888] bg-white rounded-2xl border border-[#E8E8E8]">{error ? 'Não foi possível carregar as encomendas.' : 'Nenhuma encomenda nesta lista.'}</div>
        : (
          <ul className="space-y-4">
            {filtered.map(o => {
              const p = PAYMENT_STATUS[o.payment_status] ?? PAYMENT_STATUS.unpaid
              const a = activationState(o, o.order_items)
              const approved = o.payments?.find(x => x.status === 'approved')
              const staffBuyer = o.profiles?.role === 'admin'
              const focused = focus && (focus === o.order_number || focus === o.id)
              return (
                <li key={o.id} id={`order-${o.order_number ?? o.id}`} className={`bg-white border rounded-2xl p-5 scroll-mt-24 ${focused ? 'border-[#F5B700] ring-2 ring-[#F5B700]/40' : 'border-[#E8E8E8]'}`} data-testid="admin-order">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[#0A0A0A]">{o.order_number ?? o.id.slice(0, 8)} · {o.currency && o.currency !== 'AKZ' ? `${o.currency} ${o.amount}` : kz(o.amount)}</p>
                      <p className="text-xs text-[#888]">
                        {new Date(o.created_at.replace(' ', 'T').slice(0, 23) + 'Z').toLocaleString('pt-PT')} · {o.profiles ? `${o.profiles.full_name || 'Sem nome'} (${o.profiles.email})` : 'Sem conta associada'}
                        {o.invoice ? ` · Factura ${o.invoice.invoice_number}` : ''}
                      </p>
                      {approved && <p className="text-xs text-[#555] mt-1" data-testid="payment-confirmed">Pagamento validado em {new Date(String(approved.paid_at ?? approved.created_at).replace(' ', 'T').slice(0, 23) + 'Z').toLocaleString('pt-PT')} · {approved.currency === 'AKZ' ? kz(approved.amount) : `${approved.currency} ${approved.amount}`}</p>}
                      {o.transfer_ref && <p className="text-xs text-[#555] mt-1">Ref. transferência: {o.transfer_ref}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[p.tone]}`} data-testid="order-payment-state">Pagamento: {p.label}</span>
                      {o.order_items.filter(i => i.availability != null && i.domain_name).map(i => { const d = domainState(i, o.services.find(x => x.order_item_id === i.id)); return (
                        <span key={i.id} className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[d.tone]}`} data-testid="order-domain-state" data-state={d.key}>Domínio{o.order_items.filter(x => x.availability != null).length > 1 ? ` ${i.domain_name}` : ''}: {d.label}</span>) })}
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_CLASS[a.tone]}`}>Activação: {a.label}</span>
                      {['rejected', 'cancelled'].includes(o.status) && <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-50 text-red-700">Cancelada</span>}
                      {o.review_flag === 'test' && <span className="text-xs font-bold px-2 py-1 rounded-full bg-purple-50 text-purple-700" data-testid="flag-test">Teste (fora da receita)</span>}
                      {o.review_flag === 'real' && <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-700">Confirmada como real</span>}
                    </div>
                  </div>
                  {staffBuyer && !o.review_flag && (
                    <div className="mt-3 p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex flex-wrap items-center gap-2" data-testid="possible-test">
                      <FlaskConical size={14} /> Encomenda feita com uma conta da equipa: pode ser de teste. Nada é apagado nem ajustado — a equipa decide.
                      <button disabled={!!acting} onClick={() => { const note = window.prompt('Nota (opcional):') ?? ''; act(o.id + 't', { action: 'review', orderId: o.id, flag: 'test', notes: note }, 'Marcar como encomenda de teste? Deixa de contar na receita do painel; facturas e pagamentos ficam como estão.') }} className="px-2 py-1 rounded-lg bg-purple-700 text-white font-bold">É teste</button>
                      <button disabled={!!acting} onClick={() => act(o.id + 'r', { action: 'review', orderId: o.id, flag: 'real' })} className="px-2 py-1 rounded-lg border border-purple-300 font-bold">É real</button>
                    </div>
                  )}
                  {o.review_flag && <p className="mt-2 text-xs text-[#888]">{o.review_note ? `Nota: ${o.review_note} · ` : ''}<button className="underline" disabled={!!acting} onClick={() => act(o.id + 'u', { action: 'review', orderId: o.id, flag: null }, 'Retirar a marcação desta encomenda?')}>Retirar marcação</button></p>}
                  <table className="w-full text-sm mt-4">
                    <thead><tr className="text-left text-[11px] text-[#999]"><th className="font-semibold pb-1">Item</th><th className="font-semibold pb-1">Valor</th><th className="font-semibold pb-1">Estado do serviço</th><th className="font-semibold pb-1 text-right">Acções</th></tr></thead>
                    <tbody>
                      {o.order_items.map(it => {
                        const s = o.services.find(x => x.order_item_id === it.id)
                        return (
                          <tr key={it.id} className="border-t border-[#F3F3F3] align-top" data-testid="order-item">
                            <td className="py-2 pr-2">{it.service_name}{it.quantity > 1 ? ` × ${it.quantity}` : ''}{it.domain_name ? <span className="block text-xs text-[#888]">{it.domain_name}</span> : null}
                              {nsText(it.nameservers) && <span className="block text-[11px] text-[#666] font-mono" data-testid="item-ns">NS: {nsText(it.nameservers)}</span>}
                              {it.availability === 'confirm' && (
                                <span className="mt-1 flex flex-wrap items-center gap-1" data-testid="domain-confirm">
                                  <span className="text-xs font-bold text-amber-800">A confirmar pela equipa:</span>
                                  <button disabled={!!acting} onClick={() => act(it.id + 'ok', { action: 'domain_availability', orderItemId: it.id, available: true }, `Confirma que ${it.domain_name} está livre? ${o.payment_status === 'paid' ? 'O pagamento já está validado: o registo e os serviços dependentes seguem agora.' : 'O registo segue depois de o pagamento ser validado.'}`)} className="px-2 py-0.5 rounded bg-green-600 text-white text-xs" data-testid="domain-available">Livre</button>
                                  <button disabled={!!acting} onClick={() => {
                                    const charged = o.payment_status === 'paid' || o.payment_status === 'proof_submitted'
                                    const reason = window.prompt(`${it.domain_name} está ocupado. Indique o motivo (fica no histórico).\n${charged ? 'Há pagamento/comprovativo: NÃO é cancelado nem reembolsado — abre um caso para propor outro domínio ou tratar o reembolso manualmente.' : 'Sem pagamento: a encomenda é cancelada sem cobrança.'}`)
                                    if (reason && reason.trim().length >= 3) act(it.id + 'no', { action: 'domain_availability', orderItemId: it.id, available: false, reason: reason.trim() })
                                    else if (reason !== null) setNotice({ ok: false, text: 'Indique o motivo (pelo menos 3 caracteres).' })
                                  }} className="px-2 py-0.5 rounded bg-red-600 text-white text-xs" data-testid="domain-unavailable">Ocupado…</button>
                                </span>
                              )}
                              {OPEN_CASE.includes(it.domain_case ?? '') && (
                                <span className="mt-2 block rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-[#7F1D1D]" data-testid="domain-case">
                                  <strong>Caso manual:</strong> {it.domain_case_note}{it.proposed_domain ? <> · Proposta: <strong className="font-mono">{it.proposed_domain}</strong></> : null}
                                  <span className="mt-1.5 flex flex-wrap gap-1">
                                    <button disabled={!!acting} onClick={() => { const d = window.prompt(`Outro domínio a propor ao cliente (mesma extensão permite substituir sem diferença de preço):`, it.proposed_domain ?? ''); if (!d) return; const note = window.prompt('Nota para o histórico (opcional):') ?? ''; act(it.id + 'pp', { action: 'domain_case', caseAction: 'propose', orderItemId: it.id, domain: d.trim(), notes: note }) }} className="px-2 py-0.5 rounded border border-[#7F1D1D]/30 bg-white" data-testid="case-propose">Propor outro domínio…</button>
                                    {it.proposed_domain && <button disabled={!!acting} onClick={() => { if (!window.confirm(`O cliente aceitou ${it.proposed_domain}? O domínio da encomenda e dos serviços passa a ser este.`)) return; const confirmed = window.confirm(`${it.proposed_domain} já foi confirmado como livre?\nOK = sim (o registo segue) · Cancelar = fica «A confirmar pela equipa»`); const note = window.prompt('Nota para o histórico (opcional):') ?? ''; act(it.id + 'rp', { action: 'domain_case', caseAction: 'replace', orderItemId: it.id, domain: it.proposed_domain, confirmed, notes: note }) }} className="px-2 py-0.5 rounded border border-[#7F1D1D]/30 bg-white" data-testid="case-replace">Cliente aceitou: substituir…</button>}
                                    {it.domain_case !== 'refund_manual' && <button disabled={!!acting} onClick={() => { const note = window.prompt('Encaminhar para reembolso (tratado manualmente pela equipa financeira; nada é reembolsado automaticamente). Nota:'); if (note && note.trim().length >= 3) act(it.id + 'rf', { action: 'domain_case', caseAction: 'refund', orderItemId: it.id, notes: note.trim() }) }} className="px-2 py-0.5 rounded border border-[#7F1D1D]/30 bg-white" data-testid="case-refund">Encaminhar para reembolso…</button>}
                                    <button disabled={!!acting} onClick={() => { const note = window.prompt('Como foi resolvido? (ex.: «reembolso feito, ref. …»)'); if (note && note.trim().length >= 3) act(it.id + 'rs', { action: 'domain_case', caseAction: 'resolve', orderItemId: it.id, notes: note.trim() }) }} className="px-2 py-0.5 rounded border border-[#7F1D1D]/30 bg-white" data-testid="case-resolve">Encerrar caso…</button>
                                  </span>
                                </span>
                              )}
                              {it.availability === 'confirmed' && <span className="block text-xs text-green-700">Disponibilidade confirmada</span>}
                            </td>
                            <td className="py-2 pr-2 whitespace-nowrap">{kz(it.line_total ?? it.unit_price)}</td>
                            <td className="py-2 pr-2">
                              {s && <span className={`text-xs font-bold ${s.provisioning_status === 'active' ? 'text-green-700' : s.provisioning_status === 'failed' ? 'text-red-700' : 'text-amber-800'}`} data-testid="service-status">{svcLabel(s)}</span>}
                              {s?.external_ref && <span className="block text-xs text-[#555]">Ref.: {s.external_ref}</span>}
                              {s?.provisioning_error && s.provisioning_status !== 'active' && <span className="block text-xs text-[#B45309]" data-testid="service-error">{staleManual(s) ? 'Aguarda autorização: use «Registar na Hostinger…» (o custo é confirmado antes da compra).' : s.provisioning_error}</span>}
                              {s?.hostinger && !s.hostinger.eligible && s.hostinger.reason && s.provisioning_status !== 'active' && <span className="block text-xs text-[#64748B]" data-testid="hostinger-reason">Hostinger: {s.hostinger.reason}</span>}
                              {s && s.provisioning_attempts > 1 && <span className="block text-[11px] text-[#999]">{s.provisioning_attempts} tentativas</span>}
                              {s?.registrar_op?.provider === 'hostinger' && s.registrar_op.status !== 'succeeded' && s.registrar_op.status !== 'pending' && (
                                <span className="block text-xs text-[#1D4ED8]" data-testid="hostinger-op">Hostinger: {s.registrar_op.provider_status === 'payment_pending' ? 'pagamento ao fornecedor pendente' : s.registrar_op.provider_status === 'awaiting_setup' ? 'pago, a aguardar configuração' : s.registrar_op.status === 'unknown' ? 'inconclusivo — revisão manual' : s.registrar_op.status === 'failed' ? 'recusado' : 'pedido enviado'}</span>
                              )}
                              {s?.registrar_op?.status === 'succeeded' && s.registrar_op.ns_status === 'failed' && <span className="block text-xs text-red-700" data-testid="ns-failed">Nameservers por aplicar</span>}
                              {s?.registrar_op?.status === 'succeeded' && s.registrar_op.dns_status !== 'confirmed' && <span className="block text-xs text-amber-800" data-testid="dns-pending">DNS pendente</span>}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              {s && hostingerEligible(o, s) && (s.provisioning_status !== 'active' || s.registrar_op?.status === 'succeeded') && (
                                <button disabled={!!acting} onClick={() => setHostinger(s.id)} className="mr-1 mb-1 px-2 py-1 rounded-lg bg-[#673DE6] text-white text-xs font-bold" data-testid="hostinger-open">
                                  {s.provisioning_status === 'active' ? 'Hostinger…' : s.registrar_op && !['pending', 'failed'].includes(s.registrar_op.status) ? 'Hostinger: estado…' : 'Registar na Hostinger…'}
                                </button>
                              )}
                              {s && o.payment_status === 'paid' && s.provisioning_status !== 'active' && o.order_items.some(x => x.domain_name === s.domain && ['confirm', 'unavailable'].includes(x.availability ?? '')) && (
                                <span className="text-[11px] text-[#64748B]" data-testid="await-domain">{o.order_items.some(x => x.domain_name === s.domain && x.availability === 'confirm') ? 'Confirme primeiro a disponibilidade do domínio.' : 'Domínio em tratamento manual.'}</span>
                              )}
                              {s && o.payment_status === 'paid' && s.provisioning_status !== 'active' && !o.order_items.some(x => x.domain_name === s.domain && ['confirm', 'unavailable'].includes(x.availability ?? '')) && (
                                <span className="inline-flex gap-1">
                                  <button disabled={!!acting} onClick={() => act(s.id + 'p', { action: 'provision', serviceId: s.id }, s.service_type === 'domain' ? 'Repetir o registo automático? O estado no registrador é consultado antes de qualquer novo pedido.' : 'Repetir a activação automática? Nenhuma conta é criada em duplicado e nada é cobrado.')}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E8E8E8] text-xs hover:border-[#F5B700]" data-testid="retry-activation">
                                    {acting === s.id + 'p' ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Repetir
                                  </button>
                                  <button disabled={!!acting} onClick={() => markActive(o, s)} className="px-2 py-1 rounded-lg border border-green-600 text-green-700 text-xs font-bold" data-testid="mark-active">
                                    {s.service_type === 'domain' ? 'Marcar como registado…' : 'Marcar como activado…'}
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {!!o.domain_events?.length && (
                    <details className="mt-3 text-xs" data-testid="domain-history">
                      <summary className="cursor-pointer font-bold text-[#555]">Histórico do domínio ({o.domain_events.length})</summary>
                      <ol className="mt-2 space-y-1 border-l-2 border-[#E8E8E8] pl-3">
                        {o.domain_events.map((e, i) => (
                          <li key={i} data-testid="domain-event" data-action={e.action}>
                            <span className="text-[#888]">{new Date(String(e.created_at).replace(' ', 'T').slice(0, 23) + 'Z').toLocaleString('pt-PT')}</span> · <strong>{EVENT_LABEL[e.action] ?? e.action}</strong>
                            {e.domain ? ` — ${e.domain}` : ''}{e.proposed_domain ? ` → ${e.proposed_domain}` : ''}{e.note ? ` · «${e.note}»` : ''}{e.admin_name ? ` · ${e.admin_name}` : ''}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {o.proof_url && <a href={o.proof_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#2563EB] underline"><ExternalLink size={14} /> Ver comprovativo</a>}
                    {o.payment_status !== 'paid' && !['rejected', 'cancelled'].includes(o.status) && o.invoice?.status !== 'draft' && (
                      <>
                        <button disabled={!!acting} onClick={() => act(o.id + 'a', { action: 'approve', orderId: o.id }, `Confirmar que recebeu ${kz(o.amount)} e validar o pagamento?${o.order_items.some(i => i.availability === 'confirm') ? ' O domínio continua «A confirmar pela equipa»: o registo só segue depois dessa confirmação.' : ' Os serviços são activados.'}`)} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold" data-testid="approve-payment">
                          {acting === o.id + 'a' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {o.payment_status === 'proof_submitted' ? 'Validar pagamento' : 'Confirmar pagamento'}
                        </button>
                        {o.payment_status === 'proof_submitted' && (
                          <button disabled={!!acting} onClick={() => { const reason = window.prompt('Motivo da rejeição do comprovativo:'); if (reason) act(o.id + 'r', { action: 'reject_proof', orderId: o.id, reason }) }} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-red-300 text-red-700 text-sm font-bold" data-testid="reject-proof">
                            <X size={14} /> Rejeitar comprovativo
                          </button>
                        )}
                        <button disabled={!!acting} onClick={() => act(o.id + 'c', { action: 'cancel', orderId: o.id }, 'Cancelar esta encomenda?')} className="px-4 py-2 rounded-xl border border-[#E8E8E8] text-sm text-[#555]">Cancelar</button>
                      </>
                    )}
                    {o.invoice?.status === 'draft' && <span className="text-xs text-amber-800">Encomenda anterior: a factura só fica disponível depois de confirmar a disponibilidade do domínio.</span>}
                    {o.payment_status === 'paid' && o.services.some(s => ['pending', 'failed', 'manual_required'].includes(s.provisioning_status)) && (
                      <button disabled={!!acting} onClick={() => act(o.id + 'a', { action: 'approve', orderId: o.id }, 'Repetir a activação de todos os serviços por activar? Nada é cobrado de novo.')} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-[#E8E8E8] text-sm"><RotateCcw size={14} /> Repetir activação da encomenda</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}

/** Nameservers escolhidos para o domínio (item da encomenda), para a activação ou a equipa. */
function nsText(v: unknown): string {
  try {
    const o = (typeof v === 'string' ? JSON.parse(v) : v) as { useDefault?: boolean; ns?: string[] } | null
    return o?.ns?.length ? `${o.ns.join(', ')}${o.useDefault ? ' (padrão)' : ' (do cliente)'}` : ''
  } catch { return '' }
}

export default function AdminOrdersPage() {
  return <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>}><OrdersInner /></Suspense>
}
