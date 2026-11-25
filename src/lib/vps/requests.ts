import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { getPool, withTransaction, type Queryable } from '@/lib/db/pool'
import { quoteCart, type CartLineInput } from '@/lib/commerce/quote'
import { createOrder, OrderError } from '@/lib/commerce/orders'
import { confirmPayment, PaymentError } from '@/lib/commerce/payments'
import { VPS_CYCLES } from '@/lib/commerce/vps-shared'
import { sendNoticeEmail } from '@/lib/auth/email'
import { siteUrl } from '@/lib/auth/server'
import { CloudError, loadCloudSettings } from './cloud'
import { vpsClient } from './settings'

// Cloud VPS — pedidos de contratação («solicitação mediante aprovação») e autorização de aquisição.
//   submitted → under_review → approved (preço/fornecedor/localização/instalação verificados)
//     → awaiting_payment (encomenda + factura pelo fluxo existente) → paid (Financeiro existente)
//     → purchase_authorized (autorização SEPARADA da aquisição) → provisioning → active
//   + rejected | cancelled (antes do pagamento) | failed (compra recusada; repetível pelo fluxo existente)
// A aprovação NUNCA compra nada. Pagar também não: o motor (provisioning.ts) só compra com autorização registada
// (ou no modo automático, sem pedido). Todas as decisões são do servidor.

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[]
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const parse = (v: unknown) => { try { return (typeof v === 'string' ? JSON.parse(v) : v) ?? {} } catch { return {} } }

export type VpsRequestStatus = 'submitted' | 'under_review' | 'approved' | 'awaiting_payment' | 'paid' | 'purchase_authorized' | 'provisioning' | 'active' | 'rejected' | 'cancelled' | 'failed'
export const VPS_REQ_LABEL: Record<VpsRequestStatus, string> = {
  submitted: 'Recebido', under_review: 'Em análise', approved: 'Aprovado', awaiting_payment: 'A aguardar pagamento', paid: 'Pago',
  purchase_authorized: 'Aquisição autorizada', provisioning: 'Em aprovisionamento', active: 'Activo', rejected: 'Rejeitado', cancelled: 'Cancelado', failed: 'Falha na aquisição',
}
export const VPS_OPEN: VpsRequestStatus[] = ['submitted', 'under_review', 'approved', 'awaiting_payment', 'paid', 'purchase_authorized', 'provisioning', 'failed']

