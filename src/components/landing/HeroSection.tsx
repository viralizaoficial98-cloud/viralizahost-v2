'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Server, Bot, Mail, ArrowRight, Shield, Zap, Star } from 'lucide-react'

const slides = [
  {
    id: 0,
    tag: 'Infraestrutura Premium',
    title: 'Servidores Premium para\nAlta Performance',
    subtitle: 'Cloud Hosting, VPS, Dedicated Servers e soluções enterprise para escalar o seu negócio.',
    cta: 'Ver Planos de Hospedagem',
    ctaHref: '#planos',
    ctaSecondary: 'Falar com Especialista',
    ctaSecondaryHref: '/tickets',
    icon: Server,
    gradient: 'from-[#0A0A0A] via-[#1a1a2e] to-[#16213e]',
    accent: 'from-[#F5B700] to-[#FFD54F]',
    features: ['LiteSpeed Enterprise', 'NVMe SSD Gen4', 'DDoS Protection'],
    bgPattern: `radial-gradient(ellipse at 20% 80%, rgba(245,183,0,0.15) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.2) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(245,183,0,0.05) 0%, transparent 70%)`,
  },
  {
    id: 1,
    tag: 'Inteligência Artificial',
    title: 'Automatize processos com\nInteligência Artificial',
    subtitle: 'Chatbots, automações inteligentes e agentes IA para transformar o seu negócio.',
    cta: 'Explorar Soluções IA',
    ctaHref: '#servicos',
    ctaSecondary: 'Saiba Mais',
    ctaSecondaryHref: '#servicos',
    icon: Bot,
    gradient: 'from-[#0d0d1a] via-[#0f0f2e] to-[#1a0a2e]',
    accent: 'from-[#F5B700] to-[#f59e0b]',
    features: ['Chatbots Inteligentes', 'Automação de Processos', 'Agentes IA'],
    bgPattern: `radial-gradient(ellipse at 70% 30%, rgba(139,92,246,0.2) 0%, transparent 50%),
                radial-gradient(ellipse at 20% 70%, rgba(245,183,0,0.15) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 90%, rgba(59,130,246,0.1) 0%, transparent 50%)`,
  },
  {
    id: 2,
    tag: 'E-mail Corporativo',
    title: 'E-mail Corporativo Seguro\ne Profissional',
    subtitle: 'Caixas corporativas com alta segurança, proteção anti-spam e integração completa.',
    cta: 'Ver Planos de E-mail',
    ctaHref: '#email-plans',
    ctaSecondary: 'Começar Agora',
    ctaSecondaryHref: '/register',
    icon: Mail,
    gradient: 'from-[#0a1628] via-[#0f1e3d] to-[#0a2d2d]',
    accent: 'from-[#F5B700] to-[#10b981]',
    features: ['Anti-Spam Avançado', 'SPF/DKIM/DMARC', 'Backup Diário'],
    bgPattern: `radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.15) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 80%, rgba(245,183,0,0.12) 0%, transparent 50%),
                radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 60%)`,
  },
]

const SLIDE_DURATION = 6000

