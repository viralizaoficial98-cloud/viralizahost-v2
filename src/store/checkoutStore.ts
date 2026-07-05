'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BillingCycle = 'monthly' | '6months' | '1year' | '2years' | '3years'

export const BILLING_LABEL: Record<BillingCycle, string> = {
  monthly:   'Mensal',
  '6months': '6 Meses',
  '1year':   '1 Ano',
  '2years':  '2 Anos',
  '3years':  '3 Anos',
}

export const BILLING_DISCOUNT: Record<BillingCycle, number> = {
  monthly:   0,
  '6months': 0.15,
  '1year':   0.30,
  '2years':  0.45,
  '3years':  0.55,
}

export const BILLING_MONTHS: Record<BillingCycle, number> = {
  monthly:   1,
  '6months': 6,
  '1year':   12,
  '2years':  24,
  '3years':  36,
}

export type ServiceType = 'hosting' | 'email' | 'domain' | 'vps' | 'dedicated' | 'reseller' | 'other'

export interface CheckoutItem {
  id: string
  name: string
  type: ServiceType
  price: number
  currency: 'AOA' | 'BRL' | 'USD'
  quantity: number
}

interface UserData {
  name: string
  email: string
  phone: string
  password: string
}

interface CheckoutState {
  step: number

  // Cart
  items: CheckoutItem[]
  billingCycle: BillingCycle

  // Domain
  domainAction: 'register' | 'existing' | null
  domainName: string

  // Identification
  userData: UserData

  // Payment
  paymentMethod: 'pix' | 'card' | 'paypal' | 'bic_transfer' | null
  proofFileUrl: string | null
  transferRef: string

  // Actions
  setStep: (step: number) => void
  setItems: (items: CheckoutItem[]) => void
  addItem: (item: CheckoutItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, qty: number) => void
  setBillingCycle: (cycle: BillingCycle) => void
  setDomainAction: (action: 'register' | 'existing' | null) => void
  setDomainName: (name: string) => void
  setUserData: (data: Partial<UserData>) => void
  setPaymentMethod: (method: CheckoutState['paymentMethod']) => void
  setProofFileUrl: (url: string | null) => void
  setTransferRef: (ref: string) => void
  clear: () => void
  getTotal: () => number
}

const defaultUserData: UserData = { name: '', email: '', phone: '', password: '' }

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      step: 1,
      items: [],
      billingCycle: '1year',
      domainAction: null,
      domainName: '',
      userData: defaultUserData,
      paymentMethod: null,
      proofFileUrl: null,
      transferRef: '',

      setStep: (step) => set({ step }),
      setItems: (items) => set({ items }),
      addItem: (item) => set((s) => {
        const existing = s.items.find(i => i.id === item.id)
        if (existing) return { items: s.items.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i) }
        return { items: [...s.items, item] }
      }),
      removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
      updateQuantity: (id, qty) => set((s) => ({
        items: qty < 1 ? s.items.filter(i => i.id !== id) : s.items.map(i => i.id === id ? { ...i, quantity: qty } : i),
      })),
      setBillingCycle: (billingCycle) => set({ billingCycle }),
      setDomainAction: (domainAction) => set({ domainAction }),
      setDomainName: (domainName) => set({ domainName }),
      setUserData: (data) => set((s) => ({ userData: { ...s.userData, ...data } })),
      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setProofFileUrl: (proofFileUrl) => set({ proofFileUrl }),
      setTransferRef: (transferRef) => set({ transferRef }),
      clear: () => set({
        step: 1, items: [], billingCycle: '1year',
        domainAction: null, domainName: '',
        userData: defaultUserData, paymentMethod: null,
        proofFileUrl: null, transferRef: '',
      }),

      getTotal: () => {
        const { items, billingCycle } = get()
        const domainYears: Record<BillingCycle, number> = { monthly: 1, '6months': 1, '1year': 1, '2years': 2, '3years': 3 }
        const domainDiscount: Record<BillingCycle, number> = { monthly: 0, '6months': 0, '1year': 0, '2years': 0.10, '3years': 0.15 }
        return items.reduce((acc, item) => {
          if (item.type === 'domain') {
            return acc + item.price * item.quantity * domainYears[billingCycle] * (1 - domainDiscount[billingCycle])
          }
          return acc + item.price * item.quantity * BILLING_MONTHS[billingCycle] * (1 - BILLING_DISCOUNT[billingCycle])
        }, 0)
      },
    }),
    { name: 'viralizahost-checkout' }
  )
)