async function event(db: Queryable, requestId: string, actorId: string | null, from: string | null, to: string | null, action: string, note: string | null = null) {
  await db.query('INSERT INTO vps_request_events (id, request_id, actor_id, from_status, to_status, action, note) VALUES (?, ?, ?, ?, ?, ?, ?)', [randomUUID(), requestId, actorId, from, to, action, note?.slice(0, 1000) ?? null])
}
async function notifyAdmins(title: string, message: string, link: string) {
  try {
    const [admins] = await getPool().query("SELECT id FROM profiles WHERE role = 'admin' AND is_active = 1") as any
    for (const a of admins as any[]) await getPool().query('INSERT INTO notifications (id, profile_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), a.id, 'info', title, message.slice(0, 1000), link])
  } catch (e) { console.error('[vps/requests] notify admins', (e as Error).message) }
}
async function notifyClient(profileId: string | null, email: string, title: string, message: string, link = '/vps') {
  try {
    if (profileId) await getPool().query('INSERT INTO notifications (id, profile_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)', [randomUUID(), profileId, 'info', title, message.slice(0, 1000), link])
    await sendNoticeEmail(email, `${title} — ViralizaHost`, title, message, { label: 'Ver na área de cliente', link: `${siteUrl()}${link}` }, profileId)
  } catch (e) { console.error('[vps/requests] notify client', (e as Error).message) }
}
const lineFor = (r: { plan_slug: string; cycle: string; options: unknown }): CartLineInput => {
  const o = parse(r.options)
  return { type: 'product', slug: r.plan_slug, cycle: r.cycle as never, options: { location: o.location?.id, image: o.image?.id, hostname: o.hostname ?? undefined, sshKey: o.sshKey ?? undefined, addons: (o.addons ?? []).map((a: any) => a.id) } }
}

// ── Pedido (configurador público; validação e preço calculados no servidor) ──
export async function createVpsRequest(input: Record<string, any>, ctx: { userId: string | null; ip: string }) {
  const db = getPool()
  const s = await loadCloudSettings(db)
  const [[me]] = ctx.userId ? await db.query('SELECT id, email, full_name, phone, role FROM profiles WHERE id = ?', [ctx.userId]) as any : [[null]]
  if (s.mode === 'disabled') throw new CloudError('vps_disabled', 'A contratação de VPS está temporariamente indisponível.', 403)
  if (s.mode === 'test' && me?.role !== 'admin') throw new CloudError('vps_test_admin_only', 'Cloud VPS em modo de teste: pedidos reservados a administradores.', 403)
  if (!me) throw new CloudError('login_required', 'Inicie sessão (ou crie conta) para solicitar o VPS: o acesso e a gestão ficam na sua Área do Cliente.', 401)
  const slug = clean(input.plan, 120), cycle = clean(input.cycle, 16)
  const [prod] = await rows(db, "SELECT id, slug, name FROM products WHERE slug = ? AND category = 'vps' AND subcategory IS NULL AND active = 1 AND sale_status = 'active'", [slug])
  if (!prod) throw new CloudError('plan', 'Escolha um plano VPS disponível.')
  if (!VPS_CYCLES.some(c => c.cycle === cycle)) throw new CloudError('cycle', 'Escolha um período válido.')
  const opt = input.options ?? {}
  const line: CartLineInput = { type: 'product', slug, cycle: cycle as never, options: { location: opt.location, image: opt.image, hostname: opt.hostname, sshKey: opt.sshKey, addons: Array.isArray(opt.addons) ? opt.addons : [] } }
  // Mesma validação da compra (localização, instalação compatível, licença, hostname, chave SSH, extras, ciclo sustentável)
  const q = await quoteCart([line], { userId: me.id, checkAvailability: false, vpsValidateOnly: true })
  const l = q.lines[0]
  if (!q.valid || !l || l.error) throw new CloudError(l?.error?.code ?? 'invalid', l?.error?.message ?? 'Configuração inválida.', 422)
  if (!l.options?.image) throw new CloudError('options_required', 'Escolha o sistema operativo ou aplicação.', 422)
  const notes = String(input.notes ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 2000) || null
  const dedupe = sha(`${me.id}|${prod.id}|${cycle}|${l.options?.image?.id}|${l.options?.location?.id}|${l.options?.hostname ?? ''}`)
  const [dup] = await rows(db, `SELECT reference FROM vps_requests WHERE dedupe_key = ? AND status IN (${VPS_OPEN.map(() => '?').join(',')}) LIMIT 1`, [dedupe, ...VPS_OPEN])
  if (dup) return { reference: dup.reference as string, duplicate: true }
  const [[open]] = await db.query(`SELECT COUNT(*) n FROM vps_requests WHERE profile_id = ? AND status IN (${VPS_OPEN.map(() => '?').join(',')})`, [me.id, ...VPS_OPEN]) as any
  if (Number(open.n) >= 10) throw new CloudError('too_many_open', 'Tem demasiados pedidos de VPS em aberto. Aguarde a resposta da equipa.', 429)
  let kind: 'new' | 'upgrade' = 'new', upgradeServiceId: string | null = null
  if (input.upgradeServiceId) {
    const [svc] = await rows(db, "SELECT s.id FROM services s JOIN products p ON p.id = s.product_id WHERE s.id = ? AND s.profile_id = ? AND p.category = 'vps' AND s.status IN ('active','suspended')", [String(input.upgradeServiceId), me.id])
    if (!svc) throw new CloudError('upgrade', 'VPS inexistente ou de outra conta.', 404)
    kind = 'upgrade'; upgradeServiceId = svc.id
  }
  const id = randomUUID(), ym = new Date().toISOString().slice(0, 7).replace('-', '')
  let reference = ''
  for (let i = 0; i < 5; i++) {
    reference = `VH-VPS-${ym}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
    try {
      await db.query(`INSERT INTO vps_requests (id, reference, kind, upgrade_service_id, profile_id, full_name, email, phone, company, product_id, cycle, options, notes, quoted_total, is_test, ip_hash, dedupe_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, reference, kind, upgradeServiceId, me.id, clean(me.full_name, 160) || me.email, me.email, clean(input.phone, 40) || me.phone || null, clean(input.company, 160) || null, prod.id, cycle,
          JSON.stringify(l.options), notes, q.total, s.mode === 'test' ? 1 : 0, sha(`ip|${ctx.ip}`), dedupe])
      break
    } catch (e) { if ((e as { errno?: number }).errno !== 1062 || i === 4) throw e }
  }
  await event(db, id, me.id, null, 'submitted', 'submitted', kind === 'upgrade' ? 'Pedido de upgrade' : null)
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'create', 'vps_request', ?, ?)", [me.id, id, `Pedido VPS ${reference} (${prod.name}, ${cycle})`]).catch(() => {})
  await notifyAdmins('Novo pedido de VPS', `${reference}: ${me.email} — ${prod.name}, ${l.options?.image?.label ?? ''}, ${l.options?.location?.label ?? ''}.`, `/admin/cloud-vps/solicitacoes?pedido=${reference}`)
  await notifyClient(me.id, me.email, 'Pedido de VPS recebido', `Recebemos o seu pedido ${reference} (${prod.name}). A equipa vai verificar preço, localização e disponibilidade. Só depois da aprovação é emitida a factura.`)
  return { reference, duplicate: false }
}

