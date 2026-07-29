import { NextResponse } from 'next/server'
import { createAuthClient, createRpcClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const rpc = createRpcClient()
  const { data, error } = await rpc.rpc('get_client_financial_summary', { p_user_id: user.id })

  if (error) {
    console.error('[GET /api/client/billing/summary]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
