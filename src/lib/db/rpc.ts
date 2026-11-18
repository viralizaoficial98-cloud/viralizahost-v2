/*
 * Funções RPC do PostgreSQL (schema public) reescritas para MySQL — mesma lógica e mesmo formato de resposta.
 * Todas eram SECURITY DEFINER; aqui correm numa transação com privilégios de serviço.
 * Só são acessíveis a partir do servidor (as rotas que as chamam já verificam o utilizador/admin).
 */
import { randomUUID } from 'node:crypto'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { withTransaction, DbFail, mapMysqlError } from './executor'
import { fromMysqlDatetime } from './values'
import catalog from './seeds/product-catalog.json'
import bannerPages from './seeds/banner-pages.json'
import type { DbResult } from './types'

type Args = Record<string, unknown>
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
const nullIfEmpty = (v: unknown) => (v === undefined || v === null || v === '' ? null : v)
const utcDate = (d = new Date()) => d.toISOString().slice(0, 10)
const yyyymm = (d = new Date()) => d.toISOString().slice(0, 7).replace('-', '')

async function q<T = RowDataPacket>(conn: PoolConnection, sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await conn.query<RowDataPacket[]>(sql, params)
  return rows as T[]
}

/* ─── create_order ─────────────────────────────────────────────────────── */
async function create_order(conn: PoolConnection, a: Args) {
  const userId = a.p_user_id as string
  const orderId = randomUUID()
  const items = (typeof a.p_items === 'string' ? JSON.parse(a.p_items) : a.p_items ?? []) as Record<string, unknown>[]
  const domain = nullIfEmpty(a.p_domain_name) as string | null
  const proof = nullIfEmpty(a.p_proof_file) as string | null

  await q(conn, `INSERT INTO orders (id, user_id, billing_cycle, domain_name, domain_action, payment_method, amount, proof_file, transfer_ref, status, use_default_ns, ns1, ns2, ns3, ns4)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    orderId, userId, a.p_billing_cycle, domain, nullIfEmpty(a.p_domain_action), a.p_payment_method, a.p_amount,
    proof, nullIfEmpty(a.p_transfer_ref), a.p_status, a.p_use_default_ns === false ? 0 : 1,
    nullIfEmpty(a.p_ns1) ?? 'ns1.viralizahost.com', nullIfEmpty(a.p_ns2) ?? 'ns2.viralizahost.com', nullIfEmpty(a.p_ns3), nullIfEmpty(a.p_ns4),
  ])

  for (const it of items) {
    await q(conn, 'INSERT INTO order_items (id, order_id, service_name, service_type, price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), orderId, it.service_name ?? null, it.service_type ?? null, it.price ?? null, it.quantity == null ? null : Math.trunc(Number(it.quantity))])
    const [plan] = await q(conn, 'SELECT id FROM plans WHERE slug = ? LIMIT 1', [it.plan_slug ?? null])
    await q(conn, "INSERT INTO services (id, profile_id, plan_id, service_type, service_name, status, order_id) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
      [randomUUID(), userId, plan?.id ?? null, it.service_type ?? null, it.service_name ?? null, orderId])
  }

  if (domain) {
    const dot = domain.indexOf('.')
    const base = dot >= 0 ? domain.slice(0, dot) : domain
    const ext = '.' + (dot >= 0 ? domain.slice(dot + 1) : domain.slice(1))
    await q(conn, `INSERT INTO domains (id, profile_id, name, extension, status, order_id) VALUES (?, ?, ?, ?, 'pending', ?)
      ON DUPLICATE KEY UPDATE status = 'pending', order_id = VALUES(order_id), profile_id = VALUES(profile_id), updated_at = UTC_TIMESTAMP(6)`,
      [randomUUID(), userId, base, ext, orderId])
  }

  const prefix = `VH-${yyyymm()}-`
  const [{ n }] = await q(conn, 'SELECT COUNT(*) AS n FROM invoices WHERE invoice_number LIKE ? FOR UPDATE', [prefix + '%'])
  const invoiceNumber = prefix + String(Number(n) + 1).padStart(4, '0')
  const invoiceItems = items.map(e => ({
    name: e.service_name ?? null, type: e.service_type ?? null,
    quantity: e.quantity == null ? null : Math.trunc(Number(e.quantity)),
    unit_price: e.price == null ? null : Number(e.price), price: e.price == null ? null : Number(e.price),
  }))
  const today = utcDate()
  const due = utcDate(new Date(Date.parse(today) + 7 * 86400_000)) + ' 00:00:00.000000'
  const [existing] = await q(conn, 'SELECT id FROM invoices WHERE order_id = ?', [orderId])
  let invoiceId: string | null = null
  if (!existing) {
    invoiceId = randomUUID()
    await q(conn, `INSERT INTO invoices (id, profile_id, order_id, invoice_number, status, currency, subtotal, discount, tax, total, amount_paid, due_date, issue_date, notes, proof_file, items)
      VALUES (?, ?, ?, ?, ?, 'AKZ', ?, 0, 0, ?, 0, ?, ?, ?, ?, ?)`, [
      invoiceId, userId, orderId, invoiceNumber, proof ? 'under_review' : 'pending', a.p_amount, a.p_amount, due, today,
      domain ? `Domínio: ${domain}` : null, proof, JSON.stringify(invoiceItems),
    ])
  }
  return { id: orderId, status: a.p_status, invoice_id: invoiceId }
}

/* ─── approve_order / reject_order ─────────────────────────────────────── */
async function approve_order(conn: PoolConnection, a: Args) {
  const id = a.p_order_id
  await q(conn, "UPDATE orders SET status = 'active', updated_at = UTC_TIMESTAMP(6) WHERE id = ?", [id])
  await q(conn, "UPDATE services SET status = 'active' WHERE order_id = ?", [id])
  await q(conn, "UPDATE domains SET status = 'active', registered_at = UTC_TIMESTAMP(6), updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [id])
  await q(conn, "UPDATE invoices SET status = 'paid', amount_paid = total, paid_at = UTC_TIMESTAMP(6), updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [id])
  return { ok: true, status: 'active' }
}

async function reject_order(conn: PoolConnection, a: Args) {
  const id = a.p_order_id
  await q(conn, "UPDATE orders SET status = 'rejected', notes = ?, updated_at = UTC_TIMESTAMP(6) WHERE id = ?", [a.p_notes ?? null, id])
  await q(conn, "UPDATE services SET status = 'cancelled' WHERE order_id = ?", [id])
  // Nota: 'cancelled' não existe no ENUM domain_status — tal como no PostgreSQL, isto falha se a encomenda tiver domínio.
  await q(conn, "UPDATE domains SET status = 'cancelled', updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [id])
  await q(conn, "UPDATE invoices SET status = 'cancelled', updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [id])
  return { ok: true, status: 'rejected' }
}

/* ─── provision_order_services / reconcile_unprovisioned_orders ────────── */
async function provision_order_services(conn: PoolConnection, a: Args) {
  const id = a.p_order_id
  const [order] = await q(conn, 'SELECT user_id, billing_cycle FROM orders WHERE id = ?', [id])
  if (!order?.user_id) return { ok: false, error: 'order not found' }
  let created = 0
  for (const it of await q(conn, 'SELECT id, service_name, service_type, price, quantity FROM order_items WHERE order_id = ?', [id])) {
    const [exists] = await q(conn, 'SELECT 1 FROM services WHERE order_id = ? AND service_name <=> ? LIMIT 1', [id, it.service_name])
    if (!exists) {
      await q(conn, `INSERT INTO services (id, profile_id, plan_id, service_type, service_name, status, order_id, price, billing_cycle)
        VALUES (?, ?, NULL, ?, ?, 'pending_provisioning', ?, ?, ?)`,
        [randomUUID(), order.user_id, it.service_type, it.service_name, id, it.price, order.billing_cycle ?? 'monthly'])
      created++
    }
  }
  return { ok: true, created }
}

async function reconcile_unprovisioned_orders(conn: PoolConnection) {
  let total = 0
  for (const o of await q(conn, "SELECT DISTINCT o.id FROM orders o WHERE o.status = 'active' AND NOT EXISTS (SELECT 1 FROM services s WHERE s.order_id = o.id)")) {
    await provision_order_services(conn, { p_order_id: o.id })
    await q(conn, "UPDATE services SET status = 'active', updated_at = UTC_TIMESTAMP(6) WHERE order_id = ? AND status = 'pending_provisioning'", [o.id])
    total++
  }
  return { ok: true, orders_processed: total }
}

/* ─── get_client_invoices / get_client_financial_summary ───────────────── */
async function get_client_invoices(conn: PoolConnection, a: Args) {
  const page = Number(a.p_page ?? 1), perPage = Math.max(Number(a.p_per_page ?? 20), 1)
  const offset = (Math.max(page, 1) - 1) * perPage
  const status = (a.p_status ?? null) as string | null
  const search = (a.p_search ?? null) as string | null
  const like = `%${search ?? ''}%`
  const hasSearch = search !== null && search !== ''
  const [{ n }] = await q(conn, `SELECT COUNT(*) AS n FROM invoices i WHERE i.profile_id = ? AND (? IS NULL OR i.status = ?)
      AND (? = 0 OR LOWER(i.invoice_number) LIKE LOWER(?) OR LOWER(i.notes) LIKE LOWER(?))`,
    [a.p_user_id, status, status, hasSearch ? 1 : 0, like, like])
  const rows = await q(conn, `SELECT i.id, i.invoice_number, i.order_id, i.status, i.currency, i.subtotal, i.discount, i.tax, i.total, i.amount_paid,
        GREATEST(0, i.total - COALESCE(i.amount_paid, 0)) AS outstanding, i.due_date, i.issue_date, i.paid_at, i.notes, i.proof_file, i.items, i.created_at,
        o.billing_cycle, o.domain_name, o.payment_method, o.transfer_ref
      FROM invoices i LEFT JOIN orders o ON o.id = i.order_id
      WHERE i.profile_id = ? AND (? IS NULL OR i.status = ?)
        AND (? = 0 OR LOWER(i.invoice_number) LIKE LOWER(?) OR LOWER(i.notes) LIKE LOWER(?) OR LOWER(o.domain_name) LIKE LOWER(?))
      ORDER BY i.created_at DESC LIMIT ${perPage} OFFSET ${offset}`,
    [a.p_user_id, status, status, hasSearch ? 1 : 0, like, like, like])
  const orderIds = rows.map(r => r.order_id).filter(Boolean)
  const items = orderIds.length ? await q(conn, `SELECT order_id, service_name, service_type, price, quantity FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(', ')})`, orderIds) : []
  const invoices = rows.map(r => ({
    id: r.id, invoice_number: r.invoice_number, order_id: r.order_id, status: r.status, currency: r.currency,
    subtotal: num(r.subtotal), discount: num(r.discount), tax: num(r.tax), total: num(r.total), amount_paid: num(r.amount_paid), outstanding: num(r.outstanding),
    due_date: fromMysqlDatetime(r.due_date), issue_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null, paid_at: fromMysqlDatetime(r.paid_at),
    notes: r.notes, proof_file: r.proof_file, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items, created_at: fromMysqlDatetime(r.created_at),
    billing_cycle: r.billing_cycle ?? null, domain_name: r.domain_name ?? null, payment_method: r.payment_method ?? null, transfer_ref: r.transfer_ref ?? null,
    order_items: items.filter(x => x.order_id === r.order_id).map(x => ({ service_name: x.service_name, service_type: x.service_type, price: num(x.price), quantity: num(x.quantity) })),
  }))
  return { invoices, total: Number(n), page: a.p_page ?? 1, per_page: perPage }
}

async function get_client_financial_summary(conn: PoolConnection, a: Args) {
  const [s] = await q(conn, `SELECT
      COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS paid,
      COALESCE(SUM(CASE WHEN status IN ('pending','overdue','partially_paid') THEN GREATEST(0, total - COALESCE(amount_paid,0)) ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN status = 'under_review' THEN GREATEST(0, total - COALESCE(amount_paid,0)) ELSE 0 END), 0) AS under_review
    FROM invoices WHERE profile_id = ?`, [a.p_user_id])
  const [c] = await q(conn, 'SELECT COALESCE(credit_balance, 0) AS credit FROM clients WHERE profile_id = ? LIMIT 1', [a.p_user_id])
  const [d] = await q(conn, "SELECT MIN(due_date) AS next_due FROM invoices WHERE profile_id = ? AND status IN ('pending','overdue','partially_paid','under_review')", [a.p_user_id])
  return {
    total_paid: Number(s.paid), total_pending: Number(s.pending), total_under_review: Number(s.under_review),
    credit: Number(c?.credit ?? 0), next_due: d?.next_due ? String(d.next_due).slice(0, 10) : null,
  }
}

/* ─── Catálogo de produtos e banners das páginas (dados semeados) ──────── */
async function setup_product_catalog(conn: PoolConnection) {
  for (const block of catalog.blocks as { insertCols: string[]; updateCols: string[]; rows: Record<string, unknown>[] }[]) {
    for (const row of block.rows) {
      const cols = ['id', ...block.insertCols]
      const vals = [randomUUID(), ...block.insertCols.map(c => (typeof row[c] === 'boolean' ? (row[c] ? 1 : 0) : row[c]))]
      const upd = [...block.updateCols.map(c => `\`${c}\` = VALUES(\`${c}\`)`), '`updated_at` = UTC_TIMESTAMP(6)']
      await q(conn, `INSERT INTO products (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${upd.join(', ')}`, vals)
    }
  }
  for (const slug of catalog.featureSlugs) {
    const [p] = await q(conn, 'SELECT id FROM products WHERE slug = ?', [slug])
    if (!p) continue
    await q(conn, 'DELETE FROM product_features WHERE product_id = ?', [p.id])
    for (const f of catalog.features.filter(x => x.slug === slug))
      await q(conn, 'INSERT INTO product_features (id, product_id, feature, included, position) VALUES (?, ?, ?, ?, ?)', [randomUUID(), p.id, f.feature, f.included ? 1 : 0, f.position])
  }
  const [{ n }] = await q(conn, 'SELECT COUNT(*) AS n FROM products')
  return { success: true, products: Number(n) }
}

