'use client'
import { useState } from 'react'
import { MapPin } from 'lucide-react'

/**
 * Bandeira pequena (20×15) de um país, a partir dos ficheiros locais /flags/<iso2>.png (flag-icons, MIT — os mesmos
 * da «Presença Global»). Sem país identificado, ou se a imagem falhar, mostra um ícone neutro: o texto ao lado
 * (a cidade) nunca depende da bandeira. Decorativa (aria-hidden).
 */
export function CountryFlag({ code, className = '', iconSize = 14 }: { code?: string | null; className?: string; iconSize?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  const cc = code && /^[a-z]{2}$/.test(code) ? code : null
  if (!cc || failed === cc) return <MapPin size={iconSize} className={`shrink-0 text-[#94A3B8] ${className}`} aria-hidden="true" data-testid="dc-flag-fallback" />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/flags/${cc}.png`} alt="" aria-hidden="true" width={20} height={15} decoding="async" data-testid="dc-flag" data-country={cc}
      className={`w-5 h-[15px] rounded-[2px] object-cover ring-1 ring-black/10 shrink-0 ${className}`} onError={() => setFailed(cc)} />
  )
}
