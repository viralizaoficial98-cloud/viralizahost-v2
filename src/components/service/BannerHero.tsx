import { ServiceHero } from './ServiceHero'
import { getBannerPage } from '@/lib/banner-pages'

// Hero das páginas de serviço com o conteúdo de Painel → Site → Banners de páginas (tabela banner_pages, por slug).
// O mesmo componente e layout («split»: imagem à direita em desktop, por trás do texto em telemóvel) para todas as
// páginas; cada página tem a sua configuração (slug) e textos por omissão próprios, usados só sem configuração activa.

export interface BannerHeroDefaults {
  breadcrumb: string; tag: string; title: string; subtitle: string
  cta: string; ctaHref: string; ctaSecondary?: string; ctaSecondaryHref?: string
  bgImage?: string; bgColor?: string; highlights?: string[]; guarantee?: boolean
}

export async function BannerHero({ slug, defaults, price, testId }: { slug: string; defaults: BannerHeroDefaults; price?: string | null; testId?: string }) {
  const banner = await getBannerPage(slug)
  return (
    <div data-section="hero" data-testid={testId} data-banner-slug={slug} data-banner-source={banner ? 'admin' : 'default'}>
      <ServiceHero
        breadcrumb={banner?.breadcrumb ?? defaults.breadcrumb}
        tag={banner?.tag ?? defaults.tag}
        title={banner?.title ?? defaults.title}
        subtitle={banner?.subtitle ?? defaults.subtitle}
        price={price ?? undefined}
        cta={banner?.button_primary_text ?? defaults.cta}
        ctaHref={banner?.button_primary_link ?? defaults.ctaHref}
        ctaSecondary={banner?.button_secondary_text ?? defaults.ctaSecondary}
        ctaSecondaryHref={banner?.button_secondary_link ?? defaults.ctaSecondaryHref}
        bgImage={banner?.bg_image ?? defaults.bgImage}
        bgColor={banner?.bg_color ?? defaults.bgColor ?? '#080d1a'}
        highlights={banner?.highlights?.length ? banner.highlights : defaults.highlights ?? []}
        guarantee={banner?.show_guarantee ?? defaults.guarantee ?? true}
        layout="split"
      />
    </div>
  )
}
