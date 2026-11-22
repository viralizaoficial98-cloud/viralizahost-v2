import 'server-only'
import { registrarAvailability } from '@/lib/registrar/operations'

// Disponibilidade de domínios via RDAP (bootstrap oficial da IANA).
// Três estados:
//   available   — o registo respondeu 404 (não existe)          → pode ser comprado
//   unavailable — o registo devolveu o objecto do domínio        → não pode ser registado
//   confirm     — extensão sem RDAP (ex.: .ao), timeout ou erro  → «A confirmar pela equipa»
// Se a extensão estiver automatizada no registrador (Integrações → Registrador), consulta-o primeiro.
// Uma falha, um timeout ou a falta de integração NUNCA contam como disponível.
// RDAP_BOOTSTRAP_URL permite apontar para outro bootstrap (ex.: RDAP simulado no ensaio).

const BOOTSTRAP_URL = process.env.RDAP_BOOTSTRAP_URL || 'https://data.iana.org/rdap/dns.json'
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000
let bootstrapCache: { map: Map<string, string>; fetchedAt: number } | null = null

export const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

async function loadBootstrap(): Promise<Map<string, string> | null> {
  if (bootstrapCache && Date.now() - bootstrapCache.fetchedAt < BOOTSTRAP_TTL_MS) return bootstrapCache.map
  try {
    const res = await fetch(BOOTSTRAP_URL, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return bootstrapCache?.map ?? null
    const json = (await res.json()) as { services: [string[], string[]][] }
    const map = new Map<string, string>()
    for (const [tlds, urls] of json.services) {
      const base = urls.find(u => u.startsWith('https://')) ?? urls[0]
      if (!base) continue
      for (const tld of tlds) map.set(tld.toLowerCase(), base.endsWith('/') ? base : `${base}/`)
    }
    bootstrapCache = { map, fetchedAt: Date.now() }
    return map
  } catch {
    return bootstrapCache?.map ?? null
  }
}

function rdapBaseFor(domain: string, map: Map<string, string>): string | null {
  const labels = domain.split('.')
  for (let i = 1; i < labels.length; i++) {
    const base = map.get(labels.slice(i).join('.'))
    if (base) return base
  }
  return null
}

export type AvailabilityStatus = 'available' | 'unavailable' | 'confirm'
export interface Availability { domain: string; status: AvailabilityStatus; available: boolean; verified: boolean; note?: string }

export async function checkAvailability(domainRaw: string): Promise<Availability> {
  const domain = normalizeDomain(domainRaw)
  if (!domain) return { domain: String(domainRaw ?? ''), status: 'unavailable', available: false, verified: true, note: 'invalid' }
  const unverified = (note: string): Availability => ({ domain, status: 'confirm', available: false, verified: false, note })
  // Extensões automatizadas no registrador: a resposta do fornecedor tem prioridade sobre o RDAP
  const reg = await registrarAvailability(domain)
  if (reg === 'available') return { domain, status: 'available', available: true, verified: true, note: 'registrar' }
  if (reg === 'unavailable') return { domain, status: 'unavailable', available: false, verified: true, note: 'registrar' }
  if (reg === 'confirm') return unverified('registrar_inconclusive')
  const map = await loadBootstrap()
  if (!map) return unverified('bootstrap_unavailable')
  const base = rdapBaseFor(domain, map)
  if (!base) return unverified('no_rdap_for_tld')
  try {
    const res = await fetch(`${base}domain/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'ViralizaHost/1.0', Accept: 'application/rdap+json' },
      redirect: 'follow',
    })
    if (res.status === 404) return { domain, status: 'available', available: true, verified: true }
    if (res.ok) return { domain, status: 'unavailable', available: false, verified: true }
    return unverified(`rdap_status_${res.status}`)
  } catch {
    return unverified('lookup_timeout')
  }
}

export function normalizeDomain(raw: unknown): string | null {
  const d = String(raw ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  return DOMAIN_RE.test(d) ? d : null
}

/** Separa nome e extensão usando a lista de extensões conhecidas (a mais longa primeiro: .co.ao antes de .ao). */
export function splitDomain(domain: string, knownExtensions: string[]): { name: string; extension: string } | null {
  const exts = [...knownExtensions].sort((a, b) => b.length - a.length)
  for (const ext of exts) {
    if (domain.endsWith(ext) && domain.length > ext.length) {
      const name = domain.slice(0, -ext.length)
      if (!name.includes('.')) return { name, extension: ext }
    }
  }
  return null
}
