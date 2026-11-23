import { NextRequest, NextResponse } from 'next/server'
import { createAdminWriteClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { confirmPayment, rejectProof, resolveDomainAvailability, PaymentError } from '@/lib/commerce/payments'
import { ActivationError, markServiceActive, provisionOrder, provisionService, refreshOrderActivation } from '@/lib/commerce/provisioning'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET() {
  try { await requireAdminRole() } catch { return NextResponse.json({ orders: [], error: 'Unauthorized' }, { status: 401 }) }
  const db = createAdminWriteClient()
  const { data: orders, error } = await db.from('orders')
    .select(`id, order_number, user_id, status, payment_status, activation_status, hold_reason, review_flag, review_note, review_at, amount, currency, subtotal, tax_amount, billing_cycle, payment_method,
      domain_name, proof_file, transfer_ref, notes, created_at, updated_at, paid_at,
      order_items(id, service_name, service_type, quantity, unit_price, line_total, renewal_price, billing_cycle, domain_name, domain_operation, availability, years, nameservers)`)
    .order('created_at', { ascending: false }).limit(300)
  if (error) return NextResponse.json({ orders: [], error: error.message })
  const ids = (orders ?? []).map((o: any) => o.id)
  const userIds = [...new Set((orders ?? []).map((o: any) => o.user_id).filter(Boolean))]
  const [{ data: services }, { data: profiles }, { data: invoices }, { data: payments }] = await Promise.all([
    ids.length ? db.from('services').select('id, order_id, order_item_id, service_name, service_type, provisioning_status, provisioning_error, provisioning_attempts, external_ref, domain, activation_source, provisioned_at').in('order_id', ids) : { data: [] },
    userIds.length ? db.from('profiles').select('id, full_name, email, phone, role').in('id', userIds) : { data: [] },
    ids.length ? db.from('invoices').select('id, order_id, invoice_number, status, total, amount_paid').in('order_id', ids) : { data: [] },
    ids.length ? db.from('payments').select('id, order_id, invoice_id, status, amount, currency, proof_url, transfer_ref, created_at, paid_at, reviewed_by').in('order_id', ids).order('created_at', { ascending: false }) : { data: [] },
  ])
  const storage = createServiceClient().storage.from('payment-proofs')
  const out = await Promise.all((orders ?? []).map(async (o: any) => {
    const pays = (payments ?? []).filter((p: any) => p.order_id === o.id)
    const proofPath = pays.find((p: any) => p.proof_url)?.proof_url ?? o.proof_file
    const signed = proofPath ? (await storage.createSignedUrl(proofPath, 3600)).data?.signedUrl ?? null : null
    return {
      ...o,
      profiles: (profiles ?? []).find((p: any) => p.id === o.user_id) ?? null,
      services: (services ?? []).filter((s: any) => s.order_id === o.id),
      invoice: (invoices ?? []).find((i: any) => i.order_id === o.id) ?? null,
      payments: pays.map((p: any) => ({ ...p, proof_url: undefined, has_proof: !!p.proof_url })),
      proof_url: signed,
    }
  }))
  return NextResponse.json({ orders: out })
}

// Acções do administrador. Nenhuma acção de activação cobra o cliente.
export async function POST(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const body = await req.json().catch(() => ({})) as { orderItemId?: string; available?: boolean; orderId?: string; serviceId?: string; paymentId?: string; action?: string; notes?: string; reason?: string; externalRef?: string; flag?: string | null }
  const db = getPool()
  const log = (action: string, entity: string, id: string, description: string) =>
    db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', ?, ?, ?)", [adminId, entity, id, `${action}: ${description}`]).catch(() => {})

  try {
    switch (body.action) {
      // Pagamento confirmado (comprovativo validado) → activa os serviços
      case 'approve': {
        const [[inv]] = await db.query('SELECT id, total, amount_paid FROM invoices WHERE order_id = ?', [body.orderId]) as any
        if (!inv) return NextResponse.json({ error: 'Encomenda sem factura.' }, { status: 404 })
        const [[pay]] = await db.query("SELECT id FROM payments WHERE invoice_id = ? AND status IN ('under_review','proof_uploaded','pending') ORDER BY created_at DESC LIMIT 1", [inv.id]) as any
        // Repetir a aprovação é seguro: factura já paga → 'already_paid' e só se activa o que faltar
        const r = await confirmPayment({ invoiceId: inv.id, amount: Number(inv.total) - Number(inv.amount_paid ?? 0), source: 'proof', paymentId: pay?.id ?? null, reviewerId: adminId })
        const results = await provisionOrder(body.orderId!)
        await log('approve', 'order', body.orderId!, `pagamento ${r.status}; activação ${results.map(x => x.status).join(',')}`)
        return NextResponse.json({ ok: true, payment: r.status, provisioning: results })
      }
      case 'reject_proof': {
        const [[pay]] = await db.query("SELECT id FROM payments WHERE order_id = ? AND status IN ('under_review','proof_uploaded','pending') ORDER BY created_at DESC LIMIT 1", [body.orderId]) as any
        if (!pay) return NextResponse.json({ error: 'Sem comprovativo pendente.' }, { status: 404 })
        await rejectProof(pay.id, body.reason ?? 'Comprovativo inválido', adminId)
        await log('reject_proof', 'order', body.orderId!, body.reason ?? '')
        return NextResponse.json({ ok: true })
      }
      // Cancelar encomenda não paga (pagas exigem reembolso, fora deste fluxo)
      case 'reject':
      case 'cancel': {
        const [[o]] = await db.query('SELECT payment_status FROM orders WHERE id = ?', [body.orderId]) as any
        if (!o) return NextResponse.json({ error: 'Encomenda inexistente.' }, { status: 404 })
        if (o.payment_status === 'paid') return NextResponse.json({ error: 'Encomenda paga: trate o reembolso antes de cancelar.' }, { status: 409 })
        await db.query("UPDATE orders SET status = 'rejected', activation_status = 'cancelled', notes = ? WHERE id = ?", [body.notes ?? null, body.orderId])
        await db.query("UPDATE services SET status = 'cancelled' WHERE order_id = ? AND provisioning_status <> 'active'", [body.orderId])
        await db.query("UPDATE invoices SET status = 'cancelled' WHERE order_id = ? AND status <> 'paid'", [body.orderId])
        await log('cancel', 'order', body.orderId!, body.notes ?? '')
        return NextResponse.json({ ok: true, status: 'rejected' })
      }
      case 'provision': {
        const r = await provisionService(body.serviceId!)
        const [[s]] = await db.query('SELECT order_id FROM services WHERE id = ?', [body.serviceId]) as any
        if (s) await refreshOrderActivation(s.order_id)
        await log('provision', 'service', body.serviceId!, r.status)
        return NextResponse.json({ ok: r.status === 'active', result: r })
      }
      // Disponibilidade de domínio confirmada pela equipa (extensões sem consulta automática)
      case 'domain_availability': {
        const r = await resolveDomainAvailability(body.orderItemId!, body.available === true)
        await log('domain_availability', 'order_item', body.orderItemId!, body.available ? 'disponível' : 'indisponível')
        return NextResponse.json({ ok: true, ...r })
      }
      // Marcação manual autorizada: para domínios exige a referência do registo
      case 'mark_active': {
        await markServiceActive(body.serviceId!, body.notes ?? null, body.externalRef ?? null, adminId)
        await log('mark_active', 'service', body.serviceId!, `ref. ${body.externalRef ?? ''}`)
        return NextResponse.json({ ok: true })
      }
      // Identificação de encomenda de teste/real pela equipa. Não altera facturas nem pagamentos.
      case 'review': {
        const flag = body.flag === 'test' || body.flag === 'real' ? body.flag : null
        const [r] = await db.query('UPDATE orders SET review_flag = ?, review_note = ?, review_by = ?, review_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [flag, (body.notes ?? '').slice(0, 500) || null, adminId, body.orderId]) as any
        if (!r.affectedRows) return NextResponse.json({ error: 'Encomenda inexistente.' }, { status: 404 })
        await log('review', 'order', body.orderId!, `${flag ?? 'sem marcação'}${body.notes ? `: ${body.notes}` : ''}`)
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
    }
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    if (e instanceof ActivationError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[admin/orders]', body.action, (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
