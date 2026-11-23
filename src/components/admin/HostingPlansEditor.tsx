'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Info, Loader2, Plus, Save, Trash2, Server } from 'lucide-react'
import { MAX_DISCOUNT, PLAN_PERIODS, exactPeriodTotal, impliedDiscount, selectorBadge } from '@/lib/commerce/period-pricing'
import { HostingPlanCard, type CardPlan, type HostingSpecs } from '@/components/service/HostingPlansSection'

// Catálogo e Preços → Hospedagem Premium: ficha do plano, grupos de características, preço base e desconto por período.
// Pré-visualização (cartão + tabela de totais) com a mesma regra do servidor; o servidor volta a validar e calcular ao guardar.

type Limit = { unlimited: true } | { value: number }
type Period = { cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null; discount: number; matchesRule: boolean }
type Plan = {
  id: string; slug: string; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'; position: number; badge: string | null
  highlight: boolean; baseMonthly: number | null; whmPackage: string | null; specs: HostingSpecs
  groups: { name: string | null; features: { text: string; included: boolean }[] }[]; periods: Period[]; otherCycles: { cycle: string; months: number; price: number; active: boolean }[]
}
type Pkg = { name: string; quota: string; bwlimit: string; maxpop: string; maxaddon: string }
type LimitDraft = { mode: '' | 'value' | 'unlimited'; value: string }
type PeriodDraft = { cycle: string; discount: string | null; publish: boolean; renewal: string }
type Draft = {
  id?: string; name: string; description: string; saleStatus: Plan['saleStatus']; position: string; badge: string; highlight: boolean; baseMonthly: string
  usageProfile: string; sites: LimitDraft; storageGb: string; diskType: '' | 'SSD' | 'NVMe'; traffic: LimitDraft & { unit: 'GB' | 'TB' }
  emailAccounts: LimitDraft; sendLimitHour: string; ramGb: string; inodes: LimitDraft
  groups: { name: string; features: { text: string; included: boolean }[] }[]; periods: PeriodDraft[]
}

const input = 'w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#F5B700] bg-white'
const lbl = 'text-xs text-[#64748B] block'
const STATUS = { active: 'À venda', on_request: 'Sob consulta', draft: 'Rascunho (não aparece no site)' }
const kz = (v: number) => `Kz ${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')}`
const fmtCard = (v: number) => `${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')} Kz`

const limitDraft = (l?: Limit | null): LimitDraft => !l ? { mode: '', value: '' } : 'unlimited' in l ? { mode: 'unlimited', value: '' } : { mode: 'value', value: String(l.value) }
const limitOut = (d: LimitDraft) => d.mode === 'unlimited' ? { unlimited: true } : d.mode === 'value' ? { value: d.value } : null

function toDraft(p?: Plan): Draft {
  const s = p?.specs ?? {}
  const t = s.traffic
  return {
    id: p?.id, name: p?.name ?? '', description: p?.description ?? '', saleStatus: p?.saleStatus ?? 'draft', position: String(p?.position ?? 0),
    badge: p?.badge ?? '', highlight: p?.highlight ?? false, baseMonthly: p?.baseMonthly?.toString() ?? '',
    usageProfile: s.usageProfile ?? '', sites: limitDraft(s.sites), storageGb: s.storageGb?.toString() ?? '', diskType: s.diskType ?? '',
    traffic: !t ? { mode: '', value: '', unit: 'GB' } : 'unlimited' in t ? { mode: 'unlimited', value: '', unit: 'GB' } : { mode: 'value', value: String(t.value), unit: t.unit },
    emailAccounts: limitDraft(s.emailAccounts), sendLimitHour: s.sendLimitHour?.toString() ?? '', ramGb: s.ramGb?.toString() ?? '', inodes: limitDraft(s.inodes),
    groups: p?.groups.length ? p.groups.map(g => ({ name: g.name ?? '', features: g.features.map(f => ({ ...f })) })) : [{ name: '', features: [{ text: '', included: true }] }],
    periods: PLAN_PERIODS.map(per => {
      const x = p?.periods.find(y => y.cycle === per.cycle)
      // Preço que segue a regra → editável pelo desconto; preço personalizado → mantido até o administrador aplicar a regra
      const discount = !x?.exists ? '' : x.matchesRule ? String(x.discount) : null
      return { cycle: per.cycle, discount, publish: !!x?.active, renewal: '' }
    }),
  }
}

