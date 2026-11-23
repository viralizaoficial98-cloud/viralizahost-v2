import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { checkAvailability, normalizeDomain, splitDomain, type Availability } from './domains'
import { validateNameservers } from './nameservers'
import { getDefaultNameservers } from './nameserver-settings'

// Cotação calculada SEMPRE no servidor a partir da base (product_prices / domain_prices).
// O cliente só envia escolhas (produto, ciclo, quantidade, domínio, operação).

export const CYCLES = ['monthly', '3months', '6months', '1year', '2years', '3years'] as const
export type Cycle = (typeof CYCLES)[number]
export const CYCLE_LABEL: Record<Cycle, string> = { monthly: 'Mensal', '3months': 'Trimestral', '6months': '6 meses', '1year': '1 ano', '2years': '2 anos', '3years': '3 anos' }

export type DomainMode = 'register' | 'transfer' | 'existing'
export type CartLineInput =
  | { type: 'product'; slug: string; cycle: Cycle; quantity?: number; domain?: string; domainMode?: DomainMode }
  | { type: 'domain'; domain: string; operation: 'register' | 'transfer' | 'renew'; years?: number; eppCode?: string; nameservers?: { useDefault?: boolean; ns?: string[] } }
  | { type: 'renewal'; serviceId: string }

export interface QuoteLine {
  index: number
  type: 'product' | 'domain' | 'renewal'
  renewsServiceId?: string
  slug?: string
  productId?: string
  name: string
  serviceType: string
  provisioning?: string
  cycle?: Cycle
  months?: number
  quantity: number
  quantityUnit?: string | null
  maxQuantity?: number
  unitPrice: number
  lineTotal: number
  renewalPrice: number
  domain?: string
  domainMode?: DomainMode
  operation?: 'register' | 'transfer' | 'renew'
  extension?: string
  availability?: Availability
  hasEppCode?: boolean
  years?: number
  /** Registo/transferência: nameservers efectivos (os padrão da plataforma ou os próprios do cliente). */
  nameservers?: { useDefault: boolean; ns: string[] }
  cycles?: { cycle: Cycle; months: number; price: number; renewal: number; discount?: number; renewalDiscount?: number }[]
  /** Desconto do período (%) e preço de tabela da linha sem desconto (preço base × meses × quantidade). */
  discountPct?: number
  listTotal?: number | null
  /** Desconto configurado para a renovação (%); 0 = renova ao preço base. */
  renewalDiscountPct?: number
  error?: { code: string; message: string }
}

export interface Quote {
  currency: 'AKZ'
  lines: QuoteLine[]
  subtotal: number
  taxRate: number
  taxLabel: string
  tax: number
  total: number
  valid: boolean
  /** Há domínios «A confirmar pela equipa»: o cliente pode pagar já; o registo espera pela confirmação. */
  needsConfirmation: boolean
}

/** Extensões cuja transferência não exige código EPP (registos nacionais de Angola). */
export const EPP_OPTIONAL = ['.ao']
export const MAX_DOMAIN_YEARS = 3
const round2 = (n: number) => Math.round(n * 100) / 100
const rows = async <T = any>(db: Queryable, sql: string, p: unknown[] = []) => (await db.query(sql, p))[0] as T[] // eslint-disable-line @typescript-eslint/no-explicit-any

