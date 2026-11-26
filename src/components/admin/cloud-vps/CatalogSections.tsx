'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, Bot, Briefcase, Code2, Database, LayoutPanelLeft, Package, Server, Workflow } from 'lucide-react'
import { Badge, btn, card, cvApi, cvPost, ErrorBox, input, kz, money, Msg, Pager, Spinner } from './ui'
import { CountryFlag } from '@/components/ui/CountryFlag'

/* eslint-disable @typescript-eslint/no-explicit-any */
const CYCLE: Record<string, string> = { monthly: '1 mês', '1year': '1 ano', '2years': '2 anos' }

// ── Planos e preços (finanças por ciclo; edição completa no editor de planos existente) ──
export function PlansSection() {
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState('')
  const load = useCallback(() => { cvApi('finance').then(setD).catch(e => setMsg({ ok: false, t: e.message })) }, [])
  useEffect(load, [load])
  const run = async (key: string, body: any, ok: (j: any) => string) => { setBusy(key); setMsg(null); try { const j = await cvPost(body); if (j.plans) setD((x: any) => ({ ...x, ...j })); else load(); setMsg({ ok: true, t: ok(j) }) } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } finally { setBusy('') } }
  if (!d) return <><Spinner /><Msg m={msg} /></>
  const f = d.finance
  return (
    <div className="space-y-4" data-testid="cv-plans">
      <div className={`${card} p-4 text-xs flex flex-wrap gap-x-6 gap-y-2 items-center`}>
        <span>Câmbio BRL→AOA: <strong data-testid="cv-fx">{f.fxBrlAoa ?? 'por definir'}</strong></span><span>USD→AOA: <strong>{f.fxUsdAoa ?? '—'}</strong></span>
        <span>Acréscimo comercial: <strong>{f.markupPct}%</strong></span><span>Comissão bancária: {f.bankFeePct}% · impostos {f.taxPct}%</span>
        <Link className="underline" href="/admin/cloud-vps/configuracoes">alterar</Link>
        <button className={`${btn} bg-[#0A0A0A] text-white ml-auto`} disabled={!!busy} onClick={() => run('sync', { action: 'sync_costs' }, j => `${j.updated} ciclo(s) com custos actualizados${j.missing.length ? `; item(ns) inexistente(s): ${j.missing.join(', ')}` : ''}${j.mismatch.length ? `; períodos incoerentes: ${j.mismatch.join(', ')}` : ''}.`)} data-testid="cv-sync-costs">{busy === 'sync' ? '…' : 'Sincronizar custos do fornecedor'}</button>
        <Link className={`${btn} border`} href="/admin/site/catalog?cat=vps" data-testid="cv-open-editor">Editor de planos (ficha, preços, produto Hostinger, modo)</Link>
      </div>
      <p className="text-xs text-[#64748B]">Estratégia inicial: preço regular = custo de <strong>renovação</strong> × câmbio × (1 + acréscimo); promocional (1.º período) = custo inicial × câmbio × (1 + acréscimo); extras de suporte/licenças somados por mês. Um ciclo cuja renovação de venda não cobre a renovação do fornecedor fica <strong>bloqueado</strong> na venda.</p>
      <Msg m={msg} />
      {d.plans.map((p: any) => <PlanFinance key={p.id} p={p} busy={busy} run={run} />)}
    </div>
  )
}
function PlanFinance({ p, busy, run }: { p: any; busy: string; run: (k: string, b: any, ok: (j: any) => string) => void }) {
  const [ex, setEx] = useState({ supportMonthlyKz: p.extras.supportMonthlyKz || '', licenseMonthlyKz: p.extras.licenseMonthlyKz || '', markupPct: p.extras.markupPct ?? '' })
  return (
    <div className={`${card} p-4 space-y-2`} data-testid="cv-plan" data-slug={p.slug}>
      <div className="flex flex-wrap gap-2 items-center"><p className="font-bold">{p.name}</p><Badge tone={p.saleStatus === 'active' ? 'green' : 'gray'}>{p.saleStatus}</Badge><span className="text-xs text-[#64748B]">{p.providerProductId ?? 'sem produto Hostinger'} · {p.providerMode === 'auto' ? 'automático' : 'manual'}</span></div>
      <div className="overflow-x-auto"><table className="w-full text-xs min-w-[900px]">
        <thead><tr className="text-left text-[#64748B]"><th className="py-1">Ciclo</th><th>Venda (desembolso inicial)</th><th>Equiv. mensal</th><th>Renovação (venda)</th><th>Custo inicial</th><th>Custo renovação</th><th>Margem 1.º período</th><th>Margem renovação</th><th>Sugerido (promo / regular)</th><th></th></tr></thead>
        <tbody>{p.cycles.map((c: any) => (
          <tr key={c.cycle} className="border-t border-[#F1F5F9]" data-testid="cv-plan-cycle" data-cycle={c.cycle} data-sustainable={String(c.sustainable)}>
            <td className="py-1.5">{CYCLE[c.cycle]}{!c.active && <span className="text-[#94A3B8]"> (não publicado)</span>}</td>
            <td>{kz(c.sale)}</td><td>{kz(c.monthlyEquivalent)}</td><td>{kz(c.renewal)}</td>
            <td>{money(c.initialMinor, c.currency)}{c.initialKz != null && <><br /><span className="text-[#94A3B8]">{kz(c.initialKz)}</span></>}</td>
            <td>{money(c.renewalMinor, c.currency)}{c.renewalKz != null && <><br /><span className="text-[#94A3B8]">{kz(c.renewalKz)}</span></>}</td>
            <td className={c.marginFirst < 0 ? 'text-red-700 font-bold' : ''}>{kz(c.marginFirst)}</td>
            <td className={c.marginRenewal < 0 ? 'text-red-700 font-bold' : ''}>{kz(c.marginRenewal)}{c.sustainable === false && <><br /><Badge tone="red" testId="cv-unsustainable">insustentável</Badge></>}</td>
            <td>{kz(c.suggestedPromo)} / {kz(c.suggestedRegular)}</td>
            <td>{c.suggestedPromo != null && <button className={`${btn} border`} disabled={!!busy} onClick={() => run(`ap-${p.id}-${c.cycle}`, { action: 'apply_suggested', productId: p.id, cycle: c.cycle }, () => 'Preço sugerido aplicado (ajustável no editor de planos).')} data-testid="cv-apply-suggested">Aplicar</button>}</td>
          </tr>))}</tbody>
      </table></div>
      <div className="flex flex-wrap gap-2 items-end text-xs">
        <label>Suporte (Kz/mês)<input className={`${input} w-28 block`} type="number" value={ex.supportMonthlyKz} onChange={e => setEx({ ...ex, supportMonthlyKz: e.target.value })} /></label>
        <label>Licenças (Kz/mês)<input className={`${input} w-28 block`} type="number" value={ex.licenseMonthlyKz} onChange={e => setEx({ ...ex, licenseMonthlyKz: e.target.value })} /></label>
        <label>Acréscimo próprio (%)<input className={`${input} w-28 block`} type="number" placeholder="global" value={ex.markupPct} onChange={e => setEx({ ...ex, markupPct: e.target.value })} /></label>
        <button className={`${btn} border`} disabled={!!busy} onClick={() => run(`ex-${p.id}`, { action: 'plan_extras', productId: p.id, ...ex }, () => 'Custos do plano guardados.')}>Guardar custos do plano</button>
      </div>
    </div>
  )
}

