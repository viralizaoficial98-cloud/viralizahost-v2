import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { ServicePricingCards, type PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Workflow, Zap, Shield, HardDrive, Globe, MessageCircle, Headphones, Lock, Server } from 'lucide-react'

export const metadata: Metadata = {
  title: 'VPS n8n Auto-hospedado',
  description: 'Servidor VPS com n8n pré-instalado para automações, integrações, IA e produtividade. Fluxos ilimitados.',
}

const plans: PricingPlan[] = [
  {
    id: 'n8n-start',
    name: 'n8n Start',
    price: 'Kz 55.000',
    period: '/mês',
    description: 'Para começar com automações',
    features: ['n8n pré-instalado', '2 vCPU', '4 GB RAM', '60 GB NVMe SSD', 'Fluxos ilimitados', 'SSL grátis', 'Backup semanal', 'Suporte 24/7'],
    notIncluded: ['Múltiplas instâncias', 'WhatsApp integrado'],
    cta: 'Começar com n8n Start',
  },
  {
    id: 'n8n-pro',
    name: 'n8n Pro',
    price: 'Kz 99.000',
    period: '/mês',
    description: 'Para agências e equipas',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['n8n pré-instalado', '4 vCPU', '8 GB RAM', '120 GB NVMe SSD', 'Fluxos ilimitados', 'SSL grátis', 'Webhooks avançados', 'Integração WhatsApp', 'Integração Google Sheets', 'Backup diário', 'Suporte prioritário 24/7'],
    cta: 'Começar com n8n Pro',
  },
  {
    id: 'n8n-scale',
    name: 'n8n Scale',
    price: 'Kz 179.000',
    period: '/mês',
    description: 'Para alta demanda e múltiplas equipas',
    badge: 'MELHOR VALOR',
    features: ['n8n pré-instalado', '8 vCPU', '16 GB RAM', '240 GB NVMe SSD', 'Múltiplas instâncias n8n', 'Fluxos ilimitados', 'SSL grátis', 'Webhooks avançados', 'Integração WhatsApp', 'Integração Google Sheets', 'Integração CRMs', 'Backup diário', 'Suporte premium 24/7'],
    cta: 'Começar com n8n Scale',
  },
]

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

export default function VPSn8nPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumbParent="Servidor VPS"
          breadcrumbParentHref="/servidor-vps"
          breadcrumb="VPS n8n Auto-hospedado"
          tag="Automação com n8n"
          title="Crie e rode as suas automações em minutos"
          subtitle="Servidor VPS com n8n preparado para automações, integrações com WhatsApp, Google Sheets, CRMs e muito mais. Fluxos ilimitados."
          price="A partir de Kz 55.000/mês"
          cta="Ver Planos n8n"
          ctaHref="#planos"
          ctaSecondary="Falar com Especialista"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80&auto=format&fit=crop"
          bgColor="#060b14"
          highlights={['n8n Pré-instalado', 'Fluxos Ilimitados', 'WhatsApp Integrado', 'Root Access']}
        />
        <ServicePricingCards plans={plans} cols={3}
          title="VPS n8n — Automação sem limites"
          subtitle="Servidor pronto com n8n configurado. Active e comece a automatizar hoje." />
        <IncludedFeatures features={included} dark
          title="Tudo incluído no VPS n8n" />
        <FinalCTA
          title="Comece a automatizar hoje com n8n"
          subtitle="Servidor pré-configurado, fluxos ilimitados e suporte especializado."
          cta="Contratar VPS n8n"
          ctaHref="/register?plan=n8n-pro" />
      </main>
      <Footer />
    </>
  )
}
