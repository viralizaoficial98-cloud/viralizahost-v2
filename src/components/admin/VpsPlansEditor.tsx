'use client'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Info, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { MAX_DISCOUNT, exactPeriodTotal, impliedDiscount } from '@/lib/commerce/period-pricing'
import { TRAFFIC_UNITS, VPS_CYCLES, VPS_FEATURE_ICONS, compareSpecs, formatRaw, formatTrafficGb, type ProviderSpecs, type TrafficUnit, type VpsFeature, type VpsIcon, type VpsSpecs } from '@/lib/commerce/vps-shared'
import { VpsPlanBand, type VpsBandPlan } from '@/components/service/VpsPlansSection'

// Catálogo e Preços → VPS: criar, editar, ordenar, publicar/despublicar; ficha, imagem, características com ícone,
// preço base e desconto por ciclo (pré-visualização da faixa, total e renovação) e associação ao produto Hostinger
// (custo do fornecedor e limite de custo por ciclo, separados do preço de venda em Kz). O servidor valida tudo.

type Period = { cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null; discount: number; matchesRule: boolean
  providerItemId: string | null; providerCostMinor: number | null; providerCurrency: string | null; providerCostLimitMinor: number | null }
type Plan = { id: string; slug: string; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'; position: number; badge: string | null; highlight: boolean
  baseMonthly: number | null; imageUrl: string | null; specs: VpsSpecs; features: VpsFeature[]; providerProductId: string | null; providerMode: 'auto' | 'manual'
  providerSpecs: ProviderSpecs | null; specWarnings: string[]; specUnverified?: string[]; periods: Period[] }
type ProviderItem = { id: string; name: string; specs: ProviderSpecs | null; prices: { id: string; currency: string; price: number; first_period_price?: number | null; period: number; period_unit: string }[] }
type PD = { cycle: string; discount: string | null; publish: boolean; renewal: string; providerItemId: string; providerCost: string; providerCurrency: string; providerLimit: string }
type Draft = { id?: string; name: string; description: string; saleStatus: Plan['saleStatus']; position: string; badge: string; highlight: boolean; baseMonthly: string
  vcpu: string; ramGb: string; diskGb: string; diskType: '' | 'NVMe' | 'SSD'; trafficMode: '' | 'value' | 'unlimited'; trafficValue: string; trafficUnit: TrafficUnit
  networkValue: string; networkUnit: 'Mbps' | 'Gbps'; features: { text: string; icon: VpsIcon | '' }[]
  providerProductId: string; providerMode: 'manual' | 'auto'; providerSpecs: ProviderSpecs | null; providerSpecsConfirmed: boolean; periods: PD[] }

const input = 'w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#F5B700] bg-white'
const lbl = 'text-xs text-[#64748B] block'
const field = input.replace('w-full', 'min-w-0')   // para campos lado a lado (flex)
const kz = (v: number) => `${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')} Kz`
const money = (minor: number, cur: string) => `${(minor / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} ${cur}`
const BADGES = ['Mais popular', 'Disponibilidade limitada', 'Melhor valor', 'Novo']
const STATUS = { active: 'Publicado', draft: 'Rascunho (não publicado)', on_request: 'Sob consulta' }
const monthsOf = (p: { period: number; period_unit: string }) => p.period_unit === 'year' ? p.period * 12 : p.period_unit === 'month' ? p.period : 0

