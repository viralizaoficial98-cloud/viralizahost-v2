'use client'
import Link from 'next/link'
import { Check, X, Mail, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type DbEmailPlan = {
  id: string
  slug: string | null
  name: string
  description: string | null
  badge: string | null
  price_monthly: number | null
  price_annual: number | null
  discount_annual: number | null
  storage_gb: number | null
  accounts: number | null
  features: string[] | null
  active: boolean
  popular: boolean
  color: string | null
  position: number
}

const fmt = (v: number) => `Kz ${v.toLocaleString('pt-AO')}`

export function EmailCorpSection() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [plans, setPlans] = useState<DbEmailPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('site_email_plans')
      .select('id,slug,name,description,badge,price_monthly,price_annual,discount_annual,storage_gb,accounts,features,active,popular,color,position')
      .eq('active', true)
      .order('position', { ascending: true })
      .then(({ data, error: err }) => {
        console.log('[EMAIL PLANS DB]', data, err)
        if (err || !data) { setError(true) } else { setPlans(data) }
        setLoading(false)
      })
  }, [])

  const getPrice = (plan: DbEmailPlan) => {
    if (billing === 'annual') {
      if (plan.price_annual != null) return plan.price_annual
      if (plan.price_monthly != null && plan.discount_annual != null) {
        return Math.round(plan.price_monthly * (1 - plan.discount_annual / 100))
      }
      if (plan.price_monthly != null) return Math.round(plan.price_monthly * 0.8)
    }
    return plan.price_monthly ?? 0
  }

  const getOriginalPrice = (plan: DbEmailPlan) => plan.price_monthly ?? 0

  const accent = (plan: DbEmailPlan) => plan.color ?? '#3B82F6'

  return (
    <section id="email-plans" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">Comunicação Profissional</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            E-mails Corporativos <span className="gradient-text">Premium</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto mb-8">
            Escolha a solução ideal de e-mail profissional para a sua empresa.
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
              <span className="bg-[#0A0A0A] text-white text-xs px-2 py-0.5 rounded-full font-bold">-20%</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#F5B700]" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-20 text-gray-400">
            Não foi possível carregar os planos. Por favor, tente novamente.
          </div>
        )}

        {/* Plans grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan) => {
              const price = getPrice(plan)
              const originalPrice = getOriginalPrice(plan)
              const color = accent(plan)
              const planKey = plan.slug ?? plan.id
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover-lift ${
                    plan.popular
                      ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_20px_60px_rgba(0,0,0,0.15)]'
                      : 'bg-white border border-[#E8E8E8] shadow-sm hover:border-[#F5B700]/40'
                  }`}
                >
                  {/* Badge */}
                  {plan.badge && (
                    <div
                      className={`text-center py-2.5 text-xs font-black tracking-widest ${
                        plan.popular ? 'bg-[#F5B700] text-[#0A0A0A]' : 'text-white text-[10px]'
                      }`}
                      style={!plan.popular ? { background: color } : {}}
                    >
                      ★ {plan.badge}
                    </div>
                  )}

                  <div className={`p-7 ${plan.badge ? 'pt-6' : ''}`}>
                    {/* Icon & name */}
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                        style={{
                          background: plan.popular ? `${color}25` : `${color}12`,
                          border: `1px solid ${color}30`,
                        }}
                      >
                        <Mail size={20} style={{ color }} />
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

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`text-3xl font-black ${plan.popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                          {fmt(price)}
                        </span>
                        <span className={`text-sm ${plan.popular ? 'text-gray-500' : 'text-gray-400'}`}>/mês</span>
                      </div>
                      {billing === 'annual' && price < originalPrice && (
                        <div className={`text-xs line-through ${plan.popular ? 'text-gray-600' : 'text-gray-400'}`}>
                          {fmt(originalPrice)}/mês
                        </div>
                      )}
                      {billing === 'annual' && price < originalPrice && (
                        <div className="text-xs text-green-500 font-semibold mt-1">✓ Economize no plano anual</div>
                      )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={`/checkout?plan=${planKey}&billing=${billing === 'annual' ? '1year' : 'monthly'}`}
                      className={`btn-shimmer block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-7 ${
                        plan.popular
                          ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300] shadow-[0_4px_20px_rgba(245,183,0,0.35)]'
                          : 'bg-[#0A0A0A] text-white hover:bg-[#222] shadow-sm'
                      }`}
                    >
                      Começar Agora →
                    </Link>

                    {/* Divider */}
                    <div className={`mb-6 h-px ${plan.popular ? 'bg-white/10' : 'bg-[#F0F0F0]'}`} />

                    {/* Features */}
                    {plan.features && plan.features.length > 0 && (
                      <div className="space-y-3">
                        {plan.features.map((f) => (
                          <div
                            key={f}
                            className={`flex items-center gap-3 text-sm ${
                              plan.popular ? 'text-gray-300' : 'text-gray-700'
                            }`}
                          >
                            <Check size={15} className="text-green-500 flex-shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-center text-gray-400 text-sm mt-10">
          ✓ Sem contratos &nbsp;•&nbsp; ✓ Cancele a qualquer momento &nbsp;•&nbsp; ✓ Activação imediata
        </p>
      </div>
    </section>
  )
}
