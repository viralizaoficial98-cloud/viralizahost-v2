import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { ServicePricingCards, type PricingPlan } from '@/components/service/ServicePricingCards'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Monitor, HardDrive, Globe, Shield, Zap, Server, Headphones, Lock, RotateCcw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Servidor Dedicado Windows',
  description: 'Servidores Windows Server com Plesk, ASP.NET, MS SQL, RDP e alta disponibilidade para projectos Microsoft.',
}

const plans: PricingPlan[] = [
  {
    id: 'win-black',
    name: 'Black',
    price: 'Kz 299.000',
    period: '/mês',
    description: 'Para projectos iniciais Windows',
    features: ['16 vCPU dedicadas', '32 GB RAM DDR5', '480 GB NVMe SSD', 'Windows Server 2022', 'Plesk incluído', 'ASP.NET', 'MS SQL Express', 'Remote Desktop (RDP)', 'SSL grátis', 'Suporte 24/7'],
    notIncluded: ['MS SQL Standard', 'Backup gerido diário'],
    cta: 'Contratar Black',
  },
  {
    id: 'win-sapphire',
    name: 'Sapphire',
    price: 'Kz 549.000',
    period: '/mês',
    description: 'Para sistemas empresariais',
    popular: true,
    badge: 'MAIS POPULAR',
    features: ['32 vCPU dedicadas', '64 GB RAM DDR5', '960 GB NVMe SSD', 'Windows Server 2022', 'Plesk incluído', 'ASP.NET avançado', 'MS SQL Standard', 'Remote Desktop (RDP)', 'SSL grátis', 'Backup semanal', 'Alta disponibilidade', 'Suporte prioritário 24/7'],
    cta: 'Contratar Sapphire',
  },
  {
    id: 'win-diamond',
    name: 'Diamond',
    price: 'Kz 999.000',
    period: '/mês',
    description: 'Máxima performance para MS SQL',
    badge: 'MELHOR VALOR',
    features: ['64 vCPU dedicadas', '128 GB RAM DDR5', '1.920 GB NVMe SSD', 'Windows Server 2022', 'Plesk Enterprise', 'ASP.NET avançado', 'MS SQL Enterprise', 'Remote Desktop (RDP)', 'SSL grátis', 'Backup diário gerido', 'Alta disponibilidade', 'IP dedicado', 'SLA premium', 'Suporte premium 24/7'],
    cta: 'Contratar Diamond',
  },
]

const included = [
  { icon: Monitor, title: 'Windows Server 2022', desc: 'Sistema operativo Windows Server licenciado e actualizado incluído.' },
  { icon: Globe, title: 'Plesk Incluído', desc: 'Painel de gestão completo para ambientes Windows.' },
  { icon: Zap, title: 'ASP.NET', desc: 'Framework Microsoft para desenvolvimento de aplicações web e APIs.' },
  { icon: HardDrive, title: 'MS SQL Server', desc: 'Base de dados Microsoft SQL Server para projectos .NET.' },
  { icon: Server, title: 'Remote Desktop (RDP)', desc: 'Acesso remoto ao servidor Windows via Remote Desktop Protocol.' },
  { icon: Shield, title: 'Alta Disponibilidade', desc: 'Infra-estrutura redundante para máxima continuidade do negócio.' },
  { icon: RotateCcw, title: 'Backup Gerido', desc: 'Cópias de segurança geridas com recuperação simplificada.' },
  { icon: Lock, title: 'Protecção DDoS', desc: 'Protecção avançada contra ataques de negação de serviço.' },
  { icon: Headphones, title: 'Suporte Windows 24/7', desc: 'Equipa com especialização em ambientes Windows Server e MS SQL.' },
]

export default function ServidorDedicadoWindowsPage() {
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb="Servidor Dedicado Windows"
          tag="Windows Server + Plesk"
          title="Máxima performance para projectos em ASP.NET e MS SQL"
          subtitle="Servidor dedicado Windows com Plesk, ASP.NET, Microsoft SQL Server, Remote Desktop e alta estabilidade para sistemas críticos."
          price="A partir de Kz 299.000/mês"
          cta="Ver Planos Windows"
          ctaHref="#planos"
          ctaSecondary="Falar com Especialista"
          ctaSecondaryHref="/tickets"
          bgImage="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80&auto=format&fit=crop"
          bgColor="#060810"
          highlights={['Windows Server 2022', 'Plesk Incluído', 'MS SQL Server', 'Remote Desktop']}
        />
        <ServicePricingCards plans={plans} cols={3}
          title="Servidor Dedicado Windows — Planos"
          subtitle="Hardware exclusivo com Windows Server licenciado. Suporte especializado 24/7." />
        <IncludedFeatures features={included} dark
          title="Infra-estrutura Windows completa incluída" />
        <FinalCTA
          title="Implante o seu servidor Windows hoje"
          subtitle="Windows Server licenciado, Plesk incluído e suporte de especialistas Microsoft."
          cta="Contratar Servidor Windows"
          ctaHref="/register?plan=win-sapphire" />
      </main>
      <Footer />
    </>
  )
}
