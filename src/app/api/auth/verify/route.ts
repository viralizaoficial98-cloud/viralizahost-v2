import { NextResponse } from 'next/server'
import { consumeToken, createSession, safeRedirect, setSessionCookie, siteUrl } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

// Links enviados por e-mail (recuperação de senha e confirmação de conta).
// Consome o token, inicia sessão e redirecciona — como o /auth/v1/verify do Supabase.
export async function GET(req: Request) {
  const url = new URL(req.url)
  // Atrás do proxy do cPanel, req.url pode ter o host interno; usar o domínio público.
  const base = new URL(siteUrl())
  const type = url.searchParams.get('type')
  const token = url.searchParams.get('token_hash')
  if (!token || (type !== 'recovery' && type !== 'signup' && type !== 'invite')) {
    return NextResponse.redirect(new URL('/login?error=auth_callback_failed', base))
  }
  const t = await consumeToken(token, type)
  if (!t) {
    const dest = type === 'recovery' ? '/reset-password?error=expired' : '/login?error=auth_callback_failed'
    return NextResponse.redirect(new URL(dest, base))
  }
  const s = await createSession(t.userId)
  await setSessionCookie(s.token, s.expiresAt)
  const fallback = type === 'recovery' ? '/reset-password' : '/dashboard'
  const dest = safeRedirect(t.redirectTo, fallback)
  const target = new URL(dest, base)
  if (type === 'recovery') target.searchParams.set('type', 'recovery')
  return NextResponse.redirect(target)
}
