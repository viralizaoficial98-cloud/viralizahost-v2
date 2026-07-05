-- ============================================================
-- ViralizaHost — Orders activation support
-- Schema: viralizahost
-- ============================================================

-- Add order_id to services if missing (links activated service to order)
ALTER TABLE viralizahost.services
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES viralizahost.orders(id) ON DELETE SET NULL;

ALTER TABLE viralizahost.services
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS service_name text;

-- Add registered_at to domains if missing
ALTER TABLE viralizahost.domains
  ADD COLUMN IF NOT EXISTS registered_at timestamptz;

-- Ensure unique constraint on domain name for upsert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'viralizahost.domains'::regclass
    AND conname = 'domains_name_key'
  ) THEN
    ALTER TABLE viralizahost.domains ADD CONSTRAINT domains_name_key UNIQUE (name);
  END IF;
END $$;

-- Grant select on orders/order_items to authenticated (for RLS queries)
GRANT SELECT ON viralizahost.orders TO authenticated;
GRANT SELECT ON viralizahost.order_items TO authenticated;
