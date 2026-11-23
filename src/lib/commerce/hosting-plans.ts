import 'server-only'
import { randomUUID } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { MAX_DISCOUNT, PLAN_PERIODS, exactPeriodTotal, matchesRule } from './period-pricing'
import { syncDisplay } from './catalog-admin'

// Hospedagem Premium (categoria «hosting»): Catálogo e Preços → Hospedagem.
// Ficha técnica em products.plan_specs (JSON), grupos de características em product_features.group_name,
// preço mensal base + desconto por período → product_prices (regra em period-pricing.ts: exactPeriodTotal).
// O pacote WHM (products.whm_package) NUNCA é alterado aqui: continua a ser definido na linha do produto
// (Catálogo) ou em Integrações → WHM/cPanel, e é ele que aplica as quotas reais.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
export class HostingPlanError extends Error { constructor(message: string, public field?: string) { super(message) } }

export const HOSTING_CATEGORY = 'hosting'
export type Limit = { unlimited: true } | { value: number }
export interface HostingSpecs {
  usageProfile?: string | null
  sites?: Limit | null
  storageGb?: number | null
  diskType?: 'SSD' | 'NVMe' | null
  traffic?: { unlimited: true } | { value: number; unit: 'GB' | 'TB' } | null
  emailAccounts?: Limit | null
  sendLimitHour?: number | null
  ramGb?: number | null
  inodes?: Limit | null
}
export interface FeatureGroup { name: string | null; features: { text: string; included: boolean }[] }
export interface HostingPeriod {
  cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null
  discount: number; matchesRule: boolean
}
export interface HostingPlan {
  id: string; slug: string; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'
  position: number; badge: string | null; highlight: boolean; baseMonthly: number | null; whmPackage: string | null
  specs: HostingSpecs; groups: FeatureGroup[]; periods: HostingPeriod[]; otherCycles: { cycle: string; months: number; price: number; active: boolean }[]
}

export const parseSpecs = (v: unknown): HostingSpecs => {
  if (!v) return {}
  try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && typeof o === 'object' ? o as HostingSpecs : {} } catch { return {} }
}

export async function loadHostingPlans(db: Queryable = getPool()): Promise<HostingPlan[]> {
  const prods = await rows(db, "SELECT id, slug, name, description, sale_status, position, badge, popular, base_monthly_price, whm_package, plan_specs FROM products WHERE category = 'hosting' AND active = 1 ORDER BY position, name")
  if (!prods.length) return []
  const ids = prods.map(p => p.id), inIds = `(${ids.map(() => '?').join(',')})`
  const feats = await rows(db, `SELECT product_id, feature, included, group_name FROM product_features WHERE product_id IN ${inIds} ORDER BY position`, ids)
  const prices = await rows(db, `SELECT product_id, cycle, months, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id IN ${inIds} ORDER BY months`, ids)
  return prods.map(p => {
    const base = p.base_monthly_price == null ? null : Number(p.base_monthly_price)
    const groups: FeatureGroup[] = []
    for (const f of feats.filter(x => x.product_id === p.id)) {
      const name = f.group_name ?? null
      let g = groups[groups.length - 1]
      if (!g || g.name !== name) { g = { name, features: [] }; groups.push(g) }
      g.features.push({ text: String(f.feature), included: !!Number(f.included) })
    }
    return {
      id: p.id, slug: p.slug, name: p.name, description: p.description ?? null, saleStatus: p.sale_status, position: Number(p.position ?? 0),
      badge: p.badge ?? null, highlight: !!Number(p.popular), baseMonthly: base, whmPackage: p.whm_package ?? null, specs: parseSpecs(p.plan_specs), groups,
      periods: PLAN_PERIODS.map(per => {
        const r = prices.find(x => x.product_id === p.id && x.cycle === per.cycle)
        const price = r ? Number(r.price) : null, discount = r ? Number(r.discount_pct ?? 0) : 0
        return { cycle: per.cycle, months: per.months, exists: !!r, active: !!r && !!Number(r.active), price, renewal: r ? Number(r.renewal_price) : null, discount,
          matchesRule: price != null && base != null ? matchesRule(price, base, per.months, discount) : false }
      }),
      otherCycles: prices.filter(x => x.product_id === p.id && !PLAN_PERIODS.some(per => per.cycle === x.cycle))
        .map(x => ({ cycle: x.cycle, months: Number(x.months), price: Number(x.price), active: !!Number(x.active) })),
    }
  })
}

