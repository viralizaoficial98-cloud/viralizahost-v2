'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, ArrowRight, Shield, Zap, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ─── Constants ──────────────────────────────────────────────── */
const HEADER_H = 68 // px — fixed site header height

/* ─── Types ─────────────────────────────────────────────────── */
type Slide = {
  id: number
  bgImage: string
  bgColor: string
  /** object-position value for desktop (default "center center") */
  objectPosition?: string
  /** object-position value for mobile (default = objectPosition) */
  objectPositionMobile?: string
  /** CSS scale applied to the image, e.g. "1.05" (default "1") */
  imageScale?: string
  accentColor: string
  /** true = full-width image/video artwork — no text overlay rendered */
  imageOnly?: boolean
  /** true = render as looping video (only when imageOnly is true) */
  isVideo?: boolean
  tag?: string
  title?: string
  subtitle?: string
  cta?: string
  ctaHref?: string
  ctaSecondary?: string
  ctaSecondaryHref?: string
  icon?: React.ElementType
  features?: string[]
}

/* ─── Fallback slides ────────────────────────────────────────── */
/*
 * Used only when Supabase returns 0 active banners.
 * objectPosition is tuned for each banner's composition:
 *   viraliza-email-banner.png  1536×1024  (3:2)  — main content left + centre-right
 *   servidores_banner.png      1672×941   (16:9) — wide layout, centre works
 * The AI video uses cover/object-fit automatically.
 */
const FALLBACK_SLIDES: Slide[] = [
  {
    id: 0,
    imageOnly: true,
    isVideo: true,
    bgImage: '',
    bgColor: '#000000',
    objectPosition: '60% center',
    accentColor: '#F5B700',
  },
  {
    id: 1,
    imageOnly: true,
    isVideo: false,
    bgImage: '/viraliza-email-banner.png',
    bgColor: '#000000',
    objectPosition: 'center center',
    objectPositionMobile: 'center center',
    accentColor: '#34D399',
  },
  {
    id: 2,
    imageOnly: true,
    isVideo: false,
    bgImage: '/servidores_banner.png',
    bgColor: '#000000',
    objectPosition: 'center center',
    objectPositionMobile: 'center center',
    accentColor: '#F5B700',
  },
]

/* ─── DB Banner type ─────────────────────────────────────────── */
type DbBanner = {
  id: string
  position: number
  active: boolean
  bg_image: string | null
  bg_color: string | null
  accent_color: string | null
  tag: string | null
  title: string | null
  subtitle: string | null
  cta_text: string | null
  cta_href: string | null
  cta_secondary_text: string | null
  cta_secondary_href: string | null
  features: string[] | null
}

function dbToSlide(b: DbBanner, i: number): Slide {
  return {
    id: i,
    bgImage: b.bg_image ?? '',
    bgColor: b.bg_color ?? '#000000',
    accentColor: b.accent_color ?? '#F5B700',
    objectPosition: 'center center',
    objectPositionMobile: 'center center',
    tag: b.tag ?? undefined,
    title: b.title ?? undefined,
    subtitle: b.subtitle ?? undefined,
    cta: b.cta_text ?? undefined,
    ctaHref: b.cta_href ?? undefined,
    ctaSecondary: b.cta_secondary_text ?? undefined,
    ctaSecondaryHref: b.cta_secondary_href ?? undefined,
    features: b.features ?? undefined,
    imageOnly: true,
    isVideo: false,
  }
}

const SLIDE_DURATION = 7000

