import { NextResponse } from 'next/server'
import { getSessionUser, updateUser, authError } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: authError('Auth session missing!', 401, 'session_missing') }, { status: 401 })
  const body = await req.json().catch(() => ({})) as { password?: string; email?: string; data?: Record<string, unknown> }
  // Não permitir alterar o papel através dos metadados
  const data = body.data ? { ...body.data } : undefined
  if (data) delete (data as Record<string, unknown>).role
  const r = await updateUser(user.id, { password: body.password, email: body.email, data })
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ user: r.user })
}
