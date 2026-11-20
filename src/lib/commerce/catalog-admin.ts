import 'server-only'
import { revalidateTag } from 'next/cache'
import { withTransaction, getPool, type Queryable } from '@/lib/db/pool'

// Edição do catálogo pelo administrador. product_prices / domain_prices são a fonte;
// as colunas de apresentação (products.price_*, site_email_plans, site_domains) são derivadas.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export const CYCLES = ['monthly', '6months', '1year', '2years', '3years'] as const
const MONTHS: Record<string, number> = { monthly: 1, '6months': 6, '1year': 12, '2years': 24, '3years': 36 }

export async function loadCatalog() {
  const db = getPool()
  const [products, prices, domains] = await Promise.all([
    rows(db, `SELECT id, slug, name, category, subcategory, active, sale_status, service_type, provisioning, whm_package, quantity_unit, max_quantity, pricing_note, position
              FROM products ORDER BY category, subcategory, position, name`),
    rows(db, 'SELECT id, product_id, cycle, months, price, renewal_price, active, reference FROM product_prices ORDER BY months'),
    rows(db, 'SELECT id, extension, operation, years, price, status, registrar, reference FROM domain_prices ORDER BY extension, FIELD(operation, "register", "renew", "transfer")'),
  ])
  const parse = (v: unknown) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }
  return {
    products: products.map(p => ({ ...p, active: !!p.active, prices: prices.filter(x => x.product_id === p.id).map(x => ({ ...x, price: Number(x.price), renewal_price: Number(x.renewal_price), active: !!x.active, reference: parse(x.reference) })) })),
    domains: domains.map(d => ({ ...d, price: d.price == null ? null : Number(d.price), reference: parse(d.reference) })),
  }
}

const money = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error('Preço inválido.'); return Math.round(n * 100) / 100 }

export interface ProductPatch {
  sale_status?: 'active' | 'draft' | 'on_request'
  whm_package?: string | null
  pricing_note?: string | null
  prices?: { cycle: string; price: number; renewal_price: number; active: boolean }[]
}

export async function updateProduct(productId: string, patch: ProductPatch) {
  await withTransaction(async conn => {
    const [p] = await rows(conn, 'SELECT id, slug FROM products WHERE id = ? FOR UPDATE', [productId])
    if (!p) throw new Error('Produto inexistente.')
    if (patch.sale_status && !['active', 'draft', 'on_request'].includes(patch.sale_status)) throw new Error('Estado inválido.')
    if (patch.whm_package !== undefined && patch.whm_package && !/^[\w .@-]{1,64}$/.test(patch.whm_package)) throw new Error('Pacote WHM inválido.')
    for (const pr of patch.prices ?? []) {
      if (!(CYCLES as readonly string[]).includes(pr.cycle)) throw new Error('Ciclo inválido.')
      const price = money(pr.price), renewal = money(pr.renewal_price)
      await conn.query(
        `INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, reference)
         VALUES (UUID(), ?, ?, ?, ?, ?, 'AKZ', ?, JSON_OBJECT('edited_by_admin', TRUE))
         ON DUPLICATE KEY UPDATE price = VALUES(price), renewal_price = VALUES(renewal_price), active = VALUES(active),
           reference = IF(price <> VALUES(price) OR renewal_price <> VALUES(renewal_price), JSON_SET(COALESCE(reference, '{}'), '$.edited_by_admin', TRUE), reference)`,
        [productId, pr.cycle, MONTHS[pr.cycle], price, renewal, pr.active ? 1 : 0],
      )
    }
    const [hasPrice] = await rows(conn, 'SELECT COUNT(*) n FROM product_prices WHERE product_id = ? AND active = 1', [productId])
    if (patch.sale_status === 'active' && !Number(hasPrice.n)) throw new Error('Não é possível pôr à venda sem pelo menos um ciclo com preço activo.')
    const sets: string[] = [], params: unknown[] = []
    if (patch.sale_status) { sets.push('sale_status = ?'); params.push(patch.sale_status) }
    if (patch.whm_package !== undefined) { sets.push('whm_package = ?'); params.push(patch.whm_package || null) }
    if (patch.pricing_note !== undefined) { sets.push('pricing_note = ?'); params.push(patch.pricing_note?.slice(0, 500) || null) }
    if (sets.length) await conn.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...params, productId])
    await syncDisplay(conn, productId, p.slug)
  })
  revalidateTag('catalog', { expire: 0 })
}

async function syncDisplay(conn: Queryable, productId: string, slug: string) {
  const pp = await rows(conn, 'SELECT cycle, months, price FROM product_prices WHERE product_id = ? AND active = 1', [productId])
  const per = (c: string) => { const r = pp.find(x => x.cycle === c); return r ? Math.round(Number(r.price) / Number(r.months) * 100) / 100 : null }
  await conn.query('UPDATE products SET price_monthly = ?, price_6months = ?, price_1year = ?, price_2years = ?, price_3years = ? WHERE id = ?',
    [per('monthly'), per('6months'), per('1year'), per('2years'), per('3years'), productId])
  const m = per('monthly')
  if (m != null) await conn.query('UPDATE site_email_plans SET price_monthly = ?, price_annual = ?, discount_annual = 0 WHERE slug = ?', [m, m, slug])
}

export async function updateDomainPrice(id: string, patch: { price: number | null; status: 'active' | 'draft' | 'on_request' }) {
  if (!['active', 'draft', 'on_request'].includes(patch.status)) throw new Error('Estado inválido.')
  const price = patch.price == null || (patch.price as unknown) === '' ? null : money(patch.price)
  if (patch.status === 'active' && price == null) throw new Error('Domínio à venda precisa de preço.')
  await withTransaction(async conn => {
    const [d] = await rows(conn, 'SELECT extension, operation, years FROM domain_prices WHERE id = ? FOR UPDATE', [id])
    if (!d) throw new Error('Preço de domínio inexistente.')
    await conn.query("UPDATE domain_prices SET price = ?, status = ?, reference = JSON_SET(COALESCE(reference, '{}'), '$.edited_by_admin', TRUE) WHERE id = ?", [price, patch.status, id])
    if (d.operation === 'register' && Number(d.years) === 1 && price != null) {
      await conn.query('UPDATE site_domains SET price_annual = ?, price_monthly = ? WHERE extension = ?', [price, Math.round(price / 12), d.extension])
    }
  })
  revalidateTag('catalog', { expire: 0 })
}
