import 'server-only'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { Resolver } from 'node:dns/promises'
import { getPool } from '@/lib/db/pool'
import { getDefaultNameservers } from '@/lib/commerce/nameserver-settings'
import { RegistrarTimeout } from './types'
import { hostingerForDomain, registrarDomain } from './settings'
import { selectDomainPrice } from './hostinger-catalog'
import { HostingerError, hostingerAdapter, type DomainDetails, type HostingerClient, type PortfolioDomain } from './hostinger'

// Registo na Hostinger a partir de uma encomenda PAGA, sempre com autorização explícita de um
// administrador, item a item. Regras:
//   * Pré-visualização: domínio, período, titular, nameservers, custo e moeda do fornecedor, método de
//     pagamento predefinido. Sem custo confirmado no catálogo → revisão manual (não compra).
//   * Antes de comprar: disponibilidade e portefólio consultados de novo; se o domínio já está na conta
//     (encomenda antiga, compra anterior), NUNCA compra outra vez: associa ou conclui a configuração.
//   * Uma operação por serviço (registrar_operations), reserva com prazo contra duplo clique e pedidos
//     concorrentes. Timeout/resposta ambígua → «unknown»: a próxima acção consulta o portefólio e,
//     se continuar inconclusivo, fica em revisão manual (nunca nova compra automática).
//   * HTTP 202 → pagamento ao fornecedor pendente. Domínio pago a aguardar configuração → «setup»
//     (sem nova compra). «Registado» só com confirmação da Hostinger (detalhe do domínio).
//   * Nameservers aplicados depois do registo (a compra não os aceita); «DNS pendente» até a
//     delegação pública responder com os nameservers da encomenda.

/* eslint-disable @typescript-eslint/no-explicit-any */
const LOCK_SECONDS = 120
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const clean = (s: unknown) => String(s ?? '').replace(/Bearer\s+\S+/gi, 'Bearer [oculto]').replace(/https?:\/\/\S+/g, '[url]').slice(0, 480)

export class FlowError extends Error { constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) { super(message) } }

/* ───────────── Titular ───────────── */

export interface Owner { first_name: string; last_name: string; company_name: string; email: string; phone: string; address: string; city: string; state: string; zip: string; country: string; tax_id: string }
export const OWNER_LABEL: Record<keyof Owner, string> = { first_name: 'Nome', last_name: 'Apelido', company_name: 'Empresa', email: 'E-mail', phone: 'Telefone', address: 'Morada', city: 'Cidade', state: 'Província', zip: 'Código postal', country: 'País', tax_id: 'NIF' }
/** Campos que pedimos sempre antes de criar o perfil WHOIS. A Hostinger pode exigir outros por
 *  extensão/país: devolve-os num 422 (errors.whois_details), que mostramos para correcção. */
const OWNER_REQUIRED: (keyof Owner)[] = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'country']

async function loadOwner(profileId: string): Promise<Owner> {
  const [[r]] = await getPool().query(
    `SELECT p.email, p.full_name, p.phone, p.country, c.address, c.city, c.state, c.postal_code, c.company_name, c.tax_id
     FROM profiles p LEFT JOIN clients c ON c.profile_id = p.id WHERE p.id = ?`, [profileId]) as any
  const name = String(r?.full_name ?? '').trim().replace(/\s+/g, ' ')
  const i = name.lastIndexOf(' ')
  return {
    first_name: i > 0 ? name.slice(0, i) : name, last_name: i > 0 ? name.slice(i + 1) : '',
    company_name: String(r?.company_name ?? '').trim(), email: String(r?.email ?? '').trim(),
    phone: String(r?.phone ?? '').replace(/[^\d+]/g, ''), address: String(r?.address ?? '').trim(), city: String(r?.city ?? '').trim(),
    state: String(r?.state ?? '').trim(), zip: String(r?.postal_code ?? '').trim(), country: String(r?.country ?? '').trim().toUpperCase(), tax_id: String(r?.tax_id ?? '').trim(),
  }
}
function ownerMissing(o: Owner): (keyof Owner)[] {
  const bad: (keyof Owner)[] = []
  for (const f of OWNER_REQUIRED) if (!o[f]) bad.push(f)
  if (o.phone && !/^\+?\d{9,15}$/.test(o.phone)) bad.push('phone')
  if (o.country && !/^[A-Z]{2}$/.test(o.country)) bad.push('country')
  if (o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) bad.push('email')
  return [...new Set(bad)]
}

