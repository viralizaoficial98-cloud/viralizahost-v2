'use client'
import Link from 'next/link'
import { Check, X, Zap, Crown, Rocket, Users, Server } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { Currency } from '@/types'
import { createClient } from '@/lib/supabase/client'

const plans = [
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
    badge: null,
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
    badge: 'MAIS POPULAR',
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
    badge: 'MELHOR VALOR',
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
    badge: 'REVENDA',
  },
]

type DbPlan = { id: string; slug: string | null; name: string; description: string | null; badge: string | null; price_monthly: number | null; price_annual: number | null; discount_annual: number; features: string[] | null; active: boolean; featured: boolean; position: number }

const PLAN_ICONS = [Zap, Rocket, Crown, Users, Server]
const PLAN_ACCENTS = ['#3B82F6', '#F5B700', '#8B5CF6', '#EF4444', '#10B981']

// Fallback: map plan name → canonical slug when DB slug is a UUID
const NAME_TO_SLUG: Record<string, string> = {
  'Starter Host': 'starter', 'Business Cloud': 'business',
  'Cloud Pro': 'pro', 'Cloud Premium': 'pro', 'Revenda WHM': 'reseller',
}
const isUUID = (s: string | null) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s)
function resolveSlug(plan: DbPlan) {
  if (!isUUID(plan.slug) && plan.slug) return plan.slug
  return NAME_TO_SLUG[plan.name] ?? plan.id
}

