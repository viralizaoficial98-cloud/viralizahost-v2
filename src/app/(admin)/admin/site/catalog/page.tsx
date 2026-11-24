'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { DomainExtensionsEditor, type DomainExtension } from '@/components/admin/DomainExtensionsEditor'
import { EmailPlansEditor } from '@/components/admin/EmailPlansEditor'
import { HostingPlansEditor } from '@/components/admin/HostingPlansEditor'
import { VpsPlansEditor } from '@/components/admin/VpsPlansEditor'
import { DedicatedPlansEditor } from '@/components/admin/DedicatedPlansEditor'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Save, ExternalLink, AlertTriangle } from 'lucide-react'
import { AdminPageShell } from '@/components/admin/AdminPageShell'

// Catálogo e preços: estado de venda, pacote WHM, preços e renovações por ciclo, domínios.
// Os preços de referência e a sua origem ficam visíveis para cada linha.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Price = { id: string; cycle: string; months: number; price: number; renewal_price: number; active: boolean; reference: any }
type Product = { id: string; slug: string; name: string; category: string; subcategory: string | null; sale_status: 'active' | 'draft' | 'on_request'; provisioning: string | null; whm_package: string | null; pricing_note: string | null; prices: Price[] }
type DomainPrice = { id: string; extension: string; operation: string; years: number; price: number | null; status: 'active' | 'draft' | 'on_request'; reference: any }

