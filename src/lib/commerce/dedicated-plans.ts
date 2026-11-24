import 'server-only'
import { randomUUID } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { MAX_DISCOUNT, exactPeriodTotal, matchesRule } from './period-pricing'
import { syncDisplay } from './catalog-admin'
import { isVpsIcon, type VpsFeature } from './vps-shared'
import { DEDICATED_CYCLES, DEDICATED_KINDS, DedicatedSpecError, validateDedicatedSpecs, type DedicatedKind, type DedicatedSpecs } from './dedicated-shared'
import { vpsImageUrl } from './vps-plans'

// Catálogo e Preços → Dedicado Linux / Dedicado Windows (categorias «dedicated» e «dedicated-windows»).
// Ficha em products.plan_specs, imagem em products.image_path, características com ícone (lista controlada dos VPS)
// em product_features.icon; preço base + desconto por ciclo (exactPeriodTotal), como os VPS. SEM associação a
// fornecedor: provisioning = 'manual' (a activação de dedicados é feita pela equipa depois do pagamento validado).

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
export class DedicatedPlanError extends Error { constructor(message: string, public field?: string) { super(message) } }

export interface DedicatedPeriod { cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null; discount: number; matchesRule: boolean }
export interface DedicatedPlan {
  id: string; slug: string; kind: DedicatedKind; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'; position: number
  badge: string | null; highlight: boolean; baseMonthly: number | null; imageUrl: string | null; specs: DedicatedSpecs; features: VpsFeature[]; periods: DedicatedPeriod[]
}
const json = (v: unknown) => { if (!v) return null; try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }

