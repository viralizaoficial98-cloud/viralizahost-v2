import { NextRequest, NextResponse } from 'next/server'
import { syncWhmAccounts } from '@/lib/whm/sync'

// Protected cron endpoint — requires CRON_SECRET header
// Vercel cron: set Authorization header in vercel.json
// cURL: curl -X POST /api/cron/whm-sync -H "Authorization: Bearer $CRON_SECRET"

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 })
  }

  const auth = req.headers.get('authorization') ?? ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : auth

  if (provided !== cronSecret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const result = await syncWhmAccounts()
    console.log('[cron/whm-sync] completed:', result.total, 'accounts,', result.errors.length, 'errors')
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron/whm-sync] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Allow GET for Vercel cron (which sends GET requests by default)
export async function GET(req: NextRequest) {
  return POST(req)
}
