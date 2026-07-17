import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = createAdminWriteClient()

  const { data: invoice, error } = await db
    .from('invoices')
    .select('*, profiles(full_name, email)')
    .eq('id', id)
    .eq('profile_id', user.id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
  }

  const outstanding = Math.max(0, Number(invoice.total) - Number((invoice as any).amount_paid ?? 0))

  // Fetch active payments for this invoice
  const { data: payments } = await db
    .from('payments')
    .select('id, status, method, amount, created_at, transfer_ref, proof_url, rejection_reason')
    .eq('invoice_id', id)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ invoice: { ...invoice, outstanding }, payments: payments ?? [] })
}
