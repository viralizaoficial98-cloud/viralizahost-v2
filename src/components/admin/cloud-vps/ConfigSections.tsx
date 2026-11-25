'use client'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Badge, btn, card, cvApi, cvPost, d10, dt, input, money, Msg, Spinner } from './ui'

/* eslint-disable @typescript-eslint/no-explicit-any */
const QLABEL: Record<string, string> = { catalog: 'Catálogo VPS', virtualMachines: 'Máquinas virtuais', dataCenters: 'Centros de dados', templates: 'Templates', paymentMethods: 'Métodos de pagamento', subscriptions: 'Subscrições', firewalls: 'Firewalls' }

// ── Fornecedores Cloud ──
export function ProvidersSection() {
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(''), [last, setLast] = useState<any>(null)
  const [f, setF] = useState<any>({ secret: '', confirmAuto: false, confirmText: '' })
  const load = useCallback((live = false) => { cvApi('providers', live ? { live: 1 } : {}).then(j => { setD(j); setF((x: any) => ({ ...x, mode: j.settings.mode, apiUrl: j.settings.apiUrl ?? '', paymentMethodId: j.settings.paymentMethodId ?? '', hostnameSuffix: j.settings.hostnameSuffix, autoProvision: j.settings.autoProvision, spend: j.cloud.spendLimitMonthlyMinor ?? '', purchases: j.cloud.operations.purchases, clientManagement: j.cloud.operations.clientManagement })) }).catch(e => setMsg({ ok: false, t: e.message })) }, [])
  useEffect(() => load(true), [load])
  const run = async (key: string, body: any, okText?: (j: any) => string) => {
    setBusy(key); setMsg(null)
    try { const j = await cvPost(body); if (j.results) setLast(j); setMsg({ ok: j.ok !== false, t: okText ? okText(j) : j.message ?? 'Guardado.' }); load(true) }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy('') }
  }
  if (!d) return <><Spinner /><Msg m={msg} /></>
  const s = d.settings
  return (
    <div className="space-y-4" data-testid="cv-providers">
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-center gap-2"><p className="font-black">Hostinger</p>
          <Badge tone={s.lastTest.ok ? 'green' : s.lastTest.ok === false ? 'red' : 'gray'} testId="cv-provider-status">{s.lastTest.ok ? 'Ligação verificada' : s.lastTest.ok === false ? 'Falha na última verificação' : 'Por testar'}</Badge>
          <Badge tone={s.mode === 'live' ? 'red' : 'amber'}>{s.mode === 'live' ? 'Produção' : 'Ensaio (API simulada)'}</Badge>
          <span className="text-xs text-[#64748B]">Última verificação: {dt(s.lastTest.at)} — {s.lastTest.message ?? '—'}</span></div>
        <p className="text-xs text-[#64748B]">Credencial: {s.hasSecret ? 'token próprio (cifrado)' : s.usesRegistrarToken ? 'token do Registrador (mesma conta Hostinger)' : 'por configurar'}. O token nunca é mostrado nem enviado ao navegador. Compras reais: {d.livePurchasesEnv ? 'VPS_LIVE_PURCHASES=1 activo' : 'bloqueadas (VPS_LIVE_PURCHASES ≠ 1)'}.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          <label>Ambiente<select className={`${input} w-full`} value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })} data-testid="cv-prov-mode"><option value="test">Ensaio (API simulada)</option><option value="live">Produção (developers.hostinger.com)</option></select></label>
          {f.mode === 'test' && <label>Endereço da API simulada<input className={`${input} w-full`} value={f.apiUrl} onChange={e => setF({ ...f, apiUrl: e.target.value })} /></label>}
          <label>Novo token API (só escrita)<input className={`${input} w-full`} type="password" autoComplete="new-password" value={f.secret} onChange={e => setF({ ...f, secret: e.target.value })} data-testid="cv-prov-token" /></label>
          <label>Sufixo do hostname<input className={`${input} w-full`} value={f.hostnameSuffix} onChange={e => setF({ ...f, hostnameSuffix: e.target.value })} /></label>
          <label>Método de pagamento da conta<select className={`${input} w-full`} value={f.paymentMethodId} onChange={e => setF({ ...f, paymentMethodId: e.target.value })} data-testid="cv-prov-pm">
            <option value="">Por escolher</option>{Array.isArray(d.paymentMethods) && d.paymentMethods.map((p: any) => <option key={p.id} value={p.id} disabled={p.unusable}>{p.label}{p.isDefault ? ' (predefinido)' : ''}{p.unusable ? ' — indisponível' : ''}</option>)}</select></label>
          <label className="flex items-center gap-2 mt-4"><input type="checkbox" checked={!!f.autoProvision} onChange={e => setF({ ...f, autoProvision: e.target.checked })} data-testid="cv-prov-auto" />Compra automática no fornecedor</label>
          {f.autoProvision && !s.autoProvision && <label className="flex items-center gap-2 mt-4 text-red-700"><input type="checkbox" checked={f.confirmAuto} onChange={e => setF({ ...f, confirmAuto: e.target.checked })} data-testid="cv-prov-auto-confirm" />Confirmo: compras debitadas no método de pagamento da conta Hostinger</label>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`${btn} bg-[#0A0A0A] text-white`} disabled={!!busy} onClick={() => run('save', { action: 'provider_save', mode: f.mode, apiUrl: f.mode === 'test' ? f.apiUrl : undefined, secret: f.secret || undefined, paymentMethodId: f.paymentMethodId === '' ? null : Number(f.paymentMethodId), hostnameSuffix: f.hostnameSuffix, autoProvision: !!f.autoProvision, confirmAuto: f.confirmAuto }, () => 'Configuração do fornecedor guardada.')} data-testid="cv-prov-save">Guardar</button>
          <button className={`${btn} border`} disabled={!!busy} onClick={() => run('test', { action: 'test' })} data-testid="cv-prov-test">{busy === 'test' ? 'A testar…' : 'Testar ligação'}</button>
          <button className={`${btn} border`} disabled={!!busy} onClick={() => run('inv', { action: 'sync_inventory' }, j => `${j.message} VMs: ${j.imported} nova(s), ${j.updated} actualizada(s).`)} data-testid="cv-prov-sync">Sincronizar VMs, subscrições, catálogo, templates e centros</button>
        </div>
        <Msg m={msg} />
        {last?.results && <QueryTable results={last.results} />}
      </div>
      <div className={`${card} p-4 space-y-2 text-xs`}>
        <p className="font-bold text-sm">Limites e operações</p>
        <div className="flex flex-wrap gap-3 items-end">
          <label>Limite mensal de despesas no fornecedor (cêntimos; vazio = sem limite)<input className={`${input} w-48 block`} type="number" value={f.spend} onChange={e => setF({ ...f, spend: e.target.value })} data-testid="cv-spend" /></label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!f.purchases} onChange={e => setF({ ...f, purchases: e.target.checked })} data-testid="cv-op-purchases" />Compras no fornecedor activas</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={!!f.clientManagement} onChange={e => setF({ ...f, clientManagement: e.target.checked })} data-testid="cv-op-client" />Gestão pelo cliente activa</label>
          <button className={`${btn} bg-[#0A0A0A] text-white`} disabled={!!busy} onClick={() => run('lim', { action: 'save_cloud', spendLimitMonthlyMinor: f.spend === '' ? null : Number(f.spend), operations: { purchases: !!f.purchases, clientManagement: !!f.clientManagement } }, () => 'Limites e operações guardados.')} data-testid="cv-limits-save">Guardar</button>
        </div>
      </div>
      <div className={`${card} p-4 text-xs`} data-testid="cv-subscriptions"><p className="font-bold text-sm mb-2">Subscrições e custos (leitura)</p>
        {d.liveError ? <p className="text-red-700">{d.liveError}</p> : !Array.isArray(d.subscriptions) ? <p className="text-red-700">Consulta falhou.</p> : d.subscriptions.length === 0 ? <p className="text-[#64748B]">Nenhuma subscrição.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead><tr className="text-left text-[#64748B]"><th>Subscrição</th><th>Estado</th><th>Período</th><th>Total</th><th>Renovação</th><th>Renova auto.</th><th>Próxima cobrança</th><th>Expira</th></tr></thead>
            <tbody>{d.subscriptions.map((x: any) => <tr key={x.id} className="border-t border-[#F1F5F9]"><td className="py-1">{x.name ?? x.id}</td><td>{x.status}</td><td>{x.period}</td><td>{money(x.totalMinor, x.currency)}</td><td>{money(x.renewalMinor, x.currency)}</td><td>{x.autoRenew ? 'sim' : 'não'}</td><td>{d10(x.nextBillingAt)}</td><td>{d10(x.expiresAt)}</td></tr>)}</tbody></table></div>
        )}
        <p className="text-[#94A3B8] mt-2">Cancelar/desactivar renovações é feito no hPanel com decisão da equipa: o portal nunca cancela automaticamente. Desligar um VPS não pára a cobrança.</p>
      </div>
      <div className={`${card} p-4 text-xs`} data-testid="cv-sync-history"><p className="font-bold text-sm mb-2">Histórico de sincronização e erros</p>
        <ul className="space-y-1">{d.history.map((h: any) => <li key={h.id} className="flex gap-2 items-start">{h.ok ? <CheckCircle2 size={14} className="text-green-600 shrink-0" /> : <XCircle size={14} className="text-red-600 shrink-0" />}<span>{dt(h.created_at)} · {h.kind} · {h.message}{h.actor_email ? ` · ${h.actor_email}` : ''}</span></li>)}</ul>
      </div>
      <div className={`${card} p-4 text-xs text-[#64748B]`}><p className="font-bold text-sm text-[#0B0B0D]">Outros fornecedores</p>A estrutura (inventário, operações, custos, histórico) guarda o fornecedor em cada registo: novos fornecedores ligam-se ao mesmo módulo quando houver integração validada.</div>
    </div>
  )
}
function QueryTable({ results }: { results: Record<string, any> }) {
  return (
    <table className="w-full text-xs" data-testid="cv-query-results"><thead><tr className="text-left text-[#64748B]"><th>Consulta</th><th>Resultado</th><th>Itens</th><th>Tempo</th></tr></thead>
      <tbody>{Object.entries(results).map(([k, r]) => <tr key={k} className="border-t border-[#F1F5F9]" data-testid="cv-query" data-q={k} data-ok={r.ok ? '1' : '0'}><td className="py-1">{QLABEL[k] ?? k}</td><td>{r.ok ? <span className="text-green-700 font-bold">OK</span> : <span className="text-red-700 font-bold">Falhou: {r.error}</span>}</td><td>{r.count ?? '—'}</td><td>{r.ms} ms</td></tr>)}</tbody></table>
  )
}

