'use client'
import Link from 'next/link'
import { ChevronRight, Check, Shield } from 'lucide-react'

interface ServiceHeroProps {
  breadcrumb?: string
  breadcrumbParent?: string
  breadcrumbParentHref?: string
  tag?: string
  title: string
  subtitle: string
  price?: string
  cta?: string
  ctaHref?: string
  ctaSecondary?: string
  ctaSecondaryHref?: string
  bgImage?: string
  bgColor?: string
  highlights?: string[]
  guarantee?: boolean
  badge?: { text: string; color?: string }
}

export function ServiceHero({
  breadcrumb,
  breadcrumbParent,
  breadcrumbParentHref,
  tag,
  title,
  subtitle,
  price,
  cta = 'Ver Planos',
  ctaHref = '#planos',
  ctaSecondary,
  ctaSecondaryHref,
  bgImage,
  bgColor = '#080d1a',
  highlights = [],
  guarantee = true,
  badge,
}: ServiceHeroProps) {
  return (
    <section className="relative min-h-[520px] flex flex-col justify-center overflow-hidden pt-[68px]"
      style={{ backgroundColor: bgColor }}>
      {bgImage && (
        <>
          <div className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/30" />
        </>
      )}
      {!bgImage && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_50%,rgba(245,183,0,0.08),transparent)]" />
      )}
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative container mx-auto px-4 py-16 md:py-20">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-500 mb-6 flex-wrap">
          <Link href="/" className="hover:text-[#F5B700] transition-colors">Início</Link>
          {breadcrumbParent && breadcrumbParentHref && (
            <>
              <ChevronRight size={11} />
              <Link href={breadcrumbParentHref} className="hover:text-[#F5B700] transition-colors">{breadcrumbParent}</Link>
            </>
          )}
          {breadcrumb && (
            <>
              <ChevronRight size={11} />
              <span className="text-gray-400">{breadcrumb}</span>
            </>
          )}
        </nav>

        <div className="max-w-2xl">
          {tag && (
            <span className="inline-block bg-[#F5B700]/10 border border-[#F5B700]/25 text-[#F5B700] text-[11px] font-bold px-3 py-1 rounded-full mb-5 uppercase tracking-widest">
              {tag}
            </span>
          )}

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-5">
            {title}
          </h1>

          <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-7">
            {subtitle}
          </p>

          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 mb-8">
              {highlights.map(h => (
                <span key={h} className="flex items-center gap-1.5 text-sm text-gray-300">
                  <Check size={13} className="text-[#F5B700] shrink-0" /> {h}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <Link href={ctaHref}
              className="btn-shimmer btn-primary px-7 py-3.5 text-sm font-bold rounded-xl shadow-[0_4px_20px_rgba(245,183,0,0.30)]">
              {cta}
            </Link>
            {ctaSecondary && ctaSecondaryHref && (
              <Link href={ctaSecondaryHref}
                className="px-6 py-3.5 text-sm font-semibold text-white border border-white/20 rounded-xl hover:border-[#F5B700]/40 hover:text-[#F5B700] transition-all">
                {ctaSecondary}
              </Link>
            )}
          </div>

          {price && (
            <p className="mt-4 text-gray-400 text-sm">
              {price}
            </p>
          )}

          {guarantee && (
            <div className="mt-4 flex items-center gap-2 text-gray-500 text-xs">
              <Shield size={12} className="text-green-400 shrink-0" />
              <span>Garantia de reembolso de 30 dias · Sem contratos · Cancele quando quiser</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
