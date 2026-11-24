'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { MAX_DISCOUNT, exactPeriodTotal, impliedDiscount } from '@/lib/commerce/period-pricing'
import { VPS_FEATURE_ICONS, type VpsFeature, type VpsIcon } from '@/lib/commerce/vps-shared'
import { DEDICATED_CYCLES, DEDICATED_KINDS, RAID_LEVELS, RAM_TYPES, STORAGE_TYPES, TRAFFIC_UNITS, dedicatedSpecLines, type DedicatedKind, type DedicatedSpecs } from '@/lib/commerce/dedicated-shared'
import { VpsPlanBand, type VpsBandPlan } from '@/components/service/VpsPlansSection'

// Catálogo e Preços → Dedicado Linux / Dedicado Windows: criar, editar, ordenar, publicar/despublicar; ficha (processador,
// núcleos/threads, RAM, discos, RAID, tráfego, rede, sistema, licença), imagem, características com ícone, preço base e
// desconto por período, renovação e pré-visualização da faixa (o mesmo componente da página Servidor VPS).
// Sem fornecedor: a activação dos dedicados é manual. O servidor valida tudo e só aceita administradores.

type Period = { cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null; discount: number; matchesRule: boolean }
type Plan = { id: string; slug: string; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'; position: number; badge: string | null; highlight: boolean
  baseMonthly: number | null; imageUrl: string | null; specs: DedicatedSpecs; features: VpsFeature[]; periods: Period[] }
type PD = { cycle: string; discount: string | null; publish: boolean; renewal: string }
type DiskD = { count: string; sizeGb: string; type: (typeof STORAGE_TYPES)[number] }
type Draft = { id?: string; name: string; description: string; saleStatus: Plan['saleStatus']; position: string; badge: string; highlight: boolean; baseMonthly: string
  cpuModel: string; cores: string; threads: string; ramGb: string; ramType: string; disks: DiskD[]; raid: string
  trafficMode: '' | 'value' | 'unlimited'; trafficValue: string; trafficUnit: (typeof TRAFFIC_UNITS)[number]; networkValue: string; networkUnit: 'Mbps' | 'Gbps'
  os: string; license: string; features: { text: string; icon: VpsIcon | '' }[]; periods: PD[] }

const input = 'w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#F5B700] bg-white'
const field = input.replace('w-full', 'min-w-0')
const lbl = 'text-xs text-[#64748B] block'
const kz = (v: number) => `${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')} Kz`
const BADGES = ['Mais popular', 'Disponibilidade limitada', 'Melhor valor', 'Novo']
const STATUS = { active: 'Publicado', draft: 'Rascunho (não publicado)', on_request: 'Sob consulta' }
const OS_SUGGESTIONS: Record<DedicatedKind, string[]> = {
  linux: ['Ubuntu Server 24.04 LTS', 'Debian 12', 'AlmaLinux 9', 'Rocky Linux 9', 'CentOS Stream 9'],
  windows: ['Windows Server 2022 Standard', 'Windows Server 2022 Datacenter', 'Windows Server 2019 Standard'],
}
const LICENSE_SUGGESTIONS: Record<DedicatedKind, string[]> = {
  linux: ['Sem licença (software livre)', 'cPanel/WHM (licença opcional)'],
  windows: ['Windows Server 2022 Standard incluída', 'Windows Server 2022 Datacenter incluída', 'Plesk Web Admin incluída'],
}

