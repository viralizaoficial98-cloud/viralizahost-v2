import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { VPS_CYCLES } from '@/lib/commerce/vps-shared'
import { catalogMonths } from '@/lib/commerce/vps-plans'
import { CloudError, cycleSustainable, loadCloudSettings, suggestedPrice, type VpsFinance } from './cloud'
import { vpsClient } from './settings'

// Cloud VPS — indicadores (MariaDB + dados sincronizados do fornecedor) e finanças por plano/ciclo/serviço.
// Estratégia inicial: preço regular = custo de RENOVAÇÃO do fornecedor × câmbio × (1 + 100 %);
// preço promocional (1.º período) = custo inicial × câmbio × (1 + 100 %); extras (suporte/licenças) somados por mês.
// Os preços sugeridos só são gravados quando o administrador os aplica; a edição manual continua no editor de planos.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
const kzOf = (f: VpsFinance, minor: number | null, cur: string | null) => {
  const fx = cur === 'BRL' ? f.fxBrlAoa : cur === 'USD' ? f.fxUsdAoa : null
  return fx && minor != null ? Math.round((minor / 100) * fx * (1 + (f.bankFeePct + f.taxPct) / 100) * 100) / 100 : null
}

export async function cloudOverview() {
  const db = getPool()
  const f = (await loadCloudSettings(db)).finance
  const one = async (sql: string, p: unknown[] = []) => (await rows(db, sql, p))[0] ?? {}
  const inst = await one(`SELECT COUNT(*) total, SUM(is_internal = 1) internal, SUM(is_internal = 0) commercial, SUM(link_status = 'unlinked' AND is_internal = 0) unlinked,
    SUM(missing_since IS NOT NULL) missing, SUM(sub_next_billing_at IS NOT NULL AND sub_next_billing_at <= CURRENT_TIMESTAMP(6) + INTERVAL 30 DAY) provider_renewals FROM vps_instances`)
  const svc = await one(`SELECT COUNT(*) total, SUM(s.status = 'active') active, SUM(s.status = 'suspended') suspended,
      SUM(s.provisioning_status IN ('pending','in_progress') AND o.payment_status = 'paid') provisioning,
      SUM(s.provisioning_status = 'failed') failed_svc,
      SUM(s.status = 'active' AND s.next_due_date IS NOT NULL AND s.next_due_date <= CURRENT_DATE + INTERVAL 30 DAY) client_renewals,
      SUM(IF(s.status = 'active', s.price / GREATEST(COALESCE(oi.months, 1), 1), 0)) monthly_billing
    FROM services s JOIN products p ON p.id = s.product_id LEFT JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id
    WHERE p.category = 'vps' AND s.status <> 'cancelled'`)
  const req = await one(`SELECT SUM(status IN ('submitted','under_review')) pending, SUM(status IN ('approved','awaiting_payment','paid','purchase_authorized','provisioning')) approved,
    SUM(status = 'active') active FROM vps_requests`)
  const ops = await one("SELECT SUM(status IN ('failed','unknown')) failures, SUM(status IN ('submitting','submitted','payment_processing')) in_flight FROM vps_provider_orders")
  // Custos mensais do fornecedor dos serviços activos: custo esperado da compra (ou renovação da subscrição) ÷ meses
  const costs = await rows(db, `SELECT v.expected_cost_minor, v.currency, COALESCE(oi.months, 1) months, i.sub_renewal_minor, i.sub_currency, i.sub_billing_period, i.sub_billing_unit
    FROM vps_provider_orders v JOIN services s ON s.id = v.service_id LEFT JOIN order_items oi ON oi.id = s.order_item_id
    LEFT JOIN vps_instances i ON i.provider_vm_id = v.provider_vm_id WHERE v.status = 'active' AND s.status = 'active'`)
  let providerMonthly = 0, unknownCost = 0
  for (const c of costs) {
    const subMonths = c.sub_billing_period ? (/year/i.test(c.sub_billing_unit ?? '') ? c.sub_billing_period * 12 : c.sub_billing_period) : null
    const kz = c.sub_renewal_minor != null && subMonths ? kzOf(f, Number(c.sub_renewal_minor) / subMonths, c.sub_currency) : kzOf(f, c.expected_cost_minor != null ? Number(c.expected_cost_minor) / Number(c.months || 1) : null, c.currency)
    if (kz == null) unknownCost++; else providerMonthly += kz
  }
  const billing = Number(svc.monthly_billing ?? 0)
  const byState = await rows(db, `SELECT s.status, COUNT(*) n FROM services s JOIN products p ON p.id = s.product_id WHERE p.category = 'vps' GROUP BY s.status`)
  const reqByStatus = await rows(db, 'SELECT status, COUNT(*) n FROM vps_requests GROUP BY status')
  const renewals = await rows(db, `SELECT s.id, s.service_name, s.next_due_date, pr.email FROM services s JOIN products p ON p.id = s.product_id JOIN profiles pr ON pr.id = s.profile_id
    WHERE p.category = 'vps' AND s.status = 'active' AND s.next_due_date IS NOT NULL AND s.next_due_date <= CURRENT_DATE + INTERVAL 30 DAY ORDER BY s.next_due_date LIMIT 10`)
  const providerRenewals = await rows(db, `SELECT provider_vm_id, hostname, sub_next_billing_at, sub_renewal_minor, sub_currency, sub_auto_renew, is_internal FROM vps_instances
    WHERE sub_next_billing_at IS NOT NULL AND sub_next_billing_at <= CURRENT_TIMESTAMP(6) + INTERVAL 30 DAY ORDER BY sub_next_billing_at LIMIT 10`)
  return {
    vps: { total: Number(inst.total ?? 0), internal: Number(inst.internal ?? 0), commercial: Number(svc.total ?? 0), unlinked: Number(inst.unlinked ?? 0), missing: Number(inst.missing ?? 0),
      active: Number(svc.active ?? 0), suspended: Number(svc.suspended ?? 0), provisioning: Number(svc.provisioning ?? 0) },
    requests: { pending: Number(req.pending ?? 0), approved: Number(req.approved ?? 0), active: Number(req.active ?? 0) },
    money: { monthlyBilling: Math.round(billing * 100) / 100, providerMonthly: Math.round(providerMonthly * 100) / 100, grossMargin: Math.round((billing - providerMonthly) * 100) / 100, unknownCost, fxConfigured: !!(f.fxBrlAoa || f.fxUsdAoa) },
    renewals: { client: Number(svc.client_renewals ?? 0), provider: Number(inst.provider_renewals ?? 0), clientList: renewals, providerList: providerRenewals },
    failures: Number(ops.failures ?? 0) + Number(svc.failed_svc ?? 0), inFlight: Number(ops.in_flight ?? 0),
    charts: { servicesByState: byState.map(x => ({ label: x.status, n: Number(x.n) })), requestsByStatus: reqByStatus.map(x => ({ label: x.status, n: Number(x.n) })) },
  }
}

