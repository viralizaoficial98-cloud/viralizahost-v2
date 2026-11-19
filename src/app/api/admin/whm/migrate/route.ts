import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

// All WHM-related DDL — idempotent (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

export async function POST() {
  // Antes: executava WHM_MIGRATION_SQL no Supabase (Management API).
  // Em MariaDB as tabelas vêm de database/mariadb/schema.sql — aqui só se verifica.
  try {
    await requireAdminRole()
    const db = createAdminWriteClient()
    const checks = await Promise.all([
      db.from('whm_accounts').select('id', { count: 'exact', head: true }),
      db.from('whm_package_mappings').select('id', { count: 'exact', head: true }),
      db.from('sso_audit_logs').select('id', { count: 'exact', head: true }),
    ])
    const verified = checks.every(c => !c.error)
    return NextResponse.json({
      success: verified,
      verified,
      ...(verified ? {} : { error: 'Tabelas WHM em falta: importe database/mariadb/schema.sql no phpMyAdmin.' }),
      tables: {
        whm_accounts:         { ok: !checks[0].error, count: checks[0].count ?? 0, error: checks[0].error?.message },
        whm_package_mappings: { ok: !checks[1].error, count: checks[1].count ?? 0, error: checks[1].error?.message },
        sso_audit_logs:       { ok: !checks[2].error, count: checks[2].count ?? 0, error: checks[2].error?.message },
      },
    }, { status: verified ? 200 : 500 })
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: e.status ?? 500 })
  }
}

// GET: check migration status (do tables exist?)
export async function GET() {
  try {
    await requireAdminRole()
    const db = createAdminWriteClient()

    const checks = await Promise.all([
      db.from('whm_accounts').select('id', { count: 'exact', head: true }),
      db.from('whm_package_mappings').select('id', { count: 'exact', head: true }),
      db.from('sso_audit_logs').select('id', { count: 'exact', head: true }),
      db.from('hosting_accounts').select('disk_limit_mb', { head: true }),
    ])

    // Also verify sync_status column by trying to select it
    const { error: syncStatusErr } = await db
      .from('whm_accounts')
      .select('sync_status')
      .limit(1)

    const tables = {
      whm_accounts:         { exists: !checks[0].error, count: checks[0].count ?? 0 },
      whm_package_mappings: { exists: !checks[1].error, count: checks[1].count ?? 0 },
      sso_audit_logs:       { exists: !checks[2].error, count: checks[2].count ?? 0 },
      hosting_accounts_extended: { exists: !checks[3].error },
      whm_accounts_sync_status:  { exists: !syncStatusErr },
    }

    const migrationNeeded = !tables.whm_accounts.exists ||
      !tables.whm_package_mappings.exists ||
      !tables.whm_accounts_sync_status.exists

    return NextResponse.json({ tables, migrationNeeded })
  } catch (err: unknown) {
    const e = err as { message?: string }
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: 500 })
  }
}
