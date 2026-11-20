'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Carrinho persistente (localStorage). Só guarda escolhas — os preços vêm sempre
// da cotação do servidor (/api/checkout/quote). O código EPP de transferência
// nunca é persistido.

export type Cycle = 'monthly' | '3months' | '6months' | '1year' | '2years' | '3years'
export type DomainMode = 'register' | 'transfer' | 'existing'

export type CartLine =
  | { key: string; type: 'product'; slug: string; cycle: Cycle; quantity: number; domain?: string; domainMode?: DomainMode }
  | { key: string; type: 'domain'; domain: string; operation: 'register' | 'transfer' | 'renew'; eppCode?: string }
  | { key: string; type: 'renewal'; serviceId: string; label?: string }

interface CartState {
  lines: CartLine[]
  idempotencyKey: string | null
  addProduct: (slug: string, cycle?: Cycle) => void
  addDomain: (domain: string, operation: 'register' | 'transfer' | 'renew') => void
  addRenewal: (serviceId: string, label?: string) => void
  update: (key: string, patch: Partial<CartLine>) => void
  remove: (key: string) => void
  clear: () => void
  ensureIdempotencyKey: () => string
  resetIdempotencyKey: () => void
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      idempotencyKey: null,
      addProduct: (slug, cycle = 'monthly') => set(s => {
        if (s.lines.some(l => l.type === 'product' && l.slug === slug)) return s
        return { lines: [...s.lines, { key: newKey(), type: 'product', slug, cycle, quantity: 1 }], idempotencyKey: null }
      }),
      addDomain: (domain, operation) => set(s => {
        const d = domain.trim().toLowerCase()
        if (s.lines.some(l => l.type === 'domain' && l.domain === d)) {
          return { lines: s.lines.map(l => (l.type === 'domain' && l.domain === d ? { ...l, operation } : l)), idempotencyKey: null }
        }
        return { lines: [...s.lines, { key: newKey(), type: 'domain', domain: d, operation }], idempotencyKey: null }
      }),
      addRenewal: (serviceId, label) => set(s => {
        if (s.lines.some(l => l.type === 'renewal' && l.serviceId === serviceId)) return s
        return { lines: [...s.lines, { key: newKey(), type: 'renewal', serviceId, label }], idempotencyKey: null }
      }),
      update: (key, patch) => set(s => ({ lines: s.lines.map(l => (l.key === key ? ({ ...l, ...patch } as CartLine) : l)), idempotencyKey: null })),
      remove: key => set(s => ({ lines: s.lines.filter(l => l.key !== key), idempotencyKey: null })),
      clear: () => set({ lines: [], idempotencyKey: null }),
      ensureIdempotencyKey: () => {
        const cur = get().idempotencyKey
        if (cur) return cur
        const k = newKey()
        set({ idempotencyKey: k })
        return k
      },
      resetIdempotencyKey: () => set({ idempotencyKey: null }),
    }),
    {
      name: 'viralizahost-cart-v2',
      partialize: s => ({
        lines: s.lines.map(l => (l.type === 'domain' ? { ...l, eppCode: undefined } : l)),
        idempotencyKey: s.idempotencyKey,
      }),
    },
  ),
)

/** Converte uma linha do carrinho no formato da API (o EPP só vai no pedido final). */
export function toApiLine(l: CartLine) {
  if (l.type === 'renewal') return { type: 'renewal', serviceId: l.serviceId }
  if (l.type === 'domain') return { type: 'domain', domain: l.domain, operation: l.operation, ...(l.eppCode ? { eppCode: l.eppCode } : {}) }
  return { type: 'product', slug: l.slug, cycle: l.cycle, quantity: l.quantity, ...(l.domain ? { domain: l.domain, domainMode: l.domainMode ?? 'existing' } : {}) }
}
