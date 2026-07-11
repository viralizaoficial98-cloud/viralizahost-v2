import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import type { PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Shield, Bot, Zap, HardDrive, Globe, Lock, Headphones, Server, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Servidor VPS OpenClaw — Agentes de IA',
  description: 'VPS pré-configurado com OpenClaw para agentes de IA autónomos, automação sem código e integrações avançadas.',
}

const fallbackPlans: PricingPlan[] = [
  {
    id: 'vps-openclaw-start',
    name: 'OpenClaw Start',
    price: 'Kz 65.000',
    period: '/mês',
    description: 'Para experimentar agentes de IA',
    features: ['OpenClaw pré-instalado', '2 vCPU', '4 GB RAM', '60 GB NVMe SSD', '3 agentes de IA simultâneos', 'SSL grátis', 'Backup semanal', 'Suporte 24/7'],
    notIncluded: ['Agentes ilimitados', 'Cofre empresarial'],
    cta: 'Começar com OpenClaw Start',
  },
  {
    id: 'vps-openclaw-pro',
    name: 'OpenClaw Pro',
    price: 'Kz 119.000',
    period: '/mês',
    description: 'Para equipas e empresas',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['OpenClaw pré-instalado', '4 vCPU', '8 GB RAM', '120 GB NVMe SSD', '10 agentes de IA simultâneos', 'Automação sem código', 'Cofre seguro de dados', 'Integração com apps', 'SSL grátis', 'Backup diário', 'Suporte prioritário 24/7'],
    cta: 'Começar com OpenClaw Pro',
  },
  {
    id: 'vps-openclaw-scale',
    name: 'OpenClaw Scale',
    price: 'Kz 219.000',
    period: '/mês',
    description: 'Para operações de larga escala',
    badge: 'MELHOR VALOR',
    features: ['OpenClaw pré-instalado', '8 vCPU', '16 GB RAM', '240 GB NVMe SSD', 'Agentes ilimitados', 'Automação sem código avançada', 'Cofre empresarial', 'Todas as integrações', 'SSL grátis', 'Backup diário', 'Suporte especializado premium 24/7'],
    cta: 'Começar com OpenClaw Scale',
  },
]

const included = [
  { icon: Bot, title: 'OpenClaw Pré-instalado', desc: 'Plataforma de agentes de IA configurada e pronta a usar.' },
  { icon: Shield, title: 'Agentes Autónomos', desc: 'Agentes que agem por si, tomam decisões e executam tarefas automaticamente.' },
  { icon: Zap, title: 'Automação Sem Código', desc: 'Cria fluxos de automação complexos sem escrever uma linha de código.' },
  { icon: Lock, title: 'Cofre Seguro', desc: 'Armazenamento seguro de credenciais e dados sensíveis dos agentes.' },
  { icon: Layers, title: 'Integração com Apps', desc: 'Conecta os teus agentes a centenas de aplicações e serviços.' },
  { icon: HardDrive, title: 'NVMe SSD', desc: 'Armazenamento de alta velocidade para operações intensivas de dados.' },
  { icon: Globe, title: 'SSL Grátis', desc: 'Painel seguro com HTTPS incluído e configurado.' },
  { icon: Server, title: 'Servidor Dedicado', desc: 'Recursos de servidor exclusivos sem partilha com outros utilizadores.' },
  { icon: Headphones, title: 'Suporte Especializado', desc: 'Equipa com expertise em IA e agentes disponível 24/7.' },
]

export default function VPSOpenClawPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumbParent="Servidor VPS"
          breadcrumbParentHref="/servidor-vps"
          breadcrumb="VPS OpenClaw"
          tag="Agentes de IA Autónomos"
          title="Coloque um agente de IA a agir por si"
          subtitle="Mais autonomia, mais controlo e menos tarefas manuais no seu dia a dia. OpenClaw pré-instalado e pronto para começar."
          price="A partir de Kz 65.000/mês"
          cta="Ver Planos OpenClaw"
          ctaHref="#planos"
          ctaSecondary="Falar com Especialista"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1920&q=80&auto=format&fit=crop"
          bgColor="#06060f"
          highlights={['Agentes Autónomos', 'Automação Sem Código', 'Cofre Seguro', 'Integrações Ilimitadas']}
        />
        <DynamicServicePricing
          category="vps"
          subcategory="openclaw"
          cols={3}
          showBillingToggle
          title="VPS OpenClaw — Agentes de IA para o seu negócio"
          subtitle="Servidor pré-configurado com OpenClaw. Active e comece a automatizar com IA hoje."
          fallbackPlans={fallbackPlans} />
        <IncludedFeatures features={included} dark
          title="Tudo incluído no VPS OpenClaw" />
        <FinalCTA
          title="Active os seus agentes de IA hoje"
          subtitle="Servidor pré-configurado, automação sem código e suporte especializado."
          cta="Contratar OpenClaw"
          ctaHref="/checkout?plan=vps-openclaw-pro" />
      </main>
      <Footer />
    </>
  )
}
