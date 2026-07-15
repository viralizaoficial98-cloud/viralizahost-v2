import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import { getAccount } from '@/lib/whm/client'

// Simple rate limiting: 1 sync per 5 minutes per user
const lastSyncTime = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  const authDb = await createAuthClient()
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  // Rate limit
  const last = lastSyncTime.get(user.id) ?? 0
  const now  = Date.now()
  if (now - last < RATE_LIMIT_MS) {
    const waitSec = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000)
    return NextResponse.json({ error: `Aguarde ${waitSec}s antes de sincronizar novamente.` }, { status: 429 })
  }
  lastSyncTime.set(user.id, now)

  try {
    const db = createAdminWriteClient()

    // Get this user's hosting accounts
    const { data: accounts, error: haErr } = await db
      .from('hosting_accounts')
      .select('id, cpanel_username, profile_id, server_id')
      .eq('profile_id', user.id)

    if (haErr) throw new Error(haErr.message)
    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: 'Nenhuma conta de hospedagem para sincronizar.' }, { status: 404 })
    }

    const whmCfg = await loadWhmConfig()
    if (!whmCfg) return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })

    const syncedAt = new Date().toISOString()
    const results: Array<{ username: string; ok: boolean; error?: string }> = []

    for (const ha of accounts as any[]) {
      try {
        const whmAcct = await getAccount(whmCfg.config, ha.cpanel_username)
        if (!whmAcct) {
          results.push({ username: ha.cpanel_username, ok: false, error: 'Conta não encontrada no WHM' })
          continue
        }

        // Parse disk values
        const diskUsed  = parseFloat(String(whmAcct.diskused).replace(/[^\d.]/g, '')) || 0
        const diskLimitRaw = String(whmAcct.disklimit)
        const diskLimit = diskLimitRaw.toLowerCase().startsWith('unlim') ? null : (parseFloat(diskLimitRaw.replace(/[^\d.]/g, '')) || null)
        const isSuspended = whmAcct.suspended

        await db.from('hosting_accounts').update({
          disk_used_mb:      Math.round(diskUsed),
          disk_limit_mb:     diskLimit ? Math.round(diskLimit) : null,
          status:            isSuspended ? 'suspended' : 'active',
          package_name:      whmAcct.plan || null,
          ip_address:        whmAcct.ip || null,
          php_version:       whmAcct.phpversion || null,
          last_synced_at:    syncedAt,
          updated_at:        syncedAt,
        }).eq('id', ha.id)

        // Also update whm_accounts
        await db.from('whm_accounts').update({
          disk_used_mb:   Math.round(diskUsed),
          disk_limit_mb:  diskLimit ? Math.round(diskLimit) : null,
          is_suspended:   isSuspended,
          status:         isSuspended ? 'suspended' : 'active',
          last_synced_at: syncedAt,
          updated_at:     syncedAt,
        }).eq('hosting_account_id', ha.id)

        results.push({ username: ha.cpanel_username, ok: true })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ username: ha.cpanel_username, ok: false, error: msg })
      }
    }

    const ok    = results.filter(r => r.ok).length
    const fails = results.filter(r => !r.ok).length

    return NextResponse.json({
      success: true,
      syncedAt,
      synced: ok,
      failed: fails,
      results,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-hosting]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
