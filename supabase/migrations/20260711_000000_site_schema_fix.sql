-- ============================================================
-- ViralizaHost — Site tables: expose schema + unique constraints
-- ============================================================

-- ── 1. Expose viralizahost schema to PostgREST ─────────────────────────────
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, viralizahost';
NOTIFY pgrst, 'reload config';

-- ── 2. slug columns (safe to re-run) ───────────────────────────────────────
ALTER TABLE viralizahost.site_email_plans
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE viralizahost.site_hosting_plans
  ADD COLUMN IF NOT EXISTS slug text;

-- ── 3. Unique constraints for idempotent upsert ────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'viralizahost.site_domains'::regclass AND conname = 'site_domains_extension_key') THEN
    ALTER TABLE viralizahost.site_domains ADD CONSTRAINT site_domains_extension_key UNIQUE (extension);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'viralizahost.site_email_plans'::regclass AND conname = 'site_email_plans_slug_key') THEN
    UPDATE viralizahost.site_email_plans SET slug = gen_random_uuid()::text WHERE slug IS NULL;
    ALTER TABLE viralizahost.site_email_plans ADD CONSTRAINT site_email_plans_slug_key UNIQUE (slug);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'viralizahost.site_hosting_plans'::regclass AND conname = 'site_hosting_plans_slug_key') THEN
    UPDATE viralizahost.site_hosting_plans SET slug = gen_random_uuid()::text WHERE slug IS NULL;
    ALTER TABLE viralizahost.site_hosting_plans ADD CONSTRAINT site_hosting_plans_slug_key UNIQUE (slug);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'viralizahost.site_team'::regclass AND conname = 'site_team_name_key') THEN
    ALTER TABLE viralizahost.site_team ADD CONSTRAINT site_team_name_key UNIQUE (name);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'viralizahost.site_banners'::regclass AND conname = 'site_banners_position_key') THEN
    ALTER TABLE viralizahost.site_banners ADD CONSTRAINT site_banners_position_key UNIQUE (position);
  END IF;
END $$;
