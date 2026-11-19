import { NextResponse } from 'next/server'
import { siteUrl } from '@/lib/auth/server'

// Antigo callback PKCE do Supabase (?code=...). Os links novos usam /api/auth/verify;
// links com token_hash/type são reencaminhados para lá. Links antigos do Supabase
// (enviados antes da troca) deixam de ser válidos → página de login com erro.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const base = siteUrl()
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  if (tokenHash && type) {
    return NextResponse.redirect(`${base}/api/auth/verify?type=${encodeURIComponent(type)}&token_hash=${encodeURIComponent(tokenHash)}`)
  }
  return NextResponse.redirect(`${base}/login?error=auth_callback_failed`)
}
