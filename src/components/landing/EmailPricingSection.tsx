'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Check, Mail, Shield, Database, Globe, Lock, Star, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type DbEmailPlan = { id: string; name: string; price_monthly: number | null; storage_gb: number; accounts: number; features: string[] | null; active: boolean; popular: boolean; color: string; position: number }

const emailPlans = [
  {
    id: 'starter-mail',
    name: 'Starter Mail',
    tagline: 'Para começar',
    description: 'E-mail profissional para pequenas empresas e empreendedores.',
    priceAKZ: '25.000',
    features: [
      { text: '5 caixas de e-mail', included: true },
      { text: '10 GB por caixa', included: true },
      { text: 'Anti-spam básico', included: true },
      { text: 'Webmail moderno', included: true },
      { text: 'IMAP / POP3 / SMTP', included: true },
      { text: 'SSL/TLS seguro', included: true },
      { text: 'Backup semanal', included: false },
      { text: 'SPF/DKIM/DMARC', included: false },
      { text: 'Integração Outlook', included: false },
    ],
    icon: Mail,
    accent: '#3B82F6',
    is_popular: false,
    badge: null,
  },
  {
    id: 'business-mail',
    name: 'Business Mail',
    tagline: 'Mais popular',
    description: 'Solução completa para equipas e empresas em crescimento.',
    priceAKZ: '45.000',
    features: [
      { text: '10 caixas de e-mail', included: true },
      { text: '25 GB por caixa', included: true },
      { text: 'Anti-spam premium', included: true },
      { text: 'Webmail moderno', included: true },
      { text: 'IMAP / POP3 / SMTP', included: true },
      { text: 'SSL/TLS seguro', included: true },
      { text: 'Backup semanal', included: true },
      { text: 'SPF/DKIM/DMARC', included: true },
      { text: 'Integração Outlook', included: true },
    ],
    icon: Shield,
    accent: '#F5B700',
    is_popular: true,
    badge: 'MAIS POPULAR',
  },
  {
    id: 'enterprise-mail',
    name: 'Enterprise Mail',
    tagline: 'Alta segurança',
    description: 'Para empresas que exigem segurança máxima e alta disponibilidade.',
    priceAKZ: '95.000',
    features: [
      { text: '25 caixas de e-mail', included: true },
      { text: '50 GB por caixa', included: true },
      { text: 'Segurança avançada', included: true },
      { text: 'Backup diário', included: true },
      { text: 'SPF/DKIM/DMARC', included: true },
      { text: 'Proteção avançada', included: true },
      { text: 'IMAP / POP3 / SMTP', included: true },
      { text: 'SSL/TLS seguro', included: true },
      { text: 'Integração Outlook', included: true },
    ],
    icon: Lock,
    accent: '#8B5CF6',
    is_popular: false,
    badge: 'ENTERPRISE',
  },
  {
    id: 'corporate-pro',
    name: 'Corporate Pro',
    tagline: 'Ilimitado',
    description: 'Solução enterprise sem limites para grandes organizações.',
    priceAKZ: null,
    features: [
      { text: 'Caixas ilimitadas', included: true },
      { text: 'Armazenamento expandido', included: true },
      { text: 'Segurança máxima', included: true },
      { text: 'Backup completo', included: true },
      { text: 'Alta disponibilidade', included: true },
      { text: 'Suporte prioritário 24/7', included: true },
      { text: 'SLA garantido', included: true },
      { text: 'SPF/DKIM/DMARC', included: true },
      { text: 'Integração personalizada', included: true },
    ],
    icon: Star,
    accent: '#0A0A0A',
    is_popular: false,
    badge: 'CORPORATE',
  },
]

const PLAN_ICONS = [Mail, Shield, Lock, Star, Database]
const PLAN_ACCENTS = ['#3B82F6', '#F5B700', '#8B5CF6', '#0A0A0A', '#10B981']

