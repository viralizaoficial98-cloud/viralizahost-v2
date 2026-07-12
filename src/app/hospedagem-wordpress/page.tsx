import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Globe, Shield, Zap, HardDrive, RotateCcw, Headphones, Lock, Bot, BarChart } from 'lucide-react'

const fallbackPlans = [
  { id: 'wp-start', name: 'WordPress Start', price: 'Kz 24.900', period: '/mês', description: 'Para blogs e sites pessoais', features: ['1 site WordPress', '20 GB NVMe SSD', 'WordPress pré-instalado', 'SSL grátis', 'Backup semanal', 'Migração gratuita', 'Suporte 24/7'], notIncluded: ['CDN global', 'Criador IA', 'Staging'], cta: 'Começar com Start' },
  { id: 'wp-pro', name: 'WordPress Pro', price: 'Kz 49.900', period: '/mês', description: 'Para empresas e lojas WooCommerce', popular: true, badge: 'MAIS POPULAR', features: ['5 sites WordPress', '50 GB NVMe SSD', 'WordPress pré-instalado', 'SSL grátis', 'CDN global', 'Backup diário', 'Criador de Sites com IA', 'Otimização SEO automática', 'Migração gratuita', 'Suporte prioritário 24/7'], cta: 'Começar com Pro' },
  { id: 'wp-turbo', name: 'WordPress Turbo', price: 'Kz 99.900', period: '/mês', description: 'Máxima performance para alta demanda', badge: 'MELHOR VALOR', features: ['Sites WordPress ilimitados', '200 GB NVMe SSD', 'WordPress pré-instalado', 'SSL grátis', 'CDN global premium', 'Backup diário automático', 'Criador de Sites com IA', 'Otimização SEO avançada', 'Ambiente staging', 'Segurança reforçada', 'IP dedicado', 'Suporte premium 24/7'], cta: 'Começar com Turbo' },
]

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
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Hospedagem WordPress'}
          tag={banner?.tag ?? 'WordPress Optimizado'}
          title={banner?.title ?? 'Hospedagem WordPress optimizada para máxima performance'}
          subtitle={banner?.subtitle ?? 'WordPress pré-instalado, LiteSpeed, SSL grátis, CDN global e criador de sites com IA incluído em todos os planos.'}
          price={banner?.price_text ?? 'A partir de Kz 24.900/mês'}
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
          subtitle="Todos os planos com WordPress pré-instalado e garantia de 30 dias."
          fallbackPlans={fallbackPlans} />
        <IncludedFeatures features={included} />
        <FinalCTA
          title="Lance o seu WordPress hoje"
          subtitle="WordPress pré-instalado, criador com IA e migração gratuita. Sem riscos, sem contratos." />
      </main>
      <Footer />
    </>
  )
}
