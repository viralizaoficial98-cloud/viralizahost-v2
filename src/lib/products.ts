import { createClient } from '@/lib/supabase/client'

export type BillingCycle = 'monthly' | '6months' | '1year' | '2years' | '3years'

export const BILLING_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  '6months': '6 Meses',
  '1year': 'Anual',
  '2years': '2 Anos',
  '3years': '3 Anos',
}

export const BILLING_DISCOUNTS: Record<BillingCycle, number> = {
  monthly: 0,
  '6months': 15,
  '1year': 30,
  '2years': 45,
  '3years': 55,
}

export type Product = {
  id: string
  slug: string
  category: string
  name: string
  description: string | null
  badge: string | null
  popular: boolean
  active: boolean
  position: number
  price_monthly: number | null
  price_6months: number | null
  price_1year: number | null
  price_2years: number | null
  price_3years: number | null
  color: string | null
  href_override: string | null
  features?: { feature: string; included: boolean; position: number }[]
}

export function getPriceForCycle(product: Product, cycle: BillingCycle): number | null {
  switch (cycle) {
    case 'monthly':   return product.price_monthly ?? null
    case '6months':   return product.price_6months ?? (product.price_monthly ? Math.round(product.price_monthly * 0.85) : null)
    case '1year':     return product.price_1year   ?? (product.price_monthly ? Math.round(product.price_monthly * 0.70) : null)
    case '2years':    return product.price_2years  ?? (product.price_monthly ? Math.round(product.price_monthly * 0.55) : null)
    case '3years':    return product.price_3years  ?? (product.price_monthly ? Math.round(product.price_monthly * 0.45) : null)
  }
}

export function formatKz(v: number): string {
  return `Kz ${v.toLocaleString('pt-AO')}`
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  return data ?? null
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('*, product_features(feature, included, position)')
    .eq('category', category)
    .eq('active', true)
    .order('position', { ascending: true })
  return (data ?? []) as Product[]
}

