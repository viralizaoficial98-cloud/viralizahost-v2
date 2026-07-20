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
const FALLBACK_PLANS = [
  {
    id: 'starter',
    name: 'Starter Host',
    icon: Zap,
    description: 'Ideal para começar sua presença online',
    tagline: 'Para iniciantes',
    price: { AKZ: 4500, BRL: 19.90, USD: 3.99 },
    originalPrice: { AKZ: 9000, BRL: 39.90, USD: 7.99 },
    accent: '#3B82F6',
    features: [
      { text: '1 Site', included: true },
      { text: '10 GB NVMe SSD', included: true },
      { text: '100 GB Bandwidth', included: true },
      { text: '5 Contas de Email', included: true },
      { text: 'SSL Grátis (Let\'s Encrypt)', included: true },
      { text: 'cPanel Premium', included: true },
      { text: '3 Bases de Dados MySQL', included: true },
      { text: 'Backup Semanal', included: true },
      { text: 'IP Dedicado', included: false },
      { text: 'Backup Diário', included: false },
      { text: 'Wildcard SSL', included: false },
    ],
    is_popular: false,
    badge: null as string | null,
  },
  {
    id: 'business',
    name: 'Business Cloud',
    icon: Rocket,
    description: 'Para pequenas e médias empresas crescerem',
    tagline: 'Mais popular',
    price: { AKZ: 9500, BRL: 39.90, USD: 7.99 },
    originalPrice: { AKZ: 19000, BRL: 79.90, USD: 15.99 },
    accent: '#F5B700',
    features: [
      { text: '5 Sites', included: true },
      { text: '50 GB NVMe SSD', included: true },
      { text: 'Bandwidth Ilimitado', included: true },
      { text: '20 Contas de Email', included: true },
      { text: 'SSL Grátis (Let\'s Encrypt)', included: true },
      { text: 'cPanel Premium', included: true },
      { text: '10 Bases de Dados MySQL', included: true },
      { text: 'Backup Diário', included: true },
      { text: 'Softaculous (400+ apps)', included: true },
      { text: 'IP Dedicado', included: false },
      { text: 'Wildcard SSL', included: false },
    ],
    is_popular: true,
    badge: 'MAIS POPULAR' as string | null,
  },
  {
    id: 'pro',
    name: 'Cloud Pro',
    icon: Crown,
    description: 'Para empresas que exigem alta performance',
    tagline: 'Melhor custo-benefício',
    price: { AKZ: 19500, BRL: 79.90, USD: 15.99 },
    originalPrice: { AKZ: 39000, BRL: 159.90, USD: 31.99 },
    accent: '#8B5CF6',
    features: [
      { text: 'Sites Ilimitados', included: true },
      { text: '200 GB NVMe SSD', included: true },
      { text: 'Bandwidth Ilimitado', included: true },
      { text: 'Emails Ilimitados', included: true },
      { text: 'Wildcard SSL Grátis', included: true },
      { text: 'cPanel Premium', included: true },
      { text: 'Bases de Dados Ilimitadas', included: true },
      { text: 'Backup Diário Automático', included: true },
      { text: 'Softaculous Premium', included: true },
      { text: 'IP Dedicado', included: true },
      { text: 'Proteção DDoS Avançada', included: true },
    ],
    is_popular: false,
    badge: 'MELHOR VALOR' as string | null,
  },
  {
    id: 'reseller',
    name: 'Revenda WHM',
    icon: Users,
    description: 'Crie o seu próprio negócio de hospedagem',
    tagline: 'Para revendedores',
    price: { AKZ: 35000, BRL: 149.90, USD: 29.99 },
    originalPrice: { AKZ: 70000, BRL: 299.90, USD: 59.99 },
    accent: '#EF4444',
    features: [
      { text: 'WHM + cPanel Incluído', included: true },
      { text: '500 GB NVMe SSD', included: true },
      { text: 'Bandwidth Ilimitado', included: true },
      { text: 'Contas de Email Ilimitadas', included: true },
      { text: 'SSL Ilimitado', included: true },
      { text: 'Criar Planos Personalizados', included: true },
      { text: 'Marca Branca (White Label)', included: true },
      { text: 'Backup Diário Completo', included: true },
      { text: 'Softaculous Premium', included: true },
      { text: 'IP Dedicado', included: true },
      { text: 'Painel de Controle Revendedor', included: true },
    ],
    is_popular: false,
    badge: 'REVENDA' as string | null,
  },
]

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
  const { format, currency } = useCurrency()
  const { t, formatCurrency } = useLocale()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  // Convert AOA price to selected currency
  const convertFromAOA = (aoa: number | null) => {
    if (aoa == null) return null
    return aoa * AOA_RATES[currency]
  }
  const [dbPlans, setDbPlans] = useState<DbPlan[] | null>(null)

  useEffect(() => {
    fetch('/api/products?category=hosting', { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setDbPlans(json.data as DbPlan[])
        } else if (!json.success) {
          console.error('[PricingSection] API error:', json.message, json.details)
        }
      })
      .catch(err => console.error('[PricingSection] fetch error:', err))
  }, [])

  const getStaticPrice = (price: Record<Currency, number>) => {
    const p = price[currency]
    return billing === 'annual' ? p : p * 1.4
  }

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
              <span className="bg-[#0A0A0A] text-white text-xs px-2 py-0.5 rounded-full font-bold">-30%</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {cards}
        </div>
        <p className="text-center text-gray-400 text-sm mt-10">
          ✓ {t('plans.noContracts')} &nbsp;•&nbsp; ✓ {t('plans.cancelAnytime')} &nbsp;•&nbsp; ✓ {t('plans.moneyBack')}
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
                href={`/checkout?plan=${plan.slug}&billing=${billing === 'annual' ? '1year' : 'monthly'}`}
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

  // Static fallback — shown before DB responds
  return renderSection(
    FALLBACK_PLANS.map(plan => {
      const Icon = plan.icon
      return (
        <div
          key={plan.id}
          className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover-lift ${
            plan.is_popular
              ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_20px_60px_rgba(0,0,0,0.15)]'
              : 'bg-white border border-[#E8E8E8] shadow-sm hover:border-[#F5B700]/40'
          }`}
        >
          {plan.badge && (
            <div
              className={`text-center py-2.5 text-xs font-black tracking-widest ${
                plan.is_popular ? 'bg-[#F5B700] text-[#0A0A0A]' : 'text-white text-[10px]'
              }`}
              style={!plan.is_popular ? { background: plan.accent } : {}}
            >
              ★ {plan.badge}
            </div>
          )}

          <div className={`p-7 ${plan.badge ? 'pt-6' : ''}`}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                style={{
                  background: plan.is_popular ? `${plan.accent}25` : `${plan.accent}12`,
                  border: `1px solid ${plan.accent}30`,
                }}
              >
                <Icon size={20} style={{ color: plan.accent }} />
              </div>
              <div>
                <div className={`font-bold text-base leading-tight ${plan.is_popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                  {plan.name}
                </div>
                <div className={`text-xs mt-0.5 ${plan.is_popular ? 'text-gray-400' : 'text-gray-400'}`}>
                  {plan.tagline}
                </div>
              </div>
            </div>

            <p className={`text-sm mb-6 leading-relaxed ${plan.is_popular ? 'text-gray-400' : 'text-gray-500'}`}>
              {plan.description}
            </p>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-3xl font-black ${plan.is_popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                  {format(getStaticPrice(plan.price))}
                </span>
                <span className={`text-sm ${plan.is_popular ? 'text-gray-500' : 'text-gray-400'}`}>{t('billing.perMonth')}</span>
              </div>
              {billing === 'annual' && (
                <div className={`text-xs line-through ${plan.is_popular ? 'text-gray-600' : 'text-gray-400'}`}>
                  {format(getStaticPrice(plan.originalPrice))}{t('billing.perMonth')}
                </div>
              )}
              {billing === 'annual' && (
                <div className="text-xs text-green-500 font-semibold mt-1">✓ {t('billing.save')} 30%</div>
              )}
            </div>

            <Link
              href={`/checkout?plan=${plan.id}&billing=${billing === 'annual' ? '1year' : 'monthly'}`}
              className={`btn-shimmer block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-7 ${
                plan.is_popular
                  ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300] shadow-[0_4px_20px_rgba(245,183,0,0.35)]'
                  : 'bg-[#0A0A0A] text-white hover:bg-[#222] shadow-sm'
              }`}
            >
              {t('cta.start')} →
            </Link>

            <div className={`mb-6 h-px ${plan.is_popular ? 'bg-white/10' : 'bg-[#F0F0F0]'}`} />

            <div className="space-y-3">
              {plan.features.map(f => (
                <div
                  key={f.text}
                  className={`flex items-center gap-3 text-sm ${
                    f.included
                      ? plan.is_popular ? 'text-gray-300' : 'text-gray-700'
                      : plan.is_popular ? 'text-gray-600' : 'text-gray-300'
                  }`}
                >
                  {f.included
                    ? <Check size={15} className="text-green-500 flex-shrink-0" />
                    : <X size={15} className="text-gray-300 flex-shrink-0" />
                  }
                  {f.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    })
  )
}
