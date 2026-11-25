import 'server-only'
import { randomUUID } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { MAX_DISCOUNT, exactPeriodTotal, impliedDiscount, matchesRule } from './period-pricing'
import { syncDisplay } from './catalog-admin'
import { FAMILY_PERIODS, PLAN_FAMILIES, type PlanFamily } from './plan-families'
import { isVpsIcon, type VpsIcon } from './vps-shared'

/** Característica de um plano: texto livre, ícone da lista controlada e «incluída» (planos antigos podiam ter
 *  características marcadas como não incluídas — são preservadas e mostradas riscadas). */
export interface FamilyFeature { text: string; icon: VpsIcon | null; included: boolean }

/**
 * Lê uma linha de product_features em qualquer formato conhecido: texto simples (editores actuais e o editor
 * antigo de produtos, sem ícone e com posição a partir de 0) ou texto guardado como JSON ({text|feature|label, icon}).
 * Nunca inventa texto: uma linha só com ícone fica com texto vazio (o painel assinala-a; o site não a mostra).
 */
export function readFeature(row: { feature: unknown; icon?: unknown; included?: unknown }): FamilyFeature {
  let text = String(row.feature ?? '')
  let icon: unknown = row.icon
  const t = text.trim()
  if (t.startsWith('{') && t.endsWith('}')) {
    try { const o = JSON.parse(t); if (o && typeof o === 'object') { text = String(o.text ?? o.feature ?? o.label ?? ''); icon = icon ?? o.icon } } catch { /* texto normal */ }
  }
  return { text: text.trim(), icon: isVpsIcon(icon) ? icon : null, included: row.included === undefined ? true : !!Number(row.included) }
}

// Catálogo e Preços → planos de Revenda de Hospedagem, Criador de Sites e Construtor WordPress.
// Mesmo modelo de preços da Hospedagem (period-pricing.ts): base mensal + desconto por período (0% incluído),
// total = arredondar ao cêntimo(base × meses × (1 − desconto/100)). Um preço guardado que não segue a regra
// («personalizado») é mantido até o administrador escolher «Aplicar regra». Características com ícone da lista
// controlada (a mesma dos VPS/dedicados) em product_features.icon. Nunca altera service_type, provisioning nem
// whm_package de um produto existente (o modo de activação mantém-se).

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
export class FamilyPlanError extends Error { constructor(message: string, public field?: string) { super(message) } }

export interface FamilyPeriod { cycle: string; months: number; exists: boolean; active: boolean; price: number | null; renewal: number | null; discount: number; matchesRule: boolean }
export interface FamilyPlan {
  id: string; slug: string; name: string; description: string | null; saleStatus: 'active' | 'draft' | 'on_request'
  position: number; badge: string | null; highlight: boolean
  /** Preço mensal base: o guardado ou, se ainda não existir, o do período de 1 mês (baseDerived). */
  baseMonthly: number | null; baseDerived: boolean
  features: FamilyFeature[]; periods: FamilyPeriod[]; otherCycles: { cycle: string; months: number; price: number; active: boolean }[]
}
const where = (f: PlanFamily) => {
  const d = PLAN_FAMILIES[f]
  return { sql: d.subcategory ? 'category = ? AND subcategory = ?' : 'category = ? AND subcategory IS NULL', args: d.subcategory ? [d.category, d.subcategory] : [d.category] }
}

