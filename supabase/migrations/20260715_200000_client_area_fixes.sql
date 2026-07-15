-- ============================================================
-- Client area fixes: RLS policies, missing indexes
-- ============================================================

-- ── Enable RLS + add SELECT policies so anon+JWT clients can read their own data ─
-- Note: pages now use service_role (createAdminWriteClient), so these are
-- belt-and-suspenders in case queries fall back to the anon client.

-- hosting_accounts: client reads own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'viralizahost' AND tablename = 'hosting_accounts'
      AND policyname = 'client_select_own_hosting_accounts'
  ) THEN
    ALTER TABLE viralizahost.hosting_accounts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY client_select_own_hosting_accounts
      ON viralizahost.hosting_accounts
      FOR SELECT
      USING (profile_id = auth.uid());
  END IF;
END $$;

-- services: client reads own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'viralizahost' AND tablename = 'services'
      AND policyname = 'client_select_own_services'
  ) THEN
    ALTER TABLE viralizahost.services ENABLE ROW LEVEL SECURITY;
    CREATE POLICY client_select_own_services
      ON viralizahost.services
      FOR SELECT
      USING (profile_id = auth.uid());
  END IF;
END $$;

-- domains: client reads own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'viralizahost' AND tablename = 'domains'
      AND policyname = 'client_select_own_domains'
  ) THEN
    ALTER TABLE viralizahost.domains ENABLE ROW LEVEL SECURITY;
    CREATE POLICY client_select_own_domains
      ON viralizahost.domains
      FOR SELECT
      USING (profile_id = auth.uid());
  END IF;
END $$;

-- emails: client reads own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'viralizahost' AND tablename = 'emails'
      AND policyname = 'client_select_own_emails'
  ) THEN
    ALTER TABLE viralizahost.emails ENABLE ROW LEVEL SECURITY;
    CREATE POLICY client_select_own_emails
      ON viralizahost.emails
      FOR SELECT
      USING (profile_id = auth.uid());
  END IF;
END $$;

-- whm_accounts: client reads own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'viralizahost' AND tablename = 'whm_accounts'
      AND policyname = 'client_select_own_whm_accounts'
  ) THEN
    ALTER TABLE viralizahost.whm_accounts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY client_select_own_whm_accounts
      ON viralizahost.whm_accounts
      FOR SELECT
      USING (profile_id = auth.uid());
  END IF;
END $$;

-- ── Performance indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hosting_accounts_profile_id  ON viralizahost.hosting_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_services_profile_id          ON viralizahost.services(profile_id);
CREATE INDEX IF NOT EXISTS idx_domains_profile_id           ON viralizahost.domains(profile_id);
CREATE INDEX IF NOT EXISTS idx_emails_profile_id            ON viralizahost.emails(profile_id);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_profile_id      ON viralizahost.whm_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_whm_accounts_hosting_acct_id ON viralizahost.whm_accounts(hosting_account_id);

-- ── sso_audit_logs: ensure table exists (idempotent) ─────────────────────────
CREATE TABLE IF NOT EXISTS viralizahost.sso_audit_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id         UUID NOT NULL REFERENCES viralizahost.profiles(id)         ON DELETE CASCADE,
  service_id         UUID          REFERENCES viralizahost.services(id)          ON DELETE SET NULL,
  hosting_account_id UUID          REFERENCES viralizahost.hosting_accounts(id)  ON DELETE SET NULL,
  access_type        TEXT NOT NULL,
  ip_address         TEXT,
  user_agent         TEXT,
  success            BOOLEAN NOT NULL DEFAULT true,
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sso_audit_logs_profile_id ON viralizahost.sso_audit_logs(profile_id);

-- Grant service_role full access (already has it, but be explicit)
GRANT ALL ON viralizahost.sso_audit_logs TO service_role;
GRANT ALL ON viralizahost.hosting_accounts TO service_role;
GRANT ALL ON viralizahost.whm_accounts TO service_role;
