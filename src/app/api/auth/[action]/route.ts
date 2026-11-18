/* eslint-disable @typescript-eslint/no-explicit-any -- camada de compatibilidade com dados dinâmicos (linhas PostgREST) */
import { NextRequest, NextResponse } from 'next/server'
import { authApi, type CookieJar } from '@/lib/auth/server'

/**
 * Endpoints de autenticação usados pelo cliente do browser (src/lib/supabase/client.ts):
 *   GET  /api/auth/user | /api/auth/session | /api/auth/confirm?token=...
 *   POST /api/auth/login | signup | logout | update | recover | verify
 */
function jarFor(req: NextRequest, res: { cookies: NextResponse['cookies'] }): CookieJar {
  return {
    get: (n) => req.cookies.get(n),
    set: (n, v, o) => { res.cookies.set(n, v, o as any) },
  }
}

const ipOf = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  const out = NextResponse.json({})
  const api = authApi(jarFor(req, out), ipOf(req))
  const reply = (body: unknown, status = 200) => {
    const r = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
    out.cookies.getAll().forEach((c) => r.cookies.set(c))
    return r
  }
  if (action === 'user') return reply(await api.getUser())
  if (action === 'session') return reply(await api.getSession())
  if (action === 'confirm') {
    const token = req.nextUrl.searchParams.get('token') ?? ''
    const res = await api.verifyConfirmation(token)
    const site = req.nextUrl.origin
    const r = NextResponse.redirect(res.error ? `${site}/login?error=link_invalido` : `${site}/dashboard`)
    out.cookies.getAll().forEach((c) => r.cookies.set(c))
    return r
  }
  return reply({ error: { message: 'Not found' } }, 404)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  const out = NextResponse.json({})
  const api = authApi(jarFor(req, out), ipOf(req))
  const body = await req.json().catch(() => ({}))
  let result: unknown
  switch (action) {
    case 'login': result = await api.signInWithPassword({ email: String(body.email ?? ''), password: String(body.password ?? '') }); break
    case 'signup': result = await api.signUp({ email: String(body.email ?? ''), password: String(body.password ?? ''), options: { data: body.options?.data } }); break
    case 'logout': result = await api.signOut(); break
    case 'update': result = await api.updateUser({ password: body.password, email: body.email, data: body.data }); break
    case 'recover': result = await api.resetPasswordForEmail(String(body.email ?? ''), { redirectTo: body.redirectTo }); break
    case 'verify': result = await api.verifyRecovery(String(body.token ?? '')); break
    default: return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 })
  }
  const r = NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  out.cookies.getAll().forEach((c) => r.cookies.set(c))
  return r
}
