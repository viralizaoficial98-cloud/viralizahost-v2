import 'server-only'
import { randomUUID } from 'node:crypto'
import { withTransaction, type Queryable } from '@/lib/db/pool'
import { encryptSecret } from '@/lib/crypto'
import { quoteCart, type CartLineInput, type Quote } from './quote'
import { splitDomain } from './domains'

// Criação de encomendas: uma transacção, valores do servidor, idempotente por
// (utilizador, chave). Estados:
//   orders.status            pending → active | rejected | cancelled   (compatível com o painel)
//   orders.payment_status    unpaid → proof_submitted → paid | failed
//   orders.activation_status pending → in_progress → active | partial | manual_required | failed

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export const PAYMENT_METHODS_AVAILABLE = ['bank_transfer'] as const

export class OrderError extends Error {
  constructor(public code: string, message: string, public status = 400, public extra: Record<string, unknown> = {}) { super(message) }
}

export interface CreateOrderInput {
  userId: string
  idempotencyKey: string
  lines: CartLineInput[]
  acceptedTotal: number
  paymentMethod: string
  proofFile?: string | null
  transferRef?: string | null
  billingDetails?: Record<string, unknown> | null
  nameservers?: { useDefault: boolean; ns: string[] }
}

export interface OrderSummary {
  id: string
  order_number: string
  invoice_id: string | null
  invoice_number: string | null
  total: number
  currency: 'AKZ'
  status: string
  payment_status: string
  activation_status: string
  replayed?: boolean
}

function secretEpp(code: string): string {
  if (!process.env.WHM_ENCRYPTION_KEY || process.env.WHM_ENCRYPTION_KEY.length < 64) {
    throw new OrderError('transfer_unavailable', 'Transferências indisponíveis: cifra do código EPP não configurada.', 503)
  }
  return encryptSecret(code)
}

async function nextNumber(db: Queryable, table: 'orders' | 'invoices', col: string, prefix: string) {
  const [r] = await rows(db, `SELECT COUNT(*) + 1 AS n FROM ${table} WHERE ${col} LIKE ? FOR UPDATE`, [`${prefix}%`])
  return `${prefix}${String(r.n).padStart(4, '0')}`
}

async function summary(db: Queryable, orderId: string, replayed = false): Promise<OrderSummary> {
  const [o] = await rows(db, 'SELECT id, order_number, amount, status, payment_status, activation_status FROM orders WHERE id = ?', [orderId])
  const [i] = await rows(db, 'SELECT id, invoice_number FROM invoices WHERE order_id = ?', [orderId])
  return { id: o.id, order_number: o.order_number, invoice_id: i?.id ?? null, invoice_number: i?.invoice_number ?? null, total: Number(o.amount), currency: 'AKZ', status: o.status, payment_status: o.payment_status, activation_status: o.activation_status, ...(replayed ? { replayed: true } : {}) }
}

