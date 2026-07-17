import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try { await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  // Fetch orders with profile + items
  const { data: orders, error: ordErr } = await db
    .from('orders')
    .select('*, profiles(full_name, email), order_items(*)')
    .order('created_at', { ascending: false })
    .limit(500)

  // Fetch invoices with profile
  const { data: invoices, error: invErr } = await db
    .from('invoices')
    .select('*, profiles(full_name, email)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (ordErr) console.error('[admin/financial/summary] orders:', ordErr.message)
  if (invErr) console.error('[admin/financial/summary] invoices:', invErr.message)

  const ordList  = orders  ?? []
  const invList  = invoices ?? []

  const now      = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Orders stats
  const ordPaid    = ordList.filter((o: any) => o.status === 'paid' || o.status === 'aprovado')
  const ordPending = ordList.filter((o: any) => ['pending', 'aguardando_confirmacao', 'under_review'].includes(o.status))
  const ordThisMonth = ordList.filter((o: any) => new Date(o.created_at) >= monthStart)

  const revenue      = ordPaid.reduce((s: number, o: any) => s + Number(o.amount ?? 0), 0)
  const pending      = ordPending.reduce((s: number, o: any) => s + Number(o.amount ?? 0), 0)
  const monthRevenue = ordPaid
    .filter((o: any) => new Date(o.created_at) >= monthStart)
    .reduce((s: number, o: any) => s + Number(o.amount ?? 0), 0)

  // Invoice stats
  const invPaid    = invList.filter((i: any) => i.status === 'paid')
  const invPending = invList.filter((i: any) => i.status === 'pending')
  const invOverdue = invList.filter((i: any) => i.status === 'overdue')

  return NextResponse.json({
    orders:   ordList,
    invoices: invList,
    stats: {
      totalRevenue:    revenue,
      monthRevenue,
      pendingAmount:   pending,
      ordersTotal:     ordList.length,
      ordersPaid:      ordPaid.length,
      ordersPending:   ordPending.length,
      ordersThisMonth: ordThisMonth.length,
      invoicesTotal:   invList.length,
      invoicesPaid:    invPaid.length,
      invoicesPending: invPending.length,
      invoicesOverdue: invOverdue.length,
    },
  })
}
