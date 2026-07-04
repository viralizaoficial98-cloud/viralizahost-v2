-- ============================================================
-- ViralizaHost — Site management tables (corrected schema)
-- Applies CREATE TABLE IF NOT EXISTS so it is safe to re-run
-- even if the previous migration (20260702) was partially applied.
-- Schema: viralizahost
-- ============================================================

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS viralizahost;

-- ============================================================
-- site_banners
-- ============================================================
CREATE TABLE IF NOT EXISTS viralizahost.site_banners (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  position      int         NOT NULL DEFAULT 0,
  active        boolean     NOT NULL DEFAULT true,
  bg_image      text,
  bg_color      text        DEFAULT '#000000',
  accent_color  text        DEFAULT '#F5B700',
  tag           text,
  title         text,
  subtitle      text,
  cta_text      text,
  cta_href      text,
  cta_secondary_text text,
  cta_secondary_href text,
  features      text[],
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ============================================================
-- site_domains
-- ============================================================
CREATE TABLE IF NOT EXISTS viralizahost.site_domains (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  extension     text        NOT NULL,
  price_monthly numeric(12,2),
  price_annual  numeric(12,2),
  currency      text        DEFAULT 'AOA',
  popular       boolean     DEFAULT false,
  active        boolean     DEFAULT true,
  position      int         DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- ============================================================
-- site_email_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS viralizahost.site_email_plans (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text        NOT NULL,
  description      text,
  badge            text,
  price_monthly    numeric(12,2),
  price_annual     numeric(12,2),
  discount_annual  int         DEFAULT 0,
  currency         text        DEFAULT 'AOA',
  storage_gb       int         DEFAULT 10,
  accounts         int         DEFAULT 5,
  color            text        DEFAULT '#3B82F6',
  popular          boolean     DEFAULT false,
  features         text[],
  active           boolean     DEFAULT true,
  featured         boolean     DEFAULT false,
  position         int         DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- Add missing columns if the table was created by the earlier migration
ALTER TABLE viralizahost.site_email_plans ADD COLUMN IF NOT EXISTS currency    text    DEFAULT 'AOA';
ALTER TABLE viralizahost.site_email_plans ADD COLUMN IF NOT EXISTS storage_gb  int     DEFAULT 10;
ALTER TABLE viralizahost.site_email_plans ADD COLUMN IF NOT EXISTS accounts    int     DEFAULT 5;
ALTER TABLE viralizahost.site_email_plans ADD COLUMN IF NOT EXISTS color       text    DEFAULT '#3B82F6';
ALTER TABLE viralizahost.site_email_plans ADD COLUMN IF NOT EXISTS popular     boolean DEFAULT false;

-- ============================================================
-- site_hosting_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS viralizahost.site_hosting_plans (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text        NOT NULL,
  description      text,
  badge            text,
  price_monthly    numeric(12,2),
  price_annual     numeric(12,2),
  discount_annual  int         DEFAULT 0,
  currency         text        DEFAULT 'AOA',
  features         text[],
  active           boolean     DEFAULT true,
  featured         boolean     DEFAULT false,
  position         int         DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE viralizahost.site_hosting_plans ADD COLUMN IF NOT EXISTS currency text DEFAULT 'AOA';

-- ============================================================
-- site_team
-- ============================================================
CREATE TABLE IF NOT EXISTS viralizahost.site_team (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  is_ceo       boolean     DEFAULT false,
  name         text        NOT NULL,
  role         text,
  title        text        DEFAULT 'Especialista',
  bio          text,
  photo_url    text,
  flag         text,
  country      text,
  accent_color text        DEFAULT '#F5B700',
  position     int         DEFAULT 0,
  active       boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE viralizahost.site_banners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_domains       ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_email_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_hosting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_team          ENABLE ROW LEVEL SECURITY;

-- Public read (anon)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_banners'       AND policyname='public_read_banners')       THEN CREATE POLICY public_read_banners       ON viralizahost.site_banners       FOR SELECT USING (active = true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_domains'       AND policyname='public_read_domains')       THEN CREATE POLICY public_read_domains       ON viralizahost.site_domains       FOR SELECT USING (active = true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_email_plans'   AND policyname='public_read_email_plans')   THEN CREATE POLICY public_read_email_plans   ON viralizahost.site_email_plans   FOR SELECT USING (active = true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_hosting_plans' AND policyname='public_read_hosting_plans') THEN CREATE POLICY public_read_hosting_plans ON viralizahost.site_hosting_plans FOR SELECT USING (active = true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_team'          AND policyname='public_read_team')          THEN CREATE POLICY public_read_team          ON viralizahost.site_team          FOR SELECT USING (active = true); END IF;
END $$;

-- Service role bypass (needed for seed API)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_banners'       AND policyname='service_role_all_banners')       THEN CREATE POLICY service_role_all_banners       ON viralizahost.site_banners       FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_domains'       AND policyname='service_role_all_domains')       THEN CREATE POLICY service_role_all_domains       ON viralizahost.site_domains       FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_email_plans'   AND policyname='service_role_all_email_plans')   THEN CREATE POLICY service_role_all_email_plans   ON viralizahost.site_email_plans   FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_hosting_plans' AND policyname='service_role_all_hosting_plans') THEN CREATE POLICY service_role_all_hosting_plans ON viralizahost.site_hosting_plans FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_team'          AND policyname='service_role_all_team')          THEN CREATE POLICY service_role_all_team          ON viralizahost.site_team          FOR ALL TO service_role USING (true) WITH CHECK (true); END IF;
END $$;

-- Admin (authenticated) full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_banners'       AND policyname='admin_all_banners')       THEN CREATE POLICY admin_all_banners       ON viralizahost.site_banners       FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_domains'       AND policyname='admin_all_domains')       THEN CREATE POLICY admin_all_domains       ON viralizahost.site_domains       FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_email_plans'   AND policyname='admin_all_email_plans')   THEN CREATE POLICY admin_all_email_plans   ON viralizahost.site_email_plans   FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_hosting_plans' AND policyname='admin_all_hosting_plans') THEN CREATE POLICY admin_all_hosting_plans ON viralizahost.site_hosting_plans FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='site_team'          AND policyname='admin_all_team')          THEN CREATE POLICY admin_all_team          ON viralizahost.site_team          FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF;
END $$;

-- Grant usage on schema to anon and authenticated roles
GRANT USAGE ON SCHEMA viralizahost TO anon, authenticated, service_role;
GRANT SELECT ON viralizahost.site_banners, viralizahost.site_domains, viralizahost.site_email_plans, viralizahost.site_hosting_plans, viralizahost.site_team TO anon;
GRANT ALL ON viralizahost.site_banners, viralizahost.site_domains, viralizahost.site_email_plans, viralizahost.site_hosting_plans, viralizahost.site_team TO authenticated, service_role;
