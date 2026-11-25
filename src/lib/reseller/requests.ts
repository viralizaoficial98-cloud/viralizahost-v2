import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { normalizeDomain } from '@/lib/commerce/domains'
import { quoteCart } from '@/lib/commerce/quote'
import { createOrder, OrderError } from '@/lib/commerce/orders'
import { confirmPayment, PaymentError } from '@/lib/commerce/payments'
import { familyPeriods } from '@/lib/commerce/plan-families'
import { audit, getResellerSettings, ResellerError } from './settings'
import { eligibility, getServer, planNeed } from './infra'
import { getProfile } from './profiles'
import { notifyAdmins, notifyClient } from './notify'

// Pedidos de contratação de Revenda e as transições de estado (só administradores, validadas no servidor).
//   submitted → under_review → technically_approved → awaiting_payment → paid → provisioning_authorized
//     → provisioning → awaiting_confirmation → active
//   + rejected | cancelled (antes de activo) | failed (aprovisionamento; repetível)
// A aprovação comercial/técnica NUNCA cria contas WHM: só o motor (provisioning.ts), depois do pagamento
// confirmado e da autorização expressa de aprovisionamento.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]

export type RequestStatus = 'submitted' | 'under_review' | 'technically_approved' | 'awaiting_payment' | 'paid' | 'provisioning_authorized' | 'provisioning' | 'awaiting_confirmation' | 'active' | 'rejected' | 'cancelled' | 'failed'
export const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: 'Recebido', under_review: 'Em análise', technically_approved: 'Aprovado tecnicamente', awaiting_payment: 'A aguardar pagamento', paid: 'Pago',
  provisioning_authorized: 'Activação autorizada', provisioning: 'Em activação', awaiting_confirmation: 'Activação por confirmar', active: 'Activo',
  rejected: 'Rejeitado', cancelled: 'Cancelado', failed: 'Falha na activação',
}
export const OPEN_STATUSES: RequestStatus[] = ['submitted', 'under_review', 'technically_approved', 'awaiting_payment', 'paid', 'provisioning_authorized', 'provisioning', 'awaiting_confirmation', 'failed']
export const BUSINESS_TYPES = ['agencia_web', 'freelancer', 'empresa_ti', 'consultoria', 'revenda_existente', 'outro'] as const
export const BUSINESS_LABEL: Record<string, string> = { agencia_web: 'Agência web / design', freelancer: 'Freelancer / programador', empresa_ti: 'Empresa de TI', consultoria: 'Consultoria / marketing', revenda_existente: 'Já revendo alojamento', outro: 'Outro' }

const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

