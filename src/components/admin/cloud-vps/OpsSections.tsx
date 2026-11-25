'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge, Bars, btn, card, cvApi, cvPost, d10, dt, ErrorBox, input, Kpi, kz, money, Msg, Pager, Spinner } from './ui'

/* eslint-disable @typescript-eslint/no-explicit-any */
const SVC_LABEL: Record<string, string> = { active: 'Activos', suspended: 'Suspensos', pending: 'Pendentes', pending_provisioning: 'Por aprovisionar', expired: 'Expirados', cancelled: 'Cancelados' }
const REQ: Record<string, [string, any]> = {
  submitted: ['Recebido', 'blue'], under_review: ['Em análise', 'blue'], approved: ['Aprovado', 'cyan'], awaiting_payment: ['A aguardar pagamento', 'amber'], paid: ['Pago', 'green'],
  purchase_authorized: ['Aquisição autorizada', 'cyan'], provisioning: ['Em aprovisionamento', 'cyan'], active: ['Activo', 'green'], rejected: ['Rejeitado', 'red'], cancelled: ['Cancelado', 'gray'], failed: ['Falha na aquisição', 'red'],
}
const CYCLE: Record<string, string> = { monthly: '1 mês', '1year': '1 ano', '2years': '2 anos' }

// ── Visão geral ──
export function OverviewSection() {
  const [d, setD] = useState<any>(null), [err, setErr] = useState('')
  useEffect(() => { cvApi('overview').then(setD).catch(e => setErr(e.message)) }, [])
  if (err) return <ErrorBox msg={err} />
  if (!d) return <Spinner />
  return (
    <div className="space-y-4" data-testid="cv-overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total de VPS (conta do fornecedor)" value={d.vps.total} testId="kpi-total" />
        <Kpi label="VPS internos (protegidos)" value={d.vps.internal} testId="kpi-internal" />
        <Kpi label="VPS comerciais (serviços)" value={d.vps.commercial} testId="kpi-commercial" />
        <Kpi label="Importados sem associação" value={d.vps.unlinked} />
        <Kpi label="Activos" value={d.vps.active} tone="green" testId="kpi-active" />
        <Kpi label="Suspensos" value={d.vps.suspended} tone={d.vps.suspended ? 'amber' : undefined} />
        <Kpi label="Em aprovisionamento" value={d.vps.provisioning} />
        <Kpi label="Falhas de aprovisionamento" value={d.failures} tone={d.failures ? 'red' : undefined} testId="kpi-failures" />
        <Kpi label="Solicitações pendentes" value={d.requests.pending} tone={d.requests.pending ? 'amber' : undefined} testId="kpi-pending" />
        <Kpi label="Pedidos aprovados (em curso)" value={d.requests.approved} />
        <Kpi label="Facturação mensal (equivalente)" value={kz(d.money.monthlyBilling)} testId="kpi-billing" />
        <Kpi label="Custos do fornecedor / mês" value={d.money.fxConfigured ? kz(d.money.providerMonthly) : '—'} hint={d.money.fxConfigured ? (d.money.unknownCost ? `${d.money.unknownCost} serviço(s) sem custo conhecido` : undefined) : 'Defina o câmbio em Configurações'} />
        <Kpi label="Margem bruta / mês" value={d.money.fxConfigured ? kz(d.money.grossMargin) : '—'} tone={d.money.grossMargin < 0 ? 'red' : 'green'} testId="kpi-margin" />
        <Kpi label="Renovações (30 dias): clientes / fornecedor" value={`${d.renewals.client} / ${d.renewals.provider}`} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Bars title="Serviços VPS por estado" data={d.charts.servicesByState.map((x: any) => ({ label: SVC_LABEL[x.label] ?? x.label, n: x.n }))} testId="cv-chart-services" />
        <Bars title="Solicitações por estado" data={d.charts.requestsByStatus.map((x: any) => ({ label: REQ[x.label]?.[0] ?? x.label, n: x.n }))} testId="cv-chart-requests" />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className={`${card} p-4 text-xs`}><p className="font-bold text-sm mb-2">Próximas renovações de clientes</p>
          {d.renewals.clientList.length ? <ul className="space-y-1">{d.renewals.clientList.map((r: any) => <li key={r.id}>{d10(r.next_due_date)} · {r.service_name} · {r.email}</li>)}</ul> : <p className="text-[#64748B]">Nenhuma nos próximos 30 dias.</p>}</div>
        <div className={`${card} p-4 text-xs`}><p className="font-bold text-sm mb-2">Próximas cobranças do fornecedor</p>
          {d.renewals.providerList.length ? <ul className="space-y-1">{d.renewals.providerList.map((r: any) => <li key={r.provider_vm_id}>{d10(r.sub_next_billing_at)} · VM {r.provider_vm_id}{Number(r.is_internal) ? ' (interna)' : ''} · {money(r.sub_renewal_minor, r.sub_currency)} · renovação automática {Number(r.sub_auto_renew) ? 'activa' : 'desactivada'}</li>)}</ul> : <p className="text-[#64748B]">Nenhuma (ou subscrições por sincronizar).</p>}
          <p className="text-[#94A3B8] mt-2">Desligar um VPS não pára a subscrição: a cobrança só pára desactivando a renovação no fornecedor.</p></div>
      </div>
    </div>
  )
}

