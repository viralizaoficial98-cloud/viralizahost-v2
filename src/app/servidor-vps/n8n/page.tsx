import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { VpsPlansSection } from '@/components/service/VpsPlansSection'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Workflow, Zap, Shield, HardDrive, Globe, MessageCircle, Headphones, Lock, Server } from 'lucide-react'

export const metadata: Metadata = {
  title: 'VPS n8n Auto-hospedado',
  description: 'Servidor VPS com n8n pré-instalado para automações, integrações, IA e produtividade. Fluxos ilimitados.',
}


const included = [
  { icon: Workflow, title: 'n8n Pré-instalado', desc: 'Instância n8n configurada e pronta a usar desde o primeiro minuto.' },
  { icon: Zap, title: 'Fluxos Ilimitados', desc: 'Sem limites no número de workflows e automações que podes criar.' },
  { icon: Globe, title: 'Webhooks', desc: 'Recebe e envia eventos em tempo real para qualquer serviço.' },
  { icon: MessageCircle, title: 'Integração WhatsApp', desc: 'Automações directas com WhatsApp Business API.' },
  { icon: Shield, title: 'SSL Grátis', desc: 'Painel n8n protegido com HTTPS incluído.' },
  { icon: HardDrive, title: 'NVMe SSD', desc: 'Armazenamento rápido para processar grandes volumes de dados.' },
  { icon: Server, title: 'Root Access', desc: 'Acesso total para instalar extensões e pacotes adicionais.' },
  { icon: Lock, title: 'Autenticação Segura', desc: 'Acesso protegido ao painel n8n com credenciais privadas.' },
  { icon: Headphones, title: 'Suporte n8n 24/7', desc: 'Equipa especializada em automações e n8n disponível sempre.' },
]

export default async function VPSn8nPage() {
  const banner = await getBannerPage('vps-n8n')
  const fromPrice = await fromPriceText('vps')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'VPS n8n Auto-hospedado'}
          breadcrumbParent={banner?.breadcrumb_parent ?? 'Servidor VPS'}
          breadcrumbParentHref={banner?.breadcrumb_parent_href ?? '/servidor-vps'}
          tag={banner?.tag ?? 'Automação com n8n'}
          title={banner?.title ?? 'Crie e rode as suas automações em minutos'}
          subtitle={banner?.subtitle ?? 'Servidor VPS com n8n preparado para automações, integrações com WhatsApp, Google Sheets, CRMs e muito mais. Fluxos ilimitados.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos n8n'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#060b14'}
          highlights={banner?.highlights?.length ? banner.highlights : ["n8n Pré-instalado","Fluxos Ilimitados","WhatsApp Integrado","Root Access"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        {/* Planos reais do catálogo Cloud VPS: o botão abre o configurador com «n8n» pré-seleccionado */}
        <VpsPlansSection app="n8n"
          title="VPS n8n — Automação sem limites"
          subtitle="Servidor pronto com n8n configurado. Active e comece a automatizar hoje." />
        <IncludedFeatures features={included} dark
          title="Tudo incluído no VPS n8n" />
        <FinalCTA
          title="Comece a automatizar hoje com n8n"
          subtitle="Servidor pré-configurado, fluxos ilimitados e suporte especializado."
          cta="Contratar VPS n8n"
          ctaHref="/servidor-vps/configurar?app=n8n" />
      </main>
      <Footer />
    </>
  )
}