const MSG: Record<string, string> = {
  product_not_found: 'Produto inexistente ou indisponível.',
  on_request: 'Plano sob consulta: contacte a equipa comercial.',
  draft: 'Plano ainda não disponível para venda.',
  cycle_unavailable: 'Ciclo de facturação indisponível para este plano.',
  quantity_invalid: 'Quantidade inválida.',
  domain_required: 'Indique o domínio a usar com este serviço.',
  domain_invalid: 'Domínio inválido.',
  domain_unavailable: 'O domínio não está disponível para registo.',
  domain_registered_required: 'Para transferir, o domínio tem de estar registado.',
  extension_unavailable: 'Extensão sem preço publicado (sob consulta).',
  epp_required: 'Indique o código de autorização (EPP) para transferir o domínio.',
  domain_not_owned: 'Só pode renovar domínios da sua conta.',
  years_invalid: 'Duração de registo indisponível para esta extensão.',
  domain_line_missing: 'Adicione ao carrinho o registo ou a transferência deste domínio.',
  login_required: 'Inicie sessão para renovar os seus serviços.',
  service_not_owned: 'Serviço inexistente ou de outra conta.',
  service_not_renewable: 'Este serviço não pode ser renovado aqui (sem preço de renovação ou cancelado).',
  renewal_pending: 'Já existe uma renovação por pagar para este serviço — veja as Encomendas.',
  duplicate_line: 'Item repetido no carrinho.',
  nameservers_invalid: 'Nameservers inválidos.',
}
const err = (code: string) => ({ code, message: MSG[code] ?? code })

export async function getTaxSettings(db: Queryable = getPool()) {
  const [s] = await rows(db, 'SELECT tax_rate, tax_label FROM company_billing_settings WHERE active = 1 LIMIT 1').catch(() => [])
  return { rate: Number(s?.tax_rate ?? 0), label: String(s?.tax_label ?? 'IVA') }
}

export async function knownExtensions(db: Queryable = getPool()): Promise<string[]> {
  return (await rows<{ extension: string }>(db, 'SELECT DISTINCT extension FROM domain_prices')).map(r => r.extension)
}

export interface QuoteOptions {
  db?: Queryable
  userId?: string | null
  checkAvailability?: boolean
}