function toDraft(p?: Plan): Draft {
  const s = p?.specs ?? {}, t = s.traffic
  return {
    id: p?.id, name: p?.name ?? '', description: p?.description ?? '', saleStatus: p?.saleStatus ?? 'draft', position: String(p?.position ?? 0), badge: p?.badge ?? '', highlight: p?.highlight ?? false,
    baseMonthly: p?.baseMonthly?.toString() ?? '', vcpu: s.vcpu?.toString() ?? '', ramGb: s.ramGb?.toString() ?? '', diskGb: s.diskGb?.toString() ?? '', diskType: s.diskType ?? '',
    trafficMode: !t ? '' : 'unlimited' in t ? 'unlimited' : 'value', trafficValue: t && 'value' in t ? String(t.value) : '', trafficUnit: t && 'unit' in t ? t.unit : 'TB',
    networkValue: s.network?.value?.toString() ?? '', networkUnit: s.network?.unit ?? 'Gbps',
    features: p?.features.length ? p.features.map(f => ({ text: f.text, icon: f.icon ?? '' })) : [{ text: '', icon: 'check' }],
    providerProductId: p?.providerProductId ?? '', providerMode: p?.providerMode ?? 'manual', providerSpecs: p?.providerSpecs ?? null, providerSpecsConfirmed: false,
    periods: VPS_CYCLES.map(c => {
      const x = p?.periods.find(y => y.cycle === c.cycle)
      return { cycle: c.cycle, discount: !x?.exists ? '' : x.matchesRule ? String(x.discount) : null, publish: !!x?.active, renewal: '',
        providerItemId: x?.providerItemId ?? '', providerCost: x?.providerCostMinor?.toString() ?? '', providerCurrency: x?.providerCurrency ?? '', providerLimit: x?.providerCostLimitMinor?.toString() ?? '' }
    }),
  }
}
function specsOut(d: Draft) {
  return { vcpu: d.vcpu, ramGb: d.ramGb, diskGb: d.diskGb, diskType: d.diskType || null,
    traffic: d.trafficMode === 'unlimited' ? { unlimited: true } : d.trafficMode === 'value' ? { value: d.trafficValue, unit: d.trafficUnit } : null,
    network: d.networkValue ? { value: d.networkValue, unit: d.networkUnit } : null }
}
function specsPreview(d: Draft): VpsSpecs {
  const n = (v: string) => (v === '' ? null : Number(v))
  return { vcpu: n(d.vcpu), ramGb: n(d.ramGb), diskGb: n(d.diskGb), diskType: d.diskType || null,
    traffic: d.trafficMode === 'unlimited' ? { unlimited: true } : d.trafficMode === 'value' && d.trafficValue ? { value: Number(d.trafficValue), unit: d.trafficUnit } : null,
    network: d.networkValue ? { value: Number(d.networkValue), unit: d.networkUnit } : null }
}

