import { NextResponse } from 'next/server'
import { createSession, createUser, deleteUser, setSessionCookie } from '@/lib/auth/server'
import { sendVerificationEmail } from '@/lib/auth/verification'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'
import { claimCookieCart } from '@/lib/commerce/cart-server'
import { CustomerError, saveCustomer } from '@/lib/commerce/customer'
import { REQUIRED_FIELDS, fieldError, FIELD_LABEL, type CustomerField } from '@/lib/commerce/customer-fields'

export const dynamic = 'force-dynamic'

// Cadastro a partir do carrinho: cria a conta com os dados do titular e associa-lhe o carrinho.
// Com verificação de e-mail obrigatória (AUTH_EMAIL_CONFIRMATION != 'false'), a sessão só começa
// depois do link; o link leva a /carrinho/finalizar e a compra continua com o mesmo carrinho.
export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, Number(process.env.SIGNUP_RATE_LIMIT) || 10, 60 * 60_000)) {
    return NextResponse.json({ error: 'Demasiados registos a partir desta ligação. Tente mais tarde.' }, { status: 429 })
  }
  const b = await req.json().catch(() => ({})) as Record<string, unknown>
  const email = String(b.email ?? '').trim().toLowerCase()
  const password = String(b.password ?? '')
  const errors: Record<string, string> = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Indique um e-mail válido.'
  if (password.length < 8) errors.password = 'A senha deve ter pelo menos 8 caracteres.'
  for (const f of Object.keys(FIELD_LABEL) as CustomerField[]) {
    const e = fieldError(f, String(b[f] ?? ''))
    if (e && (REQUIRED_FIELDS.includes(f) || String(b[f] ?? '').trim())) errors[f] = e
  }
  if (Object.keys(errors).length) return NextResponse.json({ error: 'Corrija os campos assinalados.', errors }, { status: 400 })

  const confirm = process.env.AUTH_EMAIL_CONFIRMATION !== 'false'
  const r = await createUser({
    email, password, email_confirm: !confirm,
    user_metadata: { full_name: String(b.full_name).trim(), phone: String(b.phone).trim(), country: String(b.country), role: 'client', source: 'checkout' },
  })
  if ('error' in r) {
    const exists = r.error.code === 'email_exists'
    return NextResponse.json({ error: exists ? 'Já existe uma conta com este e-mail. Use «Já tenho conta» para iniciar sessão.' : r.error.message, code: exists ? 'email_exists' : 'signup_failed', ...(exists ? { errors: { email: 'E-mail já registado.' } } : {}) }, { status: exists ? 409 : 400 })
  }
  try {
    await saveCustomer(r.user.id, b)
  } catch (e) {
    await deleteUser(r.user.id).catch(() => {})
    if (e instanceof CustomerError) return NextResponse.json({ error: 'Corrija os campos assinalados.', errors: e.errors }, { status: 400 })
    throw e
  }
  await claimCookieCart(r.user.id)
  if (confirm) {
    const sent = await sendVerificationEmail(r.user.id, r.user.email)
    return NextResponse.json({ verify: true, email: r.user.email, emailSent: sent.ok })
  }
  const s = await createSession(r.user.id)
  await setSessionCookie(s.token, s.expiresAt)
  return NextResponse.json({ verify: false, next: '/carrinho/finalizar' })
}
