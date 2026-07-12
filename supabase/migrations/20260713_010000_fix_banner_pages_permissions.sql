-- ============================================================
-- Fix banner_pages permissions
-- Idempotent — safe to run multiple times.
-- Run in Supabase SQL Editor after deploying the app changes.
-- ============================================================

-- 1. Schema access
GRANT USAGE ON SCHEMA viralizahost TO anon, authenticated, service_role;

-- 2. Table grants
--    anon / authenticated: read-only (RLS further restricts to is_active = true)
--    service_role: full CRUD (used exclusively by server-side admin API routes)
GRANT SELECT                         ON TABLE viralizahost.banner_pages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE viralizahost.banner_pages TO service_role;

-- 3. Sequences (needed for INSERT with serial/uuid defaults)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA viralizahost TO service_role;

-- 4. Default privileges — apply to future tables created in this schema
ALTER DEFAULT PRIVILEGES IN SCHEMA viralizahost
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA viralizahost
  GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA viralizahost
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA viralizahost
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- 5. RLS — ensure it is enabled and policies are correct
ALTER TABLE viralizahost.banner_pages ENABLE ROW LEVEL SECURITY;

-- Drop any stale or duplicate policies
DROP POLICY IF EXISTS "bp_public_read"      ON viralizahost.banner_pages;
DROP POLICY IF EXISTS "bp_service_role_all" ON viralizahost.banner_pages;
DROP POLICY IF EXISTS "Public can read active banner pages" ON viralizahost.banner_pages;

-- Public (anon + authenticated): read only active banners
CREATE POLICY "bp_public_read"
  ON viralizahost.banner_pages
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- service_role bypasses RLS via BYPASSRLS attribute, but an explicit policy
-- ensures correctness even if that attribute is ever changed.
CREATE POLICY "bp_service_role_all"
  ON viralizahost.banner_pages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