export async function createOrder(input: CreateOrderInput, attempt = 1): Promise<{ order: OrderSummary; quote: Quote }> {
  if (!/^[A-Za-z0-9-]{16,64}$/.test(input.idempotencyKey)) throw new OrderError('idempotency_key_invalid', 'Chave de pedido inválida.')
  if (!PAYMENT_METHODS_AVAILABLE.includes(input.paymentMethod as any)) {
    throw new OrderError('payment_method_unavailable', 'Método de pagamento indisponível.', 400)
  }

  return withTransaction(async conn => {
    // Repetição (duplo clique, nova tentativa): devolve a encomenda existente
    const [prev] = await rows(conn, 'SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ? FOR UPDATE', [input.userId, input.idempotencyKey])
    if (prev) return { order: await summary(conn, prev.id, true), quote: await quoteCart(input.lines, { db: conn, userId: input.userId, checkAvailability: false }) }

    // Renovações: bloqueia o serviço original para impedir duas renovações por pagar em paralelo
    const renewIds = input.lines.filter(l => (l as any)?.type === 'renewal').map(l => String((l as any).serviceId))
    if (renewIds.length) await conn.query(`SELECT id FROM services WHERE id IN (${renewIds.map(() => '?').join(',')}) FOR UPDATE`, renewIds)
    const quote = await quoteCart(input.lines, { db: conn, userId: input.userId, checkAvailability: true })
    if (!quote.valid) throw new OrderError('cart_invalid', 'Há itens que não podem ser encomendados.', 409, { quote })
    if (Math.round(quote.total * 100) !== Math.round(Number(input.acceptedTotal) * 100)) {
      throw new OrderError('price_changed', 'O total foi actualizado. Reveja a encomenda antes de confirmar.', 409, { quote })
    }

    const now = new Date()
    const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const orderId = randomUUID()
    const orderNumber = await nextNumber(conn, 'orders', 'order_number', `VH-ORD-${ym}-`)
    const firstDomain = quote.lines.find(l => l.domain)?.domain ?? null
    const firstDomainLine = quote.lines.find(l => l.type === 'domain')
    const ns = input.nameservers?.ns ?? []
    const cycle = quote.lines.find(l => l.cycle)?.cycle ?? '1year'
    const hasProof = !!input.proofFile

    await conn.query(
      `INSERT INTO orders (id, user_id, idempotency_key, order_number, billing_cycle, domain_name, domain_action, payment_method, amount, currency,
         subtotal, tax_rate, tax_amount, status, payment_status, activation_status, proof_file, transfer_ref, use_default_ns, ns1, ns2, ns3, ns4, billing_details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AKZ', ?, ?, ?, 'pending', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, input.userId, input.idempotencyKey, orderNumber, cycle, firstDomain, firstDomainLine?.operation ?? null, input.paymentMethod,
        quote.total, quote.subtotal, quote.taxRate, quote.tax, hasProof ? 'proof_submitted' : 'unpaid', input.proofFile ?? null, input.transferRef ?? null,
        input.nameservers?.useDefault === false ? 0 : 1, ns[0] || 'ns1.viralizahost.com', ns[1] || 'ns2.viralizahost.com', ns[2] || null, ns[3] || null,
        input.billingDetails ? JSON.stringify(input.billingDetails) : null],
    )

    const exts = (await rows<{ extension: string }>(conn, 'SELECT DISTINCT extension FROM domain_prices')).map(r => r.extension)
    const invoiceItems: any[] = []
    for (const l of quote.lines) {
      const itemId = randomUUID()
      const raw = input.lines[l.index] as any
      const epp = l.type === 'domain' && l.operation === 'transfer' && raw?.eppCode ? secretEpp(String(raw.eppCode)) : null
      await conn.query(
        `INSERT INTO order_items (id, order_id, service_name, service_type, price, quantity, product_id, product_slug, billing_cycle, months,
           unit_price, line_total, renewal_price, domain_name, domain_operation, epp_code_enc, renews_service_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, orderId, l.name, l.serviceType, l.unitPrice, l.quantity, l.productId ?? null, l.slug ?? null, l.cycle ?? null, l.months ?? null,
          l.unitPrice, l.lineTotal, l.renewalPrice, l.domain ?? null, l.type === 'domain' ? l.operation : (l.domainMode ?? null), epp, l.renewsServiceId ?? null],
      )
      // Serviço (um por item) — a activação acontece só depois do pagamento confirmado
      const serviceType = l.type === 'domain' ? 'domain' : l.serviceType
      await conn.query(
        `INSERT INTO services (id, profile_id, service_type, service_name, status, currency, price, billing_cycle, order_id, product_id, order_item_id,
           renews_service_id, domain, renewal_price, provisioning_status)
         VALUES (?, ?, ?, ?, 'pending', 'AKZ', ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [randomUUID(), input.userId, serviceType, l.name, l.lineTotal, l.cycle ?? '1year', orderId, l.productId ?? null, itemId, l.renewsServiceId ?? null, l.domain ?? null, l.renewalPrice],
      )
      if (l.type === 'domain' && l.operation !== 'renew' && l.domain) {
        const parts = splitDomain(l.domain, exts)!
        const [taken] = await rows(conn, 'SELECT profile_id FROM domains WHERE name = ? AND extension = ?', [parts.name, parts.extension])
        if (taken && taken.profile_id !== input.userId) throw new OrderError('domain_unavailable', 'O domínio já está associado a outra conta.', 409)
        await conn.query(
          `INSERT INTO domains (id, profile_id, name, extension, status, order_id, price_paid, currency)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, 'AKZ')
           ON DUPLICATE KEY UPDATE status = 'pending', order_id = VALUES(order_id), price_paid = VALUES(price_paid), updated_at = CURRENT_TIMESTAMP(6)`,
          [randomUUID(), input.userId, parts.name, parts.extension, orderId, l.lineTotal],
        )
      }
      invoiceItems.push({ name: l.name, type: l.type === 'domain' ? 'domain' : l.type === 'renewal' ? 'renewal' : l.serviceType, quantity: l.quantity, unit_price: l.unitPrice, price: l.lineTotal, cycle: l.cycle ?? null, renewal_price: l.renewalPrice })
    }

    const invoiceId = randomUUID()
    const invoiceNumber = await nextNumber(conn, 'invoices', 'invoice_number', `VH-${ym}-`)
    await conn.query(
      `INSERT INTO invoices (id, profile_id, order_id, invoice_number, status, currency, subtotal, discount, tax, total, amount_paid,
         due_date, issue_date, notes, proof_file, items)
       VALUES (?, ?, ?, ?, ?, 'AKZ', ?, 0, ?, ?, 0, CURRENT_DATE + INTERVAL 7 DAY, CURRENT_DATE, ?, ?, ?)`,
      [invoiceId, input.userId, orderId, invoiceNumber, hasProof ? 'under_review' : 'pending', quote.subtotal, quote.tax, quote.total,
        `Encomenda ${orderNumber}`, input.proofFile ?? null, JSON.stringify(invoiceItems)],
    )
    for (const [pos, it] of invoiceItems.entries()) {
      await conn.query('INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, subtotal, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), invoiceId, it.name, it.quantity, it.unit_price, it.price, pos + 1])
    }
    if (hasProof) {
      await conn.query(
        `INSERT INTO payments (id, invoice_id, profile_id, order_id, method, amount, currency, status, proof_url, transfer_ref, declared_amount)
         VALUES (?, ?, ?, ?, 'bank_transfer', ?, 'AKZ', 'under_review', ?, ?, ?)`,
        [randomUUID(), invoiceId, input.userId, orderId, quote.total, input.proofFile, input.transferRef ?? null, quote.total],
      )
    }
    return { order: await summary(conn, orderId), quote }
  }).catch(async e => {
    // Corrida entre duas submissões com a mesma chave: o MariaDB pode abortar uma
    // por deadlock (bloqueio de intervalo) — repete; a repetição encontra a vencedora.
    if ((e as { errno?: number }).errno === 1213 && attempt < 4) return createOrder(input, attempt + 1)
    if ((e as { errno?: number }).errno === 1062 && /idempotency/.test(String((e as Error).message))) {
      const pool = (await import('@/lib/db/pool')).getPool()
      const [prev] = await rows(pool, 'SELECT id FROM orders WHERE user_id = ? AND idempotency_key = ?', [input.userId, input.idempotencyKey])
      if (prev) return { order: await summary(pool, prev.id, true), quote: await quoteCart(input.lines, { userId: input.userId, checkAvailability: false }) }
    }
    throw e
  })
}

export async function orderSummary(db: Queryable, orderId: string) { return summary(db, orderId) }