async function event(db: Queryable, requestId: string, actorId: string | null, from: string | null, to: string | null, action: string, note: string | null = null) {
  await db.query('INSERT INTO reseller_request_events (id, request_id, actor_id, from_status, to_status, action, note) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), requestId, actorId, from, to, action, note?.slice(0, 1000) ?? null])
}

// ── Pedido público ──
export interface RequestInput {
  fullName: unknown; company?: unknown; email: unknown; phone: unknown; domain: unknown; plan: unknown; cycle: unknown
  estimatedClients?: unknown; businessType?: unknown; notes?: unknown; upgradeServiceId?: unknown
}
export async function createRequest(input: RequestInput, ctx: { userId: string | null; ip: string }) {
  const db = getPool()
  const s = await getResellerSettings(db)
  const [[me]] = ctx.userId ? await db.query('SELECT id, email, full_name, phone, role FROM profiles WHERE id = ?', [ctx.userId]) as any : [[null]]
  if (s.mode === 'disabled') throw new ResellerError('reseller_disabled', 'A contratação de revenda está temporariamente indisponível.', 403)
  if (s.mode === 'test' && me?.role !== 'admin') throw new ResellerError('reseller_test_admin_only', 'Revenda em modo de teste: pedidos reservados a administradores.', 403)

  // Perfil autenticado: o e-mail é o da conta (nunca outro); restantes dados pré-preenchidos se em falta
  const fullName = clean(input.fullName, 160) || clean(me?.full_name, 160)
  const email = (me?.email ? String(me.email) : clean(input.email, 191)).toLowerCase()
  const phone = clean(input.phone, 40) || clean(me?.phone, 40)
  const company = clean(input.company, 160) || null
  const notes = String(input.notes ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 2000) || null
  const businessType = clean(input.businessType, 60) || null
  if (fullName.length < 3) throw new ResellerError('name', 'Indique o nome completo.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ResellerError('email', 'Indique um e-mail válido.')
  if (!/^\+?[0-9 ()-]{9,20}$/.test(phone)) throw new ResellerError('phone', 'Indique um telefone/WhatsApp válido (9 a 20 dígitos).')
  const domain = normalizeDomain(input.domain)
  if (!domain || !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain) || domain.length > 191) throw new ResellerError('domain', 'Indique um domínio válido (ex.: aminhaempresa.ao).')
  if (businessType && !(BUSINESS_TYPES as readonly string[]).includes(businessType)) throw new ResellerError('businessType', 'Tipo de negócio inválido.')
  const est = input.estimatedClients === '' || input.estimatedClients == null ? null : Number(input.estimatedClients)
  if (est !== null && (!Number.isInteger(est) || est < 0 || est > 100000)) throw new ResellerError('estimatedClients', 'Número estimado de clientes inválido.')
  if (notes && /(https?:\/\/[^\s]+[\s\S]*){4,}/i.test(notes)) throw new ResellerError('spam', 'A mensagem tem demasiadas ligações.')

  const slug = clean(input.plan, 120)
  const [prod] = await rows(db, "SELECT id, slug, name, sale_status FROM products WHERE slug = ? AND category = 'reseller' AND subcategory IS NULL AND active = 1", [slug])
  if (!prod || prod.sale_status !== 'active') throw new ResellerError('plan', 'Escolha um plano de revenda disponível.')
  const cycle = clean(input.cycle, 16)
  if (!familyPeriods('reseller').some(p => p.cycle === cycle)) throw new ResellerError('cycle', 'Escolha um período de facturação válido.')
  const [price] = await rows(db, 'SELECT price FROM product_prices WHERE product_id = ? AND cycle = ? AND active = 1', [prod.id, cycle])
  if (!price) throw new ResellerError('cycle', 'Período indisponível para este plano.')

  let kind: 'new' | 'upgrade' = 'new', upgradeServiceId: string | null = null
  if (input.upgradeServiceId) {
    if (!me) throw new ResellerError('login', 'Inicie sessão para pedir um upgrade.', 401)
    const [svc] = await rows(db, "SELECT rs.service_id FROM reseller_services rs WHERE rs.service_id = ? AND rs.profile_id = ? AND rs.status IN ('active','suspended')", [String(input.upgradeServiceId), me.id])
    if (!svc) throw new ResellerError('upgrade', 'Revenda inexistente ou de outra conta.', 404)
    kind = 'upgrade'; upgradeServiceId = svc.service_id
  }

  // Duplicados: mesmo e-mail + domínio + plano com pedido em aberto → devolve o existente (sem criar outro)
  const dedupe = sha(`${email}|${domain}|${prod.id}|${kind}`)
  const [dup] = await rows(db, `SELECT reference FROM reseller_requests WHERE dedupe_key = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')}) LIMIT 1`, [dedupe, ...OPEN_STATUSES])
  if (dup) return { reference: dup.reference as string, duplicate: true }
  const [[open]] = await db.query(`SELECT COUNT(*) n FROM reseller_requests WHERE email = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`, [email, ...OPEN_STATUSES]) as any
  if (Number(open.n) >= s.maxOpenPerEmail) throw new ResellerError('too_many_open', `Já tem ${open.n} pedidos de revenda em análise. Aguarde a resposta da equipa.`, 429)

  const id = randomUUID()
  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  let reference = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    reference = `VH-REV-${ym}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
    try {
      await db.query(`INSERT INTO reseller_requests (id, reference, kind, upgrade_service_id, profile_id, full_name, company, email, phone, domain, product_id, cycle, estimated_clients, business_type, notes, quoted_total, ip_hash, dedupe_key, is_test)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, reference, kind, upgradeServiceId, me?.id ?? null, fullName, company, email, phone, domain, prod.id, cycle, est, businessType, notes, Number(price.price), sha(`ip|${ctx.ip}`), dedupe, s.mode === 'test' ? 1 : 0])
      break
    } catch (e) { if ((e as { errno?: number }).errno !== 1062 || attempt === 4) throw e }
  }
  await event(db, id, me?.id ?? null, null, 'submitted', 'submitted', kind === 'upgrade' ? 'Pedido de upgrade' : null)
  await audit(me?.id ?? null, 'create', 'reseller_request', id, `Pedido de revenda ${reference} (${prod.name}, ${cycle}, ${domain})`)
  await notifyAdmins('Novo pedido de Revenda', `${reference}: ${fullName}${company ? ` (${company})` : ''} — ${prod.name}, domínio ${domain}.`, `/admin/reseller?pedido=${reference}`)
  await notifyClient(me?.id ?? null, email, 'Pedido de Revenda recebido',
    `Recebemos o seu pedido ${reference} (${prod.name}). A equipa vai analisá-lo tecnicamente e responder em breve. Nenhum pagamento é pedido antes da aprovação.`, me ? '/revendedor' : '/revenda-de-hospedagem')
  return { reference, duplicate: false }
}