/** Pacote WHM → limites aplicados (QUOTA e BWLIMIT em MB). */
const pkgLimits = (p: Pkg | undefined) => {
  if (!p) return null
  const mb = (v: string) => /^\d+$/.test(v) ? Number(v) : null
  const q = mb(p.quota), bw = mb(p.bwlimit), pop = mb(p.maxpop), add = mb(p.maxaddon)
  return {
    storage: q == null ? 'ilimitado' : `${Math.round(q / 1024)} GB`, storageGb: q == null ? null : Math.round(q / 1024),
    traffic: bw == null ? 'ilimitado' : `${Math.round(bw / 1024)} GB/mês`, trafficUnlimited: bw == null,
    emails: pop == null ? 'ilimitadas' : String(pop), emailsN: pop,
    sites: add == null ? 'ilimitados' : String(add + 1), sitesN: add == null ? null : add + 1,
  }
}

function Tag({ kind }: { kind: 'pkg' | 'desc' }) {
  return kind === 'pkg'
    ? <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 align-middle" title="Limite aplicado pelo pacote WHM/cPanel">PACOTE WHM</span>
    : <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 align-middle" title="Só descreve o plano no cartão">DESCRITIVO</span>
}

function LimitField({ label, d, onChange, testid, kind, unitLabel }: { label: string; d: LimitDraft; onChange: (d: LimitDraft) => void; testid: string; kind: 'pkg' | 'desc'; unitLabel?: string }) {
  return (
    <div className={lbl}>{label}<Tag kind={kind} />
      <div className="flex gap-1.5 mt-0.5">
        <select className={`${input} w-36`} value={d.mode} onChange={e => onChange({ ...d, mode: e.target.value as LimitDraft['mode'] })} data-testid={`${testid}-mode`} aria-label={`${label}: tipo`}>
          <option value="">Não indicar</option><option value="value">Limite</option><option value="unlimited">Ilimitado</option>
        </select>
        {d.mode === 'value' && <input type="number" min={1} className={input} value={d.value} placeholder={unitLabel} onChange={e => onChange({ ...d, value: e.target.value })} data-testid={testid} aria-label={label} />}
      </div>
    </div>
  )
}

