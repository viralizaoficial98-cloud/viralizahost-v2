import { NextRequest, NextResponse } from 'next/server'
import { createOrder, OrderError } from '@/lib/commerce/orders'
import { createSession, createUser, getSessionUser, setSessionCookie } from '@/lib/auth/server'
import { getPool } from '@/lib/db/pool'
import { clientIp, rateLimit } from '@/lib/auth/rate-limit'

export const dynamic = 'force-dynamic'

// Criação da encomenda. Preços, disponibilidade e impostos são recalculados no
// servidor; o cliente só confirma o total que viu (acceptedTotal). Repetir o
// pedido com a mesma idempotencyKey devolve a mesma encomenda.
// Limite por IP (10 min). Configurável só para o processo de ensaio (ORDER_RATE_LIMIT); produção usa 20.
const ORDER_LIMIT = Math.min(1000, Math.max(1, Number(process.env.ORDER_RATE_LIMIT) || 20))

export async function POST(req: NextRequest) {
  if (!rateLimit(`order:${clientIp(req)}`, ORDER_LIMIT, 10 * 60_000)) {
    return NextResponse.json({ error: 'Demasiados pedidos. Tente novamente dentro de alguns minutos.' }, { status: 429 })
  }
  let body: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  // ── Utilizador: sessão ou conta criada no checkout ──────────────────────────
  let userId = (await getSessionUser())?.id ?? null
  if (!userId) {
    const u = body.userData ?? {}
    if (!u.email || !u.password) return NextResponse.json({ error: 'Inicie sessão ou crie uma conta para concluir a encomenda.', code: 'auth_required' }, { status: 401 })
    const created = await createUser({
      email: String(u.email), password: String(u.password), email_confirm: true,
      user_metadata: { full_name: String(u.name ?? '').slice(0, 120), phone: String(u.phone ?? '').slice(0, 40), source: 'checkout' },
    })
    if ('error' in created) {
      const exists = created.error.code === 'email_exists'
      return NextResponse.json({ error: exists ? 'Já existe uma conta com este e-mail. Inicie sessão para continuar.' : created.error.message, code: exists ? 'email_exists' : 'signup_failed' }, { status: exists ? 409 : 400 })
    }
    userId = created.user.id
    const s = await createSession(userId)
    await setSessionCookie(s.token, s.expiresAt)
  }

  // ── Comprovativo opcional: tem de existir e não pode estar usado noutra encomenda ──
  const proof = body.proofFile ? String(body.proofFile) : null
  if (proof) {
    const [[obj]] = await getPool().query("SELECT name FROM storage_objects WHERE bucket_id = 'payment-proofs' AND name = ?", [proof]) as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const [[used]] = await getPool().query('SELECT id FROM payments WHERE proof_url = ? LIMIT 1', [proof]) as any // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!obj || used) return NextResponse.json({ error: 'Comprovativo inválido. Envie o ficheiro novamente.', code: 'proof_invalid' }, { status: 400 })
  }

  try {
    const { order, quote } = await createOrder({
      userId,
      idempotencyKey: String(body.idempotencyKey ?? ''),
      lines: Array.isArray(body.lines) ? body.lines : [],
      acceptedTotal: Number(body.acceptedTotal),
      paymentMethod: String(body.paymentMethod ?? ''),
      proofFile: proof,
      transferRef: body.transferRef ? String(body.transferRef).slice(0, 120) : null,
      billingDetails: body.billingDetails && typeof body.billingDetails === 'object' ? body.billingDetails : null,
      nameservers: body.nameservers,
    })
    console.info('[checkout/orders]', order.replayed ? 'repetição' : 'criada', order.order_number, order.total)
    return NextResponse.json({ order, quote: { total: quote.total, currency: quote.currency } }, { status: order.replayed ? 200 : 201 })
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message, code: e.code, ...e.extra }, { status: e.status })
    console.error('[checkout/orders] erro:', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível criar a encomenda. Tente novamente.' }, { status: 500 })
  }
}
