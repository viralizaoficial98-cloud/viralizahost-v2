import { Metadata } from 'next'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BillingManager from '@/components/billing/BillingManager'

export const dynamic   = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: 'Financeiro — ViralizaHost' }

const PAYABLE = ['pending', 'overdue', 'partially_paid', 'rejected', 'under_review']

async function fetchBillingData(userId: string) {
  const db = createAdminWriteClient()

  const [{ data: invoicesRaw }, { data: profile }] = await Promise.all([
    db.from('invoices')
      .select('id, invoice_number, order_id, status, currency, subtotal, discount, tax, total, amount_paid, due_date, created_at, notes, items')
      .eq('profile_id', userId)
      .order('created_at', { ascending: false }),
    db.from('profiles').select('currency').eq('id', userId).single(),
  ])

  const invoices = (invoicesRaw ?? []).map((inv: any) => ({
    ...inv,
    outstanding: Math.max(0, Number(inv.total) - Number(inv.amount_paid ?? 0)),
  }))

  const currency = (profile as any)?.currency ?? 'AKZ'

  const totalPaid        = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total), 0)
  const totalPending     = invoices.filter((i: any) => PAYABLE.includes(i.status)).reduce((s: number, i: any) => s + Number(i.outstanding), 0)
  const totalUnderReview = invoices.filter((i: any) => i.status === 'under_review').reduce((s: number, i: any) => s + Number(i.outstanding), 0)
  const nextDue          = invoices
    .filter((i: any) => PAYABLE.includes(i.status))
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]?.due_date ?? null

  return { invoices, currency, totalPaid, totalPending, totalUnderReview, nextDue }
}

export default async function BillingPage() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const { invoices, currency, totalPaid, totalPending, totalUnderReview, nextDue } = await fetchBillingData(user.id)

  return (
    <BillingManager
      initialInvoices={invoices}
      totalPaid={totalPaid}
      totalPending={totalPending}
      totalUnderReview={totalUnderReview}
      nextDue={nextDue}
      currency={currency}
    />
  )
}
