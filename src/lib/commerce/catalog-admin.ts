import 'server-only'
import { revalidateTag } from 'next/cache'
import { withTransaction, getPool, type Queryable } from '@/lib/db/pool'

// Edição do catálogo pelo administrador. product_prices / domain_prices são a fonte;
// as colunas de apresentação (products.price_*, site_email_plans) são derivadas; domínios: domain_prices + domain_extensions.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export const CYCLES = ['monthly', '3months', '6months', '1year', '2years', '3years'] as const
const MONTHS: Record<string, number> = { monthly: 1, '3months': 3, '6months': 6, '1year': 12, '2years': 24, '3years': 36 }

export async function loadCatalog() {
  const db = getPool()
  const [products, prices, domains] = await Promise.all([
    rows(db, `SELECT id, slug, name, category, subcategory, active, sale_status, service_type, provisioning, whm_package, quantity_unit, max_quantity, pricing_note, position
              FROM products ORDER BY category, subcategory, position, name`),
    rows(db, 'SELECT id, product_id, cycle, months, price, renewal_price, active, reference FROM product_prices ORDER BY months'),
    rows(db, 'SELECT id, extension, operation, years, price, status, registrar, reference FROM domain_prices ORDER BY extension, FIELD(operation, "register", "renew", "transfer")'),
  ])
  const meta = await rows(db, 'SELECT extension, description, featured, featured_position, badge, badge_text, highlight, updated_at FROM domain_extensions').catch(() => [] as any[])
  const parse = (v: unknown) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }
  return {
    products: products.map(p => ({ ...p, active: !!p.active, prices: prices.filter(x => x.product_id === p.id).map(x => ({ ...x, price: Number(x.price), renewal_price: Number(x.renewal_price), active: !!x.active, reference: parse(x.reference) })) })),
    domains: domains.map(d => ({ ...d, price: d.price == null ? null : Number(d.price), reference: parse(d.reference) })),
    // Uma linha por extensão: preços de domain_prices (1 ano) + apresentação de domain_extensions
    extensions: [...new Set(domains.map(d => d.extension))].map(ext => {
      const op = (o: string) => domains.find(d => d.extension === ext && d.operation === o && Number(d.years) === 1)
      const m = meta.find(x => x.extension === ext)
      const num = (v: any) => (v == null ? null : Number(v))
      return {
        extension: ext, sale: (op('register')?.status ?? 'draft') as ExtensionSale,
        register: num(op('register')?.price), renew: num(op('renew')?.price), transfer: num(op('transfer')?.price),
        description: m?.description ?? null, featured: !!m?.featured, position: Number(m?.featured_position ?? 999),
        badge: (m?.badge ?? 'none') as Badge, badgeText: m?.badge_text ?? null, highlight: !!m?.highlight,
      }
    }).sort((a, b) => Number(b.featured) - Number(a.featured) || a.position - b.position || a.extension.localeCompare(b.extension)),
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
    const [p] = await rows(conn, 'SELECT id, slug, category, subcategory FROM products WHERE id = ? FOR UPDATE', [productId])
    if (!p) throw new Error('Produto inexistente.')
    // E-mail: preços só pelo preço base + descontos (email-plans.ts), para manter a regra de arredondamento.
    if (p.category === 'email' && patch.prices?.length) throw new Error('Os preços dos planos de e-mail editam-se na ficha do plano (preço base e descontos por período).')
    // Hospedagem Premium: os 4 períodos públicos só pela ficha do plano (preço base e desconto); os restantes ciclos continuam aqui.
    // Servidor VPS (sem subcategoria): preços e custos do fornecedor só pela ficha do plano (Catálogo → VPS)
    if (p.category === 'vps' && !p.subcategory && patch.prices?.length) throw new Error('Os preços dos planos VPS editam-se na ficha do plano (preço base e desconto por ciclo).')
    if ((p.category === 'dedicated' || p.category === 'dedicated-windows') && patch.prices?.length) throw new Error('Os preços dos servidores dedicados editam-se na ficha do plano (preço base e desconto por período).')
    if (p.category === 'hosting' && patch.prices?.some(x => ['monthly', '1year', '2years', '3years'].includes(x.cycle))) throw new Error('Os preços de 1 mês, 1, 2 e 3 anos da hospedagem editam-se na ficha do plano (preço base e desconto por período).')
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

export async function syncDisplay(conn: Queryable, productId: string, slug: string) {
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
  })
  revalidateTag('catalog', { expire: 0 })
}

