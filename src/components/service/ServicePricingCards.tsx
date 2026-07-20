'use client'
import Link from 'next/link'
import { Check, X, Star } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'

export interface PricingPlan {
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

interface ServicePricingCardsProps {
  plans: PricingPlan[]
  title?: string
  subtitle?: string
  cols?: 2 | 3 | 4
}

const BADGE_COLORS: Record<string, string> = {
  'MAIS POPULAR': 'bg-[#F5B700] text-black',
  'RECOMENDADO': 'bg-[#F5B700] text-black',
  'MELHOR VALOR': 'bg-green-500 text-white',
  'ENTERPRISE': 'bg-purple-600 text-white',
  'NOVO': 'bg-blue-600 text-white',
}

export function ServicePricingCards({
  plans,
  title,
  subtitle,
  cols = 3,
}: ServicePricingCardsProps) {
  const { t, formatCurrency, currency } = useLocale()
  const fmtAOA = (aoa: number) => formatCurrency(convertFromAOA(aoa, currency))

  const resolvedTitle = title ?? (t('home.plansTitle') !== 'home.plansTitle' ? t('home.plansTitle') : 'Escolha o plano ideal')
  const resolvedSubtitle = subtitle ?? (t('plans.support247') !== 'plans.support247'
    ? `${t('plans.ssl')} · ${t('plans.backup')} · ${t('plans.moneyBack')}`
    : 'Todos os planos incluem suporte técnico especializado e garantia de 30 dias.')

  const gridClass: Record<number, string> = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
  }

  return (
    <section id="planos" className="bg-[#F8F8F8] py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="section-tag">{t('billing.bestValue') !== 'billing.bestValue' ? t('billing.bestValue') : 'Planos e Preços'}</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-3">{resolvedTitle}</h2>
          <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">{resolvedSubtitle}</p>
        </div>

        <div className={`grid grid-cols-1 ${gridClass[cols]} gap-6 max-w-6xl mx-auto`}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                plan.popular
                  ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_8px_40px_rgba(245,183,0,0.20)]'
                  : 'bg-white border border-[#E8E8E8] shadow-[0_2px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                  <span className={`text-[10px] font-black px-4 py-1.5 rounded-full ${BADGE_COLORS[plan.badge] ?? 'bg-[#F5B700] text-black'}`}>
                    {plan.badge === 'MAIS POPULAR' && <Star size={9} className="inline mr-1" />}
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="p-7 flex-1">
                <h3 className={`font-bold text-base mb-1 ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className={`text-xs mb-4 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>{plan.description}</p>
                )}

                <div className="mb-6">
                  <span className={`text-3xl font-black ${plan.popular ? 'text-[#F5B700]' : 'text-[#0A0A0A]'}`}>
                    {plan.priceAOA != null ? fmtAOA(plan.priceAOA) : plan.price}
                  </span>
                  {plan.period && (
                    <span className={`text-sm ml-1 ${plan.popular ? 'text-gray-400' : 'text-[#888]'}`}>{t('billing.perMonth')}</span>
                  )}
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check size={14} className={`mt-0.5 shrink-0 ${plan.popular ? 'text-[#F5B700]' : 'text-green-500'}`} />
                      <span className={plan.popular ? 'text-gray-300' : 'text-[#444]'}>{f}</span>
                    </li>
                  ))}
                  {plan.notIncluded?.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm opacity-40">
                      <X size={14} className="mt-0.5 shrink-0 text-gray-400" />
                      <span className={plan.popular ? 'text-gray-500' : 'text-[#888]'}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-7 pb-7">
                <Link
                  href={plan.href ?? `/checkout?plan=${plan.id}`}
                  className={`block w-full text-center py-3 rounded-xl text-sm font-bold transition-all ${
                    plan.popular
                      ? 'btn-primary btn-shimmer shadow-[0_4px_16px_rgba(245,183,0,0.30)]'
                      : 'bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]'
                  }`}
                >
                  {plan.cta ?? t('cta.start')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