// ── Sistemas operativos e aplicações ──
const GROUP_ICON: Record<string, any> = { linux: Server, panels: LayoutPanelLeft, automation: Workflow, ai: Bot, business: Briefcase, databases: Database, dev: Code2, containers: Boxes, other: Package }
export function TemplatesSection() {
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [q, setQ] = useState(''), [group, setGroup] = useState(''), [pub, setPub] = useState(''), [page, setPage] = useState(1), [sel, setSel] = useState<string[]>([]), [edit, setEdit] = useState<any>(null)
  const load = useCallback(() => { cvApi('templates').then(setD).catch(e => setMsg({ ok: false, t: e.message })) }, [])
  useEffect(load, [load])
  const list = useMemo(() => (d?.images ?? []).filter((i: any) => (!q || `${i.label} ${i.name}`.toLowerCase().includes(q.toLowerCase())) && (!group || i.group === group) && (!pub || (pub === 'on' ? i.enabled : !i.enabled))), [d, q, group, pub])
  const size = 15, pages = Math.max(1, Math.ceil(list.length / size)), shown = list.slice((page - 1) * size, page * size)
  const enabledIds = (d?.images ?? []).filter((i: any) => i.enabled).map((i: any) => i.id)
  const bulk = async (on: boolean) => {
    setMsg(null)
    try {
      const ids = on ? [...new Set([...enabledIds, ...sel])] : enabledIds.filter((x: string) => !sel.includes(x))
      const j = await cvPost({ action: 'templates_save', enabledImages: ids }); setD({ ...d, images: j.images }); setSel([]); setMsg({ ok: true, t: `${sel.length} item(ns) ${on ? 'publicado(s)' : 'despublicado(s)'}.` })
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }) }
  }
  if (!d) return <><Spinner /><Msg m={msg} /></>
  if (!d.images.length) return <p className={`${card} p-6 text-sm text-[#64748B]`}>Sem templates: em Fornecedores use «Testar ligação» para importar a lista real da Hostinger.</p>
  return (
    <div className="space-y-3" data-testid="cv-templates">
      <div className="flex flex-wrap gap-2 items-center">
        <input className={`${input} w-full sm:w-56`} placeholder="Pesquisar" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} data-testid="cv-tpl-search" />
        <select className={input} value={group} onChange={e => { setGroup(e.target.value); setPage(1) }} data-testid="cv-tpl-group"><option value="">Todas as categorias</option>{d.groups.map((g: any) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
        <select className={input} value={pub} onChange={e => { setPub(e.target.value); setPage(1) }} data-testid="cv-tpl-pub"><option value="">Publicados e não publicados</option><option value="on">Publicados</option><option value="off">Não publicados</option></select>
        <span className="text-xs text-[#64748B]">{list.length} de {d.images.length} · {enabledIds.length} publicado(s)</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <label className="flex items-center gap-1"><input type="checkbox" checked={shown.length > 0 && shown.every((i: any) => sel.includes(i.id))} onChange={e => setSel(e.target.checked ? [...new Set([...sel, ...shown.map((i: any) => i.id)])] : sel.filter(x => !shown.some((i: any) => i.id === x)))} data-testid="cv-tpl-select-page" />Seleccionar página</label>
        <span>{sel.length} seleccionado(s)</span>
        <button className={`${btn} bg-green-700 text-white`} disabled={!sel.length} onClick={() => bulk(true)} data-testid="cv-tpl-publish">Publicar</button>
        <button className={`${btn} border`} disabled={!sel.length} onClick={() => bulk(false)} data-testid="cv-tpl-unpublish">Despublicar</button>
      </div>
      <Msg m={msg} />
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{shown.map((i: any) => {
        const I = GROUP_ICON[i.group] ?? Package
        const unsellable = i.license.type === 'paid' && !(i.license.monthlyKz > 0)
        return (
          <li key={i.id} className={`${card} p-3 text-xs flex gap-2`} data-testid="cv-tpl" data-id={i.id} data-group={i.group} data-enabled={i.enabled ? '1' : '0'}>
            <input type="checkbox" checked={sel.includes(i.id)} onChange={e => setSel(e.target.checked ? [...sel, i.id] : sel.filter(x => x !== i.id))} data-testid="cv-tpl-check" />
            <I size={18} className="text-[#D9A300] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{i.label}</p>
              <p className="text-[#64748B]">{d.groups.find((g: any) => g.id === i.group)?.label} · {i.source === 'manual' ? 'entrega manual' : `template ${i.id}`}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge tone={i.enabled ? 'green' : 'gray'}>{i.enabled ? 'Publicado' : 'Não publicado'}</Badge>
                <Badge tone="blue">Disponível no fornecedor</Badge>
                {i.license.type === 'paid' && <Badge tone={unsellable ? 'red' : 'amber'}>{unsellable ? 'licença sem preço' : `licença ${kz(i.license.monthlyKz)}/mês`}</Badge>}
                {i.plans.length ? <Badge tone="cyan">{i.plans.length} plano(s)</Badge> : null}
              </div>
              <button className="underline mt-1" onClick={() => setEdit(i)} data-testid="cv-tpl-edit">Configurar</button>
            </div>
          </li>
        )
      })}</ul>
      <Pager page={page} pages={pages} onPage={setPage} />
      {edit && <TemplateEdit item={edit} groups={d.groups} plans={d.plans} locations={d.locations} onClose={() => setEdit(null)} onSaved={(images: any[]) => { setD({ ...d, images }); setEdit(null); setMsg({ ok: true, t: 'Guardado.' }) }} />}
    </div>
  )
}
function TemplateEdit({ item, groups, plans, locations, onClose, onSaved }: any) {
  const [f, setF] = useState({ group: item.group, category: item.category, licType: item.license.type, monthlyKz: item.license.monthlyKz ?? '', plans: item.plans as string[], locations: item.locations as string[], minRamGb: item.minRamGb ?? '', accessUrl: item.accessUrl ?? '', detail: item.detail ?? '' })
  const [err, setErr] = useState('')
  const save = async () => {
    setErr('')
    try { const j = await cvPost({ action: 'templates_save', images: [{ id: item.id, group: f.group, category: f.category, license: { type: f.licType, monthlyKz: f.licType === 'paid' ? f.monthlyKz : null }, plans: f.plans, locations: f.locations, minRamGb: f.minRamGb, accessUrl: f.accessUrl, detail: f.detail }] }); onSaved(j.images) }
    catch (e) { setErr((e as Error).message) }
  }
  const toggle = (k: 'plans' | 'locations', v: string) => setF({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] })
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" data-testid="cv-tpl-dialog">
      <div className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-2 text-xs max-h-[90vh] overflow-auto">
        <p className="font-black text-sm">{item.label}</p>
        <label className="block">Categoria do catálogo<select className={`${input} w-full`} value={f.group} onChange={e => setF({ ...f, group: e.target.value })} data-testid="cv-tpl-edit-group">{groups.map((g: any) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
        <label className="block">Tipo<select className={`${input} w-full`} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option value="os">Sistema operativo</option><option value="panel">Painel de controlo</option><option value="app">Aplicação</option></select></label>
        <div className="flex gap-2 items-end"><label>Licença<select className={input} value={f.licType} onChange={e => setF({ ...f, licType: e.target.value })} data-testid="cv-tpl-edit-lic"><option value="included">Incluída</option><option value="paid">Paga</option></select></label>
          {f.licType === 'paid' && <label>Custo adicional (Kz/mês)<input className={`${input} w-32 block`} type="number" value={f.monthlyKz} onChange={e => setF({ ...f, monthlyKz: e.target.value })} data-testid="cv-tpl-edit-price" /></label>}</div>
        <p className="font-semibold mt-1">Planos onde está disponível (nenhum = todos)</p>
        <div className="flex flex-wrap gap-2">{plans.map((p: any) => <label key={p.slug} className="flex items-center gap-1"><input type="checkbox" checked={f.plans.includes(p.slug)} onChange={() => toggle('plans', p.slug)} data-testid="cv-tpl-edit-plan" />{p.name}</label>)}</div>
        <p className="font-semibold mt-1">Centros de dados (nenhum = todos)</p>
        <div className="flex flex-wrap gap-2">{locations.map((l: any) => <label key={l.id} className="flex items-center gap-1"><input type="checkbox" checked={f.locations.includes(String(l.id))} onChange={() => toggle('locations', String(l.id))} />{l.label}</label>)}</div>
        <label className="block">RAM mínima (GB)<input className={`${input} w-24 block`} type="number" value={f.minRamGb} onChange={e => setF({ ...f, minRamGb: e.target.value })} /></label>
        <label className="block">Endereço de acesso (ex.: https://{'{ip}'}:5678)<input className={`${input} w-full`} value={f.accessUrl} onChange={e => setF({ ...f, accessUrl: e.target.value })} /></label>
        <label className="block">Descrição mostrada ao cliente<input className={`${input} w-full`} value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} /></label>
        {err && <ErrorBox msg={err} />}
        <div className="flex justify-end gap-2 pt-1"><button className={`${btn} border`} onClick={onClose}>Cancelar</button><button className={`${btn} bg-[#F5B700]`} onClick={save} data-testid="cv-tpl-edit-save">Guardar</button></div>
      </div>
    </div>
  )
}