function toDraft(kind: DedicatedKind, p?: Plan): Draft {
  const s = p?.specs ?? {}, t = s.traffic
  return {
    id: p?.id, name: p?.name ?? '', description: p?.description ?? '', saleStatus: p?.saleStatus ?? 'draft', position: String(p?.position ?? 0), badge: p?.badge ?? '', highlight: p?.highlight ?? false,
    baseMonthly: p?.baseMonthly?.toString() ?? '', cpuModel: s.cpuModel ?? '', cores: s.cores?.toString() ?? '', threads: s.threads?.toString() ?? '', ramGb: s.ramGb?.toString() ?? '', ramType: s.ramType ?? '',
    disks: s.disks?.length ? s.disks.map(d => ({ count: String(d.count), sizeGb: String(d.sizeGb), type: d.type })) : [{ count: '1', sizeGb: '', type: 'NVMe' }],
    raid: s.raid ?? '', trafficMode: !t ? '' : 'unlimited' in t ? 'unlimited' : 'value', trafficValue: t && 'value' in t ? String(t.value) : '', trafficUnit: t && 'unit' in t ? t.unit : 'TB',
    networkValue: s.network?.value?.toString() ?? '', networkUnit: s.network?.unit ?? 'Gbps', os: s.os ?? (p ? '' : OS_SUGGESTIONS[kind][0]), license: s.license ?? '',
    features: p?.features.length ? p.features.map(f => ({ text: f.text, icon: f.icon ?? '' })) : [{ text: '', icon: 'check' }],
    periods: DEDICATED_CYCLES.map(c => {
      const x = p?.periods.find(y => y.cycle === c.cycle)
      return { cycle: c.cycle, discount: !x?.exists ? '' : x.matchesRule ? String(x.discount) : null, publish: !!x?.active, renewal: '' }
    }),
  }
}
function specsOf(d: Draft, forPreview: boolean): DedicatedSpecs {
  const num = (v: string) => (v === '' ? null : Number(v))
  const out = {
    cpuModel: d.cpuModel || null, cores: num(d.cores), threads: num(d.threads), ramGb: num(d.ramGb), ramType: (d.ramType || null) as DedicatedSpecs['ramType'],
    disks: d.disks.filter(x => x.sizeGb !== '').map(x => ({ count: Number(x.count || 1), sizeGb: Number(x.sizeGb), type: x.type })),
    raid: (d.raid || null) as DedicatedSpecs['raid'],
    traffic: d.trafficMode === 'unlimited' ? { unlimited: true as const } : d.trafficMode === 'value' && d.trafficValue ? { value: Number(d.trafficValue), unit: d.trafficUnit } : null,
    network: d.networkValue ? { value: Number(d.networkValue), unit: d.networkUnit } : null, os: d.os || null, license: d.license || null,
  }
  return forPreview ? out : out
}

