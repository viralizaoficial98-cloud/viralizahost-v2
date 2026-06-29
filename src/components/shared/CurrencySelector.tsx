'use client'
import { useCurrency } from '@/hooks/useCurrency'
import { CURRENCIES } from '@/lib/constants'
import { Currency } from '@/types'

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code as Currency)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
            currency === c.code ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {c.flag} {c.code}
        </button>
      ))}
    </div>
  )
}
