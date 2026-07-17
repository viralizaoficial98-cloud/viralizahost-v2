-- ============================================================
-- ViralizaHost — Billing: payment flow enhancements
-- ============================================================

-- 1. Add extra statuses to invoice_status enum (safe, idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'under_review'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status'
                     AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')))
  THEN
    ALTER TYPE viralizahost.invoice_status ADD VALUE 'under_review';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'partially_paid'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status'
                     AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')))
  THEN
    ALTER TYPE viralizahost.invoice_status ADD VALUE 'partially_paid';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rejected'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status'
                     AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')))
  THEN
    ALTER TYPE viralizahost.invoice_status ADD VALUE 'rejected';
  END IF;
END $$;

-- 2. Add extra columns to payments table (idempotent)
ALTER TABLE viralizahost.payments
  ADD COLUMN IF NOT EXISTS order_id        UUID REFERENCES viralizahost.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proof_url       TEXT,
  ADD COLUMN IF NOT EXISTS proof_filename  TEXT,
  ADD COLUMN IF NOT EXISTS proof_mime      TEXT,
  ADD COLUMN IF NOT EXISTS transfer_ref    TEXT,
  ADD COLUMN IF NOT EXISTS transfer_date   DATE,
  ADD COLUMN IF NOT EXISTS payer_name      TEXT,
  ADD COLUMN IF NOT EXISTS payer_bank      TEXT,
  ADD COLUMN IF NOT EXISTS declared_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by     UUID;

-- 3. Add order_id to invoices (idempotent)
ALTER TABLE viralizahost.invoices
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES viralizahost.orders(id) ON DELETE SET NULL;

-- 4. Add amount_paid column to invoices (idempotent)
ALTER TABLE viralizahost.invoices
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx  ON viralizahost.payments(invoice_id);
CREATE INDEX IF NOT EXISTS payments_profile_id_idx  ON viralizahost.payments(profile_id);
CREATE INDEX IF NOT EXISTS payments_order_id_idx    ON viralizahost.payments(order_id);
CREATE INDEX IF NOT EXISTS payments_status_idx      ON viralizahost.payments(status);
CREATE INDEX IF NOT EXISTS invoices_profile_id_idx  ON viralizahost.invoices(profile_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx      ON viralizahost.invoices(status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx    ON viralizahost.invoices(due_date);

-- 6. RLS already enabled (from 20260717_000000_support_financial.sql)
-- Make sure authenticated users can insert payments (for proof submission)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost'
                 AND tablename='payments' AND policyname='client_insert_payments') THEN
    CREATE POLICY client_insert_payments ON viralizahost.payments
      FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

-- 7. Grants
GRANT INSERT ON viralizahost.payments TO authenticated;
GRANT ALL    ON viralizahost.payments TO service_role;
GRANT ALL    ON viralizahost.invoices TO service_role;
