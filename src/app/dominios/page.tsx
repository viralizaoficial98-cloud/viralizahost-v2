import type { Metadata } from 'next'
import Link from 'next/link'
import { kz as kzFmt } from '@/lib/commerce/status'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BannerHero } from '@/components/service/BannerHero'
import { DomainSearchBar } from '@/components/landing/DomainSearchBar'
import { listExtensions } from '@/lib/commerce/domain-catalog'
import { PageLinksSection } from '@/components/site/PageLinksSection'
import { pagesInSection } from '@/lib/site/pages'

// Página principal de Domínios (link directo no menu), por esta ordem:
//   1. Hero (BannerHero, configuração própria em Painel → Site → Banners de páginas, slug «dominios»; único H1)
//   2. Registo de domínios (DomainSearchBar variant «page»: pesquisa + extensões em destaque do catálogo de domínios)
//   3. Todas as extensões e preços; 4–6. opções do antigo submenu (registo/transferência/renovação; gestão; recursos).
const cards = (section: string, cta: string) => pagesInSection(section).map(p => ({ href: p.path, title: p.title, desc: p.desc, icon: p.icon, cta }))

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Domínios — Pesquisa e preços',
  description: 'Pesquise, registe e transfira domínios .ao, .co.ao, .com e outros, com preços em kwanzas.',
}
const kz = (n: number | null) => (n == null ? '—' : kzFmt(Math.round(n)))

export default async function DominiosPage() {
  let exts: Awaited<ReturnType<typeof listExtensions>> | null = null
  try { exts = await listExtensions() } catch { exts = null }
  // «A partir de» do registo (1.º ano), calculado do catálogo de domínios
  const cheapest = exts?.filter(e => e.status === 'active' && e.register != null).reduce<number | null>((m, e) => (m == null || e.register! < m ? e.register! : m), null) ?? null
  const fromPrice = cheapest != null ? `A partir de ${kz(cheapest)}/1.º ano` : null
  return (
    <>
      <Header />
      <main>
        <BannerHero slug="dominios" testId="domains-hero" price={fromPrice} defaults={{
          breadcrumb: 'Domínios', tag: 'Domínios', title: 'Registe a sua identidade online com o domínio certo',
          subtitle: 'Pesquise a disponibilidade, compare extensões nacionais e internacionais e registe o seu domínio com preços em kwanzas.',
          cta: 'Pesquisar domínio', ctaHref: '#registo-de-dominios', ctaSecondary: 'Transferir domínio', ctaSecondaryHref: '/dominios/transferir',
          bgImage: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1920&q=80&auto=format&fit=crop', bgColor: '#080d1a',
          highlights: ['Preços em kwanzas', 'Extensões .ao e internacionais', 'Transferência com código EPP'], guarantee: false,
        }} />
        <DomainSearchBar variant="page" />
        <section className="bg-white py-14 px-4" aria-labelledby="ext-title" data-section="extensions" id="extensoes">
          <div className="max-w-5xl mx-auto">
            <h2 id="ext-title" className="text-2xl font-black text-[#0A0A0A] mb-6">Todas as extensões e preços (1 ano)</h2>
            {!exts ? (
              <p className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700" role="alert">Não foi possível carregar os preços. Recarregue a página dentro de instantes.</p>
            ) : !exts.length ? (
              <p className="p-4 rounded-xl bg-[#F8F8F8] text-sm">Ainda não há extensões publicadas.</p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {exts.map(e => (
                  <li key={e.extension}>
                    <Link href={e.status === 'active' ? `/dominios/pesquisar?ext=${encodeURIComponent(e.extension)}` : '/suporte/contactar'} className="block rounded-xl border border-[#E8E8E8] p-4 hover:border-[#F5B700] transition-colors">
                      <p className="font-black text-lg text-[#0A0A0A]">{e.extension}</p>
                      {e.status === 'active' ? <><p className="text-sm font-bold">{kz(e.register)}</p><p className="text-[11px] text-[#888]">renova {kz(e.renew)}</p></> : <p className="text-sm text-[#888]">Sob consulta</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-sm"><Link href="/dominios/precos" className="font-bold underline">Tabela completa com transferências</Link></p>
          </div>
        </section>
        <PageLinksSection id="registo" tag="Registo" title="Registar, transferir e renovar" subtitle="Cada opção abre o fluxo correspondente: pesquisa e registo, transferência com o código EPP ou renovação dos seus domínios." items={cards('dominios-registo', 'Abrir')} />
        <PageLinksSection id="gestao" tag="Gestão e segurança" title="Gestão e segurança do domínio" subtitle="DNS, protecção de dados, certificados, redirecionamentos e nameservers." items={cards('dominios-gestao', 'Saber mais')} dark />
        <PageLinksSection id="recursos" tag="Recursos" title="Preços, guias e suporte" items={[...cards('dominios-recursos', 'Abrir'), { href: '/suporte/faq', title: 'Perguntas frequentes', desc: 'Respostas às dúvidas mais comuns', icon: 'help' as const, cta: 'Abrir' }]} />
      </main>
      <Footer />
    </>
  )
}
