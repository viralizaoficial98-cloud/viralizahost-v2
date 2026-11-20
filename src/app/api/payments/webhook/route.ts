import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getPool } from '@/lib/db/pool'
import { confirmPayment, PaymentError } from '@/lib/commerce/payments'
import { provisionOrder } from '@/lib/commerce/provisioning'

export const dynamic = 'force-dynamic'

// Notificação de pagamento confirmado (gateway ou conciliação bancária automática).
// Desactivado se PAYMENT_WEBHOOK_SECRET não estiver definido.
//
// Cabeçalhos: X-Viraliza-Timestamp: <unix s>   X-Viraliza-Signature: sha256=<hex HMAC(secret, `${timestamp}.${corpo}`)>
// Corpo JSON: { "event_id": "...", "invoice_number": "VH-…", "amount": 241200, "currency": "AKZ", "method": "bank_transfer" }
//
// Regras: assinatura e janela de 5 min obrigatórias; o valor tem de ser igual ao
// valor em dívida; o mesmo event_id só é processado uma vez.
export async function POST(req: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (!secret || secret.length < 32) return NextResponse.json({ error: 'Webhook de pagamentos não configurado.' }, { status: 503 })
  const raw = await req.text()
  const ts = req.headers.get('x-viraliza-timestamp') ?? ''
  const sig = (req.headers.get('x-viraliza-signature') ?? '').replace(/^sha256=/, '')
  const expected = createHmac('sha256', secret).update(`${ts}.${raw}`).digest()
  const given = Buffer.from(sig, 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return NextResponse.json({ error: 'Notificação expirada.' }, { status: 401 })

  let body: { event_id?: string; invoice_number?: string; amount?: number; currency?: string; method?: string }
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }
  if (!body.event_id || !body.invoice_number || typeof body.amount !== 'number') return NextResponse.json({ error: 'Campos obrigatórios: event_id, invoice_number, amount.' }, { status: 400 })

  const [[inv]] = await getPool().query('SELECT id FROM invoices WHERE invoice_number = ?', [body.invoice_number]) as any // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!inv) return NextResponse.json({ error: 'Factura inexistente.' }, { status: 404 })
  try {
    const r = await confirmPayment({ invoiceId: inv.id, amount: body.amount, currency: body.currency ?? 'AKZ', source: 'gateway', method: ['bank_transfer', 'multicaixa', 'credit_card', 'paypal', 'pix', 'mercadopago'].includes(String(body.method)) ? String(body.method) : 'bank_transfer', eventId: String(body.event_id).slice(0, 191) })
    if (r.status === 'paid' && r.orderId) await provisionOrder(r.orderId)
    console.info('[payments/webhook]', r.status, body.invoice_number)
    return NextResponse.json({ ok: true, status: r.status })
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    console.error('[payments/webhook] erro:', (e as Error).message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
