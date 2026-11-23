import 'server-only'
import { randomUUID } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { EMAIL_PERIODS, MAX_DISCOUNT, periodTotal } from './period-pricing'
import { syncDisplay } from './catalog-admin'

// Planos de E-mail Corporativo (Catálogo e Preços → E-mail Corporativo).
// Ficha: nome, descrição, armazenamento por caixa, limite de envio, características, etiqueta, ordem.
// Preços: preço mensal base + desconto por período → product_prices (total por caixa), regra única em
// period-pricing.ts. Renovação: base × meses, salvo desconto de renovação configurado.
// Armazenamento e limite de envio são INFORMATIVOS: a quota técnica é a do pacote WHM do plano.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
export class EmailPlanError extends Error { constructor(message: string, public field?: string) { super(message) } }

export interface EmailPlanPeriod { cycle: string; months: number; discount: number; renewalDiscount: number; price: number; renewal: number; active: boolean }
export interface EmailPlan {
  id: string; slug: string; name: string; description: string | null; storageGb: number | null; sendLimitHour: number | null
  features: string[]; badge: string | null; position: number; saleStatus: 'active' | 'draft' | 'on_request'; baseMonthly: number | null
  whmPackage: string | null; maxQuantity: number; periods: EmailPlanPeriod[]
}

