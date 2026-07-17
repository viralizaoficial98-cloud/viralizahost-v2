import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

const PAYABLE_STATUSES = ['pending', 'overdue', 'partially_paid', 'rejected', 'under_review']
const ALLOWED_METHODS  = ['bank_transfer', 'multicaixa', 'paypal', 'mercadopago', 'credit_card', 'pix']
const BLOCKING_PAYMENT = ['pending', 'proof_uploaded', 'under_review', 'approved']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }) }

  const method = String(body.method ?? '').trim()
  if (!ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 })
  }

  const db = createAdminWriteClient()

  // Validate invoice ownership and payability
  const { data: invoice, error: invErr } = await db
    .from('invoices')
    .select('id, status, total, amount_paid, currency, profile_id')
    .eq('id', invoiceId)
    .eq('profile_id', user.id)
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
  }
  if (!PAYABLE_STATUSES.includes(invoice.status)) {
    return NextResponse.json({ error: `Fatura com estado "${invoice.status}" não pode ser paga.` }, { status: 409 })
  }

  // Server-side amount calculation — never trust client
  const outstanding = Math.max(0, Number(invoice.total) - Number((invoice as any).amount_paid ?? 0))
  if (outstanding <= 0) {
    return NextResponse.json({ error: 'Fatura já está paga.' }, { status: 409 })
  }

  // Anti-duplicate: check for active payments
  const { data: existingPayments } = await db
    .from('payments')
    .select('id, status')
    .eq('invoice_id', invoiceId)
    .eq('profile_id', user.id)
    .in('status', BLOCKING_PAYMENT)

  if (existingPayments && existingPayments.length > 0) {
    return NextResponse.json({
      error: 'Já existe um pagamento activo para esta fatura.',
      existing_payment_id: existingPayments[0].id,
      existing_status: existingPayments[0].status,
    }, { status: 409 })
  }

  // Create pending payment record
  const { data: payment, error: payErr } = await db
    .from('payments')
    .insert({
      invoice_id:   invoiceId,
      profile_id:   user.id,
      method:       method,
      amount:       outstanding,
      currency:     invoice.currency,
      status:       'pending',
    })
    .select('id, amount, currency, method, status')
    .single()

  if (payErr || !payment) {
    console.error('[billing/payment-intent]', payErr?.message)
    return NextResponse.json({ error: 'Erro ao criar intenção de pagamento.' }, { status: 500 })
  }

  console.info('[PAYMENT INTENT]', { invoiceId, profileId: user.id, method, amount: outstanding, paymentId: payment.id })

  return NextResponse.json({ payment, outstanding, currency: invoice.currency }, { status: 201 })
}
