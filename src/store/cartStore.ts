'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Carrinho persistente (localStorage). Só guarda escolhas — os preços vêm sempre
// da cotação do servidor (/api/checkout/quote). O código EPP de transferência
// nunca é persistido.

export interface NameserverChoice { useDefault: boolean; ns: string[] }
export type Cycle = 'monthly' | '3months' | '6months' | '1year' | '2years' | '3years'
export type DomainMode = 'register' | 'transfer' | 'existing'
/** Opções de um VPS (ids das opções activadas no painel): localização e sistema operativo/imagem. */
export interface ProductOptions { location?: string; image?: string }

export type CartLine =
  | { key: string; type: 'product'; slug: string; cycle: Cycle; quantity: number; domain?: string; domainMode?: DomainMode; flowId?: string; options?: ProductOptions }
  | { key: string; type: 'domain'; domain: string; operation: 'register' | 'transfer' | 'renew'; eppCode?: string; years?: number; flowId?: string; nameservers?: NameserverChoice }
  | { key: string; type: 'renewal'; serviceId: string; label?: string }

/** Linha sem chave (Omit distributivo sobre a união). */
export type NewCartLine = CartLine extends infer T ? (T extends CartLine ? Omit<T, 'key'> : never) : never

interface CartState {
  lines: CartLine[]
  idempotencyKey: string | null
  addProduct: (slug: string, cycle?: Cycle) => void
  addDomain: (domain: string, operation: 'register' | 'transfer' | 'renew') => void
  addRenewal: (serviceId: string, label?: string) => void
  /** Linhas de um percurso de compra (/comprar): substitui as do mesmo percurso e não duplica domínio/plano. */
  setPurchase: (flowId: string, lines: NewCartLine[]) => void
  /**
   * Configuração de um domínio avulso (registo): cria ou actualiza a linha do domínio no mesmo lugar,
   * sem duplicar. hosting: plano a juntar (null = retirar o alojamento associado a este domínio novo).
   */
  saveDomainConfig: (domain: { domain: string; years: number; nameservers: NameserverChoice }, hosting: { slug: string; cycle: Cycle } | null) => void
  /** Substitui o carrinho pelo guardado no servidor (retoma noutro separador/dispositivo). */
  replaceAll: (lines: CartLine[]) => void
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
      setPurchase: (flowId, incoming) => set(s => {
        const ident = (l: NewCartLine | CartLine) => l.type === 'product' ? `p:${l.slug}:${l.domain ?? ''}` : l.type === 'domain' ? `d:${l.domain}` : `r:${l.serviceId}`
        const ids = new Set(incoming.map(ident))
        const kept = s.lines.filter(l => (l as { flowId?: string }).flowId !== flowId && !ids.has(ident(l)))
        return { lines: [...kept, ...incoming.map(l => ({ ...l, key: newKey(), flowId } as CartLine))], idempotencyKey: null }
      }),
      saveDomainConfig: (cfg, hosting) => set(s => {
        const d = cfg.domain.trim().toLowerCase()
        const isDomain = (l: CartLine) => l.type === 'domain' && l.domain === d
        const isHosting = (l: CartLine) => l.type === 'product' && l.domain === d && l.domainMode === 'register'
        const prevDomain = s.lines.find(isDomain)
        const domainLine: CartLine = { key: prevDomain?.key ?? newKey(), type: 'domain', domain: d, operation: 'register', years: cfg.years, nameservers: cfg.nameservers, flowId: `dominio:${d}` }
        const prevHosting = s.lines.find(isHosting)
        const hostingLine: CartLine | null = hosting
          ? { key: prevHosting?.key ?? newKey(), type: 'product', slug: hosting.slug, cycle: hosting.cycle, quantity: 1, domain: d, domainMode: 'register', flowId: `dominio:${d}` }
          : null
        const out: CartLine[] = []
        let placed = false
        for (const l of s.lines) {
          if (isDomain(l) || isHosting(l)) {
            if (!placed) { if (hostingLine) out.push(hostingLine); out.push(domainLine); placed = true }
            continue
          }
          out.push(l)
        }
        if (!placed) { if (hostingLine) out.push(hostingLine); out.push(domainLine) }
        return { lines: out, idempotencyKey: null }
      }),
      replaceAll: lines => set({ lines, idempotencyKey: null }),
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
  if (l.type === 'domain') return { type: 'domain', domain: l.domain, operation: l.operation, years: l.years ?? 1, ...(l.eppCode ? { eppCode: l.eppCode } : {}), ...(l.nameservers ? { nameservers: l.nameservers } : {}) }
  return { type: 'product', slug: l.slug, cycle: l.cycle, quantity: l.quantity, ...(l.domain ? { domain: l.domain, domainMode: l.domainMode ?? 'existing' } : {}), ...(l.options ? { options: l.options } : {}) }
}
