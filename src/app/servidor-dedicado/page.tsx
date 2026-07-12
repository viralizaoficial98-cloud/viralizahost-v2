import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import type { PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Cpu, HardDrive, Globe, Shield, Zap, Server, Headphones, Lock, RotateCcw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Servidor Dedicado Linux — Alta Performance',
  description: 'Servidores Linux dedicados com recursos exclusivos, root access e alta disponibilidade. Ideal para sistemas críticos.',
}

const plans: PricingPlan[] = [
  {
    id: 'ded-16',
    name: 'Dedicado NVMe 16',
    price: 'Kz 249.000',
    period: '/mês',
    description: 'Para sistemas e aplicações de médio porte',
    features: ['16 vCPU dedicadas', '32 GB RAM DDR5', '480 GB NVMe SSD', '2 IPs dedicados', 'cPanel/WHM opcional', 'SSL grátis', 'Migração gratuita', 'Suporte técnico 24/7'],
    notIncluded: ['IPs adicionais', 'Backup gerido diário'],
    cta: 'Contratar NVMe 16',
  },
  {
    id: 'ded-32',
    name: 'Dedicado NVMe 32',
    price: 'Kz 449.000',
    period: '/mês',
    description: 'Para projectos de alta demanda',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['32 vCPU dedicadas', '64 GB RAM DDR5', '960 GB NVMe SSD', '4 IPs dedicados', 'cPanel/WHM incluído', 'SSL grátis', 'Backup semanal gerido', 'Migração gratuita', 'Suporte prioritário 24/7'],
    cta: 'Contratar NVMe 32',
  },
  {
    id: 'ded-64',
    name: 'Dedicado NVMe 64',
    price: 'Kz 799.000',
    period: '/mês',
    description: 'Para infra-estruturas empresariais',
    badge: 'MELHOR VALOR',
    features: ['64 vCPU dedicadas', '128 GB RAM DDR5', '1.920 GB NVMe SSD', '8 IPs dedicados', 'cPanel/WHM incluído', 'SSL grátis', 'Backup diário gerido', 'Migração gratuita', 'Snapshots', 'SLA premium', 'Suporte premium 24/7'],
    cta: 'Contratar NVMe 64',
  },
  {
    id: 'ded-128',
    name: 'Dedicado NVMe 128',
    price: 'Sob consulta',
    period: '',
    description: 'Infra-estrutura exclusiva máxima',
    features: ['128 vCPU dedicadas', '256 GB RAM DDR5', '3.840 GB NVMe SSD', 'IPs dedicados ilimitados', 'cPanel/WHM incluído', 'SSL grátis', 'Backup diário + offsite', 'Migração gratuita', 'Gerente de infra-estrutura', 'SLA enterprise', 'Suporte VIP 24/7'],
    cta: 'Contatar Comercial',
    href: '/tickets',
  },
]

const included = [
  { icon: Cpu, title: 'vCPU 100% Dedicadas', desc: 'Núcleos exclusivos sem qualquer partilha de recursos com outros servidores.' },
  { icon: HardDrive, title: 'NVMe SSD Gen4', desc: 'Armazenamento de ultra-alta velocidade para cargas de trabalho intensivas.' },
  { icon: Globe, title: 'IPs Dedicados', desc: 'Endereços IP exclusivos para máximo controlo de reputação e routing.' },
  { icon: Shield, title: 'Protecção DDoS', desc: 'Protecção avançada multi-camada contra ataques volumétricos.' },
  { icon: Zap, title: 'Transferência Ilimitada', desc: 'Largura de banda irrestrita para máxima performance de rede.' },
  { icon: Server, title: 'Root Access Total', desc: 'Controlo absoluto do servidor para qualquer configuração necessária.' },
  { icon: RotateCcw, title: 'Migração Gratuita', desc: 'Migramos a sua infra-estrutura actual sem custos ou downtime.' },
  { icon: Lock, title: 'Firewall Avançado', desc: 'Protecção de rede configurável com regras personalizadas.' },
  { icon: Headphones, title: 'Suporte Especializado 24/7', desc: 'Equipa de engenheiros de infra-estrutura disponível a qualquer hora.' },
]

export default async function ServidorDedicadoPage() {
  const banner = await getBannerPage('servidor-dedicado')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Servidor Dedicado Linux'}
          tag={banner?.tag ?? 'Infraestrutura Dedicada'}
          title={banner?.title ?? 'Infraestrutura dedicada para alta performance'}
          subtitle={banner?.subtitle ?? 'Servidores Linux dedicados para projectos robustos, sistemas críticos e alta demanda. Recursos exclusivos, root access e SLA garantido.'}
          price={banner?.price_text ?? 'A partir de Kz 249.000/mês'}
          cta={banner?.button_primary_text ?? 'Ver Planos Dedicado'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#060810'}
          highlights={banner?.highlights?.length ? banner.highlights : ["vCPU Exclusivas","RAM DDR5","NVMe SSD","Root Access Total"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <DynamicServicePricing category="dedicated" cols={4} showBillingToggle
          title="Servidor Dedicado Linux — Planos"
          subtitle="Recursos exclusivos, sem partilha. Máxima performance e controlo total."
          fallbackPlans={plans} />
        <IncludedFeatures features={included} dark
          title="Infra-estrutura enterprise incluída" />
        <FinalCTA
          title="Implante a sua infra-estrutura dedicada hoje"
          subtitle="Activação rápida, migração gratuita e suporte de engenheiros especializados."
          cta="Contratar Servidor Dedicado"
          ctaHref="/checkout?plan=ded-32" />
      </main>
      <Footer />
    </>
  )
}
