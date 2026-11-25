import { NextRequest, NextResponse } from 'next/server'
import { confirmNotPurchased, deliverManualVps, linkVps, reconcileVps } from '@/lib/vps/provisioning'
import { createAdminWriteClient, createServiceClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { confirmPayment, domainCaseAction, rejectProof, resolveDomainAvailability, PaymentError } from '@/lib/commerce/payments'
import { operationsByService } from '@/lib/registrar/hostinger-flow'
import { hostingerEligibility, loadRegistrarSettings } from '@/lib/registrar/settings'
import { ActivationError, markServiceActive, provisionOrder, provisionService, refreshOrderActivation } from '@/lib/commerce/provisioning'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */
// Lista de comprovativos (?lista=comprovativos): paginada, pesquisável e ordenável no servidor, para que a
// acumulação de registos antigos nunca esconda os novos — e os antigos continuem acessíveis (estado «todos»).
const PROOF_STATES = ['pendentes', 'validados', 'rejeitados', 'todos'] as const
const PROOF_SORT: Record<string, string> = { recentes: 'proof_at DESC, o.id', antigos: 'proof_at ASC, o.id', valor: 'o.amount DESC, proof_at DESC, o.id' }
const PROOF_PAGE = 20
async function proofList(sp: URLSearchParams) {
  const estado = (PROOF_STATES as readonly string[]).includes(sp.get('estado') ?? '') ? sp.get('estado')! : 'pendentes'
  const ordem = sp.get('ordem') && PROOF_SORT[sp.get('ordem')!] ? sp.get('ordem')! : 'recentes'
  const text = (sp.get('q') ?? '').trim().slice(0, 80)
  const page = Math.max(1, Math.min(10000, parseInt(sp.get('pagina') ?? '1') || 1))
  // Comprovativo: no pagamento (ligado à encomenda ou à sua factura) ou na própria encomenda
  const pays = `FROM payments p LEFT JOIN invoices iv ON iv.id = p.invoice_id WHERE (p.order_id = o.id OR iv.order_id = o.id) AND p.proof_url IS NOT NULL`
  const where = [`(o.proof_file IS NOT NULL OR EXISTS (SELECT 1 ${pays}))`], args: unknown[] = []
  if (estado === 'pendentes') where.push(`o.payment_status = 'proof_submitted' AND o.status NOT IN ('rejected','cancelled')`)
  if (estado === 'validados') where.push(`o.payment_status = 'paid'`)
  if (estado === 'rejeitados') where.push(`(o.payment_status = 'failed' OR o.status IN ('rejected','cancelled') OR EXISTS (SELECT 1 ${pays} AND p.status = 'rejected'))`)
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, m => '\\' + m)}%`
    where.push(`(o.order_number LIKE ? OR o.transfer_ref LIKE ? OR pr.full_name LIKE ? OR pr.email LIKE ? OR EXISTS (SELECT 1 ${pays} AND p.transfer_ref LIKE ?))`)
    args.push(like, like, like, like, like)
  }
  const from = `FROM orders o LEFT JOIN profiles pr ON pr.id = o.user_id WHERE ${where.join(' AND ')}`
  const pool = getPool()
  const [[c]] = await pool.query(`SELECT COUNT(*) n ${from}`, args) as any
  const [rows] = await pool.query(`SELECT o.id, COALESCE((SELECT MAX(p.created_at) ${pays}), o.created_at) proof_at ${from} ORDER BY ${PROOF_SORT[ordem]} LIMIT ${PROOF_PAGE} OFFSET ${(page - 1) * PROOF_PAGE}`, args) as any
  const total = Number(c.n)
  return { ids: (rows as any[]).map(r => r.id as string), proofAt: Object.fromEntries((rows as any[]).map(r => [r.id, r.proof_at])), meta: { estado, ordem, q: text, page, perPage: PROOF_PAGE, total, pages: Math.max(1, Math.ceil(total / PROOF_PAGE)) } }
}

export async function GET(req: NextRequest) {
  try { await requireAdminRole() } catch { return NextResponse.json({ orders: [], error: 'Unauthorized' }, { status: 401 }) }
  const db = createAdminWriteClient()
  const sp = new URL(req.url).searchParams
  const proofMode = sp.get('lista') === 'comprovativos'
  const COLS = `id, order_number, user_id, status, payment_status, activation_status, hold_reason, review_flag, review_note, review_at, amount, currency, subtotal, tax_amount, billing_cycle, payment_method,
      domain_name, proof_file, transfer_ref, notes, created_at, updated_at, paid_at,
      order_items(id, service_name, service_type, quantity, unit_price, line_total, renewal_price, billing_cycle, domain_name, domain_operation, availability, years, nameservers, domain_case, domain_case_note, proposed_domain, options)`
  let proofs: Awaited<ReturnType<typeof proofList>> | null = null
  let orders: any[]
  if (proofMode) {
    try { proofs = await proofList(sp) } catch (e) { console.error('[admin/orders proofs]', (e as Error).message); return NextResponse.json({ orders: [], error: 'Falha ao carregar os comprovativos.' }, { status: 500 }) }
    const got = proofs.ids.length ? (await db.from('orders').select(COLS).in('id', proofs.ids)).data ?? [] : []
    orders = proofs.ids.map(id => got.find((o: any) => o.id === id)).filter(Boolean).map((o: any) => ({ ...o, proof_at: proofs!.proofAt[o.id] ?? null }))
  } else {
  const { data: recent, error } = await db.from('orders').select(COLS).order('created_at', { ascending: false }).limit(300)
  if (error) return NextResponse.json({ orders: [], error: error.message })
  // Encomendas mais antigas com acções pendentes (activação por fazer, comprovativo, domínio por confirmar)
  // entram sempre: uma encomenda antiga paga não pode desaparecer da lista só por ser antiga.
  const [pendingRows] = await getPool().query(
    `SELECT DISTINCT o.id FROM orders o LEFT JOIN services s ON s.order_id = o.id LEFT JOIN order_items i ON i.order_id = o.id
     WHERE o.status NOT IN ('rejected','cancelled') AND (
       (o.payment_status = 'paid' AND s.provisioning_status IN ('pending','in_progress','manual_required','failed'))
       OR o.payment_status = 'proof_submitted' OR i.availability = 'confirm' OR i.domain_case IN ('manual_review','alternative','refund_manual'))`) as any
  const have = new Set((recent ?? []).map((o: any) => o.id))
  const missing = (pendingRows as any[]).map(r => r.id).filter(id => !have.has(id))
  const older = missing.length ? (await db.from('orders').select(COLS).in('id', missing)).data ?? [] : []
  orders = [...(recent ?? []), ...older].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
  }
  const ids = (orders ?? []).map((o: any) => o.id)
  const userIds = [...new Set((orders ?? []).map((o: any) => o.user_id).filter(Boolean))]
  const [{ data: services }, { data: profiles }, { data: invoices }, { data: payments }] = await Promise.all([
    ids.length ? db.from('services').select('id, order_id, order_item_id, service_name, service_type, provisioning_status, provisioning_error, provisioning_attempts, external_ref, domain, activation_source, provisioned_at, renews_service_id').in('order_id', ids) : { data: [] },
    userIds.length ? db.from('profiles').select('id, full_name, email, phone, role').in('id', userIds) : { data: [] },
    ids.length ? db.from('invoices').select('id, order_id, invoice_number, status, total, amount_paid').in('order_id', ids) : { data: [] },
    ids.length ? db.from('payments').select('id, order_id, invoice_id, status, amount, currency, proof_url, transfer_ref, created_at, paid_at, reviewed_by').in('order_id', ids).order('created_at', { ascending: false }) : { data: [] },
    // (pagamentos iniciados na Área do Cliente ficam ligados só à factura: juntados abaixo)
  ])
  // Histórico das decisões sobre domínios (confirmação, indisponibilidade, propostas, reembolso manual)
  const [events] = ids.length ? await getPool().query(`SELECT e.order_id, e.order_item_id, e.action, e.domain, e.proposed_domain, e.note, e.created_at, p.full_name AS admin_name
    FROM order_domain_events e LEFT JOIN profiles p ON p.id = e.admin_id WHERE e.order_id IN (${ids.map(() => '?').join(',')}) ORDER BY e.created_at`, ids) as any : [[]]
  const invIds = (invoices ?? []).map((i: any) => i.id)
  const extraPays = invIds.length ? ((await db.from('payments').select('id, order_id, invoice_id, status, amount, currency, proof_url, transfer_ref, created_at, paid_at, reviewed_by').in('invoice_id', invIds).is('order_id', null)).data ?? []) : []
  const allPays = [...(payments ?? []), ...extraPays.map((p: any) => ({ ...p, order_id: (invoices ?? []).find((i: any) => i.id === p.invoice_id)?.order_id }))]
  const svcIds = (services ?? []).map((s: any) => s.id)
  const [vpsOps] = svcIds.length ? await getPool().query(`SELECT v.service_id, v.mode, v.status, v.item_id, v.expected_cost_minor, v.cost_limit_minor, v.currency, v.provider_vm_id, v.provider_order_id, v.provider_subscription_id, v.provider_status, v.ipv4, v.attempts, v.message,
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('event', e.event, 'detail', e.detail, 'at', e.created_at)) FROM vps_provider_events e WHERE e.provider_order_id = v.id) events
    FROM vps_provider_orders v WHERE v.service_id IN (${svcIds.map(() => '?').join(',')})`, svcIds) as any : [[]]
  const ops = await operationsByService((services ?? []).filter((s: any) => s.service_type === 'domain').map((s: any) => s.id)).catch(() => ({} as Record<string, any>))
  const reg = await loadRegistrarSettings().catch(() => null)
  const registrar = reg ? { provider: reg.provider, enabled: reg.enabled, mode: reg.mode, extensions: reg.extensions } : null
  const storage = createServiceClient().storage.from('payment-proofs')
  const out = await Promise.all((orders ?? []).map(async (o: any) => {
    const pays = allPays.filter((p: any) => p.order_id === o.id)
    const proofPath = pays.find((p: any) => p.proof_url)?.proof_url ?? o.proof_file
    const signed = proofPath ? (await storage.createSignedUrl(proofPath, 3600)).data?.signedUrl ?? null : null
    return {
      ...o,
      profiles: (profiles ?? []).find((p: any) => p.id === o.user_id) ?? null,
      services: (services ?? []).filter((s: any) => s.order_id === o.id).map((s: any) => {
        const item = (o.order_items ?? []).find((i: any) => i.id === s.order_item_id)
        // Elegibilidade com a configuração ACTUAL (não com a mensagem gravada numa tentativa anterior)
        const hostinger = s.service_type === 'domain' ? hostingerEligibility(registrar, {
          serviceType: s.service_type, domain: s.domain || item?.domain_name || null, operation: item?.domain_operation ?? null,
          renews: !!s.renews_service_id, paid: o.payment_status === 'paid',
        }) : null
        const vpsOp = (vpsOps as any[]).find(v => v.service_id === s.id) ?? null
        return { ...s, registrar_op: (ops as any)[s.id] ?? null, hostinger, vps_op: vpsOp ? { ...vpsOp, events: typeof vpsOp.events === 'string' ? JSON.parse(vpsOp.events) : vpsOp.events ?? [] } : null }
      }),
      invoice: (invoices ?? []).find((i: any) => i.order_id === o.id) ?? null,
      payments: pays.map((p: any) => ({ ...p, proof_url: undefined, has_proof: !!p.proof_url })),
      domain_events: (events as any[]).filter(e => e.order_id === o.id),
      proof_url: signed,
    }
  }))
  return NextResponse.json({ orders: out, registrar, ...(proofs ? { proofs: proofs.meta } : {}) })
}

// Acções do administrador. Nenhuma acção de activação cobra o cliente.
export async function POST(req: NextRequest) {
  let adminId: string
  try { adminId = await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const body = await req.json().catch(() => ({})) as { vmId?: string; ip?: string; domain?: string; confirmed?: boolean; caseAction?: 'propose' | 'replace' | 'refund' | 'resolve'; orderItemId?: string; available?: boolean; orderId?: string; serviceId?: string; paymentId?: string; action?: string; notes?: string; reason?: string; externalRef?: string; flag?: string | null }
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
      // Disponibilidade de domínio decidida pela equipa (extensões sem consulta automática, ex.: .ao).
      // O pagamento não depende disto. Disponível + encomenda paga → segue o registo e os serviços dependentes.
      // Indisponível exige motivo; se já houver pagamento/comprovativo, abre um caso manual (sem reembolso automático).
      case 'domain_availability': {
        const r = await resolveDomainAvailability(body.orderItemId!, body.available === true, body.reason ?? body.notes ?? null, adminId)
        await log('domain_availability', 'order_item', body.orderItemId!, body.available ? 'disponível' : `indisponível: ${body.reason ?? body.notes ?? ''}`)
        let provisioning = null
        if (body.available && 'paid' in r && r.paid) {
          const [[it]] = await db.query('SELECT order_id FROM order_items WHERE id = ?', [body.orderItemId]) as any
          provisioning = await provisionOrder(it.order_id)
        }
        return NextResponse.json({ ok: true, ...r, provisioning })
      }
      // Caso manual de domínio indisponível depois do pagamento: propor outro domínio, substituir (aceite pelo
      // cliente), encaminhar para reembolso manual ou encerrar. Tudo fica no histórico; nada movimenta dinheiro.
      case 'domain_case': {
        if (!body.caseAction || !['propose', 'replace', 'refund', 'resolve'].includes(body.caseAction)) return NextResponse.json({ error: 'Acção inválida.' }, { status: 400 })
        const r = await domainCaseAction({ orderItemId: body.orderItemId!, action: body.caseAction, note: body.notes ?? body.reason ?? null, domain: body.domain ?? null, confirmed: body.confirmed === true, adminId })
        await log('domain_case', 'order_item', body.orderItemId!, `${body.caseAction}${body.domain ? ` ${body.domain}` : ''}${body.notes ? `: ${body.notes}` : ''}`)
        let provisioning = null
        if (body.caseAction === 'replace' && body.confirmed) {
          const [[it]] = await db.query('SELECT o.id, o.payment_status FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?', [body.orderItemId]) as any
          if (it?.payment_status === 'paid') provisioning = await provisionOrder(it.id)
        }
        return NextResponse.json({ ...r, provisioning })
      }
      // VPS: consultar a Hostinger (sem compras), associar uma VM adquirida pela equipa, ou — depois de verificar no
      // hPanel que nada foi comprado — autorizar nova tentativa. Nunca há compra automática a partir destas acções.
      case 'vps_reconcile': {
        const r = await reconcileVps(body.serviceId!, adminId)
        const [[s]] = await db.query('SELECT order_id FROM services WHERE id = ?', [body.serviceId]) as any
        if (s) await refreshOrderActivation(s.order_id)
        await log('vps_reconcile', 'service', body.serviceId!, r.message)
        return NextResponse.json({ ok: true, result: r })
      }
      case 'vps_link': {
        const r = await linkVps(body.serviceId!, String(body.vmId ?? ''), adminId)
        const [[s]] = await db.query('SELECT order_id FROM services WHERE id = ?', [body.serviceId]) as any
        if (s) await refreshOrderActivation(s.order_id)
        await log('vps_link', 'service', body.serviceId!, r.message)
        return NextResponse.json({ ok: true, result: r })
      }
      case 'vps_deliver': {
        const r = await deliverManualVps(body.serviceId!, { ip: body.ip, note: body.notes }, adminId)
        const [[s]] = await db.query('SELECT order_id FROM services WHERE id = ?', [body.serviceId]) as any
        if (s) await refreshOrderActivation(s.order_id)
        await log('vps_deliver', 'service', body.serviceId!, r.message)
        return NextResponse.json({ ok: true, result: r })
      }
      case 'vps_confirm_not_purchased': {
        await confirmNotPurchased(body.serviceId!, body.notes ?? '', adminId)
        await log('vps_confirm_not_purchased', 'service', body.serviceId!, body.notes ?? '')
        const r = await provisionService(body.serviceId!)
        const [[s]] = await db.query('SELECT order_id FROM services WHERE id = ?', [body.serviceId]) as any
        if (s) await refreshOrderActivation(s.order_id)
        return NextResponse.json({ ok: true, result: r })
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
