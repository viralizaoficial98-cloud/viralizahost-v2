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
