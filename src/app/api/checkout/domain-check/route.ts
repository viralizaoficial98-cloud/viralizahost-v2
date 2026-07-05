import { NextRequest, NextResponse } from 'next/server'

// RDAP bootstrap — map TLD suffix to the right RDAP base URL
function rdapUrl(domain: string): string {
  const lower = domain.toLowerCase()
  if (lower.endsWith('.com') || lower.endsWith('.net'))
    return `https://rdap.verisign.com/com/v1/domain/${domain}`
  if (lower.endsWith('.org'))
    return `https://rdap.publicinterestregistry.org/rdap/domain/${domain}`
  if (lower.endsWith('.io'))
    return `https://rdap.iana.org/domain/${domain}`
  // .ao, .com.br and other ccTLDs — use IANA bootstrap (may 404 if not in registry)
  return `https://rdap.iana.org/domain/${domain}`
}

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase().trim()

  if (!domain || !/^[a-z0-9][a-z0-9\-]*(\.[a-z0-9\-]+)+$/.test(domain)) {
    return NextResponse.json({ available: false, error: 'Formato inválido' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(rdapUrl(domain), {
      signal: controller.signal,
      headers: { 'User-Agent': 'ViralizaHost/1.0', Accept: 'application/rdap+json' },
    })
    clearTimeout(timeout)
    // 200 = domain found (taken), 404 = available
    const available = res.status === 404
    return NextResponse.json({ domain, available })
  } catch {
    clearTimeout(timeout)
    // Timeout or network error — for .ao and ccTLDs we cannot reliably check;
    // return available=true with a flag so the UI can show a note.
    return NextResponse.json({ domain, available: true, note: 'lookup_timeout' })
  }
}