/** Nova extensão: registo, renovação e transferência em rascunho (sem preço) até a equipa publicar. */
export async function createExtension(extRaw: string) {
  const ext = normalizeExtensionInput(extRaw)
  await withTransaction(async conn => {
    const [ex] = await rows(conn, 'SELECT 1 FROM domain_prices WHERE extension = ? LIMIT 1', [ext])
    if (ex) throw new Error('Essa extensão já existe no catálogo.')
    for (const op of ['register', 'renew', 'transfer']) {
      await conn.query("INSERT INTO domain_prices (id, extension, operation, years, price, currency, status, reference) VALUES (UUID(), ?, ?, 1, NULL, 'AKZ', 'draft', JSON_OBJECT('created_by_admin', TRUE))", [ext, op])
    }
    // Apresentação: fora do destaque até o administrador a escolher
    await conn.query('INSERT IGNORE INTO domain_extensions (extension, featured, featured_position) SELECT ?, 0, COALESCE(MAX(featured_position), 0) + 1 FROM domain_extensions', [ext])
  })
  revalidateTag('catalog', { expire: 0 })
  return ext
}

/* ───────────── Extensões de domínio: oferta comercial e cartões da página inicial ─────────────
 * Preços: SÓ em domain_prices (registo/renovação/transferência, 1 ano, Kz). Apresentação: domain_extensions.
 * «À venda» controla o registo e a transferência; a renovação mantém-se para quem já tem o domínio.
 * Activar uma extensão NÃO a automatiza no registrador nem garante disponibilidade dos nomes:
 * a disponibilidade é verificada na pesquisa/encomenda e o registo segue a configuração do fornecedor. */

export const BADGES = ['none', 'popular', 'promo', 'new', 'custom'] as const
export type Badge = (typeof BADGES)[number]
export type ExtensionSale = 'active' | 'on_request' | 'draft'

/** «.CO.AO», «co.ao», « .shop » → «.co.ao» / «.shop». Lança erro se não for uma extensão válida. */
export function normalizeExtensionInput(raw: unknown): string {
  const ext = String(raw ?? '').normalize('NFKC').trim().toLowerCase().replace(/^\.*/, '.')
  // 1 a 3 rótulos (ex.: .com, .co.ao, .gov.co.ao): 2–24 caracteres alfanuméricos/hífen interior; o último só
  // letras (ou IDN «xn--»), a mesma regra dos domínios aceites na pesquisa e no carrinho
  const labels = ext.split('.').slice(1)
  if (!/^(\.[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])){1,3}$/.test(ext) || labels.some(l => l.length < 2) || !/^([a-z]{2,24}|xn--[a-z0-9-]{1,20})$/.test(labels[labels.length - 1])) {
    throw new Error('Extensão inválida (ex.: .ao, .co.ao, .com, .shop).')
  }
  return ext
}

export interface ExtensionPatch {
  sale?: ExtensionSale
  description?: string | null
  register?: number | null
  renew?: number | null
  transfer?: number | null
  featured?: boolean
  badge?: Badge
  badgeText?: string | null
  highlight?: boolean
}

const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

