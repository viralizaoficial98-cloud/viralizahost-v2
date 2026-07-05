import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const db = await createAdminClient()
  const { data, error } = await db
    .from('orders')
    .select('*, profiles(full_name, email), order_items(*)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ orders: [], error: error.message })
  return NextResponse.json({ orders: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { orderId, action } = await req.json()
  if (!orderId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const db = await createAdminClient()
  const newStatus = action === 'approve' ? 'active' : 'rejected'

  const { error } = await (db as any).from('orders').update({ status: newStatus }).eq('id', orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, status: newStatus })
}
