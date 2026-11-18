import { useEffect, useState } from 'react'

/*
 * Medidas partilhadas pelo topo da página inicial (carrossel e vídeo),
 * para que os dois modos ocupem exatamente o mesmo espaço.
 */

export const HEADER_H = 68 // px — fixed site header height

export type HeroBreakpoint = 'mobile' | 'tablet' | 'desktop'

/* ─── Breakpoint hook ────────────────────────────────────────── */
export function useBreakpoint() {
  const [bp, setBp] = useState<HeroBreakpoint>('desktop')
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
 *   mobile   460px visible  (528px total)
 *   tablet   560px visible  (628px total)  — wider area for iPad landscape
 *   desktop  clamp(600px, 76vh, 880px) visible
 */
export function sectionHeight(bp: HeroBreakpoint): string {
  if (bp === 'mobile')  return `${460 + HEADER_H}px`
  if (bp === 'tablet')  return `${560 + HEADER_H}px`
  return `clamp(${640 + HEADER_H}px, calc(85vh + ${HEADER_H}px), ${960 + HEADER_H}px)`
}
