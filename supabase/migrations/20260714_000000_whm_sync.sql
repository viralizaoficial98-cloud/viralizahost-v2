-- ============================================================
-- WHM Sync infrastructure
-- Tables: whm_accounts, whm_package_mappings, sso_audit_logs
-- Extends: hosting_accounts, services
-- ============================================================

-- ── Extend hosting_accounts with WHM-sync fields ─────────────────────────────
ALTER TABLE viralizahost.hosting_accounts
  ADD COLUMN IF NOT EXISTS disk_limit_mb     INTEGER,
  ADD COLUMN IF NOT EXISTS package_name      TEXT,
  ADD COLUMN IF NOT EXISTS ip_address        TEXT,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cpanel_url        TEXT;

-- Allow services imported from WHM without a matched plan
ALTER TABLE viralizahost.services
  ALTER COLUMN plan_id DROP NOT NULL;

-- ── WHM account cache ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS viralizahost.whm_accounts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id          UUID NOT NULL REFERENCES viralizahost.servers(id) ON DELETE CASCADE,

  -- WHM data
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

  -- Portal links (nullable — populated after matching/creating)
  profile_id         UUID REFERENCES viralizahost.profiles(id)         ON DELETE SET NULL,
  service_id         UUID REFERENCES viralizahost.services(id)         ON DELETE SET NULL,
  hosting_account_id UUID REFERENCES viralizahost.hosting_accounts(id) ON DELETE SET NULL,

  -- Sync metadata
  raw_metadata   JSONB,
  status         TEXT NOT NULL DEFAULT 'active',  -- active | suspended | missing_from_whm
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(server_id, whm_username),
  UNIQUE(server_id, primary_domain)
);

-- ── WHM package → plan mapping ────────────────────────────────────────────────
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

-- ── SSO audit log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS viralizahost.sso_audit_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id         UUID NOT NULL REFERENCES viralizahost.profiles(id)         ON DELETE CASCADE,
  service_id         UUID          REFERENCES viralizahost.services(id)          ON DELETE SET NULL,
  hosting_account_id UUID          REFERENCES viralizahost.hosting_accounts(id)  ON DELETE SET NULL,
  access_type        TEXT NOT NULL,  -- 'cpanel' | 'webmail'
  ip_address         TEXT,
  user_agent         TEXT,
  success            BOOLEAN NOT NULL DEFAULT false,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_whm_accounts_server   ON viralizahost.whm_accounts(server_id);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_profile  ON viralizahost.whm_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_email    ON viralizahost.whm_accounts(contact_email);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_status   ON viralizahost.whm_accounts(status);
CREATE INDEX IF NOT EXISTS idx_whm_mappings_server   ON viralizahost.whm_package_mappings(server_id);
CREATE INDEX IF NOT EXISTS idx_sso_audit_profile     ON viralizahost.sso_audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_sso_audit_created     ON viralizahost.sso_audit_logs(created_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE viralizahost.whm_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.whm_package_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.sso_audit_logs        ENABLE ROW LEVEL SECURITY;

-- Admins: full access to WHM tables
CREATE POLICY "whm_accounts_admin_all" ON viralizahost.whm_accounts
  USING (EXISTS(
    SELECT 1 FROM viralizahost.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "whm_mappings_admin_all" ON viralizahost.whm_package_mappings
  USING (EXISTS(
    SELECT 1 FROM viralizahost.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Clients: read own SSO logs
CREATE POLICY "sso_audit_select_own" ON viralizahost.sso_audit_logs
  FOR SELECT USING (profile_id = auth.uid());

-- Admins: full access to all SSO logs
CREATE POLICY "sso_audit_admin_all" ON viralizahost.sso_audit_logs
  USING (EXISTS(
    SELECT 1 FROM viralizahost.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT ALL ON viralizahost.whm_accounts         TO authenticated;
GRANT ALL ON viralizahost.whm_package_mappings TO authenticated;
GRANT ALL ON viralizahost.sso_audit_logs        TO authenticated;
