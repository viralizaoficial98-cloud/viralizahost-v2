import 'server-only'
import { randomUUID } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { MAX_DISCOUNT, exactPeriodTotal, matchesRule } from './period-pricing'
import { syncDisplay } from './catalog-admin'
import { VPS_CYCLES, compareSpecs, isTrafficUnit, isVpsIcon, type ProviderSpecs, type VpsFeature, type VpsSpecs } from './vps-shared'

// Catálogo e Preços → VPS (categoria «vps» sem subcategoria — a página /servidor-vps).
// Ficha em products.plan_specs, imagem em products.image_path (armazenamento «catalog-assets»), características
// com ícone (lista controlada) em product_features.icon. Preço de venda em Kz: base mensal + desconto por ciclo
// (exactPeriodTotal). Associação ao produto da Hostinger: products.provider_product_id / provider_mode e, por
// ciclo, product_prices.provider_item_id / provider_cost_minor / provider_currency / provider_cost_limit_minor
// (custo do fornecedor separado do preço de venda).

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
export class VpsPlanError extends Error { constructor(message: string, public field?: string) { super(message) } }
export const VPS_IMAGE_BUCKET = 'catalog-assets'
export const vpsImageUrl = (path: string | null | undefined) => path ? `/storage/v1/object/public/${VPS_IMAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}` : null

export interface VpsPeriod {
  cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null; discount: number; matchesRule: boolean
  providerItemId: string | null; providerCostMinor: number | null; providerCurrency: string | null; providerCostLimitMinor: number | null
}
export interface VpsPlan {
  id: string; slug: string; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'; position: number
  badge: string | null; highlight: boolean; baseMonthly: number | null; imageUrl: string | null; specs: VpsSpecs; features: VpsFeature[]
  providerProductId: string | null; providerMode: 'auto' | 'manual'; providerSpecs: ProviderSpecs | null; specWarnings: string[]; specUnverified: string[]; periods: VpsPeriod[]
}

const json = (v: unknown) => { if (!v) return null; try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }

export async function loadVpsPlans(db: Queryable = getPool()): Promise<VpsPlan[]> {
  const prods = await rows(db, "SELECT * FROM products WHERE category = 'vps' AND subcategory IS NULL AND active = 1 ORDER BY position, name")
  if (!prods.length) return []
  const ids = prods.map(p => p.id), inIds = `(${ids.map(() => '?').join(',')})`
  const feats = await rows(db, `SELECT product_id, feature, icon FROM product_features WHERE product_id IN ${inIds} AND included = 1 ORDER BY position`, ids)
  const prices = await rows(db, `SELECT * FROM product_prices WHERE product_id IN ${inIds}`, ids)
  return prods.map(p => {
    const base = p.base_monthly_price == null ? null : Number(p.base_monthly_price)
    const specs = (json(p.plan_specs) ?? {}) as VpsSpecs
    const providerSpecs = json(p.provider_specs) as ProviderSpecs | null
    return {
      id: p.id, slug: p.slug, name: p.name, description: p.description ?? null, saleStatus: p.sale_status, position: Number(p.position ?? 0),
      badge: p.badge ?? null, highlight: !!Number(p.popular), baseMonthly: base, imageUrl: vpsImageUrl(p.image_path), specs,
      features: feats.filter(f => f.product_id === p.id).map(f => ({ text: String(f.feature), icon: isVpsIcon(f.icon) ? f.icon : null })),
      providerProductId: p.provider_product_id ?? null, providerMode: p.provider_mode === 'auto' ? 'auto' : 'manual', providerSpecs,
      ...(({ mismatches, unverified }) => ({ specWarnings: mismatches, specUnverified: unverified }))(compareSpecs(specs, providerSpecs)),
      periods: VPS_CYCLES.map(c => {
        const r = prices.find(x => x.product_id === p.id && x.cycle === c.cycle)
        const price = r ? Number(r.price) : null, discount = r ? Number(r.discount_pct ?? 0) : 0
        return { cycle: c.cycle, months: c.months, exists: !!r, active: !!r && !!Number(r.active), price, renewal: r ? Number(r.renewal_price) : null, discount,
          matchesRule: price != null && base != null ? matchesRule(price, base, c.months, discount) : false,
          providerItemId: r?.provider_item_id ?? null, providerCostMinor: r?.provider_cost_minor ?? null, providerCurrency: r?.provider_currency ?? null, providerCostLimitMinor: r?.provider_cost_limit_minor ?? null }
      }),
    }
  })
}

