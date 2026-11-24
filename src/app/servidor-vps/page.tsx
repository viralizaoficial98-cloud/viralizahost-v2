import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { PageLinksSection } from '@/components/site/PageLinksSection'
import { pagesInSection } from '@/lib/site/pages'
import { VpsPlansSection } from '@/components/service/VpsPlansSection'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Cpu, HardDrive, Globe, Shield, Zap, Server, Headphones, Lock, RotateCcw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Servidor VPS — Alta Performance',
  description: 'Servidores VPS com RAM DDR5, NVMe SSD, IP dedicado e transferência ilimitada. Root access total.',
}


const included = [
  { icon: Cpu, title: 'vCPU Dedicadas', desc: 'Núcleos de CPU exclusivos sem partilha com outros utilizadores.' },
  { icon: HardDrive, title: 'NVMe SSD Gen4', desc: 'Armazenamento ultrarrápido para máxima performance de I/O.' },
  { icon: Globe, title: 'IP Dedicado', desc: 'Endereço IP exclusivo para o seu servidor.' },
  { icon: Shield, title: 'Protecção DDoS', desc: 'Protecção avançada contra ataques de negação de serviço.' },
  { icon: Zap, title: 'Transferência Ilimitada', desc: 'Sem limites de largura de banda para o seu servidor.' },
  { icon: Server, title: 'Root Access', desc: 'Acesso total ao servidor para instalar qualquer software.' },
  { icon: RotateCcw, title: 'Migração Gratuita', desc: 'Migramos o seu servidor existente sem custos adicionais.' },
  { icon: Lock, title: 'Firewall Gerido', desc: 'Regras de firewall configuráveis para proteger o seu servidor.' },
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Suporte técnico especializado em servidores disponível sempre.' },
]

export default async function ServidorVPSPage() {
  const banner = await getBannerPage('servidor-vps')
  const fromPrice = await fromPriceText('vps')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Servidor VPS'}
          tag={banner?.tag ?? 'Servidores Cloud VPS'}
          title={banner?.title ?? 'Servidor VPS de alta performance para projectos exigentes'}
          subtitle={banner?.subtitle ?? 'Infraestrutura segura, rápida e escalável para sistemas, sites, automações e aplicações. RAM DDR5 e NVMe SSD incluídos.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos VPS'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#060b14'}
          highlights={banner?.highlights?.length ? banner.highlights : ["RAM DDR5","NVMe SSD","IP Dedicado","Root Access"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <VpsPlansSection
          title="Servidor VPS — Escolha o seu plano"
          subtitle="Escolha o plano e o período; depois a localização e o sistema operativo, reveja e pague." />
        <PageLinksSection id="aplicacoes" tag="Aplicações pré-configuradas" title="VPS com aplicações prontas a usar"
          subtitle="Automação, WhatsApp Business e agentes de IA num VPS já configurado — cada solução tem a sua página com planos e detalhes."
          items={pagesInSection('vps-apps').map(p => ({ href: p.path, title: p.title, desc: p.desc, icon: p.icon, cta: 'Ver solução' }))} />
        <IncludedFeatures features={included} dark
          title="Infra-estrutura premium incluída" />
        <FinalCTA
          title="Active o seu VPS em minutos"
          subtitle="Acesso root e suporte especializado. Activação pela equipa depois do pagamento confirmado."
          cta="Contratar VPS"
          ctaHref="/comprar/vps-nvme4" />
      </main>
      <Footer />
    </>
  )
}
