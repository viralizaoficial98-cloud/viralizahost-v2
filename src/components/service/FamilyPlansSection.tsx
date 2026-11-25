'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Check, Layers, X } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { selectorBadge } from '@/lib/commerce/period-pricing'
import { FAMILY_PERIODS } from '@/lib/commerce/plan-families'
import { isVpsIcon, type VpsIcon } from '@/lib/commerce/vps-shared'
import { FEATURE_ICONS } from './VpsPlansSection'

// Planos de Revenda, Criador de Sites e Construtor WordPress (Catálogo e Preços). Dados do servidor (catálogo):
// o total de cada período é o valor guardado em product_prices (o mesmo que a cotação e o carrinho cobram);
// equivalente mensal = total ÷ meses. Preço riscado e «Poupe X%» só quando há desconto face ao preço base.

export interface FamilyCardPlan {
  slug: string; name: string; description: string | null; badge: string | null; highlight: boolean; onRequest: boolean; base: number | null
  /** Pela ordem do painel; included=false (planos antigos) aparece riscado. Texto simples (nunca HTML). */
  features: { text: string; icon: VpsIcon | null; included?: boolean }[]; periods: { cycle: string; months: number; total: number; renewal: number; discount: number }[]
}
const monthsLabel = (m: number) => (m === 1 ? '1 mês' : m % 12 === 0 ? `${m / 12} ${m === 12 ? 'ano' : 'anos'}` : `${m} meses`)

