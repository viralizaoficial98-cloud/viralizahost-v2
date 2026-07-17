import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: invoiceId } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = createAdminWriteClient()

  // Validate ownership
  const { data: invoice } = await db
    .from('invoices')
    .select('id, status, total, amount_paid, currency')
    .eq('id', invoiceId)
    .eq('profile_id', user.id)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })

  const { data: payments } = await db
    .from('payments')
    .select('id, status, method, amount, created_at, transfer_ref, proof_url, proof_filename, rejection_reason, reviewed_at')
    .eq('invoice_id', invoiceId)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  const outstanding = Math.max(0, Number(invoice.total) - Number((invoice as any).amount_paid ?? 0))

  return NextResponse.json({
    invoice_status: invoice.status,
    outstanding,
    currency: invoice.currency,
    payments: payments ?? [],
  })
}
