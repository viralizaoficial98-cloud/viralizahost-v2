'use client'
import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useCart, type Cycle } from '@/store/cartStore'
import { PLAN_CATALOG } from '@/lib/checkout/catalog'
import { useCartHydrated } from '@/components/checkout/shared'

// Endereço antigo do checkout. Mantém os links existentes (?plan=, ?domain=, ?renew=, ?renew_domain=):
// junta o item ao carrinho e abre /carrinho, onde a compra continua.
const LEGACY_BILLING: Record<string, Cycle> = { monthly: 'monthly', mensal: 'monthly', '3months': '3months', quarterly: '3months', trimestral: '3months', '6months': '6months', semiannual: '6months', '1year': '1year', annual: '1year', anual: '1year', '2years': '2years', '3years': '3years' }

function LegacyCheckout() {
  const router = useRouter()
  const params = useSearchParams()
  const hydrated = useCartHydrated()
  const done = useRef(false)
  useEffect(() => {
    if (!hydrated || done.current) return
    done.current = true
    const cart = useCart.getState()
    const plan = params.get('plan'), domain = params.get('domain')
    const renew = params.get('renew'), renewDomain = params.get('renew_domain')
    if (renew && /^[0-9a-f-]{36}$/i.test(renew)) cart.addRenewal(renew)
    if (renewDomain) cart.addDomain(renewDomain, 'renew')
    if (plan && !plan.startsWith('domain')) cart.addProduct(PLAN_CATALOG[plan]?.id ?? plan, LEGACY_BILLING[params.get('billing') ?? ''] ?? 'monthly')
    if (domain) { router.replace(`/dominios/configurar?dominio=${encodeURIComponent(domain)}`); return }
    router.replace('/carrinho')
  }, [hydrated, params, router])
  return <div className="flex items-center justify-center min-h-[60vh]" role="status"><Loader2 className="animate-spin text-[#F5B700]" /><span className="sr-only">A abrir o carrinho…</span></div>
}

export default function CheckoutPage() {
  return <Suspense><LegacyCheckout /></Suspense>
}