// ── validação ──
const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
const intIn = (v: unknown, field: string, label: string, min: number, max: number): number => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < min || n > max) throw new HostingPlanError(`${label}: indique um número inteiro entre ${min} e ${max.toLocaleString('pt-PT')}.`, field)
  return n
}
const optInt = (v: unknown, field: string, label: string, min: number, max: number) => (v === '' || v === null || v === undefined ? null : intIn(v, field, label, min, max))
const money = (v: unknown, field: string, label: string) => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n <= 0 || n > 100_000_000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new HostingPlanError(`${label}: valor em Kz maior que 0, até 2 casas decimais.`, field)
  return Math.round(n * 100) / 100
}
/** Limite: { unlimited: true } | { value } | vazio (null). Recusa «ilimitado» com valor ao mesmo tempo. */
const limit = (v: any, field: string, label: string, max: number): Limit | null => {
  if (v == null || v === '' || (typeof v === 'object' && !v.unlimited && (v.value === '' || v.value == null))) return null
  if (typeof v !== 'object') throw new HostingPlanError(`${label}: valor inválido.`, field)
  if (v.unlimited === true) { if (v.value != null && v.value !== '') throw new HostingPlanError(`${label}: escolha um número OU «Ilimitado».`, field); return { unlimited: true } }
  return { value: intIn(v.value, field, label, 1, max) }
}
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export function validateSpecs(s: any): HostingSpecs {
  s = s && typeof s === 'object' ? s : {}
  const out: HostingSpecs = {}
  const usage = text(s.usageProfile, 60); if (usage) out.usageProfile = usage
  const sites = limit(s.sites, 'sites', 'Número de sites', 10000); if (sites) out.sites = sites
  const storage = optInt(s.storageGb, 'storageGb', 'Armazenamento (GB)', 1, 100000); if (storage != null) out.storageGb = storage
  if (s.diskType != null && s.diskType !== '') {
    if (!['SSD', 'NVMe'].includes(s.diskType)) throw new HostingPlanError('Tipo de disco: SSD ou NVMe.', 'diskType')
    out.diskType = s.diskType
  }
  const t = s.traffic
  if (t && typeof t === 'object' && (t.unlimited === true || (t.value !== '' && t.value != null))) {
    if (t.unlimited === true) { if (t.value != null && t.value !== '') throw new HostingPlanError('Tráfego: escolha um valor OU «Ilimitado».', 'traffic'); out.traffic = { unlimited: true } }
    else {
      if (!['GB', 'TB'].includes(t.unit)) throw new HostingPlanError('Tráfego: unidade GB ou TB.', 'traffic')
      out.traffic = { value: intIn(t.value, 'traffic', 'Tráfego mensal', 1, 1_000_000), unit: t.unit }
    }
  }
  const mails = limit(s.emailAccounts, 'emailAccounts', 'Caixas de e-mail', 100000); if (mails) out.emailAccounts = mails
  const send = optInt(s.sendLimitHour, 'sendLimitHour', 'Limite de envio por hora', 1, 1_000_000); if (send != null) out.sendLimitHour = send
  if (s.ramGb !== '' && s.ramGb != null) {
    const r = Number(s.ramGb)
    if (!Number.isFinite(r) || r <= 0 || r > 1024 || Math.round(r * 10) !== r * 10) throw new HostingPlanError('Memória RAM: GB entre 0,1 e 1024 (até 1 casa decimal).', 'ramGb')
    out.ramGb = r
  }
  const inodes = limit(s.inodes, 'inodes', 'Limite de ficheiros (inodes)', 100_000_000); if (inodes) out.inodes = inodes
  return out
}

