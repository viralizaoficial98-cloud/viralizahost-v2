'use client'
import { useEffect, useState } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getPriceForCycle, type BillingCycle, type Product } from '@/lib/products'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'
import { PlansCarousel } from './PlansCarousel'
import type { ReactNode } from 'react'

const BADGE_COLORS: Record<string, string> = {
  'MAIS POPULAR': 'bg-[#F5B700] text-black',
  'RECOMENDADO':  'bg-[#F5B700] text-black',
  'MELHOR VALOR': 'bg-green-500 text-white',
  'ENTERPRISE':   'bg-purple-600 text-white',
  'NOVO':         'bg-blue-600 text-white',
}

type ProductWithFeatures = Product & {
  product_features: { feature: string; included: boolean; position: number }[]
  product_prices?: { cycle: BillingCycle; months: number; price: number; renewal_price: number; active: boolean | number }[]
  sale_status?: 'active' | 'draft' | 'on_request'
  pricing_note?: string | null
}

/** Preço do ciclo a partir do catálogo (product_prices): total cobrado e equivalente mensal. */
function cyclePrice(plan: ProductWithFeatures, cycle: BillingCycle) {
  const row = (plan.product_prices ?? []).find(r => r.cycle === cycle && Number(r.active) === 1)
  if (row) return { total: Number(row.price), months: Number(row.months), perMonth: Number(row.price) / Number(row.months), renewal: Number(row.renewal_price) }
  if (plan.product_prices?.length) return null
  const legacy = getPriceForCycle(plan, cycle)
  return legacy == null ? null : { total: null, months: 1, perMonth: legacy, renewal: null }
}

/** Numeric AOA price supported alongside legacy string price */
export interface FallbackPlan {
  id: string
  name: string
  price: string
  priceAOA?: number
  period?: string
  description?: string
  popular?: boolean
  badge?: string
  features: string[]
  notIncluded?: string[]
  cta?: string
  href?: string
}

interface Props {
  category: string
  subcategory?: string
  title?: string
  subtitle?: string
  cols?: 2 | 3 | 4
  showBillingToggle?: boolean
  fallbackPlans?: FallbackPlan[]
  /** Mostra os planos numa única linha com setas (carrossel) em vez de grelha */
  carousel?: boolean
}

const CYCLE_KEYS: BillingCycle[] = ['monthly', '3months', '6months', '1year', '2years', '3years']

function PlansWrap({ carousel, gridClass, children }: { carousel: boolean; gridClass: string; children: ReactNode }) {
  return carousel
    ? <PlansCarousel>{children}</PlansCarousel>
    : <div className={`grid grid-cols-1 ${gridClass} gap-6 max-w-6xl mx-auto`}>{children}</div>
}

