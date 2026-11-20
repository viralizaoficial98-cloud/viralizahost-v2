'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save, ExternalLink, AlertTriangle } from 'lucide-react'
import { AdminPageShell } from '@/components/admin/AdminPageShell'

// Catálogo e preços: estado de venda, pacote WHM, preços e renovações por ciclo, domínios.
// Os preços de referência e a sua origem ficam visíveis para cada linha.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Price = { id: string; cycle: string; months: number; price: number; renewal_price: number; active: boolean; reference: any }
type Product = { id: string; slug: string; name: string; category: string; subcategory: string | null; sale_status: 'active' | 'draft' | 'on_request'; provisioning: string | null; whm_package: string | null; pricing_note: string | null; prices: Price[] }
type DomainPrice = { id: string; extension: string; operation: string; years: number; price: number | null; status: 'active' | 'draft' | 'on_request'; reference: any }

const CYCLES = [['monthly', 'Mensal'], ['6months', '6 meses'], ['1year', '1 ano'], ['2years', '2 anos'], ['3years', '3 anos']] as const
const STATUS = { active: 'À venda', on_request: 'Sob consulta', draft: 'Rascunho' }
const OP = { register: 'Registo', renew: 'Renovação', transfer: 'Transferência' } as Record<string, string>
const input = 'w-full border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#F5B700]'

