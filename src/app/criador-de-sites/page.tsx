import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Bot, Zap, Globe, Shield, BarChart, Headphones, Lock, Code, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Criador de Sites com IA',
  description: 'Crie um site profissional em minutos com inteligência artificial. Sem código, sem design, sem complicações.',
}


const included = [
  { icon: Bot, title: 'IA Criadora de Sites', desc: 'Descreve o teu negócio e a IA cria o site completo em segundos.' },
  { icon: Zap, title: 'Editor Visual Drag & Drop', desc: 'Personaliza qualquer elemento sem precisar de código.' },
  { icon: Globe, title: 'Hospedagem Incluída', desc: 'Não precisas de contratar hospedagem separada — está tudo incluído.' },
  { icon: Shield, title: 'SSL Grátis', desc: 'Certificado HTTPS instalado automaticamente em todos os sites.' },
  { icon: BarChart, title: 'SEO com IA', desc: 'Otimização automática de meta tags, títulos e descrições para motores de busca.' },
  { icon: Code, title: 'Templates Premium', desc: 'Centenas de templates profissionais para todos os sectores.' },
  { icon: Layers, title: 'Formulários Inteligentes', desc: 'Captura de leads, contactos e reservas integradas.' },
  { icon: Lock, title: 'Protecção DDoS', desc: 'Infraestrutura segura e protegida contra ataques.' },
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Equipa especializada sempre disponível para ajudar.' },
]

export default async function CriadorDeSitesPage() {
  const banner = await getBannerPage('criador-de-sites')
  const fromPrice = await fromPriceText('website-builder')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Criador de Sites com IA'}
          tag={banner?.tag ?? 'Com Inteligência Artificial'}
          title={banner?.title ?? 'Crie o seu site profissional em minutos com IA'}
          subtitle={banner?.subtitle ?? 'Descreve o teu negócio. A inteligência artificial cria o site completo, com textos, imagens e design. Sem código, sem design.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Criar Meu Site com IA'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Ver Demonstração'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#05080f'}
          highlights={banner?.highlights?.length ? banner.highlights : ["Site pronto em minutos","Sem código","Hospedagem incluída","SEO automático"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <DynamicServicePricing category="website-builder" cols={3} showBillingToggle
          title="Criador de Sites com IA — Planos"
          subtitle="Crie sites profissionais sem nenhum conhecimento técnico." />
        <IncludedFeatures features={included}
          title="Tudo incluído no seu criador de sites" />
        <FinalCTA
          title="Crie o seu site agora com IA"
          subtitle="Sem código, sem design, sem complicações. O site fica pronto em minutos."
          cta="Começar Grátis"
          ctaHref="/comprar/ia-starter" />
      </main>
      <Footer />
    </>
  )
}
