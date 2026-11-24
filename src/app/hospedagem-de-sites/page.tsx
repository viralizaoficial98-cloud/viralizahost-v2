import type { Metadata } from 'next'
import Link from 'next/link'
import { Server, HardDrive, Mail, Globe, Headphones } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { IncludedFeatures } from '@/components/service/IncludedFeatures'
import { FinalCTA } from '@/components/service/FinalCTA'
import { HostingPlansSection } from '@/components/service/HostingPlansSection'
import { BuildSiteSection, SecuritySection, type SslCoverage } from '@/components/service/HostingSiteSections'
import { getPool } from '@/lib/db/pool'
import { BannerHero } from '@/components/service/BannerHero'
import { fromPriceText } from '@/lib/commerce/from-price'

// /hospedagem-de-sites — ordem fixa (ver docs/hospedagem-de-sites.md):
//   0. Hero (ServiceHero + «Banners de páginas» do painel, slug hospedagem-de-sites; único H1)
//   1. Hospedagem de sites — Escolha o seu plano (#planos; só planos de hospedagem de sites)
//   2. Todos os planos incluem
//   3. Crie e publique o seu site (#crie-o-seu-site; «Use WordPress» em #wordpress)
//   4. Segurança para o seu site (#seguranca)
//   5. Comece hoje (botão → #planos)
// Preços, ciclos, descontos e «Comprar agora» vêm do catálogo (HostingPlansSection). Os planos WordPress não são
// mostrados aqui, mas continuam no catálogo e à venda (/construtor-wordpress, /comprar/wp-…).

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
  const [ssl, fromPrice] = await Promise.all([sslCoverage(), fromPriceText('hosting')])
  return (
    <>
      <Header />
      <main>
        {/* 0. Hero (configuração em Painel → Site → Banners de páginas, slug hospedagem-de-sites) */}
        <BannerHero slug="hospedagem-de-sites" testId="hosting-hero" price={fromPrice} defaults={{
          breadcrumb: 'Hospedagem de Sites', tag: 'Hospedagem Premium', title: 'Hospedagem de Sites Premium para o seu Negócio',
          subtitle: 'Performance ultrarrápida com LiteSpeed, NVMe SSD, SSL grátis, cPanel e suporte técnico especializado 24/7.',
          cta: 'Ver Planos', ctaHref: '#planos', ctaSecondary: 'Falar com Especialista', ctaSecondaryHref: '/tickets',
          bgImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80&auto=format&fit=crop', bgColor: '#080d1a',
          highlights: ['LiteSpeed Enterprise', 'NVMe SSD Gen4', 'Uptime 99.9%', 'cPanel Incluído'], guarantee: true,
        }} />
        {/* 1. Escolha o seu plano (só hospedagem de sites, a partir do catálogo) */}
        <div data-section="plans">
          <HostingPlansSection
            title="Hospedagem de sites — Escolha o seu plano"
            subtitle="Escolha o plano e o período; depois o domínio e os extras." />
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