// ── Configurações (modo comercial, finanças, extras) ──
export function SettingsSection() {
  const [d, setD] = useState<any>(null), [f, setF] = useState<any>(null), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const load = useCallback(() => { cvApi('settings').then(j => { setD(j); setF({ mode: j.cloud.mode, confirmText: '', ...j.cloud.finance, addons: j.cloud.addons }) }).catch(e => setMsg({ ok: false, t: e.message })) }, [])
  useEffect(load, [load])
  const save = async (body: any) => { setMsg(null); try { await cvPost({ action: 'save_cloud', ...body }); setMsg({ ok: true, t: 'Guardado.' }); load() } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } }
  if (!d || !f) return <><Spinner /><Msg m={msg} /></>
  const MODES: [string, string][] = [['disabled', 'Desactivado — não aceita novas contratações'], ['test', 'Teste — só administradores (operações simuladas)'], ['request_only', 'Solicitação mediante aprovação (recomendado)'], ['automatic', 'Automático — compra e configura após pagamento validado']]
  return (
    <div className="space-y-4 max-w-3xl" data-testid="cv-settings">
      <div className={`${card} p-4 space-y-2`}>
        <p className="font-bold">Modo de contratação</p>
        {MODES.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="cvmode" checked={f.mode === k} onChange={() => setF({ ...f, mode: k })} data-testid={`cv-mode-${k}`} />{l}</label>)}
        {f.mode === 'automatic' && d.cloud.mode !== 'automatic' && <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1"><p>Autorização expressa: depois do pagamento validado o sistema compra e configura o VPS no fornecedor. Em produção exige também VPS_LIVE_PURCHASES=1 ({d.livePurchasesEnv ? 'activo' : 'não definido — o modo será recusado'}).</p>
          <input className={`${input} w-full`} placeholder="Escreva AUTORIZO VENDA AUTOMATICA VPS" value={f.confirmText} onChange={e => setF({ ...f, confirmText: e.target.value })} data-testid="cv-mode-confirm" /></div>}
        <button className={`${btn} bg-[#0A0A0A] text-white`} onClick={() => save({ mode: f.mode, confirmText: f.confirmText })} data-testid="cv-mode-save">Guardar modo</button>
      </div>
      <div className={`${card} p-4 space-y-2 text-xs`}>
        <p className="font-bold text-sm">Finanças</p>
        <div className="grid sm:grid-cols-3 gap-2">
          {[['fxBrlAoa', 'Câmbio BRL → AOA'], ['fxUsdAoa', 'Câmbio USD → AOA'], ['markupPct', 'Acréscimo comercial (%)'], ['bankFeePct', 'Comissão bancária (%)'], ['taxPct', 'Impostos sobre o custo (%)']].map(([k, l]) =>
            <label key={k}>{l}<input className={`${input} w-full`} type="number" step="0.0001" value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: e.target.value })} data-testid={`cv-fin-${k}`} /></label>)}
        </div>
        <button className={`${btn} bg-[#0A0A0A] text-white`} onClick={() => save({ finance: { fxBrlAoa: f.fxBrlAoa, fxUsdAoa: f.fxUsdAoa, markupPct: f.markupPct, bankFeePct: f.bankFeePct, taxPct: f.taxPct } })} data-testid="cv-fin-save">Guardar finanças</button>
      </div>
      <div className={`${card} p-4 space-y-2 text-xs`}>
        <p className="font-bold text-sm">Extras do configurador (suporte, backups adicionais, licenças)</p>
        <p className="text-[#64748B]">Serviços prestados pela ViralizaHost (a API da Hostinger não vende estes extras na compra): somados ao preço e entregues pela equipa.</p>
        {f.addons.map((a: any, i: number) => (
          <div key={i} className="flex flex-wrap gap-2 items-center" data-testid="cv-addon">
            <input className={input} placeholder="Nome" value={a.label} onChange={e => setF({ ...f, addons: f.addons.map((x: any, j: number) => j === i ? { ...x, label: e.target.value } : x) })} />
            <select className={input} value={a.kind} onChange={e => setF({ ...f, addons: f.addons.map((x: any, j: number) => j === i ? { ...x, kind: e.target.value } : x) })}><option value="support">Suporte</option><option value="backup">Backups</option><option value="license">Licença</option><option value="other">Outro</option></select>
            <input className={`${input} w-28`} type="number" placeholder="Kz/mês" value={a.monthlyKz} onChange={e => setF({ ...f, addons: f.addons.map((x: any, j: number) => j === i ? { ...x, monthlyKz: e.target.value } : x) })} />
            <label className="flex items-center gap-1"><input type="checkbox" checked={!!a.enabled} onChange={e => setF({ ...f, addons: f.addons.map((x: any, j: number) => j === i ? { ...x, enabled: e.target.checked } : x) })} />Activo</label>
            <button className="text-red-700 underline" onClick={() => setF({ ...f, addons: f.addons.filter((_: any, j: number) => j !== i) })}>Remover</button>
          </div>
        ))}
        <div className="flex gap-2"><button className={`${btn} border`} onClick={() => setF({ ...f, addons: [...f.addons, { label: '', kind: 'support', monthlyKz: 0, enabled: false }] })} data-testid="cv-addon-add">Adicionar extra</button>
          <button className={`${btn} bg-[#0A0A0A] text-white`} onClick={() => save({ addons: f.addons })} data-testid="cv-addon-save">Guardar extras</button></div>
      </div>
      <Msg m={msg} />
    </div>
  )
}
