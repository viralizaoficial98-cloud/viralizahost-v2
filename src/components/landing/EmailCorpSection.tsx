'use client'
import Link from 'next/link'
import { Check, Mail, Monitor, Globe } from 'lucide-react'

const plans = [
  {
    id: 'webmail',
    icon: Mail,
    name: 'Webmail Profissional',
    price: 'Kz 300.000',
    period: '/ano',
    description: 'E-mail corporativo com acesso via browser e mobile.',
    popular: false,
    features: [
      '10 contas de e-mail',
      'Webmail Premium',
      'Protecção AntiSpam',
      'SPF / DKIM / DMARC',
      'Backup diário',
      'SSL seguro',
      'Acesso Mobile',
    ],
    cta: 'Contratar Webmail',
    href: '/register?plan=webmail',
  },
  {
    id: 'microsoft365',
    icon: Monitor,
    name: 'Microsoft 365 Outlook',
    price: 'Kz 850.000',
    period: '/ano',
    description: 'Suite completa Microsoft para empresas exigentes.',
    popular: true,
    badge: 'Mais Popular',
    features: [
      'Outlook Premium',
      'Microsoft Teams',
      'OneDrive 1TB',
      'Word & Excel',
      'Segurança Microsoft',
      'Backup Cloud',
      'Sincronização Total',
      'Suporte prioritário',
    ],
    cta: 'Contratar 365',
    href: '/register?plan=microsoft365',
  },
  {
    id: 'workspace',
    icon: Globe,
    name: 'Google Workspace',
    price: 'Kz 950.000',
    period: '/ano',
    description: 'Ecossistema Google completo para a sua equipa.',
    popular: false,
    features: [
      'Gmail Corporativo',
      'Google Drive',
      'Google Meet',
      'Google Calendar',
      'Segurança Google',
      'Backup Cloud',
      'Alta Disponibilidade',
    ],
    cta: 'Contratar Workspace',
    href: '/register?plan=workspace',
  },
]

export function EmailCorpSection() {
  return (
    <section className="bg-white py-20 border-b border-[#F0F0F0]">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">

        {/* Heading */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#F5B700]" />
            <p className="text-[#F5B700] text-xs font-bold tracking-widest uppercase">Comunicação Profissional</p>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#F5B700]" />
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0A0A0A] leading-tight mb-4">
            E-mails Corporativos <span className="text-[#F5B700]">Premium</span>
          </h2>
          <p className="text-[#666] text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Soluções profissionais para Webmail, Microsoft 365 e Google Workspace.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map(({ id, icon: Icon, name, price, period, description, popular, badge, features, cta, href }) => (
            <div
              key={id}
              className="relative flex flex-col rounded-3xl border transition-all duration-300"
              style={{
                background: popular ? '#0A0A0A' : '#ffffff',
                borderColor: popular ? '#F5B700' : '#EBEBEB',
                boxShadow: popular
                  ? '0 8px 48px rgba(245,183,0,0.22), 0 2px 16px rgba(0,0,0,0.18)'
                  : '0 2px 16px rgba(0,0,0,0.05)',
              }}
            >
              {/* Popular badge */}
              {badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-[#F5B700] text-[#0A0A0A] text-xs font-black px-4 py-1.5 rounded-full tracking-wider uppercase shadow-lg">
                    {badge}
                  </span>
                </div>
              )}

              <div className="p-8 flex flex-col flex-1">
                {/* Icon + name */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: popular ? 'rgba(245,183,0,0.15)' : '#FFF8E1' }}
                  >
                    <Icon size={20} style={{ color: '#F5B700' }} />
                  </div>
                  <h3
                    className="font-black text-lg leading-tight"
                    style={{ color: popular ? '#FFFFFF' : '#0A0A0A' }}
                  >
                    {name}
                  </h3>
                </div>

                {/* Description */}
                <p
                  className="text-sm mb-6 leading-relaxed"
                  style={{ color: popular ? 'rgba(255,255,255,0.55)' : '#888' }}
                >
                  {description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span
                      className="text-3xl font-black leading-none"
                      style={{ color: popular ? '#F5B700' : '#0A0A0A' }}
                    >
                      {price}
                    </span>
                    <span
                      className="text-sm font-medium pb-0.5"
                      style={{ color: popular ? 'rgba(255,255,255,0.45)' : '#AAA' }}
                    >
                      {period}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div
                  className="w-full h-px mb-6"
                  style={{ background: popular ? 'rgba(255,255,255,0.10)' : '#F0F0F0' }}
                />

                {/* Features */}
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: popular ? 'rgba(245,183,0,0.18)' : '#FFF8E1' }}
                      >
                        <Check size={11} style={{ color: '#F5B700' }} strokeWidth={3} />
                      </div>
                      <span
                        className="text-sm leading-snug"
                        style={{ color: popular ? 'rgba(255,255,255,0.80)' : '#444' }}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={href}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-center transition-all duration-200 block"
                  style={{
                    background: popular ? '#F5B700' : 'transparent',
                    color: popular ? '#0A0A0A' : '#0A0A0A',
                    border: popular ? 'none' : '2px solid #D0D0D0',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    if (popular) {
                      el.style.background = '#FFD54F'
                      el.style.boxShadow = '0 4px 20px rgba(245,183,0,0.40)'
                    } else {
                      el.style.background = '#F5B700'
                      el.style.borderColor = '#F5B700'
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    if (popular) {
                      el.style.background = '#F5B700'
                      el.style.boxShadow = 'none'
                    } else {
                      el.style.background = 'transparent'
                      el.style.borderColor = '#D0D0D0'
                    }
                  }}
                >
                  {cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-[#AAA] text-xs mt-8">
          Todos os planos incluem SSL grátis, suporte 24/7 e activação imediata.
        </p>

      </div>
    </section>
  )
}