const CYCLES = [['monthly', 'Mensal'], ['3months', 'Trimestral'], ['6months', '6 meses'], ['1year', '1 ano'], ['2years', '2 anos'], ['3years', '3 anos']] as const
const PLAN_CYCLES: string[] = ['monthly', '1year', '2years', '3years']
const STATUS = { active: 'À venda', on_request: 'Sob consulta', draft: 'Rascunho' }
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
      const res = await fetch('/api/admin/catalog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'product', id: p.id, ...draft, prices: p.category === 'email' || (p.category === 'vps' && !p.subcategory) || p.category === 'dedicated' || p.category === 'dedicated-windows' ? [] : draft.prices.filter(x => (x.active || p.prices.some(y => y.cycle === x.cycle)) && !(p.category === 'hosting' && PLAN_CYCLES.includes(x.cycle))) }) })
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
        {p.category === 'hosting' && <p className="text-xs text-[#64748B]">Ficha, preço base e descontos de 1 mês, 1, 2 e 3 anos: editar em «Planos de Hospedagem Premium» acima. Aqui: estado, pacote WHM (quotas reais), nota e os outros ciclos.</p>}
        {p.category === 'vps' && !p.subcategory ? <p className="text-xs text-[#64748B]">Ficha, preços por ciclo e produto Hostinger: editar em «Planos VPS» acima. Aqui: estado e nota.</p> : p.category === 'dedicated' || p.category === 'dedicated-windows' ? <p className="text-xs text-[#64748B]">Ficha, imagem e preços por período: editar em «Planos Dedicado {p.category === 'dedicated' ? 'Linux' : 'Windows'}» acima. Aqui: estado e nota.</p> : p.category === 'email' ? <p className="text-xs text-[#64748B]">Preços, descontos e ficha deste plano: editar em «Planos de e-mail» acima. Aqui só o estado, o pacote WHM (quota técnica) e a nota.</p> : <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left text-[11px] uppercase text-[#64748B]"><th className="py-1">Ciclo</th><th>Preço (Kz)</th><th>Renovação (Kz)</th><th>Activo</th></tr></thead>
            <tbody>
              {draft.prices.map((x, i) => p.category === 'hosting' && PLAN_CYCLES.includes(x.cycle) ? null : (
                <tr key={x.cycle} className="border-t border-[#F1F5F9]">
                  <td className="py-1.5 pr-2">{CYCLES[i][1]}</td>
                  <td className="pr-2"><input type="number" min={0} step={100} className={input} value={x.price} onChange={e => setDraft({ ...draft, prices: draft.prices.map((y, j) => j === i ? { ...y, price: Number(e.target.value) } : y) })} aria-label={`Preço ${CYCLES[i][1]}`} /></td>
                  <td className="pr-2"><input type="number" min={0} step={100} className={input} value={x.renewal_price} onChange={e => setDraft({ ...draft, prices: draft.prices.map((y, j) => j === i ? { ...y, renewal_price: Number(e.target.value) } : y) })} aria-label={`Renovação ${CYCLES[i][1]}`} /></td>
                  <td><input type="checkbox" checked={x.active} onChange={e => setDraft({ ...draft, prices: draft.prices.map((y, j) => j === i ? { ...y, active: e.target.checked } : y) })} aria-label={`Activo ${CYCLES[i][1]}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
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

const CAT_GROUPS: Record<string, { label: string; categories: string[] | null }> = {
  all: { label: 'Tudo', categories: null },
  hosting: { label: 'Hospedagem', categories: ['hosting', 'wordpress', 'website-builder', 'reseller'] },
  email: { label: 'E-mail', categories: ['email'] },
  vps: { label: 'VPS', categories: ['vps'] },
  'dedicado-linux': { label: 'Dedicado Linux', categories: ['dedicated'] },
  'dedicado-windows': { label: 'Dedicado Windows', categories: ['dedicated-windows'] },
  servidores: { label: 'VPS e dedicados', categories: ['vps', 'dedicated', 'dedicated-windows'] },
  outros: { label: 'Outros', categories: ['ssl', 'backup', 'protection', 'domain', 'microsoft365'] },
  dominios: { label: 'Domínios', categories: [] },
}

/** Nova extensão de domínio: entra em rascunho (sem preço) até a equipa a publicar. */
function NewExtension({ onSaved }: { onSaved: () => void }) {
  const [ext, setExt] = useState('')
  const [msg, setMsg] = useState('')
  async function add() {
    setMsg('')
    const r = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'extension', extension: ext }) })
    const j = await r.json(); setMsg(r.ok ? 'Extensão criada em rascunho: defina os preços e publique.' : j.error); if (r.ok) { setExt(''); onSaved() }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <input className={`${input} max-w-[160px]`} placeholder=".exemplo" value={ext} onChange={e => setExt(e.target.value)} aria-label="Nova extensão" />
      <button onClick={add} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[#F5B700] text-black">Acrescentar extensão</button>
      <span className="text-xs" role="status">{msg}</span>
    </div>
  )
}

export default function CatalogPage() {
  return <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>}><Catalog /></Suspense>
}

function Catalog() {
  const params = useSearchParams()
  const router = useRouter()
  const cat = CAT_GROUPS[params.get('cat') ?? 'all'] ? (params.get('cat') ?? 'all') : 'all'
  const [data, setData] = useState<{ products: Product[]; domains: DomainPrice[]; extensions: DomainExtension[] } | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const load = useCallback(() => {
    fetch('/api/admin/catalog', { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j) }).catch(e => setError(e.message))
  }, [])
  useEffect(load, [load])
  const groups = useMemo(() => {
    const g = new Map<string, Product[]>()
    const cats = CAT_GROUPS[cat].categories
    for (const p of data?.products ?? []) {
      if (cats && !cats.includes(p.category)) continue
      if (filter && !`${p.name} ${p.slug}`.toLowerCase().includes(filter.toLowerCase())) continue
      const k = p.subcategory ? `${p.category} / ${p.subcategory}` : p.category
      g.set(k, [...(g.get(k) ?? []), p])
    }
    return [...g.entries()]
  }, [data, filter, cat])

  return (
    <AdminPageShell title="Catálogo e preços" subtitle="Estado de venda, pacote WHM, preços e renovação por ciclo. O checkout usa sempre estes valores.">
      {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
      {!data && !error && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#F5B700]" /></div>}
      {data && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categoria">
            {Object.entries(CAT_GROUPS).map(([k, g]) => (
              <button key={k} role="tab" aria-selected={cat === k} onClick={() => router.push(k === 'all' ? '/admin/site/catalog' : `/admin/site/catalog?cat=${k}`, { scroll: false })}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${cat === k ? 'bg-[#F5B700] border-[#F5B700] text-black' : 'bg-white border-[#E5E7EB] text-[#334155]'}`}>{g.label}</button>
            ))}
          </div>
          {cat !== 'dominios' && <input className={`${input} max-w-sm`} placeholder="Filtrar planos…" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar planos" />}
          {(cat === 'all' || cat === 'vps' || cat === 'servidores') && <section data-testid="vps-plans-admin">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">Planos VPS (/servidor-vps) — ficha, imagem, preços por ciclo e produto Hostinger</h2>
            <VpsPlansEditor onSaved={load} />
          </section>}
          {(['linux', 'windows'] as const).filter(k => cat === 'all' || cat === 'servidores' || cat === `dedicado-${k}`).map(k => (
            <section key={k} data-testid={`dedicated-plans-admin-${k}`}>
              <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">Planos Dedicado {k === 'linux' ? 'Linux (/servidor-dedicado)' : 'Windows (/servidor-dedicado-windows)'} — ficha, imagem, preços e descontos por período</h2>
              <DedicatedPlansEditor kind={k} onSaved={load} />
            </section>
          ))}
          {(cat === 'all' || cat === 'hosting') && <section data-testid="hosting-plans-admin">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">Planos de Hospedagem Premium — ficha, preço base e descontos por período</h2>
            <HostingPlansEditor onSaved={load} />
          </section>}
          {(cat === 'all' || cat === 'email') && <section data-testid="email-plans-admin">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">Planos de e-mail — ficha, preço base e descontos por período</h2>
            <EmailPlansEditor onSaved={load} />
          </section>}
          {groups.map(([k, list]) => (
            <section key={k}>
              <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">{k}</h2>
              <div className="space-y-2">{list.map(p => <ProductRow key={p.id} p={p} onSaved={load} />)}</div>
            </section>
          ))}
          {(cat === 'all' || cat === 'dominios') && <section data-testid="domains-section">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#64748B] mb-2">Domínios — extensões, preços e cartões da página inicial</h2>
            <DomainExtensionsEditor extensions={data.extensions} onSaved={load} />
            <NewExtension onSaved={load} />
          </section>}
        </div>
      )}
    </AdminPageShell>
  )
}
