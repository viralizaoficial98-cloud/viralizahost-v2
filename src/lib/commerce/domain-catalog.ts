import 'server-only'
import { getPool } from '@/lib/db/pool'
import { checkAvailability, normalizeDomain, splitDomain, type AvailabilityStatus } from './domains'
import { MAX_DOMAIN_YEARS, EPP_OPTIONAL } from './quote'

// Extensões vendidas e pesquisa de domínios. Preços SEMPRE de domain_prices (mesma fonte
// do painel, do carrinho e do checkout).

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Extension {
  extension: string
  status: 'active' | 'on_request'
  register: number | null
  renew: number | null
  transfer: number | null
  eppRequired: boolean
  national: boolean
  maxYears: number
}

/** Ordem de apresentação: nacionais primeiro, depois as mais procuradas. */
const PRIORITY = ['.ao', '.co.ao', '.com', '.net', '.org', '.it.ao', '.org.ao', '.edu.ao', '.online', '.shop', '.store', '.xyz', '.io', '.tech', '.ai']

export async function listExtensions(): Promise<Extension[]> {
  const [rows] = await getPool().query("SELECT extension, operation, price, status FROM domain_prices WHERE years = 1 AND status IN ('active','on_request')") as any
  const map = new Map<string, Extension>()
  for (const r of rows as any[]) {
    const e = map.get(r.extension) ?? { extension: r.extension, status: 'on_request', register: null, renew: null, transfer: null, eppRequired: !EPP_OPTIONAL.some(x => r.extension.endsWith(x)), national: r.extension.endsWith('.ao'), maxYears: 1 }
    const price = r.status === 'active' && r.price != null ? Number(r.price) : null
    if (r.operation === 'register' || r.operation === 'renew' || r.operation === 'transfer') e[r.operation as 'register'] = price
    if (r.operation === 'register' && r.status === 'active') e.status = 'active'
    map.set(r.extension, e)
  }
  for (const e of map.values()) e.maxYears = e.register != null && e.renew != null ? MAX_DOMAIN_YEARS : 1
  const rank = (x: string) => { const i = PRIORITY.indexOf(x); return i < 0 ? 99 : i }
  return [...map.values()].sort((a, b) => rank(a.extension) - rank(b.extension) || a.extension.localeCompare(b.extension))
}

export interface SearchResult extends Extension {
  domain: string
  /** available | unavailable | confirm (equipa) | on_request (extensão sem preço público) */
  availability: AvailabilityStatus | 'on_request'
}

/**
 * Pesquisa: nome exacto (com a extensão pedida, ou .ao por omissão) + alternativas nas
 * extensões vendidas. Cada resultado traz o estado de disponibilidade e os preços.
 */
export async function searchDomains(query: string, maxAlternatives = 6): Promise<{ exact: SearchResult; alternatives: SearchResult[] } | null> {
  const exts = await listExtensions()
  const q = String(query ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  let name: string, ext: string
  const full = normalizeDomain(q)
  const parts = full ? splitDomain(full, exts.map(e => e.extension)) : null
  if (parts) { name = parts.name; ext = parts.extension }
  else if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(q)) { name = q; ext = exts.find(e => e.status === 'active')?.extension ?? '.ao' }
  else return null
  const exact = exts.find(e => e.extension === ext)
  if (!exact) return null
  const alts = exts.filter(e => e.extension !== ext && e.status === 'active').slice(0, maxAlternatives)
  const check = async (e: Extension): Promise<SearchResult> => {
    const domain = `${name}${e.extension}`
    if (e.status !== 'active') return { ...e, domain, availability: 'on_request' }
    const a = await checkAvailability(domain)
    return { ...e, domain, availability: a.status }
  }
  const [x, ...rest] = await Promise.all([check(exact), ...alts.map(check)])
  return { exact: x, alternatives: rest }
}

export interface HostingOption { slug: string; name: string; category: string; prices: { cycle: string; months: number; price: number; renewal: number }[] }

/** Planos de alojamento que se podem juntar a um domínio na configuração (opcional). */
export async function hostingOptions(): Promise<HostingOption[]> {
  const [rows] = await getPool().query(
    `SELECT p.slug, p.name, p.category, pp.cycle, pp.months, pp.price, pp.renewal_price FROM products p
     JOIN product_prices pp ON pp.product_id = p.id AND pp.active = 1
     WHERE p.active = 1 AND p.sale_status = 'active' AND p.service_type = 'hosting' AND p.category IN ('hosting','wordpress')
     ORDER BY p.category = 'hosting' DESC, p.position, pp.months`) as any
  const map = new Map<string, HostingOption>()
  for (const r of rows as any[]) {
    const o: HostingOption = map.get(r.slug) ?? { slug: r.slug, name: r.name, category: r.category, prices: [] }
    o.prices.push({ cycle: r.cycle, months: Number(r.months), price: Number(r.price), renewal: Number(r.renewal_price) })
    map.set(r.slug, o)
  }
  return [...map.values()]
}

export interface DomainConfigInfo {
  domain: string
  extension: string
  availability: AvailabilityStatus | 'on_request'
  register: number | null
  renew: number | null
  maxYears: number
  /** Total a pagar agora para cada período disponível (1.º ano + renovações seguintes). */
  periods: { years: number; total: number }[]
}

/** Informação para a página «Configuração do domínio» (preços de domain_prices + disponibilidade). */
export async function domainConfigInfo(raw: string, opts: { checkAvailability?: boolean } = {}): Promise<DomainConfigInfo | null> {
  const domain = normalizeDomain(raw)
  if (!domain) return null
  const exts = await listExtensions()
  const parts = splitDomain(domain, exts.map(e => e.extension))
  const e = parts ? exts.find(x => x.extension === parts.extension) : undefined
  if (!e) return null
  if (e.status !== 'active' || e.register == null) return { domain, extension: e.extension, availability: 'on_request', register: null, renew: null, maxYears: 1, periods: [] }
  const availability = opts.checkAvailability === false ? 'confirm' : (await checkAvailability(domain)).status
  const renew = e.renew ?? e.register
  const periods = Array.from({ length: e.maxYears }, (_, i) => ({ years: i + 1, total: Math.round((e.register! + renew * i) * 100) / 100 }))
  return { domain, extension: e.extension, availability, register: e.register, renew, maxYears: e.maxYears, periods }
}
