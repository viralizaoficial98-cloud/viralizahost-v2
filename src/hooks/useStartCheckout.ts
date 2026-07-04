'use client'
import { useRouter } from 'next/navigation'
import { useCheckoutStore, type CheckoutItem } from '@/store/checkoutStore'

export type CheckoutService = Omit<CheckoutItem, 'quantity'>

export function useStartCheckout() {
  const router = useRouter()
  const { setItems, setStep } = useCheckoutStore()

  return function startCheckout(service: CheckoutService) {
    setItems([{ ...service, quantity: 1 }])
    setStep(1)
    router.push(`/checkout?plan=${encodeURIComponent(service.id)}`)
  }
}
