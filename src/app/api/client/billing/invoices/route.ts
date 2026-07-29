import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createRpcClient } from '@/lib/supabase/server'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')   || null
  const search   = searchParams.get('search')   || null
  const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1',  10))
  const per_page = Math.min(100, Math.max(5, parseInt(searchParams.get('per_page') ?? '25', 10)))

  const rpc = createRpcClient()
  const { data, error } = await rpc.rpc('get_client_invoices', {
    p_user_id:  user.id,
    p_status:   status,
    p_search:   search,
    p_page:     page,
    p_per_page: per_page,
  })

  if (error) {
    console.error('[GET /api/client/billing/invoices]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
