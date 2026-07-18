import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createAdminWriteClient, createRpcClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createClient as createStorageClient } from '@supabase/supabase-js'

// Storage client — NO db.schema header (Storage API breaks with it)
function storageAdmin() {
  return createStorageClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  try {
    await requireAdminRole()
  } catch {
    return NextResponse.json({ orders: [], error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminWriteClient() // plain supabase-js, viralizahost schema, service_role

  // ── 1. Fetch orders ──────────────────────────────────────────────────────
  const { data: ordersRaw, error: ordErr } = await db
    .from('orders')
    .select('id, user_id, status, amount, billing_cycle, payment_method, domain_name, domain_action, proof_file, transfer_ref, notes, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(300)

  if (ordErr) {
    console.error('[admin/orders GET] orders query failed:', ordErr.message)
    return NextResponse.json({ orders: [], error: ordErr.message })
  }

  const orders = ordersRaw ?? []
  if (orders.length === 0) return NextResponse.json({ orders: [] })

  // ── 2. Fetch order_items ──────────────────────────────────────────────────
  const orderIds = orders.map((o: any) => o.id)
  const { data: itemsRaw } = await db
    .from('order_items')
    .select('id, order_id, service_name, service_type, price, quantity')
    .in('order_id', orderIds)

  const itemsMap = new Map<string, any[]>()
  for (const item of (itemsRaw ?? []) as any[]) {
    const arr = itemsMap.get(item.order_id) ?? []
    arr.push(item)
    itemsMap.set(item.order_id, arr)
  }

  // ── 3. Fetch profiles by user_id (profiles.id = auth.users.id) ────────────
  const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean) as string[])]
  const { data: profilesRaw } = userIds.length > 0
    ? await db.from('profiles').select('id, full_name, email, phone').in('id', userIds)
    : { data: [] }
  const profileMap = new Map((profilesRaw ?? []).map((p: any) => [p.id, p]))

  // ── 4. Generate signed URLs for proof files ──────────────────────────────
  const storage = storageAdmin()
  const ordersWithData = await Promise.all(
    orders.map(async (order: any) => {
      let proof_url: string | null = null
      if (order.proof_file) {
        const { data: signed } = await storage.storage
          .from('payment-proofs')
          .createSignedUrl(order.proof_file, 3600)
        proof_url = signed?.signedUrl ?? null
      }
      return {
        ...order,
        proof_url,
        profiles: order.user_id ? (profileMap.get(order.user_id) ?? null) : null,
        order_items: itemsMap.get(order.id) ?? [],
      }
    })
  )

  return NextResponse.json({ orders: ordersWithData })
}

export async function POST(req: NextRequest) {
  let adminUserId: string
  try {
    adminUserId = await requireAdminRole()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { orderId, action, notes } = body

  if (!orderId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const db  = createAdminWriteClient()
  const rpc = createRpcClient()

  if (action === 'approve') {
    console.log('[admin/orders] APPROVING', orderId, 'by', adminUserId?.slice(0, 8))

    // Try RPC first (only works if migration was applied)
    const { data: rpcData, error: rpcErr } = await rpc.rpc('approve_order', { p_order_id: orderId })
    if (!rpcErr) {
      // Ensure services exist (inline fallback if provision_order_services not applied)
      await ensureServicesExist(db, orderId)
      console.log('[admin/orders] APPROVED via RPC', orderId, rpcData)
      return NextResponse.json(rpcData ?? { ok: true })
    }

    // Fallback: inline approve + provision
    console.warn('[admin/orders] RPC failed, using inline approve. error:', rpcErr.message)
    const { error: ordUpd } = await db.from('orders').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', orderId)
    if (ordUpd) {
      console.error('[admin/orders approve inline] order update failed:', ordUpd.message)
      return NextResponse.json({ error: ordUpd.message }, { status: 500 })
    }
    await db.from('services').update({ status: 'active', updated_at: new Date().toISOString() }).eq('order_id', orderId)
    await db.from('domains').update({ status: 'active', registered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('order_id', orderId)
    await ensureServicesExist(db, orderId)
    console.log('[admin/orders] APPROVED inline', orderId)
    return NextResponse.json({ ok: true, status: 'active' })
  }

  // reject
  console.log('[admin/orders] REJECTING', orderId, 'notes:', notes)
  const { data, error } = await rpc.rpc('reject_order', { p_order_id: orderId, p_notes: notes ?? null })
  if (error) {
    // Inline fallback
    await db.from('orders').update({ status: 'rejected', notes: notes ?? null, updated_at: new Date().toISOString() }).eq('id', orderId)
    await db.from('services').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('order_id', orderId)
  }
  console.log('[admin/orders] REJECTED', orderId)
  return NextResponse.json(data ?? { ok: true })
}

// Idempotent: create services rows for order items that don't have one yet
async function ensureServicesExist(db: ReturnType<typeof createAdminWriteClient>, orderId: string) {
  const { data: order } = await db.from('orders').select('id, user_id, billing_cycle, amount, status').eq('id', orderId).maybeSingle()
  if (!order?.user_id) return

  const { data: items } = await db.from('order_items').select('id, service_name, service_type, price, quantity').eq('order_id', orderId)
  if (!items?.length) return

  const { data: existing } = await db.from('services').select('id, service_name').eq('order_id', orderId)
  const existingNames = new Set((existing ?? []).map((s: any) => s.service_name))

  for (const item of items) {
    if (existingNames.has(item.service_name)) continue
    const { error } = await db.from('services').insert({
      profile_id:    order.user_id,
      plan_id:       null,
      service_type:  item.service_type ?? 'other',
      service_name:  item.service_name ?? 'Serviço',
      status:        order.status === 'active' ? 'active' : 'pending_provisioning',
      order_id:      orderId,
      price:         item.price ?? 0,
      billing_cycle: order.billing_cycle ?? 'monthly',
    })
    if (error) console.error('[ensureServicesExist] insert failed:', error.message, '— item:', item.service_name)
  }
}
