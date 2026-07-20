'use client'
import { useEffect } from 'react'
import { useLocaleStore } from '@/store/localeStore'

/** Syncs the <html lang> attribute with the Zustand locale on mount and on change. */
export function LocaleSync() {
  const locale = useLocaleStore((s) => s.locale)
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return null
}
