import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

const MAX_SIZE   = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
const BUCKET = 'payment-proofs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Formulário inválido.' }, { status: 400 }) }

  const file         = form.get('file') as File | null
  const paymentId    = String(form.get('payment_id') ?? '').trim()
  const transferRef  = String(form.get('transfer_ref') ?? '').trim()
  const transferDate = String(form.get('transfer_date') ?? '').trim()
  const payerName    = String(form.get('payer_name') ?? '').trim()
  const payerBank    = String(form.get('payer_bank') ?? '').trim()
  const declaredAmt  = parseFloat(String(form.get('declared_amount') ?? '0'))

  if (!file) return NextResponse.json({ error: 'Comprovativo obrigatório.' }, { status: 400 })
  if (!paymentId) return NextResponse.json({ error: 'payment_id obrigatório.' }, { status: 400 })

  // Validate file
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ficheiro excede 10 MB.' }, { status: 400 })
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de ficheiro inválido. Use PNG, JPG ou PDF.' }, { status: 400 })
  }

  const db = createAdminWriteClient()

  // Validate invoice ownership
  const { data: invoice } = await db
    .from('invoices')
    .select('id, status, total, amount_paid, currency, profile_id')
    .eq('id', invoiceId)
    .eq('profile_id', user.id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })

  // Validate payment belongs to this user + invoice
  const { data: payment } = await db
    .from('payments')
    .select('id, status, invoice_id, profile_id')
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)
    .eq('profile_id', user.id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 })

  // Upload proof to private bucket
  const ext      = file.type === 'application/pdf' ? 'pdf' : file.name.split('.').pop() ?? 'jpg'
  const filePath = `${user.id}/${invoiceId}/${paymentId}.${ext}`
  const buffer   = Buffer.from(await file.arrayBuffer())

  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) {
    console.error('[billing/payment-proof] upload error:', uploadErr.message)
    return NextResponse.json({ error: 'Erro ao guardar comprovativo.' }, { status: 500 })
  }

  // Update payment record
  const { error: payUpdErr } = await db
    .from('payments')
    .update({
      status:          'under_review',
      proof_url:       filePath,
      proof_filename:  file.name,
      proof_mime:      file.type,
      transfer_ref:    transferRef || null,
      transfer_date:   transferDate || null,
      payer_name:      payerName || null,
      payer_bank:      payerBank || null,
      declared_amount: isNaN(declaredAmt) ? null : declaredAmt,
    })
    .eq('id', paymentId)

  if (payUpdErr) {
    console.error('[billing/payment-proof] payment update:', payUpdErr.message)
    return NextResponse.json({ error: 'Erro ao actualizar pagamento.' }, { status: 500 })
  }

  // Update invoice to under_review
  await db
    .from('invoices')
    .update({ status: 'under_review', updated_at: new Date().toISOString() })
    .eq('id', invoiceId)

  // Notify admins (best-effort)
  try {
    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      await db.from('notifications').insert(
        admins.map((a: any) => ({
          profile_id: a.id,
          type:       'info',
          title:      'Comprovativo de pagamento enviado',
          message:    `Fatura ${(invoice as any).invoice_number ?? invoiceId} — comprovativo aguarda revisão.`,
          link:       `/admin/financial`,
        }))
      )
    }
  } catch { /* non-fatal */ }

  console.info('[PAYMENT PROOF]', { invoiceId, paymentId, profileId: user.id, file: file.name, size: file.size })

  return NextResponse.json({ success: true, status: 'under_review' }, { status: 200 })
}
