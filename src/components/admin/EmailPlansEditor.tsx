'use client'
import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Info, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { EMAIL_PERIODS, MAX_DISCOUNT, discountedMonthly, periodTotal, selectorBadge } from '@/lib/commerce/period-pricing'

// Catálogo e Preços → E-mail: ficha de cada plano, preço mensal base e desconto por período.
// O servidor (/api/admin/catalog/email-plans) valida e calcula os totais com a mesma regra da pré-visualização.

type Period = { cycle: string; months: number; discount: number; renewalDiscount: number; price: number; renewal: number; active: boolean }
type Plan = {
  id: string; slug: string; name: string; description: string | null; storageGb: number | null; sendLimitHour: number | null
  features: string[]; badge: string | null; position: number; saleStatus: 'active' | 'draft' | 'on_request'; baseMonthly: number | null
  whmPackage: string | null; maxQuantity: number; periods: Period[]
}
type Draft = {
  id?: string; name: string; description: string; storageGb: string; sendLimitHour: string; features: string[]; badge: string
  position: string; saleStatus: Plan['saleStatus']; baseMonthly: string; periods: { cycle: string; discount: string; renewalDiscount: string }[]
}

const input = 'w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#F5B700]'
const lbl = 'text-xs text-[#64748B] block'
const STATUS = { active: 'À venda', on_request: 'Sob consulta', draft: 'Rascunho (não aparece no site)' }
const kz = (n: number) => `Kz ${Number(n).toLocaleString('pt-PT', { maximumFractionDigits: 2 }).replace(/\s/g, ' ')}`

function toDraft(p?: Plan): Draft {
  return {
    id: p?.id, name: p?.name ?? '', description: p?.description ?? '', storageGb: p?.storageGb?.toString() ?? '',
    sendLimitHour: p?.sendLimitHour?.toString() ?? '', features: p?.features?.length ? [...p.features] : [''], badge: p?.badge ?? '',
    position: String(p?.position ?? 0), saleStatus: p?.saleStatus ?? 'draft', baseMonthly: p?.baseMonthly?.toString() ?? '',
    periods: EMAIL_PERIODS.map(per => {
      const x = p?.periods.find(y => y.cycle === per.cycle)
      return { cycle: per.cycle, discount: String(x?.discount ?? 0), renewalDiscount: String(x?.renewalDiscount ?? 0) }
    }),
  }
}

