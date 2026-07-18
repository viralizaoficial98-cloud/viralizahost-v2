import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createRpcClient } from '@/lib/supabase/server'

export async function POST() {
  await requireAdminRole()

  const rpc = createRpcClient()
  const { data, error } = await rpc.rpc('reconcile_unprovisioned_orders')
  if (error) {
    console.error('[admin/reconcile]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
