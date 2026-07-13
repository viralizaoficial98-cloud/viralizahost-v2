'use client'
import { useCurrency } from '@/hooks/useCurrency'
import { CURRENCIES } from '@/lib/constants'
import { Currency } from '@/types'

/* Inline SVG flags — no external dependency, renders on all OS including Windows */
function FlagIcon({ code }: { code: string }) {
  const style: React.CSSProperties = {
    display: 'inline-block',
    verticalAlign: 'middle',
    borderRadius: 2,
    flexShrink: 0,
  }
  if (code === 'AKZ') return (
    <svg width="18" height="13" viewBox="0 0 20 14" style={style} aria-hidden="true">
      <rect width="20" height="7" fill="#CC0000" />
      <rect y="7" width="20" height="7" fill="#000" />
      {/* simplified yellow star/gear emblem */}
      <circle cx="10" cy="7" r="2.2" fill="#F0C000" />
      <polygon points="10,4.5 10.6,6.3 12.5,6.3 11,7.4 11.6,9.2 10,8.1 8.4,9.2 9,7.4 7.5,6.3 9.4,6.3" fill="#CC0000" />
    </svg>
  )
  if (code === 'BRL') return (
    <svg width="18" height="13" viewBox="0 0 20 14" style={style} aria-hidden="true">
      <rect width="20" height="14" fill="#009c3b" />
      <polygon points="10,2 18.5,7 10,12 1.5,7" fill="#ffdf00" />
      <circle cx="10" cy="7" r="3.2" fill="#002776" />
      <path d="M6.5,5.8 Q10,4.8 13.5,6.5" stroke="white" strokeWidth="0.9" fill="none" />
    </svg>
  )
  if (code === 'USD') return (
    <svg width="18" height="13" viewBox="0 0 20 14" style={style} aria-hidden="true">
      <rect width="20" height="14" fill="#B22234" />
      {([1.08, 3.23, 5.38, 7.54, 9.69, 11.85] as number[]).map((y) => (
        <rect key={y} y={y} width="20" height="1.08" fill="white" />
      ))}
      <rect width="8" height="7.69" fill="#3C3B6E" />
    </svg>
  )
  return null
}

const ARIA_LABELS: Record<string, string> = {
  AKZ: 'Selecionar moeda Kwanza angolano',
  BRL: 'Selecionar moeda Real brasileiro',
  USD: 'Selecionar moeda Dólar americano',
}

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#333] rounded-xl p-1">
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code as Currency)}
          aria-label={ARIA_LABELS[c.code] ?? c.label}
          aria-pressed={currency === c.code}
          title={c.label}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
            currency === c.code
              ? 'bg-yellow-400 text-black shadow'
              : 'text-gray-500 hover:text-white hover:bg-[#2A2A2A]'
          }`}
        >
          <FlagIcon code={c.code} />
          <span>{c.code}</span>
        </button>
      ))}
    </div>
  )
}