export async function quoteCart(input: CartLineInput[], opts: QuoteOptions = {}): Promise<Quote> {
  const db = opts.db ?? getPool()
  const exts = await knownExtensions(db)
  const lines: QuoteLine[] = []
  let defaultNs: string[] | null = null
  const list = Array.isArray(input) ? input.slice(0, 30) : []

  for (const [index, raw] of list.entries()) {
    if (raw?.type === 'renewal') {
      // Renovação: preço de renovação aceite na compra original (services.renewal_price)
      const base: QuoteLine = { index, type: 'renewal', name: 'Renovação', serviceType: 'other', provisioning: 'renewal', quantity: 1, unitPrice: 0, lineTotal: 0, renewalPrice: 0, renewsServiceId: String(raw.serviceId ?? '') }
      if (!opts.userId) { lines.push({ ...base, error: err('login_required') }); continue }
      if (lines.some(x => x.renewsServiceId === base.renewsServiceId)) { lines.push({ ...base, error: err('duplicate_line') }); continue }
      const [s] = await rows(db, `SELECT s.id, s.service_name, s.service_type, s.domain, s.status, s.renewal_price, s.billing_cycle, s.renews_service_id, s.product_id, oi.months
        FROM services s LEFT JOIN order_items oi ON oi.id = s.order_item_id WHERE s.id = ? AND s.profile_id = ?`, [base.renewsServiceId, opts.userId])
      if (!s) { lines.push({ ...base, error: err('service_not_owned') }); continue }
      Object.assign(base, { name: `Renovação — ${s.service_name}${s.domain ? ` (${s.domain})` : ''}`, serviceType: s.service_type ?? 'other', domain: s.domain ?? undefined, productId: s.product_id ?? undefined })
      const price = Number(s.renewal_price ?? 0)
      if (s.renews_service_id || !(price > 0) || ['cancelled', 'pending', 'pending_provisioning'].includes(s.status) || s.service_type === 'domain') { lines.push({ ...base, error: err('service_not_renewable') }); continue }
      const [pend] = await rows(db, `SELECT r.id FROM services r JOIN orders o ON o.id = r.order_id
        WHERE r.renews_service_id = ? AND o.payment_status IN ('unpaid','proof_submitted','failed') AND o.status = 'pending' LIMIT 1`, [s.id])
      if (pend) { lines.push({ ...base, error: err('renewal_pending') }); continue }
      const cycle = (CYCLES as readonly string[]).includes(s.billing_cycle) ? s.billing_cycle as Cycle : undefined
      Object.assign(base, { cycle, months: Number(s.months ?? 12), unitPrice: price, lineTotal: price, renewalPrice: price })
      lines.push(base)
      continue
    }
    if (raw?.type === 'domain') {
      const domain = normalizeDomain(raw.domain)
      const op = raw.operation
      const base: QuoteLine = { index, type: 'domain', name: `Domínio ${domain ?? raw.domain}`, serviceType: 'domain', provisioning: 'registrar', quantity: 1, unitPrice: 0, lineTotal: 0, renewalPrice: 0, domain: domain ?? undefined, operation: op, months: 12, years: 1, hasEppCode: !!raw.eppCode }
      if (!domain || !['register', 'transfer', 'renew'].includes(op)) { lines.push({ ...base, error: err('domain_invalid') }); continue }
      const parts = splitDomain(domain, exts)
      if (!parts) { lines.push({ ...base, error: err('extension_unavailable') }); continue }
      base.extension = parts.extension
      // Registo/renovação: 1 a MAX_DOMAIN_YEARS anos = preço da operação + renovações publicadas. Transferência: 1 ano.
      const years = op === 'transfer' ? 1 : Number(raw.years ?? 1)
      if (!Number.isInteger(years) || years < 1 || years > MAX_DOMAIN_YEARS) { lines.push({ ...base, error: err('years_invalid') }); continue }
      base.years = years; base.months = 12 * years
      base.name = `${op === 'register' ? 'Registo' : op === 'transfer' ? 'Transferência' : 'Renovação'} de domínio ${domain} (${years} ${years === 1 ? 'ano' : 'anos'})`
      const [p] = await rows(db, 'SELECT price, status FROM domain_prices WHERE extension = ? AND operation = ? AND years = 1', [parts.extension, op])
      const [r] = await rows(db, "SELECT price FROM domain_prices WHERE extension = ? AND operation = 'renew' AND years = 1 AND status = 'active'", [parts.extension])
      if (!p || p.status !== 'active' || p.price == null) { lines.push({ ...base, error: err('extension_unavailable') }); continue }
      if (years > 1 && !r) { lines.push({ ...base, error: err('years_invalid') }); continue }
      const renew = Number(r?.price ?? p.price)
      base.unitPrice = Number(p.price); base.lineTotal = round2(Number(p.price) + renew * (years - 1)); base.renewalPrice = renew
      if (op === 'transfer' && !raw.eppCode && !EPP_OPTIONAL.some(x => parts.extension.endsWith(x))) { lines.push({ ...base, error: err('epp_required') }); continue }
      if (op !== 'renew') {
        const ns = validateNameservers(raw.nameservers, domain)
        if (!ns.ok) { lines.push({ ...base, error: { code: 'nameservers_invalid', message: ns.message } }); continue }
        defaultNs ??= await getDefaultNameservers(db)
        base.nameservers = { useDefault: ns.value.useDefault, ns: ns.value.useDefault ? defaultNs : ns.value.ns }
      }
      if (op === 'renew') {
        const [own] = opts.userId ? await rows(db, 'SELECT id FROM domains WHERE profile_id = ? AND name = ? AND extension = ?', [opts.userId, parts.name, parts.extension]) : []
        if (!own) { lines.push({ ...base, error: err('domain_not_owned') }); continue }
      } else if (opts.checkAvailability !== false) {
        const a = await checkAvailability(domain)
        base.availability = a
        if (op === 'register' && a.status === 'unavailable') { lines.push({ ...base, error: err('domain_unavailable') }); continue }
        if (op === 'transfer' && a.status === 'available') { lines.push({ ...base, error: err('domain_registered_required') }); continue }
      }
      lines.push(base)
      continue
    }

    // Produto
    const slug = String((raw as { slug?: string })?.slug ?? '')
    const cycle = (raw as { cycle?: Cycle })?.cycle as Cycle
    const [prod] = await rows(db, 'SELECT id, slug, name, active, sale_status, service_type, provisioning, quantity_unit, max_quantity, base_monthly_price FROM products WHERE slug = ?', [slug])
    const base: QuoteLine = { index, type: 'product', slug, name: prod?.name ?? slug, serviceType: prod?.service_type ?? 'other', provisioning: prod?.provisioning, quantity: 1, unitPrice: 0, lineTotal: 0, renewalPrice: 0, cycle, quantityUnit: prod?.quantity_unit ?? null, maxQuantity: Number(prod?.max_quantity ?? 1) }
    if (!prod || !prod.active) { lines.push({ ...base, error: err('product_not_found') }); continue }
    base.productId = prod.id
    base.cycles = (await rows(db, 'SELECT cycle, months, price, renewal_price, discount_pct, renewal_discount_pct FROM product_prices WHERE product_id = ? AND active = 1 ORDER BY months', [prod.id]))
      .map(c => ({ cycle: c.cycle, months: Number(c.months), price: Number(c.price), renewal: Number(c.renewal_price), discount: Number(c.discount_pct ?? 0), renewalDiscount: Number(c.renewal_discount_pct ?? 0) }))
    if (prod.sale_status !== 'active') { lines.push({ ...base, error: err(prod.sale_status === 'on_request' ? 'on_request' : 'draft') }); continue }
    const c = base.cycles.find(x => x.cycle === cycle)
    if (!c) { lines.push({ ...base, error: err('cycle_unavailable') }); continue }
    const qty = Number((raw as { quantity?: number }).quantity ?? 1)
    if (!Number.isInteger(qty) || qty < 1 || qty > base.maxQuantity!) { lines.push({ ...base, error: err('quantity_invalid') }); continue }
    Object.assign(base, { months: c.months, quantity: qty, unitPrice: c.price, lineTotal: round2(c.price * qty), renewalPrice: round2(c.renewal * qty),
      discountPct: c.discount ?? 0, renewalDiscountPct: c.renewalDiscount ?? 0,
      listTotal: prod.base_monthly_price != null && (c.discount ?? 0) > 0 ? round2(Number(prod.base_monthly_price) * c.months * qty) : null })
    if (base.serviceType === 'hosting' || base.serviceType === 'email') {
      const d = normalizeDomain((raw as { domain?: string }).domain)
      const mode = (raw as { domainMode?: DomainMode }).domainMode ?? 'existing'
      if (!d) { lines.push({ ...base, error: err('domain_required') }); continue }
      base.domain = d; base.domainMode = mode
    }
    lines.push(base)
  }

  // Serviço com domínio novo/transferido exige a linha de domínio correspondente
  for (const l of lines) {
    if (l.type === 'product' && !l.error && l.domain && (l.domainMode === 'register' || l.domainMode === 'transfer')) {
      const has = lines.some(x => x.type === 'domain' && x.domain === l.domain && x.operation === l.domainMode)
      if (!has) l.error = err('domain_line_missing')
    }
  }

  const tax = await getTaxSettings(db)
  const subtotal = round2(lines.filter(l => !l.error).reduce((a, l) => a + l.lineTotal, 0))
  const taxAmount = round2(subtotal * tax.rate / 100)
  return {
    currency: 'AKZ', lines, subtotal, taxRate: tax.rate, taxLabel: tax.label, tax: taxAmount,
    total: round2(subtotal + taxAmount), valid: lines.length > 0 && lines.every(l => !l.error),
    needsConfirmation: lines.some(l => !l.error && l.type === 'domain' && l.availability?.status === 'confirm'),
  }
}
