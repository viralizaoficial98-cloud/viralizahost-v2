import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { DedicatedPlansSection } from '@/components/service/DedicatedPlansSection'
import { DedicatedCompatibility } from '@/components/service/DedicatedCompatibility'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Monitor, HardDrive, Globe, Shield, Zap, Server, Headphones, Lock, RotateCcw } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Servidor Dedicado Windows',
  description: 'Servidores Windows Server com Plesk, ASP.NET, MS SQL, RDP e alta disponibilidade para projectos Microsoft.',
}


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

export default async function ServidorDedicadoWindowsPage() {
  const banner = await getBannerPage('servidor-dedicado-windows')
  const fromPrice = await fromPriceText('dedicated-windows')
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Servidor Dedicado Windows'}
          tag={banner?.tag ?? 'Windows Server + Plesk'}
          title={banner?.title ?? 'Máxima performance para projectos em ASP.NET e MS SQL'}
          subtitle={banner?.subtitle ?? 'Servidor dedicado Windows com Plesk, ASP.NET, Microsoft SQL Server, Remote Desktop e alta estabilidade para sistemas críticos.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos Windows'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Especialista'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#060810'}
          highlights={banner?.highlights?.length ? banner.highlights : ["Windows Server 2022","Plesk Incluído","MS SQL Server","Remote Desktop"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <DedicatedPlansSection kind="windows"
          title="Servidor Dedicado Windows — Planos"
          subtitle="Hardware exclusivo com Windows Server licenciado. Escolha o período e compre — activação pela equipa depois do pagamento confirmado." />
        <DedicatedCompatibility kind="windows" />
        <IncludedFeatures features={included} dark
          title="Infra-estrutura Windows completa incluída" />
        <FinalCTA
          title="Implante o seu servidor Windows hoje"
          subtitle="Windows Server licenciado, Plesk incluído e suporte de especialistas Microsoft."
          cta="Contratar Servidor Windows"
          ctaHref="#planos" />
      </main>
      <Footer />
    </>
  )
}
