import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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

  return NextResponse.json({ orders: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { orderId, action, notes } = body

  if (!orderId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const db = await createAdminClient()

  if (action === 'approve') {
    const { data, error } = await (db as any).rpc('approve_order', { p_order_id: orderId })
    if (error) {
      console.error('[admin/orders approve]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  // reject
  const { data, error } = await (db as any).rpc('reject_order', {
    p_order_id: orderId,
    p_notes:    notes ?? null,
  })
  if (error) {
    console.error('[admin/orders reject]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