function PlanForm({ plan, provider, onSaved, onCancel }: { plan?: Plan; provider: { error?: string; items: ProviderItem[] } | null; onSaved: (plans: Plan[]) => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(plan))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null)
  const [previewCycle, setPreviewCycle] = useState(() => plan?.periods.find(p => p.active)?.cycle ?? 'monthly')
  const [image, setImage] = useState<string | null>(plan?.imageUrl ?? null)
  const [imgMsg, setImgMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const setP = (i: number, p: Partial<PD>) => set('periods', d.periods.map((x, k) => k === i ? { ...x, ...p } : x))
  const base = Number(d.baseMonthly), baseOk = Number.isFinite(base) && base > 0
  const item = provider?.items.find(x => x.id === d.providerProductId) ?? null
  const pSpecs = item?.specs ?? d.providerSpecs
  // Mesma regra do servidor (compareSpecs): automático bloqueia divergências; manual grava com aviso
  const { mismatches, unverified } = d.providerProductId ? compareSpecs(specsPreview(d), pSpecs) : { mismatches: [] as string[], unverified: [] as string[] }
  const auto = d.providerMode === 'auto'

  const result = (i: number) => {
    const c = VPS_CYCLES[i], pd = d.periods[i], cur = plan?.periods.find(x => x.cycle === c.cycle)
    if (pd.discount === null) return cur?.price != null ? { total: cur.price, discount: baseOk ? impliedDiscount(cur.price, base, c.months) : cur.discount, kept: true } : null
    if (pd.discount === '' || !baseOk) return null
    const disc = Number(pd.discount)
    if (!Number.isInteger(disc) || disc < 0 || disc > MAX_DISCOUNT) return null
    return { total: exactPeriodTotal(base, c.months, disc), discount: disc, kept: false }
  }
  const renewalOf = (i: number) => d.periods[i].renewal !== '' ? Number(d.periods[i].renewal) : plan?.periods[i]?.renewal ?? (baseOk ? exactPeriodTotal(base, VPS_CYCLES[i].months, 0) : null)
  const pi = VPS_CYCLES.findIndex(c => c.cycle === previewCycle), pr = result(pi)
  const preview: VpsBandPlan = { slug: plan?.slug ?? 'novo', name: d.name || 'Nome do plano', summary: d.description || null, badge: d.badge || null, highlight: d.highlight, imageUrl: image,
    specs: specsPreview(d), features: d.features.filter(f => f.text.trim()).map(f => ({ text: f.text, icon: f.icon || null })), base: baseOk ? base : null,
    period: pr ? { cycle: previewCycle, months: VPS_CYCLES[pi].months, label: VPS_CYCLES[pi].label, total: pr.total, renewal: renewalOf(pi), discount: pr.discount } : null }

  // Ao escolher o produto da Hostinger: preenche os itens de preço por ciclo com o custo actual do catálogo
  const chooseProduct = (id: string) => {
    const it = provider?.items.find(x => x.id === id)
    setD(x => ({ ...x, providerProductId: id, providerSpecs: it?.specs ?? null, periods: x.periods.map((p, i) => {
      const pr = it?.prices.find(z => monthsOf(z) === VPS_CYCLES[i].months)
      if (!pr) return { ...p, providerItemId: '', providerCost: '', providerCurrency: '' }
      const cost = pr.first_period_price ?? pr.price
      return { ...p, providerItemId: pr.id, providerCost: String(cost), providerCurrency: pr.currency, providerLimit: p.providerLimit || String(Math.ceil(cost * 1.1)) }
    }) }))
  }

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const body = {
        id: d.id, name: d.name, description: d.description, saleStatus: d.saleStatus, position: d.position, badge: d.badge, highlight: d.highlight, baseMonthly: d.baseMonthly,
        specs: specsOut(d), features: d.features.filter(f => f.text.trim()).map(f => ({ text: f.text, icon: f.icon || null })),
        providerProductId: d.providerProductId || null, providerMode: d.providerMode, providerSpecs: pSpecs, providerSpecsConfirmed: d.providerSpecsConfirmed,
        periods: d.periods.map(p => ({ cycle: p.cycle, discount: p.discount === null ? null : p.discount === '' ? (p.publish ? '' : null) : p.discount, publish: p.publish, renewal: p.renewal === '' ? null : p.renewal,
          providerItemId: p.providerItemId, providerCostMinor: p.providerCost, providerCurrency: p.providerCurrency, providerCostLimitMinor: p.providerLimit })),
      }
      const res = await fetch('/api/admin/catalog/vps-plans', { method: d.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: j.error ?? `HTTP ${res.status}`, field: j.field ?? undefined }); return }
      const sv = (j.plans as Plan[] | undefined)?.find(x => x.id === j.id)
      setMsg({ ok: true, text: `${d.id ? 'Guardado' : 'Plano criado'}${sv?.specWarnings.length ? ' — com avisos de características (modo manual)' : ''}` })
      onSaved(j.plans)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f || !plan) return
    setImgMsg(null)
    const fd = new FormData(); fd.append('productId', plan.id); fd.append('file', f)
    const res = await fetch('/api/admin/catalog/vps-plans/image', { method: 'POST', body: fd }); const j = await res.json()
    if (!res.ok) setImgMsg(j.error ?? 'Falhou.'); else { setImage(j.imageUrl); setImgMsg('Imagem guardada.') }
  }
  async function removeImage() {
    if (!plan || !window.confirm('Remover a imagem do plano?')) return
    const res = await fetch(`/api/admin/catalog/vps-plans/image?productId=${plan.id}`, { method: 'DELETE' })
    if (res.ok) { setImage(null); setImgMsg('Imagem removida.') }
  }
  const bad = (f: string) => msg && !msg.ok && msg.field === f ? 'border-red-400 ring-1 ring-red-200' : ''
  const mvF = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= d.features.length) return; const f = [...d.features];[f[i], f[j]] = [f[j], f[i]]; set('features', f) }

  return (
    <div className="px-4 pb-4 space-y-5" data-testid="vps-plan-form">
      <fieldset className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className={`${lbl} sm:col-span-2`}>Nome<input className={`${input} ${bad('name')}`} maxLength={80} value={d.name} onChange={e => set('name', e.target.value)} data-testid="vp-name" /></label>
        <label className={lbl}>Etiqueta (opcional)<input className={input} list="vps-badges" maxLength={32} value={d.badge} onChange={e => set('badge', e.target.value)} data-testid="vp-badge" /><datalist id="vps-badges">{BADGES.map(b => <option key={b} value={b} />)}</datalist></label>
        <label className={lbl}>Ordem<input type="number" min={0} className={input} value={d.position} onChange={e => set('position', e.target.value)} data-testid="vp-position" /></label>
        <label className={`${lbl} sm:col-span-2 lg:col-span-3`}>Resumo<input className={input} maxLength={200} value={d.description} onChange={e => set('description', e.target.value)} data-testid="vp-summary" /></label>
        <label className={lbl}>Estado<select className={input} value={d.saleStatus} onChange={e => set('saleStatus', e.target.value as Plan['saleStatus'])} data-testid="vp-status">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-xs text-[#334155] flex items-center gap-2"><input type="checkbox" checked={d.highlight} onChange={e => set('highlight', e.target.checked)} data-testid="vp-highlight" /> Destaque visual</label>
      </fieldset>

      <div>
        <p className="text-xs font-bold text-[#334155] mb-2">Especificações (com ícone na página)</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className={lbl}>vCPU<input type="number" min={1} className={`${input} ${bad('vcpu')}`} value={d.vcpu} onChange={e => set('vcpu', e.target.value)} data-testid="vp-vcpu" /></label>
          <label className={lbl}>RAM (GB)<input type="number" min={0.5} step="0.5" className={`${input} ${bad('ramGb')}`} value={d.ramGb} onChange={e => set('ramGb', e.target.value)} data-testid="vp-ram" /></label>
          <label className={lbl}>Disco (GB)<input type="number" min={1} className={`${input} ${bad('diskGb')}`} value={d.diskGb} onChange={e => set('diskGb', e.target.value)} data-testid="vp-disk" /></label>
          <label className={lbl}>Tipo de disco<select className={input} value={d.diskType} onChange={e => set('diskType', e.target.value as Draft['diskType'])} data-testid="vp-disk-type"><option value="">—</option><option>NVMe</option><option>SSD</option></select></label>
          <div className={`${lbl} lg:col-span-2`}>Tráfego
            <div className="flex gap-1">
              <select className={`${field} ${bad('traffic')} w-32 shrink-0`} value={d.trafficMode} onChange={e => set('trafficMode', e.target.value as Draft['trafficMode'])} data-testid="vp-traffic-mode"><option value="">—</option><option value="value">Limite</option><option value="unlimited">Ilimitado</option></select>
              {d.trafficMode === 'value' && <><input type="number" min={1} className={`${field} flex-1`} value={d.trafficValue} onChange={e => set('trafficValue', e.target.value)} data-testid="vp-traffic" /><select className={`${field} w-20 shrink-0`} value={d.trafficUnit} onChange={e => set('trafficUnit', e.target.value as TrafficUnit)} data-testid="vp-traffic-unit" title="GB/TB: decimais (1 TB = 1000 GB) · GiB/TiB: binárias (1 TiB = 1024 GiB)">{TRAFFIC_UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select></>}
            </div>
          </div>
          <div className={`${lbl} lg:col-span-2`}>Velocidade de rede
            <div className="flex gap-1"><input type="number" min={1} className={`${field} ${bad('network')} flex-1`} value={d.networkValue} onChange={e => set('networkValue', e.target.value)} data-testid="vp-network" /><select className={`${field} w-24 shrink-0`} value={d.networkUnit} onChange={e => set('networkUnit', e.target.value as 'Mbps' | 'Gbps')}><option>Mbps</option><option>Gbps</option></select></div>
          </div>
        </div>
        {d.trafficMode === 'unlimited' && <p className="text-[11px] text-amber-800 mt-1">Use «Ilimitado» só se o pacote da Hostinger o oferecer de facto (validado contra o produto associado).</p>}
      </div>

      <div>
        <p className="text-xs font-bold text-[#334155] mb-1">Características extras (ícone da lista permitida)</p>
        <ul className="space-y-1.5">
          {d.features.map((f, i) => (
            <li key={i} className="flex gap-1.5 items-center" data-testid="vp-feature">
              <select className={`${input} w-44`} value={f.icon} onChange={e => set('features', d.features.map((x, k) => k === i ? { ...x, icon: e.target.value as VpsIcon } : x))} aria-label="Ícone" data-testid="vp-feature-icon">
                <option value="">(sem ícone)</option>{Object.entries(VPS_FEATURE_ICONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className={input} maxLength={120} value={f.text} onChange={e => set('features', d.features.map((x, k) => k === i ? { ...x, text: e.target.value } : x))} aria-label={`Característica ${i + 1}`} data-testid="vp-feature-text" />
              <button type="button" onClick={() => mvF(i, -1)} disabled={i === 0} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Subir"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => mvF(i, 1)} disabled={i === d.features.length - 1} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Descer"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => set('features', d.features.filter((_, k) => k !== i))} className="p-1.5 rounded border border-[#E5E7EB] text-red-600" aria-label="Remover"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        {d.features.length < 20 && <button type="button" onClick={() => set('features', [...d.features, { text: '', icon: 'check' }])} className="mt-1.5 text-xs font-bold inline-flex items-center gap-1" data-testid="vp-add-feature"><Plus size={12} /> Acrescentar</button>}
      </div>

      {plan && (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="vp-image">
          <span className="font-bold text-[#334155]">Imagem:</span> {image ? 'carregada' : 'sem imagem (ícone de servidor)'}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} data-testid="vp-image-input" />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#E5E7EB]"><ImagePlus size={12} /> {image ? 'Substituir' : 'Carregar'} (PNG/JPEG/WebP, 2 MB)</button>
          {image && <button type="button" onClick={removeImage} className="px-2 py-1 rounded border border-red-200 text-red-700">Remover</button>}
          {imgMsg && <span role="status">{imgMsg}</span>}
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-end gap-3 mb-2">
          <label className={`${lbl} w-56`}>Preço mensal base (Kz)<input type="number" min={1} step="0.01" className={`${input} ${bad('baseMonthly')}`} value={d.baseMonthly} onChange={e => set('baseMonthly', e.target.value)} data-testid="vp-base" /></label>
          <p className="text-[11px] text-[#64748B] flex-1 min-w-[220px]">Total = base × meses × (1 − desconto/100), ao cêntimo. Só os ciclos «Publicado» aparecem no site. O preço de venda em Kz é da ViralizaHost; o custo do fornecedor fica à parte.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-1">Ciclo</th><th>Publicado</th><th>Desconto %</th><th>Total</th><th>/mês</th><th>Renovação (Kz)</th><th>Item Hostinger</th><th>Custo (mín.)</th><th>Moeda</th><th>Limite (mín.)</th></tr></thead>
            <tbody>
              {VPS_CYCLES.map((c, i) => (<Fragment key={c.cycle}>{(() => {
                const pd = d.periods[i], r = result(i), cur = plan?.periods[i]
                const items = item?.prices.filter(z => monthsOf(z) === c.months) ?? []
                // Dados em falta para activação automática deste ciclo (o item tem de ser do MESMO período)
                const missing = d.providerProductId ? [
                  !pd.providerItemId && (item && !items.length ? `sem item de ${c.months} mês(es) no catálogo da Hostinger` : 'item de preço'),
                  pd.providerCost === '' && 'custo', !pd.providerCurrency && 'moeda', pd.providerLimit === '' && 'limite'].filter(Boolean) as string[] : []
                const blocked = d.providerMode === 'auto' && missing.length > 0
                return (<>
                  <tr className="border-t border-[#F1F5F9] align-top" data-testid={`vp-period-${c.cycle}`}>
                    <td className="py-2 pr-2 font-semibold whitespace-nowrap">{c.label}</td>
                    <td className="pt-2"><input type="checkbox" checked={pd.publish} disabled={blocked && !pd.publish} onChange={e => setP(i, { publish: e.target.checked })} aria-label={`Publicar ${c.label}`} data-testid={`vp-publish-${c.cycle}`}
                      title={blocked ? 'Em activação automática só se publica com item do mesmo período, custo, moeda e limite' : undefined} /></td>
                    <td className="pr-2 w-24">{pd.discount === null
                      ? <span className="text-[11px]">Preço mantido{r ? ` (≈${r.discount}%)` : ''} <button type="button" className="underline font-bold" onClick={() => setP(i, { discount: String(r?.discount ?? 0) })}>Aplicar regra</button></span>
                      : <input type="number" min={0} max={MAX_DISCOUNT} className={`${input} ${bad(`discount-${c.cycle}`)}`} value={pd.discount} onChange={e => setP(i, { discount: e.target.value })} aria-label={`Desconto ${c.label}`} data-testid={`vp-discount-${c.cycle}`} />}</td>
                    <td className="pr-2 pt-2 font-bold whitespace-nowrap" data-testid={`vp-total-${c.cycle}`}>{r ? kz(r.total) : '—'}</td>
                    <td className="pr-2 pt-2 whitespace-nowrap text-xs">{r ? kz(r.total / c.months) : '—'}</td>
                    <td className="pr-2 w-32"><input type="number" min={0} step="0.01" className={input} value={pd.renewal} placeholder={cur?.renewal != null ? String(cur.renewal) : baseOk ? String(exactPeriodTotal(base, c.months, 0)) : ''} onChange={e => setP(i, { renewal: e.target.value })} aria-label={`Renovação ${c.label}`} /></td>
                    <td className="pr-2 w-56">{items.length
                      ? <select className={`${input} ${bad(`provider-${c.cycle}`)}`} value={pd.providerItemId} onChange={e => { const z = items.find(x => x.id === e.target.value); setP(i, { providerItemId: e.target.value, providerCost: z ? String(z.first_period_price ?? z.price) : pd.providerCost, providerCurrency: z?.currency ?? pd.providerCurrency }) }} data-testid={`vp-item-${c.cycle}`}>
                          <option value="">—</option>{items.map(z => <option key={z.id} value={z.id}>{z.id} · {money(z.first_period_price ?? z.price, z.currency)}</option>)}</select>
                      : <input className={`${input} ${bad(`provider-${c.cycle}`)} font-mono text-xs`} value={pd.providerItemId} placeholder={d.providerProductId ? 'sem item com este período' : '—'} onChange={e => setP(i, { providerItemId: e.target.value })} data-testid={`vp-item-${c.cycle}`} />}</td>
                    <td className="pr-2 w-24"><input type="number" min={0} className={input} value={pd.providerCost} onChange={e => setP(i, { providerCost: e.target.value })} aria-label={`Custo ${c.label}`} data-testid={`vp-cost-${c.cycle}`} /></td>
                    <td className="pr-2 w-16"><input className={input} maxLength={3} value={pd.providerCurrency} onChange={e => setP(i, { providerCurrency: e.target.value.toUpperCase() })} aria-label={`Moeda ${c.label}`} /></td>
                    <td className="w-24"><input type="number" min={0} className={input} value={pd.providerLimit} onChange={e => setP(i, { providerLimit: e.target.value })} aria-label={`Limite ${c.label}`} data-testid={`vp-limit-${c.cycle}`} /></td>
                  </tr>
                  {missing.length > 0 && (
                    <tr data-testid={`vp-missing-${c.cycle}`} data-blocked={blocked ? '1' : '0'}>
                      <td />
                      <td colSpan={9} className={`pb-2 text-[11px] ${blocked && pd.publish ? 'text-red-700 font-bold' : 'text-amber-800'}`}>
                        Falta para activação automática: {missing.join(', ')}.{' '}
                        {d.providerMode === 'auto' ? (pd.publish ? 'Não pode ser publicado assim — desmarque «Publicado» ou complete os dados.' : 'Pode guardar como não publicado.') : 'Em modo Manual pode ser publicado (a equipa trata da aquisição).'}
                      </td>
                    </tr>
                  )}
                </>)
              })()}</Fragment>))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 space-y-2" data-testid="vp-provider">
        <p className="text-xs font-bold text-[#334155] flex items-center gap-1"><Info size={13} /> Produto da Hostinger e activação</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className={`${lbl} sm:col-span-2`}>Produto exacto (catálogo VPS)
            {provider?.items.length ? (
              <select className={`${input} ${bad('providerProductId')}`} value={d.providerProductId} onChange={e => chooseProduct(e.target.value)} data-testid="vp-provider-product">
                <option value="">— sem associação (activação manual) —</option>{provider.items.map(x => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}
              </select>
            ) : <input className={`${input} font-mono ${bad('providerProductId')}`} value={d.providerProductId} placeholder="ex.: hostingercom-vps-kvm2" onChange={e => set('providerProductId', e.target.value)} data-testid="vp-provider-product" />}
          </label>
          <label className={lbl}>Modo de activação
            <select className={`${input} ${bad('providerProductId')}`} value={d.providerMode} onChange={e => set('providerMode', e.target.value as 'manual' | 'auto')} data-testid="vp-provider-mode">
              <option value="manual">Manual (a equipa adquire e associa)</option><option value="auto">Automático (compra na Hostinger após pagamento validado)</option>
            </select>
          </label>
        </div>
        {provider?.error && <p className="text-[11px] text-[#64748B]">Catálogo da Hostinger indisponível: {provider.error}</p>}
        {d.providerProductId && (pSpecs
          ? <div className="text-[11px] text-[#475569] space-y-0.5" data-testid="vp-provider-specs">
              <p>Produto: {pSpecs.vcpu ?? '?'} vCPU · {pSpecs.ramGb ?? '?'} GB RAM · {pSpecs.diskGb ?? '?'} GB disco · tráfego {pSpecs.trafficUnlimited ? 'ilimitado' : pSpecs.trafficGb != null ? formatTrafficGb(pSpecs.trafficGb) : 'não validado'}</p>
              {pSpecs.raw && Object.keys(pSpecs.raw).length > 0 && <p className="text-[#94A3B8]" data-testid="vp-provider-raw">Valores brutos da Hostinger: {(['vcpu', 'ram', 'disk', 'traffic'] as const).filter(k => pSpecs.raw?.[k]).map(k => formatRaw(pSpecs.raw![k])).join(' · ')} (MB da Hostinger ÷ 1024 = GB anunciados; tráfego comparado em GB decimais, 1 TB = 1000 GB)</p>}
            </div>
          : null)}
        {d.providerProductId && (!pSpecs || unverified.length > 0) && <label className="text-[11px] text-amber-900 flex items-start gap-2"><input type="checkbox" checked={d.providerSpecsConfirmed} onChange={e => set('providerSpecsConfirmed', e.target.checked)} data-testid="vp-specs-confirm" /> {pSpecs ? 'Há valores da Hostinger que não foi possível validar' : 'O catálogo não indica as características deste produto'}: confirmo que correspondem ao anunciado (necessário para o modo automático).</label>}
        {unverified.length > 0 && <ul className="text-[11px] text-amber-800 list-disc pl-5" data-testid="vp-unverified">{unverified.map(m => <li key={m}>{m}</li>)}</ul>}
        {mismatches.length > 0 && (
          <div className={`text-[11px] rounded-lg p-2 ${auto ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-900'}`} role="alert" data-testid="vp-mismatch" data-severity={auto ? 'block' : 'warning'}>
            <p className="font-bold">{auto ? 'Divergências com o produto da Hostinger — o modo Automático não permite guardar:' : 'Aviso (modo Manual — a equipa trata da aquisição): divergências com o produto da Hostinger'}</p>
            <ul className="list-disc pl-5">{mismatches.map(m => <li key={m}>{m}</li>)}</ul>
          </div>
        )}
        <p className="text-[11px] text-[#64748B]">Custo e limite em unidades mínimas da moeda do fornecedor (ex.: 699 = 6,99 USD). A compra automática é recusada se o preço actual da Hostinger exceder o limite ou mudar de moeda.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#F5B700] disabled:opacity-50" data-testid="vp-save">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {d.id ? 'Guardar plano' : 'Criar plano'}</button>
        {onCancel && <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB]">Cancelar</button>}
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status" data-testid="vp-msg">{msg.text}</span>}
      </div>

      <div data-testid="vp-preview">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Pré-visualização (antes de guardar)</p>
          {VPS_CYCLES.map(c => <button key={c.cycle} type="button" onClick={() => setPreviewCycle(c.cycle)} data-testid={`vp-preview-${c.cycle}`} className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${previewCycle === c.cycle ? 'bg-[#F5B700] border-[#F5B700]' : 'bg-white border-[#E5E7EB]'}`}>{c.label}</button>)}
        </div>
        <VpsPlanBand plan={preview} fmt={kz} preview />
      </div>
    </div>
  )
}

export function VpsPlansEditor({ onSaved }: { onSaved?: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [provider, setProvider] = useState<{ error?: string; items: ProviderItem[] } | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const load = useCallback(() => {
    fetch('/api/admin/catalog/vps-plans?provider=1', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setPlans(j.plans); setProvider(j.provider) }).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])
  const saved = (list: Plan[]) => { setPlans(list); setCreating(false); onSaved?.() }
  const listAction = async (body: Record<string, unknown>) => {
    setNote(null)
    const res = await fetch('/api/admin/catalog/vps-plans', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json(); if (!res.ok) setNote(j.error ?? 'Falhou.'); else saved(j.plans)
  }
  const move = (i: number, dir: -1 | 1) => { if (!plans) return; const ids = plans.map(p => p.id); const j = i + dir; if (j < 0 || j >= ids.length) return;[ids[i], ids[j]] = [ids[j], ids[i]]; listAction({ action: 'reorder', ids }) }
  const total = useMemo(() => plans?.filter(p => p.saleStatus === 'active').length ?? 0, [plans])

  if (error) return <p className="text-red-600 text-sm" role="alert">{error}</p>
  if (!plans) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  return (
    <div className="space-y-2" data-testid="vps-plans-editor">
      <p className="text-xs text-[#64748B]">{total} plano(s) publicado(s) em /servidor-vps. Os VPS com subcategoria (n8n, Evolution, AI Cloud, OpenClaw) continuam na lista do catálogo abaixo.</p>
      {note && <p className="text-xs text-red-700" role="alert">{note}</p>}
      {plans.map((p, i) => (
        <details key={`${p.id}-${p.position}-${p.name}-${p.saleStatus}`} className="rounded-xl border border-[#E5E7EB] bg-white" data-testid="vps-plan-admin" data-slug={p.slug}>
          <summary className="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-3">
            <span className="inline-flex gap-1" onClick={e => e.preventDefault()}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label={`Subir ${p.name}`} data-testid="vps-up"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === plans.length - 1} className="p-1 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label={`Descer ${p.name}`} data-testid="vps-down"><ArrowDown size={12} /></button>
            </span>
            <span className="font-bold text-[#0B0B0D]">{p.name}</span>
            {p.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F5B700] text-black">{p.badge}</span>}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.saleStatus === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`} data-testid="vps-status">{STATUS[p.saleStatus].split(' (')[0]}</span>
            <span className="text-xs text-[#64748B]">{p.providerProductId ? `Hostinger: ${p.providerProductId} · ${p.providerMode === 'auto' ? 'automático' : 'manual'}` : 'activação manual'}</span>
            {p.specWarnings.length > 0 && <span className={`text-xs font-bold ${p.providerMode === 'auto' ? 'text-red-700' : 'text-amber-700'}`} data-testid="vps-spec-warning">{p.providerMode === 'auto' ? 'características ≠ produto' : 'aviso: características ≠ produto'}</span>}
            <span className="ml-auto inline-flex gap-2" onClick={e => e.preventDefault()}>
              <button type="button" onClick={() => listAction({ action: 'publish', id: p.id, published: p.saleStatus !== 'active' })} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E5E7EB] text-xs font-bold" data-testid="vps-toggle-publish">
                {p.saleStatus === 'active' ? <><EyeOff size={12} /> Despublicar</> : <><Eye size={12} /> Publicar</>}
              </button>
            </span>
          </summary>
          <PlanForm plan={p} provider={provider} onSaved={saved} />
        </details>
      ))}
      {creating ? (
        <div className="rounded-xl border-2 border-dashed border-[#F5B700] bg-white pt-4" data-testid="vps-plan-new"><p className="px-4 pb-2 font-bold text-sm">Novo plano VPS</p><PlanForm provider={provider} onSaved={saved} onCancel={() => setCreating(false)} /></div>
      ) : <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB] bg-white" data-testid="vps-plan-create"><Plus size={14} /> Novo plano VPS</button>}
    </div>
  )
}