/** Correcção dos dados do titular (pelo administrador, antes da compra). */
export async function saveOwner(serviceId: string, input: Partial<Record<keyof Owner, string>>, adminId: string) {
  const s = await loadService(serviceId)
  const cur = await loadOwner(s.profile_id)
  const v = (k: keyof Owner) => (k in input ? String(input[k] ?? '').trim() : cur[k])
  const full = `${v('first_name')} ${v('last_name')}`.trim().replace(/\s+/g, ' ')
  const db = getPool()
  await db.query('UPDATE profiles SET full_name = ?, phone = ?, country = ? WHERE id = ?', [full, v('phone'), v('country').toUpperCase(), s.profile_id])
  await db.query(`INSERT INTO clients (id, profile_id, address, city, state, postal_code, company_name, tax_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE address = VALUES(address), city = VALUES(city), state = VALUES(state), postal_code = VALUES(postal_code), company_name = VALUES(company_name), tax_id = VALUES(tax_id)`,
  [randomUUID(), s.profile_id, v('address'), v('city'), v('state') || null, v('zip') || null, v('company_name') || null, v('tax_id') || null])
  await db.query("INSERT INTO activity_logs (id, profile_id, action, entity_type, entity_id, description) VALUES (UUID(), ?, 'update', 'client', ?, ?)", [adminId, s.profile_id, `dados do titular corrigidos para o registo de ${s.domain}`]).catch(() => {})
}

/* ───────────── Serviço e operação ───────────── */

async function loadService(serviceId: string) {
  const [[s]] = await getPool().query(
    `SELECT s.id, s.order_id, s.profile_id, s.service_type, s.domain, s.provisioning_status, s.renews_service_id,
       oi.years, oi.domain_operation, oi.domain_name AS item_domain, oi.nameservers AS item_ns, o.order_number, o.payment_status, o.ns1, o.ns2, o.ns3, o.ns4
     FROM services s JOIN orders o ON o.id = s.order_id LEFT JOIN order_items oi ON oi.id = s.order_item_id WHERE s.id = ?`, [serviceId]) as any
  if (!s) throw new FlowError('Serviço inexistente.', 404)
  // Encomendas antigas: domínio com maiúsculas/espaços ou só no item → forma normalizada
  s.domain = registrarDomain(s.domain || s.item_domain) ?? s.domain
  return s
}

async function nameserversFor(s: any): Promise<{ ns: string[]; useDefault: boolean }> {
  try {
    const it = s.item_ns ? (typeof s.item_ns === 'string' ? JSON.parse(s.item_ns) : s.item_ns) : null
    if (Array.isArray(it?.ns) && it.ns.length >= 2) return { ns: it.ns, useDefault: it.useDefault !== false }
  } catch { /* JSON inválido → encomenda */ }
  const ns = [s.ns1, s.ns2, s.ns3, s.ns4].filter(Boolean)
  return ns.length >= 2 ? { ns, useDefault: false } : { ns: await getDefaultNameservers(), useDefault: true }
}

async function getOperation(serviceId: string) {
  const [[op]] = await getPool().query("SELECT * FROM registrar_operations WHERE service_id = ? AND operation = 'register'", [serviceId]) as any
  return op ?? null
}

async function ensureOperation(s: any, mode: string) {
  await getPool().query(
    `INSERT IGNORE INTO registrar_operations (id, service_id, operation, domain, provider, mode, client_ref, status) VALUES (?, ?, 'register', ?, 'hostinger', ?, ?, 'pending')`,
    [randomUUID(), s.id, s.domain, mode, `vh-register-${s.id}`.slice(0, 64)])
  const op = await getOperation(s.id)
  // Operação de outro fornecedor ainda não enviada: passa a ser da Hostinger
  if (op.provider !== 'hostinger' && ['pending', 'failed'].includes(op.status)) {
    await getPool().query("UPDATE registrar_operations SET provider = 'hostinger', mode = ? WHERE id = ?", [mode, op.id])
    op.provider = 'hostinger'
  }
  return op
}