export function DynamicServicePricing({ category, subcategory, title, subtitle, cols = 3, showBillingToggle = false, fallbackPlans, carousel = false }: Props) {
  const { t, formatCurrency, currency } = useLocale()
  const [plans, setPlans] = useState<ProductWithFeatures[]>([])
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  const defaultTitle = t('plans.features') !== 'plans.features' ? t('cta.viewPlans') : 'Escolha o plano ideal'
  const defaultSubtitle = t('plans.support247') !== 'plans.support247'
    ? `${t('plans.ssl')} · ${t('plans.backup')} · ${t('plans.moneyBack')}`
    : 'Todos os planos incluem suporte técnico especializado e garantia de 30 dias.'

  const CYCLE_LABELS: Record<BillingCycle, string> = {
    monthly:   t('billing.monthly'),
    '3months': 'Trimestral',
    '6months': t('billing.6months'),
    '1year':   t('billing.1year'),
    '2years':  t('billing.2years'),
    '3years':  t('billing.3years'),
  }

  useEffect(() => {
    const params = new URLSearchParams({ category })
    if (subcategory) params.set('subcategory', subcategory)
    fetch(`/api/products?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setPlans(json.data as ProductWithFeatures[])
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

  const fmtAOA = (aoa: number) => formatCurrency(convertFromAOA(aoa, currency))

  // Fallback to static plans if DB empty
  if (!loading && plans.length === 0 && fallbackPlans) {
    return (
      <section id="planos" className="bg-[#F8F8F8] py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="section-tag">{t('billing.bestValue') !== 'billing.bestValue' ? t('billing.bestValue') : 'Planos e Preços'}</span>
            <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title ?? defaultTitle}</h2>
            <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{subtitle ?? defaultSubtitle}</p>
          </div>
          <PlansWrap carousel={carousel} gridClass={gridClass[cols]}>
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
                    {/* Sem catálogo carregado não se mostram preços fixos: o preço vem sempre do servidor no carrinho */}
                    <span className={`text-lg font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>Preço confirmado no carrinho</span>
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map(f => <li key={f} className="flex items-start gap-2.5 text-sm"><Check size={14} className={`mt-0.5 shrink-0 ${plan.popular ? 'text-[#F5B700]' : 'text-green-500'}`} /><span className={plan.popular ? 'text-gray-300' : 'text-[#444]'}>{f}</span></li>)}
                    {plan.notIncluded?.map(f => <li key={f} className="flex items-start gap-2.5 text-sm opacity-40"><X size={14} className="mt-0.5 shrink-0 text-gray-400" /><span className={plan.popular ? 'text-gray-500' : 'text-[#888]'}>{f}</span></li>)}
                  </ul>
                </div>
                <div className="px-7 pb-7">
                  <Link href={plan.href ?? `/checkout?plan=${plan.id}`} className={`block w-full text-center py-3 rounded-xl text-sm font-bold transition-all ${plan.popular ? 'btn-primary btn-shimmer' : 'bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]'}`}>
                    {plan.cta ?? t('cta.start')}
                  </Link>
                </div>
              </div>
            ))}
          </PlansWrap>
        </div>
      </section>
    )
  }

  return (
    <section id="planos" className="bg-[#F8F8F8] py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="section-tag">{t('billing.bestValue') !== 'billing.bestValue' ? t('billing.bestValue') : 'Planos e Preços'}</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{title ?? defaultTitle}</h2>
          <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{subtitle ?? defaultSubtitle}</p>

          {showBillingToggle && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-1 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm overflow-x-auto max-w-full" style={{ scrollbarWidth: 'none' }}>
                {CYCLE_KEYS.map(c => (
                  <button
                    key={c}
                    onClick={() => setBilling(c)}
                    className={`shrink-0 px-3 sm:px-4 py-2 rounded-xl font-semibold text-xs transition-all whitespace-nowrap ${billing === c ? 'bg-[#F5B700] text-[#0A0A0A] shadow-sm' : 'text-gray-500 hover:text-[#0A0A0A]'}`}
                  >
                    {CYCLE_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#F5B700]" /></div>
        ) : (
          <PlansWrap carousel={carousel} gridClass={gridClass[cols]}>
            {plans.map(plan => {
              const cp = cyclePrice(plan, billing)
              const price = cp?.perMonth ?? null
              const monthlyPrice = cyclePrice(plan, 'monthly')?.perMonth ?? null
              const onRequest = plan.sale_status === 'on_request'
              const features = [...(plan.product_features ?? [])].sort((a, b) => a.position - b.position)
              const checkoutHref = onRequest
                ? `/tickets?assunto=${encodeURIComponent(`Pedido de proposta — ${plan.name}`)}`
                : plan.href_override ?? `/checkout?plan=${plan.slug}&billing=${billing}`

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
                      {onRequest ? (
                        <>
                          <span className={`text-2xl font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>Sob consulta</span>
                          {plan.pricing_note && <p className={`text-xs mt-1 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>{plan.pricing_note}</p>}
                        </>
                      ) : price != null ? (
                        <>
                          <span className={`text-3xl font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>
                            {fmtAOA(price)}
                          </span>
                          <span className={`text-sm ml-1 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>{t('billing.perMonth')}</span>
                          {cp?.total != null && cp.months > 1 && (
                            <p className={`text-xs mt-1 ${plan.popular ? 'text-gray-400' : 'text-[#666]'}`}>Cobrado {fmtAOA(cp.total)} por {cp.months} meses</p>
                          )}
                          {cp?.renewal != null && (
                            <p className={`text-[11px] mt-0.5 ${plan.popular ? 'text-gray-500' : 'text-[#999]'}`}>Renova por {fmtAOA(cp.renewal)}{cp.months > 1 ? ` / ${cp.months} meses` : t('billing.perMonth')}</p>
                          )}
                          {showBillingToggle && billing !== 'monthly' && monthlyPrice && price < monthlyPrice - 0.5 && (
                            <div className="text-xs text-green-500 font-semibold mt-1">
                              ✓ {t('billing.save')} {fmtAOA(monthlyPrice - price)}{t('billing.perMonth')}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className={`text-2xl font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>
                          {t('cta.talkSales')}
                        </span>
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
                      {onRequest ? 'Pedir proposta' : (plan as any).cta_label ?? t('cta.start')}
                    </Link>
                  </div>
                </div>
              )
            })}
          </PlansWrap>
        )}
      </div>
    </section>
  )
}