function PlanForm({ plan, onSaved, onCancel }: { plan?: Plan; onSaved: (plans: Plan[]) => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(plan))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; field?: string } | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }))
  const base = Number(d.baseMonthly)
  const baseOk = Number.isFinite(base) && base > 0

  const moveFeature = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= d.features.length) return
    const f = [...d.features];[f[i], f[j]] = [f[j], f[i]]; set('features', f)
  }

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const body = {
        id: d.id, name: d.name, description: d.description, storageGb: d.storageGb, sendLimitHour: d.sendLimitHour,
        features: d.features.map(f => f.trim()).filter(Boolean), badge: d.badge, position: d.position, saleStatus: d.saleStatus,
        baseMonthly: d.baseMonthly, periods: d.periods.map(p => ({ cycle: p.cycle, discount: p.discount === '' ? 0 : p.discount, renewalDiscount: p.renewalDiscount === '' ? 0 : p.renewalDiscount })),
      }
      const res = await fetch('/api/admin/catalog/email-plans', { method: d.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: j.error ?? `HTTP ${res.status}`, field: j.field ?? undefined }); return }
      setMsg({ ok: true, text: d.id ? 'Guardado' : 'Plano criado' })
      if (!d.id) setD(toDraft())
      onSaved(j.plans)
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }
  const bad = (f: string) => msg && !msg.ok && msg.field === f ? 'border-red-400' : ''

  return (
    <div className="px-4 pb-4 space-y-4" data-testid="email-plan-form">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className={`${lbl} sm:col-span-2`}>Nome do plano
          <input className={`${input} ${bad('name')}`} value={d.name} maxLength={80} onChange={e => set('name', e.target.value)} data-testid="ep-name" />
        </label>
        <label className={lbl}>Etiqueta (opcional)
          <input className={input} value={d.badge} maxLength={24} placeholder="ex.: Mais popular" onChange={e => set('badge', e.target.value)} data-testid="ep-badge" />
        </label>
        <label className={lbl}>Ordem de apresentação
          <input type="number" min={0} max={9999} className={`${input} ${bad('position')}`} value={d.position} onChange={e => set('position', e.target.value)} data-testid="ep-position" />
        </label>
        <label className={`${lbl} sm:col-span-2 lg:col-span-4`}>Descrição curta
          <input className={input} value={d.description} maxLength={160} onChange={e => set('description', e.target.value)} data-testid="ep-description" />
        </label>
        <label className={lbl}>Armazenamento por caixa (GB)
          <input type="number" min={1} className={`${input} ${bad('storageGb')}`} value={d.storageGb} onChange={e => set('storageGb', e.target.value)} data-testid="ep-storage" />
        </label>
        <label className={lbl}>Limite de envio por hora (opcional)
          <input type="number" min={1} className={`${input} ${bad('sendLimitHour')}`} value={d.sendLimitHour} placeholder="sem limite indicado" onChange={e => set('sendLimitHour', e.target.value)} data-testid="ep-send" />
        </label>
        <label className={lbl}>Estado
          <select className={input} value={d.saleStatus} onChange={e => set('saleStatus', e.target.value as Plan['saleStatus'])} data-testid="ep-status">
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className={lbl}>Preço mensal base por caixa (Kz)
          <input type="number" min={1} step="0.01" className={`${input} ${bad('baseMonthly')}`} value={d.baseMonthly} onChange={e => set('baseMonthly', e.target.value)} data-testid="ep-base" />
        </label>
      </div>
      <p className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 flex gap-2" data-testid="ep-quota-note">
        <Info size={14} className="shrink-0 mt-0.5 text-[#64748B]" />
        <span>O armazenamento e o limite de envio <strong>só descrevem o plano</strong> nos cartões; não configuram quotas no servidor de e-mail.
          A quota técnica é a do pacote WHM do plano{plan ? <> (<span className="font-mono">{plan.whmPackage ?? 'sem pacote — activação manual'}</span>)</> : ' (defina-o depois de criar o plano)'}. Mantenha os dois valores iguais aos do pacote.</span>
      </p>

      <div>
        <p className="text-xs font-bold text-[#334155] mb-1">Características (pela ordem dos cartões)</p>
        <ul className="space-y-1.5">
          {d.features.map((f, i) => (
            <li key={i} className="flex gap-1.5 items-center" data-testid="ep-feature">
              <input className={input} value={f} maxLength={120} onChange={e => set('features', d.features.map((x, j) => j === i ? e.target.value : x))} aria-label={`Característica ${i + 1}`} />
              <button type="button" onClick={() => moveFeature(i, -1)} disabled={i === 0} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Subir"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => moveFeature(i, 1)} disabled={i === d.features.length - 1} className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-30" aria-label="Descer"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => set('features', d.features.filter((_, j) => j !== i))} className="p-1.5 rounded border border-[#E5E7EB] text-red-600" aria-label="Remover"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        {d.features.length < 20 && <button type="button" onClick={() => set('features', [...d.features, ''])} className="mt-1.5 text-xs font-bold text-[#0B0B0D] inline-flex items-center gap-1" data-testid="ep-add-feature"><Plus size={12} /> Acrescentar característica</button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-1">Período</th><th>Desconto %</th><th>Mensal por caixa</th><th>Total por caixa</th><th>Desconto renovação %</th><th>Renovação</th></tr></thead>
          <tbody>
            {EMAIL_PERIODS.map((per, i) => {
              const p = d.periods[i]
              const disc = Number(p.discount || 0), rdisc = Number(p.renewalDiscount || 0)
              const ok = baseOk && Number.isInteger(disc) && disc >= 0 && disc <= MAX_DISCOUNT
              return (
                <tr key={per.cycle} className="border-t border-[#F1F5F9]" data-testid={`ep-period-${per.cycle}`}>
                  <td className="py-1.5 pr-2 font-semibold">{per.label}</td>
                  <td className="pr-2 w-24"><input type="number" min={0} max={MAX_DISCOUNT} step={1} className={`${input} ${bad(`discount-${per.cycle}`)}`} value={p.discount} onChange={e => set('periods', d.periods.map((x, j) => j === i ? { ...x, discount: e.target.value } : x))} aria-label={`Desconto ${per.label}`} data-testid={`ep-discount-${per.cycle}`} /></td>
                  <td className="pr-2 whitespace-nowrap">{ok ? <>{disc > 0 && <span className="line-through text-[#94A3B8] mr-1">{kz(base)}</span>}{kz(discountedMonthly(base, disc))}</> : '—'}</td>
                  <td className="pr-2 whitespace-nowrap font-bold" data-testid={`ep-total-${per.cycle}`}>{ok ? kz(periodTotal(base, per.months, disc)) : '—'}</td>
                  <td className="pr-2 w-24"><input type="number" min={0} max={MAX_DISCOUNT} step={1} className={`${input} ${bad(`renewal-${per.cycle}`)}`} value={p.renewalDiscount} onChange={e => set('periods', d.periods.map((x, j) => j === i ? { ...x, renewalDiscount: e.target.value } : x))} aria-label={`Desconto na renovação ${per.label}`} /></td>
                  <td className="whitespace-nowrap text-[#475569]">{baseOk && rdisc >= 0 && rdisc <= MAX_DISCOUNT ? kz(periodTotal(base, per.months, rdisc)) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-[#64748B] mt-1">Mensal com desconto = preço base × (100 − desconto) / 100, arredondado ao kwanza; total = mensal × meses. Desconto 0 = sem etiqueta nem preço riscado. Renovação: preço base × meses, salvo desconto de renovação.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#F5B700] disabled:opacity-50" data-testid="ep-save">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {d.id ? 'Guardar plano' : 'Criar plano'}</button>
        {onCancel && <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB]">Cancelar</button>}
        {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status" data-testid="ep-msg">{msg.text}</span>}
      </div>
    </div>
  )
}

export function EmailPlansEditor({ onSaved }: { onSaved?: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    fetch('/api/admin/catalog/email-plans', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setPlans(j.plans) }).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])
  const saved = (list: Plan[]) => { setPlans(list); setCreating(false); onSaved?.() }

  if (error) return <p className="text-red-600 text-sm" role="alert">{error}</p>
  if (!plans) return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#F5B700]" /></div>
  const visible = plans.filter(p => p.saleStatus !== 'draft')
  const badges = EMAIL_PERIODS.map(per => ({ label: per.label, badge: selectorBadge(visible.map(p => p.periods.find(x => x.cycle === per.cycle)?.discount ?? 0)) }))

  return (
    <div className="space-y-2" data-testid="email-plans-editor">
      <p className="text-xs text-[#64748B]">Selector no site: {badges.map(b => `${b.label}${b.badge ? ` (${b.badge})` : ''}`).join(' · ')}</p>
      {plans.map(p => {
        const m = p.periods.find(x => x.cycle === 'monthly')
        return (
          <details key={`${p.id}-${p.position}-${p.name}`} className="rounded-xl border border-[#E5E7EB] bg-white" data-testid="email-plan-admin" data-slug={p.slug}>
            <summary className="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#94A3B8] font-mono">#{p.position}</span>
              <span className="font-bold text-[#0B0B0D]">{p.name}</span>
              {p.badge && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#F5B700] text-black">{p.badge}</span>}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.saleStatus === 'active' ? 'bg-green-50 text-green-700' : p.saleStatus === 'on_request' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{STATUS[p.saleStatus].split(' (')[0]}</span>
              <span className="ml-auto text-sm text-[#334155]">{p.baseMonthly != null ? `${kz(p.baseMonthly)}/caixa/mês` : m?.active ? `${kz(m.price)}/mês` : '—'} · descontos {p.periods.map(x => `${x.discount}%`).join(' / ')}</span>
            </summary>
            <PlanForm plan={p} onSaved={saved} />
          </details>
        )
      })}
      {creating ? (
        <div className="rounded-xl border-2 border-dashed border-[#F5B700] bg-white pt-4" data-testid="email-plan-new">
          <p className="px-4 pb-2 font-bold text-sm">Novo plano de e-mail</p>
          <PlanForm onSaved={saved} onCancel={() => setCreating(false)} />
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-[#E5E7EB] bg-white" data-testid="email-plan-create"><Plus size={14} /> Novo plano</button>
      )}
    </div>
  )
}
