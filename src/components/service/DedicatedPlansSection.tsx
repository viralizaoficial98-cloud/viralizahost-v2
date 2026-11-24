'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { impliedDiscount, selectorBadge } from '@/lib/commerce/period-pricing'
import { isVpsIcon } from '@/lib/commerce/vps-shared'
import { DEDICATED_CYCLES, DEDICATED_KINDS, dedicatedSpecLines, type DedicatedKind, type DedicatedSpecs } from '@/lib/commerce/dedicated-shared'
import { VpsPlanBand, type VpsBandPlan } from './VpsPlansSection'

// Servidores Dedicados Linux / Windows: a mesma faixa da página Servidor VPS (imagem à esquerda, especificações com
// ícones ao centro, preço e «Comprar agora» à direita; em coluna no telemóvel). Só planos publicados e ciclos
// publicados. «Comprar agora» → /comprar/<plano>?ciclo=… (compra de dedicados: activação manual, sem Hostinger).

type ApiPlan = {
  id: string; slug: string; name: string; description: string | null; badge: string | null; popular: boolean | number; sale_status?: string
  base_monthly_price?: number | string | null; plan_specs?: DedicatedSpecs | string | null; image_path?: string | null
  product_features?: { feature: string; included: boolean | number; position: number; icon?: string | null }[]
  product_prices?: { cycle: string; months: number; price: number | string; renewal_price: number | string | null; active: number | boolean; discount_pct?: number }[]
}
const on = (v: unknown) => v === true || Number(v) === 1
const imageUrl = (p?: string | null) => p ? `/storage/v1/object/public/catalog-assets/${p.split('/').map(encodeURIComponent).join('/')}` : null

export function toDedicatedBand(p: ApiPlan, cycle: string): VpsBandPlan {
  const base = p.base_monthly_price != null ? Number(p.base_monthly_price) : null
  let specs: DedicatedSpecs = {}
  try { specs = (typeof p.plan_specs === 'string' ? JSON.parse(p.plan_specs) : p.plan_specs) ?? {} } catch { specs = {} }
  const r = (p.product_prices ?? []).find(x => x.cycle === cycle && on(x.active))
  const c = DEDICATED_CYCLES.find(x => x.cycle === cycle)
  const months = r ? Number(r.months) : 1, total = r ? Number(r.price) : 0
  return {
    slug: p.slug, name: p.name, summary: p.description, badge: p.badge, highlight: on(p.popular), imageUrl: imageUrl(p.image_path), specs: {}, specLines: dedicatedSpecLines(specs), base,
    features: [...(p.product_features ?? [])].filter(f => on(f.included)).sort((a, b) => a.position - b.position).map(f => ({ text: f.feature, icon: isVpsIcon(f.icon) ? f.icon : null })),
    period: r ? { cycle, months, label: c?.label ?? `${months} meses`, total, renewal: r.renewal_price != null ? Number(r.renewal_price) : null, discount: base != null ? impliedDiscount(total, base, months) : Number(r.discount_pct ?? 0) } : null,
  }
}

export function DedicatedPlansSection({ kind, id = 'planos', title, subtitle }: { kind: DedicatedKind; id?: string; title: ReactNode; subtitle?: string }) {
  const K = DEDICATED_KINDS[kind]
  const { formatCurrency, currency } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  const [plans, setPlans] = useState<ApiPlan[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [cycle, setCycle] = useState<string>('monthly')
  useEffect(() => {
    fetch(`/api/products?category=${K.category}`, { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.message ?? `HTTP ${r.status}`); return j })
      .then(j => {
        // Publicados com período activo; e os «sob consulta» (pedido de proposta, como antes)
        const list = (j.data as ApiPlan[]).filter(p => (p.sale_status === 'active' && (p.product_prices ?? []).some(x => on(x.active))) || p.sale_status === 'on_request')
        setPlans(list); setState(list.length ? 'ok' : 'empty')
      })
      .catch(() => setState('error'))
  }, [attempt, K.category])
  const cycles = useMemo(() => DEDICATED_CYCLES.map(c => {
    const bands = plans.filter(p => p.sale_status === 'active').map(p => toDedicatedBand(p, c.cycle)).filter(b => b.period)
    return { ...c, available: bands.length > 0, badge: selectorBadge(bands.map(b => b.period!.discount)) }
  }).filter(c => c.available), [plans])
  const active = cycles.some(c => c.cycle === cycle) ? cycle : cycles[0]?.cycle ?? 'monthly'

  return (
    <section id={id} className="bg-[#F8F8F8] py-16 sm:py-20" data-testid="ded-plans-section" data-kind={kind}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <span className="section-tag">{K.label}</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title}</h2>
          {subtitle && <p className="text-[#666] max-w-2xl mx-auto text-sm md:text-base">{subtitle}</p>}
          {state === 'ok' && cycles.length > 1 && (
            <div className="flex justify-center mt-6">
              <div className="grid grid-cols-3 sm:flex gap-1 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm w-full max-w-lg sm:w-auto" role="radiogroup" aria-label="Período de contratação">
                {cycles.map(c => (
                  <button key={c.cycle} role="radio" aria-checked={active === c.cycle} onClick={() => setCycle(c.cycle)} data-testid={`ded-period-${c.cycle}`}
                    className={`flex flex-col items-center px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${active === c.cycle ? 'bg-[#F5B700] text-[#0A0A0A]' : 'text-gray-500 hover:text-[#0A0A0A]'}`}>
                    {c.label}{c.badge && <span className={`text-[10px] font-black ${active === c.cycle ? 'text-[#0A0A0A]' : 'text-green-600'}`}>{c.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {state === 'loading' && <div className="flex justify-center py-16" role="status" aria-label="A carregar planos"><Loader2 size={32} className="animate-spin text-[#F5B700]" /></div>}
        {state === 'error' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-red-200 rounded-2xl p-8" role="alert" data-testid="plans-error">
            <p className="font-bold text-[#0A0A0A]">Não foi possível carregar os planos.</p>
            <button onClick={() => { setState('loading'); setAttempt(a => a + 1) }} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B700] text-[#0A0A0A]">Tentar novamente</button>
          </div>
        )}
        {state === 'empty' && (
          <div className="max-w-xl mx-auto text-center bg-white border border-[#E8E8E8] rounded-2xl p-8" data-testid="plans-empty">
            <p className="font-bold text-[#0A0A0A]">Os planos {K.short} são configurados à medida.</p>
            <p className="text-sm text-[#666] mt-1">Fale com a equipa para receber uma proposta com o hardware e o período que precisa.</p>
            <Link href="/suporte/contactar" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white">Pedir proposta</Link>
          </div>
        )}
        {state === 'ok' && (
          <div className="space-y-5 max-w-6xl mx-auto">
            {plans.map(p => {
              const onRequest = p.sale_status === 'on_request', b = { ...toDedicatedBand(p, active), onRequest }
              return <VpsPlanBand key={p.id} tid="ded" plan={b} fmt={fmt} href={onRequest ? `/comprar/${p.slug}` : b.period ? `/comprar/${p.slug}?ciclo=${active}` : undefined} />
            })}
          </div>
        )}
        <p className="text-center text-gray-400 text-xs sm:text-sm mt-8">Escolha o plano e o período e reveja o total antes de pagar. A equipa activa o servidor depois do pagamento confirmado.</p>
      </div>
    </section>
  )
}
