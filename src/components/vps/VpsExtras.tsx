'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Activity, Archive, Cpu, Flame, History, Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { useCart } from '@/store/cartStore'
import type { MyVps } from '@/lib/vps/manage'

// «Os meus VPS» → ficha técnica, utilização (métricas reais da Hostinger), backups e snapshots, firewall do VPS,
// renovação, upgrade e suporte. Tudo passa por /api/client/vps/:id (posse verificada no servidor). Operações
// destrutivas exigem confirmação escrita. Nada é simulado: um erro do fornecedor é mostrado como tal.

/* eslint-disable @typescript-eslint/no-explicit-any */
const card = 'rounded-2xl border border-[#E5E7EB] bg-white shadow-sm p-4 sm:p-5'
const btn = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-50 disabled:cursor-not-allowed'
const field = 'border border-[#E2E2E2] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#F5B700]'
const gb = (mb: number | null | undefined) => (mb == null ? '—' : `${Math.round((mb / 1024) * 10) / 10} GB`)
const bytes = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(0)} MB` : `${Math.round(b / 1024)} KB`)
const EVENT: Record<string, string> = {
  vm_running: 'VPS activo', manual_link: 'Associado pela equipa', import_link: 'Associado pela equipa', manual_delivery: 'Entregue pela equipa', hostname_set: 'Hostname aplicado',
  client_start: 'Ligado', client_stop: 'Desligado', client_restart: 'Reiniciado', client_root_password: 'Senha root definida', client_ssh_key: 'Chave SSH adicionada', client_reinstall: 'Reinstalado',
  client_backup_restore: 'Backup restaurado', client_snapshot_create: 'Snapshot criado', client_snapshot_restore: 'Snapshot restaurado', client_snapshot_delete: 'Snapshot apagado', client_firewall: 'Firewall alterada', client_choose_install: 'Instalação escolhida',
}
async function get(id: string, view: string, extra = '') {
  const r = await fetch(`/api/client/vps/${id}?view=${view}${extra}`, { cache: 'no-store' }); const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Indisponível de momento.'); return j
}
async function post(id: string, body: Record<string, unknown>) {
  const r = await fetch(`/api/client/vps/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'Operação indisponível de momento.'); return j
}
const Note = ({ m }: { m: { ok: boolean; t: string } | null }) => m ? <p role={m.ok ? 'status' : 'alert'} className={`text-xs mt-2 ${m.ok ? 'text-green-700' : 'text-red-700'}`} data-testid="vx-msg">{m.t}</p> : null

