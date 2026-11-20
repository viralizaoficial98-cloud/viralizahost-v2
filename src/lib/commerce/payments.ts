import 'server-only'
import { randomUUID } from 'node:crypto'
import { withTransaction, type Queryable } from '@/lib/db/pool'

// Confirmação de pagamento — ponto único para:
//   * aprovação de comprovativo pelo administrador (source 'proof')
//   * notificação de gateway com assinatura já validada (source 'gateway', com eventId)
// O retorno do navegador NUNCA chama esta função.
// Idempotente: factura já paga → { alreadyPaid }, evento repetido → { duplicate }.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export class PaymentError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message) }
}

export interface ConfirmInput {
  invoiceId: string
  amount: number
  currency?: string
  source: 'proof' | 'gateway'
  method?: string
  eventId?: string | null
  reviewerId?: string | null
  paymentId?: string | null
}

export interface ConfirmResult {
  invoiceId: string
  orderId: string | null
  status: 'paid' | 'already_paid' | 'duplicate_event'
}

export async function confirmPayment(input: ConfirmInput): Promise<ConfirmResult> {
  return withTransaction(async conn => {
    if (input.eventId) {
      const [dup] = await rows(conn, 'SELECT invoice_id, order_id FROM payments WHERE gateway_event_id = ?', [input.eventId])
      if (dup) return { invoiceId: dup.invoice_id, orderId: dup.order_id, status: 'duplicate_event' }
    }
    const [inv] = await rows(conn, 'SELECT id, order_id, profile_id, status, total, amount_paid, currency FROM invoices WHERE id = ? FOR UPDATE', [input.invoiceId])
    if (!inv) throw new PaymentError('invoice_not_found', 'Factura inexistente.', 404)
    if (inv.status === 'paid') return { invoiceId: inv.id, orderId: inv.order_id, status: 'already_paid' }
    if (['cancelled', 'refunded'].includes(inv.status)) throw new PaymentError('invoice_closed', `Factura ${inv.status}.`, 409)
    if (inv.status === 'draft') throw new PaymentError('order_on_hold', 'Encomenda retida: a equipa ainda está a confirmar a disponibilidade de um domínio.', 409)
    const outstanding = Math.round((Number(inv.total) - Number(inv.amount_paid ?? 0)) * 100)
    if (input.currency && input.currency !== inv.currency) throw new PaymentError('currency_mismatch', 'Moeda do pagamento diferente da factura.', 409)
    if (Math.round(Number(input.amount) * 100) !== outstanding) {
      throw new PaymentError('amount_mismatch', `Valor recebido (${input.amount}) diferente do valor em dívida (${outstanding / 100}).`, 409)
    }

    if (input.paymentId) {
      await conn.query(`UPDATE payments SET status = 'approved', paid_at = CURRENT_TIMESTAMP(6), reviewed_at = CURRENT_TIMESTAMP(6), reviewed_by = ?, gateway_event_id = COALESCE(gateway_event_id, ?)
                        WHERE id = ? AND invoice_id = ?`, [input.reviewerId ?? null, input.eventId ?? null, input.paymentId, inv.id])
    } else {
      await conn.query(
        `INSERT INTO payments (id, invoice_id, profile_id, order_id, method, amount, currency, status, paid_at, reviewed_at, reviewed_by, gateway_event_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6), ?, ?)`,
        [randomUUID(), inv.id, inv.profile_id, inv.order_id, input.method ?? 'bank_transfer', input.amount, inv.currency, input.reviewerId ?? null, input.eventId ?? null],
      )
    }
    // Outros pagamentos pendentes da mesma factura deixam de estar activos
    await conn.query("UPDATE payments SET status = 'superseded' WHERE invoice_id = ? AND status IN ('pending','proof_uploaded','under_review') AND (? IS NULL OR id <> ?)", [inv.id, input.paymentId ?? null, input.paymentId ?? null])
    await conn.query("UPDATE invoices SET status = 'paid', amount_paid = total, paid_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [inv.id])
    if (inv.order_id) {
      await conn.query("UPDATE orders SET payment_status = 'paid', paid_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [inv.order_id])
    }
    return { invoiceId: inv.id, orderId: inv.order_id, status: 'paid' }
  })
}

/** Rejeita o comprovativo: a encomenda continua por pagar (pode enviar outro). */
export async function rejectProof(paymentId: string, reason: string, reviewerId: string) {
  return withTransaction(async conn => {
    const [p] = await rows(conn, 'SELECT id, invoice_id, order_id, status FROM payments WHERE id = ? FOR UPDATE', [paymentId])
    if (!p) throw new PaymentError('payment_not_found', 'Pagamento inexistente.', 404)
    if (p.status === 'approved') throw new PaymentError('already_approved', 'Pagamento já aprovado.', 409)
    await conn.query("UPDATE payments SET status = 'rejected', rejection_reason = ?, reviewed_at = CURRENT_TIMESTAMP(6), reviewed_by = ? WHERE id = ?", [reason.slice(0, 500), reviewerId, paymentId])
    await conn.query("UPDATE invoices SET status = 'rejected' WHERE id = ? AND status IN ('under_review','pending')", [p.invoice_id])
    if (p.order_id) await conn.query("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status <> 'paid'", [p.order_id])
    return { ok: true }
  })
}

/**
 * Decisão da equipa sobre um domínio «A confirmar» (ex.: .ao sem consulta automática).
 * Disponível → quando já não há domínios por confirmar, a factura passa a «por pagar».
 * Indisponível → a encomenda é cancelada sem qualquer pagamento (nada foi cobrado).
 */
export async function resolveDomainAvailability(orderItemId: string, available: boolean) {
  return withTransaction(async conn => {
    const [it] = await rows(conn, `SELECT oi.id, oi.order_id, oi.availability, oi.domain_name, o.hold_reason, o.payment_status
      FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? FOR UPDATE`, [orderItemId])
    if (!it) throw new PaymentError('item_not_found', 'Item inexistente.', 404)
    if (it.availability !== 'confirm') throw new PaymentError('not_pending', 'Este domínio não está a aguardar confirmação.', 409)
    if (available) {
      await conn.query("UPDATE order_items SET availability = 'confirmed' WHERE id = ?", [it.id])
      const [left] = await rows(conn, "SELECT COUNT(*) n FROM order_items WHERE order_id = ? AND availability = 'confirm'", [it.order_id])
      if (!Number(left.n)) {
        await conn.query('UPDATE orders SET hold_reason = NULL WHERE id = ?', [it.order_id])
        await conn.query("UPDATE invoices SET status = 'pending', due_date = CURRENT_DATE + INTERVAL 7 DAY WHERE order_id = ? AND status = 'draft'", [it.order_id])
      }
      return { released: !Number(left.n) }
    }
    await conn.query("UPDATE order_items SET availability = 'unavailable' WHERE id = ?", [it.id])
    await conn.query("UPDATE orders SET status = 'cancelled', activation_status = 'cancelled', hold_reason = 'domain_unavailable' WHERE id = ?", [it.order_id])
    await conn.query("UPDATE invoices SET status = 'cancelled' WHERE order_id = ? AND status IN ('draft','pending')", [it.order_id])
    await conn.query("UPDATE services SET status = 'cancelled' WHERE order_id = ? AND provisioning_status <> 'active'", [it.order_id])
    await conn.query("UPDATE domains SET status = 'cancelled' WHERE order_id = ? AND status = 'pending'", [it.order_id])
    return { released: false, cancelled: true }
  })
}