function PlanForm({ kind, plan, onSaved, onCancel }: { kind: DedicatedKind; plan?: Plan; onSaved: (plans: Plan[]) => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(kind, plan))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null)
  const [previewCycle, setPreviewCycle] = useState(() => plan?.periods.find(p => p.active)?.cycle ?? 'monthly')
  const [image, setImage] = useState<string | null>(plan?.imageUrl ?? null)
  const [imgMsg, setImgMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const setP = (i: number, p: Partial<PD>) => set('periods', d.periods.map((x, k) => k === i ? { ...x, ...p } : x))
  const base = Number(d.baseMonthly), baseOk = Number.isFinite(base) && base > 0
  const result = (i: number) => {
    const c = DEDICATED_CYCLES[i], pd = d.periods[i], cur = plan?.periods.find(x => x.cycle === c.cycle)
    if (pd.discount === null) return cur?.price != null ? { total: cur.price, discount: baseOk ? impliedDiscount(cur.price, base, c.months) : cur.discount } : null
    if (pd.discount === '' || !baseOk) return null
    const disc = Number(pd.discount)
    if (!Number.isInteger(disc) || disc < 0 || disc > MAX_DISCOUNT) return null
    return { total: exactPeriodTotal(base, c.months, disc), discount: disc }
  }
  const renewalOf = (i: number) => d.periods[i].renewal !== '' ? Number(d.periods[i].renewal) : plan?.periods[i]?.renewal ?? (baseOk ? exactPeriodTotal(base, DEDICATED_CYCLES[i].months, 0) : null)
  const pi = DEDICATED_CYCLES.findIndex(c => c.cycle === previewCycle), pr = result(pi)
  const specs = specsOf(d, true)
  const preview: VpsBandPlan = { slug: plan?.slug ?? 'novo', name: d.name || 'Nome do plano', summary: d.description || null, badge: d.badge || null, highlight: d.highlight, imageUrl: image,
    specs: {}, specLines: dedicatedSpecLines(specs), features: d.features.filter(f => f.text.trim()).map(f => ({ text: f.text, icon: f.icon || null })), base: baseOk ? base : null,
    period: pr ? { cycle: previewCycle, months: DEDICATED_CYCLES[pi].months, label: DEDICATED_CYCLES[pi].label, total: pr.total, renewal: renewalOf(pi), discount: pr.discount } : null }
  const api = `/api/admin/catalog/dedicated-plans?kind=${kind}`

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const body = {
        id: d.id, name: d.name, description: d.description, saleStatus: d.saleStatus, position: d.position, badge: d.badge, highlight: d.highlight, baseMonthly: d.baseMonthly,
        specs: { ...specsOf(d, false), cores: d.cores, threads: d.threads, ramGb: d.ramGb, disks: d.disks.map(x => ({ count: x.count, sizeGb: x.sizeGb, type: x.type })),
          traffic: d.trafficMode === 'unlimited' ? { unlimited: true } : d.trafficMode === 'value' ? { value: d.trafficValue, unit: d.trafficUnit } : null,
          network: d.networkValue ? { value: d.networkValue, unit: d.networkUnit } : null },
        features: d.features.filter(f => f.text.trim()).map(f => ({ text: f.text, icon: f.icon || null })),
        periods: d.periods.map(p => ({ cycle: p.cycle, discount: p.discount === null ? null : p.discount === '' ? (p.publish ? '' : null) : p.discount, publish: p.publish, renewal: p.renewal === '' ? null : p.renewal })),
      }
      const res = await fetch(api, { method: d.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: j.error ?? `HTTP ${res.status}`, field: j.field ?? undefined }); return }
      setMsg({ ok: true, text: d.id ? 'Guardado' : 'Plano criado' })
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
  const setDisk = (i: number, p: Partial<DiskD>) => set('disks', d.disks.map((x, k) => k === i ? { ...x, ...p } : x))
  const dl = `ded-${kind}-${plan?.id ?? 'novo'}`

  return (
    <div className="px-4 pb-4 space-y-5" data-testid="ded-plan-form">
      <fieldset className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className={`${lbl} sm:col-span-2`}>Nome<input className={`${input} ${bad('name')}`} maxLength={80} value={d.name} onChange={e => set('name', e.target.value)} data-testid="dp-name" /></label>
        <label className={lbl}>Etiqueta (opcional)<input className={input} list={`${dl}-badges`} maxLength={32} value={d.badge} onChange={e => set('badge', e.target.value)} data-testid="dp-badge" /><datalist id={`${dl}-badges`}>{BADGES.map(b => <option key={b} value={b} />)}</datalist></label>
        <label className={lbl}>Ordem<input type="number" min={0} className={input} value={d.position} onChange={e => set('position', e.target.value)} data-testid="dp-position" /></label>
        <label className={`${lbl} sm:col-span-2 lg:col-span-3`}>Descrição<input className={input} maxLength={240} value={d.description} onChange={e => set('description', e.target.value)} data-testid="dp-summary" /></label>
        <label className={lbl}>Estado<select className={input} value={d.saleStatus} onChange={e => set('saleStatus', e.target.value as Plan['saleStatus'])} data-testid="dp-status">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-xs text-[#334155] flex items-center gap-2"><input type="checkbox" checked={d.highlight} onChange={e => set('highlight', e.target.checked)} data-testid="dp-highlight" /> Destaque visual</label>
      </fieldset>

      <div>
        <p className="text-xs font-bold text-[#334155] mb-2">Especificações (com ícone na página)</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className={`${lbl} sm:col-span-2`}>Processador<input className={`${input} ${bad('cpuModel')}`} maxLength={80} placeholder="ex.: AMD EPYC 4344P" value={d.cpuModel} onChange={e => set('cpuModel', e.target.value)} data-testid="dp-cpu" /></label>
          <label className={lbl}>Núcleos<input type="number" min={1} className={`${input} ${bad('cores')}`} value={d.cores} onChange={e => set('cores', e.target.value)} data-testid="dp-cores" /></label>
          <label className={lbl}>Threads<input type="number" min={1} className={`${input} ${bad('threads')}`} value={d.threads} onChange={e => set('threads', e.target.value)} data-testid="dp-threads" /></label>
          <label className={lbl}>RAM (GB)<input type="number" min={1} className={`${input} ${bad('ramGb')}`} value={d.ramGb} onChange={e => set('ramGb', e.target.value)} data-testid="dp-ram" /></label>
          <label className={lbl}>Tipo de RAM<select className={input} value={d.ramType} onChange={e => set('ramType', e.target.value)} data-testid="dp-ram-type"><option value="">—</option>{RAM_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className={lbl}>RAID<select className={`${input} ${bad('raid')}`} value={d.raid} onChange={e => set('raid', e.target.value)} data-testid="dp-raid"><option value="">—</option>{RAID_LEVELS.map(t => <option key={t}>{t}</option>)}</select></label>
          <div className={lbl}>Velocidade de rede
            <div className="flex gap-1"><input type="number" min={1} className={`${field} ${bad('network')} flex-1`} value={d.networkValue} onChange={e => set('networkValue', e.target.value)} data-testid="dp-network" /><select className={`${field} w-24 shrink-0`} value={d.networkUnit} onChange={e => set('networkUnit', e.target.value as 'Mbps' | 'Gbps')}><option>Mbps</option><option>Gbps</option></select></div>
          </div>
          <div className={`${lbl} sm:col-span-2 lg:col-span-4`}>Discos e tipo de armazenamento
            <ul className="space-y-1 mt-0.5">
              {d.disks.map((x, i) => (
                <li key={i} className="flex gap-1 items-center" data-testid="dp-disk">
                  <input type="number" min={1} className={`${field} w-20 ${bad('disks')}`} value={x.count} onChange={e => setDisk(i, { count: e.target.value })} aria-label={`Quantidade de discos (grupo ${i + 1})`} data-testid="dp-disk-count" />
                  <span>×</span>
                  <input type="number" min={1} className={`${field} w-32 ${bad('disks')}`} placeholder="GB" value={x.sizeGb} onChange={e => setDisk(i, { sizeGb: e.target.value })} aria-label={`Capacidade em GB (grupo ${i + 1})`} data-testid="dp-disk-size" />
                  <select className={`${field} w-24`} value={x.type} onChange={e => setDisk(i, { type: e.target.value as DiskD['type'] })} aria-label={`Tipo (grupo ${i + 1})`} data-testid="dp-disk-type">{STORAGE_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                  {d.disks.length > 1 && <button type="button" onClick={() => set('disks', d.disks.filter((_, k) => k !== i))} className="p-1.5 rounded border border-[#E5E7EB] text-red-600" aria-label="Remover grupo de discos"><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
            {d.disks.length < 6 && <button type="button" onClick={() => set('disks', [...d.disks, { count: '1', sizeGb: '', type: 'HDD' }])} className="mt-1 text-xs font-bold inline-flex items-center gap-1" data-testid="dp-add-disk"><Plus size={12} /> Outro grupo de discos</button>}
          </div>
          <div className={`${lbl} lg:col-span-2`}>Tráfego
            <div className="flex gap-1">
              <select className={`${field} ${bad('traffic')} w-32 shrink-0`} value={d.trafficMode} onChange={e => set('trafficMode', e.target.value as Draft['trafficMode'])} data-testid="dp-traffic-mode"><option value="">—</option><option value="value">Limite</option><option value="unlimited">Ilimitado</option></select>
              {d.trafficMode === 'value' && <><input type="number" min={1} className={`${field} flex-1`} value={d.trafficValue} onChange={e => set('trafficValue', e.target.value)} data-testid="dp-traffic" /><select className={`${field} w-20 shrink-0`} value={d.trafficUnit} onChange={e => set('trafficUnit', e.target.value as Draft['trafficUnit'])} title="GB/TB: decimais · GiB/TiB: binárias">{TRAFFIC_UNITS.map(u => <option key={u}>{u}</option>)}</select></>}
            </div>
          </div>
          <label className={lbl}>Sistema operativo<input className={`${input} ${bad('os')}`} list={`${dl}-os`} maxLength={80} value={d.os} onChange={e => set('os', e.target.value)} data-testid="dp-os" /><datalist id={`${dl}-os`}>{OS_SUGGESTIONS[kind].map(o => <option key={o} value={o} />)}</datalist></label>
          <label className={lbl}>Licença {kind === 'windows' ? '' : '(quando aplicável)'}<input className={`${input} ${bad('license')}`} list={`${dl}-lic`} maxLength={120} value={d.license} onChange={e => set('license', e.target.value)} data-testid="dp-license" /><datalist id={`${dl}-lic`}>{LICENSE_SUGGESTIONS[kind].map(o => <option key={o} value={o} />)}</datalist></label>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-[#334155] mb-1">Características adicionais (ícone da lista permitida; reordenáveis)</p>
        <ul className="space-y-1.5">
          {d.features.map((f, i) => (
            <li key={i} className="flex gap-1.5 items-center" data-testid="dp-feature">
              <select className={`${input} w-44`} value={f.icon} onChange={e => set('features', d.features.map((x, k) => k === i ? { ...x, icon: e.target.value as VpsIcon } : x))} aria-label="Ícone" data-testid="dp-feature-icon">
                <option value="">(sem ícone)</option>{Object.entries(VPS_FEATURE_ICONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input className={input} maxLength={120} value={f.text} onChange={e => set('features', d.features.map((x, k) => k === i ? { ...x, text: e.target.value } : x))} aria-label={`Característica ${i + 1}`} data-testid="dp-feature-text" />
              <button type="button" onClick={() => mvF(i, -1)} disabled={i === 0} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Subir" data-testid="dp-feature-up"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => mvF(i, 1)} disabled={i === d.features.length - 1} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Descer"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => set('features', d.features.filter((_, k) => k !== i))} className="p-1.5 rounded border border-[#E5E7EB] text-red-600" aria-label="Remover"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        {d.features.length < 20 && <button type="button" onClick={() => set('features', [...d.features, { text: '', icon: 'check' }])} className="mt-1.5 text-xs font-bold inline-flex items-center gap-1" data-testid="dp-add-feature"><Plus size={12} /> Acrescentar</button>}
      </div>

      {plan ? (
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="dp-image">
          <span className="font-bold text-[#334155]">Imagem:</span> {image ? 'carregada' : 'sem imagem (ícone de servidor)'}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} data-testid="dp-image-input" />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#E5E7EB]"><ImagePlus size={12} /> {image ? 'Substituir' : 'Carregar'} (PNG/JPEG/WebP, 2 MB)</button>
          {image && <button type="button" onClick={removeImage} className="px-2 py-1 rounded border border-red-200 text-red-700">Remover</button>}
          {imgMsg && <span role="status">{imgMsg}</span>}
        </div>
      ) : <p className="text-xs text-[#64748B]">A imagem carrega-se depois de criar o plano.</p>}

      <div>
        <div className="flex flex-wrap items-end gap-3 mb-2">
          <label className={`${lbl} w-56`}>Preço mensal base (Kz)<input type="number" min={1} step="0.01" className={`${input} ${bad('baseMonthly')}`} value={d.baseMonthly} onChange={e => set('baseMonthly', e.target.value)} data-testid="dp-base" /></label>
          <p className="text-[11px] text-[#64748B] flex-1 min-w-[220px]">Total = base × meses × (1 − desconto/100), ao cêntimo. Só os períodos «Publicado» aparecem no site; o checkout cobra exactamente este total.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-1">Período</th><th>Publicado</th><th>Desconto %</th><th>Total</th><th>/mês</th><th>Renovação (Kz)</th></tr></thead>
            <tbody>
              {DEDICATED_CYCLES.map((c, i) => {
                const pd = d.periods[i], r = result(i), cur = plan?.periods[i]
                return (
                  <tr key={c.cycle} className="border-t border-[#F1F5F9] align-top" data-testid={`dp-period-${c.cycle}`}>
                    <td className="py-2 pr-2 font-semibold whitespace-nowrap">{c.label}</td>
                    <td className="pt-2"><input type="checkbox" checked={pd.publish} onChange={e => setP(i, { publish: e.target.checked })} aria-label={`Publicar ${c.label}`} data-testid={`dp-publish-${c.cycle}`} /></td>
                    <td className="pr-2 w-24">{pd.discount === null
                      ? <span className="text-[11px]">Preço mantido{r ? ` (≈${r.discount}%)` : ''} <button type="button" className="underline font-bold" onClick={() => setP(i, { discount: String(r?.discount ?? 0) })}>Aplicar regra</button></span>
                      : <input type="number" min={0} max={MAX_DISCOUNT} className={`${input} ${bad(`discount-${c.cycle}`)}`} value={pd.discount} onChange={e => setP(i, { discount: e.target.value })} aria-label={`Desconto ${c.label}`} data-testid={`dp-discount-${c.cycle}`} />}</td>
                    <td className="pr-2 pt-2 font-bold whitespace-nowrap" data-testid={`dp-total-${c.cycle}`}>{r ? kz(r.total) : '—'}</td>
                    <td className="pr-2 pt-2 whitespace-nowrap text-xs">{r ? kz(r.total / c.months) : '—'}</td>
                    <td className="w-36"><input type="number" min={0} step="0.01" className={input} value={pd.renewal} placeholder={cur?.renewal != null ? String(cur.renewal) : baseOk ? String(exactPeriodTotal(base, c.months, 0)) : ''} onChange={e => setP(i, { renewal: e.target.value })} aria-label={`Renovação ${c.label}`} data-testid={`dp-renewal-${c.cycle}`} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#F5B700] disabled:opacity-50" data-testid="dp-save">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {d.id ? 'Guardar plano' : 'Criar plano'}</button>
        {onCancel && <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB]">Cancelar</button>}
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status" data-testid="dp-msg">{msg.text}</span>}
      </div>

      <div data-testid="dp-preview">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B]">Pré-visualização (antes de publicar)</p>
          {DEDICATED_CYCLES.map(c => <button key={c.cycle} type="button" onClick={() => setPreviewCycle(c.cycle)} data-testid={`dp-preview-${c.cycle}`} className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${previewCycle === c.cycle ? 'bg-[#F5B700] border-[#F5B700]' : 'bg-white border-[#E5E7EB]'}`}>{c.label}</button>)}
        </div>
        <VpsPlanBand plan={preview} fmt={kz} preview tid="ded" />
      </div>
    </div>
  )
}

export function DedicatedPlansEditor({ kind, onSaved }: { kind: DedicatedKind; onSaved?: () => void }) {
  const K = DEDICATED_KINDS[kind]
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const api = `/api/admin/catalog/dedicated-plans?kind=${kind}`
  const load = useCallback(() => {
    fetch(api, { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setPlans(j.plans) }).catch(e => setError(e.message))
  }, [api])
  useEffect(load, [load])
  const saved = (list: Plan[]) => { setPlans(list); setCreating(false); onSaved?.() }
  const listAction = async (body: Record<string, unknown>) => {
    setNote(null)
    const res = await fetch(api, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json(); if (!res.ok) setNote(j.error ?? 'Falhou.'); else saved(j.plans)
  }
  const move = (i: number, dir: -1 | 1) => { if (!plans) return; const ids = plans.map(p => p.id); const j = i + dir; if (j < 0 || j >= ids.length) return;[ids[i], ids[j]] = [ids[j], ids[i]]; listAction({ action: 'reorder', ids }) }
  const total = useMemo(() => plans?.filter(p => p.saleStatus === 'active').length ?? 0, [plans])

  if (error) return <p className="text-red-600 text-sm" role="alert">{error}</p>
  if (!plans) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  return (
    <div className="space-y-2" data-testid={`ded-plans-editor-${kind}`}>
      <p className="text-xs text-[#64748B]">{total} plano(s) publicado(s) em {K.page}. Activação manual pela equipa depois do pagamento validado (sem compra automática).</p>
      {note && <p className="text-xs text-red-700" role="alert">{note}</p>}
      {plans.map((p, i) => (
        <details key={`${p.id}-${p.position}-${p.name}-${p.saleStatus}`} className="rounded-xl border border-[#E5E7EB] bg-white" data-testid="ded-plan-admin" data-slug={p.slug}>
          <summary className="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-3">
            <span className="inline-flex gap-1" onClick={e => e.preventDefault()}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label={`Subir ${p.name}`} data-testid="ded-up"><ArrowUp size={12} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === plans.length - 1} className="p-1 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label={`Descer ${p.name}`} data-testid="ded-down"><ArrowDown size={12} /></button>
            </span>
            <span className="font-bold text-[#0B0B0D]">{p.name}</span>
            {p.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F5B700] text-black">{p.badge}</span>}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.saleStatus === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`} data-testid="ded-status">{STATUS[p.saleStatus].split(' (')[0]}</span>
            {p.baseMonthly == null && <span className="text-xs text-[#64748B]">sem preço base</span>}
            <span className="ml-auto inline-flex gap-2" onClick={e => e.preventDefault()}>
              <button type="button" onClick={() => listAction({ action: 'publish', id: p.id, published: p.saleStatus !== 'active' })} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E5E7EB] text-xs font-bold" data-testid="ded-toggle-publish">
                {p.saleStatus === 'active' ? <><EyeOff size={12} /> Despublicar</> : <><Eye size={12} /> Publicar</>}
              </button>
            </span>
          </summary>
          <PlanForm kind={kind} plan={p} onSaved={saved} />
        </details>
      ))}
      {creating ? (
        <div className="rounded-xl border-2 border-dashed border-[#F5B700] bg-white pt-4" data-testid="ded-plan-new"><p className="px-4 pb-2 font-bold text-sm">Novo plano {K.short}</p><PlanForm kind={kind} onSaved={saved} onCancel={() => setCreating(false)} /></div>
      ) : <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB] bg-white" data-testid="ded-plan-create"><Plus size={14} /> Novo plano {K.short}</button>}
    </div>
  )
}
