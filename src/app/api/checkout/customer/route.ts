import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/server'
import { CustomerError, loadCustomer, saveCustomer } from '@/lib/commerce/customer'

export const dynamic = 'force-dynamic'

// Etapa «Dados do cliente»: identidade e e-mail vêm SEMPRE da sessão; aqui só os dados do titular.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Inicie sessão para continuar.', code: 'auth_required' }, { status: 401 })
  const c = await loadCustomer(user.id)
  if (!c) return NextResponse.json({ error: 'Conta inexistente.' }, { status: 404 })
  return NextResponse.json(c, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Inicie sessão para continuar.', code: 'auth_required' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  // e-mail/senha/papel nunca são aceites aqui
  const { email: _e, password: _p, role: _r, ...fields } = body // eslint-disable-line @typescript-eslint/no-unused-vars
  try {
    await saveCustomer(user.id, fields)
    return NextResponse.json(await loadCustomer(user.id))
  } catch (e) {
    if (e instanceof CustomerError) return NextResponse.json({ error: 'Corrija os campos assinalados.', errors: e.errors }, { status: 400 })
    throw e
  }
}