/** Finanças por plano e ciclo: venda, custos do fornecedor (inicial/renovação), margens, sustentabilidade e preço sugerido. */
export async function planFinance() {
  const db = getPool()
  const f = (await loadCloudSettings(db)).finance
  const prods = await rows(db, "SELECT id, slug, name, sale_status, provider_product_id, provider_mode, provider_finance FROM products WHERE category = 'vps' AND subcategory IS NULL AND active = 1 ORDER BY position, name")
  const prices = prods.length ? await rows(db, `SELECT * FROM product_prices WHERE product_id IN (${prods.map(() => '?').join(',')})`, prods.map(p => p.id)) : []
  return {
    finance: f,
    plans: prods.map(p => {
      const pf = (() => { try { return (typeof p.provider_finance === 'string' ? JSON.parse(p.provider_finance) : p.provider_finance) ?? {} } catch { return {} } })()
      const extraMonthly = Number(pf.supportMonthlyKz ?? 0) + Number(pf.licenseMonthlyKz ?? 0)
      const markup = pf.markupPct != null ? Number(pf.markupPct) : f.markupPct
      return {
        id: p.id, slug: p.slug, name: p.name, saleStatus: p.sale_status, providerProductId: p.provider_product_id, providerMode: p.provider_mode, extras: { supportMonthlyKz: Number(pf.supportMonthlyKz ?? 0), licenseMonthlyKz: Number(pf.licenseMonthlyKz ?? 0), markupPct: pf.markupPct ?? null },
        cycles: VPS_CYCLES.map(c => {
          const r = prices.find(x => x.product_id === p.id && x.cycle === c.cycle)
          const sale = r ? Number(r.price) : null, renewal = r ? Number(r.renewal_price) : null
          const initialKz = kzOf(f, r?.provider_cost_minor ?? null, r?.provider_currency ?? null), renewalKz = kzOf(f, r?.provider_renewal_minor ?? null, r?.provider_currency ?? null)
          return {
            cycle: c.cycle, months: c.months, active: !!(r && Number(r.active)), sale, renewal, itemId: r?.provider_item_id ?? null, currency: r?.provider_currency ?? null,
            initialMinor: r?.provider_cost_minor ?? null, renewalMinor: r?.provider_renewal_minor ?? null, limitMinor: r?.provider_cost_limit_minor ?? null,
            initialKz, renewalKz, marginFirst: sale != null && initialKz != null ? Math.round((sale - initialKz) * 100) / 100 : null, marginRenewal: renewal != null && renewalKz != null ? Math.round((renewal - renewalKz) * 100) / 100 : null,
            monthlyEquivalent: sale != null ? Math.round((sale / c.months) * 100) / 100 : null, upfront: sale,
            sustainable: renewal != null ? cycleSustainable(f, renewal, r?.provider_renewal_minor ?? null, r?.provider_currency ?? null) : null,
            suggestedPromo: suggestedPrice(f, r?.provider_cost_minor ?? null, r?.provider_currency ?? null, c.months, extraMonthly, markup),
            suggestedRegular: suggestedPrice(f, r?.provider_renewal_minor ?? null, r?.provider_currency ?? null, c.months, extraMonthly, markup),
          }
        }),
      }
    }),
  }
}

