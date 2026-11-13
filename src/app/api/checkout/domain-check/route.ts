import { NextRequest, NextResponse } from 'next/server'

// Domain availability via RDAP.
//
// The RDAP server for each TLD comes from the official IANA bootstrap file
// (https://data.iana.org/rdap/dns.json). A registry answers 404 when the
// domain is not registered and 200 when it is.
//
// Some ccTLDs (e.g. .ao) publish no RDAP service. For those — and whenever the
// lookup fails — we answer `verified: false` instead of guessing: the UI shows
// the domain as "a confirmar" and the team checks it manually after the order.
// `available` stays true in that case so the customer can still order it.

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json'
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000

let bootstrapCache: { map: Map<string, string>; fetchedAt: number } | null = null

async function loadBootstrap(): Promise<Map<string, string> | null> {
  if (bootstrapCache && Date.now() - bootstrapCache.fetchedAt < BOOTSTRAP_TTL_MS) {
    return bootstrapCache.map
  }
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

/** Finds the RDAP base URL for the longest matching suffix (e.g. "com.br" before "br"). */
function rdapBaseFor(domain: string, map: Map<string, string>): string | null {
  const labels = domain.split('.')
  for (let i = 1; i < labels.length; i++) {
    const base = map.get(labels.slice(i).join('.'))
    if (base) return base
  }
  return null
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase().trim()

  if (!domain || !/^[a-z0-9][a-z0-9\-]*(\.[a-z0-9\-]+)+$/.test(domain)) {
    return NextResponse.json({ available: false, error: 'Formato inválido' }, { status: 400 })
  }

  const unverified = (note: string) =>
    NextResponse.json({ domain, available: true, verified: false, note })

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
    if (res.status === 404) return NextResponse.json({ domain, available: true, verified: true })
    if (res.ok) return NextResponse.json({ domain, available: false, verified: true })
    return unverified(`rdap_status_${res.status}`)
  } catch {
    return unverified('lookup_timeout')
  }
}
