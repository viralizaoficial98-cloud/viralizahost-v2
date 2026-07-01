'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Bot, Mail, ArrowRight, Shield, Zap, Star } from 'lucide-react'

type Slide = {
  id: number
  bgImage: string
  bgColor: string
  bgPosition?: string
  bgSize?: string
  overlayColor?: string
  overlayGradient?: string
  glowGradient?: string
  accentColor: string
  imageOnly?: boolean
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

const slides: Slide[] = [
  {
    id: 0,
    tag: 'Inteligência Artificial',
    title: 'Automatize Processos com\nInteligência Artificial',
    subtitle: 'Chatbots, automações inteligentes e agentes IA para transformar o seu negócio digitalmente.',
    cta: 'Explorar Soluções IA',
    ctaHref: '#servicos',
    ctaSecondary: 'Saiba Mais',
    ctaSecondaryHref: '#servicos',
    icon: Bot,
    bgImage: '/viraliza-ai-banner.png',
    bgPosition: 'right center',
    bgColor: '#000000',
    overlayColor: 'transparent',
    overlayGradient: 'linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.82) 32%, rgba(0,0,0,0.52) 58%, rgba(0,0,0,0.12) 100%)',
    glowGradient: 'radial-gradient(ellipse 55% 70% at 82% 50%, rgba(245,183,0,0.08), transparent)',
    accentColor: '#F5B700',
    features: ['Chatbots Inteligentes', 'Automação de Processos', 'Agentes IA'],
  },
  {
    id: 1,
    imageOnly: true,
    bgImage: '/servidores_banner.png',
    bgPosition: 'right center',
    bgSize: 'contain',
    bgColor: '#000000',
    overlayColor: 'rgba(0,0,0,0.08)',
    accentColor: '#F5B700',
  },
  {
    id: 2,
    tag: 'E-mail Corporativo',
    title: 'E-mails Corporativos Profissionais\npara Empresas',
    subtitle: 'Caixas corporativas com alta segurança, proteção anti-spam avançada e integração completa.',
    cta: 'Ver Planos de E-mail',
    ctaHref: '#email-plans',
    ctaSecondary: 'Começar Agora',
    ctaSecondaryHref: '/register',
    icon: Mail,
    bgImage: 'https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1920&q=85&auto=format&fit=crop',
    bgColor: '#040f0a',
    overlayColor: 'rgba(4, 15, 10, 0.72)',
    accentColor: '#34D399',
    features: ['Anti-Spam Premium', 'SPF/DKIM/DMARC', 'Backup Diário'],
  },
]

const SLIDE_DURATION = 7000

export function HeroSection() {
  const [current, setCurrent] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

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
    setTimeout(() => {
      setCurrent(index)
      setIsTransitioning(false)
    }, 500)
  }, [isTransitioning])

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo])
  const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, goTo])

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

  const slide = slides[current]
  const Icon = slide.icon

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col overflow-hidden"
      aria-label="Hero Slideshow"
    >
      {/* Background slides */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === current ? 1 : 0 }}
          aria-hidden={i !== current}
        >
          <div className="absolute inset-0" style={{ background: s.bgColor }} />

          {s.bgSize === 'contain' ? (
            /* contain: sem parallax/zoom, imagem mantém proporção */
            <div
              className="absolute inset-0 hero-bg-contain"
              style={{
                backgroundImage: `url(${s.bgImage})`,
                backgroundSize: 'contain',
                backgroundPosition: s.bgPosition ?? 'right center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          ) : (
            /* cover: parallax + zoom padrão */
            <div
              className="absolute inset-[-10%]"
              style={{
                backgroundImage: `url(${s.bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: s.bgPosition ?? 'center',
                backgroundRepeat: 'no-repeat',
                transform: `translateY(${i === current ? scrollY : 0}px) scale(${isTransitioning && i === current ? 1.02 : 1.05})`,
                transition: isTransitioning ? 'transform 0.7s ease, opacity 0.5s ease' : 'transform 0.1s linear',
              }}
            />
          )}

          {s.overlayColor && s.overlayColor !== 'transparent' && (
            <div className="absolute inset-0" style={{ background: s.overlayColor }} />
          )}

          {s.overlayGradient && (
            <div className="absolute inset-0" style={{ background: s.overlayGradient }} />
          )}

          {s.glowGradient && (
            <div className="absolute inset-0" style={{ background: s.glowGradient }} />
          )}

          {/* Vignette + bottom fade only for content slides */}
          {!s.imageOnly && (
            <>
              <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)' }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 h-1/3"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}
              />
            </>
          )}
        </div>
      ))}

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Content — hidden for imageOnly slides */}
      <div className="relative z-10 flex-1 flex flex-col justify-center pt-28 pb-16">
        {!slide.imageOnly && (
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl">

              <div key={`tag-${current}`} className="animate-fade-in-up mb-7">
                <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 text-white/90 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full">
                  {Icon && <Icon size={12} style={{ color: slide.accentColor }} />}
                  {slide.tag}
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                </span>
              </div>

              <h1
                key={`title-${current}`}
                className={`text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.05] mb-6 animate-fade-in-up delay-100 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
              >
                {slide.title!.split('\n').map((line, i) => (
                  <span key={i}>
                    {i === 0
                      ? line
                      : (<><br /><span style={{ color: slide.accentColor }}>{line}</span></>)
                    }
                  </span>
                ))}
              </h1>

              <p
                key={`sub-${current}`}
                className={`text-lg md:text-xl text-white/65 mb-10 max-w-2xl leading-relaxed animate-fade-in-up delay-200 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
              >
                {slide.subtitle}
              </p>

              <div key={`feat-${current}`} className="flex flex-wrap gap-2.5 mb-10 animate-fade-in-up delay-300">
                {slide.features!.map((f) => (
                  <span key={f}
                    className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-sm border border-white/12 text-white/80 text-xs font-medium px-4 py-2 rounded-full">
                    <Zap size={11} style={{ color: slide.accentColor }} />
                    {f}
                  </span>
                ))}
              </div>

              <div key={`cta-${current}`} className="flex flex-col sm:flex-row gap-4 animate-fade-in-up delay-400">
                <Link
                  href={slide.ctaHref!}
                  className="btn-shimmer btn-primary inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl text-base font-bold shadow-[0_8px_30px_rgba(245,183,0,0.40)] hover:shadow-[0_12px_40px_rgba(245,183,0,0.55)] hover:scale-105 transition-all"
                >
                  {slide.cta}
                  <ArrowRight size={17} />
                </Link>
                <Link
                  href={slide.ctaSecondaryHref!}
                  className="inline-flex items-center justify-center gap-2 border-2 border-white/22 hover:border-white/45 text-white/90 hover:text-white hover:bg-white/8 backdrop-blur-sm px-9 py-4 rounded-2xl text-base font-bold transition-all"
                >
                  {slide.ctaSecondary}
                </Link>
              </div>

              <div className="flex items-center flex-wrap gap-5 mt-12 animate-fade-in-up delay-500">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['A','B','C','D','E'].map((l, i) => (
                      <div key={i}
                        className="w-8 h-8 rounded-full border-2 border-black/30 flex items-center justify-center text-black text-xs font-black"
                        style={{ background: 'linear-gradient(135deg, #F5B700, #D9A300)' }}>
                        {l}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-0.5 mb-0.5">
                      {[...Array(5)].map((_, i) => <Star key={i} size={12} className="text-[#F5B700] fill-[#F5B700]" />)}
                    </div>
                    <p className="text-white/55 text-xs"><strong className="text-white">+5.000</strong> clientes satisfeitos</p>
                  </div>
                </div>

                <div className="h-8 w-px bg-white/10 hidden sm:block" />

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

      {/* Slide controls */}
      <div className="relative z-10 pb-10">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between max-w-4xl">

            <div className="flex items-center gap-3">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className="relative h-[3px] rounded-full overflow-hidden focus:outline-none transition-all duration-300"
                  style={{
                    width: i === current ? 52 : 20,
                    background: 'rgba(255,255,255,0.2)',
                  }}
                  aria-label={`Ir para slide ${i + 1}`}
                >
                  {i === current && (
                    <div
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                        background: slide.accentColor,
                        transition: 'width 0.15s linear',
                      }}
                    />
                  )}
                </button>
              ))}
              <span className="text-white/35 text-xs font-mono ml-1 tabular-nums">
                {String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/18 hover:border-white/28 transition-all focus:outline-none backdrop-blur-sm"
                aria-label="Slide anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={next}
                className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/18 hover:border-white/28 transition-all focus:outline-none backdrop-blur-sm"
                aria-label="Próximo slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
