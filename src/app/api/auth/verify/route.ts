import { NextResponse } from 'next/server'
import { consumeToken, createSession, safeRedirect, setSessionCookie, siteUrl } from '@/lib/auth/server'
import { linkState } from '@/lib/auth/verification'

export const dynamic = 'force-dynamic'

// Links enviados por e-mail (recuperação de senha e confirmação de conta).
// Consome o token (uma única vez), inicia sessão e redirecciona — como o /auth/v1/verify do Supabase.
// Link de confirmação inválido, expirado ou já usado → /verificar-email com o motivo e reenvio.
export async function GET(req: Request) {
  const url = new URL(req.url)
  // Atrás do proxy do cPanel, req.url pode ter o host interno; usar o domínio público.
  const base = new URL(siteUrl())
  const type = url.searchParams.get('type')
  const token = url.searchParams.get('token_hash')
  if (!token || (type !== 'recovery' && type !== 'signup' && type !== 'invite')) {
    return NextResponse.redirect(new URL(type === 'signup' ? '/verificar-email?estado=invalido' : '/login?error=auth_callback_failed', base))
  }
  const t = await consumeToken(token, type)
  if (!t) {
    if (type === 'recovery') return NextResponse.redirect(new URL('/reset-password?error=expired', base))
    const s = await linkState(token, type)
    const estado = s.state === 'used' && s.confirmed ? 'ja-confirmado' : s.state === 'used' ? 'utilizado' : s.state === 'expired' ? (s.confirmed ? 'ja-confirmado' : 'expirado') : 'invalido'
    return NextResponse.redirect(new URL(`/verificar-email?estado=${estado}`, base))
  }
  const s = await createSession(t.userId)
  await setSessionCookie(s.token, s.expiresAt)
  const fallback = type === 'recovery' ? '/reset-password' : '/dashboard'
  const dest = safeRedirect(t.redirectTo, fallback)
  const target = new URL(dest, base)
  if (type === 'recovery') target.searchParams.set('type', 'recovery')
  if (type === 'signup') target.searchParams.set('verificado', '1')
  return NextResponse.redirect(target)
}
