-- ============================================================
-- ViralizaHost — Ensure tickets schema is complete
-- Idempotent: safe to run multiple times
-- Fixes "Erro ao criar ticket" caused by missing columns
-- ============================================================

-- ── 1. Ensure columns exist on tickets ────────────────────────
ALTER TABLE viralizahost.tickets
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS domain_id     UUID REFERENCES viralizahost.domains(id) ON DELETE SET NULL;

-- Unique constraint on ticket_number
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'viralizahost.tickets'::regclass AND conname = 'tickets_ticket_number_key'
  ) THEN
    ALTER TABLE viralizahost.tickets ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);
  END IF;
END $$;

-- ── 2. Ensure is_internal exists on ticket_messages ───────────
ALTER TABLE viralizahost.ticket_messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Ticket number generator ────────────────────────────────
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

DROP TRIGGER IF EXISTS set_ticket_number ON viralizahost.tickets;
CREATE TRIGGER set_ticket_number
  BEFORE INSERT ON viralizahost.tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL)
  EXECUTE FUNCTION viralizahost.generate_ticket_number();

-- Backfill missing ticket numbers
DO $$
DECLARE
  r      RECORD;
  v_year TEXT;
  v_seq  BIGINT := 1;
BEGIN
  FOR r IN
    SELECT id, created_at FROM viralizahost.tickets
    WHERE ticket_number IS NULL ORDER BY created_at
  LOOP
    v_year := to_char(r.created_at, 'YYYY');
    UPDATE viralizahost.tickets
    SET ticket_number = 'VH-TKT-' || v_year || '-' || lpad(v_seq::text, 6, '0')
    WHERE id = r.id;
    v_seq := v_seq + 1;
  END LOOP;
END $$;

-- ── 4. RLS ────────────────────────────────────────────────────
ALTER TABLE viralizahost.tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.ticket_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='client_select_tickets') THEN
    CREATE POLICY client_select_tickets ON viralizahost.tickets
      FOR SELECT TO authenticated USING (profile_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='client_insert_tickets') THEN
    CREATE POLICY client_insert_tickets ON viralizahost.tickets
      FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='client_update_tickets') THEN
    CREATE POLICY client_update_tickets ON viralizahost.tickets
      FOR UPDATE TO authenticated USING (profile_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='tickets' AND policyname='service_role_tickets') THEN
    CREATE POLICY service_role_tickets ON viralizahost.tickets
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='ticket_messages' AND policyname='service_role_messages') THEN
    CREATE POLICY service_role_messages ON viralizahost.ticket_messages
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tickets_profile_id_idx     ON viralizahost.tickets(profile_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx         ON viralizahost.tickets(status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx       ON viralizahost.tickets(priority);
CREATE INDEX IF NOT EXISTS tickets_assigned_to_idx    ON viralizahost.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS tickets_created_at_idx     ON viralizahost.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_messages_ticket_idx ON viralizahost.ticket_messages(ticket_id);

-- ── 6. Grants ─────────────────────────────────────────────────
GRANT USAGE ON SCHEMA viralizahost TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE        ON viralizahost.tickets          TO authenticated;
GRANT SELECT, INSERT                ON viralizahost.ticket_messages  TO authenticated;
GRANT ALL                           ON viralizahost.tickets          TO service_role;
GRANT ALL                           ON viralizahost.ticket_messages  TO service_role;
