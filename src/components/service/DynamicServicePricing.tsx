'use client'
import { useEffect, useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getPriceForCycle, formatKz, type BillingCycle, type Product } from '@/lib/products'

const BADGE_COLORS: Record<string, string> = {
  'MAIS POPULAR': 'bg-[#F5B700] text-black',
  'RECOMENDADO':  'bg-[#F5B700] text-black',
  'MELHOR VALOR': 'bg-green-500 text-white',
  'ENTERPRISE':   'bg-purple-600 text-white',
  'NOVO':         'bg-blue-600 text-white',
}

type ProductWithFeatures = Product & {
  product_features: { feature: string; included: boolean; position: number }[]
}

interface Props {
  category: string
  subcategory?: string
  title?: string
  subtitle?: string
  cols?: 2 | 3 | 4
  showBillingToggle?: boolean
  fallbackPlans?: { id: string; name: string; price: string; period?: string; description?: string; popular?: boolean; badge?: string; features: string[]; notIncluded?: string[]; cta?: string; href?: string }[]
}

const CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal', '6months': '6 Meses', '1year': 'Anual', '2years': '2 Anos', '3years': '3 Anos',
}
const CYCLE_DISCOUNTS: Record<BillingCycle, number> = {
  monthly: 0, '6months': 15, '1year': 30, '2years': 45, '3years': 55,
}

