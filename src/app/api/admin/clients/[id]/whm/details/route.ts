import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'
import { loadWhmConfig } from '@/lib/whm/config'
import {
  getAccount,
  listCpanelEmails,
  listCpanelDomains,
  listCpanelDatabases,
  listCpanelFtpAccounts,
  getCpanelSslInfo,
  countCpanelCrons,
} from '@/lib/whm/client'

export const dynamic   = 'force-dynamic'
export const revalidate = 0

// GET /api/admin/clients/[id]/whm/details
// Fetches live WHM/cPanel data for a specific client and updates the DB with fresh counts.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  const syncStart = Date.now()

  try { await requireAdminRole() } catch (e: unknown) {
    const err = e as { status?: number; message?: string }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 })
  }

  const db = createAdminWriteClient()

  // Load hosting account to get username
  const [{ data: ha }, { data: wa }] = await Promise.all([
    db.from('hosting_accounts').select('id, cpanel_username, primary_domain, disk_used_mb, disk_limit_mb, package_name, ip_address, php_version, email_count, last_synced_at').eq('profile_id', profileId).maybeSingle(),
    db.from('whm_accounts').select('id, whm_username, primary_domain, package_name, ip_address, php_version, is_suspended, last_synced_at').eq('profile_id', profileId).maybeSingle(),
  ])

  const username   = (ha as any)?.cpanel_username ?? (wa as any)?.whm_username
  const mainDomain = (ha as any)?.primary_domain  ?? (wa as any)?.primary_domain

  if (!username) {
    return NextResponse.json({ error: 'Conta WHM/cPanel não encontrada para este cliente.' }, { status: 404 })
  }

  const whmCfg = await loadWhmConfig()
  if (!whmCfg) {
    return NextResponse.json({ error: 'WHM não configurado.' }, { status: 503 })
  }

  const cfg = whmCfg.config
  const domain = mainDomain ?? username

  console.log(`[WHM DETAILS][${username}] starting live fetch for profile=${profileId}`)

  // Fetch all data from WHM in parallel
  const [
    accountResult,
    emailsResult,
    domainsResult,
    databasesResult,
    ftpResult,
    sslResult,
    cronResult,
  ] = await Promise.allSettled([
    getAccount(cfg, username),
    listCpanelEmails(cfg, username, domain),
    listCpanelDomains(cfg, username, domain),
    listCpanelDatabases(cfg, username),
    listCpanelFtpAccounts(cfg, username),
    getCpanelSslInfo(cfg, username, domain),
    countCpanelCrons(cfg, username),
  ])

  const account   = accountResult.status   === 'fulfilled' ? accountResult.value   : null
  const emails    = emailsResult.status    === 'fulfilled' ? emailsResult.value    : []
  const domains   = domainsResult.status   === 'fulfilled' ? domainsResult.value   : []
  const databases = databasesResult.status === 'fulfilled' ? databasesResult.value : []
  const ftpList   = ftpResult.status       === 'fulfilled' ? ftpResult.value       : []
  const ssl       = sslResult.status       === 'fulfilled' ? sslResult.value       : null
  const cronCount = cronResult.status      === 'fulfilled' ? cronResult.value       : 0

  const syncErrors: Record<string, string> = {}
  if (accountResult.status   === 'rejected') syncErrors.account   = String(accountResult.reason)
  if (emailsResult.status    === 'rejected') syncErrors.emails    = String(emailsResult.reason)
  if (domainsResult.status   === 'rejected') syncErrors.domains   = String(domainsResult.reason)
  if (databasesResult.status === 'rejected') syncErrors.databases = String(databasesResult.reason)
  if (ftpResult.status       === 'rejected') syncErrors.ftp       = String(ftpResult.reason)
  if (sslResult.status       === 'rejected') syncErrors.ssl       = String(sslResult.reason)
  if (cronResult.status      === 'rejected') syncErrors.crons     = String(cronResult.reason)

  const emailCount = emails.length
  const dbCount    = databases.length
  const domainCount = domains.filter(d => d.type !== 'main').length
  const now = new Date().toISOString()

  console.log(`[WHM DETAILS][${username}] emails=${emailCount} domains=${domains.length} dbs=${dbCount} ftp=${ftpList.length} crons=${cronCount} elapsed=${Date.now() - syncStart}ms`)

  // Update hosting_accounts with fresh counts
  if ((ha as any)?.id) {
    const updates: Record<string, unknown> = {
      email_count:    emailCount,
      db_count:       dbCount,
      last_synced_at: now,
      updated_at:     now,
    }
    if (account) {
      const used  = account.diskused  ? parseInt(account.diskused)  : (ha as any).disk_used_mb
      const limit = account.disklimit && !String(account.disklimit).toLowerCase().startsWith('unlim')
        ? parseInt(account.disklimit) : (ha as any).disk_limit_mb
      updates.disk_used_mb  = used
      updates.disk_limit_mb = limit
      updates.package_name  = account.plan    || (ha as any).package_name
      updates.ip_address    = account.ip      || (ha as any).ip_address
      updates.php_version   = account.phpversion || (ha as any).php_version
      updates.status        = account.suspended ? 'suspended' : 'active'
    }
    await db.from('hosting_accounts').update(updates).eq('id', (ha as any).id)
  }

  // Update whm_accounts with fresh disk usage if available
  if ((wa as any)?.id && account) {
    await db.from('whm_accounts').update({
      disk_used_mb:   account.diskused  ? parseInt(account.diskused)  : undefined,
      package_name:   account.plan      || undefined,
      ip_address:     account.ip        || undefined,
      is_suspended:   account.suspended,
      last_synced_at: now,
      updated_at:     now,
    }).eq('id', (wa as any).id)
  }

  const elapsed = Date.now() - syncStart

  return NextResponse.json({
    username,
    domain,
    synced_at: now,
    elapsed_ms: elapsed,
    account,
    emails,
    domains,
    databases,
    ftp: ftpList,
    ssl,
    cron_count: cronCount,
    counts: {
      emails:   emailCount,
      domains:  domainCount,
      databases: dbCount,
      ftp:      ftpList.length,
      crons:    cronCount,
    },
    errors: Object.keys(syncErrors).length > 0 ? syncErrors : null,
  })
}