export interface HostingPlanInput {
  id?: string; name: unknown; description?: unknown; saleStatus?: unknown; position?: unknown; badge?: unknown; highlight?: unknown
  baseMonthly: unknown; specs?: unknown; groups?: unknown
  /** discount null = manter o preço guardado; publish = período à venda; renewal null = manter (novo: base × meses) */
  periods?: { cycle: unknown; discount?: unknown; publish?: unknown; renewal?: unknown }[]
}

/** Cria (sem id) ou actualiza um plano de hospedagem. Valida e calcula tudo no servidor. */
export async function saveHostingPlan(input: HostingPlanInput): Promise<string> {
  const name = text(input.name, 80)
  if (name.length < 2) throw new HostingPlanError('Indique o nome do plano (2 a 80 caracteres).', 'name')
  const description = text(input.description, 160) || null
  const saleStatus = String(input.saleStatus ?? 'draft')
  if (!['active', 'draft', 'on_request'].includes(saleStatus)) throw new HostingPlanError('Estado inválido.', 'saleStatus')
  const position = intIn(input.position ?? 0, 'position', 'Ordem', 0, 9999)
  const badge = text(input.badge, 24) || null
  const highlight = input.highlight === true || input.highlight === 1 || input.highlight === '1'
  const base = money(input.baseMonthly, 'baseMonthly', 'Preço mensal base')
  const specs = validateSpecs(input.specs)

  const rawGroups = Array.isArray(input.groups) ? input.groups as any[] : []
  if (rawGroups.length > 8) throw new HostingPlanError('No máximo 8 grupos de características.', 'groups')
  const features: { text: string; included: boolean; group: string | null }[] = []
  const seenGroups = new Set<string>()
  for (const g of rawGroups) {
    const gname = text(g?.name, 60) || null
    if (gname) { if (seenGroups.has(gname.toLowerCase())) throw new HostingPlanError(`Grupo repetido: «${gname}».`, 'groups'); seenGroups.add(gname.toLowerCase()) }
    for (const f of Array.isArray(g?.features) ? g.features : []) {
      const t = text(typeof f === 'string' ? f : f?.text, 120)
      if (t) features.push({ text: t, included: typeof f === 'string' ? true : f?.included !== false, group: gname })
    }
  }
  if (features.length > 40) throw new HostingPlanError('No máximo 40 características.', 'groups')

  const per = new Map((input.periods ?? []).map(p => [String(p?.cycle), p]))
  for (const c of per.keys()) if (!PLAN_PERIODS.some(p => p.cycle === c)) throw new HostingPlanError(`Período inválido: ${c}.`, 'periods')

  const id = await withTransaction(async conn => {
    let pid = input.id ? String(input.id) : ''
    if (pid) {
      const [p] = await rows(conn, "SELECT id FROM products WHERE id = ? AND category = 'hosting' FOR UPDATE", [pid])
      if (!p) throw new HostingPlanError('Plano de hospedagem inexistente.')
      const [dup] = await rows(conn, "SELECT id FROM products WHERE category = 'hosting' AND LOWER(name) = LOWER(?) AND id <> ?", [name, pid])
      if (dup) throw new HostingPlanError('Já existe um plano de hospedagem com esse nome.', 'name')
      // whm_package, provisioning e service_type não são tocados
      await conn.query('UPDATE products SET name = ?, description = ?, sale_status = ?, position = ?, badge = ?, popular = ?, base_monthly_price = ?, plan_specs = ?, storage_gb = ?, send_limit_hour = ? WHERE id = ?',
        [name, description, saleStatus, position, badge, highlight ? 1 : 0, base, JSON.stringify(specs), specs.storageGb ?? null, specs.sendLimitHour ?? null, pid])
    } else {
      const [dup] = await rows(conn, "SELECT id FROM products WHERE category = 'hosting' AND LOWER(name) = LOWER(?)", [name])
      if (dup) throw new HostingPlanError('Já existe um plano de hospedagem com esse nome.', 'name')
      let slug = `hosting-${slugify(name).replace(/^hosting-/, '')}`
      const [s] = await rows(conn, 'SELECT id FROM products WHERE slug = ?', [slug])
      if (s) slug = `${slug}-${randomUUID().slice(0, 4)}`
      pid = randomUUID()
      // Novo plano: activação manual até ser associado um pacote WHM (linha do produto ou Integrações → WHM/cPanel)
      await conn.query(`INSERT INTO products (id, slug, category, name, description, sale_status, position, badge, popular, active, base_monthly_price, plan_specs, storage_gb, send_limit_hour,
          service_type, provisioning, max_quantity, currency) VALUES (?, ?, 'hosting', ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'hosting', 'whm', 1, 'AOA')`,
        [pid, slug, name, description, saleStatus, position, badge, highlight ? 1 : 0, base, JSON.stringify(specs), specs.storageGb ?? null, specs.sendLimitHour ?? null])
    }
    await conn.query('DELETE FROM product_features WHERE product_id = ?', [pid])
    for (const [i, f] of features.entries())
      await conn.query('INSERT INTO product_features (id, product_id, feature, included, position, group_name) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), pid, f.text, f.included ? 1 : 0, i + 1, f.group])

    const existing = await rows(conn, 'SELECT cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id = ? FOR UPDATE', [pid])
    for (const p of PLAN_PERIODS) {
      const raw = per.get(p.cycle), cur = existing.find(x => x.cycle === p.cycle)
      if (!raw && !cur) continue
      const publish = raw ? raw.publish === true : !!Number(cur?.active)
      const keep = !raw || raw.discount === null || raw.discount === undefined || raw.discount === ''
      if (keep && !cur) { if (publish) throw new HostingPlanError(`${p.label}: defina o desconto (pode ser 0) antes de publicar.`, `discount-${p.cycle}`); continue }
      const discount = keep ? Number(cur!.discount_pct ?? 0) : intIn(raw!.discount, `discount-${p.cycle}`, `Desconto (${p.label})`, 0, MAX_DISCOUNT)
      const price = keep ? Number(cur!.price) : exactPeriodTotal(base, p.months, discount)
      if (!(price > 0)) throw new HostingPlanError(`${p.label}: o total tem de ser maior que 0.`, `discount-${p.cycle}`)
      const renewal = raw && raw.renewal !== null && raw.renewal !== undefined && raw.renewal !== ''
        ? money(raw.renewal, `renewal-${p.cycle}`, `Renovação (${p.label})`)
        : cur ? Number(cur.renewal_price) : exactPeriodTotal(base, p.months, 0) // regra actual: renovação ao preço sem desconto
      await conn.query(`INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, discount_pct, reference)
          VALUES (UUID(), ?, ?, ?, ?, ?, 'AKZ', ?, ?, JSON_OBJECT('edited_by_admin', TRUE))
        ON DUPLICATE KEY UPDATE price = VALUES(price), renewal_price = VALUES(renewal_price), active = VALUES(active), discount_pct = VALUES(discount_pct),
          reference = IF(price <> VALUES(price) OR renewal_price <> VALUES(renewal_price), JSON_SET(COALESCE(reference, '{}'), '$.edited_by_admin', TRUE), reference)`,
        [pid, p.cycle, p.months, price, renewal, publish ? 1 : 0, discount])
    }
    // Outros ciclos (ex.: trimestral, semestral) mantêm-se como estavam.
    const [n] = await rows(conn, 'SELECT COUNT(*) n FROM product_prices WHERE product_id = ? AND active = 1', [pid])
    if (saleStatus === 'active' && !Number(n.n)) throw new HostingPlanError('Para pôr à venda, publique pelo menos um período.', 'periods')
    const [slugRow] = await rows(conn, 'SELECT slug FROM products WHERE id = ?', [pid])
    await syncDisplay(conn, pid, slugRow.slug)
    return pid
  })
  revalidateTag('catalog', { expire: 0 })
  return id
}
