'use client'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Plus, RefreshCw, XCircle } from 'lucide-react'

// Infraestrutura → Servidores: ficha técnica, licença, categorias de serviço, ambiente, sincronização WHM (só
// leitura), capacidade segura e autorização expressa para revenda. O token é só de escrita (nunca é mostrado).

/* eslint-disable @typescript-eslint/no-explicit-any */
const card = 'bg-white border border-[#E5E7EB] rounded-2xl'
const input = 'w-full border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#F5B700]'
const btn = 'px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50'
const gb = (mb: number | null) => (mb == null ? '—' : `${(mb / 1024).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} GB`)
const dt = (v: unknown) => (v ? new Date(String(v)).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca')

async function post(body: unknown) {
  const r = await fetch('/api/admin/infra/servers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok && !j.servers) throw new Error(j.error ?? `Erro ${r.status}`)
  return { ...j, ok: r.ok }
}

export function InfraServers() {
  const [d, setD] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const load = useCallback(() => { fetch('/api/admin/infra/servers', { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => setD({ error: 'Falha ao carregar.' })) }, [])
  useEffect(load, [load])
  if (!d) return <Loader2 className="animate-spin text-[#F5B700]" />
  if (d.error) return <p className="text-red-600 text-sm">{d.error}</p>
  return (
    <div className="space-y-4">
      {d.servers.map((s: any) => <ServerCard key={s.id} s={s} categories={d.categories} onSaved={(list: any[]) => setD({ ...d, servers: list })} />)}
      {adding ? <ServerCard s={null} categories={d.categories} onSaved={(list: any[]) => { setD({ ...d, servers: list }); setAdding(false) }} onCancel={() => setAdding(false)} />
        : <button className={`${btn} border inline-flex items-center gap-1`} onClick={() => setAdding(true)} data-testid="srv-add"><Plus size={14} />Registar servidor</button>}
    </div>
  )
}

function ServerCard({ s, categories, onSaved, onCancel }: { s: any; categories: Record<string, string>; onSaved: (l: any[]) => void; onCancel?: () => void }) {
  const [edit, setEdit] = useState(!s)
  const [f, setF] = useState<any>(() => ({
    id: s?.id, name: s?.primary ? '' : s?.name ?? '', provider: s?.provider ?? '', hostname: s?.hostname ?? '', ip: s?.ip ?? '', port: s?.port ?? 2087, type: s?.type ?? 'cpanel_whm', os: s?.os ?? '',
    cpuCores: s?.cpuCores ?? '', ramMb: s?.ramMb ?? '', storageTotalMb: s?.storageTotalMb ?? '', storageReserveMb: s?.storageReserveMb ?? 0, licenseName: s?.licenseName ?? '', licenseAccountLimit: s?.licenseAccountLimit ?? '',
    unlimitedAssumedMb: s?.unlimitedAssumedMb ?? '', services: s?.services ?? [], environment: s?.environment ?? 'production', state: s?.state ?? 'active', protectedAccounts: (s?.protectedAccounts ?? []).join(', '),
    whmUrl: '', whmUsername: '', token: '',
  }))
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [auth, setAuth] = useState({ note: '', confirm: '' })
  const run = async (key: string, body: any, okText: string) => {
    setBusy(key); setMsg(null)
    try { const j = await post(body); onSaved(j.servers); setMsg({ ok: j.ok !== false, t: j.message ?? okText }); if (key === 'save') setEdit(false) } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(null) }
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const c = s?.capacity
  return (
    <div className={`${card} p-5 space-y-3`} data-testid="srv-card" data-name={s?.name ?? 'novo'}>
      {s && (
        <div className="flex flex-wrap items-center gap-3">
          {s.state === 'active' ? <CheckCircle2 size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-600" />}
          <p className="font-bold">{s.label}</p>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.environment === 'test' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`} data-testid="srv-env">{s.environment === 'test' ? 'Teste' : 'Produção'}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.resellerAuthorized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} data-testid="srv-reseller-auth">{s.resellerAuthorized ? 'Revenda autorizada' : 'Revenda NÃO autorizada'}</span>
          <span className="text-xs text-[#64748B]">{s.hostname} · {s.ip}:{s.port} · {s.hasToken ? 'credencial configurada' : 'sem credencial'}</span>
        </div>
      )}
      {s && !edit && (
        <div className="grid md:grid-cols-3 gap-3 text-xs">
          <div><p className="font-bold text-[#64748B] uppercase text-[10px]">Ficha</p>{s.provider ?? '—'} · {s.os ?? 'SO ?'} · {s.cpuCores ?? '?'} vCPU · {gb(s.ramMb)} RAM<br />Categorias: {s.services.map((x: string) => categories[x]).join(', ') || '—'}<br />Contas protegidas: {s.protectedAccounts.join(', ') || '—'}</div>
          <div><p className="font-bold text-[#64748B] uppercase text-[10px]">Licença e contas</p>{s.licenseName ?? 'Licença ?'} · limite {s.licenseAccountLimit ?? '?'}<br />Existentes {s.accountsExisting ?? '?'} ({s.accountsUnlimited ?? '?'} sem quota) · revendedores {s.resellersExisting ?? '?'}<br />Sincronizado: {dt(s.lastSyncAt)} {s.lastSyncStatus === 'error' ? <span className="text-red-700">— {s.lastSyncMessage}</span> : s.lastSyncMessage ? `— ${s.lastSyncMessage}` : ''}</div>
          <div data-testid="srv-capacity"><p className="font-bold text-[#64748B] uppercase text-[10px]">Capacidade segura</p>Total {gb(s.storageTotalMb)} · reserva {gb(s.storageReserveMb)} · comprometido {gb(s.quotaCommittedMb)}<br />Reservas activas: {gb(c.reservedStorageMb)}, {c.reservedAccounts} contas<br />
            {c.determinable ? <strong className="text-green-700" data-testid="srv-free">Livre: {gb(c.storageFreeMb)} · {c.accountsFree} contas</strong> : <span className="text-red-700" data-testid="srv-undetermined">Indeterminada: {c.reasons.join(' ')}</span>}</div>
        </div>
      )}
      {edit && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {!s?.primary && <label>Nome<input className={input} value={f.name} onChange={set('name')} data-testid="srv-name" /></label>}
          <label>Fornecedor<input className={input} value={f.provider} onChange={set('provider')} /></label>
          <label>Hostname<input className={input} value={f.hostname} onChange={set('hostname')} data-testid="srv-hostname" /></label>
          <label>IP<input className={input} value={f.ip} onChange={set('ip')} data-testid="srv-ip" /></label>
          <label>Porta WHM<input className={input} type="number" value={f.port} onChange={set('port')} /></label>
          <label>Tipo<input className={input} value={f.type} onChange={set('type')} /></label>
          <label>Sistema operativo<input className={input} value={f.os} onChange={set('os')} placeholder="AlmaLinux 9" /></label>
          <label>vCPU<input className={input} type="number" value={f.cpuCores} onChange={set('cpuCores')} /></label>
          <label>RAM (MB)<input className={input} type="number" value={f.ramMb} onChange={set('ramMb')} /></label>
          <label>Armazenamento total (MB)<input className={input} type="number" value={f.storageTotalMb} onChange={set('storageTotalMb')} data-testid="srv-storage" /></label>
          <label>Reserva operacional (MB)<input className={input} type="number" value={f.storageReserveMb} onChange={set('storageReserveMb')} data-testid="srv-reserve" /></label>
          <label>Licença cPanel<input className={input} value={f.licenseName} onChange={set('licenseName')} placeholder="Pro Cloud" /></label>
          <label>Limite de contas da licença<input className={input} type="number" value={f.licenseAccountLimit} onChange={set('licenseAccountLimit')} data-testid="srv-license" /></label>
          <label>Quota assumida por conta ilimitada (MB)<input className={input} type="number" value={f.unlimitedAssumedMb} onChange={set('unlimitedAssumedMb')} data-testid="srv-unlimited" /></label>
          <label>Ambiente<select className={input} value={f.environment} onChange={set('environment')} data-testid="srv-environment"><option value="production">Produção</option><option value="test">Teste (simulador / laboratório)</option></select></label>
          <label>Estado<select className={input} value={f.state} onChange={set('state')}><option value="active">Activo</option><option value="maintenance">Manutenção</option><option value="disabled">Desactivado</option></select></label>
          <label className="sm:col-span-2">Contas protegidas (nunca usadas)<input className={input} value={f.protectedAccounts} onChange={set('protectedAccounts')} /></label>
          <fieldset className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3"><legend className="mb-1">Serviços autorizados</legend>
            {Object.entries(categories).map(([k, l]) => <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={f.services.includes(k)} onChange={e => setF({ ...f, services: e.target.checked ? [...f.services, k] : f.services.filter((x: string) => x !== k) })} data-testid={`srv-cat-${k}`} />{l}</label>)}
          </fieldset>
          {!s?.primary && <><label>URL WHM (https://…:2087)<input className={input} value={f.whmUrl} onChange={set('whmUrl')} data-testid="srv-url" /></label>
            <label>Utilizador WHM<input className={input} value={f.whmUsername} onChange={set('whmUsername')} placeholder="root" /></label>
            <label className="sm:col-span-2">Token API {s?.hasToken ? '(deixe vazio para manter)' : ''}<input className={input} type="password" autoComplete="new-password" value={f.token} onChange={set('token')} data-testid="srv-token" /></label></>}
          {s?.primary && <p className="sm:col-span-2 text-[#64748B]">Credenciais do WHM principal: Integrações → WHM/cPanel.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {edit ? <>
          <button className={`${btn} bg-[#0A0A0A] text-white`} disabled={!!busy} onClick={() => run('save', { action: 'save', server: { ...f, protectedAccounts: String(f.protectedAccounts).split(/[\s,]+/).filter(Boolean) } }, 'Guardado.')} data-testid="srv-save">{busy === 'save' ? '…' : 'Guardar'}</button>
          <button className={`${btn} border`} onClick={() => (s ? setEdit(false) : onCancel?.())}>Cancelar</button>
        </> : <>
          <button className={`${btn} border`} onClick={() => setEdit(true)} data-testid="srv-edit">Editar</button>
          <button className={`${btn} border inline-flex items-center gap-1`} disabled={!!busy} onClick={() => run('sync', { action: 'sync', id: s.id }, 'Sincronizado.')} data-testid="srv-sync"><RefreshCw size={12} />{busy === 'sync' ? 'A sincronizar…' : 'Sincronizar (só leitura)'}</button>
        </>}
      </div>
      {s && !edit && (
        <div className="rounded-xl bg-[#F8FAFC] p-3 space-y-2 text-xs" data-testid="srv-auth-box">
          <p className="font-bold">Autorização técnica para revenda comercial</p>
          {s.resellerAuthorized ? <p>Autorizado em {dt(s.resellerAuthorizedAt)}: {s.resellerAuthorizationNote}</p> : <p className="text-[#64748B]">Sem autorização, nenhum revendedor é criado neste servidor (em nenhum modo).</p>}
          <input className={input} placeholder="Validação técnica feita (obrigatório)" value={auth.note} onChange={e => setAuth({ ...auth, note: e.target.value })} data-testid="srv-auth-note" />
          {!s.resellerAuthorized && s.environment === 'production' && <input className={input} placeholder="Escreva AUTORIZO REVENDA" value={auth.confirm} onChange={e => setAuth({ ...auth, confirm: e.target.value })} data-testid="srv-auth-confirm" />}
          {s.resellerAuthorized
            ? <button className={`${btn} border border-red-300 text-red-700`} disabled={!!busy} onClick={() => run('revoke', { action: 'revoke', id: s.id, note: auth.note }, 'Autorização retirada.')} data-testid="srv-revoke">Retirar autorização</button>
            : <button className={`${btn} bg-green-700 text-white`} disabled={!!busy} onClick={() => run('authorize', { action: 'authorize', id: s.id, note: auth.note, confirmText: auth.confirm }, 'Servidor autorizado.')} data-testid="srv-authorize">Autorizar para revenda</button>}
        </div>
      )}
      {msg && <p className={`text-xs font-semibold ${msg.ok ? 'text-green-700' : 'text-red-700'}`} role="status" data-testid="srv-msg">{msg.t}</p>}
    </div>
  )
}
