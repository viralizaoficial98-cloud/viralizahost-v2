'use client'
import { useEffect, useRef, useState } from 'react'
import { HeroCarousel } from './HeroCarousel'
import { HEADER_H } from './heroLayout'

/* HTMLMediaElement.NETWORK_NO_SOURCE */
const NETWORK_NO_SOURCE = 3

/*
 * Degradê sobre o vídeo (de baixo para cima na pilha):
 *  1. Preto da esquerda (onde o vídeo mostra o texto) para a direita.
 *  2. Toque do amarelo da marca (#F5B700) no lado oposto ao texto.
 *  3. Escurecimento suave em baixo, para a transição para a secção seguinte.
 * Valores afinados sobre o vídeo real (public/video_IA.mp4) — ver docs no PR.
 */
export const HERO_VIDEO_OVERLAY = [
  'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 20%)',
  'linear-gradient(90deg, rgba(245,183,0,0) 45%, rgba(245,183,0,0.10) 100%)',
  'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.50) 30%, rgba(0,0,0,0.25) 62%, rgba(0,0,0,0.12) 100%)',
].join(', ')

/**
 * Vídeo de fundo no topo da página inicial (modo vídeo do banner principal).
 *
 * - Ocupa toda a largura e toda a altura visível abaixo do cabeçalho fixo (100svh).
 * - object-fit: cover → sem barras pretas e sem distorção; em ecrãs estreitos o
 *   enquadramento desloca-se para a direita para manter o rosto em destaque.
 * - Reprodução automática, sem som, em ciclo e sem controlos.
 * - Se o vídeo falhar ao carregar, desmonta-se e apresenta o carrossel original.
 */
export function HeroVideo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    /* O erro pode ocorrer antes da hidratação (o <video> vem no HTML do servidor),
       caso em que o onError do React não chega a correr. */
    if (v.error || v.networkState === NETWORK_NO_SOURCE) { setFailed(true); return }
    /* O React não escreve o atributo `muted` no HTML do servidor; sem ele os
       navegadores bloqueiam o autoplay. Garante-se aqui e tenta-se reproduzir. */
    v.muted = true
    v.defaultMuted = true
    if (v.paused) v.play().catch(() => { /* ex.: modo de poupança de energia no iOS — fica a 1.ª imagem */ })
  }, [])

  if (failed) return <HeroCarousel />

  return (
    <section
      className="relative w-full overflow-hidden h-screen"
      // svh = altura visível sem as barras do navegador móvel; h-screen é a reserva
      style={{ background: '#000', height: '100svh' }}
      aria-label="Vídeo de apresentação"
    >
      <h1 className="sr-only">
        ViralizaHost — Hospedagem de sites, domínios, e-mail corporativo e servidores VPS em Angola e no Brasil
      </h1>

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
          className="absolute inset-0 h-full w-full object-cover object-[62%_50%] md:object-center pointer-events-none select-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: HERO_VIDEO_OVERLAY }}
        />
      </div>
    </section>
  )
}