/* ─── Breakpoint hook ────────────────────────────────────────── */
function useBreakpoint() {
  const [bp, setBp] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setBp(w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop')
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return bp
}

/**
 * Total section height (top of page → bottom).
 * The fixed header overlaps the first HEADER_H px.
 * Visible image area = height − HEADER_H.
 *
 * Spec-requested heights (visible area):
 *   desktop  clamp(560px, 72vh, 820px)
 *   tablet   520px
 *   mobile   420px
 */
function sectionHeight(bp: 'mobile' | 'tablet' | 'desktop'): string {
  if (bp === 'mobile')  return `${420 + HEADER_H}px`    // 488px total
  if (bp === 'tablet')  return `${520 + HEADER_H}px`    // 588px total
  // desktop: clamp with header offset
  return `clamp(${560 + HEADER_H}px, calc(72vh + ${HEADER_H}px), ${820 + HEADER_H}px)`
}

/* ─── Component ──────────────────────────────────────────────── */
export function HeroSection() {
  const [activeSlides, setActiveSlides] = useState<Slide[]>(FALLBACK_SLIDES)
  const [current, setCurrent] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const bp = useBreakpoint()

  /* Fetch active banners from DB — single source of truth */
  useEffect(() => {
    const supabase = createClient()
    ;(supabase as any)
      .from('site_banners')
      .select('*')
      .eq('active', true)
      .order('position')
      .then(({ data, error }: { data: DbBanner[] | null; error: unknown }) => {
        if (error) {
          console.warn('[HeroSection] failed to load banners from DB, using fallback:', error)
          return
        }
        if (data && data.length > 0) setActiveSlides(data.map(dbToSlide))
      })
  }, [])

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setProgress(0)
    setTimeout(() => { setCurrent(index); setIsTransitioning(false) }, 500)
  }, [isTransitioning])

  const next = useCallback(
    () => goTo((current + 1) % activeSlides.length),
    [current, goTo, activeSlides.length],
  )
  const prev = useCallback(
    () => goTo((current - 1 + activeSlides.length) % activeSlides.length),
    [current, goTo, activeSlides.length],
  )

  useEffect(() => {
    const interval = setInterval(next, SLIDE_DURATION)
    return () => clearInterval(interval)
  }, [next])

  useEffect(() => {
    setProgress(0)
    const start = Date.now()
    let raf: number
    const tick = () => {
      const elapsed = Date.now() - start
      setProgress(Math.min((elapsed / SLIDE_DURATION) * 100, 100))
      if (elapsed < SLIDE_DURATION) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [current])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prev, next])

  const slide = activeSlides[current] ?? activeSlides[0]
  const Icon = slide?.icon

  return (
    /*
     * The section is a direct child of <main> — no container wrapper limits its width.
     * overflow-hidden clips the cover-positioned images to the section bounds.
     */
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden"
      style={{ background: '#000', minHeight: sectionHeight(bp) }}
      aria-label="Hero Slideshow"
    >
      {/* ── Slide layers (absolutely stacked) ──────────────────── */}
      {activeSlides.map((s, i) => {
        const active = i === current
        const objPos = bp === 'mobile'
          ? (s.objectPositionMobile ?? s.objectPosition ?? 'center center')
          : (s.objectPosition ?? 'center center')
        const scale = s.imageScale ?? '1'

        return (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: active ? 1 : 0 }}
            aria-hidden={!active}
          >
            {/* Solid colour base — shows as letterbox only if image fails to load */}
            <div className="absolute inset-0" style={{ background: s.bgColor }} />

            {s.imageOnly ? (
              s.isVideo ? (
                /* ── Video slide ──────────────────────────────── */
                <>
                  <video
                    autoPlay muted loop playsInline
                    poster="/video_poster.jpg"
                    preload="metadata"
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-0 w-full"
                    style={{
                      top: HEADER_H,
                      height: `calc(100% - ${HEADER_H}px)`,
                      objectFit: 'cover',
                      objectPosition: objPos,
                    }}
                  >
                    <source src="/video_IA.mp4" type="video/mp4" />
                  </video>
                  <div
                    className="absolute left-0 right-0 bottom-0"
                    style={{
                      top: HEADER_H,
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.60) 100%)',
                    }}
                  />
                </>
              ) : s.bgImage ? (
                /*
                 * ── Artwork image slide ────────────────────────
                 *
                 * Two-layer technique — fills full width WITHOUT cropping artwork:
                 *
                 * Layer 1 (blur fill): the same image, scaled to cover the entire
                 *   visible area with blur+dim. Eliminates any black letterbox bars
                 *   for banners that don't match the section's aspect ratio.
                 *
                 * Layer 2 (sharp main): the real image with object-fit contain,
                 *   centred on top of the blur. Full artwork always visible.
                 *
                 * For images that already match the section ratio (≈16:9), both
                 * layers align perfectly and the blur is imperceptible.
                 */
                <>
                  {/* Layer 1 — blurred background fill */}
                  <div
                    className="absolute left-0 right-0 bottom-0 overflow-hidden"
                    style={{ top: HEADER_H }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: '-5%',
                        backgroundImage: `url(${s.bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: objPos,
                        backgroundRepeat: 'no-repeat',
                        filter: 'blur(22px) brightness(0.55)',
                      }}
                    />
                  </div>

                  {/* Layer 2 — sharp main image (full artwork, no cropping) */}
                  <img
                    src={s.bgImage}
                    alt=""
                    draggable={false}
                    className="absolute left-0 right-0 bottom-0 w-full select-none pointer-events-none"
                    style={{
                      top: HEADER_H,
                      height: `calc(100% - ${HEADER_H}px)`,
                      objectFit: 'contain',
                      objectPosition: objPos,
                      transform: scale !== '1' ? `scale(${scale})` : undefined,
                      transformOrigin: 'center center',
                    }}
                  />
                </>
              ) : (
                <div className="absolute inset-0" style={{ background: s.bgColor }} />
              )
            ) : (
              /* ── Parallax background for text slides ──────── */
              s.bgImage && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${s.bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: objPos,
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              )
            )}

            {/* Vignette — only for text slides */}
            {!s.imageOnly && (
              <>
                <div className="absolute inset-0"
                  style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.45) 100%)' }} />
                <div className="absolute bottom-0 left-0 right-0 h-1/4"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.60), transparent)' }} />
              </>
            )}
          </div>
        )
      })}

      {/* Subtle grid dot pattern */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* ── Text content — only for non-imageOnly text slides ─── */}
      {!slide.imageOnly && (
        <div
          className="absolute left-0 right-0 bottom-16 z-10 flex items-center"
          style={{ top: HEADER_H + 16 }}
        >
          <div className="container mx-auto px-4 lg:px-8">
            <div className={bp === 'mobile' ? 'max-w-[85%]' : 'max-w-4xl'}>

              <div key={`tag-${current}`} className={`animate-fade-in-up ${bp === 'mobile' ? 'mb-4' : 'mb-7'}`}>
                <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 text-white/90 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full">
                  {Icon && <Icon size={12} style={{ color: slide.accentColor }} />}
                  {slide.tag}
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                </span>
              </div>

              <h1
                key={`title-${current}`}
                className={`font-black text-white leading-[1.05] animate-fade-in-up delay-100 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'} ${bp === 'mobile' ? 'text-3xl mb-3' : 'text-4xl sm:text-5xl lg:text-6xl xl:text-7xl mb-6'}`}
              >
                {slide.title!.split('\n').map((line, i) => (
                  <span key={i}>
                    {i === 0 ? line : (<><br /><span style={{ color: slide.accentColor }}>{line}</span></>)}
                  </span>
                ))}
              </h1>

              <p
                key={`sub-${current}`}
                className={`text-white/65 leading-relaxed animate-fade-in-up delay-200 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'} ${bp === 'mobile' ? 'text-sm mb-5 max-w-xs' : 'text-lg md:text-xl mb-10 max-w-2xl'}`}
              >
                {slide.subtitle}
              </p>

              <div key={`feat-${current}`} className={`flex flex-wrap gap-2 animate-fade-in-up delay-300 ${bp === 'mobile' ? 'mb-5' : 'mb-10'}`}>
                {slide.features!.map((f) => (
                  <span key={f} className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/12 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full">
                    <Zap size={10} style={{ color: slide.accentColor }} />
                    {f}
                  </span>
                ))}
              </div>

              <div key={`cta-${current}`} className="flex flex-col sm:flex-row gap-3 animate-fade-in-up delay-400">
                <Link
                  href={slide.ctaHref!}
                  className={`btn-shimmer btn-primary inline-flex items-center justify-center gap-2 rounded-2xl font-bold shadow-[0_8px_30px_rgba(245,183,0,0.40)] hover:shadow-[0_12px_40px_rgba(245,183,0,0.55)] hover:scale-105 transition-all ${bp === 'mobile' ? 'px-6 py-3 text-sm' : 'px-9 py-4 text-base'}`}
                >
                  {slide.cta}
                  <ArrowRight size={bp === 'mobile' ? 14 : 17} />
                </Link>
                <Link
                  href={slide.ctaSecondaryHref!}
                  className={`inline-flex items-center justify-center gap-2 border-2 border-white/22 hover:border-white/45 text-white/90 hover:text-white hover:bg-white/8 backdrop-blur-sm rounded-2xl font-bold transition-all ${bp === 'mobile' ? 'px-6 py-3 text-sm' : 'px-9 py-4 text-base'}`}
                >
                  {slide.ctaSecondary}
                </Link>
              </div>

              <div className={`flex items-center flex-wrap gap-4 animate-fade-in-up delay-500 ${bp === 'mobile' ? 'mt-6' : 'mt-12'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['A', 'B', 'C', 'D', 'E'].map((l, idx) => (
                      <div key={idx}
                        className="w-7 h-7 rounded-full border-2 border-black/30 flex items-center justify-center text-black text-xs font-black"
                        style={{ background: 'linear-gradient(135deg, #F5B700, #D9A300)' }}>
                        {l}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} size={11} className="text-[#F5B700] fill-[#F5B700]" />)}
                    </div>
                    <p className="text-white/55 text-xs"><strong className="text-white">+5.000</strong> clientes satisfeitos</p>
                  </div>
                </div>
                <div className="h-7 w-px bg-white/10 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-white/55 text-xs">
                    <Shield size={13} className="text-green-400" />
                    Uptime 99.9%
                  </div>
                  <div className="flex items-center gap-1.5 text-white/55 text-xs">
                    <Zap size={13} className="text-[#F5B700]" />
                    LiteSpeed Enterprise
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Carousel controls — bottom safe zone with gradient ─── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pb-4 pt-8"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.50) 0%, transparent 100%)' }}
      >
        <div className="px-4 lg:px-8">
          <div className="flex items-center justify-between">

            {/* Progress indicators */}
            <div className="flex items-center gap-3">
              {activeSlides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className="relative h-[3px] rounded-full overflow-hidden focus:outline-none transition-all duration-300"
                  style={{ width: i === current ? 52 : 20, background: 'rgba(255,255,255,0.2)' }}
                  aria-label={`Ir para slide ${i + 1}`}
                >
                  {i === current && (
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{ width: `${progress}%`, background: slide?.accentColor, transition: 'width 0.15s linear' }}
                    />
                  )}
                </button>
              ))}
              <span className="text-white/35 text-xs font-mono ml-1 tabular-nums">
                {String(current + 1).padStart(2, '0')} / {String(activeSlides.length).padStart(2, '0')}
              </span>
            </div>

            {/* Arrow buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/18 hover:border-white/28 transition-all focus:outline-none backdrop-blur-sm"
                aria-label="Slide anterior"
              >
                <ChevronLeft size={bp === 'mobile' ? 15 : 18} />
              </button>
              <button
                onClick={next}
                className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/18 hover:border-white/28 transition-all focus:outline-none backdrop-blur-sm"
                aria-label="Próximo slide"
              >
                <ChevronRight size={bp === 'mobile' ? 15 : 18} />
              </button>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
