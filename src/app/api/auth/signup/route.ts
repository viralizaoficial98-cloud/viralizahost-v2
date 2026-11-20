import { NextResponse } from 'next/server'
import { createSession, createUser, issueToken, setSessionCookie, siteUrl, authError } from '@/lib/auth/server'
import { sendAuthEmail } from '@/lib/auth/email'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Equivalente a supabase.auth.signUp(). Com AUTH_EMAIL_CONFIRMATION != 'false'
// (por omissão), a conta só inicia sessão depois de confirmar o e-mail.
export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: authError('Too many requests. Please try again later.', 429, 'over_request_rate_limit') }, { status: 429 })
  }
  const body = await req.json().catch(() => ({})) as { email?: string; password?: string; options?: { data?: Record<string, unknown> } }
  const meta = { ...(body.options?.data ?? {}) }
  // O papel nunca vem do navegador (no Supabase, raw_user_meta_data.role permitia escolher 'admin').
  meta.role = 'client'
  const confirm = process.env.AUTH_EMAIL_CONFIRMATION !== 'false'
  const r = await createUser({ email: String(body.email ?? ''), password: String(body.password ?? ''), user_metadata: meta, email_confirm: !confirm })
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  if (confirm) {
    const token = await issueToken(r.user.id, 'signup', '/dashboard')
    const sent = await sendAuthEmail('signup', r.user.email, `${siteUrl()}/api/auth/verify?type=signup&token_hash=${encodeURIComponent(token)}`)
    // Como o Supabase: a conta fica criada, mas o erro é devolvido para o formulário não
    // dizer "verifique o e-mail" quando nada foi enviado. "Esqueci a senha" também confirma.
    if (!sent.ok) return NextResponse.json({ error: authError('Error sending confirmation email', 500, 'unexpected_failure') }, { status: 500 })
    return NextResponse.json({ user: r.user, session: null })
  }
  const s = await createSession(r.user.id)
  await setSessionCookie(s.token, s.expiresAt)
  return NextResponse.json({ user: r.user, session: { user: r.user } })
}
