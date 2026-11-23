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

/** Registo no histórico de decisões sobre o domínio (quem, quando, o quê e porquê). */
async function domainEvent(conn: Queryable, it: { order_id: string; id: string; domain_name?: string | null }, action: string, note: string | null, adminId: string | null, proposed: string | null = null) {
  await conn.query('INSERT INTO order_domain_events (id, order_id, order_item_id, action, domain, proposed_domain, note, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), it.order_id, it.id, action, it.domain_name ?? null, proposed, note ? note.slice(0, 500) : null, adminId])
}
const clean = (v: unknown, max = 500) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * Decisão da equipa sobre um domínio «A confirmar» (ex.: .ao sem consulta automática).
 * O pagamento NÃO depende desta decisão (o cliente pode pagar logo); a decisão só liberta o registo.
 *   Disponível   → item «confirmado»; quando não há mais domínios por confirmar, retira a marca da encomenda.
 *                  Encomendas antigas retidas (factura em rascunho) passam a «por pagar», como antes.
 *                  Se a encomenda já estiver paga, a rota chama provisionOrder (registo + serviços dependentes).
 *   Indisponível → sem pagamento nem comprovativo: cancela a encomenda (nada foi cobrado), como antes.
 *                  Com pagamento validado ou comprovativo por validar: NÃO cancela nem reembolsa — abre um caso
 *                  manual com o motivo (propor outro domínio ou reembolso pelo fluxo manual da equipa).
 */
export async function resolveDomainAvailability(orderItemId: string, available: boolean, reason: string | null = null, adminId: string | null = null) {
  return withTransaction(async conn => {
    const [it] = await rows(conn, `SELECT oi.id, oi.order_id, oi.availability, oi.domain_name, o.hold_reason, o.payment_status
      FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? FOR UPDATE`, [orderItemId])
    if (!it) throw new PaymentError('item_not_found', 'Item inexistente.', 404)
    if (it.availability !== 'confirm') throw new PaymentError('not_pending', 'Este domínio não está a aguardar confirmação.', 409)
    const note = clean(reason)
    if (available) {
      await conn.query("UPDATE order_items SET availability = 'confirmed' WHERE id = ?", [it.id])
      const [left] = await rows(conn, "SELECT COUNT(*) n FROM order_items WHERE order_id = ? AND availability = 'confirm'", [it.order_id])
      if (!Number(left.n)) {
        await conn.query("UPDATE orders SET hold_reason = NULL WHERE id = ? AND hold_reason = 'domain_confirmation'", [it.order_id])
        await conn.query("UPDATE invoices SET status = 'pending', due_date = CURRENT_DATE + INTERVAL 7 DAY WHERE order_id = ? AND status = 'draft'", [it.order_id])
      }
      await domainEvent(conn, it, 'confirmed_available', note || null, adminId)
      return { released: !Number(left.n), paid: it.payment_status === 'paid' }
    }
    if (note.length < 3) throw new PaymentError('reason_required', 'Indique o motivo (ex.: «nome já registado por terceiros»).', 400)
    // Pagamentos da encomenda: ligados à encomenda ou só à factura (pagamento iniciado na Área do Cliente)
    const [pay] = await rows(conn, `SELECT COUNT(*) n FROM payments y LEFT JOIN invoices i ON i.id = y.invoice_id
      WHERE (y.order_id = ? OR i.order_id = ?) AND y.status IN ('approved','under_review','proof_uploaded')`, [it.order_id, it.order_id])
    const charged = it.payment_status === 'paid' || it.payment_status === 'proof_submitted' || Number(pay.n) > 0
    await conn.query("UPDATE order_items SET availability = 'unavailable', domain_case = ?, domain_case_note = ? WHERE id = ?", [charged ? 'manual_review' : null, note, it.id])
    await domainEvent(conn, it, charged ? 'unavailable_manual_review' : 'unavailable_cancelled', note, adminId)
    if (charged) {
      // Pagamento/comprovativo preservado; os serviços dependentes ficam parados (provisionService) até à decisão
      await conn.query("UPDATE orders SET hold_reason = 'domain_review' WHERE id = ?", [it.order_id])
      await conn.query("UPDATE services SET provisioning_error = ? WHERE order_id = ? AND domain = ? AND provisioning_status <> 'active'",
        [`Domínio ${it.domain_name} indisponível: caso em tratamento manual pela equipa.`, it.order_id, it.domain_name])
      return { released: false, cancelled: false, manualReview: true }
    }
    await conn.query("UPDATE orders SET status = 'cancelled', activation_status = 'cancelled', hold_reason = 'domain_unavailable' WHERE id = ?", [it.order_id])
    await conn.query("UPDATE invoices SET status = 'cancelled' WHERE order_id = ? AND status IN ('draft','pending')", [it.order_id])
    await conn.query("UPDATE services SET status = 'cancelled' WHERE order_id = ? AND provisioning_status <> 'active'", [it.order_id])
    // Registo local pendente (nunca registado) desta encomenda: removido — domains.status não tem «cancelado»
    await conn.query("DELETE FROM domains WHERE order_id = ? AND status = 'pending' AND registered_at IS NULL", [it.order_id])
    return { released: false, cancelled: true }
  })
}

/**
 * Caso manual de domínio indisponível depois do pagamento. Nenhuma destas acções movimenta dinheiro:
 *   propose  — regista a proposta de outro domínio (o cliente vê-a na encomenda)
 *   replace  — o cliente aceitou: substitui o domínio (mesma extensão, logo o mesmo preço pago); volta a
 *              «A confirmar pela equipa» ou fica confirmado se a equipa já o confirmou
 *   refund   — encaminha para reembolso, tratado manualmente pela equipa financeira (sem reembolso automático)
 *   resolve  — encerra o caso com nota (ex.: «reembolso feito, ref. …»)
 */
export async function domainCaseAction(input: { orderItemId: string; action: 'propose' | 'replace' | 'refund' | 'resolve'; note?: string | null; domain?: string | null; confirmed?: boolean; adminId: string | null }) {
  return withTransaction(async conn => {
    const [it] = await rows(conn, `SELECT oi.id, oi.order_id, oi.availability, oi.domain_name, oi.domain_case, oi.proposed_domain, o.user_id
      FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? FOR UPDATE`, [input.orderItemId])
    if (!it) throw new PaymentError('item_not_found', 'Item inexistente.', 404)
    if (!it.domain_case || it.domain_case === 'resolved') throw new PaymentError('no_case', 'Este domínio não tem um caso em tratamento.', 409)
    const note = clean(input.note)
    const ext = (d: string) => d.slice(d.indexOf('.'))
    const normalise = (d: unknown) => clean(d, 253).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
    switch (input.action) {
      case 'propose': {
        const d = normalise(input.domain)
        if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]+)*\.(?:[a-z]{2,24}|xn--[a-z0-9-]+)$/.test(d) || d === it.domain_name) throw new PaymentError('invalid_domain', 'Indique um domínio alternativo válido.', 400)
        await conn.query("UPDATE order_items SET domain_case = 'alternative', proposed_domain = ?, domain_case_note = ? WHERE id = ?", [d, note || null, it.id])
        await domainEvent(conn, it, 'alternative_proposed', note || null, input.adminId, d)
        return { ok: true, domainCase: 'alternative', proposed: d }
      }
      case 'replace': {
        const d = normalise(input.domain ?? it.proposed_domain)
        if (!d || d === it.domain_name) throw new PaymentError('invalid_domain', 'Indique o novo domínio aceite pelo cliente.', 400)
        if (ext(d) !== ext(it.domain_name)) throw new PaymentError('different_extension', `Só é possível substituir por um domínio ${ext(it.domain_name)} (mesmo preço pago). Outras extensões: tratar manualmente.`, 409)
        const [taken] = await rows(conn, 'SELECT profile_id FROM domains WHERE CONCAT(name, extension) = ?', [d])
        if (taken && taken.profile_id !== it.user_id) throw new PaymentError('domain_taken', 'Esse domínio já está associado a outra conta.', 409)
        const old = it.domain_name
        await conn.query("UPDATE order_items SET domain_name = ?, availability = ?, domain_case = 'resolved', domain_case_note = ? WHERE id = ?", [d, input.confirmed ? 'confirmed' : 'confirm', note || null, it.id])
        await conn.query('UPDATE order_items SET domain_name = ? WHERE order_id = ? AND domain_name = ?', [d, it.order_id, old])
        await conn.query('UPDATE services SET domain = ?, service_name = REPLACE(service_name, ?, ?), provisioning_error = NULL WHERE order_id = ? AND domain = ?', [d, old, d, it.order_id, old])
        await conn.query("DELETE FROM domains WHERE order_id = ? AND CONCAT(name, extension) = ? AND status = 'pending' AND registered_at IS NULL", [it.order_id, old])
        const e = ext(d)
        await conn.query(`INSERT INTO domains (id, profile_id, name, extension, status, order_id, currency) VALUES (?, ?, ?, ?, 'pending', ?, 'AKZ')
          ON DUPLICATE KEY UPDATE status = 'pending', order_id = VALUES(order_id), updated_at = CURRENT_TIMESTAMP(6)`, [randomUUID(), it.user_id, d.slice(0, -e.length), e, it.order_id])
        await conn.query("UPDATE orders SET domain_name = IF(domain_name = ?, ?, domain_name), hold_reason = ? WHERE id = ?", [old, d, input.confirmed ? null : 'domain_confirmation', it.order_id])
        await domainEvent(conn, { ...it, domain_name: old }, 'domain_replaced', note || null, input.adminId, d)
        return { ok: true, domainCase: 'resolved', domain: d, confirmed: !!input.confirmed }
      }
      case 'refund': {
        if (note.length < 3) throw new PaymentError('reason_required', 'Indique a nota do encaminhamento (ex.: «cliente pediu reembolso»).', 400)
        await conn.query("UPDATE order_items SET domain_case = 'refund_manual', domain_case_note = ? WHERE id = ?", [note, it.id])
        await domainEvent(conn, it, 'refund_forwarded', note, input.adminId)
        return { ok: true, domainCase: 'refund_manual' }
      }
      case 'resolve': {
        if (note.length < 3) throw new PaymentError('reason_required', 'Indique como o caso foi resolvido (ex.: «reembolso feito, ref. …»).', 400)
        await conn.query("UPDATE order_items SET domain_case = 'resolved', domain_case_note = ? WHERE id = ?", [note, it.id])
        await domainEvent(conn, it, 'case_resolved', note, input.adminId)
        return { ok: true, domainCase: 'resolved' }
      }
      default: throw new PaymentError('invalid_action', 'Acção inválida.', 400)
    }
  })
}