export function PricingSection() {
  const { format, currency } = useCurrency()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const [dbPlans, setDbPlans] = useState<DbPlan[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('site_hosting_plans').select('*').eq('active', true).order('position')
      .then(({ data }) => { if (data && data.length > 0) setDbPlans(data as DbPlan[]) })
  }, [])

  const getPrice = (price: Record<Currency, number>) => {
    const p = price[currency]
    return billing === 'annual' ? p : p * 1.4
  }

  // If DB has plans, render them instead of hardcoded
  if (dbPlans) {
    return (
      <section id="planos" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <span className="section-tag mb-5 inline-flex">Hospedagem Premium</span>
            <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
              Planos de <span className="gradient-text">Hospedagem</span>
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">Escolha o plano ideal para o seu projecto com hardware NVMe de última geração.</p>
          </div>
          <div className={`grid gap-6 ${dbPlans.length <= 3 ? 'grid-cols-1 md:grid-cols-' + dbPlans.length : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'} max-w-6xl mx-auto`}>
            {dbPlans.map((plan, i) => {
              const Icon    = PLAN_ICONS[i % PLAN_ICONS.length]
              const accent  = PLAN_ACCENTS[i % PLAN_ACCENTS.length]
              const price   = billing === 'annual' && plan.price_annual ? plan.price_annual : plan.price_monthly
              const features = plan.features ?? []
              return (
                <div key={plan.id} className="relative rounded-3xl p-7 flex flex-col"
                  style={{ background: plan.featured ? '#0A0A0A' : '#FFFFFF', border: plan.featured ? `2px solid ${accent}` : '1px solid #E8E8E8', boxShadow: plan.featured ? `0 20px 60px ${accent}25` : '0 4px 20px rgba(0,0,0,0.06)' }}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-xs font-black px-3 py-1 rounded-full" style={{ background: accent, color: plan.featured ? '#000' : '#fff' }}>{plan.badge}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}20` }}>
                      <Icon size={18} style={{ color: accent }} />
                    </div>
                    <div>
                      <h3 className="font-black text-base" style={{ color: plan.featured ? '#fff' : '#0A0A0A' }}>{plan.name}</h3>
                      {plan.description && <p className="text-xs" style={{ color: plan.featured ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>{plan.description}</p>}
                    </div>
                  </div>
                  <div className="mb-5">
                    <span className="text-3xl font-black" style={{ color: accent }}>Kz {price?.toLocaleString() ?? '—'}</span>
                    <span className="text-sm ml-1" style={{ color: plan.featured ? 'rgba(255,255,255,0.4)' : '#94A3B8' }}>/mês</span>
                  </div>
                  <ul className="space-y-2 flex-1 mb-6">
                    {features.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2 text-sm" style={{ color: plan.featured ? 'rgba(255,255,255,0.8)' : '#374151' }}>
                        <Check size={14} style={{ color: accent, flexShrink: 0 }} /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/checkout?plan=${resolveSlug(plan)}&billing=${billing === 'annual' ? '1year' : 'monthly'}`} className="block text-center py-3 rounded-2xl font-bold text-sm transition-all"
                    style={plan.featured ? { background: accent, color: '#000', boxShadow: `0 8px 25px ${accent}40` } : { background: '#F3F4F6', color: '#0A0A0A' }}>
                    Começar agora
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="planos" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">Hospedagem Premium</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Planos de <span className="gradient-text">Hospedagem</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto mb-8">
            Escolha o plano ideal para escalar o seu negócio. SSL grátis, cPanel Premium, backup e suporte 24/7.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-2xl p-1.5 shadow-sm">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                billing === 'monthly'
                  ? 'bg-[#0A0A0A] text-white shadow-sm'
                  : 'text-gray-500 hover:text-[#0A0A0A]'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                billing === 'annual'
                  ? 'bg-[#F5B700] text-[#0A0A0A] shadow-sm'
                  : 'text-gray-500 hover:text-[#0A0A0A]'
              }`}
            >
              Anual
              <span className="bg-[#0A0A0A] text-white text-xs px-2 py-0.5 rounded-full font-bold">-30%</span>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {plans.map((plan) => {
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
                {/* Badge */}
                {plan.badge && (
                  <div className={`text-center py-2.5 text-xs font-black tracking-widest ${
                    plan.is_popular
                      ? 'bg-[#F5B700] text-[#0A0A0A]'
                      : 'text-white text-[10px]'
                  }`}
                    style={!plan.is_popular ? { background: plan.accent } : {}}
                  >
                    ★ {plan.badge}
                  </div>
                )}

                <div className={`p-7 ${plan.badge ? 'pt-6' : ''}`}>
                  {/* Icon & name */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                      style={{
                        background: plan.is_popular ? `${plan.accent}25` : `${plan.accent}12`,
                        border: `1px solid ${plan.accent}30`,
                      }}>
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

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-3xl font-black ${plan.is_popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                        {format(getPrice(plan.price))}
                      </span>
                      <span className={`text-sm ${plan.is_popular ? 'text-gray-500' : 'text-gray-400'}`}>/mês</span>
                    </div>
                    {billing === 'annual' && (
                      <div className={`text-xs line-through ${plan.is_popular ? 'text-gray-600' : 'text-gray-400'}`}>
                        {format(getPrice(plan.originalPrice))}/mês
                      </div>
                    )}
                    {billing === 'annual' && (
                      <div className="text-xs text-green-500 font-semibold mt-1">✓ Economize 30% no plano anual</div>
                    )}
                  </div>

                  {/* CTA */}
                  <Link href={`/checkout?plan=${plan.id}`}
                    className={`btn-shimmer block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-7 ${
                      plan.is_popular
                        ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300] shadow-[0_4px_20px_rgba(245,183,0,0.35)]'
                        : 'bg-[#0A0A0A] text-white hover:bg-[#222] shadow-sm'
                    }`}
                  >
                    Começar Agora →
                  </Link>

                  {/* Divider */}
                  <div className={`mb-6 h-px ${plan.is_popular ? 'bg-white/10' : 'bg-[#F0F0F0]'}`} />

                  {/* Features */}
                  <div className="space-y-3">
                    {plan.features.map((f) => (
                      <div key={f.text} className={`flex items-center gap-3 text-sm ${
                        f.included
                          ? (plan.is_popular ? 'text-gray-300' : 'text-gray-700')
                          : (plan.is_popular ? 'text-gray-600' : 'text-gray-300')
                      }`}>
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
          })}
        </div>

        <p className="text-center text-gray-400 text-sm mt-10">
          ✓ Sem contratos &nbsp;•&nbsp; ✓ Cancele a qualquer momento &nbsp;•&nbsp; ✓ Garantia de 30 dias
        </p>
      </div>
    </section>
  )
}
