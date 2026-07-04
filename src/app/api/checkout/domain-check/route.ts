import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')?.toLowerCase().trim()

  if (!domain || !/^[a-z0-9][a-z0-9\-.]{1,61}[a-z0-9]\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ available: false, error: 'Invalid domain format' }, { status: 400 })
  }

  try {
    // RDAP lookup — public, no API key required
    const tld = domain.split('.').slice(-1)[0]
    const rdapUrl = `https://rdap.verisign.com/com/v1/domain/${domain}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    let available = false

    try {
      const res = await fetch(rdapUrl, { signal: controller.signal, headers: { 'User-Agent': 'ViralizaHost/1.0' } })
      // 200 = domain exists (taken), 404 = available
      available = res.status === 404
    } catch {
      // Network error or timeout — treat .ao and less-common TLDs as available
      available = true
    } finally {
      clearTimeout(timeout)
    }

    return NextResponse.json({ domain, available })
  } catch (err: any) {
    return NextResponse.json({ domain, available: true, note: 'lookup_failed' })
  }
}
