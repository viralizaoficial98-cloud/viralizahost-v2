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
 * Degradê entre o vídeo e o conteúdo, calibrado no vídeo de produção
 * (paredes amarelas e brancas, logótipo final). A primeira camada fica por cima.
 * Desktop: texto à esquerda → preto 70% à esquerda, 60% ao centro, 45% à direita.
 * Telemóvel: texto ocupa a largura → mesma escala de baixo (texto) para cima.
 */
export const HERO_OVERLAY_DESKTOP = [
  'linear-gradient(90deg, rgba(245,183,0,0) 55%, rgba(245,183,0,0.08) 100%)',
  'linear-gradient(90deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.60) 50%, rgba(0,0,0,0.45) 100%)',
].join(', ')

export const HERO_OVERLAY_MOBILE = [
  'linear-gradient(to bottom, rgba(245,183,0,0.08) 0%, rgba(245,183,0,0) 35%)',
  'linear-gradient(to top, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.60) 50%, rgba(0,0,0,0.45) 100%)',
].join(', ')

/**
 * Banner principal em modo vídeo: vídeo limpo em fundo + título, subtítulo e
 * botões em HTML por cima.
 *
 * - Altura: em desktop/tablet ~70% da altura visível (máx. 680 px) abaixo do cabeçalho;
 *   no telemóvel adapta-se ao conteúdo, para a secção seguinte aparecer mais cedo.
 * - O vídeo preenche o banner com object-fit: cover; no telemóvel o enquadramento fica
 *   ligeiramente à esquerda do centro para manter as pessoas visíveis.
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
      className="relative w-full overflow-hidden bg-black"
      // o cabeçalho é fixo: o banner começa por baixo dele
      style={{ paddingTop: HEADER_H }}
      aria-labelledby="hero-title"
    >
      {/* svh = altura visível sem as barras do navegador móvel */}
      <div className="relative flex md:min-h-[min(70svh,680px)]">
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
          className="absolute inset-0 h-full w-full object-cover object-[42%_50%] md:object-[50%_40%] pointer-events-none select-none"
        />

        {/* Degradê (entre o vídeo e o conteúdo) */}
        <div data-hero-overlay="desktop" aria-hidden="true" className="absolute inset-0 hidden md:block pointer-events-none"
          style={{ background: HERO_OVERLAY_DESKTOP }} />
        <div data-hero-overlay="mobile" aria-hidden="true" className="absolute inset-0 md:hidden pointer-events-none"
          style={{ background: HERO_OVERLAY_MOBILE }} />

        {/* Conteúdo */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12 flex items-center py-9 md:py-12 max-[380px]:py-7 [@media(min-width:768px)_and_(max-height:820px)]:py-8">
          <div className="relative max-w-[44rem] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.45)]">
            {/* Sombra difusa só atrás do texto: garante o contraste nos trechos claros
                do vídeo (paredes brancas/amarelas, logótipo final) sem escurecer o resto. */}
            <div aria-hidden="true" className="pointer-events-none absolute -inset-x-16 -inset-y-12 -z-10 rounded-full bg-black/35 blur-2xl" />
            <p className="mb-3 md:mb-4 inline-flex items-center gap-2 rounded-full bg-black/65 px-3 py-1 text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-[#F5B700]">
              <span className="h-px w-6 bg-[#F5B700]" aria-hidden="true" />
              ViralizaHost
            </p>
            <h1 id="hero-title" className="font-black leading-[1.08] text-[1.75rem] max-[380px]:text-[1.5rem] sm:text-4xl lg:text-5xl xl:text-[3.5rem] [@media(min-width:768px)_and_(max-height:820px)]:text-[2.6rem]">
              {t('hero.title')}{' '}
              <span className="text-[#F5B700]">{t('hero.titleHighlight')}</span>
            </h1>
            <p className="mt-3 sm:mt-5 max-w-xl text-[0.95rem] max-[380px]:text-sm sm:text-lg leading-relaxed text-white [@media(min-width:768px)_and_(max-height:820px)]:mt-4">
              {t('hero.subtitle')}
            </p>
            <div className="mt-5 sm:mt-8 flex flex-wrap gap-3 max-[380px]:gap-2 [@media(min-width:768px)_and_(max-height:820px)]:mt-6">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[#F5B700] px-6 max-[380px]:px-4 py-3.5 max-[380px]:py-3 text-sm sm:text-base font-bold text-black [text-shadow:none] shadow-lg shadow-black/30 transition hover:bg-[#ffc81a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {t('cta.start')} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href="#planos"
                className="inline-flex items-center rounded-xl border border-white/60 bg-black/55 px-6 max-[380px]:px-4 py-3.5 max-[380px]:py-3 text-sm sm:text-base font-bold text-white backdrop-blur-sm transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5B700]"
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
