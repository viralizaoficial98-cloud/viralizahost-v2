import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient, createRpcClient } from '@/lib/supabase/server'

export async function POST() {
  await requireAdminRole()

  const db  = createAdminWriteClient()
  const rpc = createRpcClient()

  // Try the RPC first (works if migration was applied)
  const { data: rpcData, error: rpcErr } = await rpc.rpc('reconcile_unprovisioned_orders')
  if (!rpcErr && rpcData) {
    console.log('[reconcile] RPC succeeded:', rpcData)
    return NextResponse.json({ method: 'rpc', ...rpcData })
  }

  // Fallback: inline reconciliation — find approved orders without service rows
  console.log('[reconcile] RPC failed or unavailable, running inline fallback. error:', rpcErr?.message)

  const { data: orders, error: ordErr } = await db
    .from('orders')
    .select('id, user_id, status, billing_cycle, amount, order_items(id, service_name, service_type, price, quantity)')
    .in('status', ['active', 'approved', 'paid'])

  if (ordErr) {
    console.error('[reconcile] orders query failed:', ordErr.message)
    return NextResponse.json({ error: ordErr.message }, { status: 500 })
  }

  // Get all existing service order_ids
  const { data: existingSvcs } = await db
    .from('services')
    .select('order_id')
    .not('order_id', 'is', null)

  const existingOrderIds = new Set((existingSvcs ?? []).map((s: any) => s.order_id).filter(Boolean))

  const results: any[] = []
  let created = 0
  let skipped = 0
  let errors  = 0

  for (const order of (orders ?? []) as any[]) {
    if (existingOrderIds.has(order.id)) {
      skipped++
      continue
    }

    const items = (order.order_items ?? []) as any[]
    if (items.length === 0) {
      skipped++
      continue
    }

    for (const item of items) {
      const { error: insErr } = await db.from('services').insert({
        profile_id:    order.user_id,
        plan_id:       null,
        service_type:  item.service_type ?? 'other',
        service_name:  item.service_name ?? 'Serviço',
        status:        'active',
        order_id:      order.id,
        price:         item.price ?? 0,
        billing_cycle: order.billing_cycle ?? 'monthly',
      })

      if (insErr) {
        console.error('[reconcile] insert failed for order', order.id, ':', insErr.message)
        errors++
        results.push({ order_id: order.id, item: item.service_name, error: insErr.message })
      } else {
        created++
        results.push({ order_id: order.id, item: item.service_name, result: 'created' })
      }
    }
  }

  console.log('[reconcile] inline done — created:', created, 'skipped:', skipped, 'errors:', errors)
  return NextResponse.json({ method: 'inline', orders_processed: (orders ?? []).length, created, skipped, errors, details: results })
}
