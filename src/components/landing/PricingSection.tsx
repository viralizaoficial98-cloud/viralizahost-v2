'use client'
import Link from 'next/link'
import { Check, X, Zap, Crown, Rocket, Users, Server } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { useLocale } from '@/hooks/useLocale'
import { Currency } from '@/types'

// AOA base conversion rates
const AOA_RATES: Record<Currency, number> = { AKZ: 1, BRL: 0.0042, USD: 0.00109 }

// Static fallback plans shown before DB loads

type ProductFeature = { feature: string; included: boolean; position: number }

type DbPlan = {
  id: string
  slug: string
  name: string
  description: string | null
  badge: string | null
  price_monthly: number | null
  price_1year: number | null
  popular: boolean
  active: boolean
  position: number
  cta_label: string | null
  product_features: ProductFeature[]
}

const PLAN_ICONS = [Zap, Rocket, Crown, Users, Server]
const PLAN_ACCENTS = ['#3B82F6', '#F5B700', '#8B5CF6', '#EF4444', '#10B981']

export function PricingSection() {
  const { currency } = useCurrency()
  const { t, formatCurrency } = useLocale()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  // Convert AOA price to selected currency
  const convertFromAOA = (aoa: number | null) => {
    if (aoa == null) return null
    return aoa * AOA_RATES[currency]
  }
  const [dbPlans, setDbPlans] = useState<DbPlan[] | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'empty' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    fetch('/api/products?category=hosting', { cache: 'no-store' })
      .then(async r => { const json = await r.json(); if (!r.ok || !json.success) throw new Error(json.message ?? `HTTP ${r.status}`); return json })
      .then(json => {
        const list = Array.isArray(json.data) ? json.data.filter((p: { sale_status?: string }) => p.sale_status !== 'on_request') : []
        if (list.length) setDbPlans(list as DbPlan[]); else setLoadState('empty')
      })
      .catch(err => { console.error('[PricingSection] fetch error:', err); setLoadState('error') })
  }, [attempt])


  // Shared layout — DB plans use product_features, fallback uses hardcoded features
  const renderSection = (cards: React.ReactNode) => (
    <section id="planos" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />
      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">{t('plans.ssl')} · {t('plans.cpanel')} · {t('plans.backup')}</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            {t('hosting.title') !== 'hosting.title' ? t('hosting.title') : 'Hospedagem'} <span className="gradient-text">Premium</span>
          </h2>
          <p className="text-gray-500 text-base sm:text-xl max-w-2xl mx-auto mb-8">
            {t('plans.ssl')}, {t('plans.cpanel')}, {t('plans.backup')}, {t('plans.support247')}.
          </p>
          <div className="inline-flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                billing === 'monthly' ? 'bg-[#0A0A0A] text-white shadow-sm' : 'text-gray-500 hover:text-[#0A0A0A]'
              }`}
            >
              {t('billing.monthly')}
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                billing === 'annual' ? 'bg-[#F5B700] text-[#0A0A0A] shadow-sm' : 'text-gray-500 hover:text-[#0A0A0A]'
              }`}
            >
              {t('billing.annual')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {cards}
        </div>
        <p className="text-center text-gray-400 text-sm mt-10">
          ✓ Preços em kwanzas &nbsp;•&nbsp; ✓ Renovação indicada em cada plano &nbsp;•&nbsp; ✓ Pagamento por transferência bancária
        </p>
      </div>
    </section>
  )

  // DB plans loaded — render with live product_features
  if (dbPlans) {
    return renderSection(
      dbPlans.map((plan, i) => {
        const Icon   = PLAN_ICONS[i % PLAN_ICONS.length]
        const accent = PLAN_ACCENTS[i % PLAN_ACCENTS.length]
        const rawPrice  = billing === 'annual' && plan.price_1year ? plan.price_1year : plan.price_monthly
        const rawOriginalPrice = plan.price_monthly
        const price = convertFromAOA(rawPrice)
        const originalPrice = convertFromAOA(rawOriginalPrice)

        // Sort features by position; features without position fall to end
        const features = [...(plan.product_features ?? [])].sort((a, b) => a.position - b.position)

        return (
          <div
            key={plan.id}
            className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover-lift ${
              plan.popular
                ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_20px_60px_rgba(0,0,0,0.15)]'
                : 'bg-white border border-[#E8E8E8] shadow-sm hover:border-[#F5B700]/40'
            }`}
          >
            {plan.badge && (
              <div
                className={`text-center py-2.5 text-xs font-black tracking-widest ${
                  plan.popular ? 'bg-[#F5B700] text-[#0A0A0A]' : 'text-white text-[10px]'
                }`}
                style={!plan.popular ? { background: accent } : {}}
              >
                ★ {plan.badge}
              </div>
            )}

            <div className={`p-7 ${plan.badge ? 'pt-6' : ''}`}>
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                  style={{
                    background: plan.popular ? `${accent}25` : `${accent}12`,
                    border: `1px solid ${accent}30`,
                  }}
                >
                  <Icon size={20} style={{ color: accent }} />
                </div>
                <div>
                  <div className={`font-bold text-base leading-tight ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                    {plan.name}
                  </div>
                </div>
              </div>

              {plan.description && (
                <p className={`text-sm mb-6 leading-relaxed ${plan.popular ? 'text-gray-400' : 'text-gray-500'}`}>
                  {plan.description}
                </p>
              )}

              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-3xl font-black ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                    {price != null ? formatCurrency(price) : '—'}
                  </span>
                  <span className={`text-sm ${plan.popular ? 'text-gray-500' : 'text-gray-400'}`}>{t('billing.perMonth')}</span>
                </div>
                {billing === 'annual' && originalPrice && price && price < originalPrice && (
                  <>
                    <div className={`text-xs line-through ${plan.popular ? 'text-gray-600' : 'text-gray-400'}`}>
                      {formatCurrency(originalPrice)}{t('billing.perMonth')}
                    </div>
                    <div className="text-xs text-green-500 font-semibold mt-1">✓ {t('billing.save')} 30%</div>
                  </>
                )}
              </div>

              <Link
                href={`/comprar/${plan.slug}?ciclo=${billing === 'annual' ? '1year' : 'monthly'}`}
                className={`btn-shimmer block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-7 ${
                  plan.popular
                    ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300] shadow-[0_4px_20px_rgba(245,183,0,0.35)]'
                    : 'bg-[#0A0A0A] text-white hover:bg-[#222] shadow-sm'
                }`}
              >
                {plan.cta_label ?? t('cta.start') + ' →'}
              </Link>

              <div className={`mb-6 h-px ${plan.popular ? 'bg-white/10' : 'bg-[#F0F0F0]'}`} />

              {features.length > 0 ? (
                <div className="space-y-3">
                  {features.map(f => (
                    <div
                      key={f.feature}
                      className={`flex items-center gap-3 text-sm ${
                        f.included
                          ? plan.popular ? 'text-gray-300' : 'text-gray-700'
                          : plan.popular ? 'text-gray-600' : 'text-gray-300'
                      }`}
                    >
                      {f.included
                        ? <Check size={15} className="text-green-500 flex-shrink-0" />
                        : <X size={15} className="text-gray-300 flex-shrink-0" />
                      }
                      {f.feature}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`text-xs ${plan.popular ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t('plans.features')}
                </p>
              )}
            </div>
          </div>
        )
      })
    )
  }

  // Sem planos estáticos: enquanto carrega mostra o indicador; erro ≠ catálogo vazio
  return renderSection(
    <div className="col-span-full text-center py-10" role={loadState === 'error' ? 'alert' : 'status'}>
      {loadState === 'error' ? (
        <>
          <p className="font-bold text-[#0A0A0A]">Não foi possível carregar os planos.</p>
          <button onClick={() => { setLoadState('loading'); setAttempt(x => x + 1) }} className="mt-3 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B700] text-[#0A0A0A]">Tentar novamente</button>
        </>
      ) : loadState === 'empty' ? (
        <p className="text-[#555]">Ainda não há planos de hospedagem publicados. <Link href="/suporte/contactar" className="underline">Fale connosco</Link>.</p>
      ) : (
        <p className="text-[#888] text-sm">A carregar planos…</p>
      )}
    </div>
  )
}
