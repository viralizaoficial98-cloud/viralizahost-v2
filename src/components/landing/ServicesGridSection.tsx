'use client'
import Link from 'next/link'
import { Server, Monitor, HardDrive, Workflow, Mail, Bot, ArrowRight } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'

const services = [
  { icon: Server,   color: '#2563EB', bg: '#EFF6FF', label: null,     title: 'Hospedagem de Sites',    desc: 'cPanel, LiteSpeed, NVMe SSD, SSL grátis e uptime 99.9% garantido.',                           priceAOA: 4500,  href: '#planos' },
  { icon: Monitor,  color: '#7C3AED', bg: '#F5F3FF', label: null,     title: 'Servidor VPS',           desc: 'Servidores virtuais com recursos dedicados, root access e escalabilidade.',                  priceAOA: 18000, href: '#planos' },
  { icon: HardDrive,color: '#DC2626', bg: '#FEF2F2', label: null,     title: 'Servidor Dedicado Linux',desc: 'Hardware exclusivo, máxima performance e controlo total do ambiente.',                       priceAOA: 75000, href: '#planos' },
  { icon: Workflow, color: '#D97706', bg: '#FFFBEB', label: 'Novo',   title: 'Servidor VPS n8n',       desc: 'VPS pré-configurado com n8n para automação de workflows sem código.',                        priceAOA: 22000, href: '#planos' },
  { icon: Mail,     color: '#059669', bg: '#ECFDF5', label: null,     title: 'E-mail Corporativo',     desc: 'Domínio próprio, antispam avançado, webmail moderno e até 50 GB/caixa.',                    priceAOA: 25000, href: '#email-plans' },
  { icon: Bot,      color: '#0EA5E9', bg: '#F0F9FF', label: 'Com IA', title: 'IA & Automação',         desc: 'Implemente agentes de IA e fluxos de automação com infraestrutura gerida.',                  priceAOA: null,  href: '#servicos' },
]

export function ServicesGridSection() {
  const { formatCurrency, currency, t } = useLocale()
  const fmtAOA = (n: number) => formatCurrency(convertFromAOA(n, currency))
  return (
    <section id="servicos" className="bg-[#F8F8F8] py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="section-tag">O que oferecemos</span>
          <h2 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3 mb-4">
            Soluções completas de infraestrutura
          </h2>
          <p className="text-[#666] max-w-xl mx-auto text-sm md:text-base">
            Do site pessoal à empresa global — temos o plano certo para cada etapa do seu crescimento.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map(({ icon: Icon, color, bg, label, title, desc, priceAOA, href }) => (
            <div key={title} className="card-light hover-lift group relative flex flex-col p-6 rounded-2xl">
              {label && (
                <span className="absolute top-4 right-4 text-[10px] font-black px-2.5 py-1 rounded-full"
                  style={{ background: color, color: '#fff' }}>
                  {label}
                </span>
              )}
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                style={{ background: bg }}>
                <Icon size={22} style={{ color }} />
              </div>
              <h3 className="text-[#0A0A0A] font-bold text-[15px] mb-2">{title}</h3>
              <p className="text-[#666] text-sm leading-relaxed flex-1">{desc}</p>
              <div className="mt-5 pt-5 border-t border-[#F0F0F0] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#888]">
                  {priceAOA != null ? `${fmtAOA(priceAOA)}${t('billing.perMonth')}` : t('cta.talkSales')}
                </span>
                <Link href={href}
                  className="flex items-center gap-1 text-xs font-bold text-[#0A0A0A] hover:text-[#F5B700] transition-colors">
                  Ver planos <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
