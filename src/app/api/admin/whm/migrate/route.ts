import { NextResponse } from 'next/server'
import { requireAdminRole } from '@/lib/api/require-admin'
import { createAdminWriteClient } from '@/lib/supabase/server'

// All WHM-related DDL — idempotent (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
const WHM_MIGRATION_SQL = `
-- ── hosting_accounts: extend with WHM fields ─────────────────────────────────
ALTER TABLE viralizahost.hosting_accounts
  ADD COLUMN IF NOT EXISTS disk_limit_mb     INTEGER,
  ADD COLUMN IF NOT EXISTS package_name      TEXT,
  ADD COLUMN IF NOT EXISTS ip_address        TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cpanel_url        TEXT;

-- ── services: allow null plan_id for WHM-imported services ───────────────────
ALTER TABLE viralizahost.services
  ALTER COLUMN plan_id DROP NOT NULL;

-- ── whm_accounts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS viralizahost.whm_accounts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id          UUID NOT NULL REFERENCES viralizahost.servers(id) ON DELETE CASCADE,

  whm_username       TEXT NOT NULL,
  primary_domain     TEXT NOT NULL,
  contact_email      TEXT,
  package_name       TEXT,
  ip_address         TEXT,
  owner              TEXT,
  partition          TEXT,
  disk_used_mb       INTEGER NOT NULL DEFAULT 0,
  disk_limit_mb      INTEGER,
  unix_startdate     BIGINT,
  account_created_at TIMESTAMPTZ,
  is_suspended       BOOLEAN NOT NULL DEFAULT false,
  suspension_reason  TEXT,
  theme              TEXT,
  php_version        TEXT,
  max_pop            TEXT,
  max_sub            TEXT,
  max_sql            TEXT,
  max_ftp            TEXT,

  profile_id         UUID REFERENCES viralizahost.profiles(id)         ON DELETE SET NULL,
  service_id         UUID REFERENCES viralizahost.services(id)         ON DELETE SET NULL,
  hosting_account_id UUID REFERENCES viralizahost.hosting_accounts(id) ON DELETE SET NULL,

  raw_metadata   JSONB,
  status         TEXT NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(server_id, whm_username),
  UNIQUE(server_id, primary_domain)
);

-- ── whm_accounts: pending_email columns (migration 2) ─────────────────────
ALTER TABLE viralizahost.whm_accounts
  ADD COLUMN IF NOT EXISTS sync_status          TEXT    NOT NULL DEFAULT 'linked',
  ADD COLUMN IF NOT EXISTS requires_manual_link BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_status          TEXT    NOT NULL DEFAULT 'linked',
  ADD COLUMN IF NOT EXISTS notes                TEXT;

-- ── whm_package_mappings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS viralizahost.whm_package_mappings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id        UUID REFERENCES viralizahost.servers(id) ON DELETE CASCADE,
  whm_package_name TEXT NOT NULL,
  plan_id          UUID REFERENCES viralizahost.plans(id)   ON DELETE SET NULL,
  label            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(server_id, whm_package_name)
);

-- ── sso_audit_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS viralizahost.sso_audit_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id         UUID NOT NULL REFERENCES viralizahost.profiles(id)         ON DELETE CASCADE,
  service_id         UUID          REFERENCES viralizahost.services(id)          ON DELETE SET NULL,
  hosting_account_id UUID          REFERENCES viralizahost.hosting_accounts(id)  ON DELETE SET NULL,
  access_type        TEXT NOT NULL,
  ip_address         TEXT,
  user_agent         TEXT,
  success            BOOLEAN NOT NULL DEFAULT false,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_whm_accounts_server      ON viralizahost.whm_accounts(server_id);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_profile     ON viralizahost.whm_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_email       ON viralizahost.whm_accounts(contact_email);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_status      ON viralizahost.whm_accounts(status);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_sync_status ON viralizahost.whm_accounts(sync_status);
CREATE INDEX IF NOT EXISTS idx_whm_mappings_server      ON viralizahost.whm_package_mappings(server_id);
CREATE INDEX IF NOT EXISTS idx_sso_audit_profile        ON viralizahost.sso_audit_logs(profile_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE viralizahost.whm_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.whm_package_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.sso_audit_logs        ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- whm_accounts
  DROP POLICY IF EXISTS "whm_accounts_admin_all" ON viralizahost.whm_accounts;
  CREATE POLICY "whm_accounts_admin_all" ON viralizahost.whm_accounts
    USING (EXISTS(SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin'));

  -- whm_package_mappings
  DROP POLICY IF EXISTS "whm_mappings_admin_all" ON viralizahost.whm_package_mappings;
  CREATE POLICY "whm_mappings_admin_all" ON viralizahost.whm_package_mappings
    USING (EXISTS(SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin'));

  -- sso_audit_logs
  DROP POLICY IF EXISTS "sso_audit_select_own" ON viralizahost.sso_audit_logs;
  CREATE POLICY "sso_audit_select_own" ON viralizahost.sso_audit_logs
    FOR SELECT USING (profile_id = auth.uid());

  DROP POLICY IF EXISTS "sso_audit_admin_all" ON viralizahost.sso_audit_logs;
  CREATE POLICY "sso_audit_admin_all" ON viralizahost.sso_audit_logs
    USING (EXISTS(SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT ALL ON viralizahost.whm_accounts         TO authenticated, service_role;
GRANT ALL ON viralizahost.whm_package_mappings TO authenticated, service_role;
GRANT ALL ON viralizahost.sso_audit_logs        TO authenticated, service_role;
`

export async function POST() {
  try {
    await requireAdminRole()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Supabase env vars not set.' }, { status: 500 })
    }

    const projectRef = supabaseUrl.replace('https://', '').split('.')[0]

    // Execute via Supabase Management API
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ query: WHM_MIGRATION_SQL }),
      }
    )

    if (!res.ok) {
      const text = await res.text()
      // Fallback: try via RPC if Management API unavailable
      console.warn('[whm/migrate] Management API failed:', res.status, text)

      // Try line-by-line via rpc (limited)
      return NextResponse.json({
        success: false,
        error: `Management API returned ${res.status}. Execute a migração manualmente no Supabase SQL Editor.`,
        sql: WHM_MIGRATION_SQL,
        managementApiError: text,
      }, { status: 500 })
    }

    // Verify tables now exist
    const db = createAdminWriteClient()
    const checks = await Promise.all([
      db.from('whm_accounts').select('id', { count: 'exact', head: true }),
      db.from('whm_package_mappings').select('id', { count: 'exact', head: true }),
      db.from('sso_audit_logs').select('id', { count: 'exact', head: true }),
    ])

    const verified = checks.every(c => !c.error)

    return NextResponse.json({
      success: true,
      verified,
      tables: {
        whm_accounts:         { ok: !checks[0].error, count: checks[0].count ?? 0, error: checks[0].error?.message },
        whm_package_mappings: { ok: !checks[1].error, count: checks[1].count ?? 0, error: checks[1].error?.message },
        sso_audit_logs:       { ok: !checks[2].error, count: checks[2].count ?? 0, error: checks[2].error?.message },
      },
    })
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