export async function loadFamilyPlans(family: PlanFamily, db: Queryable = getPool()): Promise<FamilyPlan[]> {
  const w = where(family)
  const prods = await rows(db, `SELECT id, slug, name, description, sale_status, position, badge, popular, base_monthly_price FROM products WHERE ${w.sql} AND active = 1 ORDER BY position, name`, w.args)
  if (!prods.length) return []
  const ids = prods.map(p => p.id), inIds = `(${ids.map(() => '?').join(',')})`
  // TODAS as linhas (incluídas e não incluídas), pela ordem gravada
  const feats = await rows(db, `SELECT product_id, feature, icon, included FROM product_features WHERE product_id IN ${inIds} ORDER BY position, id`, ids)
  const prices = await rows(db, `SELECT product_id, cycle, months, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id IN ${inIds} ORDER BY months`, ids)
  return prods.map(p => {
    const mine = prices.filter(x => x.product_id === p.id)
    const monthly = mine.find(x => x.cycle === 'monthly')
    const stored = p.base_monthly_price == null ? null : Number(p.base_monthly_price)
    const base = stored ?? (monthly ? Number(monthly.price) : null)
    return {
      id: p.id, slug: p.slug, name: p.name, description: p.description ?? null, saleStatus: p.sale_status, position: Number(p.position ?? 0),
      badge: p.badge ?? null, highlight: !!Number(p.popular), baseMonthly: base, baseDerived: stored == null && base != null,
      features: feats.filter(f => f.product_id === p.id).map(readFeature),
      periods: FAMILY_PERIODS.map(per => {
        const r = mine.find(x => x.cycle === per.cycle)
        const price = r ? Number(r.price) : null, discount = r ? Number(r.discount_pct ?? 0) : 0
        return { cycle: per.cycle, months: per.months, exists: !!r, active: !!r && !!Number(r.active), price, renewal: r ? Number(r.renewal_price) : null, discount,
          matchesRule: price != null && base != null ? matchesRule(price, base, per.months, discount) : false }
      }),
      otherCycles: mine.filter(x => !FAMILY_PERIODS.some(per => per.cycle === x.cycle)).map(x => ({ cycle: x.cycle, months: Number(x.months), price: Number(x.price), active: !!Number(x.active) })),
    }
  })
}

/** Cartão público: só planos à venda (com pelo menos um dos 4 períodos publicado) ou sob consulta. */
export interface PublicFamilyPlan {
  slug: string; name: string; description: string | null; badge: string | null; highlight: boolean; onRequest: boolean; base: number | null
  features: FamilyFeature[]; periods: { cycle: string; months: number; total: number; renewal: number; discount: number }[]
}
export async function publicFamilyPlans(family: PlanFamily): Promise<PublicFamilyPlan[]> {
  const plans = await loadFamilyPlans(family)
  return plans.filter(p => p.saleStatus === 'on_request' || (p.saleStatus === 'active' && p.periods.some(x => x.active && x.price != null)))
    .map(p => ({
      slug: p.slug, name: p.name, description: p.description, badge: p.badge, highlight: p.highlight, onRequest: p.saleStatus === 'on_request', base: p.baseMonthly,
      features: p.features.filter(f => f.text), // linhas sem texto não aparecem no site
      periods: p.saleStatus === 'on_request' ? [] : p.periods.filter(x => x.active && x.price != null).map(x => ({
        cycle: x.cycle, months: x.months, total: x.price!, renewal: x.renewal ?? x.price!,
        // Desconto mostrado = o que o cliente poupa face ao preço base (0 → sem preço riscado nem «Poupe»)
        discount: impliedDiscount(x.price!, p.baseMonthly, x.months),
      })),
    }))
}

// ── validação ──
// Texto simples: só se retiram caracteres de controlo; o site mostra-o sempre como texto (nunca como HTML)
const text = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const intIn = (v: unknown, field: string, label: string, min: number, max: number): number => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < min || n > max) throw new FamilyPlanError(`${label}: indique um número inteiro entre ${min} e ${max.toLocaleString('pt-PT')}.`, field)
  return n
}
const money = (v: unknown, field: string, label: string) => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n <= 0 || n > 100_000_000 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new FamilyPlanError(`${label}: valor em Kz maior que 0, até 2 casas decimais.`, field)
  return Math.round(n * 100) / 100
}
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export interface FamilyPlanInput {
  id?: string; name: unknown; description?: unknown; saleStatus?: unknown; position?: unknown; badge?: unknown; highlight?: unknown
  baseMonthly?: unknown; features?: unknown
  /** discount null = manter o preço guardado; publish = período à venda; renewal null = manter (novo: base × meses) */
  periods?: { cycle: unknown; discount?: unknown; publish?: unknown; renewal?: unknown }[]
}

