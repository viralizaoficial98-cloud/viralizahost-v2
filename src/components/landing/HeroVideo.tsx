'use client'
import { useEffect, useRef, useState } from 'react'
import { HeroCarousel } from './HeroCarousel'
import { HEADER_H, useBreakpoint, sectionHeight } from './heroLayout'

/* HTMLMediaElement.NETWORK_NO_SOURCE */
const NETWORK_NO_SOURCE = 3

/**
 * Vídeo no topo da página inicial (HOME_HERO_MODE=video).
 *
 * - Mesmo contêiner, largura e altura do carrossel (heroLayout).
 * - Leitor nativo com controlos; só reproduz quando o visitante carrega em play.
 * - object-fit: contain → sem cortes nem distorção (barras pretas se a proporção diferir).
 * - Se o vídeo falhar ao carregar, desmonta-se e apresenta o carrossel original.
 */
export function HeroVideo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bp = useBreakpoint()

  /* O erro pode ocorrer antes da hidratação (o <video> vem no HTML do servidor),
     caso em que o onError do React não chega a correr. */
  useEffect(() => {
    const v = videoRef.current
    if (v && (v.error || v.networkState === NETWORK_NO_SOURCE)) setFailed(true)
  }, [])

  if (failed) return <HeroCarousel />

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ background: '#000', minHeight: sectionHeight(bp) }}
      aria-label="Vídeo de apresentação"
    >
      <h1 className="sr-only">
        ViralizaHost — Hospedagem de sites, domínios, e-mail corporativo e servidores VPS em Angola e no Brasil
      </h1>

      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        preload="metadata"
        onError={() => {
          console.warn('[HeroVideo] falha ao carregar o vídeo, a apresentar o carrossel:', src)
          setFailed(true)
        }}
        className="absolute left-0 right-0 bottom-0 w-full bg-black"
        style={{
          top: HEADER_H,
          height: `calc(100% - ${HEADER_H}px)`,
          objectFit: 'contain',
          objectPosition: 'center center',
        }}
      >
        O seu navegador não suporta vídeo HTML5.
      </video>
    </section>
  )
}
