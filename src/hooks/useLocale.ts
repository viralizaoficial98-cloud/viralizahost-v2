'use client'
import { useLocaleStore, Region, Locale, Currency, REGION_MAP } from '@/store/localeStore'
import ptAO from '@/i18n/locales/pt-AO.json'
import ptBR from '@/i18n/locales/pt-BR.json'
import enUS from '@/i18n/locales/en-US.json'

type TranslationDict = Record<string, unknown>

const TRANSLATIONS: Record<Locale, TranslationDict> = {
  'pt-AO': ptAO as TranslationDict,
  'pt-BR': ptBR as TranslationDict,
  'en-US': enUS as TranslationDict,
}

function getNestedValue(obj: TranslationDict, key: string): string {
  const parts = key.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return key
    current = (current as TranslationDict)[part]
  }
  return typeof current === 'string' ? current : key
}

export function useLocale() {
  const { region, locale, currency, changeRegion, setCurrency } = useLocaleStore()
  const dict = TRANSLATIONS[locale] ?? TRANSLATIONS['pt-AO']

  function t(key: string, vars?: Record<string, string | number>): string {
    let value = getNestedValue(dict, key)
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(`{{${k}}}`, String(v))
      })
    }
    return value
  }

  const regionMeta = REGION_MAP[region]

  function formatCurrency(amount: number): string {
    if (currency === 'AKZ') {
      return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', currencyDisplay: 'symbol' })
        .format(amount).replace('AOA', 'Kz')
    }
    if (currency === 'BRL') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  function formatDate(date: string | Date, format?: 'short' | 'long'): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const fmt = format === 'long' ? { day: '2-digit' as const, month: 'long' as const, year: 'numeric' as const } : { day: '2-digit' as const, month: '2-digit' as const, year: 'numeric' as const }
    return d.toLocaleDateString(locale, fmt)
  }

  return {
    region,
    locale,
    currency,
    symbol: regionMeta.symbol,
    changeRegion,
    setCurrency,
    t,
    formatCurrency,
    formatDate,
  }
}