// ── Servidores VPS (inventário) ──
export function ServersSection() {
  const [d, setD] = useState<any>(null), [q, setQ] = useState(''), [filter, setFilter] = useState(''), [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [linking, setLinking] = useState<any>(null)
  const load = useCallback(() => { cvApi('instances', { q, filtro: filter, page }).then(setD).catch(e => setMsg({ ok: false, t: e.message })) }, [q, filter, page])
  useEffect(load, [load])
  const sync = async () => {
    setBusy(true); setMsg(null)
    try { const r = await cvPost({ action: 'sync_inventory' }); setMsg({ ok: r.ok, t: `${r.message} ${r.imported} nova(s), ${r.updated} actualizada(s).` }); load() } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(false) }
  }
  const act = async (body: any) => { setMsg(null); try { await cvPost(body); setMsg({ ok: true, t: 'Feito.' }); load() } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } }
  return (
    <div className="space-y-3" data-testid="cv-servers">
      <div className="flex flex-wrap gap-2 items-center">
        <input className={`${input} w-full sm:w-64`} placeholder="ID, hostname, IP ou e-mail" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} data-testid="cv-servers-search" />
        <select className={input} value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }} data-testid="cv-servers-filter">
          <option value="">Todos</option><option value="commercial">Comerciais</option><option value="internal">Internos</option><option value="unlinked">Sem associação</option><option value="linked">Associados</option><option value="missing">Ausentes da conta</option>
        </select>
        <button className={`${btn} bg-[#0A0A0A] text-white inline-flex items-center gap-1`} disabled={busy} onClick={sync} data-testid="cv-sync-inventory"><RefreshCw size={13} />{busy ? 'A sincronizar…' : 'Sincronizar com a Hostinger'}</button>
      </div>
      <Msg m={msg} />
      {!d ? <Spinner /> : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-xs min-w-[860px]">
            <thead><tr className="text-left text-[#64748B] uppercase"><th className="p-3">VM</th><th>Plano / recursos</th><th>Rede</th><th>Estado</th><th>Subscrição</th><th>Associação</th><th></th></tr></thead>
            <tbody>
              {d.items.length === 0 && <tr><td className="p-3" colSpan={7}>Sem VMs. Use «Sincronizar».</td></tr>}
              {d.items.map((i: any) => (
                <tr key={i.id} className="border-t border-[#F1F5F9] align-top" data-testid="cv-instance" data-vm={i.provider_vm_id}>
                  <td className="p-3"><p className="font-mono font-bold">{i.provider_vm_id}</p><p className="text-[#64748B]">{i.hostname ?? '—'}</p>
                    {Number(i.is_protected) ? <span className="inline-flex items-center gap-1 mt-1 text-red-700 font-bold" data-testid="cv-protected"><ShieldAlert size={12} />Protegida</span> : null}</td>
                  <td>{i.plan ?? '—'}<br /><span className="text-[#64748B]">{i.cpus ?? '?'} vCPU · {i.memory_mb ? `${Math.round(i.memory_mb / 1024)} GB` : '?'} · {i.disk_mb ? `${Math.round(i.disk_mb / 1024)} GB` : '?'}</span><br /><span className="text-[#94A3B8]">{i.template_name ?? ''}</span></td>
                  <td>{i.ipv4 ?? '—'}<br /><span className="text-[#94A3B8]">{i.ipv6 ?? ''}</span></td>
                  <td><Badge tone={i.state === 'running' ? 'green' : i.state === 'stopped' ? 'gray' : 'amber'}>{i.state ?? '—'}</Badge>{i.missing_since && <p className="text-red-700 mt-1">Ausente desde {d10(i.missing_since)}</p>}<p className="text-[#94A3B8] mt-1">sync {dt(i.last_sync_at)}</p></td>
                  <td>{i.sub_status ?? '—'}{i.sub_renewal_minor != null && <><br />renova {money(i.sub_renewal_minor, i.sub_currency)}</>}{i.sub_next_billing_at && <><br />próx. {d10(i.sub_next_billing_at)}</>}{i.sub_auto_renew != null && <><br />auto-renovação {Number(i.sub_auto_renew) ? 'sim' : 'não'}</>}</td>
                  <td>{Number(i.is_internal) ? <Badge tone="red">Interna</Badge> : i.link_status === 'linked' ? <><Badge tone="green">Associada</Badge><br />{i.client_email}</> : <Badge tone="amber">Sem associação</Badge>}
                    {i.protection_reason && <p className="text-[#94A3B8] mt-1 max-w-[180px]">{i.protection_reason}</p>}</td>
                  <td className="p-3 space-y-1">
                    {!Number(i.is_internal) && i.link_status === 'unlinked' && <button className={`${btn} bg-[#F5B700] text-black block`} onClick={() => setLinking(i)} data-testid="cv-link-open">Associar cliente</button>}
                    {!Number(i.is_internal) && i.link_status === 'unlinked' && <button className={`${btn} border block`} onClick={() => { const r = window.prompt('Motivo (VM interna da ViralizaHost):'); if (r) act({ action: 'set_internal', id: i.id, internal: true, reason: r }) }} data-testid="cv-mark-internal">Marcar interna</button>}
                    {i.link_status === 'linked' && <button className={`${btn} border block`} onClick={() => { const r = window.prompt('Motivo da desassociação:'); if (r) act({ action: 'unlink_instance', id: i.id, reason: r }) }}>Desassociar</button>}
                    {Number(i.is_internal) && !Number(i.is_protected) ? <button className={`${btn} border block`} onClick={() => { const r = window.prompt('Motivo:'); if (r) act({ action: 'set_internal', id: i.id, internal: false, reason: r }) }}>Deixar de ser interna</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3"><Pager page={d.page} pages={d.pages} onPage={setPage} /></div>
        </div>
      )}
      {linking && <LinkDialog inst={linking} plans={d?.plans ?? []} onClose={() => setLinking(null)} onDone={() => { setLinking(null); setMsg({ ok: true, t: 'VM associada ao cliente.' }); load() }} />}
    </div>
  )
}

function LinkDialog({ inst, plans, onClose, onDone }: { inst: any; plans: any[]; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState(''), [clients, setClients] = useState<any[]>([]), [sel, setSel] = useState<any>(null), [plan, setPlan] = useState(''), [ok, setOk] = useState(false), [err, setErr] = useState('')
  useEffect(() => { if (q.trim().length < 2) return; const t = setTimeout(() => cvApi('instances', { clients: q.trim() }).then(j => setClients(j.clients)).catch(() => setClients([])), 300); return () => clearTimeout(t) }, [q])
  const save = async () => { setErr(''); try { await cvPost({ action: 'link_instance', id: inst.id, profileId: sel.id, productId: plan || null, confirmed: ok }); onDone() } catch (e) { setErr((e as Error).message) } }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" data-testid="cv-link-dialog">
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3">
        <p className="font-black">Associar VM {inst.provider_vm_id} a um cliente</p>
        <p className="text-xs text-[#64748B]">Cria um serviço VPS «importado», sem cobrança. O cliente define a senha root ou a chave SSH na Área do Cliente (a senha da Hostinger não é devolvida pela API).</p>
        <input className={`${input} w-full`} placeholder="Pesquisar cliente (nome ou e-mail)" value={q} onChange={e => setQ(e.target.value)} data-testid="cv-link-search" />
        <ul className="max-h-40 overflow-auto text-xs">{clients.map(c => <li key={c.id}><button className={`w-full text-left px-2 py-1.5 rounded ${sel?.id === c.id ? 'bg-amber-50' : ''}`} onClick={() => setSel(c)} data-testid="cv-link-client">{c.full_name} · {c.email}</button></li>)}</ul>
        <select className={`${input} w-full`} value={plan} onChange={e => setPlan(e.target.value)}><option value="">Plano (opcional)</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} data-testid="cv-link-confirm" />Confirmo que verifiquei que este cliente é o titular deste VPS.</label>
        {err && <ErrorBox msg={err} />}
        <div className="flex justify-end gap-2"><button className={`${btn} border`} onClick={onClose}>Cancelar</button><button className={`${btn} bg-[#F5B700]`} disabled={!sel || !ok} onClick={save} data-testid="cv-link-save">Associar</button></div>
      </div>
    </div>
  )
}

