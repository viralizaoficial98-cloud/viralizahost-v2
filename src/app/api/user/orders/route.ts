import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const db = await createAdminClient()

  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ orders: [] })

  const { data, error } = await (db as any)
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[user/orders] error:', error.message)
    return NextResponse.json({ orders: [], error: error.message })
  }

  return NextResponse.json({ orders: data ?? [] })
}
