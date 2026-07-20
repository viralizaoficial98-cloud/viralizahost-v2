'use client'
import { useLocaleStore } from '@/store/localeStore'
import { formatCurrency } from '@/lib/utils'
import { Currency } from '@/types'

export function useCurrency() {
  const { currency, setCurrency } = useLocaleStore()
  const format = (amount: number) => formatCurrency(amount, currency as Currency)
  return { currency: currency as Currency, setCurrency: (c: Currency) => setCurrency(c), format }
}
