'use client'
import { useEffect } from 'react'

/**
 * Secções que carregam conteúdo depois da página (ex.: cartões de planos) empurram o resto para baixo. Se o endereço
 * tiver uma âncora mais abaixo (ex.: /email-corporativo#seguranca), volta a posicioná-la uma vez, quando o conteúdo
 * desta secção (ownId) fica pronto.
 */
export function useReanchorAfterLoad(ready: boolean, ownId: string) {
  useEffect(() => {
    if (!ready || typeof window === 'undefined') return
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (!hash || hash === ownId) return
    const target = document.getElementById(hash), self = document.getElementById(ownId)
    if (!target || !self || !(self.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) return
    // Uma passagem quando a secção fica pronta e outra depois de o resto da página assentar (imagens, tipos de letra),
    // só se o visitante não se tiver deslocado entretanto
    let placedAt = -1
    const place = () => { target.scrollIntoView(); placedAt = window.scrollY }
    const raf = requestAnimationFrame(place)
    const later = setTimeout(() => { if (window.scrollY === placedAt && window.location.hash.slice(1) === hash) place() }, 800)
    return () => { cancelAnimationFrame(raf); clearTimeout(later) }
  }, [ready, ownId])
}