function ProductRow({ p, onSaved }: { p: Product; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => ({
    sale_status: p.sale_status, whm_package: p.whm_package ?? '', pricing_note: p.pricing_note ?? '',
    prices: CYCLES.map(([c]) => { const x = p.prices.find(y => y.cycle === c); return { cycle: c, price: x?.price ?? 0, renewal_price: x?.renewal_price ?? 0, active: x?.active ?? false } }),
  }))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const ref = p.prices.find(x => x.reference?.url)?.reference

  async function save() {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/catalog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'product', id: p.id, ...draft, prices: draft.prices.filter(x => x.active || p.prices.some(y => y.cycle === x.cycle)) }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      setMsg({ ok: true, text: 'Guardado' }); onSaved()
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }) } finally { setBusy(false) }
  }

  return (
    <details className="rounded-xl border border-[#E5E7EB] bg-white" data-testid="catalog-product">
      <summary className="px-4 py-3 cursor-pointer flex flex-wrap items-center gap-3">
        <span className="font-bold text-[#0B0B0D]">{p.name}</span>
        <span className="font-mono text-xs text-[#64748B]">{p.slug}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.sale_status === 'active' ? 'bg-green-50 text-green-700' : p.sale_status === 'on_request' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{STATUS[p.sale_status]}</span>
        {p.provisioning === 'whm' && !p.whm_package && p.sale_status === 'active' && <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> sem pacote WHM — activação manual</span>}
        <span className="ml-auto text-sm text-[#334155]">{p.prices.find(x => x.cycle === 'monthly' && x.active) ? `Kz ${p.prices.find(x => x.cycle === 'monthly')!.price.toLocaleString('pt-PT')}/mês` : '—'}</span>
      </summary>
      <div className="px-4 pb-4 space-y-3">
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs text-[#64748B]">Estado
            <select className={input} value={draft.sale_status} onChange={e => setDraft({ ...draft, sale_status: e.target.value as Product['sale_status'] })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs text-[#64748B]">Pacote WHM {p.provisioning !== 'whm' && '(activação manual)'}
            <input className={input} value={draft.whm_package} disabled={p.provisioning !== 'whm'} placeholder="ex.: viraliza_start" onChange={e => setDraft({ ...draft, whm_package: e.target.value })} />
          </label>
          <label className="text-xs text-[#64748B]">Nota de preço / motivo «sob consulta»
            <input className={input} value={draft.pricing_note} onChange={e => setDraft({ ...draft, pricing_note: e.target.value })} />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-1">Ciclo</th><th>Preço (Kz)</th><th>Renovação (Kz)</th><th>Activo</th></tr></thead>
            <tbody>
              {draft.prices.map((x, i) => (
                <tr key={x.cycle} className="border-t border-[#F1F5F9]">
                  <td className="py-1.5 pr-2">{CYCLES[i][1]}</td>
                  <td className="pr-2"><input type="number" min={0} step={100} className={input} value={x.price} onChange={e => setDraft({ ...draft, prices: draft.prices.map((y, j) => j === i ? { ...y, price: Number(e.target.value) } : y) })} aria-label={`Preço ${CYCLES[i][1]}`} /></td>
                  <td className="pr-2"><input type="number" min={0} step={100} className={input} value={x.renewal_price} onChange={e => setDraft({ ...draft, prices: draft.prices.map((y, j) => j === i ? { ...y, renewal_price: Number(e.target.value) } : y) })} aria-label={`Renovação ${CYCLES[i][1]}`} /></td>
                  <td><input type="checkbox" checked={x.active} onChange={e => setDraft({ ...draft, prices: draft.prices.map((y, j) => j === i ? { ...y, active: e.target.checked } : y) })} aria-label={`Activo ${CYCLES[i][1]}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ref && (
          <p className="text-xs text-[#64748B]">Referência: {ref.provider} — {ref.plan} a {ref.ref_monthly} {ref.ref_currency}/mês na renovação ({String(ref.consulted_at).slice(0, 10)}) · ×{ref.factor ?? 2}{ref.rate ? ` · 1 USD = ${ref.rate} Kz` : ''}{ref.edited_by_admin ? ' · editado no painel' : ''} {ref.url && <a href={ref.url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-0.5">fonte <ExternalLink size={10} /></a>}</p>
        )}
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-black bg-[#F5B700] disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status">{msg.text}</span>}
        </div>
      </div>
    </details>
  )
}

function DomainRow({ d, onSaved }: { d: DomainPrice; onSaved: () => void }) {
  const [price, setPrice] = useState<string>(d.price == null ? '' : String(d.price))
  const [status, setStatus] = useState(d.status)
  const [msg, setMsg] = useState('')
  async function save() {
    setMsg('')
    const res = await fetch('/api/admin/catalog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'domain', id: d.id, price: price === '' ? null : Number(price), status }) })
    const j = await res.json(); setMsg(res.ok ? 'Guardado' : j.error); if (res.ok) onSaved()
  }
  return (
    <tr className="border-t border-[#F1F5F9]">
      <td className="py-1.5 font-mono">{d.extension}</td><td>{OP[d.operation] ?? d.operation}</td>
      <td className="pr-2"><input className={input} type="number" min={0} step={100} value={price} onChange={e => setPrice(e.target.value)} aria-label={`Preço ${d.extension} ${d.operation}`} /></td>
      <td className="pr-2"><select className={input} value={status} onChange={e => setStatus(e.target.value as DomainPrice['status'])}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
      <td className="text-xs text-[#64748B]">{d.reference?.provider ?? d.reference?.reason ?? ''}</td>
      <td><button onClick={save} className="text-xs font-bold underline">Guardar</button> <span className="text-xs">{msg}</span></td>
    </tr>
  )
}

export default function CatalogPage() {
  const [data, setData] = useState<{ products: Product[]; domains: DomainPrice[] } | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const load = useCallback(() => {
    fetch('/api/admin/catalog', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j) }).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])
  const groups = useMemo(() => {
    const g = new Map<string, Product[]>()
    for (const p of data?.products ?? []) {
      if (filter && !`${p.name} ${p.slug}`.toLowerCase().includes(filter.toLowerCase())) continue
      const k = p.subcategory ? `${p.category} / ${p.subcategory}` : p.category
      g.set(k, [...(g.get(k) ?? []), p])
    }
    return [...g.entries()]
  }, [data, filter])

  return (
    <AdminPageShell title="Catálogo e preços" subtitle="Estado de venda, pacote WHM, preços e renovação por ciclo. O checkout usa sempre estes valores.">
      {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
      {!data && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>}
      {data && (
        <div className="space-y-6">
          <input className={`${input} max-w-sm`} placeholder="Filtrar planos…" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar planos" />
          {groups.map(([k, list]) => (
            <section key={k}>
              <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">{k}</h2>
              <div className="space-y-2">{list.map(p => <ProductRow key={p.id} p={p} onSaved={load} />)}</div>
            </section>
          ))}
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">Domínios (1 ano)</h2>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th>Extensão</th><th>Operação</th><th>Preço (Kz)</th><th>Estado</th><th>Referência</th><th /></tr></thead>
                <tbody>{data.domains.map(d => <DomainRow key={d.id} d={d} onSaved={load} />)}</tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AdminPageShell>
  )
}
