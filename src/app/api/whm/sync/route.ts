import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { getPool } from '@/lib/db/pool'
import { getAccount, getDiskUsage } from '@/lib/whm/client'
import { loadWhmConfig } from '@/lib/whm/config'

// Sincroniza uso de disco e estado (suspensa/activa) das contas WHM associadas.
// Credenciais pelo mecanismo único (loadWhmConfig): o token é decifrado só no servidor.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST() {
  try { await requireAdminRole() } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const db = getPool()
  const [accounts] = await db.query("SELECT id, cpanel_username, server_id FROM hosting_accounts WHERE status = 'active'") as any
  if (!accounts.length) return NextResponse.json({ synced: 0, errors: [] })
  const cache = new Map<string, Awaited<ReturnType<typeof loadWhmConfig>>>()
  let synced = 0
  const errors: string[] = []
  for (const ha of accounts as any[]) {
    const key = ha.server_id ?? ''
    if (!cache.has(key)) cache.set(key, (key ? await loadWhmConfig(key) : null) ?? await loadWhmConfig())
    const cfg = cache.get(key)
    if (!cfg) { errors.push(`${ha.cpanel_username}: servidor WHM sem credenciais`); continue }
    try {
      const [account, disk] = await Promise.all([getAccount(cfg.config, ha.cpanel_username), getDiskUsage(cfg.config, ha.cpanel_username)])
      if (!account) continue
      await db.query('UPDATE hosting_accounts SET disk_used_mb = ?, status = ? WHERE id = ?', [Math.round(disk.used), account.suspended ? 'suspended' : 'active', ha.id])
      synced++
    } catch (e) {
      errors.push(`${ha.cpanel_username}: ${String((e as Error).message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 160)}`)
    }
  }
  return NextResponse.json({ synced, errors })
}
