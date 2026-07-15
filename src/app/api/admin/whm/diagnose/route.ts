import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    await requireAdminRole()
    const db = createAdminWriteClient()

    const [
      whmAccounts,
      whmMappings,
      hostingAccounts,
      services,
      profiles,
      clients,
    ] = await Promise.all([
      db.from('whm_accounts').select('id', { count: 'exact', head: true }),
      db.from('whm_package_mappings').select('id', { count: 'exact', head: true }),
      db.from('hosting_accounts').select('id', { count: 'exact', head: true }),
      db.from('services').select('id', { count: 'exact', head: true }),
      db.from('profiles').select('id', { count: 'exact', head: true }),
      db.from('clients').select('id', { count: 'exact', head: true }),
    ])

    // Check new columns exist
    const { error: syncStatusErr } = await db
      .from('whm_accounts')
      .select('sync_status, requires_manual_link, link_status')
      .limit(1)

    const { error: haExtErr } = await db
      .from('hosting_accounts')
      .select('disk_limit_mb, package_name, ip_address, last_synced_at')
      .limit(1)

    const { error: servNullableErr } = await db
      .from('services')
      .select('plan_id')
      .is('plan_id', null)
      .limit(1)

    // Sample whm_accounts rows for debug
    const { data: sample } = await db
      .from('whm_accounts')
      .select('id, whm_username, primary_domain, status, sync_status, last_synced_at')
      .limit(5)

    const counts = {
      whm_accounts:         { count: whmAccounts.count ?? 0,    error: whmAccounts.error?.message },
      whm_package_mappings: { count: whmMappings.count ?? 0,    error: whmMappings.error?.message },
      hosting_accounts:     { count: hostingAccounts.count ?? 0, error: hostingAccounts.error?.message },
      services:             { count: services.count ?? 0,        error: services.error?.message },
      profiles:             { count: profiles.count ?? 0,        error: profiles.error?.message },
      clients:              { count: clients.count ?? 0,         error: clients.error?.message },
    }

    const columns = {
      whm_accounts_sync_status:  { ok: !syncStatusErr, error: syncStatusErr?.message },
      hosting_accounts_extended: { ok: !haExtErr,      error: haExtErr?.message },
      services_nullable_plan_id: { ok: !servNullableErr, error: servNullableErr?.message },
    }

    const issues: string[] = []
    if (whmAccounts.error) issues.push('Tabela whm_accounts não existe ou inacessível.')
    if (whmMappings.error) issues.push('Tabela whm_package_mappings não existe.')
    if (syncStatusErr)     issues.push('Colunas sync_status/requires_manual_link/link_status não existem em whm_accounts (migração 2 não aplicada).')
    if (haExtErr)          issues.push('Colunas disk_limit_mb/package_name/ip_address não existem em hosting_accounts (migração 1 não aplicada).')
    if ((whmAccounts.count ?? 0) === 0 && (hostingAccounts.count ?? 0) > 0) {
      issues.push('hosting_accounts tem dados mas whm_accounts está vazia — sync gravou em hosting_accounts mas falhou em whm_accounts.')
    }

    return NextResponse.json({
      counts,
      columns,
      issues,
      sample: sample ?? [],
      migrationNeeded: issues.length > 0,
      diagnosis: issues.length === 0
        ? 'Todas as tabelas e colunas estão corretas.'
        : `${issues.length} problema(s) encontrado(s). Aplique as migrações WHM.`,
    })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: 500 })
  }
}