/** Sincroniza os custos do fornecedor (inicial = first_period_price, renovação = price) dos itens associados. Só custos. */
export async function syncPlanCosts(adminId: string) {
  const cl = await vpsClient('read')
  if ('error' in cl) throw new CloudError('provider', cl.error, 409)
  const catalog = await cl.client.catalog()
  const db = getPool()
  const items = new Map(catalog.flatMap(i => i.prices.map(p => [p.id, { ...p, months: catalogMonths(p) }] as const)))
  const linked = await rows(db, "SELECT pp.product_id, pp.cycle, pp.months, pp.provider_item_id FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND pp.provider_item_id IS NOT NULL")
  let updated = 0
  const missing: string[] = [], mismatch: string[] = []
  for (const l of linked) {
    const it = items.get(l.provider_item_id)
    if (!it) { missing.push(l.provider_item_id); continue }
    if (it.months !== Number(l.months)) { mismatch.push(`${l.provider_item_id} (${it.months} meses ≠ ${l.months})`); continue }
    await db.query('UPDATE product_prices SET provider_cost_minor = ?, provider_renewal_minor = ?, provider_currency = ? WHERE product_id = ? AND cycle = ?',
      [it.first_period_price ?? it.price, it.price, it.currency, l.product_id, l.cycle])
    updated++
  }
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'integration', 'cloud_vps', ?)", [adminId, `Cloud VPS: custos sincronizados (${updated} ciclo(s); ${missing.length} item(ns) inexistente(s); ${mismatch.length} período(s) incoerente(s))`]).catch(() => {})
  return { updated, missing, mismatch }
}

