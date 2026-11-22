import { NextResponse } from 'next/server'
import { createSession, setSessionCookie, signInWithPassword, authError } from '@/lib/auth/server'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { email?: string; password?: string }
  const email = String(body.email ?? '').trim().toLowerCase()
  // LOGIN_RATE_LIMIT só para o servidor de ensaio (muitos logins da mesma conta de teste); produção usa 10/30
  const perEmail = Number(process.env.LOGIN_RATE_LIMIT) || 10
  if (!rateLimit(`login:${clientIp(req)}`, Math.max(30, perEmail * 3), 15 * 60_000) || !rateLimit(`login:${email}`, perEmail, 15 * 60_000)) {
    return NextResponse.json({ error: authError('Too many requests. Please try again later.', 429, 'over_request_rate_limit') }, { status: 429 })
  }
  const r = await signInWithPassword(email, String(body.password ?? ''))
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  const s = await createSession(r.user.id)
  await setSessionCookie(s.token, s.expiresAt)
  return NextResponse.json({ user: r.user })
}
