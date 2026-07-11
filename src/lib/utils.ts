import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Currency } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: Currency): string {
  const formatters: Record<Currency, Intl.NumberFormat> = {
    AKZ: new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', currencyDisplay: 'symbol' }),
    BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  }
  const result = formatters[currency].format(amount)
  if (currency === 'AKZ') return result.replace('AOA', 'Kz')
  return result
}

export function getPlanPrice(plan: { price_akz: number; price_brl: number; price_usd: number }, currency: Currency): number {
  const map: Record<Currency, number> = {
    AKZ: plan.price_akz,
    BRL: plan.price_brl,
    USD: plan.price_usd,
  }
  return map[currency]
}

export function formatKz(amount: number): string {
  return `Kz ${amount.toLocaleString('pt-AO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}