export async function loadEmailPlans(db: Queryable = getPool()): Promise<EmailPlan[]> {
  const prods = await rows(db, "SELECT id, slug, name, description, storage_gb, send_limit_hour, badge, position, sale_status, base_monthly_price, whm_package, max_quantity FROM products WHERE category = 'email' AND active = 1 ORDER BY position, name")
  if (!prods.length) return []
  const ids = prods.map(p => p.id)
  const feats = await rows(db, `SELECT product_id, feature FROM product_features WHERE included = 1 AND product_id IN (${ids.map(() => '?').join(',')}) ORDER BY position`, ids)
  const prices = await rows(db, `SELECT product_id, cycle, months, price, renewal_price, discount_pct, renewal_discount_pct, active FROM product_prices WHERE product_id IN (${ids.map(() => '?').join(',')})`, ids)
  return prods.map(p => ({
    id: p.id, slug: p.slug, name: p.name, description: p.description ?? null, storageGb: p.storage_gb == null ? null : Number(p.storage_gb),
    sendLimitHour: p.send_limit_hour == null ? null : Number(p.send_limit_hour), features: feats.filter(f => f.product_id === p.id).map(f => String(f.feature)),
    badge: p.badge ?? null, position: Number(p.position ?? 0), saleStatus: p.sale_status, baseMonthly: p.base_monthly_price == null ? null : Number(p.base_monthly_price),
    whmPackage: p.whm_package ?? null, maxQuantity: Number(p.max_quantity ?? 100),
    periods: EMAIL_PERIODS.map(per => {
      const r = prices.find(x => x.product_id === p.id && x.cycle === per.cycle)
      return { cycle: per.cycle, months: per.months, discount: Number(r?.discount_pct ?? 0), renewalDiscount: Number(r?.renewal_discount_pct ?? 0),
        price: r ? Number(r.price) : 0, renewal: r ? Number(r.renewal_price) : 0, active: !!r && !!Number(r.active) }
    }),
  }))
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const int = (v: unknown, field: string, min: number, max: number, label: string, optional = true): number | null => {
  if (optional && (v === null || v === undefined || v === '')) return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new EmailPlanError(`${label}: indique um número inteiro entre ${min} e ${max}.`, field)
  return n
}
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export interface EmailPlanInput {
  id?: string; name: unknown; description?: unknown; storageGb?: unknown; sendLimitHour?: unknown; features?: unknown; badge?: unknown
  position?: unknown; saleStatus?: unknown; baseMonthly: unknown; periods?: { cycle: unknown; discount?: unknown; renewalDiscount?: unknown }[]
}

/** Cria (sem id) ou actualiza um plano de e-mail. Valores calculados e validados aqui, no servidor. */
export async function saveEmailPlan(input: EmailPlanInput): Promise<string> {
  const name = text(input.name, 80)
  if (name.length < 2) throw new EmailPlanError('Indique o nome do plano.', 'name')
  const description = text(input.description, 160) || null
  const storageGb = int(input.storageGb, 'storageGb', 1, 100000, 'Armazenamento (GB por caixa)')
  const sendLimitHour = int(input.sendLimitHour, 'sendLimitHour', 1, 1000000, 'Limite de envio por hora')
  const position = int(input.position ?? 0, 'position', 0, 9999, 'Ordem', false)!
  const badge = text(input.badge, 24) || null
  const saleStatus = String(input.saleStatus ?? 'draft')
  if (!['active', 'draft', 'on_request'].includes(saleStatus)) throw new EmailPlanError('Estado de venda inválido.', 'saleStatus')
  const featuresRaw = Array.isArray(input.features) ? input.features : []
  if (featuresRaw.length > 20) throw new EmailPlanError('No máximo 20 características.', 'features')
  const features = featuresRaw.map(f => text(f, 120)).filter(Boolean)
  const base = Number(input.baseMonthly)
  if (!Number.isFinite(base) || base <= 0 || base > 10_000_000 || Math.round(base * 100) !== base * 100) throw new EmailPlanError('Preço mensal base inválido (Kz, até 2 casas decimais).', 'baseMonthly')
  const per = new Map((input.periods ?? []).map(p => [String(p.cycle), p]))
  const periods = EMAIL_PERIODS.map(p => {
    const raw: { discount?: unknown; renewalDiscount?: unknown } = per.get(p.cycle) ?? {}
    const discount = int(raw.discount ?? 0, `discount-${p.cycle}`, 0, MAX_DISCOUNT, `Desconto (${p.label})`, false)!
    const renewalDiscount = int(raw.renewalDiscount ?? 0, `renewal-${p.cycle}`, 0, MAX_DISCOUNT, `Desconto na renovação (${p.label})`, false)!
    return { ...p, discount, renewalDiscount, price: periodTotal(base, p.months, discount), renewal: periodTotal(base, p.months, renewalDiscount) }
  })
  if (periods.some(p => p.price <= 0)) throw new EmailPlanError('O desconto deixa um período sem preço.', 'periods')

  const id = await withTransaction(async conn => {
    let pid = input.id ? String(input.id) : ''
    if (pid) {
      const [p] = await rows(conn, "SELECT id FROM products WHERE id = ? AND category = 'email' FOR UPDATE", [pid])
      if (!p) throw new EmailPlanError('Plano de e-mail inexistente.')
      await conn.query(`UPDATE products SET name = ?, description = ?, storage_gb = ?, send_limit_hour = ?, badge = ?, popular = ?, position = ?, sale_status = ?, base_monthly_price = ? WHERE id = ?`,
        [name, description, storageGb, sendLimitHour, badge, badge ? 1 : 0, position, saleStatus, base, pid])
    } else {
      let slug = `email-${slugify(name).replace(/^email-/, '')}` || `email-${Date.now()}`
      const [dup] = await rows(conn, 'SELECT id FROM products WHERE slug = ?', [slug])
      if (dup) slug = `${slug}-${randomUUID().slice(0, 4)}`
      const [n] = await rows(conn, "SELECT id FROM products WHERE category = 'email' AND LOWER(name) = LOWER(?)", [name])
      if (n) throw new EmailPlanError('Já existe um plano de e-mail com esse nome.', 'name')
      pid = randomUUID()
      // Novo plano: activação manual até ser definido o pacote WHM (Integrações → WHM/cPanel)
      await conn.query(`INSERT INTO products (id, slug, category, name, description, storage_gb, send_limit_hour, badge, popular, active, position, sale_status, base_monthly_price,
          service_type, provisioning, quantity_unit, max_quantity, currency) VALUES (?, ?, 'email', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'email', 'whm', 'caixa', 100, 'AOA')`,
        [pid, slug, name, description, storageGb, sendLimitHour, badge, badge ? 1 : 0, position, saleStatus, base])
    }
    await conn.query('DELETE FROM product_features WHERE product_id = ?', [pid])
    for (const [i, f] of features.entries()) await conn.query('INSERT INTO product_features (id, product_id, feature, included, position) VALUES (?, ?, ?, 1, ?)', [randomUUID(), pid, f, i + 1])
    for (const p of periods) {
      await conn.query(`INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, discount_pct, renewal_discount_pct, reference)
          VALUES (UUID(), ?, ?, ?, ?, ?, 'AKZ', 1, ?, ?, JSON_OBJECT('edited_by_admin', TRUE))
        ON DUPLICATE KEY UPDATE price = VALUES(price), renewal_price = VALUES(renewal_price), active = 1, discount_pct = VALUES(discount_pct), renewal_discount_pct = VALUES(renewal_discount_pct),
          reference = JSON_SET(COALESCE(reference, '{}'), '$.edited_by_admin', TRUE)`,
      [pid, p.cycle, p.months, p.price, p.renewal, p.discount, p.renewalDiscount])
    }
    // A oferta de e-mail tem 4 períodos (1 mês, 1, 2 e 3 anos): os restantes ciclos deixam de ser vendidos
    await conn.query(`UPDATE product_prices SET active = 0 WHERE product_id = ? AND cycle NOT IN (${EMAIL_PERIODS.map(() => '?').join(',')})`, [pid, ...EMAIL_PERIODS.map(p => p.cycle)])
    const [slugRow] = await rows(conn, 'SELECT slug FROM products WHERE id = ?', [pid])
    await syncDisplay(conn, pid, slugRow.slug)
    return pid
  })
  revalidateTag('catalog', { expire: 0 })
  return id
}
