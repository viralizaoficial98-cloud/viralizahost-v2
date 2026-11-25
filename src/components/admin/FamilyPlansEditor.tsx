'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { MAX_DISCOUNT, exactPeriodTotal, impliedDiscount, selectorBadge } from '@/lib/commerce/period-pricing'
import { FAMILY_PERIODS, PLAN_FAMILIES, type PlanFamily } from '@/lib/commerce/plan-families'
import { VPS_FEATURE_ICONS, type VpsFeature, type VpsIcon } from '@/lib/commerce/vps-shared'
import { FamilyPlanCard, type FamilyCardPlan } from '@/components/service/FamilyPlansSection'

// Catálogo e Preços → planos de Revenda de Hospedagem, Criador de Sites e Construtor WordPress.
// Nome, descrição, características (ordenáveis, com ícone da lista controlada), etiqueta, destaque, ordem, estado,
// preço mensal base e desconto por período (1 mês, 1, 2 e 3 anos), publicação e renovação por período.
// Pré-visualização com a mesma regra do servidor; o servidor volta a validar e a calcular ao guardar.

type Period = { cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null; discount: number; matchesRule: boolean }
type Plan = {
  id: string; slug: string; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'; position: number; badge: string | null
  highlight: boolean; baseMonthly: number | null; baseDerived: boolean; features: VpsFeature[]; periods: Period[]; otherCycles: { cycle: string; months: number; price: number; active: boolean }[]
}
type PeriodDraft = { cycle: string; discount: string | null; publish: boolean; renewal: string }
type Draft = { id?: string; name: string; description: string; saleStatus: Plan['saleStatus']; position: string; badge: string; highlight: boolean; baseMonthly: string; features: { text: string; icon: string }[]; periods: PeriodDraft[] }

const input = 'w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#F5B700] bg-white'
const lbl = 'text-xs text-[#64748B] block'
const STATUS = { active: 'À venda', on_request: 'Sob consulta', draft: 'Rascunho (não aparece no site)' }
const RETIRED: Record<string, string> = { '3months': '3 meses', '6months': '6 meses' }
const kz = (v: number) => `Kz ${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')}`
const fmtCard = (v: number) => `${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')} Kz`

function toDraft(p?: Plan): Draft {
  return {
    id: p?.id, name: p?.name ?? '', description: p?.description ?? '', saleStatus: p?.saleStatus ?? 'draft', position: String(p?.position ?? 0),
    badge: p?.badge ?? '', highlight: p?.highlight ?? false, baseMonthly: p?.baseMonthly?.toString() ?? '',
    features: p?.features.length ? p.features.map(f => ({ text: f.text, icon: f.icon ?? '' })) : [{ text: '', icon: 'check' }],
    periods: FAMILY_PERIODS.map(per => {
      const x = p?.periods.find(y => y.cycle === per.cycle)
      // Preço que segue a regra → editável pelo desconto; preço personalizado → mantido até «Aplicar regra»
      return { cycle: per.cycle, discount: !x?.exists ? '' : x.matchesRule ? String(x.discount) : null, publish: !!x?.active, renewal: '' }
    }),
  }
}

