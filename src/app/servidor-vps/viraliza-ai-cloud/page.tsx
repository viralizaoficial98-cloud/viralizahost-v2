import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { ServicePricingCards, type PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Bot, Zap, MessageCircle, Globe, Shield, HardDrive, Lock, Headphones, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Viraliza AI Cloud — Agentes IA para Negócios',
  description: 'Configure assistentes inteligentes, integrações e automações sem complicação. WhatsApp, Gmail, Slack e mais.',
}

const plans: PricingPlan[] = [
  {
    id: 'ai-cloud-start',
    name: 'AI Cloud Start',
    price: 'Kz 89.000',
    period: '/mês',
    description: 'Para começar com agentes de IA',
    features: ['Agente de IA pré-instalado', '2 vCPU', '4 GB RAM', '60 GB NVMe SSD', 'Integração WhatsApp', 'Integração Gmail', 'SSL grátis', 'Backup semanal', 'Suporte 24/7'],
    notIncluded: ['Agentes múltiplos', 'Integração Slack/Trello'],
    cta: 'Começar com AI Cloud Start',
  },
  {
    id: 'ai-cloud-pro',
    name: 'AI Cloud Pro',
    price: 'Kz 169.000',
    period: '/mês',
    description: 'Para empresas e equipas',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['Múltiplos agentes de IA', '4 vCPU', '8 GB RAM', '120 GB NVMe SSD', 'Integração WhatsApp', 'Integração Telegram', 'Integração Gmail', 'Integração Google Agenda', 'Integração Slack', 'SSL grátis', 'Backup diário', 'Suporte prioritário 24/7'],
    cta: 'Começar com AI Cloud Pro',
  },
  {
    id: 'ai-cloud-enterprise',
    name: 'AI Cloud Enterprise',
    price: 'Kz 349.000',
    period: '/mês',
    description: 'Para grandes operações com IA',
    badge: 'ENTERPRISE',
    features: ['Agentes ilimitados', '8 vCPU', '16 GB RAM', '240 GB NVMe SSD', 'Integração WhatsApp', 'Integração Telegram', 'Integração Gmail', 'Integração Google Agenda', 'Integração Slack', 'Integração Trello', 'Integrações personalizadas', 'SSL grátis', 'Backup diário', 'Gerente de conta dedicado', 'Suporte premium 24/7'],
    cta: 'Contatar Comercial',
    href: '/tickets',
  },
]

const included = [
  { icon: Bot, title: 'Agente de IA Pré-instalado', desc: 'Assistente inteligente configurado e pronto para representar o seu negócio.' },
  { icon: MessageCircle, title: 'WhatsApp Integrado', desc: 'Agente responde automaticamente no WhatsApp Business.' },
  { icon: Globe, title: 'Telegram Integrado', desc: 'Atendimento automatizado também no Telegram.' },
  { icon: Zap, title: 'Google Agenda', desc: 'Agendamento de reuniões e lembretes automáticos integrados.' },
  { icon: Layers, title: 'Slack & Trello', desc: 'Notificações e actualizações automáticas nas ferramentas da equipa.' },
  { icon: Shield, title: 'Gmail Integrado', desc: 'Respostas automáticas e triagem de e-mails com IA.' },
  { icon: HardDrive, title: 'NVMe SSD', desc: 'Armazenamento rápido para processamento de dados de IA.' },
  { icon: Lock, title: 'Dados Seguros', desc: 'Todos os dados dos seus agentes encriptados e seguros.' },
  { icon: Headphones, title: 'Suporte IA 24/7', desc: 'Equipa especializada em inteligência artificial disponível sempre.' },
]

export default function ViralizaAICloudPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumbParent="Servidor VPS"
          breadcrumbParentHref="/servidor-vps"
          breadcrumb="Viraliza AI Cloud"
          tag="IA & Automação Empresarial"
          title="Agentes de IA prontos para automatizar o seu negócio"
          subtitle="Configure assistentes inteligentes, integrações e automações sem complicação. WhatsApp, Gmail, Slack, Trello e muito mais."
          price="A partir de Kz 89.000/mês"
          cta="Ver Planos AI Cloud"
          ctaHref="#planos"
          ctaSecondary="Falar com Especialista"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=80&auto=format&fit=crop"
          bgColor="#04060f"
          highlights={['Agentes de IA', 'WhatsApp + Telegram', 'Gmail + Google Agenda', 'Integrações Empresariais']}
        />
        <ServicePricingCards plans={plans} cols={3}
          title="Viraliza AI Cloud — Planos"
          subtitle="Agentes de IA integrados com as ferramentas do seu negócio." />
        <IncludedFeatures features={included} dark
          title="Tudo incluído no Viraliza AI Cloud" />
        <FinalCTA
          title="Active os seus agentes de IA hoje"
          subtitle="Assistentes inteligentes, integrações completas e suporte especializado."
          cta="Contratar AI Cloud"
          ctaHref="/register?plan=ai-cloud-pro" />
      </main>
      <Footer />
    </>
  )
}