export function VpsDetailsCard({ vps }: { vps: MyVps }) {
  const [d, setD] = useState<any>(null), [err, setErr] = useState('')
  useEffect(() => { get(vps.id, 'details').then(setD).catch(e => setErr(e.message)) }, [vps.id])
  return (
    <section className={card} data-testid="vx-details">
      <h2 className="font-black mb-3 flex items-center gap-2"><Cpu size={18} className="text-[#B45309]" /> Ficha técnica</h2>
      {err ? <p className="text-sm text-red-700">{err}</p> : !d ? <Loader2 className="animate-spin text-[#F5B700]" /> : (
        <>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-[#64748B]">CPU</dt><dd className="font-semibold" data-testid="vx-cpu">{d.cpus ?? '—'} vCPU</dd></div>
            <div><dt className="text-[#64748B]">RAM</dt><dd className="font-semibold">{gb(d.memoryMb)}</dd></div>
            <div><dt className="text-[#64748B]">Disco</dt><dd className="font-semibold">{gb(d.diskMb)}</dd></div>
            <div><dt className="text-[#64748B]">Tráfego mensal</dt><dd className="font-semibold">{d.bandwidthMb != null ? `${Math.round(d.bandwidthMb / 1024 / 1000 * 100) / 100} TB` : '—'}</dd></div>
            <div><dt className="text-[#64748B]">IPv4</dt><dd className="font-mono text-xs" data-testid="vx-ipv4">{d.ipv4.join(', ') || '—'}</dd></div>
            <div><dt className="text-[#64748B]">IPv6</dt><dd className="font-mono text-xs break-all">{d.ipv6.join(', ') || '—'}</dd></div>
            <div><dt className="text-[#64748B]">Hostname</dt><dd className="font-mono text-xs break-all" data-testid="vx-hostname">{d.hostname ?? '—'}</dd></div>
            <div><dt className="text-[#64748B]">Sistema</dt><dd className="font-semibold">{d.template ?? '—'}</dd></div>
            <div><dt className="text-[#64748B]">Centro de dados</dt><dd className="font-semibold">{d.location ?? '—'}</dd></div>
            <div><dt className="text-[#64748B]">Activado em</dt><dd className="font-semibold">{vps.activatedAt ?? '—'}</dd></div>
            <div><dt className="text-[#64748B]">Próxima renovação</dt><dd className="font-semibold" data-testid="vx-next-due">{vps.nextDue ?? '—'}</dd></div>
          </dl>
          <details className="mt-3 text-sm" data-testid="vx-history"><summary className="cursor-pointer font-bold inline-flex items-center gap-1"><History size={14} /> Histórico de operações ({d.history.length})</summary>
            <ul className="mt-2 text-xs text-[#475569] space-y-0.5">{d.history.map((h: any, i: number) => <li key={i}>{h.at ? new Date(h.at).toLocaleString('pt-PT') : ''} — {EVENT[h.event] ?? h.event}</li>)}</ul></details>
        </>
      )}
    </section>
  )
}

function Spark({ data, max, label, fmt }: { data: { t: number; v: number }[]; max?: number; label: string; fmt: (v: number) => string }) {
  if (!data.length) return <div className="text-xs text-[#94A3B8]">{label}: sem dados</div>
  const top = max ?? Math.max(1, ...data.map(x => x.v)), last = data[data.length - 1].v
  const pts = data.map((x, i) => `${(i / Math.max(1, data.length - 1)) * 100},${30 - (x.v / top) * 28}`).join(' ')
  return (
    <div data-testid="vx-metric">
      <div className="flex justify-between text-xs"><span className="text-[#64748B]">{label}</span><span className="font-bold">{fmt(last)}</span></div>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-10 mt-1" aria-label={`${label}: ${fmt(last)}`}><polyline points={pts} fill="none" stroke="#F5B700" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
    </div>
  )
}
export function VpsMetricsCard({ id }: { id: string }) {
  const [range, setRange] = useState<'24h' | '7d'>('24h'), [d, setD] = useState<any>(null), [err, setErr] = useState('')
  // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega ao mudar o intervalo
  useEffect(() => { setD(null); get(id, 'metrics', `&range=${range}`).then(setD).catch(e => setErr(e.message)) }, [id, range])
  return (
    <section className={card} data-testid="vx-metrics">
      <div className="flex items-center justify-between mb-3"><h2 className="font-black flex items-center gap-2"><Activity size={18} className="text-[#B45309]" /> Utilização</h2>
        <div className="flex gap-1">{(['24h', '7d'] as const).map(r => <button key={r} className={`${btn} ${range === r ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]' : 'border-[#E5E7EB]'}`} onClick={() => setRange(r)}>{r === '24h' ? '24 horas' : '7 dias'}</button>)}</div></div>
      {err ? <p className="text-sm text-red-700">{err}</p> : !d ? <Loader2 className="animate-spin text-[#F5B700]" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Spark data={d.cpu} max={100} label="CPU" fmt={v => `${v.toFixed(0)} %`} />
          <Spark data={d.ram} label="RAM" fmt={bytes} />
          <Spark data={d.disk} label="Disco" fmt={bytes} />
          <Spark data={d.out} label="Tráfego de saída" fmt={bytes} />
        </div>
      )}
    </section>
  )
}

