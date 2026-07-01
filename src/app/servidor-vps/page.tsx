import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { ServicePricingCards, type PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Cpu, HardDrive, Globe, Shield, Zap, Server, Headphones, Lock, RotateCcw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Servidor VPS — Alta Performance',
  description: 'Servidores VPS com RAM DDR5, NVMe SSD, IP dedicado e transferência ilimitada. Root access total.',
}

const plans: PricingPlan[] = [
  {
    id: 'vps-nvme2',
    name: 'VPS NVMe 2',
    price: 'Kz 45.000',
    period: '/mês',
    description: 'Para projectos iniciais',
    features: ['2 vCPU', '4 GB RAM DDR5', '60 GB NVMe SSD', 'IP dedicado', 'Transferência ilimitada', 'Root access', 'Migração grátis', 'Suporte 24/7'],
    notIncluded: ['cPanel', 'Backup gerido'],
    cta: 'Contratar VPS NVMe 2',
  },
  {
    id: 'vps-nvme4',
    name: 'VPS NVMe 4',
    price: 'Kz 85.000',
    period: '/mês',
    description: 'Para aplicações e e-commerce',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['4 vCPU', '8 GB RAM DDR5', '120 GB NVMe SSD', 'IP dedicado', 'Transferência ilimitada', 'Root access', 'cPanel opcional', 'Backup semanal gerido', 'Migração grátis', 'Suporte prioritário 24/7'],
    cta: 'Contratar VPS NVMe 4',
  },
  {
    id: 'vps-nvme8',
    name: 'VPS NVMe 8',
    price: 'Kz 159.000',
    period: '/mês',
    description: 'Para alta demanda e escala',
    badge: 'MELHOR VALOR',
    features: ['8 vCPU', '16 GB RAM DDR5', '240 GB NVMe SSD', 'IP dedicado', 'Transferência ilimitada', 'Root access', 'cPanel incluído', 'Backup diário gerido', 'Migração grátis', 'Snapshots', 'Suporte premium 24/7'],
    cta: 'Contratar VPS NVMe 8',
  },
]

const included = [
  { icon: Cpu, title: 'vCPU Dedicadas', desc: 'Núcleos de CPU exclusivos sem partilha com outros utilizadores.' },
  { icon: HardDrive, title: 'NVMe SSD Gen4', desc: 'Armazenamento ultrarrápido para máxima performance de I/O.' },
  { icon: Globe, title: 'IP Dedicado', desc: 'Endereço IP exclusivo para o seu servidor.' },
  { icon: Shield, title: 'Protecção DDoS', desc: 'Protecção avançada contra ataques de negação de serviço.' },
  { icon: Zap, title: 'Transferência Ilimitada', desc: 'Sem limites de largura de banda para o seu servidor.' },
  { icon: Server, title: 'Root Access', desc: 'Acesso total ao servidor para instalar qualquer software.' },
  { icon: RotateCcw, title: 'Migração Gratuita', desc: 'Migramos o seu servidor existente sem custos adicionais.' },
  { icon: Lock, title: 'Firewall Gerido', desc: 'Regras de firewall configuráveis para proteger o seu servidor.' },
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Suporte técnico especializado em servidores disponível sempre.' },
]

export default function ServidorVPSPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb="Servidor VPS"
          tag="Servidores Cloud VPS"
          title="Servidor VPS de alta performance para projectos exigentes"
          subtitle="Infraestrutura segura, rápida e escalável para sistemas, sites, automações e aplicações. RAM DDR5 e NVMe SSD incluídos."
          price="A partir de Kz 45.000/mês"
          cta="Ver Planos VPS"
          ctaHref="#planos"
          ctaSecondary="Falar com Especialista"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80&auto=format&fit=crop"
          bgColor="#060b14"
          highlights={['RAM DDR5', 'NVMe SSD', 'IP Dedicado', 'Root Access']}
        />
        <ServicePricingCards plans={plans} cols={3}
          title="Servidor VPS — Escolha o seu plano"
          subtitle="Alta performance com escalabilidade total. Activação imediata." />
        <IncludedFeatures features={included} dark
          title="Infra-estrutura premium incluída" />
        <FinalCTA
          title="Active o seu VPS em minutos"
          subtitle="Activação imediata, root access total e suporte especializado 24/7."
          cta="Contratar VPS"
          ctaHref="/register?plan=vps-nvme4" />
      </main>
      <Footer />
    </>
  )
}
