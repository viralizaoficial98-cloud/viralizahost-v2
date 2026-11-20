import 'server-only'
import { getPool, type Queryable } from '@/lib/db/pool'
import { checkAvailability, normalizeDomain, splitDomain, type Availability } from './domains'

// Cotação calculada SEMPRE no servidor a partir da base (product_prices / domain_prices).
// O cliente só envia escolhas (produto, ciclo, quantidade, domínio, operação).

export const CYCLES = ['monthly', '6months', '1year', '2years', '3years'] as const
export type Cycle = (typeof CYCLES)[number]
export const CYCLE_LABEL: Record<Cycle, string> = { monthly: 'Mensal', '6months': '6 meses', '1year': '1 ano', '2years': '2 anos', '3years': '3 anos' }

export type DomainMode = 'register' | 'transfer' | 'existing'
export type CartLineInput =
  | { type: 'product'; slug: string; cycle: Cycle; quantity?: number; domain?: string; domainMode?: DomainMode }
  | { type: 'domain'; domain: string; operation: 'register' | 'transfer' | 'renew'; years?: number; eppCode?: string }

export interface QuoteLine {
  index: number
  type: 'product' | 'domain'
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
  cycles?: { cycle: Cycle; months: number; price: number; renewal: number }[]
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
}

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
  domain_line_missing: 'Adicione ao carrinho o registo ou a transferência deste domínio.',
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
  const list = Array.isArray(input) ? input.slice(0, 30) : []

  for (const [index, raw] of list.entries()) {
    if (raw?.type === 'domain') {
      const domain = normalizeDomain(raw.domain)
      const op = raw.operation
      const base: QuoteLine = { index, type: 'domain', name: `Domínio ${domain ?? raw.domain}`, serviceType: 'domain', provisioning: 'registrar', quantity: 1, unitPrice: 0, lineTotal: 0, renewalPrice: 0, domain: domain ?? undefined, operation: op, months: 12, hasEppCode: !!raw.eppCode }
      if (!domain || !['register', 'transfer', 'renew'].includes(op)) { lines.push({ ...base, error: err('domain_invalid') }); continue }
      const parts = splitDomain(domain, exts)
      if (!parts) { lines.push({ ...base, error: err('extension_unavailable') }); continue }
      base.extension = parts.extension
      base.name = `${op === 'register' ? 'Registo' : op === 'transfer' ? 'Transferência' : 'Renovação'} de domínio ${domain} (1 ano)`
      const [p] = await rows(db, 'SELECT price, status FROM domain_prices WHERE extension = ? AND operation = ? AND years = 1', [parts.extension, op])
      const [r] = await rows(db, "SELECT price FROM domain_prices WHERE extension = ? AND operation = 'renew' AND years = 1 AND status = 'active'", [parts.extension])
      if (!p || p.status !== 'active' || p.price == null) { lines.push({ ...base, error: err('extension_unavailable') }); continue }
      base.unitPrice = Number(p.price); base.lineTotal = Number(p.price); base.renewalPrice = Number(r?.price ?? p.price)
      if (op === 'transfer' && !raw.eppCode && !parts.extension.endsWith('.ao')) { lines.push({ ...base, error: err('epp_required') }); continue }
      if (op === 'renew') {
        const [own] = opts.userId ? await rows(db, 'SELECT id FROM domains WHERE profile_id = ? AND name = ? AND extension = ?', [opts.userId, parts.name, parts.extension]) : []
        if (!own) { lines.push({ ...base, error: err('domain_not_owned') }); continue }
      } else if (opts.checkAvailability !== false) {
        const a = await checkAvailability(domain)
        base.availability = a
        if (op === 'register' && !a.available) { lines.push({ ...base, error: err('domain_unavailable') }); continue }
        if (op === 'transfer' && a.verified && a.available) { lines.push({ ...base, error: err('domain_registered_required') }); continue }
      }
      lines.push(base)
      continue
    }

    // Produto
    const slug = String((raw as { slug?: string })?.slug ?? '')
    const cycle = (raw as { cycle?: Cycle })?.cycle as Cycle
    const [prod] = await rows(db, 'SELECT id, slug, name, active, sale_status, service_type, provisioning, quantity_unit, max_quantity FROM products WHERE slug = ?', [slug])
    const base: QuoteLine = { index, type: 'product', slug, name: prod?.name ?? slug, serviceType: prod?.service_type ?? 'other', provisioning: prod?.provisioning, quantity: 1, unitPrice: 0, lineTotal: 0, renewalPrice: 0, cycle, quantityUnit: prod?.quantity_unit ?? null, maxQuantity: Number(prod?.max_quantity ?? 1) }
    if (!prod || !prod.active) { lines.push({ ...base, error: err('product_not_found') }); continue }
    base.productId = prod.id
    base.cycles = (await rows(db, 'SELECT cycle, months, price, renewal_price FROM product_prices WHERE product_id = ? AND active = 1 ORDER BY months', [prod.id]))
      .map(c => ({ cycle: c.cycle, months: Number(c.months), price: Number(c.price), renewal: Number(c.renewal_price) }))
    if (prod.sale_status !== 'active') { lines.push({ ...base, error: err(prod.sale_status === 'on_request' ? 'on_request' : 'draft') }); continue }
    const c = base.cycles.find(x => x.cycle === cycle)
    if (!c) { lines.push({ ...base, error: err('cycle_unavailable') }); continue }
    const qty = Number((raw as { quantity?: number }).quantity ?? 1)
    if (!Number.isInteger(qty) || qty < 1 || qty > base.maxQuantity!) { lines.push({ ...base, error: err('quantity_invalid') }); continue }
    Object.assign(base, { months: c.months, quantity: qty, unitPrice: c.price, lineTotal: round2(c.price * qty), renewalPrice: round2(c.renewal * qty) })
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
  }
}
