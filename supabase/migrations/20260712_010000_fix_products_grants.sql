-- ============================================================
-- Fix: Complete GRANTs and secure RLS for viralizahost.products
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Schema usage (required for authenticated role to access any table)
GRANT USAGE ON SCHEMA viralizahost TO anon, authenticated, service_role;

-- products table
GRANT SELECT                        ON viralizahost.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON viralizahost.products TO authenticated;
GRANT ALL                            ON viralizahost.products TO service_role;

-- product_features table
GRANT SELECT                        ON viralizahost.product_features TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON viralizahost.product_features TO authenticated;
GRANT ALL                            ON viralizahost.product_features TO service_role;

-- Sequences (needed for uuid default if using serial; safe to run even if unused)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA viralizahost TO authenticated, service_role;

-- ── RLS — drop and recreate all policies cleanly ─────────────

ALTER TABLE viralizahost.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.product_features ENABLE ROW LEVEL SECURITY;

-- products: drop all existing policies
DROP POLICY IF EXISTS "public read products"      ON viralizahost.products;
DROP POLICY IF EXISTS "public_read_active_products" ON viralizahost.products;
DROP POLICY IF EXISTS "admin all products"        ON viralizahost.products;
DROP POLICY IF EXISTS "admin_all_products"        ON viralizahost.products;
DROP POLICY IF EXISTS "service_role products"     ON viralizahost.products;
DROP POLICY IF EXISTS "service_role_all_products" ON viralizahost.products;

-- Public: read only active products
CREATE POLICY "public_read_active_products"
  ON viralizahost.products
  FOR SELECT
  USING (active = true);

-- service_role: unrestricted (used by server-side admin routes)
CREATE POLICY "service_role_all_products"
  ON viralizahost.products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins: full CRUD — validated via profiles.role
CREATE POLICY "admin_all_products"
  ON viralizahost.products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viralizahost.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viralizahost.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- product_features: drop all existing policies
DROP POLICY IF EXISTS "public read features"      ON viralizahost.product_features;
DROP POLICY IF EXISTS "admin all features"        ON viralizahost.product_features;
DROP POLICY IF EXISTS "admin_all_features"        ON viralizahost.product_features;
DROP POLICY IF EXISTS "service_role features"     ON viralizahost.product_features;
DROP POLICY IF EXISTS "service_role_all_features" ON viralizahost.product_features;

-- Public: read all features (product must be active — enforced via JOIN in app)
CREATE POLICY "public_read_features"
  ON viralizahost.product_features
  FOR SELECT
  USING (true);

-- service_role: unrestricted
CREATE POLICY "service_role_all_features"
  ON viralizahost.product_features
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins: full CRUD
CREATE POLICY "admin_all_features"
  ON viralizahost.product_features
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viralizahost.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viralizahost.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
