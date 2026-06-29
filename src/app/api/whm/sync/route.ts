import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAccount, getDiskUsage } from '@/lib/whm/client'

// Sincroniza uso de disco/bandwidth das contas WHM para a base de dados
export async function POST() {
  const supabase = await createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  const profile = profileRaw as any
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: hostingAccountsRaw } = await supabase
    .from('hosting_accounts')
    .select('*, servers(*)')
    .eq('status', 'active' as any)
  const hostingAccounts = hostingAccountsRaw as any[]

  if (!hostingAccounts?.length) return NextResponse.json({ synced: 0 })

  let synced = 0
  const errors: string[] = []

  for (const ha of hostingAccounts) {
    const server = (ha as any).servers
    if (!server?.whm_url || !server?.whm_api_token) continue

    const config = { url: server.whm_url, token: server.whm_api_token, username: server.whm_username ?? 'root' }
    try {
      const [account, disk] = await Promise.all([
        getAccount(config, ha.cpanel_username),
        getDiskUsage(config, ha.cpanel_username),
      ])
      if (!account) continue

      await (supabase as any).from('hosting_accounts').update({
        disk_used_mb: Math.round(disk.used),
        status: account.suspended ? 'suspended' : 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', ha.id)

      synced++
    } catch (e: any) {
      errors.push(`${ha.cpanel_username}: ${e.message}`)
    }
  }

  return NextResponse.json({ synced, errors })
}
