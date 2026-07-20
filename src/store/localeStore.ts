'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Region = 'AO' | 'BR' | 'US'
export type Locale = 'pt-AO' | 'pt-BR' | 'en-US'
export type Currency = 'AKZ' | 'BRL' | 'USD'

export const REGION_MAP: Record<Region, { locale: Locale; currency: Currency; symbol: string; label: string }> = {
  AO: { locale: 'pt-AO', currency: 'AKZ', symbol: 'Kz', label: 'Kwanza (Kz)' },
  BR: { locale: 'pt-BR', currency: 'BRL', symbol: 'R$', label: 'Real (R$)' },
  US: { locale: 'en-US', currency: 'USD', symbol: '$',  label: 'Dollar ($)' },
}

interface LocaleStore {
  region: Region
  locale: Locale
  currency: Currency
  changeRegion: (region: Region) => void
  /** Backward-compat: change currency only (also updates region/locale) */
  setCurrency: (currency: Currency) => void
}

const CURRENCY_TO_REGION: Record<Currency, Region> = { AKZ: 'AO', BRL: 'BR', USD: 'US' }

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      region: 'AO',
      locale: 'pt-AO',
      currency: 'AKZ',
      changeRegion: (region) => {
        const { locale, currency } = REGION_MAP[region]
        set({ region, locale, currency })
        if (typeof document !== 'undefined') document.documentElement.lang = locale
      },
      setCurrency: (currency) => {
        const region = CURRENCY_TO_REGION[currency]
        const { locale } = REGION_MAP[region]
        set({ region, locale, currency })
        if (typeof document !== 'undefined') document.documentElement.lang = locale
      },
    }),
    { name: 'viralizahost-locale' }
  )
)
