import type { Metadata } from 'next'
import Link from 'next/link'
import { Server, HardDrive, Mail, Globe, Headphones } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { DynamicServicePricing } from '@/components/service/DynamicServicePricing'
import { HostingPlansSection } from '@/components/service/HostingPlansSection'
import { BuildSiteSection, SecuritySection, type SslCoverage } from '@/components/service/HostingSiteSections'
import { getPool } from '@/lib/db/pool'

// /hospedagem-de-sites — ordem fixa (ver docs/hospedagem-de-sites.md):
//   1. Hospedagem de sites — Escolha o seu plano (#planos; inclui os planos WordPress em #planos-wordpress)
//   2. Todos os planos incluem
//   3. Crie e publique o seu site (#crie-o-seu-site; «Use WordPress» em #wordpress)
//   4. Segurança para o seu site (#seguranca)
//   5. Comece hoje (botão → #planos)
// Preços, ciclos, descontos e «Comprar agora» vêm do catálogo (HostingPlansSection / DynamicServicePricing).

export const metadata: Metadata = {
  title: 'Hospedagem de Sites',
  description: 'Hospedagem de sites com cPanel, armazenamento NVMe, e-mail no seu domínio, migração gratuita e suporte 24/7. WordPress, editor visual ou site feito pela nossa equipa.',
}

export const dynamic = 'force-dynamic'

// Só benefícios comuns a TODOS os planos de hospedagem do catálogo (confirmado em product_features dos planos
// activos). SSL e cópias de segurança são tratados na secção «Segurança para o seu site», para não repetir.
const included = [
  { icon: Server, title: 'cPanel incluído', desc: 'Painel de controlo para gerir ficheiros, bases de dados, e-mail e domínios.' },
  { icon: HardDrive, title: 'Armazenamento NVMe SSD', desc: 'Disco NVMe em todos os planos; a capacidade depende do plano escolhido.' },
  { icon: Mail, title: 'E-mail no seu domínio', desc: 'Caixas de correio do tipo nome@asuaempresa.ao; a quantidade depende do plano.' },
  { icon: Globe, title: 'Migração gratuita', desc: 'Já tem um site noutro alojamento? A nossa equipa ajuda a trazê-lo sem custo.' },
  { icon: Headphones, title: 'Suporte 24/7', desc: 'Equipa técnica disponível a qualquer hora para o ajudar.' },
]

/** Planos de hospedagem à venda que incluem «SSL» nas características do catálogo. */
async function sslCoverage(): Promise<SslCoverage> {
  try {
    const [rows] = await getPool().query(`SELECT p.name,
        EXISTS (SELECT 1 FROM product_features f WHERE f.product_id = p.id AND f.included = 1 AND f.feature LIKE '%SSL%') has_ssl
      FROM products p WHERE p.category = 'hosting' AND p.active = 1 AND p.sale_status = 'active'
        AND EXISTS (SELECT 1 FROM product_prices x WHERE x.product_id = p.id AND x.active = 1)
      ORDER BY p.position, p.name`) as unknown as [{ name: string; has_ssl: number }[]]
    const withSsl = rows.filter(r => Number(r.has_ssl) === 1).map(r => r.name)
    return { all: rows.length > 0 && withSsl.length === rows.length, plans: withSsl }
  } catch (e) { console.error('[hospedagem-de-sites] SSL do catálogo:', (e as Error).message); return { all: false, plans: [] } }
}

export default async function HospedagemDeSitesPage() {
  const ssl = await sslCoverage()
  return (
    <>
      <Header />
      <main>
        {/* 1. Escolha o seu plano (hospedagem + WordPress, a partir do catálogo) */}
        <div data-section="plans">
          <HostingPlansSection headingAs="h1" className="pt-32 md:pt-36 pb-16"
            title="Hospedagem de sites — Escolha o seu plano"
            subtitle={<>Escolha o plano e o período; depois o domínio e os extras. Vai usar WordPress? <Link href="#planos-wordpress" className="font-bold text-[#0A0A0A] underline decoration-[#F5B700] decoration-2 underline-offset-4" data-testid="link-wordpress">Veja os planos WordPress</Link>.</>} />
          <DynamicServicePricing id="planos-wordpress" category="wordpress" cols={3} showBillingToggle
            title="Planos WordPress"
            subtitle="Hospedagem para sites WordPress. Escolha o plano, depois o domínio e a duração." />
        </div>
        {/* 2. Todos os planos incluem */}
        <div data-section="included" id="incluido" className="scroll-mt-24">
          <IncludedFeatures features={included} hoverBorder subtitle="Benefícios comuns a todos os planos de hospedagem." />
        </div>
        {/* 3. Crie e publique o seu site */}
        <BuildSiteSection />
        {/* 4. Segurança para o seu site */}
        <SecuritySection ssl={ssl} />
        {/* 5. Comece hoje */}
        <div data-section="cta">
          <FinalCTA title="Comece hoje"
            subtitle="Escolha o plano, registe ou ligue o seu domínio e publique o seu site."
            cta="Ver os planos" ctaHref="#planos"
            ctaSecondary="Falar com a equipa" ctaSecondaryHref="/suporte/contactar" />
        </div>
      </main>
      <Footer />
    </>
  )
}
