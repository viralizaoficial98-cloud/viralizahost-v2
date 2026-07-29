-- ============================================================
-- ViralizaHost — Add Nameserver columns to orders table
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- The create_order function is updated in 20260729_100000.
-- ============================================================

ALTER TABLE viralizahost.orders
  ADD COLUMN IF NOT EXISTS use_default_ns boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ns1            text,
  ADD COLUMN IF NOT EXISTS ns2            text,
  ADD COLUMN IF NOT EXISTS ns3            text,
  ADD COLUMN IF NOT EXISTS ns4            text;