// ── Solicitações ──
export function RequestsSection({ initialRef }: { initialRef?: string | null }) {
  const [status, setStatus] = useState(initialRef ? '' : 'open'), [q, setQ] = useState(initialRef ?? ''), [page, setPage] = useState(1)
  const [d, setD] = useState<any>(null), [open, setOpen] = useState<string | null>(initialRef ?? null)
  const load = useCallback(() => { cvApi('requests', { estado: status, q, page }).then(setD).catch(() => setD({ items: [], page: 1, pages: 1 })) }, [status, q, page])
  useEffect(load, [load])
  return (
    <div className="space-y-3" data-testid="cv-requests">
      <div className="flex flex-wrap gap-2">
        <select className={input} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} data-testid="cv-req-filter"><option value="open">Em aberto</option><option value="">Todos</option>{Object.entries(REQ).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <input className={`${input} w-full sm:w-64`} placeholder="Referência, e-mail, nome" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} data-testid="cv-req-search" />
      </div>
      {!d ? <Spinner /> : d.items.length === 0 ? <p className={`${card} p-6 text-sm text-[#64748B]`}>Sem pedidos neste filtro.</p> : (
        <ul className="space-y-2">{d.items.map((r: any) => (
          <li key={r.id} className={card} data-testid="cv-req-row" data-ref={r.reference}>
            <button className="w-full text-left p-4 flex flex-wrap gap-x-4 gap-y-1 items-center" onClick={() => setOpen(open === r.reference ? null : r.reference)}>
              <span className="font-mono text-xs font-bold">{r.reference}</span><Badge tone={REQ[r.status]?.[1]} testId="cv-req-status">{REQ[r.status]?.[0] ?? r.status}</Badge>
              {Number(r.is_test) ? <Badge tone="amber">TESTE</Badge> : null}
              <span className="text-sm font-semibold">{r.full_name}</span>
              <span className="text-xs text-[#64748B]">{r.plan_name} · {CYCLE[r.cycle] ?? r.cycle} · {r.options?.image?.label ?? '—'} · {r.options?.location?.label ?? '—'} · {kz(r.quoted_total)} · {dt(r.created_at)}</span>
            </button>
            {open === r.reference && <RequestDetail id={r.id} onChange={load} />}
          </li>
        ))}</ul>
      )}
      {d && <Pager page={d.page} pages={d.pages} onPage={setPage} />}
    </div>
  )
}

function RequestDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [d, setD] = useState<any>(null), [note, setNote] = useState(''), [busy, setBusy] = useState(''), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [confirm, setConfirm] = useState('')
  const load = useCallback(() => cvApi('requests', { id }).then(setD).catch(e => setMsg({ ok: false, t: e.message })), [id])
  useEffect(() => { load() }, [load])
  const act = async (op: string, extra: any = {}, ask?: string) => {
    if (ask && !window.confirm(ask)) return
    setBusy(op); setMsg(null)
    try { const j = await cvPost({ action: 'request', id, op, note, ...extra }); setD(j); setNote(''); setMsg({ ok: !(j.outcome && ['failed'].includes(j.outcome.status)), t: j.outcome?.message ?? 'Feito.' }); onChange() }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy('') }
  }
  if (!d) return <div className="px-4 pb-4"><Spinner /><Msg m={msg} /></div>
  const r = d.request, st = r.status
  const B = (op: string, label: string, cls = 'bg-[#0A0A0A] text-white', extra: any = {}, ask?: string) => <button className={`${btn} ${cls}`} disabled={!!busy} onClick={() => act(op, extra, ask)} data-testid={`cv-req-${op}`}>{busy === op ? '…' : label}</button>
  return (
    <div className="border-t border-[#EEE] p-4 space-y-3 text-sm" data-testid="cv-req-detail">
      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div><p className="font-bold text-[#64748B] uppercase text-[10px]">Cliente</p>{r.full_name}<br />{r.email}{r.phone ? ` · ${r.phone}` : ''}{r.company ? <><br />{r.company}</> : null}{r.notes && <p className="mt-1 bg-[#F8FAFC] rounded p-2 whitespace-pre-wrap">{r.notes}</p>}</div>
        <div><p className="font-bold text-[#64748B] uppercase text-[10px]">Configuração</p>{r.plan_name} · {CYCLE[r.cycle]}<br />{r.options?.image?.label} · {r.options?.location?.label}<br />Hostname: {r.options?.hostname ?? '—'}<br />SSH: {r.options?.sshKey ? `${String(r.options.sshKey).split(' ')[0]} (chave pública)` : '—'}{r.options?.addons?.length ? <><br />Extras: {r.options.addons.map((a: any) => a.label).join(', ')}</> : null}<br />Venda: <strong>{kz(r.quoted_total)}</strong>{r.provider_cost_minor != null && <> · custo {money(r.provider_cost_minor, r.provider_currency)}</>}</div>
        <div><p className="font-bold text-[#64748B] uppercase text-[10px]">Pagamento</p>{r.order_number ? <>Encomenda {r.order_number} · factura {r.invoice_number}<br />Estado: <strong data-testid="cv-req-payment">{r.payment_status === 'paid' ? 'pago' : r.payment_status}</strong><br /><Link className="underline" href={`/admin/orders?encomenda=${r.order_number}`}>Abrir no Financeiro</Link></> : 'Sem factura (só depois da aprovação).'}</div>
      </div>
      {d.check && (
        <div className="rounded-xl bg-[#F8FAFC] p-3 text-xs" data-testid="cv-req-checks"><p className="font-bold mb-1">Verificação do fornecedor (preço, moeda, limite, produto, instalação, localização)</p>
          <ul>{d.check.checks.map((c: any) => <li key={c.label}>{c.ok === true ? '✓' : c.ok === false ? '✗' : '?'} {c.label}: {c.detail}</li>)}</ul></div>
      )}
      <textarea className={`${input} w-full min-h-[56px]`} placeholder="Nota interna (ou motivo de rejeição/cancelamento, enviado ao cliente)" value={note} onChange={e => setNote(e.target.value)} data-testid="cv-req-note" />
      <div className="flex flex-wrap gap-2 items-center">
        {st === 'submitted' && B('start_review', 'Iniciar análise')}
        {st === 'under_review' && B('approve', 'Aprovar', 'bg-green-700 text-white')}
        {st === 'under_review' && B('approve', 'Aprovar com avisos (aquisição manual)', 'border border-green-700 text-green-800', { acceptWarnings: true }, 'Aprovar mesmo com verificações por resolver? A aquisição será tratada manualmente.')}
        {st === 'approved' && B('send_to_payment', 'Disponibilizar pagamento (factura)', 'bg-[#F5B700] text-black', {}, 'Criar a encomenda e a factura para o cliente?')}
        {st === 'awaiting_payment' && B('refresh_payment', 'Verificar pagamento')}
        {st === 'awaiting_payment' && Number(r.is_test) === 1 && B('simulate_payment', 'Simular pagamento (teste)', 'bg-amber-500 text-black')}
        {['paid', 'failed'].includes(st) && <><input className={`${input} w-48`} placeholder="AUTORIZO AQUISICAO" value={confirm} onChange={e => setConfirm(e.target.value)} data-testid="cv-req-confirm" />{B('authorize_purchase', 'Autorizar aquisição', 'bg-green-700 text-white', { confirmText: confirm })}</>}
        {B('note', 'Guardar nota', 'border')}
        {['submitted', 'under_review', 'approved'].includes(st) && B('reject', 'Rejeitar', 'bg-red-600 text-white')}
        {['submitted', 'under_review', 'approved', 'awaiting_payment'].includes(st) && B('cancel', 'Cancelar', 'border border-red-300 text-red-700', {}, 'Cancelar o pedido (e a factura por pagar)?')}
      </div>
      <Msg m={msg} />
      {d.provisioning && (
        <div className="rounded-xl border border-[#EEE] p-3 text-xs" data-testid="cv-req-prov">
          <p className="font-bold">Compra/aprovisionamento: <span data-testid="cv-req-op">{d.provisioning.status}</span>{d.provisioning.provider_vm_id ? ` · VM ${d.provisioning.provider_vm_id}` : ''}{d.provisioning.ipv4 ? ` · ${d.provisioning.ipv4}` : ''} · acesso {d.provisioning.access_configured_at ? `configurado (${d.provisioning.access_method})` : 'por definir pelo cliente'}</p>
          {d.provisioning.service?.provisioning_error && <p className="text-amber-800">{d.provisioning.service.provisioning_error}</p>}
          <ol className="font-mono text-[11px] mt-1 max-h-40 overflow-auto">{d.provisioning.events.map((e: any, i: number) => <li key={i}>{dt(e.created_at)} {e.event} {e.detail}</li>)}</ol>
        </div>
      )}
      <details className="text-xs"><summary className="cursor-pointer font-semibold">Histórico ({d.events.length})</summary><ul>{d.events.map((e: any) => <li key={e.id}>{dt(e.created_at)} · {e.action}{e.to_status && e.to_status !== e.from_status ? ` → ${REQ[e.to_status]?.[0] ?? e.to_status}` : ''}{e.actor_name ? ` · ${e.actor_name}` : ''}{e.note ? ` — ${e.note}` : ''}</li>)}</ul></details>
    </div>
  )
}

