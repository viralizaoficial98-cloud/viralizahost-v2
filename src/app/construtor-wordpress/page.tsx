import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { ServicePricingCards, type PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Code, Globe, Shield, Zap, RotateCcw, Lock, Headphones, BarChart, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Construtor de Sites WordPress',
  description: 'WordPress com builder visual, plugins premium, SSL grátis e hospedagem optimizada para máxima performance.',
}

const plans: PricingPlan[] = [
  {
    id: 'wp-builder-start',
    name: 'Builder Start',
    price: 'Kz 29.900', priceAOA: 29900,
    period: '/mês',
    description: 'Para começar com WordPress',
    features: ['1 site WordPress', 'Builder visual incluído', '20 GB NVMe SSD', 'SSL grátis', 'Plugins premium básicos', 'Backup semanal', 'Suporte 24/7'],
    notIncluded: ['WooCommerce', 'Plugins premium avançados'],
    cta: 'Começar com Builder',
  },
  {
    id: 'wp-builder-pro',
    name: 'Builder Pro',
    price: 'Kz 59.900', priceAOA: 59900,
    period: '/mês',
    description: 'Para lojas e empresas',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['5 sites WordPress', 'Builder visual avançado', '50 GB NVMe SSD', 'SSL grátis', 'Plugins premium completos', 'WooCommerce integrado', 'Backup diário', 'CDN global', 'Suporte prioritário 24/7'],
    cta: 'Começar com Builder Pro',
  },
  {
    id: 'wp-builder-turbo',
    name: 'Builder Turbo',
    price: 'Kz 119.900', priceAOA: 119900,
    period: '/mês',
    description: 'Máxima performance e flexibilidade',
    badge: 'MELHOR VALOR',
    features: ['Sites ilimitados', 'Builder visual premium', '200 GB NVMe SSD', 'SSL grátis', 'Todos os plugins premium', 'WooCommerce avançado', 'Backup diário automático', 'CDN global premium', 'Ambiente staging', 'IP dedicado', 'Suporte premium 24/7'],
    cta: 'Começar com Builder Turbo',
  },
]

const included = [
  { icon: Code, title: 'Builder Visual', desc: 'Editor drag-and-drop profissional para criar páginas bonitas sem código.' },
  { icon: Globe, title: 'WordPress Pré-instalado', desc: 'WordPress configurado e pronto a usar desde o primeiro momento.' },
  { icon: Shield, title: 'SSL Grátis', desc: 'Certificado HTTPS automático em todos os sites.' },
  { icon: Zap, title: 'LiteSpeed + Cache', desc: 'Performance optimizada especificamente para WordPress.' },
  { icon: Layers, title: 'Plugins Premium', desc: 'Colecção de plugins premium para design, SEO, segurança e mais.' },
  { icon: RotateCcw, title: 'Backup Diário', desc: 'Cópias automáticas com restauração simples.' },
  { icon: BarChart, title: 'SEO Integrado', desc: 'Ferramentas de otimização para motores de busca incluídas.' },
  { icon: Lock, title: 'Segurança WordPress', desc: 'Protecção avançada contra malware, força bruta e vulnerabilidades.' },
  { icon: Headphones, title: 'Suporte Especializado', desc: 'Equipa com expertise em WordPress disponível 24/7.' },
]

export default async function ConstrutorWordPressPage() {
  const banner = await getBannerPage('construtor-wordpress')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Construtor WordPress'}
          tag={banner?.tag ?? 'WordPress + Builder Visual'}
          title={banner?.title ?? 'Crie sites WordPress incríveis com builder visual'}
          subtitle={banner?.subtitle ?? 'WordPress optimizado com builder drag-and-drop, plugins premium, SSL grátis e hospedagem de alta performance.'}
          price={banner?.price_text ?? 'A partir de Kz 29.900/mês'}
          cta={banner?.button_primary_text ?? 'Ver Planos'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1580584126903-c17d41830450?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#0a0c14'}
          highlights={banner?.highlights?.length ? banner.highlights : ["Builder Visual","Plugins Premium","WordPress Pré-instalado","CDN Global"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <ServicePricingCards plans={plans} cols={3}
          title="Construtor WordPress — Planos"
          subtitle="Tudo o que precisa para criar sites WordPress profissionais." />
        <IncludedFeatures features={included}
          title="Incluído em todos os planos WordPress" />
        <FinalCTA
          title="Comece a construir com WordPress hoje"
          subtitle="Builder visual, plugins premium e hospedagem optimizada. Garantia de 30 dias." />
      </main>
      <Footer />
    </>
  )
}
