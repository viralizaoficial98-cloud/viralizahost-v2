'use client'
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Carrossel horizontal de cartões de planos.
 * Computador: 3 visíveis · Tablet: 2 · Telemóvel: 1 (com espreitar do seguinte).
 */
export function PlansCarousel({ children }: { children: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [active, setActive] = useState(0)
  const items = Children.toArray(children)

  const update = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    const first = el.firstElementChild as HTMLElement | null
    if (first) {
      const step = first.offsetWidth + 24
      setActive(Math.round(el.scrollLeft / step))
    }
  }, [])

  useEffect(() => {
    update()
    const el = trackRef.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update, items.length])

  const scrollByCard = (dir: 1 | -1) => {
    const el = trackRef.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    el.scrollBy({ left: dir * (first.offsetWidth + 24), behavior: 'smooth' })
  }

  const scrollTo = (i: number) => {
    const el = trackRef.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    el.scrollTo({ left: i * (first.offsetWidth + 24), behavior: 'smooth' })
  }

  const arrowBase =
    'flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#F5B700] text-[#0A0A0A] shadow-[0_6px_24px_rgba(245,183,0,0.45)] ring-4 ring-white transition-all duration-200 hover:scale-110 hover:shadow-[0_8px_32px_rgba(245,183,0,0.60)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none'

  const showControls = canPrev || canNext

  return (
    <div className="relative max-w-6xl mx-auto" role="region" aria-roledescription="carrossel" aria-label="Planos de hospedagem">
      {/* Setas laterais (computador / tablet) */}
      {showControls && (
        <>
          <button type="button" aria-label="Ver planos anteriores" onClick={() => scrollByCard(-1)} disabled={!canPrev}
            className={`${arrowBase} hidden sm:flex absolute top-1/2 -translate-y-1/2 -left-3 lg:-left-8 xl:-left-16 z-10`}>
            <ChevronLeft size={28} strokeWidth={3} />
          </button>
          <button type="button" aria-label="Ver mais planos" onClick={() => scrollByCard(1)} disabled={!canNext}
            className={`${arrowBase} hidden sm:flex absolute top-1/2 -translate-y-1/2 -right-3 lg:-right-8 xl:-right-16 z-10`}>
            <ChevronRight size={28} strokeWidth={3} />
          </button>
        </>
      )}

      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth scroll-px-4 pt-6 pb-12 -mb-8 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((child, i) => (
          <div key={i}
            className="snap-start shrink-0 basis-[85%] sm:basis-[calc((100%-24px)/2)] lg:basis-[calc((100%-48px)/3)] flex">
            <div className="w-full flex flex-col [&>*]:flex-1">{child}</div>
          </div>
        ))}
      </div>

      {/* Setas + pontos (telemóvel) e pontos (computador) */}
      {showControls && (
        <div className="flex items-center justify-center gap-5 mt-4">
          <button type="button" aria-label="Ver planos anteriores" onClick={() => scrollByCard(-1)} disabled={!canPrev}
            className={`${arrowBase} sm:hidden`}>
            <ChevronLeft size={26} strokeWidth={3} />
          </button>
          <div className="flex items-center gap-2">
            {items.map((_, i) => (
              <button key={i} type="button" aria-label={`Ir para o plano ${i + 1}`} onClick={() => scrollTo(i)}
                className={`h-2.5 rounded-full transition-all ${i === active ? 'w-7 bg-[#F5B700]' : 'w-2.5 bg-[#D9D9D9] hover:bg-[#BBB]'}`} />
            ))}
          </div>
          <button type="button" aria-label="Ver mais planos" onClick={() => scrollByCard(1)} disabled={!canNext}
            className={`${arrowBase} sm:hidden`}>
            <ChevronRight size={26} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  )
}