// ── Aprovisionamento ──
export function ProvisioningSection() {
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(false)
  const load = useCallback(() => { cvApi('provisioning').then(setD).catch(e => setMsg({ ok: false, t: e.message })) }, [])
  useEffect(load, [load])
  const reconcile = async () => { setBusy(true); try { const r = await cvPost({ action: 'reconcile_all' }); setMsg({ ok: true, t: `${r.results.length} operação(ões) conciliada(s) (sem novas compras).` }); load() } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(false) } }
  const TONE: Record<string, any> = { active: 'green', failed: 'red', unknown: 'red', submitted: 'cyan', submitting: 'cyan', payment_processing: 'amber', pending: 'gray' }
  return (
    <div className="space-y-3" data-testid="cv-provisioning">
      <div className="flex flex-wrap gap-2 items-center">
        <button className={`${btn} bg-[#0A0A0A] text-white`} disabled={busy} onClick={reconcile} data-testid="cv-reconcile">{busy ? '…' : 'Conciliar compras em aberto'}</button>
        <span className="text-xs text-[#64748B]">Respostas inconclusivas nunca são repetidas automaticamente: a conciliação procura a VM pelo hostname único e pela subscrição. Associação manual, entrega e «confirmar que nada foi comprado»: <Link className="underline" href="/admin/orders?filtro=activacao">Pedidos → activação</Link>.</span>
      </div>
      <Msg m={msg} />
      {!d ? <Spinner /> : <>
        {d.pending.length > 0 && <div className={`${card} p-4 text-xs`}><p className="font-bold text-sm mb-2">Pagos sem compra iniciada ({d.pending.length})</p><ul className="space-y-1">{d.pending.map((p: any) => <li key={p.service_id}>{p.order_number} · {p.service_name} · {p.email} — {p.provisioning_error ?? p.provisioning_status}</li>)}</ul></div>}
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full text-xs min-w-[820px]">
            <thead><tr className="text-left text-[#64748B] uppercase"><th className="p-3">Encomenda / pedido</th><th>Estado</th><th>Item / custo</th><th>VM</th><th>Acesso</th><th>Mensagem</th><th>Actualizado</th></tr></thead>
            <tbody>{d.ops.length === 0 ? <tr><td className="p-3" colSpan={7}>Sem operações.</td></tr> : d.ops.map((o: any) => (
              <tr key={o.id} className="border-t border-[#F1F5F9] align-top" data-testid="cv-op-row">
                <td className="p-3">{o.order_number ?? '—'}{o.request_ref && <><br /><span className="font-mono">{o.request_ref}</span></>}<br /><span className="text-[#94A3B8]">{o.email}</span></td>
                <td><Badge tone={TONE[o.status] ?? 'gray'}>{o.status}</Badge><br /><span className="text-[#94A3B8]">{o.mode} · {o.attempts} tent.</span></td>
                <td>{o.item_id}<br />{money(o.expected_cost_minor, o.currency)} (limite {money(o.cost_limit_minor, o.currency)})</td>
                <td>{o.provider_vm_id ?? '—'}<br />{o.ipv4 ?? ''} {o.provider_status ? `(${o.provider_status})` : ''}</td>
                <td>{o.access_configured_at ? o.access_method : <span className="text-amber-700">por definir</span>}</td>
                <td className="max-w-xs">{o.message ?? o.provisioning_error ?? ''}</td>
                <td>{dt(o.updated_at)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </>}
    </div>
  )
}
