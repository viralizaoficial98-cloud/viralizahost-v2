import { createAdminWriteClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/crypto'
import { listAccountsFull } from '@/lib/whm/client'
import type { WHMConfig } from '@/lib/whm/client'

const WHM_CONFIG_NAME = '__whm_config__'

export interface SyncResult {
  total: number
  imported: number
  whmAccountsCreated: number
  whmAccountsUpdated: number
  clientsCreated: number
  clientsLinked: number
  servicesCreated: number
  servicesUpdated: number
  pending: number
  suspended: number
  active: number
  markedMissing: number
  errors: Array<{ username: string; error: string }>
  syncedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/** Returns a normalized, valid email or null. Never returns 'unknown', 'null', etc. */
function normalizeWhmEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const email = value.trim().toLowerCase()

  if (
    !email ||
    email === 'unknown' ||
    email === 'null' ||
    email === 'undefined' ||
    email.startsWith('root@') ||
    email.includes('localhost')
  ) {
    return null
  }

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return isValid ? email : null
}

function provisionalName(domain: string, username: string): string {
  const base = domain.split('.')[0] || username
  return base.charAt(0).toUpperCase() + base.slice(1)
}

// ── Main sync ─────────────────────────────────────────────────────────────────

export async function syncWhmAccounts(): Promise<SyncResult> {
  const db = createAdminWriteClient()
  const syncedAt = new Date().toISOString()

  const result: SyncResult = {
    total: 0,
    imported: 0,
    whmAccountsCreated: 0,
    whmAccountsUpdated: 0,
    clientsCreated: 0,
    clientsLinked: 0,
    servicesCreated: 0,
    servicesUpdated: 0,
    pending: 0,
    suspended: 0,
    active: 0,
    markedMissing: 0,
    errors: [],
    syncedAt,
  }

  // ── 1. Load WHM config ────────────────────────────────────────────────────
  console.log('[sync] loading WHM config…')
  const { data: serverRow, error: serverErr } = await db
    .from('servers')
    .select('id, whm_url, whm_api_token, whm_username')
    .eq('name', WHM_CONFIG_NAME)
    .maybeSingle()

  if (serverErr) throw new Error(`[servers lookup] ${serverErr.message}`)
  if (!serverRow) throw new Error('WHM não configurado. Configure em Configurações → WHM/cPanel API.')

  const sr = serverRow as {
    id: string
    whm_url: string | null
    whm_api_token: string | null
    whm_username: string | null
  }

  if (!sr.whm_url || !sr.whm_api_token) {
    throw new Error('WHM URL ou token em falta. Configure em Configurações → WHM/cPanel API.')
  }

  const token = decryptSecret(sr.whm_api_token)
  if (!token) throw new Error('Falha ao desencriptar o token WHM. Verifique WHM_ENCRYPTION_KEY.')

  const serverId = sr.id
  const config: WHMConfig = {
    url:      sr.whm_url,
    token,
    username: sr.whm_username ?? 'root',
  }
  console.log('[sync] WHM config OK — server id:', serverId)

  // ── 2. Load package mappings ──────────────────────────────────────────────
  const { data: mappingsRaw } = await db
    .from('whm_package_mappings')
    .select('whm_package_name, plan_id')
    .eq('server_id', serverId)

  const packageToPlan = new Map<string, string>()
  for (const m of (mappingsRaw ?? []) as Array<{ whm_package_name: string; plan_id: string | null }>) {
    if (m.plan_id) packageToPlan.set(m.whm_package_name, m.plan_id)
  }
  console.log('[sync] package mappings loaded:', packageToPlan.size)

  // ── 3. Load fallback plan ─────────────────────────────────────────────────
  const { data: fallbackPlanRow } = await db
    .from('plans')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  const fallbackPlanId: string | null = fallbackPlanRow
    ? (fallbackPlanRow as { id: string }).id
    : null
  console.log('[sync] fallback plan:', fallbackPlanId ? (fallbackPlanRow as { name: string }).name : 'none')

  // ── 4. Fetch WHM accounts ─────────────────────────────────────────────────
  console.log('[sync] fetching WHM accounts…')
  const accounts = await listAccountsFull(config)
  result.total = accounts.length
  console.log('[sync] accounts received from WHM:', accounts.length)

  if (accounts.length === 0) return result

  const syncedUsernames = new Set<string>()

  // ── 5. Process each account ───────────────────────────────────────────────
  for (const acct of accounts) {
    syncedUsernames.add(acct.user)
    if (acct.suspended) result.suspended++
    else result.active++

    const email = normalizeWhmEmail(acct.email)
    console.log(`[sync][${acct.user}] domain:${acct.domain} email_raw:"${acct.email}" email_normalized:${email ?? 'null'} plan:${acct.plan}`)

    try {
      const diskUsed  = parseDiskMb(acct.diskused)
      const diskLimit = parseDiskLimitMb(acct.disklimit)
      const accountCreatedAt = acct.unix_startdate
        ? new Date(acct.unix_startdate * 1000).toISOString()
        : null

      const hasPendingEmail = !email

      // ── STEP A: Upsert whm_accounts (non-fatal if table doesn't exist yet) ──
      let whmAccountId: string | null = null
      try {
        const whmPayload = {
          server_id:            serverId,
          whm_username:         acct.user,
          primary_domain:       acct.domain,
          contact_email:        email,
          package_name:         acct.plan || null,
          ip_address:           acct.ip || null,
          owner:                acct.owner || null,
          partition:            acct.partition || null,
          disk_used_mb:         diskUsed,
          disk_limit_mb:        diskLimit,
          unix_startdate:       acct.unix_startdate || null,
          account_created_at:   accountCreatedAt,
          is_suspended:         acct.suspended,
          suspension_reason:    acct.suspendreason || null,
          theme:                acct.theme || null,
          php_version:          acct.phpversion || null,
          max_pop:              acct.maxpop || null,
          max_sub:              acct.maxsub || null,
          max_sql:              acct.maxsql || null,
          max_ftp:              acct.maxftp || null,
          status:               acct.suspended ? 'suspended' : 'active',
          sync_status:          hasPendingEmail ? 'pending_email' : 'linked',
          requires_manual_link: hasPendingEmail,
          link_status:          hasPendingEmail ? 'unlinked' : 'linked',
          notes:                hasPendingEmail
            ? 'Conta importada do WHM aguardando associação manual porque não possui e-mail válido.'
            : null,
          raw_metadata:         { user: acct.user, domain: acct.domain, plan: acct.plan, ip: acct.ip },
          last_synced_at:       syncedAt,
          updated_at:           syncedAt,
        }

        const { data: whmAcct, error: whmErr } = await db
          .from('whm_accounts')
          .upsert(whmPayload, { onConflict: 'server_id,whm_username' })
          .select('id')
          .single()

        if (whmErr) {
          console.warn(`[sync][${acct.user}] whm_accounts upsert: ${whmErr.message}`)
        } else if (whmAcct) {
          whmAccountId = (whmAcct as { id: string }).id
          console.log(`[sync][${acct.user}] whm_account id: ${whmAccountId}`)
        }
      } catch (whmEx) {
        console.warn(`[sync][${acct.user}] whm_accounts exception: ${String(whmEx)}`)
      }

      result.imported++

      // ── No valid email → mark pending and skip client/service creation ────
      if (hasPendingEmail) {
        console.log(`[sync][${acct.user}] no valid email (raw: "${acct.email}") — marked as pending_email, skipping client/service creation`)
        result.pending++
        continue
      }

      // ── STEP B: Check if hosting_account already exists ───────────────────
      console.log(`[sync][${acct.user}] checking hosting_accounts…`)
      const { data: existingHa, error: existingHaErr } = await db
        .from('hosting_accounts')
        .select('id, profile_id, service_id')
        .eq('cpanel_username', acct.user)
        .maybeSingle()

      if (existingHaErr) {
        throw new Error(`[hosting_accounts lookup] ${existingHaErr.message}`)
      }

      if (existingHa) {
        const ha = existingHa as { id: string; profile_id: string; service_id: string }
        console.log(`[sync][${acct.user}] hosting_account EXISTS id=${ha.id} — updating`)

        const { error: haUpdateErr } = await db
          .from('hosting_accounts')
          .update({ disk_used_mb: diskUsed, status: acct.suspended ? 'suspended' : 'active', updated_at: syncedAt })
          .eq('id', ha.id)

        if (haUpdateErr) {
          console.warn(`[sync][${acct.user}] hosting_accounts base update: ${haUpdateErr.message}`)
        }

        const { error: haExtErr } = await db.from('hosting_accounts').update({
          disk_limit_mb:     diskLimit,
          package_name:      acct.plan || null,
          ip_address:        acct.ip || null,
          suspension_reason: acct.suspendreason || null,
          last_synced_at:    syncedAt,
        }).eq('id', ha.id)

        if (haExtErr) {
          console.warn(`[sync][${acct.user}] hosting_accounts extended update: ${haExtErr.message}`)
        }

        if (whmAccountId) {
          const { error: linkErr } = await db.from('whm_accounts').update({
            profile_id:         ha.profile_id,
            service_id:         ha.service_id,
            hosting_account_id: ha.id,
            sync_status:        'linked',
            link_status:        'linked',
            requires_manual_link: false,
          }).eq('id', whmAccountId)
          if (linkErr) console.warn(`[sync][${acct.user}] whm_account link: ${linkErr.message}`)
        }

        result.servicesUpdated++
        continue
      }

      console.log(`[sync][${acct.user}] no hosting_account found — will create`)

      // ── STEP C: Find or create profile ────────────────────────────────────
      let profileId: string | null = null

      console.log(`[sync][${acct.user}] looking up profile by email: ${email}`)
      const { data: existingProfile, error: profileLookupErr } = await db
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (profileLookupErr) {
        throw new Error(`[profiles lookup] ${profileLookupErr.message}`)
      }

      if (existingProfile) {
        profileId = (existingProfile as { id: string }).id
        console.log(`[sync][${acct.user}] profile found: ${profileId}`)
        result.clientsLinked++
      } else {
        console.log(`[sync][${acct.user}] creating auth user for ${email}…`)
        const { data: authData, error: authErr } = await db.auth.admin.createUser({
          email,
          email_confirm:  true,
          user_metadata: {
            full_name: provisionalName(acct.domain, acct.user),
            source:    'whm_sync',
          },
        })

        if (authErr) throw new Error(`[auth.createUser] ${authErr.message}`)
        if (!authData?.user) throw new Error('[auth.createUser] createUser returned no user object')

        const newUserId = authData.user.id
        console.log(`[sync][${acct.user}] auth user created: ${newUserId}`)

        const { data: profileRow, error: profileErr } = await db
          .from('profiles')
          .upsert({
            id:         newUserId,
            email,
            full_name:  provisionalName(acct.domain, acct.user),
            role:       'client',
            is_active:  true,
            created_at: syncedAt,
            updated_at: syncedAt,
          }, { onConflict: 'id' })
          .select('id')
          .single()

        if (profileErr) throw new Error(`[profiles upsert] ${profileErr.message}`)
        if (!profileRow) throw new Error('[profiles upsert] upsert returned null data')

        profileId = (profileRow as { id: string }).id
        console.log(`[sync][${acct.user}] profile created: ${profileId}`)

        const { error: clientErr } = await db.from('clients').upsert({
          profile_id: newUserId,
          notes:      'Importado via sincronização WHM',
          created_at: syncedAt,
          updated_at: syncedAt,
        }, { onConflict: 'profile_id' })

        if (clientErr) {
          console.warn(`[sync][${acct.user}] clients upsert: ${clientErr.message}`)
        }

        result.clientsCreated++
      }

      if (!profileId) {
        throw new Error('[profile] profileId is null after lookup/creation')
      }

      // ── STEP D: Resolve plan_id ───────────────────────────────────────────
      const mappedPlanId = packageToPlan.get(acct.plan ?? '') ?? null
      const planId: string | null = mappedPlanId ?? fallbackPlanId
      console.log(`[sync][${acct.user}] planId: ${planId} (mapped:${mappedPlanId} fallback:${fallbackPlanId})`)

      // ── STEP E: Create service ────────────────────────────────────────────
      console.log(`[sync][${acct.user}] creating service…`)
      const { data: newService, error: svcErr } = await db
        .from('services')
        .insert({
          profile_id:    profileId,
          plan_id:       planId,
          server_id:     serverId,
          status:        acct.suspended ? 'suspended' : 'active',
          billing_cycle: 'monthly',
          price:         0,
          currency:      'AKZ',
          started_at:    accountCreatedAt ?? syncedAt,
          notes:         `WHM sync — pacote: ${acct.plan || 'desconhecido'}`,
          created_at:    syncedAt,
          updated_at:    syncedAt,
        })
        .select('id')
        .single()

      if (svcErr) throw new Error(`[services insert] ${svcErr.message}`)
      if (!newService) throw new Error('[services insert] insert returned null data')

      const serviceId = (newService as { id: string }).id
      console.log(`[sync][${acct.user}] service created: ${serviceId}`)

      // ── STEP F: Create hosting_account ────────────────────────────────────
      console.log(`[sync][${acct.user}] creating hosting_account…`)
      const { data: newHa, error: haInsertErr } = await db
        .from('hosting_accounts')
        .insert({
          service_id:        serviceId,
          profile_id:        profileId,
          server_id:         serverId,
          cpanel_username:   acct.user,
          primary_domain:    acct.domain,
          status:            acct.suspended ? 'suspended' : 'active',
          disk_used_mb:      diskUsed,
          bandwidth_used_mb: 0,
          email_count:       0,
          db_count:          0,
          php_version:       acct.phpversion || '8.2',
          ssl_enabled:       false,
        })
        .select('id')
        .single()

      if (haInsertErr) throw new Error(`[hosting_accounts insert] ${haInsertErr.message}`)
      if (!newHa) throw new Error('[hosting_accounts insert] insert returned null data')

      const haId = (newHa as { id: string }).id
      console.log(`[sync][${acct.user}] hosting_account created: ${haId}`)

      const { error: haExtErr2 } = await db.from('hosting_accounts').update({
        disk_limit_mb:  diskLimit,
        package_name:   acct.plan || null,
        ip_address:     acct.ip || null,
        last_synced_at: syncedAt,
      }).eq('id', haId)

      if (haExtErr2) {
        console.warn(`[sync][${acct.user}] hosting_accounts extended cols: ${haExtErr2.message}`)
      }

      // ── STEP G: Link whm_account ──────────────────────────────────────────
      if (whmAccountId) {
        const { error: linkErr } = await db.from('whm_accounts').update({
          profile_id:           profileId,
          service_id:           serviceId,
          hosting_account_id:   haId,
          sync_status:          'linked',
          link_status:          'linked',
          requires_manual_link: false,
        }).eq('id', whmAccountId)
        if (linkErr) console.warn(`[sync][${acct.user}] whm_account final link: ${linkErr.message}`)
      }

      result.servicesCreated++
      console.log(`[sync][${acct.user}] ✓ done`)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[sync][${acct.user}] ✗ FAILED: ${msg}`)
      result.errors.push({ username: acct.user, error: msg })
    }
  }

  // ── 6. Mark accounts no longer in WHM ─────────────────────────────────────
  try {
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
  } catch (ex) {
    console.warn('[sync] mark-missing step failed (non-fatal):', String(ex))
  }

  console.log('[sync] complete:', JSON.stringify({
    total:           result.total,
    imported:        result.imported,
    clientsCreated:  result.clientsCreated,
    clientsLinked:   result.clientsLinked,
    servicesCreated: result.servicesCreated,
    servicesUpdated: result.servicesUpdated,
    pending:         result.pending,
    errors:          result.errors.length,
  }))

  return result
}
