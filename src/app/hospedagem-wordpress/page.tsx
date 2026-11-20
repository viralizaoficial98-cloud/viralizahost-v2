import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Globe, Shield, Zap, HardDrive, RotateCcw, Headphones, Lock, Bot, BarChart } from 'lucide-react'


export const metadata: Metadata = {
  title: 'Hospedagem WordPress com IA',
  description: 'WordPress otimizado, rápido, seguro e pronto para crescer. SSL grátis, CDN, backup diário e criador com IA.',
}


const included = [
  { icon: Globe, title: 'WordPress Pré-instalado', desc: 'Instância WordPress pronta a usar logo após a activação.' },
  { icon: Shield, title: 'SSL Grátis', desc: 'Certificado HTTPS instalado e renovado automaticamente.' },
  { icon: Zap, title: 'LiteSpeed + Cache', desc: 'Cache avançado específico para WordPress — carregamentos ultrarrápidos.' },
  { icon: HardDrive, title: 'NVMe SSD', desc: 'Armazenamento de alta velocidade para máxima performance.' },
  { icon: RotateCcw, title: 'Backup Diário', desc: 'Cópias automáticas com restauração com um clique.' },
  { icon: Bot, title: 'Criador com IA', desc: 'Gere conteúdo, páginas e posts com inteligência artificial.' },
  { icon: BarChart, title: 'Otimização SEO', desc: 'Ferramentas integradas para melhor posicionamento nos motores de busca.' },
  { icon: Lock, title: 'Segurança Reforçada', desc: 'Firewall WAF, protecção malware e scan automático.' },
  { icon: Headphones, title: 'Suporte Especializado', desc: 'Equipa com conhecimento profundo em WordPress disponível 24/7.' },
]

export default async function HospedagemWordPressPage() {
  const banner = await getBannerPage('hospedagem-wordpress')
  const fromPrice = await fromPriceText('wordpress')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Hospedagem WordPress'}
          tag={banner?.tag ?? 'WordPress Optimizado'}
          title={banner?.title ?? 'Hospedagem WordPress optimizada para máxima performance'}
          subtitle={banner?.subtitle ?? 'WordPress pré-instalado, LiteSpeed, SSL grátis, CDN global e criador de sites com IA incluído em todos os planos.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos WordPress'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#080d1a'}
          highlights={banner?.highlights?.length ? banner.highlights : ["WordPress Pré-instalado","LiteSpeed Cache","CDN Global","SSL Grátis"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <DynamicServicePricing category="wordpress" cols={3} showBillingToggle
          title="Hospedagem WordPress — Escolha o plano"
          subtitle="Escolha o plano, depois o domínio e a duração." />
        <IncludedFeatures features={included} />
        <FinalCTA
          title="Lance o seu WordPress hoje"
          subtitle="WordPress pré-instalado, criador com IA e migração gratuita." />
      </main>
      <Footer />
    </>
  )
}
