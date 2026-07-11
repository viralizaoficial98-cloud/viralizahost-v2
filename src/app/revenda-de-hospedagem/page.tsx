import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import type { PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Users, Server, Globe, Shield, Mail, RotateCcw, Headphones, Lock, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Revenda de Hospedagem WHM/cPanel',
  description: 'Crie a sua própria empresa de hospedagem com WHM/cPanel, DNS privado, SSL e suporte ao revendedor.',
}

const plans: PricingPlan[] = [
  {
    id: 'revenda-start',
    name: 'Revenda Start',
    price: 'Kz 59.900',
    period: '/mês',
    description: 'Para começar no mercado de revenda',
    features: ['20 contas cPanel', '50 GB NVMe SSD', 'WHM incluído', 'DNS privado', 'SSL grátis por conta', 'Migração gratuita', 'Suporte ao revendedor 24/7'],
    notIncluded: ['E-mail Whitelabel', 'IP dedicado'],
    cta: 'Começar Revenda Start',
  },
  {
    id: 'revenda-growth',
    name: 'Revenda Growth',
    price: 'Kz 99.900',
    period: '/mês',
    description: 'Para agências em crescimento',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['50 contas cPanel', '150 GB NVMe SSD', 'WHM incluído', 'DNS privado Whitelabel', 'SSL grátis por conta', 'E-mail corporativo incluído', 'Migração gratuita', 'Suporte prioritário 24/7'],
    cta: 'Começar Revenda Growth',
  },
  {
    id: 'revenda-business',
    name: 'Revenda Business',
    price: 'Kz 179.900',
    period: '/mês',
    description: 'Para empresas estabelecidas',
    features: ['100 contas cPanel', '300 GB NVMe SSD', 'WHM incluído', 'DNS privado Whitelabel', 'SSL grátis por conta', 'E-mail corporativo ilimitado', 'IP dedicado', 'Migração gratuita', 'Suporte premium 24/7'],
    cta: 'Começar Revenda Business',
  },
  {
    id: 'revenda-enterprise',
    name: 'Revenda Enterprise',
    price: 'Kz 349.900',
    period: '/mês',
    description: 'Infraestrutura sem limites',
    features: ['Contas cPanel ilimitadas', '600 GB NVMe SSD', 'WHM incluído', 'DNS privado Whitelabel', 'SSL grátis por conta', 'E-mail corporativo ilimitado', 'IPs dedicados', 'Migração gratuita', 'Gerente de conta dedicado', 'SLA premium'],
    cta: 'Contatar Comercial',
  },
]

const included = [
  { icon: Server, title: 'WHM/cPanel', desc: 'Painel de gestão completo para administrar todas as contas dos seus clientes.' },
  { icon: Globe, title: 'DNS Privado Whitelabel', desc: 'Nameservers com a sua marca para uma identidade profissional.' },
  { icon: Shield, title: 'SSL por Conta', desc: 'Certificado SSL gratuito instalado automaticamente em cada conta de cliente.' },
  { icon: Users, title: 'Gestão de Clientes', desc: 'Ferramentas para criar, gerir e monitorizar as contas dos seus clientes.' },
  { icon: Mail, title: 'E-mail Corporativo', desc: 'Caixas de e-mail no domínio do cliente incluídas em todos os planos.' },
  { icon: RotateCcw, title: 'Migração Gratuita', desc: 'Migramos as contas existentes dos seus clientes sem custo.' },
  { icon: Lock, title: 'Protecção DDoS', desc: 'Infra-estrutura protegida contra ataques externos.' },
  { icon: Layers, title: 'Multi-PHP', desc: 'Suporte a múltiplas versões de PHP para compatibilidade total.' },
  { icon: Headphones, title: 'Suporte ao Revendedor', desc: 'Linha de suporte dedicada para revendedores disponível 24/7.' },
]

export default function RevendaDeHospedagemPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb="Revenda de Hospedagem"
          tag="Revenda WHM/cPanel"
          title="Crie a sua própria empresa de hospedagem com a ViralizaHost"
          subtitle="Venda hospedagem para os seus clientes usando a nossa infraestrutura premium. WHM, cPanel, DNS privado e marca própria."
          price="A partir de Kz 59.900/mês"
          cta="Ver Planos de Revenda"
          ctaHref="#planos"
          ctaSecondary="Falar com Comercial"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1591808216268-1e7c1b31b9d2?w=1920&q=80&auto=format&fit=crop"
          bgColor="#0a0a14"
          highlights={['WHM/cPanel Incluído', 'DNS Whitelabel', 'SSL por Conta', 'Suporte Revendedor']}
        />
        <DynamicServicePricing category="reseller" cols={4} showBillingToggle
          title="Revenda de Hospedagem — Escolha o plano"
          subtitle="Comece a vender hospedagem hoje com a infraestrutura da ViralizaHost."
          fallbackPlans={plans} />
        <IncludedFeatures features={included}
          title="Tudo o que precisa para revender hospedagem" />
        <FinalCTA
          title="Inicie o seu negócio de hospedagem hoje"
          subtitle="Infraestrutura premium, marca própria e suporte dedicado ao revendedor."
          cta="Começar a Revender"
          ctaHref="/register?plan=revenda-start" />
      </main>
      <Footer />
    </>
  )
}