// ── Consulta (painel) ──
export async function listRequests(filter: { status?: string; q?: string } = {}) {
  const where: string[] = [], args: unknown[] = []
  if (filter.status === 'open') { where.push(`r.status IN (${OPEN_STATUSES.map(() => '?').join(',')})`); args.push(...OPEN_STATUSES) }
  else if (filter.status && filter.status in STATUS_LABEL) { where.push('r.status = ?'); args.push(filter.status) }
  if (filter.q) { where.push('(r.reference LIKE ? OR r.email LIKE ? OR r.domain LIKE ? OR r.full_name LIKE ?)'); const q = `%${filter.q.slice(0, 80)}%`; args.push(q, q, q, q) }
  return rows(getPool(), `SELECT r.id, r.reference, r.kind, r.full_name, r.company, r.email, r.domain, r.cycle, r.status, r.created_at, r.is_test, r.quoted_total, p.name plan_name, s.name server_name, s.hostname server_host
    FROM reseller_requests r JOIN products p ON p.id = r.product_id LEFT JOIN servers s ON s.id = r.server_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY r.created_at DESC LIMIT 200`, args)
}

export async function requestDetail(idOrRef: string) {
  const db = getPool()
  const [r] = await rows(db, `SELECT r.*, p.name plan_name, p.slug plan_slug, o.order_number, o.payment_status, o.status order_status, i.id invoice_id, i.invoice_number, i.status invoice_status, i.total invoice_total
    FROM reseller_requests r JOIN products p ON p.id = r.product_id LEFT JOIN orders o ON o.id = r.order_id LEFT JOIN invoices i ON i.order_id = r.order_id
    WHERE r.id = ? OR r.reference = ?`, [idOrRef, idOrRef])
  if (!r) return null
  const profile = await getProfile(r.product_id, db)
  const settings = await getResellerSettings(db)
  const { listServers } = await import('./infra')
  const servers = await listServers(db)
  const need = profile ? planNeed({ storage_mb: profile.storageMb, main_quota_mb: profile.mainQuotaMb, max_accounts: profile.maxAccounts }) : null
  const [res] = await rows(db, 'SELECT * FROM capacity_reservations WHERE request_id = ?', [r.id])
  return {
    request: { ...r, ip_hash: undefined, dedupe_key: undefined },
    profile, need, settings: { mode: settings.mode },
    servers: servers.map(s => ({ id: s.id, label: s.label, environment: s.environment, authorized: s.resellerAuthorized, capacity: s.capacity, problems: need ? eligibility(s, need, { mode: settings.mode, planServerIds: profile?.serverIds ?? [] }) : ['Plano sem perfil técnico.'] })),
    reservation: res ?? null,
    events: await rows(db, 'SELECT e.*, pr.full_name actor_name FROM reseller_request_events e LEFT JOIN profiles pr ON pr.id = e.actor_id WHERE e.request_id = ? ORDER BY e.created_at', [r.id]),
    provisioning: r.service_id ? await provisioningView(db, r.service_id) : null,
  }
}