export function HeroSection() {
  const [current, setCurrent] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [progress, setProgress] = useState(0)

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setProgress(0)
    setTimeout(() => {
      setCurrent(index)
      setIsTransitioning(false)
    }, 400)
  }, [isTransitioning])

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo])
  const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, goTo])

  /* Auto-play */
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(0)
      next()
    }, SLIDE_DURATION)
    return () => clearInterval(interval)
  }, [next])

  /* Progress bar */
  useEffect(() => {
    setProgress(0)
    const start = Date.now()
    const tick = () => {
      const elapsed = Date.now() - start
      setProgress(Math.min((elapsed / SLIDE_DURATION) * 100, 100))
      if (elapsed < SLIDE_DURATION) requestAnimationFrame(tick)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [current])

  /* Keyboard nav */
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
    <section className="relative min-h-screen flex flex-col overflow-hidden" aria-label="Hero Slideshow">
      {/* Background layers */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 bg-gradient-to-br ${s.gradient} transition-opacity duration-700`}
          style={{
            opacity: i === current ? 1 : 0,
            background: `linear-gradient(135deg, #0A0A0A 0%, #111111 60%, #0A0A0A 100%)`,
          }}
        />
      ))}

      {/* Dynamic pattern overlay */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{ background: slide.bgPattern }}
      />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Animated orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-yellow-500/8 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl animate-pulse-slow delay-300 pointer-events-none" />

      {/* Content */}
      <div className="relative flex-1 flex flex-col justify-center pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">

            {/* Tag */}
            <div
              key={`tag-${current}`}
              className="animate-fade-in-up mb-6"
            >
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/15 text-white/90 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full">
                <Icon size={13} className="text-[#F5B700]" />
                {slide.tag}
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              </span>
            </div>

            {/* Title */}
            <h1
              key={`title-${current}`}
              className={`text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.05] mb-6 animate-fade-in-up delay-100 ${isTransitioning ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            >
              {slide.title.split('\n').map((line, i) => (
                <span key={i}>
                  {i === 0 ? line : (
                    <><br /><span className="bg-gradient-to-r from-[#F5B700] to-[#FFD54F] bg-clip-text text-transparent">{line}</span></>
                  )}
                </span>
              ))}
            </h1>

            {/* Subtitle */}
            <p
              key={`sub-${current}`}
              className={`text-lg md:text-xl text-white/65 mb-10 max-w-2xl leading-relaxed animate-fade-in-up delay-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            >
              {slide.subtitle}
            </p>

            {/* Feature pills */}
            <div
              key={`features-${current}`}
              className="flex flex-wrap gap-3 mb-10 animate-fade-in-up delay-300"
            >
              {slide.features.map((f) => (
                <span key={f}
                  className="inline-flex items-center gap-2 bg-white/8 border border-white/12 text-white/80 text-xs font-medium px-4 py-2 rounded-full backdrop-blur">
                  <Zap size={11} className="text-[#F5B700]" />
                  {f}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div
              key={`cta-${current}`}
              className="flex flex-col sm:flex-row gap-4 animate-fade-in-up delay-400"
            >
              <Link href={slide.ctaHref}
                className="btn-shimmer btn-primary inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-base font-bold shadow-[0_8px_30px_rgba(245,183,0,0.4)] hover:shadow-[0_12px_40px_rgba(245,183,0,0.5)]">
                {slide.cta}
                <ArrowRight size={18} />
              </Link>
              <Link href={slide.ctaSecondaryHref}
                className="inline-flex items-center justify-center gap-2 border-2 border-white/20 hover:border-white/40 text-white hover:bg-white/8 px-10 py-4 rounded-2xl text-base font-bold transition-all">
                {slide.ctaSecondary}
              </Link>
            </div>

            {/* Trust row */}
            <div className="flex items-center gap-6 mt-12 animate-fade-in-up delay-500">
              <div className="flex -space-x-2">
                {['A','B','C','D','E'].map((l, i) => (
                  <div key={i}
                    className="w-8 h-8 rounded-full border-2 border-black/40 bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black text-xs font-bold">
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} size={13} className="text-[#F5B700] fill-[#F5B700]" />)}
                </div>
                <p className="text-white/60 text-sm"><strong className="text-white">+5.000</strong> clientes satisfeitos</p>
              </div>
              <div className="hidden sm:flex items-center gap-4 ml-4 border-l border-white/10 pl-6">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Shield size={14} className="text-green-400" />
                  Uptime 99.9%
                </div>
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <Zap size={14} className="text-[#F5B700]" />
                  LiteSpeed
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide controls */}
      <div className="relative pb-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between max-w-5xl mx-auto">

            {/* Dot indicators + progress */}
            <div className="flex items-center gap-4">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className="relative h-1 rounded-full overflow-hidden transition-all duration-300 focus:outline-none"
                  style={{ width: i === current ? '48px' : '24px', background: i === current ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.25)' }}
                  aria-label={`Slide ${i + 1}`}
                >
                  {i === current && (
                    <div
                      className="absolute left-0 top-0 h-full bg-[#F5B700] rounded-full"
                      style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
                    />
                  )}
                </button>
              ))}
              <span className="text-white/40 text-xs font-mono ml-2">
                {String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </span>
            </div>

            {/* Arrow controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/16 hover:border-white/25 transition-all focus:outline-none"
                aria-label="Slide anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={next}
                className="w-10 h-10 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white hover:bg-white/16 hover:border-white/25 transition-all focus:outline-none"
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