async function check_product_catalog(conn: PoolConnection) {
  const [{ p }] = await q(conn, 'SELECT COUNT(*) AS p FROM products')
  const [{ f }] = await q(conn, 'SELECT COUNT(*) AS f FROM product_features')
  return { exists: true, products: Number(p), features: Number(f) }
}

async function setup_banner_pages(conn: PoolConnection) {
  try {
    const cols = bannerPages.columns
    for (const row of bannerPages.rows as Record<string, unknown>[]) {
      const vals = cols.map(c => { const v = row[c]; return Array.isArray(v) ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v })
      await q(conn, `INSERT INTO banner_pages (\`id\`, ${cols.map(c => `\`${c}\``).join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE \`page_slug\` = \`page_slug\``, [randomUUID(), ...vals])
    }
    const [{ n }] = await q(conn, 'SELECT COUNT(*) AS n FROM banner_pages')
    return { success: true, message: `banner_pages criada com sucesso. ${n} registos encontrados.`, count: Number(n) }
  } catch (e) {
    const err = e as { message?: string; sqlState?: string }
    return { success: false, message: err.message, sqlstate: err.sqlState ?? null }
  }
}

async function check_banner_pages(conn: PoolConnection) {
  const [{ n }] = await q(conn, 'SELECT COUNT(*) AS n FROM banner_pages')
  return { exists: true, count: Number(n) }
}

const RPCS: Record<string, (conn: PoolConnection, a: Args) => Promise<unknown>> = {
  create_order, approve_order, reject_order, provision_order_services, reconcile_unprovisioned_orders,
  get_client_invoices, get_client_financial_summary,
  setup_product_catalog, check_product_catalog, setup_banner_pages, check_banner_pages,
}

export async function callRpc(name: string, args: Args = {}): Promise<DbResult> {
  const fn = RPCS[name]
  if (!fn) return { data: null, error: { message: `Could not find the function public.${name} in the schema cache`, code: 'PGRST202', details: null, hint: null }, count: null, status: 404, statusText: 'Not Found' }
  try {
    const data = await withTransaction(conn => fn(conn, args))
    return { data, error: null, count: null, status: 200, statusText: 'OK' }
  } catch (e) {
    const f = e instanceof DbFail ? e : mapMysqlError(e)
    return { data: null, error: { message: f.message, code: f.code, details: f.details, hint: f.hint }, count: null, status: f.status, statusText: 'Error' }
  }
}
