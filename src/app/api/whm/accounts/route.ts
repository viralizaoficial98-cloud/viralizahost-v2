import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { listAccounts, getServerLoad } from '@/lib/whm/client'

export async function GET() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  const profile = profileRaw as any
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: serversRaw } = await supabase.from('servers').select('*').eq('is_active', true)
  const servers = serversRaw as any[]
  if (!servers?.length) return NextResponse.json({ servers: [], accounts: [] })

  const results = await Promise.allSettled(
    servers.map(async (server) => {
      if (!server.whm_url || !server.whm_api_token) return { server: server.name, accounts: [], load: null }
      const config = { url: server.whm_url, token: server.whm_api_token, username: server.whm_username ?? 'root' }
      const [accounts, load] = await Promise.allSettled([listAccounts(config), getServerLoad(config)])
      return {
        server: server.name,
        server_id: server.id,
        accounts: accounts.status === 'fulfilled' ? accounts.value : [],
        load: load.status === 'fulfilled' ? load.value : null,
      }
    })
  )

  return NextResponse.json({
    servers: results.map(r => r.status === 'fulfilled' ? r.value : { error: (r as PromiseRejectedResult).reason?.message }),
  })
}
