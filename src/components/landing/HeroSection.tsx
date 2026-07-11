'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, ArrowRight, Shield, Zap, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ─────────────────────────────────────────────────── */
type Slide = {
  id: number
  bgImage: string
  bgColor: string
  desktopPosition?: string
  tabletPosition?: string
  mobilePosition?: string
  bgSize?: string
  overlayColor?: string
  overlayGradient?: string
  mobileOverlayGradient?: string
  glowGradient?: string
  accentColor: string
  /** true = full-width image/video banner (no text overlay) */
  imageOnly?: boolean
  /** true = render as looping video (only meaningful when imageOnly is true) */
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

/* ─── Hardcoded fallback slides (used only when DB returns 0 active rows) ── */
const FALLBACK_SLIDES: Slide[] = [
  {
    id: 0,
    imageOnly: true,
    isVideo: true,        // ← explicit flag, not index-based
    bgImage: '',
    bgColor: '#000000',
    accentColor: '#F5B700',
  },
  {
    id: 1,
    imageOnly: true,
    isVideo: false,
    bgImage: '/viraliza-email-banner.png',
    bgColor: '#000000',
    bgSize: 'contain',
    desktopPosition: 'center center',
    tabletPosition: 'center center',
    mobilePosition: 'center center',
    accentColor: '#34D399',
  },
  {
    id: 2,
    imageOnly: true,
    isVideo: false,
    bgImage: '/servidores_banner.png',
    bgColor: '#000000',
    bgSize: 'contain',
    desktopPosition: 'center center',
    tabletPosition: 'center center',
    mobilePosition: 'center center',
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
    tag: b.tag ?? undefined,
    title: b.title ?? undefined,
    subtitle: b.subtitle ?? undefined,
    cta: b.cta_text ?? undefined,
    ctaHref: b.cta_href ?? undefined,
    ctaSecondary: b.cta_secondary_text ?? undefined,
    ctaSecondaryHref: b.cta_secondary_href ?? undefined,
    features: b.features ?? undefined,
    imageOnly: true,
    isVideo: false,   // DB banners are NEVER video — always background images
    bgSize: 'cover',  // uploaded images fill the whole space
    desktopPosition: 'center center',
    tabletPosition: 'center center',
    mobilePosition: 'center center',
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

function getBgPosition(s: Slide, bp: 'mobile' | 'tablet' | 'desktop') {
  if (bp === 'mobile') return s.mobilePosition ?? s.desktopPosition ?? 'center center'
  if (bp === 'tablet') return s.tabletPosition ?? s.desktopPosition ?? 'center center'
  return s.desktopPosition ?? 'center center'
}

/* ─── Component ──────────────────────────────────────────────── */
export function HeroSection() {
  const [activeSlides, setActiveSlides] = useState<Slide[]>(FALLBACK_SLIDES)
  const [current, setCurrent] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scrollY, setScrollY] = useState(0)
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
          return // keep FALLBACK_SLIDES
        }
        if (data && data.length > 0) {
          setActiveSlides(data.map(dbToSlide))
        }
        // if data is empty keep the fallback
      })
  }, [])

  /* scroll parallax */
  useEffect(() => {
    const onScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect()
        if (rect.bottom > 0) setScrollY(window.scrollY * 0.35)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setProgress(0)
    setTimeout(() => { setCurrent(index); setIsTransitioning(false) }, 500)
  }, [isTransitioning])

  const next = useCallback(() => goTo((current + 1) % activeSlides.length), [current, goTo, activeSlides.length])
  const prev = useCallback(() => goTo((current - 1 + activeSlides.length) % activeSlides.length), [current, goTo, activeSlides.length])

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
    <section
      ref={sectionRef}
      className="relative flex flex-col overflow-hidden"
      style={{
        background: '#000',
        minHeight: bp === 'mobile' ? 'clamp(260px, 58vw, 420px)' : bp === 'tablet' ? '680px' : 'calc(100vh - 80px)',
      }}
      aria-label="Hero Slideshow"
    >
      {/* ── Background slide layers ─────────────────────────── */}
      {activeSlides.map((s, i) => {
        const pos = getBgPosition(s, bp)
        const active = i === current

        return (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: active ? 1 : 0 }}
            aria-hidden={!active}
          >
            {/* Base colour fill */}
            <div className="absolute inset-0" style={{ background: s.bgColor }} />

            {s.imageOnly ? (
              s.isVideo ? (
                /* ── Video slide ── */
                <>
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/video_poster.jpg"
                    className="absolute inset-0 w-full h-full object-cover"
                    aria-hidden="true"
                    preload="metadata"
                  >
                    <source src="/video_IA.mp4" type="video/mp4" />
                  </video>
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.65) 100%)' }} />
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(245,183,0,0.08), transparent)' }} />
                </>
              ) : (
                /* ── Image slide (DB banner or static fallback) ──
                   On mobile: object-fit contain so the full artwork is visible.
                   On tablet/desktop: object-fit cover fills the section nicely. */
                s.bgImage ? (
                  <img
                    src={s.bgImage}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full select-none"
                    style={{
                      objectFit: bp === 'mobile' ? 'contain' : 'cover',
                      objectPosition: pos,
                    }}
                  />
                ) : (
                  /* bgImage empty — show accent colour fill */
                  <div className="absolute inset-0" style={{ background: s.bgColor }} />
                )
              )
            ) : (
              /* Parallax content slide (non-imageOnly) */
              <div
                className="absolute"
                style={{
                  inset: '-8%',
                  backgroundImage: s.bgImage ? `url(${s.bgImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: pos,
                  backgroundRepeat: 'no-repeat',
                  transform: `translateY(${active ? scrollY * 0.4 : 0}px) scale(${isTransitioning && active ? 1.01 : 1.04})`,
                  transition: isTransitioning ? 'transform 0.7s ease' : 'transform 0.12s linear',
                }}
              />
            )}

            {/* Overlay gradients */}
            {s.overlayColor && s.overlayColor !== 'transparent' && (
              <div className="absolute inset-0" style={{ background: s.overlayColor }} />
            )}
            {s.overlayGradient && (
              <div className="absolute inset-0" style={{
                background: bp === 'mobile' && s.mobileOverlayGradient
                  ? s.mobileOverlayGradient
                  : s.overlayGradient,
              }} />
            )}
            {s.glowGradient && (
              <div className="absolute inset-0" style={{ background: s.glowGradient }} />
            )}

            {/* Vignette for non-imageOnly slides */}
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

      {/* Grid dot overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* ── Slide content (only for non-imageOnly slides) ─────── */}
      <div className={`relative z-10 flex-1 flex flex-col justify-center ${bp === 'mobile' ? 'pt-20 pb-8' : 'pt-28 pb-16'}`}>
        {!slide.imageOnly && (
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
                    {i === 0
                      ? line
                      : (<><br /><span style={{ color: slide.accentColor }}>{line}</span></>)}
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
                    {['A', 'B', 'C', 'D', 'E'].map((l, i) => (
                      <div key={i}
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
        )}
      </div>

      {/* ── Slide controls ───────────────────────────────────── */}
      <div className="relative z-10 pb-10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between max-w-4xl">

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

            <div className="flex items-center gap-2">
              <button onClick={prev}
                className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/18 hover:border-white/28 transition-all focus:outline-none backdrop-blur-sm"
                aria-label="Slide anterior">
                <ChevronLeft size={18} />
              </button>
              <button onClick={next}
                className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/18 hover:border-white/28 transition-all focus:outline-none backdrop-blur-sm"
                aria-label="Próximo slide">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
