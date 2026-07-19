-- email_logs: registro completo de todos os e-mails enviados pelo sistema
-- Tabela separada de invoice_send_logs para cobrir qualquer tipo de e-mail futuro

SET search_path TO viralizahost, public;

-- ── Enum de estados ─────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_log_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')) THEN
    CREATE TYPE email_log_status AS ENUM ('queued','processing','sent','delivered','bounced','failed','complained','delayed');
  END IF;
END $$;

-- ── Tabela principal ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  invoice_id          UUID REFERENCES invoices(id) ON DELETE SET NULL,
  order_id            UUID REFERENCES orders(id)   ON DELETE SET NULL,
  recipient           TEXT NOT NULL,
  sender              TEXT NOT NULL DEFAULT 'ViralizaHost Comercial <comercial@viralizahost.com>',
  subject             TEXT,
  provider            TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status              email_log_status NOT NULL DEFAULT 'queued',
  error_message       TEXT,
  attempts            INTEGER NOT NULL DEFAULT 1,
  initiated_by_agent  BOOLEAN NOT NULL DEFAULT false,
  initiated_by        UUID,
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS email_logs_profile_id_idx          ON email_logs(profile_id);
CREATE INDEX IF NOT EXISTS email_logs_invoice_id_idx          ON email_logs(invoice_id);
CREATE INDEX IF NOT EXISTS email_logs_provider_message_id_idx ON email_logs(provider_message_id);
CREATE INDEX IF NOT EXISTS email_logs_status_idx              ON email_logs(status);
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx          ON email_logs(created_at DESC);

-- ── Auto-updated_at ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION viralizahost.update_email_logs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_email_logs_updated_at ON email_logs;
CREATE TRIGGER trg_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW EXECUTE FUNCTION viralizahost.update_email_logs_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs: client_read_own"   ON email_logs;
DROP POLICY IF EXISTS "email_logs: service_role_all"  ON email_logs;

CREATE POLICY "email_logs: service_role_all"
  ON email_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "email_logs: client_read_own"
  ON email_logs FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT SELECT ON email_logs TO authenticated;
GRANT ALL    ON email_logs TO service_role;