async function event(opId: string, kind: string, r: { http?: number | null; outcome?: string | null; message?: string | null; actor?: string | null }) {
  await getPool().query('INSERT INTO registrar_operation_events (id, operation_id, kind, http_status, outcome, message, actor_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [randomUUID(), opId, kind, r.http ?? null, r.outcome ?? null, r.message ? clean(r.message) : null, r.actor ?? null])
}

async function setOp(opId: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch)
  if (!keys.length) return
  await getPool().query(`UPDATE registrar_operations SET ${keys.map(k => `\`${k}\` = ?`).join(', ')} WHERE id = ?`, [...keys.map(k => patch[k] ?? null), opId])
}

/** Reserva exclusiva da operação (duplo clique, dois administradores, dois separadores). */
async function lock(opId: string) {
  const [r] = await getPool().query(`UPDATE registrar_operations SET locked_until = CURRENT_TIMESTAMP(6) + INTERVAL ${LOCK_SECONDS} SECOND
    WHERE id = ? AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP(6))`, [opId]) as any
  if (!r.affectedRows) throw new FlowError('Já há um pedido em curso para este domínio. Aguarde e consulte o estado.', 409, { code: 'busy' })
}
const unlock = (opId: string) => getPool().query('UPDATE registrar_operations SET locked_until = NULL WHERE id = ?', [opId])

/* ───────────── Fornecedor: preço, portefólio, contactos ───────────── */

const isRegistered = (d: DomainDetails | null) => !!d && (!!d.registered_at || /^(active|registered)$/i.test(String(d.status ?? '')))
const VERIFY_MSG: Record<string, string> = {
  manual_review: 'A Hostinger está a rever a encomenda (verificação interna). Não há nada a fazer: consulte o estado mais tarde.',
  sms_code: 'A Hostinger enviou um código por SMS para o telefone do titular: introduza-o no hPanel (Domínios).',
  contact_verification: 'O registo aguarda a verificação do contacto do titular: conclua-a no hPanel (Domínios); o registo continua depois.',
}

async function ensureWhois(client: HostingerClient, profileId: string, ext: string, o: Owner): Promise<{ id: number } | { errors: Record<string, unknown>; message: string }> {
  const tld = ext.replace(/^\./, '')
  const details: Record<string, string> = Object.fromEntries(
    (['first_name', 'last_name', 'company_name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'country'] as const).filter(k => o[k]).map(k => [k, o[k]]))
  const entity = o.company_name ? 'organization' : 'individual'
  const hash = sha(JSON.stringify({ tld, entity, details }))
  const db = getPool()
  const [[c]] = await db.query("SELECT provider_contact_id FROM registrar_contacts WHERE provider = 'hostinger' AND profile_id = ? AND tld = ? AND details_hash = ?", [profileId, tld, hash]) as any
  if (c) return { id: Number(c.provider_contact_id) }
  try {
    const w = await client.createWhois({ tld, country: o.country, entity_type: entity, whois_details: details })
    if (!w?.id) return { errors: {}, message: 'A Hostinger não devolveu o identificador do perfil WHOIS.' }
    await db.query("INSERT IGNORE INTO registrar_contacts (id, provider, profile_id, tld, details_hash, provider_contact_id) VALUES (?, 'hostinger', ?, ?, ?, ?)", [randomUUID(), profileId, tld, hash, String(w.id)])
    return { id: Number(w.id) }
  } catch (e) {
    if (e instanceof HostingerError && e.status === 422) return { errors: e.errors ?? {}, message: 'A Hostinger recusou os dados do titular para esta extensão.' }
    throw e
  }
}

/* ───────────── Pré-visualização ───────────── */

export type NextStep = 'purchase' | 'setup' | 'reconcile' | 'link' | 'blocked' | 'done'
export interface Preview {
  serviceId: string; orderNumber: string; domain: string; years: number; extension: string | null
  owner: Owner; ownerMissing: (keyof Owner)[]
  nameservers: string[]; nsDefault: boolean
  /** Valores da API em unidades menores (cêntimos) e moeda tal como devolvida; amount/renewal = minor / 100 só para mostrar. */
  cost: { amountMinor: number; renewalMinor: number; amount: number; renewal: number; currency: string; itemId: string; label: string; product: string } | null
  paymentMethod: { id: number; label: string } | null
  availability: 'available' | 'unavailable' | 'unknown' | null
  portfolio: { status: string | null; registered: boolean; verification: string | null } | null
  operation: { provider: string; status: string; providerStatus: string | null; providerOrderId: string | null; providerRef: string | null; nsStatus: string | null; nsMessage: string | null; dnsStatus: string | null; attempts: number; message: string | null; authorizedAt: string | null } | null
  next: NextStep
  blockers: string[]
  notes: string[]
  confirmToken: string | null
}

const tokenKey = () => process.env.WHM_ENCRYPTION_KEY || process.env.STORAGE_SIGNING_SECRET || 'vh'
function confirmTokenFor(p: Omit<Preview, 'confirmToken'>) {
  const payload = JSON.stringify([p.serviceId, p.domain, p.years, p.cost?.itemId, p.cost?.amountMinor, p.cost?.currency, p.nameservers, sha(JSON.stringify(p.owner)), p.paymentMethod?.id, p.next])
  return createHmac('sha256', tokenKey()).update(payload).digest('hex').slice(0, 32)
}

export async function preview(serviceId: string): Promise<Preview> {
  const s = await loadService(serviceId)
  const years = Math.max(1, Number(s.years ?? 1))
  const owner = await loadOwner(s.profile_id)
  const { ns, useDefault } = await nameserversFor(s)
  const op = await getOperation(serviceId)
  const base: Omit<Preview, 'confirmToken'> = {
    serviceId, orderNumber: s.order_number, domain: s.domain, years, extension: null, owner, ownerMissing: ownerMissing(owner), nameservers: ns, nsDefault: useDefault,
    cost: null, paymentMethod: null, availability: null, portfolio: null, next: 'blocked', blockers: [], notes: [],
    operation: op ? { provider: op.provider, status: op.status, providerStatus: op.provider_status, providerOrderId: op.provider_order_id, providerRef: op.provider_ref, nsStatus: op.ns_status, nsMessage: op.ns_message, dnsStatus: op.dns_status, attempts: Number(op.attempts ?? 0), message: op.message, authorizedAt: op.authorized_at } : null,
  }
  const done = (p: Omit<Preview, 'confirmToken'>): Preview => ({ ...p, confirmToken: ['purchase', 'setup', 'link'].includes(p.next) ? confirmTokenFor(p) : null })
  if (s.service_type !== 'domain' || s.renews_service_id || (s.domain_operation && s.domain_operation !== 'register')) return done({ ...base, blockers: ['Só os registos de domínio novos podem ser feitos aqui.'] })
  if (s.payment_status !== 'paid') return done({ ...base, blockers: ['O pagamento do cliente ainda não foi validado: nada é comprado na Hostinger.'] })
  if (s.provisioning_status === 'active' || op?.status === 'succeeded') return done({ ...base, next: 'done', notes: ['Domínio já registado e confirmado.'] })
  const h = await hostingerForDomain(s.domain)
  if ('error' in h) return done({ ...base, blockers: [h.error] })
  base.extension = h.extension
  const c = h.client
  // Tentativa anterior noutro fornecedor ainda por resolver: nunca comprar por cima dela
  if (op && op.provider !== 'hostinger' && ['submitted', 'unknown'].includes(op.status)) {
    return done({ ...base, blockers: [`Há uma tentativa anterior no fornecedor «${op.provider}» por resolver (${op.status}). Confirme nesse fornecedor se houve registo: se houve, use «Marcar como registado…»; se não houve, use «Libertar nova tentativa…».`] })
  }
  // Pedido já enviado ou resposta perdida: consultar antes de tudo
  if (op && (['submitted', 'unknown'].includes(op.status))) {
    return done({ ...base, next: 'reconcile', notes: [op.provider_status === 'payment_pending' ? 'Pagamento à Hostinger em processamento (HTTP 202). Consulte o estado: nenhuma nova compra é feita.' : 'Já existe um pedido enviado à Hostinger. Consulte o estado antes de qualquer nova tentativa.'] })
  }
  try {
    // O domínio já está na conta Hostinger? (encomendas antigas, compra feita no hPanel, 202 concluído)
    const details = await c.domain(s.domain)
    if (isRegistered(details)) return done({ ...base, portfolio: { status: details?.status ?? null, registered: true, verification: null }, next: 'link', notes: ['O domínio já está registado na conta Hostinger: associe-o à encomenda (sem nova compra).'] })
    const entry = (await c.portfolio()).find(d => (d.domain ?? '').toLowerCase() === s.domain)
    if (entry) {
      const ver = entry.verification?.type ?? null
      base.portfolio = { status: entry.status ?? null, registered: false, verification: ver }
      if (ver) return done({ ...base, next: 'reconcile', notes: [VERIFY_MSG[ver] ?? `A aguardar verificação «${ver}» no hPanel.`] })
      if (base.ownerMissing.length) return done({ ...base, blockers: ['Corrija os dados do titular antes de concluir o registo.'] })
      return done({ ...base, next: 'setup', notes: ['O domínio já está pago na conta Hostinger e aguarda configuração: concluir o registo não cria nova compra.'] })
    }
    // Disponibilidade, custo e método de pagamento (só leituras)
    const chk = await hostingerAdapter(c).check(s.domain)
    base.availability = chk.status
    const [cat, methods] = await Promise.all([
      c.catalog(`${h.extension.toUpperCase()}*`),
      c.paymentMethods().catch(() => []),
    ])
    const pr = selectDomainPrice(cat, h.extension, years)
    if (!pr.ok) base.blockers.push(`Custo não confirmado: ${pr.issue} Revisão manual: registe no hPanel e use «Marcar como registado…».`)
    else base.cost = { amountMinor: pr.amountMinor, renewalMinor: pr.renewalMinor, amount: pr.amountMinor / 100, renewal: pr.renewalMinor / 100, currency: pr.currency, itemId: pr.price.id, label: pr.price.name ?? pr.item.name, product: pr.item.name }
    const def = methods.find(m => m.is_default && !m.is_expired && !m.is_suspended)
    if (def) base.paymentMethod = { id: def.id, label: [def.name, def.identifier].filter(Boolean).join(' ') || `Método ${def.id}` }
    else base.blockers.push('A conta Hostinger não tem um método de pagamento predefinido válido (configure-o no hPanel).')
    if (chk.status === 'unavailable') base.blockers.push('O domínio já não está disponível: contactar o cliente (nenhuma compra feita).')
    else if (chk.status !== 'available') base.blockers.push(`Disponibilidade inconclusiva (${chk.message ?? 'sem resposta'}): revisão manual.`)
    if (base.ownerMissing.length) base.blockers.push(`Faltam dados do titular: ${base.ownerMissing.map(f => OWNER_LABEL[f]).join(', ')}.`)
    return done({ ...base, next: base.blockers.length ? 'blocked' : 'purchase' })
  } catch (e) {
    const msg = e instanceof RegistrarTimeout ? 'A Hostinger não respondeu a tempo.' : (e as HostingerError).status === 401 ? 'Token recusado pela Hostinger (401): verifique Integrações → Registrador.' : `Falha ao consultar a Hostinger: ${clean((e as Error).message)}`
    return done({ ...base, blockers: [msg] })
  }
}

/* ───────────── Acções ───────────── */

export interface ActionResult { ok: boolean; outcome: string; message: string; preview?: Preview; errors?: Record<string, unknown> }

async function activateRegistered(s: any, opId: string, ref: string | null, client: HostingerClient, actor: string | null) {
  await setOp(opId, { status: 'succeeded', provider_ref: ref, provider_status: 'registered', message: 'Registo confirmado pela Hostinger.' })
  await event(opId, 'registered', { outcome: 'succeeded', message: `registado${ref ? ` (${ref})` : ''}`, actor })
  const { activateFromRegistrar } = await import('@/lib/commerce/provisioning')
  await activateFromRegistrar(s.id, ref)
  await applyNameserversInternal(s, opId, client, actor)
}

async function applyNameserversInternal(s: any, opId: string, client: HostingerClient, actor: string | null) {
  const { ns } = await nameserversFor(s)
  try {
    const r = await client.setNameservers(s.domain, ns)
    if (r.status >= 200 && r.status < 300) {
      await setOp(opId, { ns_status: 'applied', ns_message: `Aplicados: ${ns.join(', ')}`, dns_status: 'pending' })
      await event(opId, 'nameservers', { http: r.status, outcome: 'applied', message: ns.join(', '), actor })
      await checkDns(s.id).catch(() => {})
      return true
    }
    const err = client.errorOf(r)
    await setOp(opId, { ns_status: 'failed', ns_message: `Falha ao aplicar ${ns.join(', ')}: ${clean(err.message)}` })
    await event(opId, 'nameservers', { http: r.status, outcome: 'failed', message: err.message, actor })
  } catch (e) {
    await setOp(opId, { ns_status: 'failed', ns_message: e instanceof RegistrarTimeout ? 'Sem resposta ao aplicar os nameservers.' : clean((e as Error).message) })
    await event(opId, 'nameservers', { outcome: 'failed', message: (e as Error).message, actor })
  }
  return false
}

/** Compra autorizada. confirmToken tem de corresponder ao que o administrador viu. */
export async function purchase(serviceId: string, confirmToken: string, adminId: string): Promise<ActionResult> {
  const s = await loadService(serviceId)
  const h = await hostingerForDomain(s.domain)
  if ('error' in h) throw new FlowError(h.error, 409)
  const op = await ensureOperation(s, h.mode)
  await lock(op.id)
  try {
    const p = await preview(serviceId)  // revalida tudo no servidor (pagamento, portefólio, disponibilidade, custo, titular)
    if (p.next !== 'purchase') return { ok: false, outcome: p.next, message: p.blockers[0] ?? p.notes[0] ?? 'Compra não permitida neste estado.', preview: p }
    if (!confirmToken || confirmToken !== p.confirmToken) return { ok: false, outcome: 'changed', message: 'Os dados mudaram desde a pré-visualização (custo, titular, nameservers ou método de pagamento). Reveja antes de confirmar.', preview: p }
    const w = await ensureWhois(h.client, s.profile_id, h.extension, p.owner)
    if ('errors' in w) {
      await event(op.id, 'whois', { http: 422, outcome: 'needs_correction', message: JSON.stringify(w.errors), actor: adminId })
      return { ok: false, outcome: 'needs_correction', message: `${w.message} Corrija os campos indicados (nada foi comprado).`, errors: w.errors, preview: p }
    }
    // Passa a «submitted» de forma atómica: só um pedido de compra por item, para sempre
    const [claim] = await getPool().query(`UPDATE registrar_operations SET status = 'submitted', attempts = attempts + 1, authorized_by = ?, authorized_at = CURRENT_TIMESTAMP(6),
      cost_amount = ?, cost_minor = ?, cost_currency = ?, item_id = ?, provider_status = 'requested', message = 'Compra pedida à Hostinger.' WHERE id = ? AND status IN ('pending','failed')`,
    [adminId, p.cost!.amount, p.cost!.amountMinor, p.cost!.currency, p.cost!.itemId, op.id]) as any
    if (!claim.affectedRows) return { ok: false, outcome: 'busy', message: 'Outro pedido já foi enviado para este item.' }
    await event(op.id, 'purchase_request', { outcome: 'submitted', message: `${p.domain} · ${p.years} ano(s) · ${p.cost!.product} · ${p.cost!.amountMinor} (unid. menores) ${p.cost!.currency} · ${p.cost!.itemId}`, actor: adminId })
    const contacts = { owner_id: w.id, admin_id: w.id, billing_id: w.id, tech_id: w.id }
    let r
    try {
      r = await h.client.purchase({ domain: p.domain, item_id: p.cost!.itemId, payment_method_id: p.paymentMethod!.id, domain_contacts: contacts })
    } catch (e) {
      const timeout = e instanceof RegistrarTimeout
      await setOp(op.id, { status: 'unknown', provider_status: 'no_response', message: timeout ? 'Compra sem resposta (timeout): consultar o portefólio antes de qualquer nova tentativa.' : 'Ligação perdida durante a compra: consultar o portefólio.' })
      await event(op.id, 'purchase_response', { outcome: 'unknown', message: (e as Error).message, actor: adminId })
      return { ok: false, outcome: 'unknown', message: 'Sem resposta conclusiva da Hostinger. Use «Consultar estado na Hostinger»: nenhuma nova compra é feita antes dessa consulta.' }
    }
    const order = (r.json as any)?.data ?? r.json ?? {}
    const orderId = order?.id != null ? String(order.id) : null
    if (r.status === 202) {
      await setOp(op.id, { provider_order_id: orderId, provider_status: 'payment_pending', message: 'Pagamento à Hostinger em processamento (HTTP 202): o domínio ainda não está registado.' })
      await event(op.id, 'purchase_response', { http: 202, outcome: 'payment_pending', message: `encomenda ${orderId ?? '?'}`, actor: adminId })
      return { ok: true, outcome: 'payment_pending', message: 'A Hostinger está a processar o pagamento (HTTP 202). O domínio ainda não está registado: use «Consultar estado na Hostinger» mais tarde.' }
    }
    if (r.status >= 200 && r.status < 300) {
      await setOp(op.id, { provider_order_id: orderId, provider_status: String(order?.status ?? 'ordered').slice(0, 64), message: 'Encomenda criada na Hostinger; a confirmar o registo.' })
      await event(op.id, 'purchase_response', { http: r.status, outcome: 'ordered', message: `encomenda ${orderId ?? '?'} ${order?.status ?? ''}`, actor: adminId })
      return await reconcileLocked(s, op.id, h.client, adminId)
    }
    const err = h.client.errorOf(r)
    if (r.status >= 500 || r.status === 0 || r.status === 409) {
      await setOp(op.id, { status: 'unknown', provider_status: `http_${r.status}`, message: `Resposta ambígua (HTTP ${r.status}): consultar o portefólio.` })
      await event(op.id, 'purchase_response', { http: r.status, outcome: 'unknown', message: err.message, actor: adminId })
      return { ok: false, outcome: 'unknown', message: `Resposta ambígua da Hostinger (HTTP ${r.status}). Use «Consultar estado na Hostinger» antes de qualquer nova tentativa.` }
    }
    // 401/422/…: recusado — nada comprado; pode voltar a tentar depois de corrigir
    await setOp(op.id, { status: 'failed', provider_status: `http_${r.status}`, message: `Recusado pela Hostinger: ${clean(err.message)}` })
    await event(op.id, 'purchase_response', { http: r.status, outcome: 'failed', message: err.message, actor: adminId })
    return { ok: false, outcome: 'failed', message: `A Hostinger recusou o pedido (HTTP ${r.status}): ${clean(err.message)}. Nada foi comprado.`, errors: err.errors ?? undefined }
  } finally { await unlock(op.id) }
}

async function reconcileLocked(s: any, opId: string, client: HostingerClient, actor: string | null): Promise<ActionResult> {
  const [[op]] = await getPool().query('SELECT * FROM registrar_operations WHERE id = ?', [opId]) as any
  let details: DomainDetails | null
  let entry: PortfolioDomain | undefined
  try {
    details = await client.domain(s.domain)
    if (isRegistered(details)) {
      await activateRegistered(s, opId, op.provider_order_id ?? s.domain, client, actor)
      return { ok: true, outcome: 'registered', message: 'Registo confirmado pela Hostinger.' }
    }
    entry = (await client.portfolio()).find(d => (d.domain ?? '').toLowerCase() === s.domain)
  } catch (e) {
    await event(opId, 'reconcile', { outcome: 'unknown', message: (e as Error).message, actor })
    return { ok: false, outcome: 'manual', message: e instanceof RegistrarTimeout ? 'A Hostinger não respondeu à consulta: nenhuma nova compra. Tente consultar mais tarde ou verifique no hPanel.' : `Consulta falhou: ${clean((e as Error).message)}. Nenhuma nova compra.` }
  }
  if (entry) {
    const ver = entry.verification?.type ?? null
    if (ver) {
      await setOp(opId, { status: 'submitted', provider_status: `verification_${ver}`.slice(0, 64), message: VERIFY_MSG[ver] ?? `A aguardar verificação «${ver}».` })
      await event(opId, 'reconcile', { outcome: 'verification', message: ver, actor })
      return { ok: true, outcome: 'verification', message: VERIFY_MSG[ver] ?? `A aguardar verificação «${ver}» no hPanel.` }
    }
    // Pago e na conta, mas sem registo: aguarda configuração → «Concluir registo» (sem nova compra)
    await setOp(opId, { status: 'submitted', provider_status: 'awaiting_setup', message: 'Domínio pago na conta Hostinger a aguardar configuração: use «Concluir registo (sem nova compra)».' })
    await event(opId, 'reconcile', { outcome: 'awaiting_setup', message: entry.status ?? '', actor })
    return { ok: true, outcome: 'awaiting_setup', message: 'O domínio está pago na conta Hostinger mas ainda não registado. Use «Concluir registo (sem nova compra)».' }
  }
  if (op.provider_status === 'payment_pending' || op.provider_status === 'setup_requested') {
    await event(opId, 'reconcile', { outcome: 'pending', message: op.provider_status, actor })
    return { ok: true, outcome: 'pending', message: op.provider_status === 'setup_requested' ? 'Pedido de conclusão aceite; a aguardar o registo na Hostinger.' : 'Pagamento à Hostinger ainda em processamento: o domínio não aparece na conta. Consulte mais tarde.' }
  }
  if (op.status === 'unknown' || op.provider_status === 'requested' || /^http_/.test(op.provider_status ?? '') || op.provider_status === 'no_response') {
    await setOp(opId, { status: 'unknown', message: 'Inconclusivo: o domínio não aparece na conta Hostinger. Revisão manual no hPanel antes de qualquer nova compra.' })
    await event(opId, 'reconcile', { outcome: 'manual', message: 'domínio ausente do portefólio', actor })
    return { ok: false, outcome: 'manual', message: 'Inconclusivo: o domínio não aparece na conta Hostinger. Verifique as encomendas no hPanel. Se não houve compra, use «Libertar nova tentativa»; se houve, aguarde ou use «Marcar como registado…» com a referência.' }
  }
  await event(opId, 'reconcile', { outcome: 'pending', message: op.provider_status ?? '', actor })
  return { ok: true, outcome: 'pending', message: 'A aguardar o registo na Hostinger. Consulte mais tarde.' }
}

/** Consulta o estado (portefólio/detalhe). Nunca compra. Também associa um domínio já registado na conta. */
export async function reconcile(serviceId: string, adminId: string | null): Promise<ActionResult> {
  const s = await loadService(serviceId)
  if (s.payment_status !== 'paid') throw new FlowError('Pagamento do cliente por validar.', 409)
  const h = await hostingerForDomain(s.domain)
  if ('error' in h) throw new FlowError(h.error, 409)
  const op = await ensureOperation(s, h.mode)
  if (op.status === 'succeeded') return { ok: true, outcome: 'registered', message: 'Já confirmado pela Hostinger.' }
  await lock(op.id)
  try { return await reconcileLocked(s, op.id, h.client, adminId) } finally { await unlock(op.id) }
}

/** Domínio já pago a aguardar configuração: conclui o registo (POST …/setup), sem nova compra. */
export async function completeSetup(serviceId: string, adminId: string): Promise<ActionResult> {
  const s = await loadService(serviceId)
  if (s.payment_status !== 'paid') throw new FlowError('Pagamento do cliente por validar.', 409)
  const h = await hostingerForDomain(s.domain)
  if ('error' in h) throw new FlowError(h.error, 409)
  const op = await ensureOperation(s, h.mode)
  await lock(op.id)
  try {
    const entry = (await h.client.portfolio()).find(d => (d.domain ?? '').toLowerCase() === s.domain)
    if (!entry) return { ok: false, outcome: 'not_awaiting', message: 'O domínio não está na conta Hostinger a aguardar configuração: nada a concluir.' }
    if (isRegistered(await h.client.domain(s.domain))) return await reconcileLocked(s, op.id, h.client, adminId)
    const owner = await loadOwner(s.profile_id)
    const miss = ownerMissing(owner)
    if (miss.length) return { ok: false, outcome: 'needs_correction', message: `Faltam dados do titular: ${miss.map(f => OWNER_LABEL[f]).join(', ')}.` }
    const w = await ensureWhois(h.client, s.profile_id, h.extension, owner)
    if ('errors' in w) return { ok: false, outcome: 'needs_correction', message: `${w.message} Corrija os campos indicados.`, errors: w.errors }
    const contacts = { owner_id: w.id, admin_id: w.id, billing_id: w.id, tech_id: w.id }
    await getPool().query("UPDATE registrar_operations SET status = 'submitted', authorized_by = ?, authorized_at = CURRENT_TIMESTAMP(6) WHERE id = ?", [adminId, op.id])
    const r = await h.client.setup(s.domain, { domain_contacts: contacts })
    if (r.status >= 200 && r.status < 300) {
      await setOp(op.id, { provider_status: 'setup_requested', message: 'Conclusão do registo pedida (sem nova compra).' })
      await event(op.id, 'setup', { http: r.status, outcome: 'setup_requested', actor: adminId })
      return await reconcileLocked(s, op.id, h.client, adminId)
    }
    const err = h.client.errorOf(r)
    await event(op.id, 'setup', { http: r.status, outcome: 'failed', message: err.message, actor: adminId })
    if (r.status === 404) return { ok: false, outcome: 'not_awaiting', message: 'A Hostinger indica que o domínio não está a aguardar configuração (404). Verifique no hPanel.' }
    if (r.status === 422) return { ok: false, outcome: 'needs_correction', message: `A Hostinger recusou os dados (422): ${clean(err.message)}`, errors: err.errors ?? undefined }
    return { ok: false, outcome: 'manual', message: `Não foi possível concluir pela API (HTTP ${r.status}). Conclua no hPanel: Domínios → ${s.domain} → concluir registo.` }
  } catch (e) {
    await event(op.id, 'setup', { outcome: 'unknown', message: (e as Error).message, actor: adminId })
    return { ok: false, outcome: 'manual', message: e instanceof RegistrarTimeout ? 'Sem resposta da Hostinger: consulte o estado antes de repetir.' : `Falha: ${clean((e as Error).message)}` }
  } finally { await unlock(op.id) }
}

/** Domínio já registado na conta (ex.: encomenda antiga registada no hPanel): associa sem comprar. */
export async function linkRegistered(serviceId: string, adminId: string): Promise<ActionResult> {
  return reconcile(serviceId, adminId)
}

export async function applyNameservers(serviceId: string, adminId: string): Promise<ActionResult> {
  const s = await loadService(serviceId)
  const h = await hostingerForDomain(s.domain)
  if ('error' in h) throw new FlowError(h.error, 409)
  const op = await getOperation(serviceId)
  if (op?.status !== 'succeeded') throw new FlowError('O domínio ainda não está registado: os nameservers aplicam-se depois do registo.', 409)
  await lock(op.id)
  try {
    const ok = await applyNameserversInternal(s, op.id, h.client, adminId)
    const [[o]] = await getPool().query('SELECT ns_message FROM registrar_operations WHERE id = ?', [op.id]) as any
    return { ok, outcome: ok ? 'applied' : 'failed', message: o?.ns_message ?? '' }
  } finally { await unlock(op.id) }
}

/** Revisão manual concluída no hPanel: confirma que NÃO houve compra e liberta nova tentativa. */
export async function releaseAfterReview(serviceId: string, note: string, adminId: string): Promise<ActionResult> {
  if (note.trim().length < 5) throw new FlowError('Descreva o que verificou no hPanel (ex.: «sem encomenda para o domínio»).')
  const s = await loadService(serviceId)
  const h = await hostingerForDomain(s.domain)
  if ('error' in h) throw new FlowError(h.error, 409)
  const op = await getOperation(serviceId)
  const otherPending = op && op.provider !== 'hostinger' && ['submitted', 'unknown'].includes(op.status)
  if (!op || (op.status !== 'unknown' && !otherPending)) throw new FlowError('Só uma operação inconclusiva (ou pendente noutro fornecedor) pode ser libertada.', 409)
  await lock(op.id)
  try {
    // Última verificação: se entretanto aparecer na conta, não liberta
    const entry = (await h.client.portfolio()).find(d => (d.domain ?? '').toLowerCase() === s.domain)
    if (entry || isRegistered(await h.client.domain(s.domain))) return { ok: false, outcome: 'found', message: 'O domínio aparece agora na conta Hostinger: não é necessária nova compra. Consulte o estado.' }
    await setOp(op.id, { status: 'failed', provider_status: 'released', message: `Libertado após revisão: ${clean(note)}` })
    await event(op.id, 'release', { outcome: 'released', message: note, actor: adminId })
    return { ok: true, outcome: 'released', message: 'Nova tentativa permitida.' }
  } finally { await unlock(op.id) }
}

/** Delegação pública: os nameservers do domínio já respondem com os da encomenda? */
export async function checkDns(serviceId: string): Promise<{ status: 'pending' | 'confirmed'; found: string[] }> {
  const s = await loadService(serviceId)
  const op = await getOperation(serviceId)
  const { ns } = await nameserversFor(s)
  let found: string[] = []
  try {
    const res = new Resolver({ timeout: 4000, tries: 1 })
    found = (await res.resolveNs(s.domain)).map(x => x.toLowerCase().replace(/\.$/, ''))
  } catch { found = [] }
  const want = ns.map(x => x.toLowerCase())
  const status = found.length > 0 && want.every(x => found.includes(x)) ? 'confirmed' : 'pending'
  if (op) await getPool().query('UPDATE registrar_operations SET dns_status = ?, dns_checked_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [status, op.id])
  return { status, found }
}

/** Resumo para a lista de encomendas (sem chamadas ao fornecedor). */
export async function operationsByService(serviceIds: string[]) {
  if (!serviceIds.length) return {}
  const [rows] = await getPool().query(`SELECT service_id, provider, status, provider_status, provider_order_id, provider_ref, ns_status, ns_message, dns_status, cost_amount, cost_currency, attempts, message
    FROM registrar_operations WHERE operation = 'register' AND service_id IN (${serviceIds.map(() => '?').join(',')})`, serviceIds) as any
  return Object.fromEntries((rows as any[]).map(r => [r.service_id, r]))
}
