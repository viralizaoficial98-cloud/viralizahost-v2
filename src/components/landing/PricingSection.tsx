'use client'
import Link from 'next/link'
import { Check, X, Zap, Crown, Rocket, Users } from 'lucide-react'
import { useState } from 'react'
import { useCurrency } from '@/hooks/useCurrency'
import { Currency } from '@/types'

const plans = [
  {
    id: 'starter',
    name: 'Starter Host',
    icon: Zap,
    description: 'Ideal para começar sua presença online',
    tagline: 'Para iniciantes',
    price: { AKZ: 4500, BRL: 19.90, USD: 3.99 },
    originalPrice: { AKZ: 9000, BRL: 39.90, USD: 7.99 },
    color: 'from-blue-500 to-cyan-500',
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
    color: 'from-indigo-500 to-purple-600',
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
    color: 'from-purple-500 to-pink-500',
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
    color: 'from-orange-500 to-red-500',
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

export function PricingSection() {
  const { format, currency } = useCurrency()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  const getPrice = (price: Record<Currency, number>) => {
    const p = price[currency]
    return billing === 'annual' ? p : p * 1.4
  }

  return (
    <section id="planos" className="py-24 bg-slate-950 relative overflow-hidden">
      {/* BG decoration */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
      <div className="absolute inset-0 bg-mesh opacity-30" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-4 bg-indigo-950 px-4 py-2 rounded-full border border-indigo-800">
            Planos & Preços
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6">
            Escolha o Plano <span className="gradient-text">Ideal</span> para Si
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto mb-8">
            Todos os planos incluem SSL grátis, cPanel Premium, backup e suporte 24/7. Sem taxas ocultas.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 glass rounded-2xl p-1.5 border border-white/10">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${billing === 'monthly' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${billing === 'annual' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Anual
              <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">-30%</span>
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
                className={`relative rounded-3xl overflow-hidden card-hover ${
                  plan.is_popular
                    ? 'border-2 border-indigo-500 popular-pulse'
                    : 'border border-white/10'
                } bg-gradient-to-b from-slate-900 to-slate-950`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className={`absolute top-0 left-0 right-0 text-center py-2 text-xs font-black tracking-widest bg-gradient-to-r ${plan.color} text-white`}>
                    ⭐ {plan.badge}
                  </div>
                )}

                <div className={`p-6 ${plan.badge ? 'pt-10' : ''}`}>
                  {/* Plan icon & name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-lg`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-lg leading-tight">{plan.name}</div>
                      <div className="text-slate-500 text-xs">{plan.tagline}</div>
                    </div>
                  </div>

                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-black text-white">{format(getPrice(plan.price))}</span>
                      <span className="text-slate-500 text-sm">/mês</span>
                    </div>
                    {billing === 'annual' && (
                      <div className="text-xs text-slate-500 line-through">{format(getPrice(plan.originalPrice))}/mês</div>
                    )}
                    {billing === 'annual' && (
                      <div className="text-xs text-green-400 font-semibold mt-1">✓ Economize 30% no plano anual</div>
                    )}
                  </div>

                  {/* CTA */}
                  <Link href={`/register?plan=${plan.id}`}
                    className={`btn-shimmer block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-6 ${
                      plan.is_popular
                        ? `bg-gradient-to-r ${plan.color} text-white hover:opacity-90 shadow-lg`
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                  >
                    Começar Agora →
                  </Link>

                  {/* Divider */}
                  <div className="section-divider mb-6" />

                  {/* Features */}
                  <div className="space-y-3">
                    {plan.features.map((f) => (
                      <div key={f.text} className={`flex items-center gap-3 text-sm ${f.included ? 'text-slate-300' : 'text-slate-600'}`}>
                        {f.included
                          ? <Check size={15} className="text-green-400 flex-shrink-0" />
                          : <X size={15} className="text-slate-700 flex-shrink-0" />
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

        {/* Bottom note */}
        <p className="text-center text-slate-500 text-sm mt-10">
          ✓ Sem contratos • ✓ Cancele a qualquer momento • ✓ Garantia de 30 dias
        </p>
      </div>
    </section>
  )
}