// ── Consulta (painel) ──
export async function listVpsRequests(f: { status?: string; q?: string; page?: number } = {}) {
  const where: string[] = [], args: unknown[] = []
  if (f.status === 'open') { where.push(`r.status IN (${VPS_OPEN.map(() => '?').join(',')})`); args.push(...VPS_OPEN) }
  else if (f.status && f.status in VPS_REQ_LABEL) { where.push('r.status = ?'); args.push(f.status) }
  if (f.q) { const q = `%${f.q.slice(0, 80)}%`; where.push('(r.reference LIKE ? OR r.email LIKE ? OR r.full_name LIKE ?)'); args.push(q, q, q) }
  const page = Math.max(1, Number(f.page ?? 1) || 1), size = 25
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [[c]] = await getPool().query(`SELECT COUNT(*) n FROM vps_requests r ${w}`, args) as any
  const items = await rows(getPool(), `SELECT r.id, r.reference, r.kind, r.full_name, r.email, r.cycle, r.status, r.options, r.quoted_total, r.is_test, r.created_at, p.name plan_name
    FROM vps_requests r JOIN products p ON p.id = r.product_id ${w} ORDER BY r.created_at DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, args)
  return { items: items.map(r => ({ ...r, options: parse(r.options) })), total: Number(c.n), page, pages: Math.max(1, Math.ceil(Number(c.n) / size)) }
}

/** Verificação para a aprovação: preço actual do fornecedor vs custo esperado/limite, item, moeda, instalação, localização. */
async function providerCheck(r: any) {
  const [p] = await rows(getPool(), `SELECT p.provider_product_id, p.provider_mode, pp.provider_item_id, pp.provider_cost_minor, pp.provider_currency, pp.provider_cost_limit_minor, pp.provider_renewal_minor
    FROM products p LEFT JOIN product_prices pp ON pp.product_id = p.id AND pp.cycle = ? WHERE p.id = ?`, [r.cycle, r.product_id])
  const checks: { label: string; ok: boolean | null; detail: string }[] = []
  checks.push({ label: 'Produto do fornecedor associado', ok: !!p?.provider_product_id, detail: p?.provider_product_id ?? 'sem associação: aquisição manual pela equipa' })
  checks.push({ label: 'Item de preço do ciclo', ok: !!p?.provider_item_id, detail: p?.provider_item_id ?? 'em falta' })
  let price: any = null
  const cl = await vpsClient('read')
  if ('error' in cl) checks.push({ label: 'Preço actual no fornecedor', ok: null, detail: cl.error })
  else {
    try { price = (await cl.client.catalog()).flatMap(i => i.prices).find(x => x.id === p?.provider_item_id) ?? null } catch (e) { checks.push({ label: 'Preço actual no fornecedor', ok: null, detail: (e as Error).message }) }
    if (p?.provider_item_id && !checks.some(c => c.label === 'Preço actual no fornecedor')) {
      const cost = price ? (price.first_period_price ?? price.price) : null
      checks.push({ label: 'Item existe no catálogo', ok: !!price, detail: price ? `${(cost / 100).toFixed(2)} ${price.currency} (renova ${(price.price / 100).toFixed(2)})` : 'item já não existe no catálogo' })
      if (price) {
        checks.push({ label: 'Moeda igual à do plano', ok: price.currency === p.provider_currency, detail: `${price.currency} / plano ${p.provider_currency ?? '—'}` })
        checks.push({ label: 'Custo dentro do limite', ok: p.provider_cost_limit_minor != null && cost <= Number(p.provider_cost_limit_minor), detail: `limite ${p.provider_cost_limit_minor != null ? (Number(p.provider_cost_limit_minor) / 100).toFixed(2) : '—'}` })
      }
    }
  }
  const o = parse(r.options)
  checks.push({ label: 'Instalação e localização escolhidas', ok: !!(o.image?.id && o.location?.id), detail: `${o.image?.label ?? '—'} · ${o.location?.label ?? '—'}` })
  return { checks, price, provider: p ?? null }
}

export async function vpsRequestDetail(idOrRef: string) {
  const db = getPool()
  const [r] = await rows(db, `SELECT r.*, p.name plan_name, p.slug plan_slug, o.order_number, o.payment_status, i.id invoice_id, i.invoice_number, i.status invoice_status
    FROM vps_requests r JOIN products p ON p.id = r.product_id LEFT JOIN orders o ON o.id = r.order_id LEFT JOIN invoices i ON i.order_id = r.order_id WHERE r.id = ? OR r.reference = ?`, [idOrRef, idOrRef])
  if (!r) return null
  const [op] = r.service_id ? await rows(db, 'SELECT id, status, provider_vm_id, provider_status, ipv4, message, expected_cost_minor, currency, access_method, access_configured_at FROM vps_provider_orders WHERE service_id = ?', [r.service_id]) : [null]
  const [svc] = r.service_id ? await rows(db, 'SELECT provisioning_status, provisioning_error, status FROM services WHERE id = ?', [r.service_id]) : [null]
  return {
    request: { ...r, options: parse(r.options), ip_hash: undefined, dedupe_key: undefined },
    check: ['submitted', 'under_review', 'approved', 'paid'].includes(r.status) ? await providerCheck(r) : null,
    provisioning: op ? { ...op, events: await rows(db, 'SELECT event, detail, created_at FROM vps_provider_events WHERE provider_order_id = ? ORDER BY created_at', [op.id]), service: svc } : null,
    events: await rows(db, 'SELECT e.*, pr.full_name actor_name FROM vps_request_events e LEFT JOIN profiles pr ON pr.id = e.actor_id WHERE e.request_id = ? ORDER BY e.created_at', [r.id]),
  }
}

// ── Transições (painel) ──
const ALLOWED: Record<string, VpsRequestStatus[]> = {
  start_review: ['submitted'], note: Object.keys(VPS_REQ_LABEL) as VpsRequestStatus[], approve: ['under_review'], reject: ['submitted', 'under_review', 'approved'],
  cancel: ['submitted', 'under_review', 'approved', 'awaiting_payment'], send_to_payment: ['approved'], refresh_payment: ['awaiting_payment'],
  simulate_payment: ['awaiting_payment'], authorize_purchase: ['paid', 'failed', 'purchase_authorized'],
}
export async function vpsRequestAction(adminId: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  if (!(action in ALLOWED)) throw new CloudError('action_invalid', 'Acção inválida.')
  const db = getPool()
  const [r] = await rows(db, 'SELECT r.*, p.name plan_name, p.slug plan_slug FROM vps_requests r JOIN products p ON p.id = r.product_id WHERE r.id = ?', [id])
  if (!r) throw new CloudError('not_found', 'Pedido inexistente.', 404)
  if (!ALLOWED[action].includes(r.status)) throw new CloudError('invalid_transition', `Acção indisponível no estado «${VPS_REQ_LABEL[r.status as VpsRequestStatus]}».`, 409)
  const s = await loadCloudSettings(db)
  if (['approve', 'send_to_payment', 'authorize_purchase', 'simulate_payment'].includes(action) && s.mode === 'disabled') throw new CloudError('vps_disabled', 'Cloud VPS desactivado: só é possível consultar, rejeitar ou cancelar.', 409)
  const note = clean(payload.note, 1000) || null
  const move = async (conn: Queryable, to: VpsRequestStatus, extra: Record<string, unknown> = {}) => {
    const cols = Object.keys(extra)
    const [u] = await conn.query(`UPDATE vps_requests SET status = ?, reviewed_by = ?${cols.map(c => `, \`${c}\` = ?`).join('')} WHERE id = ? AND status = ?`, [to, adminId, ...cols.map(c => extra[c]), id, r.status]) as any
    if (!u.affectedRows) throw new CloudError('conflict', 'O pedido foi alterado entretanto: recarregue.', 409)
    await event(conn, id, adminId, r.status, to, action, note)
  }
  const log = (desc: string, act = 'update') => db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, ?, 'vps_request', ?, ?)", [adminId, act, id, desc.slice(0, 500)]).catch(() => {})
  switch (action) {
    case 'start_review': await move(db, 'under_review'); break
    case 'note':
      if (!note) throw new CloudError('note_required', 'Escreva a nota.')
      await db.query("UPDATE vps_requests SET internal_notes = CONCAT(COALESCE(internal_notes, ''), ?) WHERE id = ?", [`[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${note}\n`, id])
      await event(db, id, adminId, r.status, r.status, 'note', note); break
    case 'approve': {
      // Revalida a configuração e o preço de venda (servidor) e regista o custo do fornecedor verificado
      const q = await quoteCart([lineFor(r)], { userId: r.profile_id, checkAvailability: false, vpsValidateOnly: true })
      if (!q.valid) throw new CloudError('config_invalid', `Configuração já não é válida: ${q.lines.map(l => l.error?.message).filter(Boolean).join(' ')}`, 409)
      const chk = await providerCheck(r)
      const failing = chk.checks.filter(c => c.ok === false)
      if (failing.length && payload.acceptWarnings !== true) throw new CloudError('checks_failed', `Verificações por resolver: ${failing.map(c => `${c.label} (${c.detail})`).join('; ')}. Corrija ou aprove para aquisição manual confirmando os avisos.`, 409)
      await move(db, 'approved', { approved_by: adminId, approved_at: new Date(), quoted_total: q.total, provider_cost_minor: chk.price ? (chk.price.first_period_price ?? chk.price.price) : null, provider_currency: chk.price?.currency ?? null })
      await log(`Pedido ${r.reference} aprovado (venda ${q.total} Kz${chk.price ? `, custo ${(chk.price.first_period_price ?? chk.price.price) / 100} ${chk.price.currency}` : ''})`)
      await notifyClient(r.profile_id, r.email, 'Pedido de VPS aprovado', `O pedido ${r.reference} foi aprovado. Vamos emitir a factura para pagamento.`)
      break
    }
    case 'reject':
      if (!note || note.length < 5) throw new CloudError('reason_required', 'Indique o motivo (enviado ao cliente).')
      await move(db, 'rejected', { decision_reason: note }); await log(`Pedido ${r.reference} rejeitado: ${note}`)
      await notifyClient(r.profile_id, r.email, 'Pedido de VPS não aprovado', `O pedido ${r.reference} não foi aprovado. Motivo: ${note}`); break
    case 'cancel':
      await withTransaction(async conn => {
        await move(conn, 'cancelled', { decision_reason: note })
        if (r.order_id) {
          await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ? AND payment_status <> 'paid'", [r.order_id])
          await conn.query("UPDATE invoices SET status = 'cancelled' WHERE order_id = ? AND status <> 'paid'", [r.order_id])
          await conn.query("UPDATE services SET status = 'cancelled' WHERE order_id = ? AND provisioning_status <> 'active'", [r.order_id])
        }
      })
      await log(`Pedido ${r.reference} cancelado`); await notifyClient(r.profile_id, r.email, 'Pedido de VPS cancelado', `O pedido ${r.reference} foi cancelado.${note ? ` ${note}` : ''}`); break
    case 'send_to_payment': {
      if (s.mode === 'test' && !Number(r.is_test)) throw new CloudError('test_mode', 'Modo de teste: só pedidos de teste.', 409)
      const line = lineFor(r)
      const q = await quoteCart([line], { userId: r.profile_id, vpsRequestId: id, checkAvailability: false })
      if (!q.valid) throw new CloudError('quote_invalid', `Não foi possível preparar a encomenda: ${q.lines.map(l => l.error?.message).filter(Boolean).join(' ')}`, 409)
      try {
        const { order } = await createOrder({ userId: r.profile_id, idempotencyKey: `vpsreq-${id}`, lines: [line], acceptedTotal: q.total, paymentMethod: 'bank_transfer', vpsRequestId: id })
        const [svc] = await rows(db, "SELECT s.id FROM services s JOIN products p ON p.id = s.product_id WHERE s.order_id = ? AND p.category = 'vps' LIMIT 1", [order.id])
        await move(db, 'awaiting_payment', { order_id: order.id, service_id: svc?.id ?? null, quoted_total: order.total })
        await log(`Pedido ${r.reference}: encomenda ${order.order_number}, factura ${order.invoice_number}, ${order.total} Kz`, 'payment')
        await notifyClient(r.profile_id, r.email, 'Factura do seu VPS', `O pedido ${r.reference} foi aprovado. Factura ${order.invoice_number}: ${order.total.toLocaleString('pt-PT')} Kz. Depois do pagamento confirmado, a aquisição é autorizada pela equipa.`, '/billing')
      } catch (e) { if (e instanceof OrderError) throw new CloudError(e.code, e.message, e.status); throw e }
      break
    }
    case 'refresh_payment': {
      const [o] = await rows(db, 'SELECT payment_status FROM orders WHERE id = ?', [r.order_id])
      if (o?.payment_status !== 'paid') throw new CloudError('not_paid', 'O pagamento ainda não foi confirmado (Financeiro).', 409)
      await markVpsRequestPaid(id, adminId); break
    }
    case 'simulate_payment': {
      if (!Number(r.is_test) || s.providerMode !== 'test') throw new CloudError('not_test', 'Pagamento simulado só para pedidos de teste com a API simulada.', 409)
      const [inv] = await rows(db, 'SELECT id, total FROM invoices WHERE order_id = ?', [r.order_id])
      try { await confirmPayment({ invoiceId: inv.id, amount: Number(inv.total), source: 'proof', method: 'bank_transfer', reviewerId: adminId }) } catch (e) { if (e instanceof PaymentError) throw new CloudError(e.code, e.message, e.status); throw e }
      await markVpsRequestPaid(id, adminId); break
    }
    case 'authorize_purchase': {
      // Autorização SEPARADA da aquisição no fornecedor: o motor revalida preço, moeda, limite, orçamento, produto,
      // template, centro de dados e a inexistência de outra compra para este serviço (vps_provider_orders UNIQUE).
      if (String(payload.confirmText ?? '').trim().toUpperCase() !== 'AUTORIZO AQUISICAO') throw new CloudError('confirm_required', 'Escreva «AUTORIZO AQUISICAO» para autorizar a compra no fornecedor.', 400)
      const [o] = await rows(db, 'SELECT payment_status FROM orders WHERE id = ?', [r.order_id])
      if (o?.payment_status !== 'paid') throw new CloudError('not_paid', 'Pagamento do cliente não confirmado.', 409)
      // Já autorizado mas bloqueado (orçamento, operações, configuração): repetir depois de corrigir a causa
      if (r.status === 'purchase_authorized') await event(db, id, adminId, r.status, r.status, 'authorize_purchase_retry', note)
      else await move(db, 'purchase_authorized', { purchase_authorized_by: adminId, purchase_authorized_at: new Date() })
      await log(`Pedido ${r.reference}: aquisição AUTORIZADA${r.status === 'purchase_authorized' ? ' (nova tentativa)' : ''}`, 'activate')
      await db.query("UPDATE services SET provisioning_status = 'pending', provisioning_error = NULL WHERE id = ? AND provisioning_status IN ('manual_required','failed','pending')", [r.service_id])
      const { provisionService, refreshOrderActivation } = await import('@/lib/commerce/provisioning')
      const out = await provisionService(r.service_id)
      await refreshOrderActivation(r.order_id).catch(() => {})
      return { ...(await vpsRequestDetail(id)), outcome: out }
    }
  }
  return vpsRequestDetail(id)
}

/** Pagamento confirmado (Financeiro, gateway ou simulação de teste): pedido → «Pago». Idempotente. */
export async function markVpsRequestPaid(requestId: string, actorId: string | null) {
  const db = getPool()
  const [u] = await db.query("UPDATE vps_requests SET status = 'paid' WHERE id = ? AND status = 'awaiting_payment'", [requestId]) as any
  if (!u.affectedRows) return false
  await event(db, requestId, actorId, 'awaiting_payment', 'paid', 'payment_confirmed')
  const [r] = await rows(db, 'SELECT reference, profile_id, email FROM vps_requests WHERE id = ?', [requestId])
  await notifyAdmins('VPS pago: autorizar aquisição', `${r.reference}: pagamento confirmado. Autorize a aquisição em Cloud VPS → Solicitações.`, `/admin/cloud-vps/solicitacoes?pedido=${r.reference}`)
  await notifyClient(r.profile_id, r.email, 'Pagamento do VPS confirmado', `Confirmámos o pagamento do pedido ${r.reference}. A equipa vai autorizar a aquisição e preparar o seu VPS.`)
  return true
}

/**
 * Usado pelo motor de compra: este serviço pode ser adquirido no fornecedor?
 *   pedido associado → só com aquisição autorizada; sem pedido → só no modo automático (ou teste, por administrador).
 */
export async function purchaseAuthorization(serviceId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getPool()
  const s = await loadCloudSettings(db)
  if (!s.operations.purchases) return { ok: false, message: 'Compras no fornecedor desactivadas (Cloud VPS → Configurações → Operações).' }
  const [req] = await rows(db, 'SELECT id, status, purchase_authorized_at FROM vps_requests WHERE service_id = ?', [serviceId])
  if (req) {
    if (req.status === 'awaiting_payment') await markVpsRequestPaid(req.id, null)
    if (!req.purchase_authorized_at) return { ok: false, message: 'Pago: aguarda a autorização de aquisição (Cloud VPS → Solicitações).' }
    return { ok: true }
  }
  if (s.mode === 'disabled') return { ok: false, message: 'Cloud VPS desactivado: nenhuma aquisição.' }
  if (s.mode === 'automatic') return { ok: true }
  if (s.mode === 'test') {
    const [[b]] = await db.query('SELECT p.role FROM services s JOIN profiles p ON p.id = s.profile_id WHERE s.id = ?', [serviceId]) as any
    return b?.role === 'admin' && s.providerMode === 'test' ? { ok: true } : { ok: false, message: 'Modo de teste: só encomendas de administradores com a API simulada.' }
  }
  return { ok: false, message: 'Encomenda sem pedido aprovado: no modo «solicitação» a aquisição exige um pedido autorizado (analisar no painel).' }
}

/** Estado do pedido acompanha o aprovisionamento (chamado pelo motor). */
export async function syncRequestFromService(serviceId: string, status: string) {
  const to = status === 'active' ? 'active' : status === 'failed' ? 'failed' : status === 'in_progress' ? 'provisioning' : null
  if (!to) return
  const db = getPool()
  const [r] = await rows(db, 'SELECT id, status FROM vps_requests WHERE service_id = ?', [serviceId])
  if (!r || r.status === to || !['purchase_authorized', 'provisioning', 'failed'].includes(r.status)) return
  await db.query('UPDATE vps_requests SET status = ? WHERE id = ?', [to, r.id])
  await event(db, r.id, null, r.status, to, 'provisioning', null)
}

/** Área do cliente: pedidos do próprio utilizador. */
export async function clientVpsRequests(profileId: string) {
  const list = await rows(getPool(), `SELECT r.id, r.reference, r.kind, r.cycle, r.status, r.options, r.quoted_total, r.decision_reason, r.created_at, p.name plan_name,
      o.order_number, o.payment_status, i.id invoice_id, i.invoice_number FROM vps_requests r JOIN products p ON p.id = r.product_id
      LEFT JOIN orders o ON o.id = r.order_id AND o.user_id = r.profile_id LEFT JOIN invoices i ON i.order_id = o.id
      WHERE r.profile_id = ? AND r.status <> 'active' ORDER BY r.created_at DESC LIMIT 30`, [profileId])
  return list.map(r => ({ ...r, options: parse(r.options) }))
}
