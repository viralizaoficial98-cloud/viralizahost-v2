import { NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase/server'
import { listMyVps } from '@/lib/vps/manage'

export const dynamic = 'force-dynamic'

// «Os meus VPS»: só os serviços do cliente autenticado.
export async function GET() {
  const { data: { user } } = await (await createAuthClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  try { return NextResponse.json({ items: await listMyVps(user.id) }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch (e) { console.error('[client/vps]', (e as Error).message); return NextResponse.json({ error: 'Não foi possível carregar os VPS.' }, { status: 500 }) }
}