export async function updateExtension(extRaw: unknown, patch: ExtensionPatch, adminId: string) {
  const ext = normalizeExtensionInput(extRaw)
  if (patch.sale !== undefined && !['active', 'on_request', 'draft'].includes(patch.sale)) throw new Error('Estado de venda inválido.')
  if (patch.badge !== undefined && !(BADGES as readonly string[]).includes(patch.badge)) throw new Error('Etiqueta inválida.')
  const badgeText = patch.badge === 'custom' ? cleanText(patch.badgeText, 20) : null
  if (patch.badge === 'custom' && badgeText!.length < 2) throw new Error('Escreva a etiqueta personalizada (2 a 20 caracteres).')
  const description = patch.description === undefined ? undefined : cleanText(patch.description, 80) || null
  const price = (v: unknown) => (v === null || v === '' || v === undefined ? null : money(v))
  await withTransaction(async conn => {
    const ops = await rows(conn, 'SELECT id, operation, price, status FROM domain_prices WHERE extension = ? AND years = 1 FOR UPDATE', [ext])
    if (!ops.length) throw new Error('Extensão inexistente no catálogo.')
    const byOp = Object.fromEntries(ops.map(o => [o.operation, o]))
    const next: Record<string, number | null> = {
      register: patch.register !== undefined ? price(patch.register) : byOp.register?.price == null ? null : Number(byOp.register.price),
      renew: patch.renew !== undefined ? price(patch.renew) : byOp.renew?.price == null ? null : Number(byOp.renew.price),
      transfer: patch.transfer !== undefined ? price(patch.transfer) : byOp.transfer?.price == null ? null : Number(byOp.transfer.price),
    }
    const sale: ExtensionSale = patch.sale ?? (byOp.register?.status ?? 'draft')
    if (sale === 'active' && (next.register == null || !(next.register > 0))) throw new Error('Para pôr à venda indique o preço de registo do 1.º ano.')
    if (sale === 'active' && (next.renew == null || !(next.renew > 0))) throw new Error('Para pôr à venda indique o preço de renovação.')
    for (const op of ['register', 'renew', 'transfer'] as const) {
      // Renovação fica activa sempre que tem preço (clientes existentes renovam mesmo com a extensão fora de venda)
      const status = op === 'renew' ? (next.renew != null ? 'active' : 'draft') : op === 'transfer' ? (sale === 'active' && next.transfer != null ? 'active' : sale === 'on_request' ? 'on_request' : 'draft') : sale
      if (byOp[op]) {
        await conn.query(`UPDATE domain_prices SET price = ?, status = ?, reference = IF(price <=> ? AND status = ?, reference, JSON_SET(COALESCE(reference, '{}'), '$.edited_by_admin', TRUE)) WHERE id = ?`,
          [next[op], status, next[op], status, byOp[op].id])
      } else {
        await conn.query("INSERT INTO domain_prices (id, extension, operation, years, price, currency, status, reference) VALUES (UUID(), ?, ?, 1, ?, 'AKZ', ?, JSON_OBJECT('created_by_admin', TRUE))", [ext, op, next[op], status])
      }
    }
    await conn.query('INSERT IGNORE INTO domain_extensions (extension, featured_position) SELECT ?, COALESCE(MAX(featured_position), 0) + 1 FROM domain_extensions', [ext])
    const sets: string[] = ['updated_by = ?'], params: unknown[] = [adminId]
    if (description !== undefined) { sets.push('description = ?'); params.push(description) }
    if (patch.featured !== undefined) {
      const [cur] = await rows(conn, 'SELECT featured FROM domain_extensions WHERE extension = ? FOR UPDATE', [ext])
      sets.push('featured = ?'); params.push(patch.featured ? 1 : 0)
      // Passa a destaque → entra no fim da lista de cartões
      if (patch.featured && !Number(cur?.featured)) {
        const [mx] = await rows(conn, 'SELECT COALESCE(MAX(featured_position), 0) AS p FROM domain_extensions WHERE featured = 1')
        sets.push('featured_position = ?'); params.push(Number(mx.p) + 1)
      }
    }
    if (patch.badge !== undefined) { sets.push('badge = ?', 'badge_text = ?'); params.push(patch.badge, badgeText) }
    if (patch.highlight !== undefined) { sets.push('highlight = ?'); params.push(patch.highlight ? 1 : 0) }
    await conn.query(`UPDATE domain_extensions SET ${sets.join(', ')} WHERE extension = ?`, [...params, ext])
  })
  revalidateTag('catalog', { expire: 0 })
  return ext
}

/** Ordem dos cartões: lista de extensões em destaque, pela ordem pretendida. */
export async function reorderFeatured(list: unknown, adminId: string) {
  if (!Array.isArray(list) || !list.length || list.length > 50) throw new Error('Ordem inválida.')
  const exts = list.map(normalizeExtensionInput)
  if (new Set(exts).size !== exts.length) throw new Error('Extensões repetidas na ordem.')
  await withTransaction(async conn => {
    const featured = (await rows(conn, 'SELECT extension FROM domain_extensions WHERE featured = 1 FOR UPDATE')).map(r => r.extension)
    const missing = featured.filter(e => !exts.includes(e)), extra = exts.filter(e => !featured.includes(e))
    if (missing.length || extra.length) throw new Error('A ordem tem de incluir exactamente as extensões em destaque (recarregue a página).')
    for (const [i, e] of exts.entries()) await conn.query('UPDATE domain_extensions SET featured_position = ?, updated_by = ? WHERE extension = ?', [i + 1, adminId, e])
  })
  revalidateTag('catalog', { expire: 0 })
}