/** Cartão de plano (página pública e pré-visualização do painel). */
export function FamilyPlanCard({ plan, cycle, fmt, preview = false }: { plan: FamilyCardPlan; cycle: string; fmt: (v: number) => string; preview?: boolean }) {
  const dark = plan.highlight
  const muted = dark ? 'text-gray-400' : 'text-[#777]'
  const pr = plan.periods.find(p => p.cycle === cycle) ?? null
  const perMonth = pr ? pr.total / pr.months : null
  const showDiscount = !!pr && pr.discount > 0 && plan.base != null && perMonth != null && plan.base > perMonth
  const href = plan.onRequest ? `/comprar/${plan.slug}` : pr ? `/comprar/${plan.slug}?ciclo=${pr.cycle}` : null
  return (
    <div data-testid="fam-plan-card" data-slug={plan.slug}
      className={`relative rounded-2xl flex flex-col h-full transition-all duration-300 ${preview ? '' : 'hover:-translate-y-1'} ${dark ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_8px_40px_rgba(245,183,0,0.20)]' : 'bg-white border border-[#E8E8E8] shadow-sm hover:shadow-md'}`}>
      {plan.badge && (
        <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
          <span className="text-[10px] font-black px-4 py-1.5 rounded-full bg-[#F5B700] text-black uppercase" data-testid="fam-plan-badge">{plan.badge}</span>
        </div>
      )}
      <div className="p-6 sm:p-7 flex-1 flex flex-col">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,183,0,0.12)' }}><Layers size={18} className="text-[#F5B700]" /></div>
          <h3 className={`font-bold text-base leading-tight ${dark ? 'text-white' : 'text-[#0A0A0A]'}`} data-testid="fam-plan-name">{plan.name}</h3>
        </div>
        {plan.description && <p className={`text-xs mt-2 ${muted}`} data-testid="fam-plan-description">{plan.description}</p>}

        <div className="my-5 sm:min-h-[104px]">
          {plan.onRequest ? (
            <span className={`text-2xl font-black ${dark ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`} data-testid="fam-plan-onrequest">Sob consulta</span>
          ) : pr && perMonth != null ? (
            <>
              <div className="flex items-center gap-2 h-5">
                {showDiscount && <span className={`text-sm line-through ${muted}`} data-testid="fam-plan-list">{fmt(plan.base!)}</span>}
                {showDiscount && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700" data-testid="fam-plan-discount">Poupe {pr.discount}%</span>}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-1">
                <span className={`text-[28px] leading-tight font-black ${dark ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`} data-testid="fam-plan-monthly">{fmt(perMonth)}</span>
                <span className={`text-sm ${muted}`}>/mês</span>
              </div>
              <p className={`text-xs mt-1 ${dark ? 'text-gray-300' : 'text-[#444]'}`}>A pagar agora: <strong data-testid="fam-plan-total">{fmt(pr.total)}</strong>{pr.months > 1 ? ` por ${monthsLabel(pr.months)}` : ' (1 mês)'}</p>
              <p className={`text-[11px] ${muted}`} data-testid="fam-plan-renewal">Renova por {fmt(pr.renewal)} a cada {monthsLabel(pr.months)}</p>
            </>
          ) : (
            <p className={`text-sm ${muted}`} data-testid="fam-plan-unavailable">Não disponível neste período.</p>
          )}
        </div>

        {plan.features.some(f => f.text.trim()) && (
          <ul className="space-y-2 mb-6 flex-1" data-testid="fam-plan-features">
            {plan.features.filter(f => f.text.trim()).map((f, i) => {
              const off = f.included === false
              const I = off ? X : f.icon && isVpsIcon(f.icon) ? FEATURE_ICONS[f.icon] : Check
              return (
                <li key={i} className={`flex items-start gap-2 text-sm ${off ? `line-through ${muted}` : dark ? 'text-gray-200' : 'text-[#333]'}`} data-testid="fam-plan-feature" data-icon={off ? 'x' : f.icon ?? 'check'} data-included={off ? '0' : '1'}>
                  <I size={15} className={`${off ? 'text-gray-400' : 'text-[#F5B700]'} shrink-0 mt-0.5`} aria-hidden="true" />{f.text}
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-auto pt-2">
          {href && !preview ? (
            <Link href={href} data-testid="fam-plan-cta"
              className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-all ${dark ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#E5A800]' : 'bg-[#0A0A0A] text-white hover:bg-[#222]'}`}>
              {plan.onRequest ? 'Pedir proposta' : 'Comprar agora'}
            </Link>
          ) : <span className={`block w-full text-center py-3 rounded-xl font-bold text-sm ${dark ? 'bg-[#F5B700] text-[#0A0A0A]' : 'bg-[#0A0A0A] text-white'} ${href ? '' : 'opacity-40'}`}>{plan.onRequest ? 'Pedir proposta' : 'Comprar agora'}</span>}
        </div>
      </div>
    </div>
  )
}

export function FamilyPlansSection({ plans, title, subtitle, tag = 'Planos e preços', id = 'planos', testId }: { plans: FamilyCardPlan[]; title: string; subtitle?: string; tag?: string; id?: string; testId?: string }) {
  const { formatCurrency, currency } = useLocale()
  const fmt = (v: number) => formatCurrency(convertFromAOA(v, currency))
  // Só os 4 períodos de novas contratações que algum plano publica; etiqueta do selector a partir dos descontos
  const periods = useMemo(() => FAMILY_PERIODS.map(per => {
    const ds = plans.flatMap(p => p.periods.filter(x => x.cycle === per.cycle).map(x => x.discount))
    return { ...per, available: ds.length > 0, badge: selectorBadge(ds) }
  }).filter(p => p.available), [plans])
  const [cycle, setCycle] = useState<string>(() => periods.find(p => p.cycle === 'monthly')?.cycle ?? periods[0]?.cycle ?? 'monthly')
  const cols = plans.length >= 4 ? 'lg:grid-cols-4' : plans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'

  return (
    <section id={id} className="bg-[#F8F8F8] py-20 scroll-mt-24" data-testid={testId ?? 'family-plans-section'}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="section-tag">{tag}</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title}</h2>
          {subtitle && <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{subtitle}</p>}
          {periods.length > 1 && (
            <div className="flex justify-center mt-6">
              <div className="grid grid-cols-2 sm:flex gap-1 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm w-full max-w-md sm:w-auto" role="radiogroup" aria-label="Período de contratação">
                {periods.map(per => (
                  <button key={per.cycle} type="button" role="radio" aria-checked={cycle === per.cycle} data-testid={`fam-period-${per.cycle}`} onClick={() => setCycle(per.cycle)}
                    className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${cycle === per.cycle ? 'bg-[#F5B700] text-[#0A0A0A] shadow-sm' : 'text-gray-500 hover:text-[#0A0A0A]'}`}>
                    {per.label}
                    {per.badge && <span className={`text-[10px] font-black ${cycle === per.cycle ? 'text-[#0A0A0A]' : 'text-green-600'}`}>{per.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {plans.length === 0 ? (
          <div className="max-w-xl mx-auto text-center bg-white border border-[#E8E8E8] rounded-2xl p-8" data-testid="fam-plans-empty">
            <p className="font-bold text-[#0A0A0A]">Ainda não há planos publicados.</p>
            <Link href="/suporte/contactar" className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#0A0A0A] text-white">Falar com a equipa</Link>
          </div>
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-6 max-w-6xl mx-auto pt-4`}>
            {plans.map(p => <FamilyPlanCard key={p.slug} plan={p} cycle={cycle} fmt={fmt} />)}
          </div>
        )}
        <p className="text-center text-xs text-[#888] mt-8">Períodos de 1 mês, 1, 2 e 3 anos, pagos antecipadamente · a renovação é indicada em cada plano</p>
      </div>
    </section>
  )
}
