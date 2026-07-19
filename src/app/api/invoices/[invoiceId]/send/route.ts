import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { sendInvoiceEmail } from '@/lib/invoice/send-invoice-email'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    // ── Auth: identificar utilizador no servidor ──────────────
    const auth = await createAuthClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, code: 'UNAUTHORIZED', message: 'Sessão expirada.' }, { status: 401 })
    }

    const { invoiceId } = await params
    if (!invoiceId || invoiceId.length < 10) {
      return NextResponse.json({ success: false, code: 'INVALID_INVOICE_ID', message: 'ID de factura inválido.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { orderId, ticketId, forceResend = false } = body as {
      orderId?: string
      ticketId?: string
      forceResend?: boolean
    }

    // Admin pode reenviar; cliente normal só no próprio fluxo
    const db = createAdminWriteClient()
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const isAdmin = profile?.role === 'admin'

    // Clientes normais não podem forçar reenvio sem ser admin
    const canForce = isAdmin || forceResend === false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sendInvoiceEmail({
      invoiceId,
      customerId: user.id,       // SEMPRE do servidor, nunca do body
      db: db as any,
      initiatedByUserId: user.id,
      initiatedByAgent:  false,
      orderId,
      ticketId,
      forceResend: isAdmin ? forceResend : false,
    })

    const status = result.success ? 200 : (
      result.code === 'UNAUTHORIZED'               ? 403 :
      result.code === 'INVOICE_NOT_FOUND'          ? 404 :
      result.code === 'RESEND_KEY_MISSING'         ? 503 :
      result.code === 'RESEND_DOMAIN_NOT_VERIFIED' ? 503 : 500
    )

    return NextResponse.json({ ...result, invoiceId }, { status })

  } catch (err) {
    console.error('[/api/invoices/[invoiceId]/send]', err)
    return NextResponse.json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao processar o envio da factura.',
    }, { status: 500 })
  }
}
