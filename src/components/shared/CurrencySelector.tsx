'use client'
import { useCurrency } from '@/hooks/useCurrency'
import { CURRENCIES } from '@/lib/constants'
import { Currency } from '@/types'

interface CurrencySelectorProps {
  variant?: 'light' | 'dark'
}

export function CurrencySelector({ variant = 'dark' }: CurrencySelectorProps) {
  const { currency, setCurrency } = useCurrency()

  const isLight = variant === 'light'

  return (
    <div className={`flex items-center gap-1 rounded-xl p-1 ${isLight ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code as Currency)}
          title={c.label}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currency === c.code
              ? isLight
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-indigo-600 text-white shadow'
              : isLight
              ? 'text-slate-400 hover:text-white hover:bg-slate-700'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          {c.flag} {c.code}
        </button>
      ))}
    </div>
  )
}
