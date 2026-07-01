import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { ServicePricingCards, type PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { MessageCircle, Zap, Shield, HardDrive, Globe, Lock, Headphones, Server, Workflow } from 'lucide-react'

export const metadata: Metadata = {
  title: 'VPS Evolution API — WhatsApp Business',
  description: 'Servidor VPS com Evolution API para WhatsApp Business, chatbots, integrações e automações. Múltiplos números.',
}

const plans: PricingPlan[] = [
  {
    id: 'evolution-start',
    name: 'Evolution Start',
    price: 'Kz 69.000',
    period: '/mês',
    description: 'Para começar com WhatsApp API',
    features: ['Evolution API pré-instalada', '2 vCPU', '4 GB RAM', '60 GB NVMe SSD', 'Até 5 números WhatsApp', 'Webhooks incluídos', 'SSL grátis', 'Backup semanal', 'Suporte 24/7'],
    notIncluded: ['Até 20 números', 'Painel multi-instância'],
    cta: 'Começar com Evolution Start',
  },
  {
    id: 'evolution-pro',
    name: 'Evolution Pro',
    price: 'Kz 129.000',
    period: '/mês',
    description: 'Para empresas e agências',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['Evolution API pré-instalada', '4 vCPU', '8 GB RAM', '120 GB NVMe SSD', 'Até 20 números WhatsApp', 'Webhooks avançados', 'Painel multi-instância', 'Integrações n8n e CRM', 'SSL grátis', 'Backup diário', 'Suporte prioritário 24/7'],
    cta: 'Começar com Evolution Pro',
  },
  {
    id: 'evolution-scale',
    name: 'Evolution Scale',
    price: 'Kz 249.000',
    period: '/mês',
    description: 'Para alto volume e múltiplas empresas',
    badge: 'MELHOR VALOR',
    features: ['Evolution API pré-instalada', '8 vCPU', '16 GB RAM', '240 GB NVMe SSD', 'Até 100 números WhatsApp', 'Webhooks avançados', 'Painel multi-instância', 'Todas as integrações', 'Monitoramento de sessões', 'SSL grátis', 'Backup diário', 'Suporte premium 24/7'],
    cta: 'Começar com Evolution Scale',
  },
]

const included = [
  { icon: MessageCircle, title: 'Evolution API Pré-instalada', desc: 'API do WhatsApp configurada e pronta para conectar os seus números.' },
  { icon: Zap, title: 'Múltiplos Números', desc: 'Gere vários números WhatsApp Business numa única instância.' },
  { icon: Workflow, title: 'Webhooks Avançados', desc: 'Recebe mensagens e eventos em tempo real para integrações.' },
  { icon: Globe, title: 'Integrações', desc: 'Conecta com n8n, CRMs, chatbots e sistemas de atendimento.' },
  { icon: Shield, title: 'SSL Grátis', desc: 'Painel e API protegidos com HTTPS incluído.' },
  { icon: HardDrive, title: 'NVMe SSD', desc: 'Armazenamento rápido para processar grande volume de mensagens.' },
  { icon: Server, title: 'Root Access', desc: 'Acesso total ao servidor para personalizar a instalação.' },
  { icon: Lock, title: 'Segurança Avançada', desc: 'Autenticação e protecção das sessões WhatsApp.' },
  { icon: Headphones, title: 'Suporte Especializado', desc: 'Equipa com conhecimento em Evolution API e WhatsApp disponível 24/7.' },
]

export default function VPSEvolutionAPIPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumbParent="Servidor VPS"
          breadcrumbParentHref="/servidor-vps"
          breadcrumb="VPS Evolution API"
          tag="WhatsApp Business API"
          title="Automatize, integre e escale o seu WhatsApp com Evolution API"
          subtitle="Servidor VPS preparado para WhatsApp Business, chatbots, integrações e automações. Múltiplos números, webhooks e painel completo."
          price="A partir de Kz 69.000/mês"
          cta="Ver Planos Evolution API"
          ctaHref="#planos"
          ctaSecondary="Falar com Especialista"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=1920&q=80&auto=format&fit=crop"
          bgColor="#062006"
          highlights={['Evolution API Instalada', 'Múltiplos Números', 'Webhooks Avançados', 'Integrações CRM']}
        />
        <ServicePricingCards plans={plans} cols={3}
          title="VPS Evolution API — Planos"
          subtitle="Servidor pré-configurado com Evolution API. Comece a automatizar o WhatsApp hoje." />
        <IncludedFeatures features={included} dark
          title="Tudo incluído no VPS Evolution API" />
        <FinalCTA
          title="Comece a automatizar o WhatsApp hoje"
          subtitle="Servidor pré-configurado, múltiplos números e integrações completas."
          cta="Contratar Evolution API"
          ctaHref="/register?plan=evolution-pro" />
      </main>
      <Footer />
    </>
  )
}
