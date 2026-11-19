import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- espelha a tipagem 'any' do supabase-js sem tipos gerados */
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPool, withTransaction, type Queryable } from './pool'
import { toDbError } from './executor'
import { fromDb } from './values'
import type { DbResponse } from './types'

// Funções PostgreSQL (schema public, SECURITY DEFINER) portadas para TypeScript.
// Cada uma corre numa transacção, preservando o contrato JSON devolvido.

type Args = Record<string, any>
type Row = Record<string, any>

const rows = async <T = Row>(db: Queryable, sql: string, params: unknown[] = []) => (await db.query(sql, params))[0] as T[]
const nullif = (v: unknown) => (v == null || v === '' ? null : v)

/** public.provision_order_services(p_order_id) */
async function provisionOrderServices(db: Queryable, orderId: string) {
  const [order] = await rows(db, 'SELECT user_id, billing_cycle FROM orders WHERE id = ?', [orderId])
  if (!order?.user_id) return { ok: false, error: 'order not found' }
  const items = await rows(db, 'SELECT id, service_name, service_type, price, quantity FROM order_items WHERE order_id = ?', [orderId])
  let created = 0
  for (const it of items) {
    const [exists] = await rows(db, 'SELECT 1 AS x FROM services WHERE order_id = ? AND service_name <=> ? LIMIT 1', [orderId, it.service_name])
    if (!exists) {
      await db.query(
        `INSERT INTO services (id, profile_id, plan_id, service_type, service_name, status, order_id, price, billing_cycle)
         VALUES (?, ?, NULL, ?, ?, 'pending_provisioning', ?, ?, ?)`,
        [randomUUID(), order.user_id, it.service_type, it.service_name, orderId, it.price, order.billing_cycle ?? 'monthly'],
      )
      created++
    }
  }
  return { ok: true, created }
}

