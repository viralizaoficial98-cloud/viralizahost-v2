import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { ServicePricingCards } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Server, Shield, Zap, HardDrive, Mail, RotateCcw, Headphones, Globe, Lock } from 'lucide-react'
import type { PricingPlan } from '@/components/service/ServicePricingCards'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'

export const metadata: Metadata = {
  title: 'Hospedagem de Sites Premium',
  description: 'Hospedagem web premium com LiteSpeed, NVMe SSD, SSL grátis, cPanel e suporte 24/7. Uptime 99.9% garantido.',
}

const fallbackPlans: PricingPlan[] = [
  {
    id: 'hosting-start',
    name: 'Plano Start',
    price: 'Kz 19.900',
    period: '/mês',
    description: 'Ideal para sites pessoais e blogs',
    features: ['1 site hospedado', '20 GB NVMe SSD', 'SSL grátis', 'cPanel incluído', '5 contas de e-mail', 'Backup semanal', 'Migração gratuita', 'Suporte 24/7'],
    notIncluded: ['Sites ilimitados', 'CDN global'],
    cta: 'Começar com Start',
  },
  {
    id: 'hosting-business',
    name: 'Plano Business',
    price: 'Kz 39.900',
    period: '/mês',
    description: 'Para pequenas e médias empresas',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['5 sites hospedados', '50 GB NVMe SSD', 'SSL grátis', 'cPanel incluído', '20 contas de e-mail', 'Backup diário', 'Migração gratuita', 'Suporte prioritário 24/7', 'CDN básico'],
    notIncluded: ['Sites ilimitados'],
    cta: 'Começar com Business',
  },
  {
    id: 'hosting-turbo',
    name: 'Plano Turbo',
    price: 'Kz 79.900',
    period: '/mês',
    description: 'Performance máxima sem limites',
    badge: 'MELHOR VALOR',
    features: ['Sites ilimitados', '200 GB NVMe SSD', 'SSL grátis', 'cPanel incluído', 'E-mails ilimitados', 'Backup diário automático', 'Migração gratuita', 'Suporte premium 24/7', 'CDN global', 'IP dedicado'],
    cta: 'Começar com Turbo',
  },
]

const included = [
  { icon: Shield, title: 'SSL Grátis', desc: 'Certificado SSL/TLS Let\'s Encrypt instalado automaticamente em todos os domínios.' },
  { icon: Server, title: 'cPanel', desc: 'Painel de controlo completo e intuitivo para gerir o seu alojamento.' },
  { icon: Zap, title: 'LiteSpeed Web Server', desc: 'Até 6x mais rápido que o Apache, com cache avançado integrado.' },
  { icon: HardDrive, title: 'NVMe SSD Gen4', desc: 'Armazenamento ultrarrápido para carregamentos instantâneos.' },
  { icon: Mail, title: 'E-mail Corporativo', desc: 'Caixas de e-mail no seu domínio incluídas em todos os planos.' },
  { icon: RotateCcw, title: 'Backups Automáticos', desc: 'Cópias de segurança regulares para proteger os seus dados.' },
  { icon: Globe, title: 'Migração Gratuita', desc: 'A nossa equipa migra o seu site sem custo adicional e sem downtime.' },
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Equipa técnica especializada disponível a qualquer hora.' },
  { icon: Lock, title: 'Proteção DDoS', desc: 'Protecção avançada contra ataques de negação de serviço.' },
]

export default async function HospedagemDeSitesPage() {
  const banner = await getBannerPage('hospedagem-de-sites')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Hospedagem de Sites'}
          tag={banner?.tag ?? 'Hospedagem Premium'}
          title={banner?.title ?? 'Hospedagem de Sites Premium para o seu Negócio'}
          subtitle={banner?.subtitle ?? 'Performance ultrarrápida com LiteSpeed, NVMe SSD, SSL grátis, cPanel e suporte técnico especializado 24/7.'}
          price={banner?.price_text ?? 'A partir de Kz 19.900/mês'}
          cta={banner?.button_primary_text ?? 'Ver Planos'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#080d1a'}
          highlights={banner?.highlights?.length ? banner.highlights : ["LiteSpeed Enterprise","NVMe SSD Gen4","Uptime 99.9%","cPanel Incluído"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <DynamicServicePricing
          category="hosting"
          cols={3}
          showBillingToggle
          title="Hospedagem de Sites — Escolha o seu plano"
          subtitle="Sem compromisso. Todos os planos com garantia de 30 dias."
          fallbackPlans={fallbackPlans} />
        <IncludedFeatures features={included} />
        <FinalCTA
          title="Comece hoje com 30 dias de garantia"
          subtitle="Migração gratuita, suporte 24/7 e uptime 99.9% garantido. Sem riscos." />
      </main>
      <Footer />
    </>
  )
}
