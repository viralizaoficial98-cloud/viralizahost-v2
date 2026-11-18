import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
// Porta das funções PL/pgSQL chamadas por .rpc() (todas eram SECURITY DEFINER,
// por isso correm sem regras RLS, tal como no Supabase). Cada função corre numa
// transação MariaDB.
import { randomUUID } from 'node:crypto'
import type { PoolConnection } from 'mysql2/promise'
import { withTransaction, sql } from './pool'
import { decodeValue } from './codec'
import { mapMysqlError } from './executor'
import type { DbResult } from './types'

type Args = Record<string, any>
type Fn = (a: Args, conn: PoolConnection) => Promise<unknown>

const q = async (conn: PoolConnection, s: string, p: unknown[] = []) => (await conn.query(s, p as any[]))[0] as any[]
const nz = (v: unknown) => (v === undefined || v === null || v === '' ? null : v)
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const dt = (v: unknown) => decodeValue({ type: 'datetime' }, v)
const ymd = (d = new Date()) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`

const functions: Record<string, Fn> = {
  async approve_order({ p_order_id }, conn) {
    await q(conn, "UPDATE orders SET status = 'active', updated_at = UTC_TIMESTAMP(6) WHERE id = ?", [p_order_id])
    await q(conn, "UPDATE services SET status = 'active', updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [p_order_id])
    await q(conn, "UPDATE domains SET status = 'active', registered_at = UTC_TIMESTAMP(6), updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [p_order_id])
    await q(conn, "UPDATE invoices SET status = 'paid', amount_paid = total, paid_at = UTC_TIMESTAMP(6), updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [p_order_id])
    return { ok: true, status: 'active' }
  },

  async reject_order({ p_order_id, p_notes = null }, conn) {
    await q(conn, "UPDATE orders SET status = 'rejected', notes = ?, updated_at = UTC_TIMESTAMP(6) WHERE id = ?", [p_notes, p_order_id])
    await q(conn, "UPDATE services SET status = 'cancelled', updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [p_order_id])
    // O original fazia domains.status = 'cancelled', valor inexistente no enum domain_status:
    // a função falhava e a rota usava o fallback, que não altera domínios. Mantém-se esse comportamento.
    await q(conn, "UPDATE invoices SET status = 'cancelled', updated_at = UTC_TIMESTAMP(6) WHERE order_id = ?", [p_order_id])
    return { ok: true, status: 'rejected' }
  },

  async create_order(a, conn) {
    const orderId = randomUUID()
    const items: any[] = Array.isArray(a.p_items) ? a.p_items : JSON.parse(a.p_items ?? '[]')
    await q(conn, `INSERT INTO orders (id, user_id, billing_cycle, domain_name, domain_action, payment_method, amount, proof_file, transfer_ref, status, use_default_ns, ns1, ns2, ns3, ns4)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      orderId, a.p_user_id ?? null, a.p_billing_cycle, nz(a.p_domain_name), nz(a.p_domain_action), a.p_payment_method, a.p_amount,
      nz(a.p_proof_file), nz(a.p_transfer_ref), a.p_status, a.p_use_default_ns ?? true ? 1 : 0,
      nz(a.p_ns1) ?? 'ns1.viralizahost.com', nz(a.p_ns2) ?? 'ns2.viralizahost.com', nz(a.p_ns3), nz(a.p_ns4),
    ])
    for (const it of items) {
      await q(conn, 'INSERT INTO order_items (id, order_id, service_name, service_type, price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), orderId, it.service_name, it.service_type, it.price, Math.trunc(Number(it.quantity ?? 1))])
      const plan = it.plan_slug ? (await q(conn, 'SELECT id FROM plans WHERE slug = ? LIMIT 1', [it.plan_slug]))[0] : undefined
      await q(conn, "INSERT INTO services (id, profile_id, plan_id, service_type, service_name, status, order_id) VALUES (?, ?, ?, ?, ?, 'pending', ?)",
        [randomUUID(), a.p_user_id, plan?.id ?? null, it.service_type, it.service_name, orderId])
    }
    const dn: string | null = nz(a.p_domain_name) as string | null
    if (dn) {
      const dot = dn.indexOf('.')
      const base = dot >= 0 ? dn.slice(0, dot) : dn
      const ext = '.' + (dot >= 0 ? dn.slice(dot + 1) : '')
      // ON CONFLICT (name, extension) DO UPDATE
      await q(conn, `INSERT INTO domains (id, profile_id, name, extension, status, order_id) VALUES (?, ?, ?, ?, 'pending', ?)
        ON DUPLICATE KEY UPDATE status = 'pending', order_id = VALUES(order_id), profile_id = VALUES(profile_id), updated_at = UTC_TIMESTAMP(6)`,
        [randomUUID(), a.p_user_id, base, ext, orderId])
    }
    // Número VH-AAAAMM-NNNN (bloqueia as faturas do mês para evitar duplicados concorrentes)
    const prefix = `VH-${ymd()}-`
    const [{ c }] = await q(conn, 'SELECT COUNT(*) AS c FROM invoices WHERE invoice_number LIKE ? FOR UPDATE', [`${prefix}%`])
    let seq = Number(c) + 1
    let invoiceNumber = `${prefix}${String(seq).padStart(4, '0')}`
    while ((await q(conn, 'SELECT 1 FROM invoices WHERE invoice_number = ? LIMIT 1', [invoiceNumber])).length) invoiceNumber = `${prefix}${String(++seq).padStart(4, '0')}`
    const status = nz(a.p_proof_file) ? 'under_review' : 'pending'
    const invItems = items.map((e) => ({ name: e.service_name, type: e.service_type, quantity: Math.trunc(Number(e.quantity ?? 1)), unit_price: Number(e.price), price: Number(e.price) }))
    const existing = (await q(conn, 'SELECT id FROM invoices WHERE order_id = ? LIMIT 1', [orderId]))[0]
    let invoiceId: string | null = null
    if (!existing) {
      invoiceId = randomUUID()
      await q(conn, `INSERT INTO invoices (id, profile_id, order_id, invoice_number, status, currency, subtotal, discount, tax, total, amount_paid, due_date, issue_date, notes, proof_file, items)
        VALUES (?, ?, ?, ?, ?, 'AKZ', ?, 0, 0, ?, 0, UTC_DATE() + INTERVAL 7 DAY, UTC_DATE(), ?, ?, ?)`, [
        invoiceId, a.p_user_id, orderId, invoiceNumber, status, a.p_amount, a.p_amount,
        dn ? `Domínio: ${dn}` : null, nz(a.p_proof_file), JSON.stringify(invItems),
      ])
    }
    return { id: orderId, status: a.p_status, invoice_id: invoiceId }
  },

  async provision_order_services({ p_order_id }, conn) {
    const order = (await q(conn, 'SELECT user_id, billing_cycle FROM orders WHERE id = ?', [p_order_id]))[0]
    if (!order?.user_id) return { ok: false, error: 'order not found' }
    let created = 0
    for (const it of await q(conn, 'SELECT id, service_name, service_type, price, quantity FROM order_items WHERE order_id = ?', [p_order_id])) {
      const exists = await q(conn, 'SELECT 1 FROM services WHERE order_id = ? AND service_name <=> ? LIMIT 1', [p_order_id, it.service_name])
      if (!exists.length) {
        await q(conn, `INSERT INTO services (id, profile_id, plan_id, service_type, service_name, status, order_id, price, billing_cycle)
          VALUES (?, ?, NULL, ?, ?, 'pending_provisioning', ?, ?, ?)`, [randomUUID(), order.user_id, it.service_type, it.service_name, p_order_id, it.price, order.billing_cycle ?? 'monthly'])
        created++
      }
    }
    return { ok: true, created }
  },

  async reconcile_unprovisioned_orders(_a, conn) {
    const orders = await q(conn, "SELECT DISTINCT o.id FROM orders o WHERE o.status = 'active' AND NOT EXISTS (SELECT 1 FROM services s WHERE s.order_id = o.id)")
    for (const o of orders) {
      await functions.provision_order_services({ p_order_id: o.id }, conn)
      await q(conn, "UPDATE services SET status = 'active', updated_at = UTC_TIMESTAMP(6) WHERE order_id = ? AND status = 'pending_provisioning'", [o.id])
    }
    return { ok: true, orders_processed: orders.length }
  },

  async get_client_financial_summary({ p_user_id }, conn) {
    const [s] = await q(conn, `SELECT
        COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS paid,
        COALESCE(SUM(CASE WHEN status IN ('pending','overdue','partially_paid') THEN GREATEST(0, total - COALESCE(amount_paid, 0)) ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN status = 'under_review' THEN GREATEST(0, total - COALESCE(amount_paid, 0)) ELSE 0 END), 0) AS under_review
      FROM invoices WHERE profile_id = ?`, [p_user_id])
    const credit = (await q(conn, 'SELECT COALESCE(credit_balance, 0) AS c FROM clients WHERE profile_id = ? LIMIT 1', [p_user_id]))[0]?.c ?? 0
    const [n] = await q(conn, "SELECT DATE(MIN(due_date)) AS d FROM invoices WHERE profile_id = ? AND status IN ('pending','overdue','partially_paid','under_review')", [p_user_id])
    return { total_paid: num(s.paid), total_pending: num(s.pending), total_under_review: num(s.under_review), credit: num(credit), next_due: n?.d ? String(n.d).slice(0, 10) : null }
  },

  async get_client_invoices({ p_user_id, p_status = null, p_search = null, p_page = 1, p_per_page = 20 }, conn) {
    const per = Math.max(Number(p_per_page) || 20, 1)
    const offset = (Math.max(Number(p_page) || 1, 1) - 1) * per
    const like = p_search ? `%${String(p_search).replace(/[\\%_]/g, (m) => '\\' + m)}%` : null
    const statusSql = p_status ? ' AND i.status = ?' : ''
    const searchCount = like ? ' AND (i.invoice_number LIKE ? OR i.notes LIKE ?)' : ''
    const searchRows = like ? ' AND (i.invoice_number LIKE ? OR i.notes LIKE ? OR o.domain_name LIKE ?)' : ''
    const base = [p_user_id, ...(p_status ? [p_status] : [])]
    const [{ c }] = await q(conn, `SELECT COUNT(*) AS c FROM invoices i WHERE i.profile_id = ?${statusSql}${searchCount}`, [...base, ...(like ? [like, like] : [])])
    const rows = await q(conn, `SELECT i.id, i.invoice_number, i.order_id, i.status, i.currency, i.subtotal, i.discount, i.tax, i.total, i.amount_paid,
        GREATEST(0, i.total - COALESCE(i.amount_paid, 0)) AS outstanding, i.due_date, i.issue_date, i.paid_at, i.notes, i.proof_file, i.items, i.created_at,
        o.billing_cycle, o.domain_name, o.payment_method, o.transfer_ref
      FROM invoices i LEFT JOIN orders o ON o.id = i.order_id
      WHERE i.profile_id = ?${statusSql}${searchRows}
      ORDER BY i.created_at DESC LIMIT ? OFFSET ?`, [...base, ...(like ? [like, like, like] : []), per, offset])
    const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean))]
    const items = orderIds.length ? await q(conn, `SELECT order_id, service_name, service_type, price, quantity FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds) : []
    const invoices = rows.map((r) => ({
      id: r.id, invoice_number: r.invoice_number, order_id: r.order_id, status: r.status, currency: r.currency,
      subtotal: num(r.subtotal), discount: num(r.discount), tax: num(r.tax), total: num(r.total), amount_paid: num(r.amount_paid), outstanding: num(r.outstanding),
      due_date: dt(r.due_date), issue_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null, paid_at: dt(r.paid_at), notes: r.notes, proof_file: r.proof_file,
      items: decodeValue({ type: 'json' }, r.items), created_at: dt(r.created_at),
      billing_cycle: r.billing_cycle ?? null, domain_name: r.domain_name ?? null, payment_method: r.payment_method ?? null, transfer_ref: r.transfer_ref ?? null,
      order_items: items.filter((it) => it.order_id === r.order_id).map((it) => ({ service_name: it.service_name, service_type: it.service_type, price: num(it.price), quantity: it.quantity })),
    }))
    return { invoices, total: Number(c), page: p_page, per_page: per }
  },

  async check_product_catalog(_a, conn) {
    const [p] = await q(conn, 'SELECT COUNT(*) AS c FROM products')
    const [f] = await q(conn, 'SELECT COUNT(*) AS c FROM product_features')
    return { exists: true, products: Number(p.c), features: Number(f.c) }
  },
  async setup_product_catalog(_a, conn) {
    // As tabelas são criadas por database/mariadb/001_schema.sql e o catálogo vem da migração de dados.
    const [p] = await q(conn, 'SELECT COUNT(*) AS c FROM products')
    if (Number(p.c) === 0) throw Object.assign(new Error('Catálogo vazio: execute a importação de dados (scripts/mariadb/migrate-data.mjs).'), { errno: -1 })
    return { success: true, products: Number(p.c) }
  },
  async check_banner_pages(_a, conn) {
    const [p] = await q(conn, 'SELECT COUNT(*) AS c FROM banner_pages')
    return { exists: true, count: Number(p.c) }
  },
  async setup_banner_pages(_a, conn) {
    const [p] = await q(conn, 'SELECT COUNT(*) AS c FROM banner_pages')
    return { success: true, count: Number(p.c) }
  },
}

export async function callRpc(name: string, args: Args = {}): Promise<DbResult> {
  const fn = functions[name]
  if (!fn) return { data: null, error: { message: `Could not find the function public.${name} in the schema cache`, code: 'PGRST202', details: null, hint: null }, count: null, status: 404, statusText: 'Not Found' }
  try {
    const data = await withTransaction((conn) => fn(args ?? {}, conn))
    return { data, error: null, count: null, status: 200, statusText: 'OK' }
  } catch (e: any) {
    if (e?.errno === -1) return { data: null, error: { message: e.message, code: 'P0001', details: null, hint: null }, count: null, status: 400, statusText: 'Bad Request' }
    const { err, status } = mapMysqlError(e)
    console.error(`[rpc:${name}]`, e)
    return { data: null, error: err, count: null, status, statusText: 'Error' }
  }
}

void sql
