'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CreditCard, ExternalLink, KeyRound, LifeBuoy, Loader2, RefreshCw, Server, TrendingUp, Users } from 'lucide-react'
import { useCart } from '@/store/cartStore'

// Área de cliente → Revenda. Dados e acções só do utilizador autenticado: cada acção volta ao servidor, que
// verifica a propriedade do serviço. Acesso ao WHM/cPanel por sessão temporária (nunca senhas no navegador).

/* eslint-disable @typescript-eslint/no-explicit-any */
const REQ: Record<string, [string, string]> = {
  submitted: ['Recebido', 'bg-blue-100 text-blue-800'], under_review: ['Em análise', 'bg-indigo-100 text-indigo-800'], technically_approved: ['Aprovado — factura a caminho', 'bg-teal-100 text-teal-800'],
  awaiting_payment: ['A aguardar pagamento', 'bg-amber-100 text-amber-800'], paid: ['Pago — activação em preparação', 'bg-lime-100 text-lime-800'], provisioning_authorized: ['Em activação', 'bg-cyan-100 text-cyan-800'],
  provisioning: ['Em activação', 'bg-cyan-100 text-cyan-800'], awaiting_confirmation: ['Em activação (verificação final)', 'bg-cyan-100 text-cyan-800'], active: ['Activo', 'bg-green-100 text-green-800'],
  rejected: ['Não aprovado', 'bg-red-100 text-red-800'], cancelled: ['Cancelado', 'bg-gray-200 text-gray-700'], failed: ['Activação em revisão pela equipa', 'bg-orange-100 text-orange-800'],
}
const CYCLE: Record<string, string> = { monthly: 'Mensal', '3months': 'Trimestral', '6months': 'Semestral', '1year': 'Anual' }
const card = 'bg-white border border-[#E5E7EB] rounded-2xl'
const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white hover:border-[#F5B700] disabled:opacity-50'
const gb = (mb: number | null | undefined) => (mb == null ? '—' : `${(Number(mb) / 1024).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} GB`)
const d10 = (v: unknown) => (v ? String(v).slice(0, 10) : '—')

async function act(body: Record<string, unknown>) {
  const r = await fetch('/api/client/reseller', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Não foi possível concluir a operação.')
  return j
}

export function ResellerClientArea() {
  const [d, setD] = useState<any>(null)
  const load = useCallback(() => { fetch('/api/client/reseller', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j) }).catch(e => setD({ error: e.message })) }, [])
  useEffect(load, [load])
  if (!d) return <Loader2 className="animate-spin text-[#F5B700]" />
  if (d.error) return <p className="text-red-600 text-sm">{d.error}</p>
  const pending = d.requests.filter((r: any) => r.status !== 'active')
  return (
    <div className="space-y-6">
      {d.resellers.length === 0 && d.requests.length === 0 && (
        <div className={`${card} p-8 text-center`} data-testid="rv-client-empty">
          <p className="font-bold">Ainda não tem uma revenda.</p>
          <p className="text-sm text-[#64748B] mt-1">Venda alojamento com a sua marca usando a infraestrutura da ViralizaHost.</p>
          <Link href="/revenda-de-hospedagem#planos" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B700] text-black">Ver planos de revenda</Link>
        </div>
      )}
      {d.resellers.map((r: any) => <ResellerCard key={r.service_id} r={r} />)}
      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#64748B]">Pedidos</h2>
          {pending.map((r: any) => (
            <div key={r.id} className={`${card} p-4 flex flex-wrap items-center gap-x-4 gap-y-1`} data-testid="rv-client-request" data-ref={r.reference}>
              <span className="font-mono text-xs font-bold">{r.reference}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${REQ[r.status]?.[1] ?? 'bg-gray-100'}`} data-testid="rv-client-req-status" data-status={r.status}>{REQ[r.status]?.[0] ?? r.status}</span>
              <span className="text-sm">{r.plan_name}{r.kind === 'upgrade' ? ' (upgrade)' : ''} · {CYCLE[r.cycle] ?? r.cycle} · {r.domain}</span>
              <span className="text-xs text-[#64748B]">Pedido em {d10(r.created_at)}</span>
              {r.invoice_id && r.payment_status !== 'paid' && <Link href={`/billing/invoices/${r.invoice_id}`} className="text-xs font-bold underline" data-testid="rv-client-invoice">Pagar factura {r.invoice_number}</Link>}
              {r.payment_status === 'paid' && <span className="text-xs text-green-700 font-semibold">Pagamento confirmado</span>}
              {r.decision_reason && ['rejected', 'cancelled'].includes(r.status) && <p className="w-full text-xs text-[#555]">Motivo: {r.decision_reason}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function ResellerCard({ r }: { r: any }) {
  const router = useRouter()
  const addRenewal = useCart(s => s.addRenewal)
  const active = r.status === 'active'
  const [usage, setUsage] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pw, setPw] = useState<{ open: boolean; a: string; b: string }>({ open: false, a: '', b: '' })
  const [upgrade, setUpgrade] = useState(false)
  const u = usage ?? (r.last_usage ? { diskUsedMb: r.last_usage.disk, accountsUsed: r.last_usage.accounts, bwUsedMb: r.last_usage.bw, at: r.last_usage.at } : null)
  const run = async (key: string, body: Record<string, unknown>, after?: (j: any) => void) => {
    setBusy(key); setMsg(null)
    try { const j = await act({ serviceId: r.service_id, ...body }); after?.(j) } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(null) }
  }
  const open = (target: 'whm' | 'cpanel') => run(target, { action: target }, j => { window.open(j.url, '_blank', 'noopener,noreferrer') })
  const refresh = () => run('usage', { action: 'usage' }, j => setUsage({ ...j.usage, at: new Date().toISOString() }))
  const savePw = () => {
    if (pw.a !== pw.b) { setMsg({ ok: false, t: 'As senhas não coincidem.' }); return }
    run('password', { action: 'password', password: pw.a }, () => { setPw({ open: false, a: '', b: '' }); setMsg({ ok: true, t: 'Senha alterada.' }) })
  }
  const renew = () => { addRenewal(r.service_id, `Renovação — ${r.plan_name} (${r.domain})`); router.push('/carrinho') }
  const pct = (a: number | null | undefined, b: number) => (a == null || !b ? 0 : Math.min(100, Math.round((Number(a) / b) * 100)))
  const Bar = ({ label, used, total, fmt }: { label: string; used: number | null | undefined; total: number; fmt: (v: number) => string }) => (
    <div><div className="flex justify-between text-xs mb-1"><span className="text-[#64748B]">{label}</span><span className="font-semibold">{used == null ? '—' : fmt(Number(used))} / {fmt(total)}</span></div>
      <div className="h-2 rounded-full bg-[#F1F5F9]"><div className="h-2 rounded-full bg-[#F5B700]" style={{ width: `${pct(used, total)}%` }} /></div></div>
  )
  return (
    <section className={`${card} p-5 space-y-4`} data-testid="rv-client-reseller" data-status={r.status}>
      <div className="flex flex-wrap items-center gap-3">
        <Server className="text-[#F5B700]" size={20} />
        <h2 className="font-black text-lg">{r.plan_name}</h2>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-green-100 text-green-800' : r.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-cyan-100 text-cyan-800'}`} data-testid="rv-client-status">{active ? 'Activo' : r.status === 'suspended' ? 'Suspenso' : 'Em activação'}</span>
        <span className="text-sm text-[#475569]">{r.domain}</span>
      </div>
      {r.status === 'suspended' && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-2">Revenda suspensa{r.suspended_reason ? `: ${r.suspended_reason}` : ''}. Contacte o suporte.</p>}
      {r.status === 'awaiting_confirmation' && <p className="text-sm text-cyan-800 bg-cyan-50 rounded-xl px-4 py-2">A equipa está a fazer a verificação final. Recebe um aviso quando o acesso estiver disponível.</p>}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div><dt className="text-[#64748B]">Utilizador WHM</dt><dd className="font-mono font-semibold" data-testid="rv-client-user">{active || r.status === 'suspended' ? r.whm_username : '—'}</dd></div>
        <div><dt className="text-[#64748B]">Ciclo</dt><dd className="font-semibold">{CYCLE[r.billing_cycle] ?? r.billing_cycle}</dd></div>
        <div><dt className="text-[#64748B]">Contratado em</dt><dd className="font-semibold">{d10(r.contracted_at)}</dd></div>
        <div><dt className="text-[#64748B]">Renovação</dt><dd className="font-semibold" data-testid="rv-client-due">{d10(r.next_due_date)}</dd></div>
        <div className="col-span-2"><dt className="text-[#64748B]">Nameservers</dt><dd className="font-mono">{r.nameservers.join(' · ')}</dd></div>
        <div className="col-span-2"><dt className="text-[#64748B]">Servidor</dt><dd className="font-mono">{r.server_host}{r.server_ip ? ` (${r.server_ip})` : ''}</dd></div>
      </dl>
      <div className="grid sm:grid-cols-3 gap-4" data-testid="rv-client-usage">
        {Bar({ label: "Armazenamento", used: u?.diskUsedMb, total: Number(r.storage_mb), fmt: v => gb(v) })}
        {Bar({ label: "Contas cPanel", used: u?.accountsUsed, total: Number(r.max_accounts), fmt: v => String(v) })}
        {Bar({ label: "Tráfego (mês)", used: u?.bwUsedMb, total: Number(r.bandwidth_mb), fmt: v => gb(v) })}
      </div>
      {u?.at && <p className="text-[11px] text-[#94A3B8]">Consumo de {new Date(u.at).toLocaleString('pt-PT')}{u.accountsUsed != null ? ` · ${Math.max(0, Number(r.max_accounts) - Number(u.accountsUsed))} conta(s) disponível(is)` : ''}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <button className={btn} disabled={!active || !!busy} onClick={() => open('whm')} data-testid="rv-client-whm"><ExternalLink size={14} />{busy === 'whm' ? '…' : 'Aceder ao WHM'}</button>
        <button className={btn} disabled={!active || !!busy} onClick={() => open('cpanel')} data-testid="rv-client-cpanel"><ExternalLink size={14} />{busy === 'cpanel' ? '…' : 'Aceder ao cPanel'}</button>
        <button className={btn} disabled={!active || !!busy} onClick={() => open('whm')} data-testid="rv-client-manage"><Users size={14} />Gerir contas de clientes</button>
        <button className={btn} disabled={!active || !!busy} onClick={refresh} data-testid="rv-client-refresh"><BarChart3 size={14} />{busy === 'usage' ? '…' : 'Consultar consumo'}</button>
        <button className={btn} disabled={!active || !!busy} onClick={() => setPw({ ...pw, open: !pw.open })} data-testid="rv-client-password"><KeyRound size={14} />Alterar senha</button>
        <button className={btn} disabled={!['active', 'suspended'].includes(r.status)} onClick={renew} data-testid="rv-client-renew"><RefreshCw size={14} />Renovar</button>
        <button className={btn} disabled={!active} onClick={() => setUpgrade(!upgrade)} data-testid="rv-client-upgrade"><TrendingUp size={14} />Solicitar upgrade</button>
        <Link className={btn} href="/billing" data-testid="rv-client-invoices"><CreditCard size={14} />Consultar faturas</Link>
        <Link className={btn} href={`/tickets?assunto=${encodeURIComponent(`Revenda — ${r.domain}`)}`} data-testid="rv-client-ticket"><LifeBuoy size={14} />Abrir ticket</Link>
      </div>
      {pw.open && (
        <div className="rounded-xl bg-[#F8FAFC] p-3 space-y-2" data-testid="rv-client-pw-form">
          <p className="text-xs text-[#64748B]">Nova senha da conta principal (WHM/cPanel): 12+ caracteres com maiúsculas, minúsculas, números e símbolo.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <input type="password" autoComplete="new-password" className="border rounded-lg px-3 py-2 text-sm" placeholder="Nova senha" value={pw.a} onChange={e => setPw({ ...pw, a: e.target.value })} data-testid="rv-client-pw1" />
            <input type="password" autoComplete="new-password" className="border rounded-lg px-3 py-2 text-sm" placeholder="Repetir" value={pw.b} onChange={e => setPw({ ...pw, b: e.target.value })} data-testid="rv-client-pw2" />
          </div>
          <button className={`${btn} bg-[#0A0A0A] text-white`} disabled={!!busy || !pw.a} onClick={savePw} data-testid="rv-client-pw-save">Guardar senha</button>
        </div>
      )}
      {upgrade && <UpgradeForm r={r} onDone={t => { setUpgrade(false); setMsg({ ok: true, t }) }} />}
      {usage?.clients && (
        <div data-testid="rv-client-clients">
          <p className="text-xs font-bold uppercase text-[#64748B] mb-1">Os seus clientes ({usage.clients.length})</p>
          {usage.clients.length === 0 ? <p className="text-xs text-[#64748B]">Ainda não criou contas para clientes. Use «Gerir contas de clientes».</p> : (
            <div className="overflow-x-auto"><table className="w-full text-xs min-w-[420px]"><thead><tr className="text-left text-[#64748B]"><th className="py-1">Utilizador</th><th>Domínio</th><th>Pacote</th><th>Espaço</th><th>Estado</th></tr></thead>
              <tbody>{usage.clients.map((c: any) => <tr key={c.user} className="border-t border-[#F1F5F9]" data-testid="rv-client-child"><td className="py-1 font-mono">{c.user}</td><td>{c.domain}</td><td>{c.plan}</td><td>{gb(c.diskUsedMb)} / {gb(c.diskLimitMb)}</td><td>{c.suspended ? 'Suspensa' : 'Activa'}</td></tr>)}</tbody></table></div>
          )}
        </div>
      )}
      {msg && <p className={`text-xs font-semibold ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role="status" data-testid="rv-client-msg">{msg.t}</p>}
    </section>
  )
}

function UpgradeForm({ r, onDone }: { r: any; onDone: (t: string) => void }) {
  const [plans, setPlans] = useState<{ slug: string; name: string }[]>([])
  const [plan, setPlan] = useState('')
  const [cycle, setCycle] = useState(r.billing_cycle in CYCLE ? r.billing_cycle : 'monthly')
  const [startedAt] = useState(() => Date.now())
  const [err, setErr] = useState('')
  useEffect(() => { fetch('/api/catalog/reseller-plans', { cache: 'no-store' }).then(x => x.json()).then(j => { const l = (j.plans ?? []).filter((p: any) => p.slug !== r.plan_slug); setPlans(l); setPlan(l[0]?.slug ?? '') }).catch(() => setPlans([])) }, [r.plan_slug])
  const send = async () => {
    setErr('')
    const res = await fetch('/api/reseller/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan, cycle, domain: r.domain, upgradeServiceId: r.service_id, fullName: '', phone: '', startedAt: startedAt - 5000 }) })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error ?? 'Falhou.'); return }
    onDone(`Pedido de upgrade ${j.reference} enviado. A equipa confirma a capacidade e envia a factura.`)
  }
  return (
    <div className="rounded-xl bg-[#F8FAFC] p-3 space-y-2" data-testid="rv-client-upgrade-form">
      <div className="grid sm:grid-cols-2 gap-2">
        <select className="border rounded-lg px-3 py-2 text-sm" value={plan} onChange={e => setPlan(e.target.value)} data-testid="rv-up-plan">{plans.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={cycle} onChange={e => setCycle(e.target.value)}>{Object.entries(CYCLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <button className={`${btn} bg-[#0A0A0A] text-white`} disabled={!plan} onClick={send} data-testid="rv-up-send">Enviar pedido de upgrade</button>
      {err && <p className="text-xs text-red-700" data-testid="rv-up-error">{err}</p>}
    </div>
  )
}
