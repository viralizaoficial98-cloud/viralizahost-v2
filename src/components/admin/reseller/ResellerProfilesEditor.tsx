'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

// Catálogo e Preços → Revenda → perfil técnico de cada plano: limites reais no WHM, ACL, pacote da conta principal,
// pacotes autorizados e servidores compatíveis. Preços e características ficam no editor de planos (acima).

/* eslint-disable @typescript-eslint/no-explicit-any */
const input = 'w-full border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#F5B700]'
const btn = 'px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50'

export function ResellerProfilesEditor() {
  const [d, setD] = useState<any>(null)
  const [whm, setWhm] = useState<any>(null)
  const [whmMsg, setWhmMsg] = useState('')
  const load = useCallback(() => { fetch('/api/admin/reseller/profiles', { cache: 'no-store' }).then(r => r.json()).then(setD).catch(() => setD({ error: 'Falha ao carregar.' })) }, [])
  useEffect(load, [load])
  const readWhm = async (sid: string) => {
    setWhmMsg('A ler o WHM…')
    const r = await fetch(`/api/admin/reseller/profiles?whm=${sid}`, { cache: 'no-store' }); const j = await r.json()
    if (!r.ok) { setWhmMsg(j.error ?? 'Falha'); return }
    setWhm(j); setWhmMsg('')
  }
  if (!d) return <Loader2 className="animate-spin text-[#F5B700]" />
  if (d.error) return <p className="text-red-600 text-sm">{d.error}</p>
  return (
    <div className="space-y-3" data-testid="rv-profiles">
      <p className="text-xs text-[#64748B]">Limites finitos (sem ilimitado, sem overselling). Sem ACL, pacote principal e pacotes autorizados o plano não pode ser aprovado tecnicamente. Perfis de laboratório («_lab») não são aceites.</p>
      {d.servers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">Ler pacotes e ACLs do WHM (só leitura):
          {d.servers.map((s: any) => <button key={s.id} className={`${btn} border`} onClick={() => readWhm(s.id)} data-testid="rv-read-whm">{s.label}</button>)}<span>{whmMsg}</span>
        </div>
      )}
      {whm && (
        <div className="text-xs bg-[#F8FAFC] rounded-xl p-3 space-y-1" data-testid="rv-whm-catalog">
          <p><strong>Pacotes:</strong> {whm.packages.map((p: any) => `${p.name}${p.unlimited ? ' (ILIMITADO — evitar)' : ''}`).join(', ')}</p>
          {whm.acls.map((a: any) => <p key={a.name} data-testid="rv-acl-audit" data-acl={a.name} data-ok={a.audit.ok ? '1' : '0'}><strong>{a.name}</strong>{a.lab ? ' (laboratório)' : ''}: {a.audit.ok ? <span className="text-green-700">sem privilégios proibidos</span> : <span className="text-red-700">{a.audit.problems.join('; ')}</span>}{a.audit.extra.length ? ` · além da referência: ${a.audit.extra.join(', ')}` : ''}</p>)}
        </div>
      )}
      {d.profiles.map((p: any) => <ProfileRow key={p.productId} p={p} servers={d.servers} onSaved={load} />)}
    </div>
  )
}

function ProfileRow({ p, servers, onSaved }: { p: any; servers: any[]; onSaved: () => void }) {
  const [f, setF] = useState<any>(() => ({ storageMb: p.storageMb || '', bandwidthMb: p.bandwidthMb || '', maxAccounts: p.maxAccounts || '', mainQuotaMb: p.mainQuotaMb || '', aclName: p.aclName ?? '', mainPackage: p.mainPackage ?? '', allowedPackages: p.allowedPackages.join(', '), serverIds: [...p.serverIds] as string[], allowOwnPackages: p.allowOwnPackages, ownPackagesConfirm: '', notes: p.notes ?? '' }))
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/admin/reseller/profiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: p.productId, ...f, allowedPackages: f.allowedPackages.split(/[,\n]+/).map((x: string) => x.trim()).filter(Boolean) }) })
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      setMsg({ ok: true, t: j.profile.complete ? 'Guardado — perfil completo.' : `Guardado — falta: ${j.profile.missing.join(', ')}.` }); onSaved()
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy(false) }
  }
  return (
    <div className="border border-[#E5E7EB] rounded-xl p-4 bg-white space-y-2" data-testid="rv-profile-row" data-slug={p.slug}>
      <p className="font-bold text-sm">{p.name} <span className="text-xs font-normal text-[#64748B]">({p.slug} · {p.saleStatus}) {p.complete ? '· perfil completo' : `· falta: ${p.missing.join(', ')}`}</span></p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
        <label>Armazenamento p/ clientes (MB)<input className={input} type="number" value={f.storageMb} onChange={set('storageMb')} data-testid="rvp-storage" /></label>
        <label>Tráfego mensal (MB)<input className={input} type="number" value={f.bandwidthMb} onChange={set('bandwidthMb')} data-testid="rvp-bw" /></label>
        <label>Contas cPanel<input className={input} type="number" value={f.maxAccounts} onChange={set('maxAccounts')} data-testid="rvp-accounts" /></label>
        <label>Quota da conta principal (MB)<input className={input} type="number" value={f.mainQuotaMb} onChange={set('mainQuotaMb')} data-testid="rvp-mainq" /></label>
        <label>ACL (WHM)<input className={input} value={f.aclName} onChange={set('aclName')} data-testid="rvp-acl" placeholder="viraliza_reseller_std_acl" /></label>
        <label>Pacote da conta principal<input className={input} value={f.mainPackage} onChange={set('mainPackage')} data-testid="rvp-mainpkg" /></label>
        <label className="sm:col-span-2">Pacotes autorizados (separados por vírgulas)<input className={input} value={f.allowedPackages} onChange={set('allowedPackages')} data-testid="rvp-pkgs" /></label>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">Servidores compatíveis (vazio = qualquer servidor elegível):
        {servers.map(s => <label key={s.id} className="flex items-center gap-1"><input type="checkbox" checked={f.serverIds.includes(s.id)} onChange={e => setF({ ...f, serverIds: e.target.checked ? [...f.serverIds, s.id] : f.serverIds.filter((x: string) => x !== s.id) })} />{s.label}{s.environment === 'test' ? ' (teste)' : ''}</label>)}
        {servers.length === 0 && <span className="text-[#64748B]">nenhum servidor com a categoria «Revenda».</span>}
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.allowOwnPackages} onChange={e => setF({ ...f, allowOwnPackages: e.target.checked })} />Permitir gerir pacotes próprios (add-pkg/edit-pkg) — exige validação técnica e comercial</label>
      {f.allowOwnPackages && !p.allowOwnPackages && <input className={input} placeholder="Escreva VALIDADO" value={f.ownPackagesConfirm} onChange={set('ownPackagesConfirm')} />}
      <div className="flex items-center gap-3"><button className={`${btn} bg-[#0A0A0A] text-white`} disabled={busy} onClick={save} data-testid="rvp-save">{busy ? '…' : 'Guardar perfil técnico'}</button>
        {msg && <span className={`text-xs font-semibold ${msg.ok ? 'text-green-700' : 'text-red-700'}`} data-testid="rvp-msg">{msg.t}</span>}</div>
    </div>
  )
}
