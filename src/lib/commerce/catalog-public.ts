import 'server-only'
import { isVpsCycleForSale } from './vps-shared'
import { getPool } from '@/lib/db/pool'
import type { Cycle } from './quote'
import { EMAIL_PERIODS } from './period-pricing'
import { familyOf, isFamilyCycleForSale } from './plan-families'

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
  prices: { cycle: Cycle; months: number; price: number; renewal: number; discount: number; renewalDiscount: number }[]
  /** Preço mensal base por unidade (sem desconto), quando o plano usa descontos por período (e-mail). */
  baseMonthly: number | null
  storageGb: number | null
  sendLimitHour: number | null
  badge: string | null
  /** Servidor VPS: localização e instalação são carregadas no navegador (GET /api/catalog/vps-options?plano=slug). */
  isVps: boolean
}

/** Serviços que precisam de domínio (alojamento e e-mail). VPS, dedicados, SSL, … não pedem domínio. */
export const DOMAIN_SERVICES = ['hosting', 'email', 'reseller']

export async function getPurchasePlan(slug: string): Promise<PurchasePlan | null> {
  const db = getPool()
  const [[p]] = await db.query('SELECT id, slug, name, description, category, subcategory, service_type, sale_status, pricing_note, quantity_unit, max_quantity, active, base_monthly_price, storage_gb, send_limit_hour, badge FROM products WHERE slug = ?', [slug]) as any
  if (!p || !p.active || p.sale_status === 'draft') return null
  const [feats] = await db.query('SELECT feature FROM product_features WHERE product_id = ? AND included = 1 ORDER BY position', [p.id]) as any
  const [prices] = p.sale_status === 'active'
    ? await db.query('SELECT cycle, months, price, renewal_price, discount_pct, renewal_discount_pct FROM product_prices WHERE product_id = ? AND active = 1 ORDER BY months', [p.id]) as any
    : [[]]
  return {
    slug: p.slug, name: p.name, description: p.description, category: p.category, serviceType: p.service_type ?? 'other',
    saleStatus: p.sale_status, pricingNote: p.pricing_note, quantityUnit: p.quantity_unit, maxQuantity: Number(p.max_quantity ?? 1),
    needsDomain: DOMAIN_SERVICES.includes(p.service_type),
    features: (feats as any[]).map(f => String(f.feature)),
    // E-mail Corporativo: oferta em 4 períodos (1 mês, 1, 2 e 3 anos)
    // Servidor VPS: só os ciclos à venda (3 meses retirado)
    // Revenda (mensal, trimestral, semestral, anual), Criador de Sites e Construtor WordPress (1 mês, 1, 2 e 3 anos)
    prices: (prices as any[]).filter(r => (p.category !== 'email' || EMAIL_PERIODS.some(x => x.cycle === r.cycle)) && (p.category !== 'vps' || p.subcategory || isVpsCycleForSale(r.cycle))
        && (!familyOf(p.category, p.subcategory) || isFamilyCycleForSale(r.cycle, familyOf(p.category, p.subcategory))))
      .map(r => ({ cycle: r.cycle, months: Number(r.months), price: Number(r.price), renewal: Number(r.renewal_price), discount: Number(r.discount_pct ?? 0), renewalDiscount: Number(r.renewal_discount_pct ?? 0) })),
    baseMonthly: p.base_monthly_price == null ? null : Number(p.base_monthly_price),
    storageGb: p.storage_gb == null ? null : Number(p.storage_gb), sendLimitHour: p.send_limit_hour == null ? null : Number(p.send_limit_hour), badge: p.badge ?? null,
    isVps: p.category === 'vps' && !p.subcategory,
  }
}
