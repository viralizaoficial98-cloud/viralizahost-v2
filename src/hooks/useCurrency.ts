'use client'
import { useCurrencyStore } from '@/store/currencyStore'
import { formatCurrency } from '@/lib/utils'
import { Currency } from '@/types'

export function useCurrency() {
  const { currency, setCurrency } = useCurrencyStore()
  const format = (amount: number) => formatCurrency(amount, currency)
  return { currency, setCurrency, format }
}