// ── validação ──
const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const isEmpty = (v: unknown) => v === '' || v === null || v === undefined
const intIn = (v: unknown, field: string, label: string, min: number, max: number) => {
  const n = Number(v)
  if (isEmpty(v) || !Number.isInteger(n) || n < min || n > max) throw new VpsPlanError(`${label}: indique um número inteiro entre ${min} e ${max.toLocaleString('pt-PT')}.`, field)
  return n
}
const money = (v: unknown, field: string, label: string) => {
  const n = Number(v)
  if (isEmpty(v) || !Number.isFinite(n) || n <= 0 || n > 100_000_000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new VpsPlanError(`${label}: valor em Kz maior que 0, até 2 casas decimais.`, field)
  return Math.round(n * 100) / 100
}
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
const PROVIDER_ID = /^[a-z0-9][a-z0-9-]{2,158}$/

export function validateVpsSpecs(s: any): VpsSpecs {
  s = s && typeof s === 'object' ? s : {}
  const out: VpsSpecs = {}
  if (!isEmpty(s.vcpu)) out.vcpu = intIn(s.vcpu, 'vcpu', 'vCPU', 1, 256)
  if (!isEmpty(s.ramGb)) {
    const r = Number(s.ramGb)
    if (!Number.isFinite(r) || r < 0.5 || r > 4096 || Math.round(r * 10) !== r * 10) throw new VpsPlanError('RAM: GB entre 0,5 e 4096 (até 1 casa decimal).', 'ramGb')
    out.ramGb = r
  }
  if (!isEmpty(s.diskGb)) out.diskGb = intIn(s.diskGb, 'diskGb', 'Armazenamento (GB)', 1, 100000)
  if (!isEmpty(s.diskType)) { if (!['NVMe', 'SSD'].includes(s.diskType)) throw new VpsPlanError('Tipo de disco: NVMe ou SSD.', 'diskType'); out.diskType = s.diskType }
  const t = s.traffic
  if (t && typeof t === 'object' && (t.unlimited === true || !isEmpty(t.value))) {
    if (t.unlimited === true) { if (!isEmpty(t.value)) throw new VpsPlanError('Tráfego: escolha um valor OU «Ilimitado».', 'traffic'); out.traffic = { unlimited: true } }
    else { if (!isTrafficUnit(t.unit)) throw new VpsPlanError('Tráfego: unidade GB, TB (decimais), GiB ou TiB (binárias).', 'traffic'); out.traffic = { value: intIn(t.value, 'traffic', 'Tráfego mensal', 1, 1_000_000), unit: t.unit } }
  }
  const nw = s.network
  if (nw && typeof nw === 'object' && !isEmpty(nw.value)) {
    if (!['Mbps', 'Gbps'].includes(nw.unit)) throw new VpsPlanError('Velocidade de rede: Mbps ou Gbps.', 'network')
    out.network = { value: intIn(nw.value, 'network', 'Velocidade de rede', 1, 100000), unit: nw.unit }
  }
  return out
}

export interface VpsPlanInput {
  id?: string; name: unknown; description?: unknown; saleStatus?: unknown; position?: unknown; badge?: unknown; highlight?: unknown; baseMonthly: unknown
  specs?: unknown; features?: unknown
  providerProductId?: unknown; providerMode?: unknown; providerSpecs?: unknown; providerSpecsConfirmed?: unknown
  /** discount null = manter o preço guardado; renewal null = manter (novo: base × meses) */
  periods?: { cycle: unknown; discount?: unknown; publish?: unknown; renewal?: unknown; providerItemId?: unknown; providerCostMinor?: unknown; providerCurrency?: unknown; providerCostLimitMinor?: unknown }[]
}

export async function saveVpsPlan(input: VpsPlanInput): Promise<string> {
  const name = text(input.name, 80)
  if (name.length < 2) throw new VpsPlanError('Indique o nome do plano (2 a 80 caracteres).', 'name')
  const description = text(input.description, 200) || null
  const saleStatus = String(input.saleStatus ?? 'draft')
  if (!['active', 'draft', 'on_request'].includes(saleStatus)) throw new VpsPlanError('Estado inválido.', 'saleStatus')
  const position = intIn(input.position ?? 0, 'position', 'Ordem', 0, 9999)
  const badge = text(input.badge, 32) || null
  const highlight = input.highlight === true
  const base = money(input.baseMonthly, 'baseMonthly', 'Preço mensal base')
  const specs = validateVpsSpecs(input.specs)
  const rawF = Array.isArray(input.features) ? input.features as any[] : []
  if (rawF.length > 20) throw new VpsPlanError('No máximo 20 características extras.', 'features')
  const features: VpsFeature[] = []
  for (const f of rawF) {
    const t = text(typeof f === 'string' ? f : f?.text, 120)
    if (!t) continue
    const icon = f?.icon == null || f.icon === '' ? null : f.icon
    if (icon !== null && !isVpsIcon(icon)) throw new VpsPlanError('Ícone fora da lista permitida.', 'features')
    features.push({ text: t, icon })
  }
  // Fornecedor
  const providerProductId = text(input.providerProductId, 160) || null
  if (providerProductId && !PROVIDER_ID.test(providerProductId)) throw new VpsPlanError('Produto da Hostinger inválido (ex.: hostingercom-vps-kvm2).', 'providerProductId')
  const providerMode = input.providerMode === 'auto' ? 'auto' : 'manual'
  let providerSpecs: ProviderSpecs | null = null
  if (input.providerSpecs && typeof input.providerSpecs === 'object') {
    const ps = input.providerSpecs as any, num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
    const FIELDS = ['vcpu', 'ram', 'disk', 'traffic'] as const
    const raw: NonNullable<ProviderSpecs['raw']> = {}
    for (const f of FIELDS) {
      const r = ps.raw?.[f]
      if (r && typeof r === 'object' && Number.isFinite(Number(r.value))) raw[f] = { key: text(r.key, 40), value: Number(r.value), unit: r.unit ? text(r.unit, 8) : null }
    }
    providerSpecs = { vcpu: num(ps.vcpu), ramGb: num(ps.ramGb), diskGb: num(ps.diskGb), trafficGb: num(ps.trafficGb), trafficUnlimited: ps.trafficUnlimited == null ? null : !!ps.trafficUnlimited,
      unverified: Array.isArray(ps.unverified) ? FIELDS.filter(f => ps.unverified.includes(f)) : [], raw }
  }
  // Mesma regra do painel (compareSpecs). Automático: divergência real bloqueia; valor não validado exige confirmação.
  // Manual: a equipa trata da aquisição — grava e mostra as divergências como aviso.
  const cmp = providerProductId ? compareSpecs(specs, providerSpecs) : { mismatches: [], unverified: [] }
  if (providerMode === 'auto') {
    if (!providerProductId) throw new VpsPlanError('Modo automático: associe o produto exacto da Hostinger.', 'providerProductId')
    if (cmp.mismatches.length) throw new VpsPlanError(`Modo automático: as características anunciadas não correspondem ao produto da Hostinger: ${cmp.mismatches.join('; ')}. Corrija-as ou use o modo Manual.`, 'specs')
    if ((!providerSpecs || cmp.unverified.length) && input.providerSpecsConfirmed !== true) {
      throw new VpsPlanError(cmp.unverified.length
        ? `Modo automático: ${cmp.unverified.join('; ')}. Confirme que correspondem ao anunciado.`
        : 'Modo automático: o catálogo não indica as características do produto; confirme que correspondem ao anunciado.', 'providerSpecsConfirmed')
    }
  }

  const per = new Map((input.periods ?? []).map(p => [String(p?.cycle), p]))
  for (const c of per.keys()) if (!VPS_CYCLES.some(p => p.cycle === c)) throw new VpsPlanError(`Ciclo inválido: ${c}.`, 'periods')

  const id = await withTransaction(async conn => {
    let pid = input.id ? String(input.id) : ''
    const specsJson = Object.keys(specs).length ? JSON.stringify(specs) : null
    const cols = [name, description, saleStatus, position, badge, highlight ? 1 : 0, base, specsJson, providerProductId, providerMode, providerSpecs ? JSON.stringify(providerSpecs) : null]
    if (pid) {
      const [p] = await rows(conn, "SELECT id FROM products WHERE id = ? AND category = 'vps' AND subcategory IS NULL FOR UPDATE", [pid])
      if (!p) throw new VpsPlanError('Plano VPS inexistente.')
      const [dup] = await rows(conn, "SELECT id FROM products WHERE category = 'vps' AND LOWER(name) = LOWER(?) AND id <> ?", [name, pid])
      if (dup) throw new VpsPlanError('Já existe um plano VPS com esse nome.', 'name')
      await conn.query('UPDATE products SET name = ?, description = ?, sale_status = ?, position = ?, badge = ?, popular = ?, base_monthly_price = ?, plan_specs = ?, provider_product_id = ?, provider_mode = ?, provider_specs = ? WHERE id = ?', [...cols, pid])
    } else {
      const [dup] = await rows(conn, "SELECT id FROM products WHERE category = 'vps' AND LOWER(name) = LOWER(?)", [name])
      if (dup) throw new VpsPlanError('Já existe um plano VPS com esse nome.', 'name')
      let slug = `vps-${slugify(name).replace(/^vps-/, '')}`
      const [s] = await rows(conn, 'SELECT id FROM products WHERE slug = ?', [slug])
      if (s) slug = `${slug}-${randomUUID().slice(0, 4)}`
      pid = randomUUID()
      await conn.query(`INSERT INTO products (id, slug, category, name, description, sale_status, position, badge, popular, active, base_monthly_price, plan_specs, provider_product_id, provider_mode, provider_specs,
          service_type, provisioning, max_quantity, currency) VALUES (?, ?, 'vps', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'vps', 'manual', 1, 'AOA')`, [pid, slug, ...cols])
    }
    await conn.query('DELETE FROM product_features WHERE product_id = ?', [pid])
    for (const [i, f] of features.entries()) await conn.query('INSERT INTO product_features (id, product_id, feature, included, position, icon) VALUES (?, ?, ?, 1, ?, ?)', [randomUUID(), pid, f.text, i + 1, f.icon])

    const existing = await rows(conn, 'SELECT * FROM product_prices WHERE product_id = ? FOR UPDATE', [pid])
    for (const c of VPS_CYCLES) {
      const raw = per.get(c.cycle), cur = existing.find(x => x.cycle === c.cycle)
      if (!raw && !cur) continue
      const publish = raw ? raw.publish === true : !!Number(cur?.active)
      const keep = !raw || isEmpty(raw.discount)
      if (keep && !cur) { if (publish) throw new VpsPlanError(`${c.label}: defina o desconto (pode ser 0) antes de publicar.`, `discount-${c.cycle}`); continue }
      const discount = keep ? Number(cur!.discount_pct ?? 0) : intIn(raw!.discount, `discount-${c.cycle}`, `Desconto (${c.label})`, 0, MAX_DISCOUNT)
      const price = keep ? Number(cur!.price) : exactPeriodTotal(base, c.months, discount)
      const renewal = raw && !isEmpty(raw.renewal) ? money(raw.renewal, `renewal-${c.cycle}`, `Renovação (${c.label})`) : cur ? Number(cur.renewal_price) : exactPeriodTotal(base, c.months, 0)
      // Fornecedor (por ciclo): item de preço, custo esperado e limite (unidades mínimas da moeda, ex.: cêntimos)
      const itemId = raw && 'providerItemId' in raw ? (text(raw.providerItemId, 160) || null) : cur?.provider_item_id ?? null
      if (itemId && !PROVIDER_ID.test(itemId)) throw new VpsPlanError(`${c.label}: item de preço da Hostinger inválido.`, `provider-${c.cycle}`)
      const optInt = (v: unknown, f: string, l: string) => isEmpty(v) ? null : intIn(v, f, l, 0, 100_000_000)
      const cost = raw && 'providerCostMinor' in raw ? optInt(raw.providerCostMinor, `provider-${c.cycle}`, `${c.label}: custo do fornecedor`) : cur?.provider_cost_minor ?? null
      const limit = raw && 'providerCostLimitMinor' in raw ? optInt(raw.providerCostLimitMinor, `provider-${c.cycle}`, `${c.label}: limite de custo`) : cur?.provider_cost_limit_minor ?? null
      const currency = raw && 'providerCurrency' in raw ? (text(raw.providerCurrency, 3).toUpperCase() || null) : cur?.provider_currency ?? null
      if (currency && !/^[A-Z]{3}$/.test(currency)) throw new VpsPlanError(`${c.label}: moeda do fornecedor inválida (ex.: USD).`, `provider-${c.cycle}`)
      if (cost != null && limit != null && limit < cost) throw new VpsPlanError(`${c.label}: o limite de custo não pode ser inferior ao custo esperado.`, `provider-${c.cycle}`)
      if (providerMode === 'auto' && publish && (!itemId || cost == null || limit == null || !currency)) {
        throw new VpsPlanError(`${c.label}: em modo automático indique o item de preço da Hostinger, o custo esperado, a moeda e o limite de custo.`, `provider-${c.cycle}`)
      }
      if (!(price > 0)) throw new VpsPlanError(`${c.label}: o total tem de ser maior que 0.`, `discount-${c.cycle}`)
      await conn.query(`INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, discount_pct, provider_item_id, provider_cost_minor, provider_currency, provider_cost_limit_minor, reference)
          VALUES (UUID(), ?, ?, ?, ?, ?, 'AKZ', ?, ?, ?, ?, ?, ?, JSON_OBJECT('edited_by_admin', TRUE))
        ON DUPLICATE KEY UPDATE price = VALUES(price), renewal_price = VALUES(renewal_price), active = VALUES(active), discount_pct = VALUES(discount_pct),
          provider_item_id = VALUES(provider_item_id), provider_cost_minor = VALUES(provider_cost_minor), provider_currency = VALUES(provider_currency), provider_cost_limit_minor = VALUES(provider_cost_limit_minor)`,
        [pid, c.cycle, c.months, price, renewal, publish ? 1 : 0, discount, itemId, cost, currency, limit])
    }
    const [n] = await rows(conn, 'SELECT COUNT(*) n FROM product_prices WHERE product_id = ? AND active = 1', [pid])
    if (saleStatus === 'active' && !Number(n.n)) throw new VpsPlanError('Para publicar, active pelo menos um ciclo.', 'periods')
    const [slugRow] = await rows(conn, 'SELECT slug FROM products WHERE id = ?', [pid])
    await syncDisplay(conn, pid, slugRow.slug)
    return pid
  })
  revalidateTag('catalog', { expire: 0 })
  return id
}

/** Publicar/despublicar e ordenar a partir da lista (sem abrir a ficha). */
export async function vpsListAction(input: { action: unknown; id?: unknown; published?: unknown; ids?: unknown }) {
  const db = getPool()
  if (input.action === 'publish') {
    const id = String(input.id ?? '')
    const [[p]] = await db.query("SELECT id FROM products WHERE id = ? AND category = 'vps' AND subcategory IS NULL", [id]) as any
    if (!p) throw new VpsPlanError('Plano VPS inexistente.')
    if (input.published === true) {
      const [[n]] = await db.query('SELECT COUNT(*) n FROM product_prices WHERE product_id = ? AND active = 1', [id]) as any
      if (!Number(n.n)) throw new VpsPlanError('Para publicar, active pelo menos um ciclo na ficha.')
    }
    await db.query('UPDATE products SET sale_status = ? WHERE id = ?', [input.published === true ? 'active' : 'draft', id])
  } else if (input.action === 'reorder') {
    const ids = Array.isArray(input.ids) ? input.ids.map(String) : []
    const known = (await rows(db, "SELECT id FROM products WHERE category = 'vps' AND subcategory IS NULL AND active = 1")).map(r => r.id)
    if (!ids.length || ids.some(i => !known.includes(i))) throw new VpsPlanError('Ordem inválida.')
    for (const [i, id] of ids.entries()) await db.query('UPDATE products SET position = ? WHERE id = ?', [(i + 1) * 10, id])
  } else throw new VpsPlanError('Acção inválida.')
  revalidateTag('catalog', { expire: 0 })
}
