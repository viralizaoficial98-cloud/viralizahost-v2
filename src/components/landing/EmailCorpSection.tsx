'use client'
import Link from 'next/link'
import { Check, X, Mail, Briefcase, Building2, Monitor } from 'lucide-react'
import { useState } from 'react'

const plans = [
  {
    id: 'webmail-start',
    name: 'Webmail Start',
    icon: Mail,
    description: 'Ideal para pequenas empresas.',
    tagline: 'Para começar',
    priceMonthly: 8500,
    priceAnnual: 6800,
    accent: '#3B82F6',
    is_popular: false,
    badge: null,
    features: [
      { text: '5 Contas de E-mail', included: true },
      { text: 'Webmail Premium', included: true },
      { text: '5 GB por conta', included: true },
      { text: 'SSL Seguro', included: true },
      { text: 'AntiSpam', included: true },
      { text: 'Backup Semanal', included: true },
      { text: 'SPF / DKIM', included: true },
      { text: 'DMARC', included: false },
      { text: 'IP Dedicada', included: false },
      { text: 'Backup Diário', included: false },
    ],
  },
  {
    id: 'webmail-business',
    name: 'Webmail Business',
    icon: Briefcase,
    description: 'Ideal para empresas em crescimento.',
    tagline: 'Mais popular',
    priceMonthly: 18500,
    priceAnnual: 14800,
    accent: '#F5B700',
    is_popular: true,
    badge: 'MAIS POPULAR',
    features: [
      { text: '15 Contas de E-mail', included: true },
      { text: 'Webmail Premium', included: true },
      { text: '15 GB por conta', included: true },
      { text: 'Backup Diário', included: true },
      { text: 'AntiSpam Premium', included: true },
      { text: 'SPF / DKIM / DMARC', included: true },
      { text: 'Alta Entregabilidade', included: true },
      { text: 'SSL Seguro', included: true },
      { text: 'IP Dedicada', included: false },
      { text: 'Suporte prioritário', included: false },
    ],
  },
  {
    id: 'webmail-enterprise',
    name: 'Webmail Enterprise',
    icon: Building2,
    description: 'Alta performance para grandes equipas.',
    tagline: 'Empresarial',
    priceMonthly: 35000,
    priceAnnual: 28000,
    accent: '#8B5CF6',
    is_popular: false,
    badge: 'EMPRESARIAL',
    features: [
      { text: '50 Contas de E-mail', included: true },
      { text: '50 GB por conta', included: true },
      { text: 'Backup Diário', included: true },
      { text: 'AntiSpam Avançado', included: true },
      { text: 'DMARC Premium', included: true },
      { text: 'IP Dedicada', included: true },
      { text: 'Alta Disponibilidade', included: true },
      { text: 'SPF / DKIM / DMARC', included: true },
      { text: 'Suporte prioritário', included: true },
      { text: 'SLA garantido', included: true },
    ],
  },
  {
    id: 'microsoft365',
    name: 'Microsoft 365 Outlook',
    icon: Monitor,
    description: 'Solução premium Microsoft.',
    tagline: 'Microsoft 365',
    priceMonthly: 65000,
    priceAnnual: 52000,
    accent: '#EF4444',
    is_popular: false,
    badge: 'MICROSOFT 365',
    features: [
      { text: 'Outlook Premium', included: true },
      { text: 'Microsoft Teams', included: true },
      { text: 'OneDrive 1 TB', included: true },
      { text: 'Word & Excel', included: true },
      { text: 'Exchange Online', included: true },
      { text: 'Backup Cloud', included: true },
      { text: 'Segurança Microsoft', included: true },
      { text: 'SPF / DKIM / DMARC', included: true },
      { text: 'Suporte especializado', included: true },
      { text: 'Alta Disponibilidade', included: true },
    ],
  },
]

export function EmailCorpSection() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  const getPrice = (plan: typeof plans[0]) =>
    billing === 'annual' ? plan.priceAnnual : plan.priceMonthly

  const fmt = (v: number) =>
    `Kz ${v.toLocaleString('pt-AO')}`

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
                  {/* Icon & name */}
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
                      <div className="text-xs mt-0.5 text-gray-400">{plan.tagline}</div>
                    </div>
                  </div>

                  <p className={`text-sm mb-6 leading-relaxed ${plan.is_popular ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-3xl font-black ${plan.is_popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                        {fmt(getPrice(plan))}
                      </span>
                      <span className={`text-sm ${plan.is_popular ? 'text-gray-500' : 'text-gray-400'}`}>/mês</span>
                    </div>
                    {billing === 'annual' && (
                      <div className={`text-xs line-through ${plan.is_popular ? 'text-gray-600' : 'text-gray-400'}`}>
                        {fmt(plan.priceMonthly)}/mês
                      </div>
                    )}
                    {billing === 'annual' && (
                      <div className="text-xs text-green-500 font-semibold mt-1">✓ Economize 20% no plano anual</div>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/checkout?plan=${plan.id}`}
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
          })}
        </div>

        <p className="text-center text-gray-400 text-sm mt-10">
          ✓ Sem contratos &nbsp;•&nbsp; ✓ Cancele a qualquer momento &nbsp;•&nbsp; ✓ Activação imediata
        </p>
      </div>
    </section>
  )
}