function PlanForm({ family, plan, onSaved, onCancel }: { family: PlanFamily; plan?: Plan; onSaved: (plans: Plan[]) => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(plan))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null)
  const [previewCycle, setPreviewCycle] = useState('1year')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const base = Number(d.baseMonthly)
  const baseOk = d.baseMonthly !== '' && Number.isFinite(base) && base > 0
  const tid = (s: string) => `fp-${s}`

  const result = (i: number) => {
    const per = FAMILY_PERIODS[i], pd = d.periods[i], cur = plan?.periods.find(x => x.cycle === per.cycle)
    if (pd.discount === null) return cur?.price != null ? { total: cur.price, discount: baseOk ? impliedDiscount(cur.price, base, per.months) : cur.discount, kept: true } : null
    if (pd.discount === '' || !baseOk) return null
    const disc = Number(pd.discount)
    if (!Number.isInteger(disc) || disc < 0 || disc > MAX_DISCOUNT) return null
    return { total: exactPeriodTotal(base, per.months, disc), discount: disc, kept: false }
  }
  const renewalOf = (i: number) => d.periods[i].renewal !== '' ? Number(d.periods[i].renewal) : plan?.periods[i]?.renewal ?? (baseOk ? exactPeriodTotal(base, FAMILY_PERIODS[i].months, 0) : null)
  const previewPlan: FamilyCardPlan = {
    slug: plan?.slug ?? 'novo', name: d.name || 'Nome do plano', description: d.description || null, badge: d.badge || null, highlight: d.highlight,
    onRequest: d.saleStatus === 'on_request', base: baseOk ? base : null,
    features: d.features.filter(f => f.text.trim()).map(f => ({ text: f.text, icon: (f.icon || null) as VpsIcon | null })),
    periods: FAMILY_PERIODS.map((per, i) => { const r = result(i); return r ? { cycle: per.cycle, months: per.months, total: r.total, renewal: renewalOf(i) ?? r.total, discount: r.discount } : null }).filter(Boolean) as FamilyCardPlan['periods'],
  }
  const pi = FAMILY_PERIODS.findIndex(p => p.cycle === previewCycle)
  const pr = result(pi)
  const setPeriod = (i: number, p: Partial<PeriodDraft>) => set('periods', d.periods.map((x, k) => k === i ? { ...x, ...p } : x))
  const mvFeat = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= d.features.length) return; const f = [...d.features];[f[i], f[j]] = [f[j], f[i]]; set('features', f) }

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const body = {
        id: d.id, name: d.name, description: d.description, saleStatus: d.saleStatus, position: d.position, badge: d.badge, highlight: d.highlight, baseMonthly: d.baseMonthly,
        features: d.features.filter(f => f.text.trim()).map(f => ({ text: f.text, icon: f.icon || null })),
        periods: d.periods.map(p => ({ cycle: p.cycle, discount: p.discount === null ? null : p.discount === '' ? (p.publish ? '' : null) : p.discount, publish: p.publish, renewal: p.renewal === '' ? null : p.renewal })),
      }
      const res = await fetch(`/api/admin/catalog/family-plans?family=${family}`, { method: d.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: j.error ?? `HTTP ${res.status}`, field: j.field ?? undefined }); return }
      setMsg({ ok: true, text: d.id ? 'Guardado' : 'Plano criado' })
      if (!d.id) setD(toDraft())
      onSaved(j.plans)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  const bad = (f: string) => msg && !msg.ok && msg.field === f ? 'border-red-400 ring-1 ring-red-200' : ''

  return (
    <div className="px-4 pb-4 grid xl:grid-cols-[1fr_320px] gap-5" data-testid="fp-form">
      <div className="space-y-5 min-w-0">
        <fieldset className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className={`${lbl} sm:col-span-2`}>Nome do plano<input className={`${input} ${bad('name')}`} maxLength={80} value={d.name} onChange={e => set('name', e.target.value)} data-testid={tid('name')} /></label>
          <label className={lbl}>Estado<select className={input} value={d.saleStatus} onChange={e => set('saleStatus', e.target.value as Plan['saleStatus'])} data-testid={tid('status')}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className={lbl}>Ordem<input type="number" min={0} max={9999} className={`${input} ${bad('position')}`} value={d.position} onChange={e => set('position', e.target.value)} data-testid={tid('position')} /></label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-4`}>Descrição curta<input className={input} maxLength={160} value={d.description} onChange={e => set('description', e.target.value)} data-testid={tid('description')} /></label>
          <label className={lbl}>Etiqueta (opcional)<input className={input} maxLength={24} placeholder="ex.: Mais popular" value={d.badge} onChange={e => set('badge', e.target.value)} data-testid={tid('badge')} /></label>
          <label className="text-xs text-[#334155] flex items-center gap-2 pt-4"><input type="checkbox" checked={d.highlight} onChange={e => set('highlight', e.target.checked)} data-testid={tid('highlight')} /> Destaque visual (cartão escuro)</label>
        </fieldset>

        <div>
          <p className="text-xs font-bold text-[#334155] mb-1">Características (pela ordem do cartão)</p>
          <ul className="space-y-1.5">
            {d.features.map((f, i) => (
              <li key={i} className="flex gap-1.5 items-center" data-testid={tid('feature')}>
                <select className={`${input} w-44`} value={f.icon} onChange={e => set('features', d.features.map((x, k) => k === i ? { ...x, icon: e.target.value } : x))} aria-label={`Ícone da característica ${i + 1}`} data-testid={tid('feature-icon')}>
                  <option value="">(sem ícone)</option>{Object.entries(VPS_FEATURE_ICONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input className={`${input} ${bad('features')}`} maxLength={120} value={f.text} onChange={e => set('features', d.features.map((x, k) => k === i ? { ...x, text: e.target.value } : x))} aria-label={`Característica ${i + 1}`} data-testid={tid('feature-text')} />
                <button type="button" onClick={() => mvFeat(i, -1)} disabled={i === 0} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Subir" data-testid={tid('feature-up')}><ArrowUp size={14} /></button>
                <button type="button" onClick={() => mvFeat(i, 1)} disabled={i === d.features.length - 1} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Descer" data-testid={tid('feature-down')}><ArrowDown size={14} /></button>
                <button type="button" onClick={() => set('features', d.features.filter((_, k) => k !== i))} className="p-1.5 rounded border border-[#E5E7EB] text-red-600" aria-label="Remover"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => set('features', [...d.features, { text: '', icon: 'check' }])} className="mt-1.5 text-xs font-bold inline-flex items-center gap-1" data-testid={tid('add-feature')}><Plus size={12} /> Acrescentar característica</button>
        </div>

        <div>
          <div className="flex flex-wrap items-end gap-3 mb-2">
            <label className={`${lbl} w-56`}>Preço mensal base (Kz){d.saleStatus === 'on_request' ? ' — opcional' : ''}<input type="number" min={1} step="0.01" className={`${input} ${bad('baseMonthly')}`} value={d.baseMonthly} onChange={e => set('baseMonthly', e.target.value)} data-testid={tid('base')} /></label>
            <p className="text-[11px] text-[#64748B] flex-1 min-w-[220px]">Total = base × meses × (1 − desconto/100), arredondado ao cêntimo; equivalente mensal = total ÷ meses. Novas contratações só em 1 mês, 1 ano, 2 anos e 3 anos; só os períodos «Publicado» aparecem no site.
              {plan?.baseDerived && <strong className="block text-[#334155]" data-testid={tid('base-derived')}>Preço base ainda não guardado: proposto a partir do preço de 1 mês ({kz(plan.baseMonthly ?? 0)}). Fica guardado ao gravar.</strong>}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-1">Período</th><th>Publicado</th><th>Desconto %</th><th>Total</th><th>Equivalente/mês</th><th>Actual</th><th>Renovação (Kz)</th></tr></thead>
              <tbody>
                {FAMILY_PERIODS.map((per, i) => {
                  const pd = d.periods[i], cur = plan?.periods[i], r = result(i)
                  const changed = r && cur?.price != null && Math.round(r.total * 100) !== Math.round(cur.price * 100)
                  return (
                    <tr key={per.cycle} className="border-t border-[#F1F5F9] align-top" data-testid={tid(`period-${per.cycle}`)}>
                      <td className="py-2 pr-2 font-semibold whitespace-nowrap">{per.label}{!cur?.exists && <span className="block text-[10px] font-bold text-amber-700">por configurar</span>}</td>
                      <td className="pr-2 pt-2"><input type="checkbox" checked={pd.publish} onChange={e => setPeriod(i, { publish: e.target.checked })} aria-label={`Publicar ${per.label}`} data-testid={tid(`publish-${per.cycle}`)} /></td>
                      <td className="pr-2 w-28">
                        {pd.discount === null ? (
                          <div className="text-[11px] text-[#475569]" data-testid={tid(`kept-${per.cycle}`)}>Preço personalizado mantido{r ? ` (≈${r.discount}%)` : ''}
                            <button type="button" className="block underline font-bold text-[#0B0B0D]" onClick={() => setPeriod(i, { discount: String(r?.discount ?? 0) })} data-testid={tid(`apply-${per.cycle}`)}>Aplicar regra</button></div>
                        ) : <input type="number" min={0} max={MAX_DISCOUNT} step={1} className={`${input} ${bad(`discount-${per.cycle}`)}`} value={pd.discount} onChange={e => setPeriod(i, { discount: e.target.value })} aria-label={`Desconto ${per.label}`} data-testid={tid(`discount-${per.cycle}`)} />}
                      </td>
                      <td className="pr-2 pt-2 font-bold whitespace-nowrap" data-testid={tid(`total-${per.cycle}`)}>{r ? kz(r.total) : '—'}</td>
                      <td className="pr-2 pt-2 whitespace-nowrap" data-testid={tid(`monthly-${per.cycle}`)}>{r ? <>{r.discount > 0 && baseOk && <s className="text-[#94A3B8] mr-1">{kz(base)}</s>}{kz(r.total / per.months)}</> : '—'}</td>
                      <td className={`pr-2 pt-2 whitespace-nowrap text-xs ${changed ? 'text-amber-700 font-bold' : 'text-[#64748B]'}`}>{cur?.price != null ? `${kz(cur.price)}${changed ? ' → muda' : ''}` : '—'}</td>
                      <td className="pr-2 w-36"><input type="number" min={0} step="0.01" className={`${input} ${bad(`renewal-${per.cycle}`)}`} value={pd.renewal} placeholder={cur?.renewal != null ? `actual: ${cur.renewal}` : baseOk ? `${exactPeriodTotal(base, per.months, 0)}` : ''} onChange={e => setPeriod(i, { renewal: e.target.value })} aria-label={`Renovação ${per.label}`} data-testid={tid(`renewal-${per.cycle}`)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {plan?.otherCycles.length ? <p className="text-[11px] text-[#64748B] mt-1" data-testid={tid('other-cycles')}>Ciclos retirados para novas contratações (mantidos para contratos, facturas e renovações existentes): {plan.otherCycles.map(c => `${RETIRED[c.cycle] ?? c.cycle} ${kz(c.price)}`).join(' · ')}.</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#F5B700] disabled:opacity-50" data-testid={tid('save')}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {d.id ? 'Guardar plano' : 'Criar plano'}</button>
          {onCancel && <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB]">Cancelar</button>}
          {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status" data-testid={tid('msg')}>{msg.text}</span>}
        </div>
      </div>

      <aside className="xl:sticky xl:top-4 self-start" data-testid={tid('preview')}>
        <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B] mb-2">Pré-visualização (antes de guardar)</p>
        <div className="flex gap-1 mb-2 flex-wrap" role="radiogroup" aria-label="Período da pré-visualização">
          {FAMILY_PERIODS.map(per => <button key={per.cycle} type="button" role="radio" aria-checked={previewCycle === per.cycle} onClick={() => setPreviewCycle(per.cycle)} data-testid={tid(`preview-${per.cycle}`)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${previewCycle === per.cycle ? 'bg-[#F5B700] border-[#F5B700]' : 'bg-white border-[#E5E7EB]'}`}>{per.label}</button>)}
        </div>
        {pr && <p className="text-xs text-[#334155] mb-3" data-testid={tid('preview-summary')}>Total a pagar no período: <strong>{kz(pr.total)}</strong> · equivalente mensal <strong>{kz(pr.total / FAMILY_PERIODS[pi].months)}</strong></p>}
        <div className="pt-3"><FamilyPlanCard plan={previewPlan} cycle={previewCycle} fmt={fmtCard} preview /></div>
        {!d.periods[pi].publish && d.saleStatus !== 'on_request' && <p className="text-[11px] text-amber-700 mt-2">Este período não está publicado: não aparece no site.</p>}
      </aside>
    </div>
  )
}

