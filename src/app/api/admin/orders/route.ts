import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const db = await createAdminClient()
  const { data, error } = await (db as any)
    .from('orders')
    .select('*, profiles(full_name, email), order_items(*)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ orders: [], error: error.message })
  return NextResponse.json({ orders: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { orderId, action, notes } = await req.json()
  if (!orderId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const db = await createAdminClient()
  const newStatus = action === 'approve' ? 'active' : 'rejected'

  // Fetch full order before updating
  const { data: order, error: fetchErr } = await (db as any)
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  // Update order status
  const { error: updateErr } = await (db as any)
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString(), ...(notes ? { notes } : {}) })
    .eq('id', orderId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // On approval: activate services
  if (action === 'approve' && order.user_id) {
    const items: any[] = order.order_items ?? []
    const hasDomain  = items.some((i: any) => i.service_type === 'domain') || order.domain_name
    const hasHosting = items.some((i: any) => i.service_type === 'hosting' || i.service_type === 'reseller')
    const hasEmail   = items.some((i: any) => i.service_type === 'email')

    // Create domain record if domain order
    if (hasDomain && order.domain_name) {
      await (db as any).from('domains').upsert({
        profile_id:  order.user_id,
        name:        order.domain_name,
        status:      'active',
        registered_at: new Date().toISOString(),
        expires_at:  new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      }, { onConflict: 'name', ignoreDuplicates: true })
    }

    // Create service record for hosting/email
    if (hasHosting || hasEmail) {
      const serviceItem = items.find((i: any) =>
        i.service_type === 'hosting' || i.service_type === 'reseller' || i.service_type === 'email'
      )
      if (serviceItem) {
        const cycleMonths: Record<string, number> = {
          monthly: 1, '6months': 6, '1year': 12, '2years': 24, '3years': 36,
        }
        const months = cycleMonths[order.billing_cycle] ?? 12
        const expiresAt = new Date(Date.now() + months * 30 * 24 * 3600 * 1000).toISOString()

        await (db as any).from('services').insert({
          profile_id:   order.user_id,
          service_type: serviceItem.service_type,
          service_name: serviceItem.service_name,
          status:       'active',
          order_id:     orderId,
          expires_at:   expiresAt,
        }).select('id').single().then(() => {}).catch((e: any) => {
          console.warn('[admin/orders] service insert warning:', e?.message)
        })
      }
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