export function DynamicServicePricing({ category, subcategory, title = 'Escolha o plano ideal', subtitle = 'Todos os planos incluem suporte técnico especializado e garantia de 30 dias.', cols = 3, showBillingToggle = false, fallbackPlans }: Props) {
  const [plans, setPlans] = useState<ProductWithFeatures[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  useEffect(() => {
    const params = new URLSearchParams({ category })
    if (subcategory) params.set('subcategory', subcategory)

    fetch(`/api/products?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPlans(json.data as ProductWithFeatures[])
        } else if (!json.success) {
          console.error('[DynamicServicePricing] API error:', json.message, json.details)
        }
      })
      .catch(err => console.error('[DynamicServicePricing] fetch error:', err))
      .finally(() => setLoading(false))
  }, [category, subcategory])

  const gridClass: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
  }

  // Fallback to static plans if DB empty
  if (!loading && plans.length === 0 && fallbackPlans) {
    return (
      <section id="planos" className="bg-[#F8F8F8] py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="section-tag">Planos e Preços</span>
            <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title}</h2>
            <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{subtitle}</p>
          </div>
          <div className={`grid grid-cols-1 ${gridClass[cols]} gap-6 max-w-6xl mx-auto`}>
            {fallbackPlans.map(plan => (
              <div key={plan.id} className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 ${plan.popular ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_8px_40px_rgba(245,183,0,0.20)]' : 'bg-white border border-[#E8E8E8] shadow-sm hover:shadow-md'}`}>
                {plan.badge && (
                  <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                    <span className={`text-[10px] font-black px-4 py-1.5 rounded-full ${BADGE_COLORS[plan.badge] ?? 'bg-[#F5B700] text-black'}`}>{plan.badge}</span>
                  </div>
                )}
                <div className="p-7 flex-1">
                  <h3 className={`font-bold text-base mb-1 ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>{plan.name}</h3>
                  {plan.description && <p className={`text-xs mb-4 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>{plan.description}</p>}
                  <div className="mb-6">
                    <span className={`text-3xl font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>{plan.price}</span>
                    {plan.period && <span className={`text-sm ml-1 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>{plan.period}</span>}
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map(f => <li key={f} className="flex items-start gap-2.5 text-sm"><Check size={14} className={`mt-0.5 shrink-0 ${plan.popular ? 'text-[#F5B700]' : 'text-green-500'}`} /><span className={plan.popular ? 'text-gray-300' : 'text-[#444]'}>{f}</span></li>)}
                    {plan.notIncluded?.map(f => <li key={f} className="flex items-start gap-2.5 text-sm opacity-40"><X size={14} className="mt-0.5 shrink-0 text-gray-400" /><span className={plan.popular ? 'text-gray-500' : 'text-[#888]'}>{f}</span></li>)}
                  </ul>
                </div>
                <div className="px-7 pb-7">
                  <Link href={plan.href ?? `/checkout?plan=${plan.id}`} className={`block w-full text-center py-3 rounded-xl text-sm font-bold transition-all ${plan.popular ? 'btn-primary btn-shimmer' : 'bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]'}`}>{plan.cta ?? 'Começar Agora'}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="planos" className="bg-[#F8F8F8] py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="section-tag">Planos e Preços</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title}</h2>
          <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{subtitle}</p>

          {showBillingToggle && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-1 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm overflow-x-auto max-w-full" style={{ scrollbarWidth: 'none' }}>
                {(Object.keys(CYCLE_LABELS) as BillingCycle[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setBilling(c)}
                    className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl font-semibold text-xs transition-all whitespace-nowrap ${billing === c ? 'bg-[#F5B700] text-[#0A0A0A] shadow-sm' : 'text-gray-500 hover:text-[#0A0A0A]'}`}
                  >
                    {CYCLE_LABELS[c]}
                    {CYCLE_DISCOUNTS[c] > 0 && <span className="ml-1 opacity-70">-{CYCLE_DISCOUNTS[c]}%</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#F5B700]" /></div>
        ) : (
          <div className={`grid grid-cols-1 ${gridClass[cols]} gap-6 max-w-6xl mx-auto`}>
            {plans.map(plan => {
              const price = getPriceForCycle(plan, billing)
              const monthlyPrice = plan.price_monthly
              const features = [...(plan.product_features ?? [])].sort((a, b) => a.position - b.position)
              const checkoutHref = plan.href_override ?? `/checkout?plan=${plan.slug}&billing=${billing}`

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                    plan.popular
                      ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_8px_40px_rgba(245,183,0,0.20)]'
                      : 'bg-white border border-[#E8E8E8] shadow-sm hover:shadow-md'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full ${BADGE_COLORS[plan.badge] ?? 'bg-[#F5B700] text-black'}`}>
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-7 flex-1">
                    <h3 className={`font-bold text-base mb-1 ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>{plan.name}</h3>
                    {plan.description && (
                      <p className={`text-xs mb-4 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>{plan.description}</p>
                    )}

                    <div className="mb-6">
                      {price != null ? (
                        <>
                          <span className={`text-3xl font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>
                            {formatKz(price)}
                          </span>
                          <span className={`text-sm ml-1 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>/mês</span>
                          {showBillingToggle && billing !== 'monthly' && monthlyPrice && price < monthlyPrice && (
                            <div className="text-xs text-green-500 font-semibold mt-1">
                              ✓ Poupa {formatKz(monthlyPrice - price)}/mês
                            </div>
                          )}
                        </>
                      ) : (
                        <span className={`text-2xl font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>Sob consulta</span>
                      )}
                    </div>

                    <ul className="space-y-2.5">
                      {features.filter(f => f.included).map(f => (
                        <li key={f.feature} className="flex items-start gap-2.5 text-sm">
                          <Check size={14} className={`mt-0.5 shrink-0 ${plan.popular ? 'text-[#F5B700]' : 'text-green-500'}`} />
                          <span className={plan.popular ? 'text-gray-300' : 'text-[#444]'}>{f.feature}</span>
                        </li>
                      ))}
                      {features.filter(f => !f.included).map(f => (
                        <li key={f.feature} className="flex items-start gap-2.5 text-sm opacity-40">
                          <X size={14} className="mt-0.5 shrink-0 text-gray-400" />
                          <span className={plan.popular ? 'text-gray-500' : 'text-[#888]'}>{f.feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="px-7 pb-7">
                    <Link
                      href={checkoutHref}
                      className={`block w-full text-center py-3 rounded-xl text-sm font-bold transition-all ${
                        plan.popular
                          ? 'btn-primary btn-shimmer shadow-[0_4px_16px_rgba(245,183,0,0.30)]'
                          : 'bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]'
                      }`}
                    >
                      {(plan as any).cta_label ?? 'Começar Agora'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
