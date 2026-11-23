'use client'
import { useEffect } from 'react'
import { startCartSync } from '@/store/cartSync'

/** Liga a sincronização do carrinho com o servidor (uma vez por página). */
export function CartSync() {
  useEffect(() => { startCartSync() }, [])
  return null
}