function PlanForm({ plan, pkg, onSaved, onCancel }: { plan?: Plan; pkg?: Pkg; onSaved: (plans: Plan[]) => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(plan))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null)
  const [previewCycle, setPreviewCycle] = useState('3years')
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const base = Number(d.baseMonthly)
  const baseOk = Number.isFinite(base) && base > 0
  const lim = pkgLimits(pkg)

  // Resultado de cada período tal como ficará guardado
  const result = (i: number) => {
    const per = PLAN_PERIODS[i], pd = d.periods[i], cur = plan?.periods.find(x => x.cycle === per.cycle)
    if (pd.discount === null) return cur?.price != null ? { total: cur.price, discount: baseOk ? impliedDiscount(cur.price, base, per.months) : cur.discount, kept: true } : null
    if (pd.discount === '' || !baseOk) return null
    const disc = Number(pd.discount)
    if (!Number.isInteger(disc) || disc < 0 || disc > MAX_DISCOUNT) return null
    return { total: exactPeriodTotal(base, per.months, disc), discount: disc, kept: false }
  }
  const specsOut = (): HostingSpecs & Record<string, unknown> => ({
    usageProfile: d.usageProfile, sites: limitOut(d.sites) as Limit, storageGb: d.storageGb === '' ? null : Number(d.storageGb), diskType: d.diskType || null,
    traffic: d.traffic.mode === 'unlimited' ? { unlimited: true } : d.traffic.mode === 'value' ? { value: d.traffic.value as unknown as number, unit: d.traffic.unit } : null,
    emailAccounts: limitOut(d.emailAccounts) as Limit, sendLimitHour: d.sendLimitHour === '' ? null : Number(d.sendLimitHour), ramGb: d.ramGb === '' ? null : Number(d.ramGb), inodes: limitOut(d.inodes) as Limit,
  })
  const previewSpecs = (): HostingSpecs => {
    const s = specsOut(), num = (l: unknown) => l && typeof l === 'object' && 'value' in (l as object) ? { value: Number((l as { value: unknown }).value) || 0 } : l as Limit | null
    return { ...s, sites: num(s.sites), emailAccounts: num(s.emailAccounts), inodes: num(s.inodes), traffic: s.traffic && 'value' in s.traffic ? { value: Number(s.traffic.value) || 0, unit: s.traffic.unit } : s.traffic }
  }
  const pi = PLAN_PERIODS.findIndex(p => p.cycle === previewCycle)
  const pr = result(pi)
  const renewalOf = (i: number) => d.periods[i].renewal !== '' ? Number(d.periods[i].renewal) : plan?.periods[i]?.renewal ?? (baseOk ? exactPeriodTotal(base, PLAN_PERIODS[i].months, 0) : null)
  const previewPlan: CardPlan = {
    slug: plan?.slug ?? 'novo', name: d.name || 'Nome do plano', description: d.description || null, badge: d.badge || null, highlight: d.highlight, onRequest: d.saleStatus === 'on_request',
    specs: previewSpecs(), base: baseOk ? base : null,
    groups: d.groups.map(g => ({ name: g.name.trim() || null, features: g.features.filter(f => f.text.trim()) })).filter(g => g.features.length),
    period: pr ? { cycle: previewCycle, months: PLAN_PERIODS[pi].months, total: pr.total, renewal: renewalOf(pi), discount: pr.discount } : null,
  }

  // Avisos: ficha diferente do pacote WHM (os limites reais são os do pacote)
  const warnings: string[] = []
  if (lim) {
    if (lim.storageGb != null && d.storageGb !== '' && Number(d.storageGb) !== lim.storageGb) warnings.push(`Armazenamento ${d.storageGb} GB ≠ pacote (${lim.storage}).`)
    if (lim.emailsN != null && d.emailAccounts.mode === 'unlimited') warnings.push(`Caixas de e-mail «ilimitadas» mas o pacote permite ${lim.emails}.`)
    if (lim.emailsN != null && d.emailAccounts.mode === 'value' && Number(d.emailAccounts.value) !== lim.emailsN) warnings.push(`Caixas de e-mail ${d.emailAccounts.value} ≠ pacote (${lim.emails}).`)
    if (lim.sitesN != null && d.sites.mode === 'unlimited') warnings.push(`Sites «ilimitados» mas o pacote permite ${lim.sites}.`)
    if (!lim.trafficUnlimited && d.traffic.mode === 'unlimited') warnings.push(`Tráfego «ilimitado» mas o pacote limita a ${lim.traffic}.`)
  }

  const mvGroup = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= d.groups.length) return; const g = [...d.groups];[g[i], g[j]] = [g[j], g[i]]; set('groups', g) }
  const setGroup = (i: number, g: Draft['groups'][number]) => set('groups', d.groups.map((x, k) => k === i ? g : x))
  const mvFeat = (gi: number, i: number, dir: -1 | 1) => {
    const g = d.groups[gi], j = i + dir; if (j < 0 || j >= g.features.length) return
    const f = [...g.features];[f[i], f[j]] = [f[j], f[i]]; setGroup(gi, { ...g, features: f })
  }
  const setPeriod = (i: number, p: Partial<PeriodDraft>) => set('periods', d.periods.map((x, k) => k === i ? { ...x, ...p } : x))

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const body = {
        id: d.id, name: d.name, description: d.description, saleStatus: d.saleStatus, position: d.position, badge: d.badge, highlight: d.highlight, baseMonthly: d.baseMonthly,
        specs: specsOut(), groups: d.groups.map(g => ({ name: g.name, features: g.features.filter(f => f.text.trim()) })),
        periods: d.periods.map(p => ({ cycle: p.cycle, discount: p.discount === null ? null : p.discount === '' ? (p.publish ? '' : null) : p.discount, publish: p.publish, renewal: p.renewal === '' ? null : p.renewal })),
      }
      const res = await fetch('/api/admin/catalog/hosting-plans', { method: d.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: j.error ?? `HTTP ${res.status}`, field: j.field ?? undefined }); return }
      setMsg({ ok: true, text: d.id ? 'Guardado' : 'Plano criado' })
      if (!d.id) setD(toDraft())
      onSaved(j.plans)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  const bad = (f: string) => msg && !msg.ok && msg.field === f ? 'border-red-400 ring-1 ring-red-200' : ''

  return (
    <div className="px-4 pb-4 grid xl:grid-cols-[1fr_320px] gap-5" data-testid="hosting-plan-form">
      <div className="space-y-5 min-w-0">
        <fieldset className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className={`${lbl} sm:col-span-2`}>Nome do plano<input className={`${input} ${bad('name')}`} maxLength={80} value={d.name} onChange={e => set('name', e.target.value)} data-testid="hp-name" /></label>
          <label className={lbl}>Perfil de utilização<Tag kind="desc" /><input className={input} maxLength={60} placeholder="ex.: Para pequenos negócios" value={d.usageProfile} onChange={e => set('usageProfile', e.target.value)} data-testid="hp-profile" /></label>
          <label className={lbl}>Estado<select className={input} value={d.saleStatus} onChange={e => set('saleStatus', e.target.value as Plan['saleStatus'])} data-testid="hp-status">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className={`${lbl} sm:col-span-2 lg:col-span-4`}>Descrição curta<input className={input} maxLength={160} value={d.description} onChange={e => set('description', e.target.value)} data-testid="hp-description" /></label>
          <label className={lbl}>Etiqueta (opcional)<input className={input} maxLength={24} placeholder="ex.: Mais popular" value={d.badge} onChange={e => set('badge', e.target.value)} data-testid="hp-badge" /></label>
          <label className={lbl}>Ordem<input type="number" min={0} max={9999} className={`${input} ${bad('position')}`} value={d.position} onChange={e => set('position', e.target.value)} data-testid="hp-position" /></label>
          <label className="text-xs text-[#334155] flex items-center gap-2 pt-4"><input type="checkbox" checked={d.highlight} onChange={e => set('highlight', e.target.checked)} data-testid="hp-highlight" /> Destaque visual (cartão escuro)</label>
        </fieldset>

        <div>
          <p className="text-xs font-bold text-[#334155] mb-2 flex items-center gap-2"><Server size={13} /> Recursos do plano</p>
          <div className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 mb-3 flex gap-2" data-testid="hp-quota-note">
            <Info size={14} className="shrink-0 mt-0.5 text-[#64748B]" />
            <span>
              Pacote WHM/cPanel deste plano: <strong className="font-mono" data-testid="hp-whm-package">{plan?.whmPackage ?? (plan ? 'sem pacote — activação manual' : 'definido depois de criar o plano')}</strong>
              {plan?.whmPackage && (lim ? <> — aplica: armazenamento {lim.storage}, tráfego {lim.traffic}, caixas de e-mail {lim.emails}, sites {lim.sites}.</> : <> — limites não disponíveis agora.</>)}
              <br />Campos <Tag kind="pkg" /> são limites reais do pacote (mantenha-os iguais); campos <Tag kind="desc" /> só descrevem o plano no cartão e não configuram o servidor.
              O pacote associado não é alterado aqui (linha do produto abaixo ou Integrações → WHM/cPanel).
            </span>
          </div>
          {warnings.length > 0 && <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 list-disc pl-6" data-testid="hp-pkg-warnings">{warnings.map(w => <li key={w}>{w}</li>)}</ul>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <LimitField label="Número de sites" d={d.sites} onChange={v => set('sites', v)} testid="hp-sites" kind="pkg" unitLabel="sites" />
            <label className={lbl}>Armazenamento (GB)<Tag kind="pkg" /><input type="number" min={1} className={`${input} ${bad('storageGb')}`} value={d.storageGb} onChange={e => set('storageGb', e.target.value)} data-testid="hp-storage" /></label>
            <label className={lbl}>Tipo de disco<Tag kind="desc" /><select className={input} value={d.diskType} onChange={e => set('diskType', e.target.value as Draft['diskType'])} data-testid="hp-disk"><option value="">Não indicar</option><option value="SSD">SSD</option><option value="NVMe">NVMe</option></select></label>
            <div className={lbl}>Tráfego mensal<Tag kind="pkg" />
              <div className="flex gap-1.5 mt-0.5">
                <select className={`${input} w-36 ${bad('traffic')}`} value={d.traffic.mode} onChange={e => set('traffic', { ...d.traffic, mode: e.target.value as LimitDraft['mode'] })} data-testid="hp-traffic-mode" aria-label="Tráfego: tipo">
                  <option value="">Não indicar</option><option value="value">Limite</option><option value="unlimited">Ilimitado</option>
                </select>
                {d.traffic.mode === 'value' && <>
                  <input type="number" min={1} className={input} value={d.traffic.value} onChange={e => set('traffic', { ...d.traffic, value: e.target.value })} data-testid="hp-traffic" aria-label="Tráfego mensal" />
                  <select className={`${input} w-20`} value={d.traffic.unit} onChange={e => set('traffic', { ...d.traffic, unit: e.target.value as 'GB' | 'TB' })} data-testid="hp-traffic-unit" aria-label="Unidade do tráfego"><option>GB</option><option>TB</option></select>
                </>}
              </div>
            </div>
            <LimitField label="Caixas de e-mail" d={d.emailAccounts} onChange={v => set('emailAccounts', v)} testid="hp-email" kind="pkg" unitLabel="caixas" />
            <label className={lbl}>Limite de envio por hora (opcional)<Tag kind="desc" /><input type="number" min={1} className={`${input} ${bad('sendLimitHour')}`} value={d.sendLimitHour} placeholder="não indicar" onChange={e => set('sendLimitHour', e.target.value)} data-testid="hp-send" /></label>
            <label className={lbl}>Memória RAM (GB, opcional)<Tag kind="desc" /><input type="number" min={0.1} step="0.1" className={`${input} ${bad('ramGb')}`} value={d.ramGb} placeholder="não indicar" onChange={e => set('ramGb', e.target.value)} data-testid="hp-ram" /></label>
            <LimitField label="Limite de ficheiros (inodes)" d={d.inodes} onChange={v => set('inodes', v)} testid="hp-inodes" kind="desc" unitLabel="ficheiros" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-[#334155] mb-1">Grupos de características (pela ordem dos cartões)</p>
          <div className="space-y-3">
            {d.groups.map((g, gi) => (
              <div key={gi} className="border border-[#E5E7EB] rounded-lg p-3" data-testid="hp-group">
                <div className="flex gap-1.5 items-center mb-2">
                  <input className={`${input} font-semibold`} maxLength={60} placeholder="Nome do grupo (opcional, ex.: Recursos Premium)" value={g.name} onChange={e => setGroup(gi, { ...g, name: e.target.value })} aria-label={`Nome do grupo ${gi + 1}`} data-testid="hp-group-name" />
                  <button type="button" onClick={() => mvGroup(gi, -1)} disabled={gi === 0} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Subir grupo"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => mvGroup(gi, 1)} disabled={gi === d.groups.length - 1} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Descer grupo"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => set('groups', d.groups.filter((_, k) => k !== gi))} className="p-1.5 rounded border border-[#E5E7EB] text-red-600" aria-label="Remover grupo"><Trash2 size={14} /></button>
                </div>
                <ul className="space-y-1.5">
                  {g.features.map((f, i) => (
                    <li key={i} className="flex gap-1.5 items-center" data-testid="hp-feature">
                      <input type="checkbox" checked={f.included} onChange={e => setGroup(gi, { ...g, features: g.features.map((x, k) => k === i ? { ...x, included: e.target.checked } : x) })} title="Incluído (desmarcado = mostrado riscado)" aria-label="Incluído" />
                      <input className={input} maxLength={120} value={f.text} onChange={e => setGroup(gi, { ...g, features: g.features.map((x, k) => k === i ? { ...x, text: e.target.value } : x) })} aria-label={`Característica ${i + 1}`} />
                      <button type="button" onClick={() => mvFeat(gi, i, -1)} disabled={i === 0} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Subir"><ArrowUp size={14} /></button>
                      <button type="button" onClick={() => mvFeat(gi, i, 1)} disabled={i === g.features.length - 1} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Descer"><ArrowDown size={14} /></button>
                      <button type="button" onClick={() => setGroup(gi, { ...g, features: g.features.filter((_, k) => k !== i) })} className="p-1.5 rounded border border-[#E5E7EB] text-red-600" aria-label="Remover"><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setGroup(gi, { ...g, features: [...g.features, { text: '', included: true }] })} className="mt-1.5 text-xs font-bold inline-flex items-center gap-1" data-testid="hp-add-feature"><Plus size={12} /> Acrescentar característica</button>
              </div>
            ))}
          </div>
          {d.groups.length < 8 && <button type="button" onClick={() => set('groups', [...d.groups, { name: '', features: [{ text: '', included: true }] }])} className="mt-2 text-xs font-bold inline-flex items-center gap-1" data-testid="hp-add-group"><Plus size={12} /> Acrescentar grupo</button>}
        </div>

        <div>
          <div className="flex flex-wrap items-end gap-3 mb-2">
            <label className={`${lbl} w-56`}>Preço mensal base (Kz)<input type="number" min={1} step="0.01" className={`${input} ${bad('baseMonthly')}`} value={d.baseMonthly} onChange={e => set('baseMonthly', e.target.value)} data-testid="hp-base" /></label>
            <p className="text-[11px] text-[#64748B] flex-1 min-w-[220px]">Total = base × meses × (1 − desconto/100), arredondado ao cêntimo; equivalente mensal = total ÷ meses. Só os períodos marcados «Publicado» aparecem no site.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-1">Período</th><th>Publicado</th><th>Desconto %</th><th>Total</th><th>Equivalente/mês</th><th>Actual</th><th>Renovação (Kz)</th></tr></thead>
              <tbody>
                {PLAN_PERIODS.map((per, i) => {
                  const pd = d.periods[i], cur = plan?.periods[i], r = result(i)
                  const changed = r && cur?.price != null && Math.round(r.total * 100) !== Math.round(cur.price * 100)
                  return (
                    <tr key={per.cycle} className="border-t border-[#F1F5F9] align-top" data-testid={`hp-period-${per.cycle}`}>
                      <td className="py-2 pr-2 font-semibold whitespace-nowrap">{per.label}{!cur?.exists && <span className="block text-[10px] font-bold text-amber-700" data-testid="hp-needs-config">por configurar</span>}</td>
                      <td className="pr-2 pt-2"><input type="checkbox" checked={pd.publish} onChange={e => setPeriod(i, { publish: e.target.checked })} aria-label={`Publicar ${per.label}`} data-testid={`hp-publish-${per.cycle}`} /></td>
                      <td className="pr-2 w-28">
                        {pd.discount === null ? (
                          <div className="text-[11px] text-[#475569]" data-testid={`hp-kept-${per.cycle}`}>Preço personalizado mantido{r ? ` (≈${r.discount}%)` : ''}
                            <button type="button" className="block underline font-bold text-[#0B0B0D]" onClick={() => setPeriod(i, { discount: String(r?.discount ?? 0) })} data-testid={`hp-apply-${per.cycle}`}>Aplicar regra</button></div>
                        ) : <input type="number" min={0} max={MAX_DISCOUNT} step={1} className={`${input} ${bad(`discount-${per.cycle}`)}`} value={pd.discount} onChange={e => setPeriod(i, { discount: e.target.value })} aria-label={`Desconto ${per.label}`} data-testid={`hp-discount-${per.cycle}`} />}
                      </td>
                      <td className="pr-2 pt-2 font-bold whitespace-nowrap" data-testid={`hp-total-${per.cycle}`}>{r ? kz(r.total) : '—'}</td>
                      <td className="pr-2 pt-2 whitespace-nowrap">{r ? <>{r.discount > 0 && baseOk && <s className="text-[#94A3B8] mr-1">{kz(base)}</s>}{kz(r.total / per.months)}</> : '—'}</td>
                      <td className={`pr-2 pt-2 whitespace-nowrap text-xs ${changed ? 'text-amber-700 font-bold' : 'text-[#64748B]'}`} data-testid={`hp-current-${per.cycle}`}>{cur?.price != null ? `${kz(cur.price)}${changed ? ' → muda' : ''}` : '—'}</td>
                      <td className="pr-2 w-36"><input type="number" min={0} step="0.01" className={`${input} ${bad(`renewal-${per.cycle}`)}`} value={pd.renewal} placeholder={cur?.renewal != null ? `actual: ${cur.renewal}` : baseOk ? `${exactPeriodTotal(base, per.months, 0)}` : ''} onChange={e => setPeriod(i, { renewal: e.target.value })} aria-label={`Renovação ${per.label}`} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {plan?.otherCycles.length ? <p className="text-[11px] text-[#64748B] mt-1">Outros ciclos mantidos como estão: {plan.otherCycles.map(c => `${c.cycle} ${kz(c.price)}${c.active ? '' : ' (inactivo)'}`).join(' · ')} — editáveis na linha do produto.</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#F5B700] disabled:opacity-50" data-testid="hp-save">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {d.id ? 'Guardar plano' : 'Criar plano'}</button>
          {onCancel && <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB]">Cancelar</button>}
          {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status" data-testid="hp-msg">{msg.text}</span>}
        </div>
      </div>

      <aside className="xl:sticky xl:top-4 self-start" data-testid="hp-preview">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#64748B] mb-2">Pré-visualização (antes de guardar)</p>
        <div className="flex gap-1 mb-4 flex-wrap" role="radiogroup" aria-label="Período da pré-visualização">
          {PLAN_PERIODS.map(per => <button key={per.cycle} type="button" role="radio" aria-checked={previewCycle === per.cycle} onClick={() => setPreviewCycle(per.cycle)} data-testid={`hp-preview-${per.cycle}`}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${previewCycle === per.cycle ? 'bg-[#F5B700] border-[#F5B700]' : 'bg-white border-[#E5E7EB]'}`}>{per.label}</button>)}
        </div>
        <div className="pt-3"><HostingPlanCard plan={previewPlan} fmt={fmtCard} preview /></div>
        {!d.periods[pi].publish && <p className="text-[11px] text-amber-700 mt-2">Este período não está publicado: não aparece no site.</p>}
      </aside>
    </div>
  )
}

export function HostingPlansEditor({ onSaved }: { onSaved?: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [packages, setPackages] = useState<Pkg[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    fetch('/api/admin/catalog/hosting-plans?packages=1', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setPlans(j.plans); setPackages(j.packages) }).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])
  const saved = (list: Plan[]) => { setPlans(list); setCreating(false); onSaved?.() }
  const badges = useMemo(() => PLAN_PERIODS.map(per => {
    const ds = (plans ?? []).filter(p => p.saleStatus === 'active').map(p => p.periods.find(x => x.cycle === per.cycle)).filter(x => x?.active && x.price != null)
      .map(x => impliedDiscount(x!.price!, (plans ?? []).find(p => p.periods.includes(x!))?.baseMonthly, per.months))
    return `${per.label}${ds.length ? (selectorBadge(ds) ? ` (${selectorBadge(ds)})` : '') : ' (não publicado)'}`
  }), [plans])

  if (error) return <p className="text-red-600 text-sm" role="alert">{error}</p>
  if (!plans) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  return (
    <div className="space-y-2" data-testid="hosting-plans-editor">
      <p className="text-xs text-[#64748B]" data-testid="hp-selector-summary">Selector no site: {badges.join(' · ')}</p>
      {plans.map(p => (
        <details key={`${p.id}-${p.position}-${p.name}`} className="rounded-xl border border-[#E5E7EB] bg-white" data-testid="hosting-plan-admin" data-slug={p.slug}>
          <summary className="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-3">
            <span className="text-xs text-[#94A3B8] font-mono">#{p.position}</span>
            <span className="font-bold text-[#0B0B0D]">{p.name}</span>
            {p.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F5B700] text-black">{p.badge}</span>}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.saleStatus === 'active' ? 'bg-green-50 text-green-700' : p.saleStatus === 'on_request' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{STATUS[p.saleStatus].split(' (')[0]}</span>
            <span className="text-xs font-mono text-[#64748B]">WHM: {p.whmPackage ?? '—'}</span>
            <span className="ml-auto text-sm text-[#334155]">{p.baseMonthly != null ? `${kz(p.baseMonthly)}/mês` : 'sem preço base'} · {p.periods.map(x => x.active ? `${impliedDiscount(x.price ?? 0, p.baseMonthly, x.months)}%` : '—').join(' / ')}</span>
          </summary>
          <PlanForm plan={p} pkg={packages?.find(k => k.name === p.whmPackage)} onSaved={saved} />
        </details>
      ))}
      {creating ? (
        <div className="rounded-xl border-2 border-dashed border-[#F5B700] bg-white pt-4" data-testid="hosting-plan-new">
          <p className="px-4 pb-2 font-bold text-sm">Novo plano de hospedagem</p>
          <PlanForm onSaved={saved} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB] bg-white" data-testid="hosting-plan-create"><Plus size={14} /> Novo plano</button>
      )}
    </div>
  )
}
