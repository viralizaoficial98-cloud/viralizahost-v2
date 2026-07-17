-- ============================================================
-- ViralizaHost — Support tickets enhancements + financial
-- Idempotent: safe to run multiple times
-- ============================================================

-- ── 1. Add ticket_number to tickets ──────────────────────────
ALTER TABLE viralizahost.tickets
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS domain_id     UUID REFERENCES viralizahost.domains(id) ON DELETE SET NULL;

-- Unique constraint on ticket_number
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'viralizahost.tickets'::regclass
    AND conname = 'tickets_ticket_number_key'
  ) THEN
    ALTER TABLE viralizahost.tickets ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);
  END IF;
END $$;

-- ── 2. Add is_internal to ticket_messages (admin-only notes) ─
ALTER TABLE viralizahost.ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Function to generate ticket number ────────────────────
CREATE OR REPLACE FUNCTION viralizahost.generate_ticket_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_seq  BIGINT;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM viralizahost.tickets
  WHERE ticket_number LIKE 'VH-TKT-' || v_year || '-%';

  NEW.ticket_number := 'VH-TKT-' || v_year || '-' || lpad(v_seq::text, 6, '0');
  RETURN NEW;
END;
$$;

-- Trigger only fires when ticket_number is NULL (new tickets)
DROP TRIGGER IF EXISTS set_ticket_number ON viralizahost.tickets;
CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON viralizahost.tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION viralizahost.generate_ticket_number();

-- Backfill ticket_number for existing tickets without one
DO $$
DECLARE
  r RECORD;
  v_year TEXT;
  v_seq  BIGINT := 1;
BEGIN
  FOR r IN
    SELECT id, created_at FROM viralizahost.tickets
    WHERE ticket_number IS NULL
    ORDER BY created_at
  LOOP
    v_year := to_char(r.created_at, 'YYYY');
    UPDATE viralizahost.tickets
    SET ticket_number = 'VH-TKT-' || v_year || '-' || lpad(v_seq::text, 6, '0')
    WHERE id = r.id;
    v_seq := v_seq + 1;
  END LOOP;
END $$;

-- ── 4. RLS policies for tickets ──────────────────────────────
ALTER TABLE viralizahost.tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Client reads own tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='client_select_tickets') THEN
    CREATE POLICY client_select_tickets ON viralizahost.tickets
      FOR SELECT TO authenticated USING (profile_id = auth.uid());
  END IF;
END $$;

-- Client inserts own tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='client_insert_tickets') THEN
    CREATE POLICY client_insert_tickets ON viralizahost.tickets
      FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

-- Client updates own tickets (e.g. reopen)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='client_update_tickets') THEN
    CREATE POLICY client_update_tickets ON viralizahost.tickets
      FOR UPDATE TO authenticated USING (profile_id = auth.uid());
  END IF;
END $$;

-- Service role full access to tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='service_role_tickets') THEN
    CREATE POLICY service_role_tickets ON viralizahost.tickets
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Client reads messages for own tickets (excluding internal)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='ticket_messages' AND policyname='client_select_messages') THEN
    CREATE POLICY client_select_messages ON viralizahost.ticket_messages
      FOR SELECT TO authenticated
      USING (
        ticket_id IN (SELECT id FROM viralizahost.tickets WHERE profile_id = auth.uid())
        AND is_internal = false
      );
  END IF;
END $$;

-- Client inserts messages on own tickets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='ticket_messages' AND policyname='client_insert_messages') THEN
    CREATE POLICY client_insert_messages ON viralizahost.ticket_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        ticket_id IN (SELECT id FROM viralizahost.tickets WHERE profile_id = auth.uid())
        AND is_internal = false
        AND is_staff = false
      );
  END IF;
END $$;

-- Service role full access to messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='ticket_messages' AND policyname='service_role_messages') THEN
    CREATE POLICY service_role_messages ON viralizahost.ticket_messages
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tickets_profile_id_idx    ON viralizahost.tickets(profile_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx        ON viralizahost.tickets(status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx      ON viralizahost.tickets(priority);
CREATE INDEX IF NOT EXISTS tickets_assigned_to_idx   ON viralizahost.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS tickets_created_at_idx    ON viralizahost.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_messages_ticket_idx ON viralizahost.ticket_messages(ticket_id);

-- ── 6. Grants ─────────────────────────────────────────────────
GRANT USAGE ON SCHEMA viralizahost TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON viralizahost.tickets         TO authenticated;
GRANT SELECT, INSERT         ON viralizahost.ticket_messages TO authenticated;
GRANT ALL                    ON viralizahost.tickets         TO service_role;
GRANT ALL                    ON viralizahost.ticket_messages TO service_role;

-- ── 7. RLS for invoices/payments ─────────────────────────────
ALTER TABLE viralizahost.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='invoices' AND policyname='client_select_invoices') THEN
    CREATE POLICY client_select_invoices ON viralizahost.invoices
      FOR SELECT TO authenticated USING (profile_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='invoices' AND policyname='service_role_invoices') THEN
    CREATE POLICY service_role_invoices ON viralizahost.invoices
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='payments' AND policyname='client_select_payments') THEN
    CREATE POLICY client_select_payments ON viralizahost.payments
      FOR SELECT TO authenticated USING (profile_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='payments' AND policyname='service_role_payments') THEN
    CREATE POLICY service_role_payments ON viralizahost.payments
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON viralizahost.invoices TO authenticated;
GRANT SELECT ON viralizahost.payments TO authenticated;
GRANT ALL    ON viralizahost.invoices TO service_role;
GRANT ALL    ON viralizahost.payments TO service_role;

-- ── 8. Notifications grants ───────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON viralizahost.notifications TO authenticated;
GRANT ALL                    ON viralizahost.notifications TO service_role;
