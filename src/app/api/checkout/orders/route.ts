import { NextRequest, NextResponse } from 'next/server'
import { createOrder, OrderError } from '@/lib/commerce/orders'
import { getSessionUser } from '@/lib/auth/server'
import { billingSnapshot, loadCustomer } from '@/lib/commerce/customer'
import { clearUserCarts } from '@/lib/commerce/cart-server'
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

  // ── Utilizador: sempre o da sessão (a conta é criada antes, em /checkout/conta) ──
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Inicie sessão ou crie uma conta para concluir a encomenda.', code: 'auth_required', next: '/checkout/conta' }, { status: 401 })
  const userId = user.id
  // Dados do titular validados no servidor (não basta já ter comprado antes)
  const customer = await loadCustomer(userId)
  if (!customer || customer.missing.length) {
    return NextResponse.json({ error: 'Complete os dados do cliente antes de confirmar a encomenda.', code: 'customer_incomplete', next: '/checkout/dados' }, { status: 409 })
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
      billingDetails: billingSnapshot(customer.email, customer.data),
      nameservers: body.nameservers,
    })
    if (!order.replayed) await clearUserCarts(userId).catch(() => {})
    console.info('[checkout/orders]', order.replayed ? 'repetição' : 'criada', order.order_number, order.total)
    return NextResponse.json({ order, quote: { total: quote.total, currency: quote.currency } }, { status: order.replayed ? 200 : 201 })
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message, code: e.code, ...e.extra }, { status: e.status })
    console.error('[checkout/orders] erro:', (e as Error).message)
    return NextResponse.json({ error: 'Não foi possível criar a encomenda. Tente novamente.' }, { status: 500 })
  }
}
