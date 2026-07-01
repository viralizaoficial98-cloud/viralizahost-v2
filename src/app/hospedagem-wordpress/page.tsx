import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { ServicePricingCards, type PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Globe, Shield, Zap, HardDrive, RotateCcw, Headphones, Lock, Bot, BarChart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Hospedagem WordPress com IA',
  description: 'WordPress otimizado, rápido, seguro e pronto para crescer. SSL grátis, CDN, backup diário e criador com IA.',
}

const plans: PricingPlan[] = [
  {
    id: 'wp-start',
    name: 'WordPress Start',
    price: 'Kz 24.900',
    period: '/mês',
    description: 'Para blogs e sites pessoais',
    features: ['1 site WordPress', '20 GB NVMe SSD', 'WordPress pré-instalado', 'SSL grátis', 'Backup semanal', 'Migração gratuita', 'Suporte 24/7'],
    notIncluded: ['CDN global', 'Criador IA', 'Staging'],
    cta: 'Começar com Start',
  },
  {
    id: 'wp-pro',
    name: 'WordPress Pro',
    price: 'Kz 49.900',
    period: '/mês',
    description: 'Para empresas e lojas WooCommerce',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['5 sites WordPress', '50 GB NVMe SSD', 'WordPress pré-instalado', 'SSL grátis', 'CDN global', 'Backup diário', 'Criador de Sites com IA', 'Otimização SEO automática', 'Migração gratuita', 'Suporte prioritário 24/7'],
    cta: 'Começar com Pro',
  },
  {
    id: 'wp-turbo',
    name: 'WordPress Turbo',
    price: 'Kz 99.900',
    period: '/mês',
    description: 'Máxima performance para alta demanda',
    badge: 'MELHOR VALOR',
    features: ['Sites WordPress ilimitados', '200 GB NVMe SSD', 'WordPress pré-instalado', 'SSL grátis', 'CDN global premium', 'Backup diário automático', 'Criador de Sites com IA', 'Otimização SEO avançada', 'Ambiente staging', 'Segurança reforçada', 'IP dedicado', 'Suporte premium 24/7'],
    cta: 'Começar com Turbo',
  },
]

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

export default function HospedagemWordPressPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb="Hospedagem WordPress"
          tag="WordPress Optimizado"
          title="Crie um blog ou site WordPress em minutos com IA"
          subtitle="WordPress otimizado, rápido, seguro e pronto para crescer. Com criador de sites por IA, CDN global e backup diário."
          price="A partir de Kz 24.900/mês"
          cta="Ver Planos WordPress"
          ctaHref="#planos"
          ctaSecondary="Falar com Especialista"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=1920&q=80&auto=format&fit=crop"
          bgColor="#0a0f1e"
          highlights={['WordPress Pré-instalado', 'Criador com IA', 'CDN Global', 'Backup Diário']}
        />
        <ServicePricingCards plans={plans} cols={3}
          title="Hospedagem WordPress — Escolha o plano"
          subtitle="Todos os planos com WordPress pré-instalado e garantia de 30 dias." />
        <IncludedFeatures features={included} />
        <FinalCTA
          title="Lance o seu WordPress hoje"
          subtitle="WordPress pré-instalado, criador com IA e migração gratuita. Sem riscos, sem contratos." />
      </main>
      <Footer />
    </>
  )
}