export function EmailPricingSection() {
  const [dbPlans, setDbPlans] = useState<DbEmailPlan[] | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('site_email_plans').select('*').eq('active', true).order('position')
      .then(({ data }) => { if (data && data.length > 0) setDbPlans(data as DbEmailPlan[]) })
  }, [])

  if (dbPlans) {
    return (
      <section id="email-plans" className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#F5B700]/4 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#F5B700]/3 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <span className="section-tag mb-5 inline-flex"><Mail size={13} />E-mail Corporativo</span>
            <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
              Planos de <span className="gradient-text">E-mail Corporativo</span>
            </h2>
            <p className="text-gray-500 text-xl max-w-2xl mx-auto">
              Comunicação profissional, segura e escalável para a sua empresa.
            </p>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${dbPlans.length >= 3 ? 'xl:grid-cols-3' : ''}`}>
            {dbPlans.map((plan, idx) => {
              const Icon = PLAN_ICONS[idx % PLAN_ICONS.length]
              const accent = plan.color || PLAN_ACCENTS[idx % PLAN_ACCENTS.length]
              const isPopular = plan.popular
              const price = plan.price_monthly
              const features: string[] = plan.features ?? []
              return (
                <div key={plan.id} className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover-lift ${
                  isPopular
                    ? 'bg-[#0A0A0A] border-2 border-[#F5B700] shadow-[0_20px_60px_rgba(0,0,0,0.15)]'
                    : 'bg-white border border-[#E8E8E8] shadow-sm hover:border-[#F5B700]/40'
                }`}>
                  {isPopular && (
                    <div className="text-center py-2.5 text-xs font-black tracking-widest" style={{ background: '#F5B700', color: '#0A0A0A' }}>
                      MAIS POPULAR
                    </div>
                  )}
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${accent}20` }}>
                        <Icon size={24} style={{ color: accent }} />
                      </div>
                    </div>
                    <h3 className={`text-2xl font-black mb-2 ${isPopular ? 'text-white' : 'text-[#0A0A0A]'}`}>{plan.name}</h3>
                    <p className={`text-sm mb-6 ${isPopular ? 'text-gray-400' : 'text-gray-500'}`}>
                      {plan.accounts} caixas · {plan.storage_gb} GB por caixa
                    </p>
                    <div className="mb-8">
                      {price ? (
                        <div className="flex items-baseline gap-1">
                          <span className={`text-sm font-bold ${isPopular ? 'text-gray-400' : 'text-gray-500'}`}>Kz</span>
                          <span className={`text-4xl font-black ${isPopular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                            {price.toLocaleString('pt-AO')}
                          </span>
                          <span className={`text-sm ${isPopular ? 'text-gray-400' : 'text-gray-500'}`}>/mês</span>
                        </div>
                      ) : (
                        <div className={`text-2xl font-black ${isPopular ? 'text-white' : 'text-[#0A0A0A]'}`}>Consultar</div>
                      )}
                    </div>
                    <ul className="space-y-3 mb-8">
                      {features.map((feat, fi) => (
                        <li key={fi} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accent}20` }}>
                            <Check size={11} style={{ color: accent }} />
                          </div>
                          <span className={`text-sm ${isPopular ? 'text-gray-300' : 'text-gray-600'}`}>{feat}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="#contacto" className={`block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 ${
                      isPopular
                        ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300]'
                        : 'border border-[#E8E8E8] text-[#0A0A0A] hover:border-[#F5B700] hover:bg-[#F5B700]/5'
                    }`}>
                      Começar Agora
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="email-plans" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      {/* Subtle bg decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#F5B700]/4 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#F5B700]/3 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">
            <Mail size={13} />
            E-mail Corporativo
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Planos de <span className="gradient-text">E-mail Corporativo</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto">
            Comunicação profissional, segura e escalável para a sua empresa.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {emailPlans.map((plan) => {
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
                    className="text-center py-2.5 text-xs font-black tracking-widest"
                    style={
                      plan.is_popular
                        ? { background: '#F5B700', color: '#0A0A0A' }
                        : { background: plan.accent, color: plan.accent === '#0A0A0A' ? '#F5B700' : '#fff' }
                    }
                  >
                    ★ {plan.badge}
                  </div>
                )}

                <div className={`p-7 ${plan.badge ? 'pt-6' : ''}`}>
                  {/* Icon & name */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{
                        background: plan.is_popular ? `${plan.accent}25` : `${plan.accent}12`,
                        border: `1px solid ${plan.accent}25`,
                      }}>
                      <Icon size={20} style={{ color: plan.accent === '#0A0A0A' && plan.is_popular ? '#F5B700' : plan.accent === '#0A0A0A' ? '#0A0A0A' : plan.accent }} />
                    </div>
                    <div>
                      <div className={`font-bold text-base leading-tight ${plan.is_popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                        {plan.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{plan.tagline}</div>
                    </div>
                  </div>

                  <p className={`text-sm mb-6 leading-relaxed ${plan.is_popular ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    {plan.priceAKZ ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-3xl font-black ${plan.is_popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                            {plan.priceAKZ} Kz
                          </span>
                        </div>
                        <div className={`text-xs mt-1 ${plan.is_popular ? 'text-gray-500' : 'text-gray-400'}`}>/mês</div>
                      </>
                    ) : (
                      <div>
                        <div className={`text-2xl font-black ${plan.is_popular ? 'text-white' : 'text-[#0A0A0A]'}`}>
                          Sob Consulta
                        </div>
                        <div className={`text-xs mt-1 ${plan.is_popular ? 'text-gray-500' : 'text-gray-400'}`}>
                          Preço personalizado
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  {plan.priceAKZ ? (
                    <Link href={`/register?plan=${plan.id}`}
                      className={`btn-shimmer block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-7 ${
                        plan.is_popular
                          ? 'bg-[#F5B700] text-[#0A0A0A] hover:bg-[#D9A300] shadow-[0_4px_20px_rgba(245,183,0,0.35)]'
                          : 'bg-[#0A0A0A] text-white hover:bg-[#222] shadow-sm'
                      }`}
                    >
                      Contratar Agora →
                    </Link>
                  ) : (
                    <Link href="/tickets"
                      className="flex items-center justify-center gap-2 w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all mb-7 border-2 border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
                    >
                      <Phone size={14} />
                      Falar com Especialista
                    </Link>
                  )}

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
                          : <div className="w-3.5 h-px bg-gray-300 flex-shrink-0 ml-0.5" />
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
          ✓ Anti-spam incluído &nbsp;•&nbsp; ✓ SSL/TLS em todos os planos &nbsp;•&nbsp; ✓ Suporte técnico 24/7
        </p>
      </div>
    </section>
  )
}
