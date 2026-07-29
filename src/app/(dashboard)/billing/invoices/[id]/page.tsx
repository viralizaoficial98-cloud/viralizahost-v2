import { Metadata } from 'next'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import InvoiceDetail from '@/components/billing/InvoiceDetail'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = { title: 'Factura — ViralizaHost' }

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) redirect('/login')

  const db = createAdminWriteClient()

  // Load invoice (must belong to user)
  const { data: inv } = await db
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!inv) notFound()

  // Load profile
  const { data: profile } = await db
    .from('profiles')
    .select('full_name, email, phone, country')
    .eq('id', user.id)
    .maybeSingle()

  // Load order details
  const { data: order } = inv.order_id
    ? await db.from('orders')
        .select('id, billing_cycle, domain_name, domain_action, payment_method, transfer_ref, amount, status')
        .eq('id', inv.order_id)
        .maybeSingle()
    : { data: null }

  // Load order items
  const { data: orderItems } = inv.order_id
    ? await db.from('order_items')
        .select('id, service_name, service_type, price, quantity')
        .eq('order_id', inv.order_id)
    : { data: [] }

  // Load payments
  const { data: payments } = await db
    .from('payments')
    .select('id, status, method, amount, currency, created_at, transfer_ref, proof_url, proof_filename, rejection_reason, payer_name, payer_bank, transfer_date, declared_amount')
    .eq('invoice_id', id)
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })

  const outstanding = Math.max(0, Number(inv.total) - Number(inv.amount_paid ?? 0))

  return (
    <InvoiceDetail
      invoice={{ ...inv, outstanding }}
      profile={profile ?? { full_name: null, email: null, phone: null, country: null }}
      order={order ?? null}
      orderItems={orderItems ?? []}
      payments={payments ?? []}
    />
  )
}
