import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import type { PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Bot, Zap, Globe, Shield, BarChart, Headphones, Lock, Code, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Criador de Sites com IA',
  description: 'Crie um site profissional em minutos com inteligência artificial. Sem código, sem design, sem complicações.',
}

const plans: PricingPlan[] = [
  {
    id: 'ia-starter',
    name: 'IA Starter',
    price: 'Kz 14.900',
    period: '/mês',
    description: 'Para começar com IA',
    features: ['1 site criado com IA', '10 GB de armazenamento', 'SSL grátis', 'Domínio gratuito 1 ano', 'Templates IA ilimitados', 'Suporte 24/7'],
    notIncluded: ['E-commerce integrado', 'IA de conteúdo avançada'],
    cta: 'Criar Meu Site',
  },
  {
    id: 'ia-pro',
    name: 'IA Pro',
    price: 'Kz 29.900',
    period: '/mês',
    description: 'Para empresas e profissionais',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['3 sites criados com IA', '50 GB de armazenamento', 'SSL grátis', 'Domínio gratuito 1 ano', 'Templates IA ilimitados', 'IA de conteúdo avançada', 'Blog integrado', 'Formulários e leads', 'Suporte prioritário 24/7'],
    cta: 'Criar com IA Pro',
  },
  {
    id: 'ia-business',
    name: 'IA Business',
    price: 'Kz 59.900',
    period: '/mês',
    description: 'Para lojas e alto tráfego',
    badge: 'MELHOR VALOR',
    features: ['Sites ilimitados com IA', '200 GB de armazenamento', 'SSL grátis', 'Domínios ilimitados', 'Templates IA ilimitados', 'IA de conteúdo avançada', 'E-commerce integrado', 'SEO automático com IA', 'Analytics avançados', 'Suporte premium 24/7'],
    cta: 'Criar com IA Business',
  },
]

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

export default function CriadorDeSitesPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb="Criador de Sites com IA"
          tag="Com Inteligência Artificial"
          title="Crie o seu site profissional em minutos com IA"
          subtitle="Descreve o teu negócio. A inteligência artificial cria o site completo, com textos, imagens e design. Sem código, sem design."
          price="A partir de Kz 14.900/mês"
          cta="Criar Meu Site com IA"
          ctaHref="#planos"
          ctaSecondary="Ver Demonstração"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=80&auto=format&fit=crop"
          bgColor="#05080f"
          highlights={['Site pronto em minutos', 'Sem código', 'Hospedagem incluída', 'SEO automático']}
        />
        <DynamicServicePricing category="website-builder" cols={3} showBillingToggle
          title="Criador de Sites com IA — Planos"
          subtitle="Crie sites profissionais sem nenhum conhecimento técnico."
          fallbackPlans={plans} />
        <IncludedFeatures features={included}
          title="Tudo incluído no seu criador de sites" />
        <FinalCTA
          title="Crie o seu site agora com IA"
          subtitle="Sem código, sem design, sem complicações. O site fica pronto em minutos."
          cta="Começar Grátis"
          ctaHref="/register?plan=ia-starter" />
      </main>
      <Footer />
    </>
  )
}
