import { NextResponse } from 'next/server'
import { createSession, createUser, setSessionCookie, authError } from '@/lib/auth/server'
import { sendVerificationEmail } from '@/lib/auth/verification'
import { emailConfirmationRequired } from '@/lib/auth/account-settings'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Equivalente a supabase.auth.signUp(). Com «Exigir confirmação de e-mail para novos clientes» activa
// (Configurações → Contas; valor inicial: AUTH_EMAIL_CONFIRMATION != 'false'), a conta só inicia sessão depois de
// confirmar o e-mail. Desactivada: não se envia e-mail, o endereço fica por verificar e a sessão começa já.
// Se o envio falhar, a conta fica criada e por verificar: a resposta indica email_sent=false
// para o formulário oferecer «Reenviar e-mail de verificação» (antes devolvia 500 e o
// utilizador ficava sem forma de receber o link).
export async function POST(req: Request) {
  // SIGNUP_RATE_LIMIT só no servidor de ensaio (muitos registos de teste); produção: 10 por IP/hora
  if (!rateLimit(`signup:${clientIp(req)}`, Number(process.env.SIGNUP_RATE_LIMIT) || 10, 60 * 60_000)) {
    return NextResponse.json({ error: authError('Too many requests. Please try again later.', 429, 'over_request_rate_limit') }, { status: 429 })
  }
  const body = await req.json().catch(() => ({})) as { email?: string; password?: string; options?: { data?: Record<string, unknown> } }
  const meta = { ...(body.options?.data ?? {}) }
  // O papel nunca vem do navegador (no Supabase, raw_user_meta_data.role permitia escolher 'admin').
  meta.role = 'client'
  const confirm = await emailConfirmationRequired()
  const r = await createUser({ email: String(body.email ?? ''), password: String(body.password ?? ''), user_metadata: meta, email_confirm: false, email_verification_exempt: !confirm })
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  if (confirm) {
    const sent = await sendVerificationEmail(r.user.id, r.user.email)
    return NextResponse.json({ user: r.user, session: null, email_sent: sent.ok })
  }
  const s = await createSession(r.user.id)
  await setSessionCookie(s.token, s.expiresAt)
  return NextResponse.json({ user: r.user, session: { user: r.user } })
}
