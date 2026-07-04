-- ============================================================
-- ViralizaHost — Orders & Order Items
-- Schema: viralizahost
-- ============================================================

CREATE SCHEMA IF NOT EXISTS viralizahost;

-- ── orders ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS viralizahost.orders (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_cycle   text        NOT NULL DEFAULT 'monthly',
  domain_name     text,
  domain_action   text,
  payment_method  text        NOT NULL DEFAULT 'bank_transfer',
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'pending',
  proof_file      text,
  transfer_ref    text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── order_items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS viralizahost.order_items (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        uuid        NOT NULL REFERENCES viralizahost.orders(id) ON DELETE CASCADE,
  service_name    text        NOT NULL,
  service_type    text        NOT NULL DEFAULT 'other',
  price           numeric(12,2) NOT NULL DEFAULT 0,
  quantity        int         NOT NULL DEFAULT 1,
  created_at      timestamptz DEFAULT now()
);

-- ── indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS orders_user_id_idx      ON viralizahost.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx       ON viralizahost.orders(status);
CREATE INDEX IF NOT EXISTS order_items_order_idx   ON viralizahost.order_items(order_id);

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE viralizahost.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.order_items ENABLE ROW LEVEL SECURITY;

-- Users see only their own orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='orders' AND policyname='owner_read_orders') THEN
    CREATE POLICY owner_read_orders ON viralizahost.orders
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='order_items' AND policyname='owner_read_order_items') THEN
    CREATE POLICY owner_read_order_items ON viralizahost.order_items
      FOR SELECT TO authenticated
      USING (order_id IN (SELECT id FROM viralizahost.orders WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Service role full access (API routes use service role)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='orders' AND policyname='service_role_orders') THEN
    CREATE POLICY service_role_orders ON viralizahost.orders
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='order_items' AND policyname='service_role_order_items') THEN
    CREATE POLICY service_role_order_items ON viralizahost.order_items
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── grants ────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA viralizahost TO authenticated, service_role;
GRANT ALL   ON viralizahost.orders, viralizahost.order_items TO service_role;
GRANT SELECT ON viralizahost.orders, viralizahost.order_items TO authenticated;

-- ── Supabase Storage bucket for payment proofs ────────────────
-- Run this in Supabase Dashboard > Storage if it doesn't exist:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('payment-proofs', 'payment-proofs', false)
-- ON CONFLICT (id) DO NOTHING;