const FUNCTIONS: Record<string, (db: Queryable, a: Args) => Promise<unknown>> = {
  async create_order(db, a) {
    const orderId = randomUUID()
    await db.query(
      `INSERT INTO orders (id, user_id, billing_cycle, domain_name, domain_action, payment_method, amount, proof_file,
         transfer_ref, status, use_default_ns, ns1, ns2, ns3, ns4)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, a.p_user_id, a.p_billing_cycle, nullif(a.p_domain_name), nullif(a.p_domain_action), a.p_payment_method,
        a.p_amount, nullif(a.p_proof_file), nullif(a.p_transfer_ref), a.p_status,
        a.p_use_default_ns === false ? 0 : 1,
        nullif(a.p_ns1) ?? 'ns1.viralizahost.com', nullif(a.p_ns2) ?? 'ns2.viralizahost.com',
        nullif(a.p_ns3), nullif(a.p_ns4)],
    )
    const items: Row[] = Array.isArray(a.p_items) ? a.p_items : JSON.parse(a.p_items ?? '[]')
    for (const it of items) {
      await db.query('INSERT INTO order_items (id, order_id, service_name, service_type, price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), orderId, it.service_name ?? null, it.service_type ?? null, it.price == null ? null : Number(it.price), it.quantity == null ? null : parseInt(it.quantity, 10)])
      const [plan] = await rows(db, 'SELECT id FROM plans WHERE slug = ? LIMIT 1', [it.plan_slug ?? null])
      await db.query(`INSERT INTO services (id, profile_id, plan_id, service_type, service_name, status, order_id) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [randomUUID(), a.p_user_id, plan?.id ?? null, it.service_type ?? null, it.service_name ?? null, orderId])
    }
    if (a.p_domain_name) {
      const name = String(a.p_domain_name)
      const dot = name.indexOf('.')
      const base = name.split('.')[0]
      const ext = '.' + (dot >= 0 ? name.slice(dot + 1) : name)
      await db.query(
        `INSERT INTO domains (id, profile_id, name, extension, status, order_id) VALUES (?, ?, ?, ?, 'pending', ?)
         ON DUPLICATE KEY UPDATE status = 'pending', order_id = VALUES(order_id), profile_id = VALUES(profile_id), updated_at = CURRENT_TIMESTAMP(6)`,
        [randomUUID(), a.p_user_id, base, ext, orderId],
      )
    }
    const now = new Date()
    const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const [seq] = await rows(db, 'SELECT COUNT(*) + 1 AS n FROM invoices WHERE invoice_number LIKE ? FOR UPDATE', [`VH-${ym}-%`])
    const invoiceNumber = `VH-${ym}-${String(seq.n).padStart(4, '0')}`
    const invoiceStatus = a.p_proof_file ? 'under_review' : 'pending'
    const invoiceItems = items.map(e => ({
      name: e.service_name ?? null, type: e.service_type ?? null,
      quantity: e.quantity == null ? null : parseInt(e.quantity, 10),
      unit_price: e.price == null ? null : Number(e.price), price: e.price == null ? null : Number(e.price),
    }))
    const invoiceId = randomUUID()
    // ON CONFLICT (order_id) DO NOTHING — invoices.order_id é UNIQUE
    const [res] = await db.query(
      `INSERT IGNORE INTO invoices (id, profile_id, order_id, invoice_number, status, currency, subtotal, discount, tax, total, amount_paid,
         due_date, issue_date, notes, proof_file, items)
       VALUES (?, ?, ?, ?, ?, 'AKZ', ?, 0, 0, ?, 0, CURRENT_DATE + INTERVAL 7 DAY, CURRENT_DATE, ?, ?, ?)`,
      [invoiceId, a.p_user_id, orderId, invoiceNumber, invoiceStatus, a.p_amount, a.p_amount,
        a.p_domain_name ? `Domínio: ${a.p_domain_name}` : null, nullif(a.p_proof_file), JSON.stringify(invoiceItems)],
    )
    const inserted = (res as { affectedRows: number }).affectedRows > 0
    return { id: orderId, status: a.p_status, invoice_id: inserted ? invoiceId : null }
  },

  async approve_order(db, a) {
    await db.query("UPDATE orders SET status = 'active', updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [a.p_order_id])
    await db.query("UPDATE services SET status = 'active' WHERE order_id = ?", [a.p_order_id])
    await db.query("UPDATE domains SET status = 'active', registered_at = CURRENT_TIMESTAMP(6), updated_at = CURRENT_TIMESTAMP(6) WHERE order_id = ?", [a.p_order_id])
    await db.query("UPDATE invoices SET status = 'paid', amount_paid = total, paid_at = CURRENT_TIMESTAMP(6), updated_at = CURRENT_TIMESTAMP(6) WHERE order_id = ?", [a.p_order_id])
    return { ok: true, status: 'active' }
  },

  async reject_order(db, a) {
    await db.query("UPDATE orders SET status = 'rejected', notes = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [a.p_notes ?? null, a.p_order_id])
    await db.query("UPDATE services SET status = 'cancelled' WHERE order_id = ?", [a.p_order_id])
    // No PostgreSQL esta função falhava sempre ('cancelled' não existe em domain_status)
    // e a rota /api/admin/orders caía no fallback, que não altera o domínio.
    // Reproduz-se esse comportamento efectivo: o domínio fica inalterado.
    await db.query("UPDATE invoices SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP(6) WHERE order_id = ?", [a.p_order_id])
    return { ok: true, status: 'rejected' }
  },

  async reconcile_unprovisioned_orders(db) {
    const orders = await rows(db, "SELECT DISTINCT o.id FROM orders o WHERE o.status = 'active' AND NOT EXISTS (SELECT 1 FROM services s WHERE s.order_id = o.id)")
    for (const o of orders) {
      await provisionOrderServices(db, o.id)
      await db.query("UPDATE services SET status = 'active', updated_at = CURRENT_TIMESTAMP(6) WHERE order_id = ? AND status = 'pending_provisioning'", [o.id])
    }
    return { ok: true, orders_processed: orders.length }
  },

  async provision_order_services(db, a) {
    return provisionOrderServices(db, a.p_order_id)
  },

  async get_client_invoices(db, a) {
    const page = Number(a.p_page ?? 1)
    const perPage = Math.max(Number(a.p_per_page ?? 20), 1)
    const offset = (Math.max(page, 1) - 1) * perPage
    const status = a.p_status ?? null
    const search = a.p_search ? `%${a.p_search}%` : null
    const [{ n }] = await rows(db,
      `SELECT COUNT(*) AS n FROM invoices i WHERE i.profile_id = ? AND (? IS NULL OR i.status = ?)
         AND (? IS NULL OR i.invoice_number LIKE ? OR i.notes LIKE ?)`,
      [a.p_user_id, status, status, search, search, search])
    const list = await rows(db,
      `SELECT i.id, i.invoice_number, i.order_id, i.status, i.currency, i.subtotal, i.discount, i.tax, i.total, i.amount_paid,
              GREATEST(0, i.total - COALESCE(i.amount_paid, 0)) AS outstanding,
              i.due_date, i.issue_date, i.paid_at, i.notes, i.proof_file, i.items, i.created_at,
              o.billing_cycle, o.domain_name, o.payment_method, o.transfer_ref
       FROM invoices i LEFT JOIN orders o ON o.id = i.order_id
       WHERE i.profile_id = ? AND (? IS NULL OR i.status = ?)
         AND (? IS NULL OR i.invoice_number LIKE ? OR i.notes LIKE ? OR o.domain_name LIKE ?)
       ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
      [a.p_user_id, status, status, search, search, search, search, perPage, offset])
    const orderIds = [...new Set(list.map(r => r.order_id).filter(Boolean))]
    const items = orderIds.length
      ? await rows(db, `SELECT order_id, service_name, service_type, price, quantity FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds)
      : []
    const ts = { kind: 'timestamp' as const }
    const invoices = list.map(r => ({
      ...r,
      due_date: fromDb(ts, r.due_date),
      paid_at: fromDb(ts, r.paid_at),
      created_at: fromDb(ts, r.created_at),
      items: fromDb({ kind: 'json' }, r.items),
      order_items: items.filter(i => i.order_id === r.order_id).map(r2 => { const rest = { ...r2 }; delete rest.order_id; return rest }),
    }))
    return { invoices, total: Number(n), page: a.p_page ?? 1, per_page: perPage }
  },

  async get_client_financial_summary(db, a) {
    const [s] = await rows(db,
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS paid,
         COALESCE(SUM(CASE WHEN status IN ('pending','overdue','partially_paid') THEN GREATEST(0, total - COALESCE(amount_paid,0)) ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN status = 'under_review' THEN GREATEST(0, total - COALESCE(amount_paid,0)) ELSE 0 END), 0) AS under_review
       FROM invoices WHERE profile_id = ?`, [a.p_user_id])
    const [c] = await rows(db, 'SELECT COALESCE(credit_balance, 0) AS credit FROM clients WHERE profile_id = ? LIMIT 1', [a.p_user_id])
    const [d] = await rows(db, "SELECT DATE(MIN(due_date)) AS next_due FROM invoices WHERE profile_id = ? AND status IN ('pending','overdue','partially_paid','under_review')", [a.p_user_id])
    return {
      total_paid: Number(s.paid), total_pending: Number(s.pending), total_under_review: Number(s.under_review),
      credit: Number(c?.credit ?? 0), next_due: d?.next_due ?? null,
    }
  },

  async check_product_catalog(db) {
    const [[p], [f]] = await Promise.all([
      rows(db, 'SELECT COUNT(*) AS n FROM products'), rows(db, 'SELECT COUNT(*) AS n FROM product_features'),
    ])
    return { exists: true, products: Number(p.n), features: Number(f.n) }
  },

  async check_banner_pages(db) {
    const [r] = await rows(db, 'SELECT COUNT(*) AS n FROM banner_pages')
    return { exists: true, count: Number(r.n) }
  },

  async setup_product_catalog(db) {
    await runSeedFile(db, 'product-catalog.sql')
    const [r] = await rows(db, 'SELECT COUNT(*) AS n FROM products')
    return { success: true, products: Number(r.n) }
  },

  async setup_banner_pages(db) {
    try {
      await runSeedFile(db, 'banner-pages.sql')
      const [r] = await rows(db, 'SELECT COUNT(*) AS n FROM banner_pages')
      return { success: true, message: `banner_pages criada com sucesso. ${r.n} registos encontrados.`, count: Number(r.n) }
    } catch (e) {
      return { success: false, message: (e as Error).message, sqlstate: toDbError(e).error.code }
    }
  },
}

async function runSeedFile(db: Queryable, file: string) {
  const sql = await readFile(join(process.cwd(), 'database/mariadb/seed', file), 'utf8')
  const statements = sql.split(/;\s*\n/).map(s => s.replace(/^--.*$/gm, '').trim()).filter(Boolean)
  for (const st of statements) await db.query(st)
}

export async function callRpc(fn: string, args: Args = {}): Promise<DbResponse> {
  const impl = FUNCTIONS[fn]
  if (!impl) {
    return { data: null, error: { message: `Could not find the function public.${fn} in the schema cache`, code: 'PGRST202', details: null, hint: null }, count: null, status: 404, statusText: 'Not Found' }
  }
  try {
    const data = await withTransaction(conn => impl(conn, args))
    return { data, error: null, count: null, status: 200, statusText: 'OK' }
  } catch (e) {
    const { error, status } = toDbError(e)
    return { data: null, error, count: null, status, statusText: 'Error' }
  }
}

export { getPool }
