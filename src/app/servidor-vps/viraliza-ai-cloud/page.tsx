import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Bot, Zap, MessageCircle, Globe, Shield, HardDrive, Lock, Headphones, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Viraliza AI Cloud — Agentes IA para Negócios',
  description: 'Configure assistentes inteligentes, integrações e automações sem complicação. WhatsApp, Gmail, Slack e mais.',
}


const included = [
  { icon: Bot, title: 'Agente de IA Pré-instalado', desc: 'Assistente inteligente configurado e pronto para representar o seu negócio.' },
  { icon: MessageCircle, title: 'WhatsApp Integrado', desc: 'Agente responde automaticamente no WhatsApp Business.' },
  { icon: Globe, title: 'Telegram Integrado', desc: 'Atendimento automatizado também no Telegram.' },
  { icon: Zap, title: 'Google Agenda', desc: 'Agendamento de reuniões e lembretes automáticos integrados.' },
  { icon: Layers, title: 'Slack & Trello', desc: 'Notificações e actualizações automáticas nas ferramentas da equipa.' },
  { icon: Shield, title: 'Gmail Integrado', desc: 'Respostas automáticas e triagem de e-mails com IA.' },
  { icon: HardDrive, title: 'NVMe SSD', desc: 'Armazenamento rápido para processamento de dados de IA.' },
  { icon: Lock, title: 'Dados Seguros', desc: 'Todos os dados dos seus agentes encriptados e seguros.' },
  { icon: Headphones, title: 'Suporte IA 24/7', desc: 'Equipa especializada em inteligência artificial disponível sempre.' },
]

export default async function ViralizaAICloudPage() {
  const banner = await getBannerPage('vps-viraliza-ai-cloud')
  const fromPrice = await fromPriceText('vps', 'viraliza-ai-cloud')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Viraliza AI Cloud'}
          breadcrumbParent={banner?.breadcrumb_parent ?? 'Servidor VPS'}
          breadcrumbParentHref={banner?.breadcrumb_parent_href ?? '/servidor-vps'}
          tag={banner?.tag ?? 'IA & Automação Empresarial'}
          title={banner?.title ?? 'Agentes de IA prontos para automatizar o seu negócio'}
          subtitle={banner?.subtitle ?? 'Configure assistentes inteligentes, integrações e automações sem complicação. WhatsApp, Gmail, Slack, Trello e muito mais.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos AI Cloud'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#04060f'}
          highlights={banner?.highlights?.length ? banner.highlights : ["Agentes de IA","WhatsApp + Telegram","Gmail + Google Agenda","Integrações Empresariais"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <DynamicServicePricing
          category="vps"
          subcategory="viraliza-ai-cloud"
          cols={3}
          showBillingToggle
          title="Viraliza AI Cloud — Planos"
          subtitle="Agentes de IA integrados com as ferramentas do seu negócio." />
        <IncludedFeatures features={included} dark
          title="Tudo incluído no Viraliza AI Cloud" />
        <FinalCTA
          title="Active os seus agentes de IA hoje"
          subtitle="Assistentes inteligentes, integrações completas e suporte especializado."
          cta="Contratar AI Cloud"
          ctaHref="/comprar/vps-ai-cloud-pro" />
      </main>
      <Footer />
    </>
  )
}
