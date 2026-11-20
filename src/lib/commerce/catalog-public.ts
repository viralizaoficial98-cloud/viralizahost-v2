import 'server-only'
import { getPool } from '@/lib/db/pool'
import type { Cycle } from './quote'

// Plano para o percurso de compra (/comprar/<slug>). Mesma fonte do carrinho e do checkout.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PurchasePlan {
  slug: string
  name: string
  description: string | null
  category: string
  serviceType: string
  saleStatus: 'active' | 'on_request' | 'draft'
  pricingNote: string | null
  quantityUnit: string | null
  maxQuantity: number
  needsDomain: boolean
  features: string[]
  prices: { cycle: Cycle; months: number; price: number; renewal: number }[]
}

/** Serviços que precisam de domínio (alojamento e e-mail). VPS, dedicados, SSL, … não pedem domínio. */
export const DOMAIN_SERVICES = ['hosting', 'email']

export async function getPurchasePlan(slug: string): Promise<PurchasePlan | null> {
  const db = getPool()
  const [[p]] = await db.query('SELECT id, slug, name, description, category, service_type, sale_status, pricing_note, quantity_unit, max_quantity, active FROM products WHERE slug = ?', [slug]) as any
  if (!p || !p.active || p.sale_status === 'draft') return null
  const [feats] = await db.query('SELECT feature FROM product_features WHERE product_id = ? AND included = 1 ORDER BY position', [p.id]) as any
  const [prices] = p.sale_status === 'active'
    ? await db.query('SELECT cycle, months, price, renewal_price FROM product_prices WHERE product_id = ? AND active = 1 ORDER BY months', [p.id]) as any
    : [[]]
  return {
    slug: p.slug, name: p.name, description: p.description, category: p.category, serviceType: p.service_type ?? 'other',
    saleStatus: p.sale_status, pricingNote: p.pricing_note, quantityUnit: p.quantity_unit, maxQuantity: Number(p.max_quantity ?? 1),
    needsDomain: DOMAIN_SERVICES.includes(p.service_type),
    features: (feats as any[]).map(f => String(f.feature)),
    prices: (prices as any[]).map(r => ({ cycle: r.cycle, months: Number(r.months), price: Number(r.price), renewal: Number(r.renewal_price) })),
  }
}