export async function loadDedicatedPlans(kind: DedicatedKind, db: Queryable = getPool()): Promise<DedicatedPlan[]> {
  const cat = DEDICATED_KINDS[kind].category
  const prods = await rows(db, 'SELECT * FROM products WHERE category = ? AND active = 1 ORDER BY position, name', [cat])
  if (!prods.length) return []
  const ids = prods.map(p => p.id), inIds = `(${ids.map(() => '?').join(',')})`
  const feats = await rows(db, `SELECT product_id, feature, icon FROM product_features WHERE product_id IN ${inIds} AND included = 1 ORDER BY position`, ids)
  const prices = await rows(db, `SELECT * FROM product_prices WHERE product_id IN ${inIds}`, ids)
  return prods.map(p => {
    const base = p.base_monthly_price == null ? null : Number(p.base_monthly_price)
    return {
      id: p.id, slug: p.slug, kind, name: p.name, description: p.description ?? null, saleStatus: p.sale_status, position: Number(p.position ?? 0),
      badge: p.badge ?? null, highlight: !!Number(p.popular), baseMonthly: base, imageUrl: vpsImageUrl(p.image_path), specs: (json(p.plan_specs) ?? {}) as DedicatedSpecs,
      features: feats.filter(f => f.product_id === p.id).map(f => ({ text: String(f.feature), icon: isVpsIcon(f.icon) ? f.icon : null })),
      periods: DEDICATED_CYCLES.map(c => {
        const r = prices.find(x => x.product_id === p.id && x.cycle === c.cycle)
        const price = r ? Number(r.price) : null, discount = r ? Number(r.discount_pct ?? 0) : 0
        return { cycle: c.cycle, months: c.months, exists: !!r, active: !!r && !!Number(r.active), price, renewal: r ? Number(r.renewal_price) : null, discount,
          matchesRule: price != null && base != null ? matchesRule(price, base, c.months, discount) : false }
      }),
    }
  })
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const isEmpty = (v: unknown) => v === '' || v === null || v === undefined
const intIn = (v: unknown, field: string, label: string, min: number, max: number) => {
  const n = Number(v)
  if (isEmpty(v) || !Number.isInteger(n) || n < min || n > max) throw new DedicatedPlanError(`${label}: indique um número inteiro entre ${min} e ${max.toLocaleString('pt-PT')}.`, field)
  return n
}
const money = (v: unknown, field: string, label: string) => {
  const n = Number(v)
  if (isEmpty(v) || !Number.isFinite(n) || n <= 0 || n > 100_000_000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new DedicatedPlanError(`${label}: valor em Kz maior que 0, até 2 casas decimais.`, field)
  return Math.round(n * 100) / 100
}
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export interface DedicatedPlanInput {
  id?: string; name: unknown; description?: unknown; saleStatus?: unknown; position?: unknown; badge?: unknown; highlight?: unknown; baseMonthly: unknown
  specs?: unknown; features?: unknown
  /** discount null = manter o preço guardado; renewal null = manter (novo: base × meses) */
  periods?: { cycle: unknown; discount?: unknown; publish?: unknown; renewal?: unknown }[]
}

export async function saveDedicatedPlan(kind: DedicatedKind, input: DedicatedPlanInput): Promise<string> {
  const K = DEDICATED_KINDS[kind]
  const name = text(input.name, 80)
  if (name.length < 2) throw new DedicatedPlanError('Indique o nome do plano (2 a 80 caracteres).', 'name')
  const description = text(input.description, 240) || null
  const saleStatus = String(input.saleStatus ?? 'draft')
  if (!['active', 'draft', 'on_request'].includes(saleStatus)) throw new DedicatedPlanError('Estado inválido.', 'saleStatus')
  const position = intIn(input.position ?? 0, 'position', 'Ordem', 0, 9999)
  const badge = text(input.badge, 32) || null
  const highlight = input.highlight === true
  const base = money(input.baseMonthly, 'baseMonthly', 'Preço mensal base')
  let specs: DedicatedSpecs
  try { specs = validateDedicatedSpecs(input.specs, kind) } catch (e) { if (e instanceof DedicatedSpecError) throw new DedicatedPlanError(e.message, e.field); throw e }
  const rawF = Array.isArray(input.features) ? input.features as any[] : []
  if (rawF.length > 20) throw new DedicatedPlanError('No máximo 20 características adicionais.', 'features')
  const features: VpsFeature[] = []
  for (const f of rawF) {
    const t = text(typeof f === 'string' ? f : f?.text, 120)
    if (!t) continue
    const icon = f?.icon == null || f.icon === '' ? null : f.icon
    if (icon !== null && !isVpsIcon(icon)) throw new DedicatedPlanError('Ícone fora da lista permitida.', 'features')
    features.push({ text: t, icon })
  }
  const per = new Map((input.periods ?? []).map(p => [String(p?.cycle), p]))
  for (const c of per.keys()) if (!DEDICATED_CYCLES.some(p => p.cycle === c)) throw new DedicatedPlanError(`Ciclo inválido: ${c}.`, 'periods')

  const id = await withTransaction(async conn => {
    let pid = input.id ? String(input.id) : ''
    const specsJson = Object.keys(specs).length ? JSON.stringify(specs) : null
    const cols = [name, description, saleStatus, position, badge, highlight ? 1 : 0, base, specsJson]
    if (pid) {
      const [p] = await rows(conn, 'SELECT id FROM products WHERE id = ? AND category = ? FOR UPDATE', [pid, K.category])
      if (!p) throw new DedicatedPlanError(`Plano ${K.short} inexistente.`)
      const [dup] = await rows(conn, 'SELECT id FROM products WHERE category = ? AND LOWER(name) = LOWER(?) AND id <> ?', [K.category, name, pid])
      if (dup) throw new DedicatedPlanError(`Já existe um plano ${K.short} com esse nome.`, 'name')
      // service_type/provisioning repostos: um dedicado nunca entra na compra automática de VPS
      await conn.query("UPDATE products SET name = ?, description = ?, sale_status = ?, position = ?, badge = ?, popular = ?, base_monthly_price = ?, plan_specs = ?, service_type = 'dedicated', provisioning = 'manual', provider_product_id = NULL, provider_mode = 'manual' WHERE id = ?", [...cols, pid])
    } else {
      const [dup] = await rows(conn, 'SELECT id FROM products WHERE category = ? AND LOWER(name) = LOWER(?)', [K.category, name])
      if (dup) throw new DedicatedPlanError(`Já existe um plano ${K.short} com esse nome.`, 'name')
      let slug = `${K.prefix}-${slugify(name)}`
      const [s] = await rows(conn, 'SELECT id FROM products WHERE slug = ?', [slug])
      if (s) slug = `${slug}-${randomUUID().slice(0, 4)}`
      pid = randomUUID()
      await conn.query(`INSERT INTO products (id, slug, category, name, description, sale_status, position, badge, popular, active, base_monthly_price, plan_specs,
          service_type, provisioning, max_quantity, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'dedicated', 'manual', 1, 'AOA')`, [pid, slug, K.category, ...cols])
    }
    await conn.query('DELETE FROM product_features WHERE product_id = ?', [pid])
    for (const [i, f] of features.entries()) await conn.query('INSERT INTO product_features (id, product_id, feature, included, position, icon) VALUES (?, ?, ?, 1, ?, ?)', [randomUUID(), pid, f.text, i + 1, f.icon])

    const existing = await rows(conn, 'SELECT * FROM product_prices WHERE product_id = ? FOR UPDATE', [pid])
    for (const c of DEDICATED_CYCLES) {
      const raw = per.get(c.cycle), cur = existing.find(x => x.cycle === c.cycle)
      if (!raw && !cur) continue
      const publish = raw ? raw.publish === true : !!Number(cur?.active)
      const keep = !raw || isEmpty(raw.discount)
      if (keep && !cur) { if (publish) throw new DedicatedPlanError(`${c.label}: defina o desconto (pode ser 0) antes de publicar.`, `discount-${c.cycle}`); continue }
      const discount = keep ? Number(cur!.discount_pct ?? 0) : intIn(raw!.discount, `discount-${c.cycle}`, `Desconto (${c.label})`, 0, MAX_DISCOUNT)
      const price = keep ? Number(cur!.price) : exactPeriodTotal(base, c.months, discount)
      const renewal = raw && !isEmpty(raw.renewal) ? money(raw.renewal, `renewal-${c.cycle}`, `Renovação (${c.label})`) : cur ? Number(cur.renewal_price) : exactPeriodTotal(base, c.months, 0)
      if (!(price > 0)) throw new DedicatedPlanError(`${c.label}: o total tem de ser maior que 0.`, `discount-${c.cycle}`)
      await conn.query(`INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, discount_pct, reference)
          VALUES (UUID(), ?, ?, ?, ?, ?, 'AKZ', ?, ?, JSON_OBJECT('edited_by_admin', TRUE))
        ON DUPLICATE KEY UPDATE price = VALUES(price), renewal_price = VALUES(renewal_price), active = VALUES(active), discount_pct = VALUES(discount_pct)`,
        [pid, c.cycle, c.months, price, renewal, publish ? 1 : 0, discount])
    }
    const [n] = await rows(conn, 'SELECT COUNT(*) n FROM product_prices WHERE product_id = ? AND active = 1', [pid])
    if (saleStatus === 'active' && !Number(n.n)) throw new DedicatedPlanError('Para publicar, active pelo menos um período.', 'periods')
    const [slugRow] = await rows(conn, 'SELECT slug FROM products WHERE id = ?', [pid])
    await syncDisplay(conn, pid, slugRow.slug)
    return pid
  })
  revalidateTag('catalog', { expire: 0 })
  return id
}

/** Publicar/despublicar e ordenar a partir da lista (por tipo: Linux ou Windows). */
export async function dedicatedListAction(kind: DedicatedKind, input: { action: unknown; id?: unknown; published?: unknown; ids?: unknown }) {
  const db = getPool(), cat = DEDICATED_KINDS[kind].category
  if (input.action === 'publish') {
    const id = String(input.id ?? '')
    const [[p]] = await db.query('SELECT id FROM products WHERE id = ? AND category = ?', [id, cat]) as any
    if (!p) throw new DedicatedPlanError('Plano inexistente.')
    if (input.published === true) {
      const [[n]] = await db.query('SELECT COUNT(*) n FROM product_prices WHERE product_id = ? AND active = 1', [id]) as any
      if (!Number(n.n)) throw new DedicatedPlanError('Para publicar, active pelo menos um período na ficha.')
    }
    await db.query('UPDATE products SET sale_status = ? WHERE id = ?', [input.published === true ? 'active' : 'draft', id])
  } else if (input.action === 'reorder') {
    const ids = Array.isArray(input.ids) ? input.ids.map(String) : []
    const known = (await rows(db, 'SELECT id FROM products WHERE category = ? AND active = 1', [cat])).map(r => r.id)
    if (!ids.length || ids.some(i => !known.includes(i))) throw new DedicatedPlanError('Ordem inválida.')
    for (const [i, id] of ids.entries()) await db.query('UPDATE products SET position = ? WHERE id = ?', [(i + 1) * 10, id])
  } else throw new DedicatedPlanError('Acção inválida.')
  revalidateTag('catalog', { expire: 0 })
}
