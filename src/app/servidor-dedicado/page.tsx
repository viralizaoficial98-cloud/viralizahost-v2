import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { DedicatedPlansSection } from '@/components/service/DedicatedPlansSection'
import { DedicatedCompatibility } from '@/components/service/DedicatedCompatibility'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Cpu, HardDrive, Globe, Shield, Zap, Server, Headphones, Lock, RotateCcw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Servidor Dedicado Linux — Alta Performance',
  description: 'Servidores Linux dedicados com recursos exclusivos, root access e alta disponibilidade. Ideal para sistemas críticos.',
}


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
  const fromPrice = await fromPriceText('dedicated')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Servidor Dedicado Linux'}
          tag={banner?.tag ?? 'Infraestrutura Dedicada'}
          title={banner?.title ?? 'Infraestrutura dedicada para alta performance'}
          subtitle={banner?.subtitle ?? 'Servidores Linux dedicados para projectos robustos, sistemas críticos e alta demanda. Recursos exclusivos, root access e SLA garantido.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos Dedicado'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#060810'}
          highlights={banner?.highlights?.length ? banner.highlights : ["vCPU Exclusivas","RAM DDR5","NVMe SSD","Root Access Total"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <DedicatedPlansSection kind="linux"
          title="Servidor Dedicado Linux — Planos"
          subtitle="Hardware exclusivo, sem partilha. Escolha o período e compre — a equipa activa o servidor depois do pagamento confirmado." />
        <DedicatedCompatibility kind="linux" />
        <IncludedFeatures features={included} dark
          title="Infra-estrutura enterprise incluída" />
        <FinalCTA
          title="Implante a sua infra-estrutura dedicada hoje"
          subtitle="Activação rápida, migração gratuita e suporte de engenheiros especializados."
          cta="Contratar Servidor Dedicado"
          ctaHref="#planos" />
      </main>
      <Footer />
    </>
  )
}