export async function provisioningView(db: Queryable, serviceId: string) {
  const [op] = await rows(db, 'SELECT id, status, step, attempts, max_attempts, last_error, state, next_attempt_at, updated_at FROM reseller_provision_ops WHERE service_id = ?', [serviceId])
  const [svc] = await rows(db, 'SELECT * FROM reseller_services WHERE service_id = ?', [serviceId])
  let state: any = null
  try { state = op?.state ? JSON.parse(op.state) : null } catch { /* */ }
  return {
    op: op ? { ...op, state: state ? { username: state.username ?? null, done: state.done ?? [] } : null } : null,
    events: op ? await rows(db, 'SELECT step, outcome, whm_function, message, duration_ms, created_at FROM reseller_provision_events WHERE op_id = ? ORDER BY created_at', [op.id]) : [],
    reseller: svc ? { ...svc, verification: svc.verification ? JSON.parse(svc.verification) : null } : null,
  }
}

// ── Transições (painel) ──
type Action = 'start_review' | 'note' | 'select_server' | 'approve_technical' | 'reject' | 'cancel' | 'send_to_payment' | 'refresh_payment' | 'simulate_payment' | 'authorize_provisioning'
const ALLOWED: Record<Action, RequestStatus[]> = {
  start_review: ['submitted'],
  note: ['submitted', 'under_review', 'technically_approved', 'awaiting_payment', 'paid', 'provisioning_authorized', 'provisioning', 'awaiting_confirmation', 'active', 'rejected', 'cancelled', 'failed'],
  select_server: ['submitted', 'under_review'],
  approve_technical: ['under_review'],
  reject: ['submitted', 'under_review', 'technically_approved'],
  cancel: ['submitted', 'under_review', 'technically_approved', 'awaiting_payment'],
  send_to_payment: ['technically_approved'],
  refresh_payment: ['awaiting_payment'],
  simulate_payment: ['awaiting_payment'],
  authorize_provisioning: ['paid'],
}