/** Cria (sem id) ou actualiza um plano da família. Valida e calcula tudo no servidor. */
export async function saveFamilyPlan(family: PlanFamily, input: FamilyPlanInput): Promise<string> {
  const fam = PLAN_FAMILIES[family]
  const w = where(family)
  const name = text(input.name, 80)
  if (name.length < 2) throw new FamilyPlanError('Indique o nome do plano (2 a 80 caracteres).', 'name')
  const description = text(input.description, 160) || null
  const saleStatus = String(input.saleStatus ?? 'draft')
  if (!['active', 'draft', 'on_request'].includes(saleStatus)) throw new FamilyPlanError('Estado inválido.', 'saleStatus')
  const position = intIn(input.position ?? 0, 'position', 'Ordem', 0, 9999)
  const badge = text(input.badge, 24) || null
  const highlight = input.highlight === true || input.highlight === 1 || input.highlight === '1'
  // Sob consulta sem preços: o preço base é opcional; nos restantes é obrigatório
  const baseRaw = input.baseMonthly
  const base = (baseRaw === '' || baseRaw === null || baseRaw === undefined) && saleStatus !== 'active' ? null : money(baseRaw, 'baseMonthly', 'Preço mensal base')

  // features ausente = manter as características gravadas (ex.: alterar só preços pela API)
  const keepFeatures = input.features === undefined
  const features: FamilyFeature[] = []
  if (!keepFeatures) {
    if (!Array.isArray(input.features)) throw new FamilyPlanError('Características inválidas.', 'features')
    for (const [i, f] of (input.features as any[]).entries()) {
      const t = text(typeof f === 'string' ? f : f?.text, 120)
      // Nunca descartar em silêncio: uma linha só com ícone é um erro a corrigir no painel
      if (!t) throw new FamilyPlanError(`Característica n.º ${i + 1}: escreva o «Texto da característica» (o ícone sozinho não descreve o plano) ou apague a linha.`, 'features')
      const icon = typeof f === 'string' || f?.icon == null || f.icon === '' ? null : f.icon
      if (icon !== null && !isVpsIcon(icon)) throw new FamilyPlanError(`Característica n.º ${i + 1}: ícone fora da lista permitida.`, 'features')
      features.push({ text: t, icon, included: typeof f === 'string' ? true : f?.included !== false })
    }
    if (features.length > 30) throw new FamilyPlanError('No máximo 30 características.', 'features')
  }

  const per = new Map((input.periods ?? []).map(p => [String(p?.cycle), p]))
  for (const c of per.keys()) if (!FAMILY_PERIODS.some(p => p.cycle === c)) throw new FamilyPlanError(`Período indisponível para novas contratações: ${c}. Use 1 mês, 1 ano, 2 anos ou 3 anos.`, 'periods')

  const id = await withTransaction(async conn => {
    let pid = input.id ? String(input.id) : ''
    if (pid) {
      const [p] = await rows(conn, `SELECT id FROM products WHERE id = ? AND ${w.sql} FOR UPDATE`, [pid, ...w.args])
      if (!p) throw new FamilyPlanError(`Plano inexistente em «${fam.label}».`)
      const [dup] = await rows(conn, `SELECT id FROM products WHERE ${w.sql} AND LOWER(name) = LOWER(?) AND id <> ? AND active = 1`, [...w.args, name, pid])
      if (dup) throw new FamilyPlanError('Já existe um plano com esse nome nesta categoria.', 'name')
      // service_type, provisioning e whm_package NÃO são tocados: o modo de activação de cada produto mantém-se
      await conn.query('UPDATE products SET name = ?, description = ?, sale_status = ?, position = ?, badge = ?, popular = ?, base_monthly_price = ? WHERE id = ?',
        [name, description, saleStatus, position, badge, highlight ? 1 : 0, base, pid])
    } else {
      const [dup] = await rows(conn, `SELECT id FROM products WHERE ${w.sql} AND LOWER(name) = LOWER(?) AND active = 1`, [...w.args, name])
      if (dup) throw new FamilyPlanError('Já existe um plano com esse nome nesta categoria.', 'name')
      let slug = `${fam.slugPrefix}-${slugify(name).replace(new RegExp(`^${fam.slugPrefix}-`), '')}`
      const [s] = await rows(conn, 'SELECT id FROM products WHERE slug = ?', [slug])
      if (s) slug = `${slug}-${randomUUID().slice(0, 4)}`
      pid = randomUUID()
      // Novo plano: o mesmo modo de activação dos planos existentes desta categoria (o mais recente), ou o padrão
      const [ref] = await rows(conn, `SELECT service_type, provisioning FROM products WHERE ${w.sql} ORDER BY created_at DESC LIMIT 1`, w.args)
      await conn.query(`INSERT INTO products (id, slug, category, subcategory, name, description, sale_status, position, badge, popular, active, base_monthly_price,
          service_type, provisioning, max_quantity, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, 'AOA')`,
        [pid, slug, fam.category, fam.subcategory, name, description, saleStatus, position, badge, highlight ? 1 : 0, base, ref?.service_type ?? fam.serviceType, ref?.provisioning ?? fam.provisioning])
    }
    if (!keepFeatures) {
      await conn.query('DELETE FROM product_features WHERE product_id = ?', [pid])
      for (const [i, f] of features.entries())
        await conn.query('INSERT INTO product_features (id, product_id, feature, included, position, icon) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), pid, f.text, f.included ? 1 : 0, i + 1, f.icon])
    }

    const existing = await rows(conn, 'SELECT cycle, price, renewal_price, discount_pct, active FROM product_prices WHERE product_id = ? FOR UPDATE', [pid])
    for (const p of FAMILY_PERIODS) {
      const raw = per.get(p.cycle), cur = existing.find(x => x.cycle === p.cycle)
      if (!raw && !cur) continue
      const publish = raw ? raw.publish === true : !!Number(cur?.active)
      const keep = !raw || raw.discount === null || raw.discount === undefined || raw.discount === ''
      if (keep && !cur) { if (publish) throw new FamilyPlanError(`${p.label}: defina o desconto (pode ser 0) antes de publicar.`, `discount-${p.cycle}`); continue }
      if (!keep && base == null) throw new FamilyPlanError('Indique o preço mensal base para calcular os períodos.', 'baseMonthly')
      const discount = keep ? Number(cur!.discount_pct ?? 0) : intIn(raw!.discount, `discount-${p.cycle}`, `Desconto (${p.label})`, 0, MAX_DISCOUNT)
      const price = keep ? Number(cur!.price) : exactPeriodTotal(base!, p.months, discount)
      if (!(price > 0)) throw new FamilyPlanError(`${p.label}: o total tem de ser maior que 0.`, `discount-${p.cycle}`)
      const renewal = raw && raw.renewal !== null && raw.renewal !== undefined && raw.renewal !== ''
        ? money(raw.renewal, `renewal-${p.cycle}`, `Renovação (${p.label})`)
        : cur ? Number(cur.renewal_price) : exactPeriodTotal(base!, p.months, 0) // novo período: renova ao preço sem desconto
      await conn.query(`INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, discount_pct, reference)
          VALUES (UUID(), ?, ?, ?, ?, ?, 'AKZ', ?, ?, JSON_OBJECT('edited_by_admin', TRUE))
        ON DUPLICATE KEY UPDATE price = VALUES(price), renewal_price = VALUES(renewal_price), active = VALUES(active), discount_pct = VALUES(discount_pct),
          reference = IF(price <> VALUES(price) OR renewal_price <> VALUES(renewal_price), JSON_SET(COALESCE(reference, '{}'), '$.edited_by_admin', TRUE), reference)`,
        [pid, p.cycle, p.months, price, renewal, publish ? 1 : 0, discount])
    }
    // Outros ciclos (3 e 6 meses): ficam guardados como estavam (renovações e facturas antigas), mas não se vendem.
    const [n] = await rows(conn, `SELECT COUNT(*) n FROM product_prices WHERE product_id = ? AND active = 1 AND cycle IN (${FAMILY_PERIODS.map(() => '?').join(',')})`, [pid, ...FAMILY_PERIODS.map(p => p.cycle)])
    if (saleStatus === 'active' && !Number(n.n)) throw new FamilyPlanError('Para pôr à venda, publique pelo menos um período (1 mês, 1 ano, 2 anos ou 3 anos).', 'periods')
    const [slugRow] = await rows(conn, 'SELECT slug FROM products WHERE id = ?', [pid])
    await syncDisplay(conn, pid, slugRow.slug)
    return pid
  })
  revalidateTag('catalog', { expire: 0 })
  return id
}
