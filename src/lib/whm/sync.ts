import { createAdminWriteClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import { listAccountsFull } from '@/lib/whm/client'
import type { WHMConfig } from '@/lib/whm/client'

const WHM_CONFIG_NAME = '__whm_config__'

export interface SyncResult {
  total: number
  whmAccountsCreated: number
  whmAccountsUpdated: number
  clientsCreated: number
  clientsLinked: number
  servicesCreated: number
  servicesUpdated: number
  suspended: number
  active: number
  markedMissing: number
  errors: Array<{ username: string; error: string }>
  syncedAt: string
}

// ── Disk value parsing ────────────────────────────────────────────────────────

function parseDiskMb(val: string | number | undefined | null): number {
  if (!val) return 0
  const s = String(val).replace(/[,\s]/g, '')
  if (s.toLowerCase().startsWith('unlim') || s === '0') return 0
  const n = parseFloat(s)
  return isNaN(n) ? 0 : Math.round(n)
}

function parseDiskLimitMb(val: string | number | undefined | null): number | null {
  if (!val) return null
  const s = String(val).replace(/[,\s]/g, '')
  if (s.toLowerCase().startsWith('unlim') || s === '0') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : Math.round(n)
}

function isValidEmail(email: string): boolean {
  return (
    typeof email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    !email.includes('localhost') &&
    !email.toLowerCase().startsWith('root@')
  )
}

function provisionalName(domain: string, username: string): string {
  const base = domain.split('.')[0] || username
  return base.charAt(0).toUpperCase() + base.slice(1)
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncWhmAccounts(): Promise<SyncResult> {
  const db = createAdminWriteClient()
  const syncedAt = new Date().toISOString()
  const result: SyncResult = {
    total: 0,
    whmAccountsCreated: 0,
    whmAccountsUpdated: 0,
    clientsCreated: 0,
    clientsLinked: 0,
    servicesCreated: 0,
    servicesUpdated: 0,
    suspended: 0,
    active: 0,
    markedMissing: 0,
    errors: [],
    syncedAt,
  }

  // ── 1. Load WHM config ────────────────────────────────────────────────────
  const { data: serverRow } = await db
    .from('servers')
    .select('id, whm_url, whm_api_token, whm_username')
    .eq('name', WHM_CONFIG_NAME)
    .maybeSingle()

  if (!serverRow?.whm_url || !serverRow?.whm_api_token) {
    throw new Error('WHM não configurado. Configure primeiro em Configurações → WHM/cPanel API.')
  }

  const token = decryptSecret(serverRow.whm_api_token)
  if (!token) throw new Error('Falha ao desencriptar o token WHM.')

  const serverId: string = serverRow.id as string
  const config: WHMConfig = {
    url: serverRow.whm_url as string,
    token,
    username: (serverRow.whm_username as string) ?? 'root',
  }

  // ── 2. Load package mappings ──────────────────────────────────────────────
  const { data: mappingsRaw } = await db
    .from('whm_package_mappings')
    .select('whm_package_name, plan_id')
    .eq('server_id', serverId)

  const packageToplan = new Map<string, string | null>()
  for (const m of (mappingsRaw ?? []) as Array<{ whm_package_name: string; plan_id: string | null }>) {
    packageToplan.set(m.whm_package_name, m.plan_id)
  }

  // ── 3. Fetch accounts from WHM ────────────────────────────────────────────
  const accounts = await listAccountsFull(config)
  result.total = accounts.length

  if (accounts.length === 0) return result

  const syncedUsernames = new Set<string>()

  // ── 4. Process each account ───────────────────────────────────────────────
  for (const acct of accounts) {
    syncedUsernames.add(acct.user)
    if (acct.suspended) result.suspended++ ; else result.active++

    try {
      const diskUsed  = parseDiskMb(acct.diskused)
      const diskLimit = parseDiskLimitMb(acct.disklimit)
      const accountCreatedAt = acct.unix_startdate
        ? new Date(acct.unix_startdate * 1000).toISOString()
        : null

      // ── 4a. Upsert into whm_accounts ───────────────────────────────────
      const { data: existingWa } = await db
        .from('whm_accounts')
        .select('id, profile_id, service_id, hosting_account_id')
        .eq('server_id', serverId)
        .eq('whm_username', acct.user)
        .maybeSingle()

      const whmAccountPayload = {
        server_id:          serverId,
        whm_username:       acct.user,
        primary_domain:     acct.domain,
        contact_email:      acct.email || null,
        package_name:       acct.plan || null,
        ip_address:         acct.ip || null,
        owner:              acct.owner || null,
        partition:          acct.partition || null,
        disk_used_mb:       diskUsed,
        disk_limit_mb:      diskLimit,
        unix_startdate:     acct.unix_startdate || null,
        account_created_at: accountCreatedAt,
        is_suspended:       acct.suspended,
        suspension_reason:  acct.suspendreason || null,
        theme:              acct.theme || null,
        php_version:        acct.phpversion || null,
        max_pop:            acct.maxpop || null,
        max_sub:            acct.maxsub || null,
        max_sql:            acct.maxsql || null,
        max_ftp:            acct.maxftp || null,
        status:             acct.suspended ? 'suspended' : 'active',
        raw_metadata:       { user: acct.user, domain: acct.domain, plan: acct.plan, ip: acct.ip },
        last_synced_at:     syncedAt,
        updated_at:         syncedAt,
      }

      let whmAccountId: string

      if (existingWa) {
        await db.from('whm_accounts').update(whmAccountPayload).eq('id', existingWa.id)
        whmAccountId = existingWa.id as string
        result.whmAccountsUpdated++
      } else {
        const { data: inserted } = await db
          .from('whm_accounts')
          .insert({ ...whmAccountPayload, created_at: syncedAt })
          .select('id')
          .single()
        whmAccountId = (inserted as { id: string }).id
        result.whmAccountsCreated++
      }

      // ── 4b. Check if hosting_account already exists ─────────────────────
      const { data: existingHa } = await db
        .from('hosting_accounts')
        .select('id, profile_id, service_id')
        .eq('cpanel_username', acct.user)
        .maybeSingle()

      if (existingHa) {
        // Update data fields only — don't change ownership
        await db.from('hosting_accounts').update({
          disk_used_mb:      diskUsed,
          disk_limit_mb:     diskLimit,
          package_name:      acct.plan || null,
          ip_address:        acct.ip || null,
          suspension_reason: acct.suspendreason || null,
          status:            acct.suspended ? 'suspended' : 'active',
          last_synced_at:    syncedAt,
          updated_at:        syncedAt,
        }).eq('id', existingHa.id)

        // Keep whm_account linked to existing portal records
        await db.from('whm_accounts').update({
          profile_id:         existingHa.profile_id,
          service_id:         existingHa.service_id,
          hosting_account_id: existingHa.id,
        }).eq('id', whmAccountId)

        result.servicesUpdated++
        continue
      }

      // ── 4c. No hosting_account — find or create profile ─────────────────
      const email = acct.email

      let profileId: string | null = null

      if (isValidEmail(email)) {
        // Try to find existing profile by email
        const { data: existingProfile } = await db
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (existingProfile) {
          profileId = existingProfile.id as string
          result.clientsLinked++
        } else {
          // Auto-create auth user (no password — must use "forgot password" to log in)
          const { data: authData, error: authErr } = await db.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              full_name: provisionalName(acct.domain, acct.user),
              source: 'whm_sync',
            },
          })

          if (authErr || !authData?.user) {
            result.errors.push({
              username: acct.user,
              error: `Erro ao criar utilizador: ${authErr?.message ?? 'desconhecido'}`,
            })
            continue
          }

          const newUserId = authData.user.id
          const name = provisionalName(acct.domain, acct.user)

          // Create profile row
          await db.from('profiles').upsert({
            id:         newUserId,
            email,
            full_name:  name,
            role:       'client',
            is_active:  true,
            created_at: syncedAt,
            updated_at: syncedAt,
          }, { onConflict: 'id' })

          // Create client row
          await db.from('clients').upsert({
            profile_id: newUserId,
            notes:      'Importado via sincronização WHM',
            created_at: syncedAt,
            updated_at: syncedAt,
          }, { onConflict: 'profile_id' })

          profileId = newUserId
          result.clientsCreated++
        }
      }

      // Without a profile we still store the whm_account but can't create service/hosting
      if (!profileId) continue

      // ── 4d. Resolve plan_id from package mapping ─────────────────────────
      let planId: string | null = null
      if (acct.plan && packageToplan.has(acct.plan)) {
        planId = packageToplan.get(acct.plan) ?? null
      }

      // ── 4e. Create service record ─────────────────────────────────────────
      const serviceStatus = acct.suspended ? 'suspended' : 'active'
      const startedAt = accountCreatedAt ?? syncedAt

      const { data: newService } = await db
        .from('services')
        .insert({
          profile_id:    profileId,
          plan_id:       planId,
          server_id:     serverId,
          status:        serviceStatus,
          billing_cycle: 'monthly',
          price:         0,
          currency:      'AKZ',
          started_at:    startedAt,
          notes:         `Importado do WHM — pacote: ${acct.plan || 'desconhecido'}`,
          created_at:    syncedAt,
          updated_at:    syncedAt,
        })
        .select('id')
        .single()

      if (!newService) {
        result.errors.push({ username: acct.user, error: 'Falha ao criar serviço.' })
        continue
      }

      const serviceId = (newService as { id: string }).id

      // ── 4f. Create hosting_account record ────────────────────────────────
      const { data: newHa } = await db
        .from('hosting_accounts')
        .insert({
          service_id:        serviceId,
          profile_id:        profileId,
          server_id:         serverId,
          cpanel_username:   acct.user,
          primary_domain:    acct.domain,
          status:            serviceStatus,
          disk_used_mb:      diskUsed,
          disk_limit_mb:     diskLimit,
          bandwidth_used_mb: 0,
          email_count:       0,
          db_count:          0,
          php_version:       acct.phpversion || '8.2',
          ssl_enabled:       false,
          package_name:      acct.plan || null,
          ip_address:        acct.ip || null,
          last_synced_at:    syncedAt,
          created_at:        syncedAt,
          updated_at:        syncedAt,
        })
        .select('id')
        .single()

      if (!newHa) {
        result.errors.push({ username: acct.user, error: 'Falha ao criar conta de hospedagem.' })
        continue
      }

      const haId = (newHa as { id: string }).id

      // ── 4g. Link whm_account to portal records ────────────────────────────
      await db.from('whm_accounts').update({
        profile_id:         profileId,
        service_id:         serviceId,
        hosting_account_id: haId,
      }).eq('id', whmAccountId)

      result.servicesCreated++

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push({ username: acct.user, error: msg })
    }
  }

  // ── 5. Mark accounts no longer in WHM ─────────────────────────────────────
  if (syncedUsernames.size > 0) {
    const { data: allWhmAccounts } = await db
      .from('whm_accounts')
      .select('id, whm_username')
      .eq('server_id', serverId)
      .neq('status', 'missing_from_whm')

    for (const wa of (allWhmAccounts ?? []) as Array<{ id: string; whm_username: string }>) {
      if (!syncedUsernames.has(wa.whm_username)) {
        await db.from('whm_accounts').update({
          status:         'missing_from_whm',
          last_synced_at: syncedAt,
          updated_at:     syncedAt,
        }).eq('id', wa.id)
        result.markedMissing++
      }
    }
  }

  return result
}