export async function requestAction(adminId: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  if (!(action in ALLOWED)) throw new ResellerError('action_invalid', 'Acção inválida.')
  const a = action as Action
  const db = getPool()
  const [r] = await rows(db, 'SELECT r.*, p.name plan_name, p.slug plan_slug FROM reseller_requests r JOIN products p ON p.id = r.product_id WHERE r.id = ?', [id])
  if (!r) throw new ResellerError('not_found', 'Pedido inexistente.', 404)
  if (!ALLOWED[a].includes(r.status)) throw new ResellerError('invalid_transition', `Acção indisponível no estado «${STATUS_LABEL[r.status as RequestStatus]}».`, 409)
  const settings = await getResellerSettings(db)
  if (['approve_technical', 'send_to_payment', 'authorize_provisioning', 'simulate_payment'].includes(a) && settings.mode === 'disabled') throw new ResellerError('reseller_disabled', 'Revenda desactivada: só é possível consultar, rejeitar ou cancelar pedidos.', 409)
  const note = clean(payload.note, 1000) || null

  /** Muda o estado só se ainda for o esperado (concorrência entre administradores). */
  const move = async (conn: Queryable, to: RequestStatus, extra: Record<string, unknown> = {}) => {
    const cols = Object.keys(extra)
    const [res] = await conn.query(`UPDATE reseller_requests SET status = ?, reviewed_by = ?${cols.map(c => `, \`${c}\` = ?`).join('')} WHERE id = ? AND status = ?`, [to, adminId, ...cols.map(c => extra[c]), id, r.status]) as any
    if (!res.affectedRows) throw new ResellerError('conflict', 'O pedido foi alterado entretanto: recarregue.', 409)
    await event(conn, id, adminId, r.status, to, a, note)
  }
  const releaseReservation = (conn: Queryable) => conn.query("UPDATE capacity_reservations SET status = 'released' WHERE request_id = ? AND status = 'reserved'", [id])

  switch (a) {
    case 'start_review':
      await move(db, 'under_review'); break
    case 'note':
      if (!note) throw new ResellerError('note_required', 'Escreva a nota.')
      await db.query("UPDATE reseller_requests SET internal_notes = CONCAT(COALESCE(internal_notes, ''), ?) WHERE id = ?", [`[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${note}\n`, id])
      await event(db, id, adminId, r.status, r.status, 'note', note); break
    case 'select_server': {
      const sid = String(payload.serverId ?? '')
      const s = await getServer(sid, db)
      if (!s) throw new ResellerError('server', 'Servidor inexistente.', 404)
      await db.query('UPDATE reseller_requests SET server_id = ? WHERE id = ? AND status = ?', [sid, id, r.status])
      await event(db, id, adminId, r.status, r.status, 'select_server', `Servidor: ${s.label}`); break
    }
    case 'approve_technical': {
      const prof = await getProfile(r.product_id, db)
      if (!prof?.complete) throw new ResellerError('profile_incomplete', `Perfil técnico do plano incompleto (${prof?.missing.join(', ') || 'perfil'}). Complete-o em Catálogo e Preços → Revenda.`, 409)
      if (!r.server_id) throw new ResellerError('server_required', 'Seleccione um servidor elegível.', 409)
      const need = planNeed({ storage_mb: prof.storageMb, main_quota_mb: prof.mainQuotaMb, max_accounts: prof.maxAccounts })
      // Reserva de capacidade transaccional: bloqueia a linha do servidor e recalcula dentro da transacção
      await withTransaction(async conn => {
        await conn.query('SELECT id FROM servers WHERE id = ? FOR UPDATE', [r.server_id])
        const s = await getServer(r.server_id, conn)
        const problems = s ? eligibility(s, need, { mode: settings.mode, planServerIds: prof.serverIds }) : ['Servidor inexistente.']
        if (problems.length) throw new ResellerError('not_eligible', `Aprovação bloqueada: ${problems.join(' ')}`, 409)
        await conn.query(`INSERT INTO capacity_reservations (id, server_id, request_id, storage_mb, accounts, status, created_by) VALUES (?, ?, ?, ?, ?, 'reserved', ?)
          ON DUPLICATE KEY UPDATE server_id = VALUES(server_id), storage_mb = VALUES(storage_mb), accounts = VALUES(accounts), status = 'reserved', created_by = VALUES(created_by)`,
          [randomUUID(), r.server_id, id, need.storageMb, need.accounts, adminId])
        await move(conn, 'technically_approved', { technical_approved_by: adminId, technical_approved_at: new Date() })
      })
      await audit(adminId, 'update', 'reseller_request', id, `Pedido ${r.reference} aprovado tecnicamente (reserva ${need.storageMb} MB, ${need.accounts} contas)`)
      await notifyClient(r.profile_id, r.email, 'Pedido de Revenda aprovado tecnicamente', `O seu pedido ${r.reference} foi aprovado tecnicamente. Vamos enviar-lhe a factura para pagamento.`)
      break
    }
    case 'reject': {
      if (!note || note.length < 5) throw new ResellerError('reason_required', 'Indique o motivo da rejeição (enviado ao cliente).')
      await withTransaction(async conn => { await move(conn, 'rejected', { decision_reason: note }); await releaseReservation(conn) })
      await audit(adminId, 'update', 'reseller_request', id, `Pedido ${r.reference} rejeitado: ${note.slice(0, 200)}`)
      await notifyClient(r.profile_id, r.email, 'Pedido de Revenda não aprovado', `O seu pedido ${r.reference} não foi aprovado. Motivo: ${note}`, r.profile_id ? '/revendedor' : '/revenda-de-hospedagem', 'warning')
      break
    }
    case 'cancel': {
      await withTransaction(async conn => {
        await move(conn, 'cancelled', { decision_reason: note })
        await releaseReservation(conn)
        // Encomenda por pagar desta revenda: cancelada (nunca uma já paga)
        if (r.order_id) {
          await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ? AND payment_status <> 'paid'", [r.order_id])
          await conn.query("UPDATE invoices SET status = 'cancelled' WHERE order_id = ? AND status <> 'paid'", [r.order_id])
          await conn.query("UPDATE services SET status = 'cancelled' WHERE order_id = ? AND provisioning_status <> 'active'", [r.order_id])
        }
      })
      await audit(adminId, 'update', 'reseller_request', id, `Pedido ${r.reference} cancelado${note ? `: ${note.slice(0, 200)}` : ''}`)
      await notifyClient(r.profile_id, r.email, 'Pedido de Revenda cancelado', `O pedido ${r.reference} foi cancelado.${note ? ` ${note}` : ''}`, r.profile_id ? '/revendedor' : '/revenda-de-hospedagem', 'warning')
      break
    }
    case 'send_to_payment': {
      if (settings.mode === 'test' && !Number(r.is_test)) throw new ResellerError('test_mode', 'Modo de teste: só pedidos de teste avançam para pagamento.', 409)
      // Cliente com conta: a do pedido ou a que tem o mesmo e-mail (verificado)
      let profileId = r.profile_id as string | null
      if (!profileId) {
        const [p] = await rows(db, 'SELECT id, email_verified FROM profiles WHERE LOWER(email) = ? LIMIT 1', [String(r.email).toLowerCase()])
        if (!p) throw new ResellerError('no_account', `O cliente ainda não tem conta. Peça-lhe que crie conta com o e-mail ${r.email} e repita.`, 409)
        profileId = p.id
        await db.query('UPDATE reseller_requests SET profile_id = ? WHERE id = ?', [profileId, id])
      }
      const lines = [{ type: 'product' as const, slug: r.plan_slug, cycle: r.cycle, domain: r.domain, domainMode: 'existing' as const }]
      const q = await quoteCart(lines, { userId: profileId, resellerRequestId: id, checkAvailability: false })
      if (!q.valid) throw new ResellerError('quote_invalid', `Não foi possível preparar a encomenda: ${q.lines.map(l => l.error?.message).filter(Boolean).join(' ')}`, 409)
      try {
        const { order } = await createOrder({ userId: profileId!, idempotencyKey: `reseller-${id}`, lines, acceptedTotal: q.total, paymentMethod: 'bank_transfer', resellerRequestId: id })
        const [svc] = await rows(db, "SELECT id FROM services WHERE order_id = ? AND service_type = 'reseller' LIMIT 1", [order.id])
        await withTransaction(async conn => {
          await move(conn, 'awaiting_payment', { order_id: order.id, service_id: svc?.id ?? null, quoted_total: order.total })
          await conn.query('UPDATE capacity_reservations SET service_id = ? WHERE request_id = ?', [svc?.id ?? null, id])
        })
        await audit(adminId, 'payment', 'reseller_request', id, `Pedido ${r.reference} encaminhado para pagamento: encomenda ${order.order_number}, factura ${order.invoice_number}, ${order.total} Kz`)
        await notifyClient(profileId, r.email, 'Factura da sua Revenda', `O pedido ${r.reference} foi aprovado. Emitimos a factura ${order.invoice_number} (${order.total.toLocaleString('pt-PT')} Kz). Depois do pagamento confirmado, a equipa activa a sua revenda.`, '/billing')
      } catch (e) {
        if (e instanceof OrderError) throw new ResellerError(e.code, e.message, e.status)
        throw e
      }
      break
    }
    case 'refresh_payment': {
      const [o] = await rows(db, 'SELECT payment_status FROM orders WHERE id = ?', [r.order_id])
      if (o?.payment_status !== 'paid') throw new ResellerError('not_paid', 'O pagamento ainda não foi confirmado (Financeiro → comprovativos).', 409)
      await markPaid(id, adminId); break
    }
    case 'simulate_payment': {
      // Só pedidos de teste num servidor de teste: confirma a factura pelo mecanismo financeiro existente
      const s = r.server_id ? await getServer(r.server_id, db) : null
      if (!Number(r.is_test) || s?.environment !== 'test') throw new ResellerError('not_test', 'Pagamento simulado só para pedidos de teste num servidor de teste.', 409)
      const [inv] = await rows(db, 'SELECT id, total FROM invoices WHERE order_id = ?', [r.order_id])
      if (!inv) throw new ResellerError('no_invoice', 'Factura inexistente.', 409)
      try { await confirmPayment({ invoiceId: inv.id, amount: Number(inv.total), source: 'proof', method: 'bank_transfer', reviewerId: adminId }) }
      catch (e) { if (e instanceof PaymentError) throw new ResellerError(e.code, e.message, e.status); throw e }
      await audit(adminId, 'payment', 'reseller_request', id, `Pedido de TESTE ${r.reference}: pagamento simulado`)
      await markPaid(id, adminId); break
    }
    case 'authorize_provisioning': {
      const { authorizeAndRun } = await import('./provisioning')
      return authorizeAndRun(adminId, id)
    }
  }
  return requestDetail(id)
}

/** Pagamento confirmado (Financeiro, gateway ou simulação de teste): pedido → «Pago». Idempotente. */
export async function markPaid(requestId: string, actorId: string | null) {
  const db = getPool()
  const [res] = await db.query("UPDATE reseller_requests SET status = 'paid' WHERE id = ? AND status = 'awaiting_payment'", [requestId]) as any
  if (!res.affectedRows) return false
  await event(db, requestId, actorId, 'awaiting_payment', 'paid', 'payment_confirmed', null)
  const [r] = await rows(db, 'SELECT reference, profile_id, email FROM reseller_requests WHERE id = ?', [requestId])
  await notifyAdmins('Revenda paga: autorizar activação', `${r.reference}: pagamento confirmado. Autorize o aprovisionamento em Revenda de Hospedagem.`, `/admin/reseller?pedido=${r.reference}`)
  await notifyClient(r.profile_id, r.email, 'Pagamento da Revenda confirmado', `Confirmámos o pagamento do pedido ${r.reference}. A activação da sua revenda está a ser preparada pela equipa.`)
  return true
}

/** Área de cliente: pedidos do próprio utilizador (por conta ou pelo e-mail verificado da conta). */
export async function clientRequests(profileId: string) {
  const db = getPool()
  const [me] = await rows(db, 'SELECT email, email_verified FROM profiles WHERE id = ?', [profileId])
  return rows(db, `SELECT r.id, r.reference, r.kind, r.domain, r.cycle, r.status, r.created_at, r.decision_reason, r.quoted_total, p.name plan_name,
      o.order_number, o.payment_status, i.id invoice_id, i.invoice_number, i.status invoice_status
    FROM reseller_requests r JOIN products p ON p.id = r.product_id LEFT JOIN orders o ON o.id = r.order_id AND o.user_id = ? LEFT JOIN invoices i ON i.order_id = o.id
    WHERE r.profile_id = ? OR (r.profile_id IS NULL AND ? = 1 AND LOWER(r.email) = LOWER(?)) ORDER BY r.created_at DESC LIMIT 50`,
    [profileId, profileId, me?.email_verified ? 1 : 0, me?.email ?? ''])
}
