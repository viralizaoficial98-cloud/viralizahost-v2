import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ServiceHero } from '@/components/service/ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'
import { fromPriceText } from '@/lib/commerce/from-price'
import { publicFamilyPlans } from '@/lib/commerce/family-plans'
import { ResellerOffer, type OfferMode } from '@/components/service/reseller/ResellerOffer'
import { ResellerComparison, ResellerFaq, ResellerHowItWorks, ResellerWhmInfo } from '@/components/service/reseller/ResellerInfo'
import { getResellerSettings } from '@/lib/reseller/settings'
import { listProfiles } from '@/lib/reseller/profiles'
import { createAuthClient } from '@/lib/supabase/server'
import { getPool } from '@/lib/db/pool'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { Users, Server, Globe, Shield, Mail, RotateCcw, Headphones, Lock, Layers } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Revenda de Hospedagem WHM/cPanel',
  description: 'Crie a sua própria empresa de hospedagem com WHM/cPanel, DNS privado, SSL e suporte ao revendedor.',
}


const included = [
  { icon: Server, title: 'WHM/cPanel', desc: 'Painel de gestão completo para administrar todas as contas dos seus clientes.' },
  { icon: Globe, title: 'DNS Privado Whitelabel', desc: 'Nameservers com a sua marca para uma identidade profissional.' },
  { icon: Shield, title: 'SSL por Conta', desc: 'Certificado SSL gratuito instalado automaticamente em cada conta de cliente.' },
  { icon: Users, title: 'Gestão de Clientes', desc: 'Ferramentas para criar, gerir e monitorizar as contas dos seus clientes.' },
  { icon: Mail, title: 'E-mail Corporativo', desc: 'Caixas de e-mail no domínio do cliente incluídas em todos os planos.' },
  { icon: RotateCcw, title: 'Migração Gratuita', desc: 'Migramos as contas existentes dos seus clientes sem custo.' },
  { icon: Lock, title: 'Protecção DDoS', desc: 'Infra-estrutura protegida contra ataques externos.' },
  { icon: Layers, title: 'Multi-PHP', desc: 'Suporte a múltiplas versões de PHP para compatibilidade total.' },
  { icon: Headphones, title: 'Suporte ao Revendedor', desc: 'Linha de suporte dedicada para revendedores disponível 24/7.' },
]

export const dynamic = 'force-dynamic'

export default async function RevendaDeHospedagemPage() {
  const banner = await getBannerPage('revenda-de-hospedagem')
  // Planos do catálogo (Catálogo e Preços → Revenda): mensal, trimestral, semestral e anual
  const plans = await publicFamilyPlans('reseller').catch(() => [])
  const fromPrice = await fromPriceText('reseller')
  // Modo comercial (painel → Revenda de Hospedagem); o servidor volta a validar cada pedido e cada compra
  const settings = await getResellerSettings().catch(() => null)
  const { data: { user } } = await (await createAuthClient()).auth.getUser()
  const [[me]] = user ? await getPool().query('SELECT full_name, email, phone, role FROM profiles WHERE id = ?', [user.id]).catch(() => [[null]]) as never : [[null]]
  const m = settings?.mode ?? 'disabled'
  const mode: OfferMode = m === 'disabled' ? 'closed' : m === 'test' ? ((me as { role?: string } | null)?.role === 'admin' ? 'test' : 'closed') : m === 'automatic' && settings?.automaticReady ? 'automatic' : 'request'
  const prefill = { fullName: String((me as { full_name?: string } | null)?.full_name ?? ''), email: String((me as { email?: string } | null)?.email ?? ''), phone: String((me as { phone?: string } | null)?.phone ?? ''), loggedIn: !!me }
  // Comparação: limites públicos do perfil técnico (espaço, contas, tráfego) — sem dados internos (ACL, pacotes, servidores)
  const profiles = await listProfiles().catch(() => [])
  const compare = plans.filter(p => !p.onRequest).map(p => {
    const pr = profiles.find(x => x.slug === p.slug)
    const monthly = p.periods.find(x => x.cycle === 'monthly')
    return { slug: p.slug, name: p.name, highlight: p.highlight, monthly: monthly ? monthly.total : p.base, storageMb: pr?.storageMb ?? null, bandwidthMb: pr?.bandwidthMb ?? null, accounts: pr?.maxAccounts ?? null }
  })
  return (
    <>
      <Header />
      <main>
        <ServiceHero
          breadcrumb={banner?.breadcrumb ?? 'Revenda de Hospedagem'}
          tag={banner?.tag ?? 'Revenda WHM/cPanel'}
          title={banner?.title ?? 'Crie a sua própria empresa de hospedagem com a ViralizaHost'}
          subtitle={banner?.subtitle ?? 'Venda hospedagem para os seus clientes usando a nossa infraestrutura premium. WHM, cPanel, DNS privado e marca própria.'}
          price={fromPrice ?? undefined}
          cta={banner?.button_primary_text ?? 'Ver Planos de Revenda'}
          ctaHref={banner?.button_primary_link ?? '#planos'}
          ctaSecondary={banner?.button_secondary_text ?? 'Falar com Comercial'}
          ctaSecondaryHref={banner?.button_secondary_link ?? '/tickets'}
          bgImage={banner?.bg_image ?? 'https://images.unsplash.com/photo-1591808216268-1e7c1b31b9d2?w=1920&q=80&auto=format&fit=crop'}
          bgColor={banner?.bg_color ?? '#0a0a14'}
          highlights={banner?.highlights?.length ? banner.highlights : ["WHM/cPanel Incluído","DNS Whitelabel","SSL por Conta","Suporte Revendedor"]}
          guarantee={banner?.show_guarantee ?? true}
        />
        <ResellerOffer plans={plans} mode={mode} prefill={prefill} notice={settings?.requestNotice ?? null} />
        <ResellerComparison plans={compare} />
        <ResellerHowItWorks />
        <ResellerWhmInfo />
        <IncludedFeatures features={included}
          title="Tudo o que precisa para revender hospedagem" />
        <ResellerFaq />
        <FinalCTA
          title="Inicie o seu negócio de hospedagem hoje"
          subtitle="Infraestrutura premium, marca própria e suporte dedicado ao revendedor."
          cta={mode === 'closed' ? 'Ver planos' : mode === 'automatic' ? 'Começar a Revender' : 'Solicitar contratação'}
          ctaHref={mode === 'closed' || mode === 'automatic' ? '#planos' : '#pedido'} />
      </main>
      <Footer />
    </>
  )
}