/** Aplica o preço sugerido (promocional e regular) a um ciclo — o administrador pode ajustar depois no editor. */
export async function applySuggested(adminId: string, productId: string, cycle: string) {
  const fin = await planFinance()
  const p = fin.plans.find(x => x.id === productId)
  const c = p?.cycles.find(x => x.cycle === cycle)
  if (!p || !c) throw new CloudError('not_found', 'Plano/ciclo inexistente.', 404)
  if (c.suggestedPromo == null || c.suggestedRegular == null) throw new CloudError('no_cost', 'Sem custo do fornecedor ou câmbio configurado: sincronize os custos e defina o câmbio.', 409)
  const db = getPool()
  const [u] = await db.query(`UPDATE product_prices SET price = ?, renewal_price = ?, reference = JSON_SET(COALESCE(reference, '{}'), '$.suggested_by_finance', TRUE) WHERE product_id = ? AND cycle = ?`,
    [c.suggestedPromo, Math.max(c.suggestedRegular, c.suggestedPromo), productId, cycle]) as any
  if (!u.affectedRows) throw new CloudError('no_cycle', 'Ciclo ainda não existe no plano: crie-o no editor de planos.', 409)
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'product', ?, ?)", [adminId, productId, `Cloud VPS: preço sugerido aplicado (${cycle}): ${c.suggestedPromo} Kz, renovação ${Math.max(c.suggestedRegular, c.suggestedPromo)} Kz`]).catch(() => {})
  const { revalidateTag } = await import('next/cache'); revalidateTag('catalog', { expire: 0 })
  return planFinance()
}

/** Extras por plano (suporte, licenças, acréscimo próprio). */
export async function savePlanExtras(adminId: string, productId: string, input: Record<string, unknown>) {
  const v = (x: unknown, label: string, max: number) => { if (x === null || x === '' || x === undefined) return null; const n = Number(x); if (!Number.isFinite(n) || n < 0 || n > max) throw new CloudError('invalid', `${label}: 0 a ${max}.`); return n }
  const pf = { supportMonthlyKz: v(input.supportMonthlyKz, 'Suporte (Kz/mês)', 10_000_000) ?? 0, licenseMonthlyKz: v(input.licenseMonthlyKz, 'Licenças (Kz/mês)', 10_000_000) ?? 0, markupPct: v(input.markupPct, 'Acréscimo (%)', 1000) }
  const [u] = await getPool().query("UPDATE products SET provider_finance = ? WHERE id = ? AND category = 'vps'", [JSON.stringify(pf), productId]) as any
  if (!u.affectedRows) throw new CloudError('not_found', 'Plano inexistente.', 404)
  await getPool().query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'product', ?, ?)", [adminId, productId, `Cloud VPS: extras do plano ${JSON.stringify(pf)}`]).catch(() => {})
  return planFinance()
}

/** Serviços VPS: venda, custo, margem, próxima cobrança ao cliente e do fornecedor. */
export async function serviceFinance() {
  const db = getPool()
  const f = (await loadCloudSettings(db)).finance
  const list = await rows(db, `SELECT s.id, s.service_name, s.status, s.price, s.renewal_price, s.next_due_date, COALESCE(oi.months, 1) months, pr.email,
      v.expected_cost_minor, v.currency, v.provider_vm_id, i.sub_renewal_minor, i.sub_currency, i.sub_next_billing_at, i.sub_auto_renew
    FROM services s JOIN products p ON p.id = s.product_id JOIN profiles pr ON pr.id = s.profile_id LEFT JOIN order_items oi ON oi.id = s.order_item_id
    LEFT JOIN vps_provider_orders v ON v.service_id = s.id LEFT JOIN vps_instances i ON i.provider_vm_id = v.provider_vm_id
    WHERE p.category = 'vps' AND s.status IN ('active','suspended') ORDER BY s.next_due_date LIMIT 200`)
  return list.map(r => {
    const costKz = kzOf(f, r.expected_cost_minor != null ? Number(r.expected_cost_minor) : null, r.currency)
    const renewKz = kzOf(f, r.sub_renewal_minor != null ? Number(r.sub_renewal_minor) : null, r.sub_currency)
    return { ...r, costKz, renewKz, margin: costKz != null ? Math.round((Number(r.price) - costKz) * 100) / 100 : null, marginRenewal: renewKz != null && r.renewal_price != null ? Math.round((Number(r.renewal_price) - renewKz) * 100) / 100 : null }
  })
}
