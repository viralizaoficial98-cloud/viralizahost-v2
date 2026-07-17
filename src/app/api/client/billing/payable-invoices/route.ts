import { NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

const PAYABLE = ['pending', 'overdue', 'partially_paid', 'rejected', 'under_review']

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = createAdminWriteClient()

  const { data: invoices, error } = await db
    .from('invoices')
    .select('id, invoice_number, order_id, status, currency, subtotal, discount, tax, total, amount_paid, due_date, created_at, notes, items')
    .eq('profile_id', user.id)
    .in('status', PAYABLE)
    .order('due_date', { ascending: true })

  if (error) {
    console.error('[billing/payable-invoices]', error.message)
    return NextResponse.json({ error: 'Erro ao carregar faturas.' }, { status: 500 })
  }

  const list = (invoices ?? []).map((inv: any) => ({
    ...inv,
    outstanding: Math.max(0, Number(inv.total) - Number(inv.amount_paid ?? 0)),
  }))

  return NextResponse.json({ invoices: list })
}
