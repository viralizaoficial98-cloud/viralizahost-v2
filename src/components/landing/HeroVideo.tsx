'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { HeroCarousel } from './HeroCarousel'
import { HEADER_H } from './heroLayout'
import { useLocale } from '@/hooks/useLocale'

/* HTMLMediaElement.NETWORK_NO_SOURCE */
const NETWORK_NO_SOURCE = 3

/*
 * Degradê entre o vídeo e o conteúdo (variante C, calibrada no vídeo de produção).
 * Desktop: texto à esquerda → preto mais forte à esquerda, amarelo da marca à direita.
 * Telemóvel: texto em baixo → preto mais forte em baixo, amarelo no topo.
 * Ordem: a primeira camada fica por cima.
 */
export const HERO_OVERLAY_DESKTOP = [
  'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 25%)',
  'linear-gradient(90deg, rgba(245,183,0,0) 50%, rgba(245,183,0,0.12) 100%)',
  'linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.28) 35%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.38) 100%)',
].join(', ')

export const HERO_OVERLAY_MOBILE = [
  'linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.28) 35%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.38) 100%)',
  'linear-gradient(to bottom, rgba(245,183,0,0.12) 0%, rgba(245,183,0,0) 40%)',
].join(', ')

/**
 * Banner principal em modo vídeo: vídeo limpo em fundo + título, subtítulo e
 * botões em HTML por cima.
 *
 * - O vídeo ocupa toda a área visível abaixo do cabeçalho do site (100svh − cabeçalho),
 *   com object-fit: cover; no telemóvel o enquadramento fica ligeiramente à esquerda
 *   do centro para manter as pessoas visíveis.
 * - Reprodução automática, sem som, em ciclo e sem controlos.
 * - O degradê não intercepta cliques (pointer-events: none).
 * - Se o vídeo falhar ao carregar, desmonta-se e apresenta o carrossel original.
 */
export function HeroVideo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { t } = useLocale()

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    /* O erro pode ocorrer antes da hidratação (o <video> vem no HTML do servidor),
       caso em que o onError do React não chega a correr. */
    if (v.error || v.networkState === NETWORK_NO_SOURCE) { setFailed(true); return }
    /* Garante o modo sem som (condição dos navegadores para o autoplay) e tenta reproduzir. */
    v.muted = true
    v.defaultMuted = true
    if (v.paused) v.play().catch(() => { /* ex.: poupança de energia no iOS — fica a 1.ª imagem */ })
  }, [])

  if (failed) return <HeroCarousel />

  return (
    <section
      className="relative w-full overflow-hidden h-screen bg-black"
      // svh = altura visível sem as barras do navegador móvel; h-screen é a reserva
      style={{ height: '100svh' }}
      aria-labelledby="hero-title"
    >
      <div className="absolute inset-x-0 bottom-0" style={{ top: HEADER_H }}>
        <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => {
            console.warn('[HeroVideo] falha ao carregar o vídeo, a apresentar o carrossel:', src)
            setFailed(true)
          }}
          className="absolute inset-0 h-full w-full object-cover object-[42%_50%] md:object-center pointer-events-none select-none"
        />

        {/* Degradê (entre o vídeo e o conteúdo) */}
        <div data-hero-overlay="desktop" aria-hidden="true" className="absolute inset-0 hidden md:block pointer-events-none"
          style={{ background: HERO_OVERLAY_DESKTOP }} />
        <div data-hero-overlay="mobile" aria-hidden="true" className="absolute inset-0 md:hidden pointer-events-none"
          style={{ background: HERO_OVERLAY_MOBILE }} />

        {/* Conteúdo */}
        <div className="relative z-10 h-full mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12 flex items-end md:items-center pb-28 md:pb-0">
          <div className="relative max-w-[40rem] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
            {/* Sombra difusa só atrás do texto: garante o contraste nos trechos claros
                do vídeo (paredes brancas/amarelas, logótipo final) sem escurecer o resto. */}
            <div aria-hidden="true" className="pointer-events-none absolute -inset-x-16 -inset-y-14 -z-10 rounded-full bg-black/50 blur-2xl" />
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[#F5B700]">
              <span className="h-px w-6 bg-[#F5B700]" aria-hidden="true" />
              ViralizaHost
            </p>
            <h1 id="hero-title" className="font-black leading-[1.08] text-[1.75rem] sm:text-4xl lg:text-5xl xl:text-[3.5rem]">
              {t('hero.title')}{' '}
              <span className="text-[#F5B700]">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="mt-4 sm:mt-5 max-w-xl text-[0.95rem] sm:text-lg leading-relaxed text-white">
              {t('hero.subtitle')}
            </p>
            <div className="mt-6 sm:mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[#F5B700] px-6 py-3.5 text-sm sm:text-base font-bold text-black [text-shadow:none] shadow-lg shadow-black/30 transition hover:bg-[#ffc81a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t('cta.start')} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="#planos"
                className="inline-flex items-center rounded-xl border border-white/60 bg-black/55 px-6 py-3.5 text-sm sm:text-base font-bold text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5B700]"
              >
                {t('cta.viewPlans')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