export function FamilyPlansEditor({ family, onSaved }: { family: PlanFamily; onSaved?: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    fetch(`/api/admin/catalog/family-plans?family=${family}`, { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setPlans(j.plans) }).catch(e => setError(e.message))
  }, [family])
  useEffect(load, [load])
  const saved = (list: Plan[]) => { setPlans(list); setCreating(false); onSaved?.() }
  const summary = useMemo(() => FAMILY_PERIODS.map(per => {
    const ds = (plans ?? []).filter(p => p.saleStatus === 'active').map(p => ({ p, x: p.periods.find(y => y.cycle === per.cycle) })).filter(({ x }) => x?.active && x.price != null)
      .map(({ p, x }) => impliedDiscount(x!.price!, p.baseMonthly, per.months))
    return `${per.label}${ds.length ? (selectorBadge(ds) ? ` (${selectorBadge(ds)})` : '') : ' (não publicado)'}`
  }), [plans])

  if (error) return <p className="text-red-600 text-sm" role="alert">{error}</p>
  if (!plans) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  return (
    <div className="space-y-2" data-testid={`fp-editor-${family}`}>
      <p className="text-xs text-[#64748B]">Página: <a className="underline" href={PLAN_FAMILIES[family].page} target="_blank" rel="noreferrer">{PLAN_FAMILIES[family].page}</a> · Selector no site: {summary.join(' · ')}</p>
      {plans.map(p => (
        <details key={`${p.id}-${p.position}-${p.name}`} className="rounded-xl border border-[#E5E7EB] bg-white" data-testid="fp-plan" data-slug={p.slug}>
          <summary className="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-3">
            <span className="text-xs text-[#94A3B8] font-mono">#{p.position}</span>
            <span className="font-bold text-[#0B0B0D]">{p.name}</span>
            {p.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F5B700] text-black">{p.badge}</span>}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.saleStatus === 'active' ? 'bg-green-50 text-green-700' : p.saleStatus === 'on_request' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{STATUS[p.saleStatus].split(' (')[0]}</span>
            <span className="ml-auto text-sm text-[#334155]">{p.baseMonthly != null ? `${kz(p.baseMonthly)}/mês` : 'sem preço base'} · {p.periods.map(x => x.active ? `${impliedDiscount(x.price ?? 0, p.baseMonthly, x.months)}%` : '—').join(' / ')}</span>
          </summary>
          <PlanForm family={family} plan={p} onSaved={saved} />
        </details>
      ))}
      {creating ? (
        <div className="rounded-xl border-2 border-dashed border-[#F5B700] bg-white pt-4" data-testid="fp-new">
          <p className="px-4 pb-2 font-bold text-sm">Novo plano — {PLAN_FAMILIES[family].label}</p>
          <PlanForm family={family} onSaved={saved} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB] bg-white" data-testid="fp-create"><Plus size={14} /> Novo plano</button>
      )}
    </div>
  )
}
