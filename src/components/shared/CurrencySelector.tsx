'use client'
import { useCurrency } from '@/hooks/useCurrency'
import { CURRENCIES } from '@/lib/constants'
import { Currency } from '@/types'

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()
  return (
    <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#333] rounded-xl p-1">
      {CURRENCIES.map((c) => (
        <button
          key={c.code}
          onClick={() => setCurrency(c.code as Currency)}
          title={c.label}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            currency === c.code
              ? 'bg-yellow-400 text-black shadow'
              : 'text-gray-500 hover:text-white hover:bg-[#2A2A2A]'
          }`}
        >
          {c.flag} {c.code}
        </button>
      ))}
    </div>
  )
}
