import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Server, Shield, Zap, HardDrive, Mail, RotateCcw, Headphones, Globe, Lock, Bot, BarChart } from 'lucide-react'
import Link from 'next/link'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import { HostingPlansSection } from '@/components/service/HostingPlansSection'

export const metadata: Metadata = {
  title: 'Hospedagem de Sites Premium',
  description: 'Hospedagem web premium com LiteSpeed, NVMe SSD, SSL grátis, cPanel e suporte 24/7. Uptime 99.9% garantido.',
}


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

// Hospedagem WordPress (antes em /hospedagem-wordpress, que encaminha para #wordpress): conteúdo e planos WordPress
const wordpressIncluded = [
  { icon: Globe, title: 'WordPress pré-instalado', desc: 'Instância WordPress pronta a usar logo após a activação.' },
  { icon: Zap, title: 'LiteSpeed + cache WordPress', desc: 'Cache avançado específico para WordPress — carregamentos ultrarrápidos.' },
  { icon: RotateCcw, title: 'Backup diário', desc: 'Cópias automáticas com restauração com um clique.' },
  { icon: Bot, title: 'Criador com IA', desc: 'Gere conteúdo, páginas e posts com inteligência artificial.' },
  { icon: BarChart, title: 'Optimização SEO', desc: 'Ferramentas integradas para melhor posicionamento nos motores de busca.' },
  { icon: Lock, title: 'Segurança reforçada', desc: 'Firewall WAF, protecção contra malware e verificação automática.' },
]

export default async function HospedagemDeSitesPage() {
  const banner = await getBannerPage('hospedagem-de-sites')
  const fromPrice = await fromPriceText('hosting')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Hospedagem de Sites'}
          tag={banner?.tag ?? 'Hospedagem Premium'}
          title={banner?.title ?? 'Hospedagem de Sites Premium para o seu Negócio'}
          subtitle={banner?.subtitle ?? 'Performance ultrarrápida com LiteSpeed, NVMe SSD, SSL grátis, cPanel e suporte técnico especializado 24/7.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#080d1a'}
          highlights={banner?.highlights?.length ? banner.highlights : ["LiteSpeed Enterprise","NVMe SSD Gen4","Uptime 99.9%","cPanel Incluído"]}
          guarantee={banner?.show_guarantee ?? true}
          layout="split"
        />
        <HostingPlansSection
          title="Hospedagem de Sites — Escolha o seu plano"
          subtitle="Escolha o plano e o período; depois o domínio e os extras." />
        <div className="bg-[#FFFBEA] border-y border-[#F5E3A3]">
          <p className="container mx-auto px-4 py-3 text-sm text-center text-[#5C4A00]">
            Vai usar WordPress? <Link href="#wordpress" className="font-bold underline" data-testid="link-wordpress">Veja a hospedagem WordPress optimizada</Link> — WordPress pré-instalado, cache e criador com IA.
          </p>
        </div>
        <IncludedFeatures features={included} hoverBorder />
        <section id="wordpress" className="scroll-mt-24 bg-white" data-testid="section-wordpress" aria-labelledby="wordpress-title">
          <div className="container mx-auto px-4 pt-16 text-center max-w-3xl">
            <span className="section-tag">WordPress</span>
            <h2 id="wordpress-title" className="text-3xl md:text-4xl font-black text-[#0A0A0A] mt-3">Hospedagem WordPress optimizada</h2>
            <p className="text-[#666] mt-3">WordPress pré-instalado, LiteSpeed, SSL grátis, CDN e criador de sites com IA incluídos em todos os planos WordPress.</p>
          </div>
          <IncludedFeatures features={wordpressIncluded} title="Incluído nos planos WordPress" subtitle="Optimizações específicas para WordPress, sem custo adicional." />
          <DynamicServicePricing id="planos-wordpress" category="wordpress" cols={3} showBillingToggle
            title="Planos WordPress"
            subtitle="Escolha o plano, depois o domínio e a duração." />
        </section>
        <FinalCTA
          title="Comece hoje"
          subtitle="Migração gratuita, suporte 24/7 e uptime 99.9% garantido. Sem riscos." />
      </main>
      <Footer />
    </>
  )
}
