import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { VpsPlansSection } from '@/components/service/VpsPlansSection'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { MessageCircle, Zap, Shield, HardDrive, Globe, Lock, Headphones, Server, Workflow } from 'lucide-react'

export const metadata: Metadata = {
  title: 'VPS Evolution API — WhatsApp Business',
  description: 'Servidor VPS com Evolution API para WhatsApp Business, chatbots, integrações e automações. Múltiplos números.',
}


const included = [
  { icon: MessageCircle, title: 'Evolution API Pré-instalada', desc: 'API do WhatsApp configurada e pronta para conectar os seus números.' },
  { icon: Zap, title: 'Múltiplos Números', desc: 'Gere vários números WhatsApp Business numa única instância.' },
  { icon: Workflow, title: 'Webhooks Avançados', desc: 'Recebe mensagens e eventos em tempo real para integrações.' },
  { icon: Globe, title: 'Integrações', desc: 'Conecta com n8n, CRMs, chatbots e sistemas de atendimento.' },
  { icon: Shield, title: 'SSL Grátis', desc: 'Painel e API protegidos com HTTPS incluído.' },
  { icon: HardDrive, title: 'NVMe SSD', desc: 'Armazenamento rápido para processar grande volume de mensagens.' },
  { icon: Server, title: 'Root Access', desc: 'Acesso total ao servidor para personalizar a instalação.' },
  { icon: Lock, title: 'Segurança Avançada', desc: 'Autenticação e protecção das sessões WhatsApp.' },
  { icon: Headphones, title: 'Suporte Especializado', desc: 'Equipa com conhecimento em Evolution API e WhatsApp disponível 24/7.' },
]

export default async function VPSEvolutionAPIPage() {
  const banner = await getBannerPage('vps-evolution-api')
  const fromPrice = await fromPriceText('vps')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'VPS Evolution API'}
          breadcrumbParent={banner?.breadcrumb_parent ?? 'Servidor VPS'}
          breadcrumbParentHref={banner?.breadcrumb_parent_href ?? '/servidor-vps'}
          tag={banner?.tag ?? 'WhatsApp Business API'}
          title={banner?.title ?? 'Automatize, integre e escale o seu WhatsApp com Evolution API'}
          subtitle={banner?.subtitle ?? 'Servidor VPS preparado para WhatsApp Business, chatbots, integrações e automações. Múltiplos números, webhooks e painel completo.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos Evolution API'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#062006'}
          highlights={banner?.highlights?.length ? banner.highlights : ["Evolution API Instalada","Múltiplos Números","Webhooks Avançados","Integrações CRM"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        {/* Planos reais do catálogo Cloud VPS: o botão abre o configurador com «Evolution API» pré-seleccionado */}
        <VpsPlansSection app="evolution"
          title="VPS Evolution API — Planos"
          subtitle="Servidor pré-configurado com Evolution API. Comece a automatizar o WhatsApp hoje." />
        <IncludedFeatures features={included} dark
          title="Tudo incluído no VPS Evolution API" />
        <FinalCTA
          title="Comece a automatizar o WhatsApp hoje"
          subtitle="Servidor pré-configurado, múltiplos números e integrações completas."
          cta="Contratar Evolution API"
          ctaHref="/servidor-vps/configurar?app=evolution" />
      </main>
      <Footer />
    </>
  )
}