// ── Centros de dados ──
export function DatacentersSection() {
  const [d, setD] = useState<any>(null), [sel, setSel] = useState<string[]>([]), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  useEffect(() => { cvApi('datacenters').then(j => { setD(j); setSel(j.locations.filter((l: any) => l.enabled).map((l: any) => String(l.id))) }).catch(e => setMsg({ ok: false, t: e.message })) }, [])
  const save = async () => { try { const j = await cvPost({ action: 'datacenters_save', enabledLocations: sel }); setD(j); setMsg({ ok: true, t: 'Centros de dados guardados.' }) } catch (e) { setMsg({ ok: false, t: (e as Error).message }) } }
  if (!d) return <><Spinner /><Msg m={msg} /></>
  return (
    <div className="space-y-3" data-testid="cv-datacenters">
      {d.locations.length === 0 ? <p className={`${card} p-6 text-sm text-[#64748B]`}>Sem centros de dados: use «Testar ligação» em Fornecedores.</p> : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{d.locations.map((l: any) => (
          <li key={l.id} className={`${card} p-3 text-sm flex items-center gap-2`} data-testid="cv-dc">
            <input type="checkbox" checked={sel.includes(String(l.id))} onChange={e => setSel(e.target.checked ? [...sel, String(l.id)] : sel.filter(x => x !== String(l.id)))} data-testid="cv-dc-check" />
            <div><p className="font-bold flex items-center gap-1.5"><CountryFlag code={l.country} />{l.label}</p><p className="text-xs text-[#64748B]">id {l.id}{l.detail ? ` · ${l.detail}` : ''}</p></div>
            <span className="ml-auto"><Badge tone={l.enabled ? 'green' : 'gray'}>{l.enabled ? 'Oferecido' : 'Não oferecido'}</Badge></span>
          </li>))}</ul>
      )}
      <button className={`${btn} bg-[#0A0A0A] text-white`} onClick={save} data-testid="cv-dc-save">Guardar</button>
      <Msg m={msg} />
    </div>
  )
}