export function VpsBackupsCard({ id }: { id: string }) {
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(''), [m, setM] = useState<{ ok: boolean; t: string } | null>(null), [confirm, setConfirm] = useState<{ op: string; backupId?: number } | null>(null), [text, setText] = useState('')
  const load = useCallback(() => get(id, 'backups').then(setD).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const run = async (op: string, extra: any = {}) => {
    setBusy(op); setM(null)
    try { await post(id, { action: 'backup_op', op, ...extra }); setM({ ok: true, t: 'Pedido aceite pela Hostinger: a operação está em curso.' }); setConfirm(null); setText(''); setTimeout(load, 1500) }
    catch (e) { setM({ ok: false, t: (e as Error).message }) } finally { setBusy('') }
  }
  const word = confirm?.op === 'snapshot-delete' ? 'APAGAR' : 'RESTAURAR'
  return (
    <section className={card} data-testid="vx-backups">
      <h2 className="font-black mb-1 flex items-center gap-2"><Archive size={18} className="text-[#B45309]" /> Backups e snapshots</h2>
      <p className="text-xs text-[#64748B] mb-3">Backups semanais da Hostinger e um snapshot manual. Restaurar substitui o conteúdo actual do VPS.</p>
      {err ? <p className="text-sm text-red-700">{err}</p> : !d ? <Loader2 className="animate-spin text-[#F5B700]" /> : (
        <div className="grid lg:grid-cols-2 gap-4 text-sm">
          <div><p className="font-bold mb-1">Backups ({d.backups.length})</p>
            {d.backups.length === 0 ? <p className="text-xs text-[#64748B]">Ainda sem backups.</p> : <ul className="space-y-1">{d.backups.map((b: any) => <li key={b.id} className="flex items-center gap-2 text-xs" data-testid="vx-backup">{b.at ? new Date(b.at).toLocaleString('pt-PT') : `#${b.id}`}{b.sizeKb ? ` · ${bytes(b.sizeKb * 1024)}` : ''}<button className={`${btn} border-[#E5E7EB] ml-auto`} disabled={!!busy} onClick={() => setConfirm({ op: 'backup-restore', backupId: b.id })} data-testid="vx-backup-restore">Restaurar</button></li>)}</ul>}</div>
          <div><p className="font-bold mb-1">Snapshot</p>
            {!d.snapshotAvailable ? <p className="text-xs text-[#64748B]">Indisponível de momento.</p> : d.snapshot ? <div className="text-xs space-y-2" data-testid="vx-snapshot"><p>Criado em {d.snapshot.created_at ? new Date(d.snapshot.created_at).toLocaleString('pt-PT') : '—'}{d.snapshot.expires_at ? ` · expira ${new Date(d.snapshot.expires_at).toLocaleDateString('pt-PT')}` : ''}</p>
              <div className="flex gap-2"><button className={`${btn} border-[#E5E7EB]`} disabled={!!busy} onClick={() => setConfirm({ op: 'snapshot-restore' })} data-testid="vx-snap-restore">Restaurar</button><button className={`${btn} border-red-300 text-red-700`} disabled={!!busy} onClick={() => setConfirm({ op: 'snapshot-delete' })} data-testid="vx-snap-delete">Apagar</button></div></div>
              : <p className="text-xs text-[#64748B]">Sem snapshot.</p>}
            <button className={`${btn} border-[#0A0A0A] mt-2`} disabled={!!busy} onClick={() => run('snapshot-create')} data-testid="vx-snap-create">{busy === 'snapshot-create' ? <Loader2 size={13} className="animate-spin" /> : null}Criar snapshot</button></div>
        </div>
      )}
      {confirm && (
        <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs space-y-2" role="alert" data-testid="vx-confirm">
          <p className="font-bold text-red-800">{confirm.op === 'snapshot-delete' ? 'O snapshot será apagado definitivamente.' : 'O conteúdo actual do VPS será substituído.'} Escreva {word} para confirmar.</p>
          <div className="flex gap-2"><input className={field} value={text} onChange={e => setText(e.target.value)} data-testid="vx-confirm-text" />
            <button className={`${btn} bg-red-600 text-white border-red-600`} disabled={text.trim().toUpperCase() !== word || !!busy} onClick={() => run(confirm.op, { backupId: confirm.backupId, confirmText: text })} data-testid="vx-confirm-go">Confirmar</button>
            <button className={`${btn} border-[#E5E7EB]`} onClick={() => { setConfirm(null); setText('') }}>Cancelar</button></div>
        </div>
      )}
      <Note m={m} />
    </section>
  )
}

export function VpsFirewallCard({ id }: { id: string }) {
  const [d, setD] = useState<any>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(''), [m, setM] = useState<{ ok: boolean; t: string } | null>(null)
  const [rule, setRule] = useState({ action: 'accept', protocol: 'SSH', port: '22', sourceDetail: 'any' })
  const load = useCallback(() => get(id, 'firewall').then(setD).catch(e => setErr(e.message)), [id])
  useEffect(() => { load() }, [load])
  const run = async (op: string, extra: any = {}, ok = 'Feito.') => {
    setBusy(op); setM(null)
    try { const j = await post(id, { action: 'firewall_op', op, ...extra }); setD(j); setM({ ok: true, t: ok }) } catch (e) { setM({ ok: false, t: (e as Error).message }) } finally { setBusy('') }
  }
  return (
    <section className={card} data-testid="vx-firewall">
      <h2 className="font-black mb-1 flex items-center gap-2"><Flame size={18} className="text-[#B45309]" /> Firewall</h2>
      <p className="text-xs text-[#64748B] mb-3">Firewall dedicada a este VPS. Ao activar, só o tráfego permitido pelas regras chega ao servidor: inclua a porta SSH antes de activar.</p>
      {err ? <p className="text-sm text-red-700">{err}</p> : !d ? <Loader2 className="animate-spin text-[#F5B700]" /> : !d.firewall ? (
        <button className={`${btn} border-[#0A0A0A]`} disabled={!!busy} onClick={() => run('create', {}, 'Firewall criada (ainda inactiva).')} data-testid="vx-fw-create">Criar firewall</button>
      ) : (
        <div className="space-y-3 text-sm">
          <ul className="text-xs space-y-1" data-testid="vx-fw-rules">{d.firewall.rules.length === 0 ? <li className="text-[#64748B]">Sem regras.</li> : d.firewall.rules.map((r: any) => <li key={r.id} className="flex items-center gap-2" data-testid="vx-fw-rule"><span className={r.action === 'accept' ? 'text-green-700 font-bold' : 'text-red-700 font-bold'}>{r.action === 'accept' ? 'Permitir' : 'Bloquear'}</span> {r.protocol} · porta {r.port} · origem {r.sourceDetail}<button className="ml-auto underline" disabled={!!busy} onClick={() => run('delete-rule', { ruleId: r.id }, 'Regra removida.')}>Remover</button></li>)}</ul>
          <div className="flex flex-wrap gap-2 items-end text-xs">
            <select className={field} value={rule.action} onChange={e => setRule({ ...rule, action: e.target.value })}><option value="accept">Permitir</option><option value="drop">Bloquear</option></select>
            <select className={field} value={rule.protocol} onChange={e => setRule({ ...rule, protocol: e.target.value })} data-testid="vx-fw-protocol">{d.protocols.map((p: string) => <option key={p}>{p}</option>)}</select>
            <input className={`${field} w-28`} value={rule.port} onChange={e => setRule({ ...rule, port: e.target.value })} placeholder="porta" data-testid="vx-fw-port" />
            <input className={`${field} w-40`} value={rule.sourceDetail} onChange={e => setRule({ ...rule, sourceDetail: e.target.value })} placeholder="any ou IP/CIDR" />
            <button className={`${btn} border-[#0A0A0A]`} disabled={!!busy} onClick={() => run('add-rule', rule, 'Regra adicionada.')} data-testid="vx-fw-add">Adicionar regra</button>
          </div>
          <div className="flex gap-2"><button className={`${btn} border-green-600 text-green-700`} disabled={!!busy} onClick={() => run('activate', {}, 'Firewall activada neste VPS.')} data-testid="vx-fw-activate">Activar</button>
            <button className={`${btn} border-[#E5E7EB]`} disabled={!!busy} onClick={() => run('deactivate', {}, 'Firewall desactivada.')} data-testid="vx-fw-deactivate">Desactivar</button>
            <button className={`${btn} border-[#E5E7EB]`} disabled={!!busy} onClick={() => run('sync', {}, 'Regras sincronizadas com o VPS.')}><RefreshCw size={13} />Sincronizar</button></div>
        </div>
      )}
      <Note m={m} />
    </section>
  )
}

export function VpsPlanActions({ vps }: { vps: MyVps }) {
  const router = useRouter()
  const addRenewal = useCart(s => s.addRenewal)
  return (
    <section className={card} data-testid="vx-plan-actions">
      <h2 className="font-black mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-[#B45309]" /> Plano e facturação</h2>
      <div className="flex flex-wrap gap-2">
        <button className={`${btn} border-[#F5B700] bg-[#F5B700] text-black`} onClick={() => { addRenewal(vps.id, `Renovação — ${vps.plan}`); router.push('/carrinho') }} data-testid="vx-renew">Renovar</button>
        <Link className={`${btn} border-[#0A0A0A]`} href={`/servidor-vps/configurar?upgrade=${vps.id}`} data-testid="vx-upgrade">Solicitar upgrade</Link>
        <Link className={`${btn} border-[#E5E7EB]`} href="/billing">Facturas</Link>
        <Link className={`${btn} border-[#E5E7EB]`} href={`/tickets?assunto=${encodeURIComponent(`VPS ${vps.plan} — ${vps.reference}`)}`} data-testid="vx-ticket">Abrir ticket</Link>
      </div>
      <p className="text-xs text-[#64748B] mt-2">O upgrade é um pedido: a equipa confirma o plano, a disponibilidade e a diferença de preço.</p>
    </section>
  )
}
