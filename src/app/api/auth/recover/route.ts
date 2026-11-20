import { NextResponse } from 'next/server'
import { requestPasswordRecovery } from '@/lib/db/server-client'
import { authError } from '@/lib/auth/server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string; redirectTo?: string }
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!rateLimit(`recover:${clientIp(req)}`, 10, 60 * 60_000) || !rateLimit(`recover:${email}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: authError('For security purposes, you can only request this after some time.', 429, 'over_email_send_rate_limit') }, { status: 429 })
  }
  const r = await requestPasswordRecovery(email, body.redirectTo)
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
