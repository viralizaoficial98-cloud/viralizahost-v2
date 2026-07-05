import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createRpcClient } from '@/lib/supabase/server'
import { createClient as createSupabaseJs } from '@supabase/supabase-js'

// Storage client — no db.schema, needed for signed URLs
function createStorageAdmin() {
  return createSupabaseJs(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const db = await createAdminClient()

  const { data, error } = await (db as any)
    .from('orders')
    .select(`
      id, status, amount, billing_cycle, payment_method,
      domain_name, domain_action, proof_file, transfer_ref,
      notes, created_at, updated_at,
      profiles ( full_name, email, phone ),
      order_items ( id, service_name, service_type, price, quantity )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[admin/orders GET]', error.message)
    return NextResponse.json({ orders: [], error: error.message })
  }

  const orders = data ?? []

  // Generate signed URLs for proof files (bucket is private)
  const storage = createStorageAdmin()
  const ordersWithUrls = await Promise.all(
    orders.map(async (order: any) => {
      if (!order.proof_file) return order
      const { data: signed } = await storage.storage
        .from('payment-proofs')
        .createSignedUrl(order.proof_file, 3600) // 1 hour
      return { ...order, proof_url: signed?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ orders: ordersWithUrls })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { orderId, action, notes } = body

  if (!orderId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  // Use rpcClient (no db.schema) — public.approve_order and public.reject_order
  // are in the public schema and never need Content-Profile header
  const rpcClient = createRpcClient()

  if (action === 'approve') {
    console.log('[admin/orders] APPROVING order', orderId)
    const { data, error } = await rpcClient.rpc('approve_order', { p_order_id: orderId })
    if (error) {
      console.error('[admin/orders approve]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.log('[admin/orders] APPROVED', orderId)
    return NextResponse.json(data)
  }

  // reject
  console.log('[admin/orders] REJECTING order', orderId, 'notes:', notes)
  const { data, error } = await rpcClient.rpc('reject_order', {
    p_order_id: orderId,
    p_notes:    notes ?? null,
  })
  if (error) {
    console.error('[admin/orders reject]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  console.log('[admin/orders] REJECTED', orderId)
  return NextResponse.json(data)
}
