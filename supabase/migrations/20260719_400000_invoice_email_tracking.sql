-- ═══════════════════════════════════════════════════════════════
-- Invoice Email Tracking: campos de envio, log de auditoria,
-- novos valores no enum, índices
-- ═══════════════════════════════════════════════════════════════

-- Novos valores no enum invoice_status (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'invoice_status' AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')
    AND e.enumlabel = 'draft'
  ) THEN ALTER TYPE viralizahost.invoice_status ADD VALUE 'draft'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'invoice_status' AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')
    AND e.enumlabel = 'sending'
  ) THEN ALTER TYPE viralizahost.invoice_status ADD VALUE 'sending'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'invoice_status' AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')
    AND e.enumlabel = 'sent'
  ) THEN ALTER TYPE viralizahost.invoice_status ADD VALUE 'sent'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'invoice_status' AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')
    AND e.enumlabel = 'generated'
  ) THEN ALTER TYPE viralizahost.invoice_status ADD VALUE 'generated'; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'invoice_status' AND t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'viralizahost')
    AND e.enumlabel = 'failed'
  ) THEN ALTER TYPE viralizahost.invoice_status ADD VALUE 'failed'; END IF;
END $$;

-- Campos de rastreio de e-mail na tabela invoices
ALTER TABLE viralizahost.invoices
  ADD COLUMN IF NOT EXISTS email_to            TEXT,
  ADD COLUMN IF NOT EXISTS email_from          TEXT,
  ADD COLUMN IF NOT EXISTS email_provider      TEXT DEFAULT 'resend',
  ADD COLUMN IF NOT EXISTS email_provider_id   TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_last_error    TEXT,
  ADD COLUMN IF NOT EXISTS email_attempts      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_delivered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_bounced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_status        TEXT NOT NULL DEFAULT 'unsent'
    CHECK (email_status IN ('unsent','queued','sending','sent','delivered','bounced','failed','complained'));

-- Índice para lookups por provider_id (webhook Resend)
CREATE INDEX IF NOT EXISTS invoices_email_provider_id_idx
  ON viralizahost.invoices(email_provider_id) WHERE email_provider_id IS NOT NULL;

-- Índice por email_status
CREATE INDEX IF NOT EXISTS invoices_email_status_idx
  ON viralizahost.invoices(email_status);

-- ── Tabela de auditoria de envio de facturas ──────────────────
CREATE TABLE IF NOT EXISTS viralizahost.invoice_send_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id         UUID NOT NULL REFERENCES viralizahost.invoices(id) ON DELETE CASCADE,
  order_id           UUID,
  ticket_id          UUID,
  customer_id        UUID NOT NULL,
  recipient          TEXT NOT NULL,
  provider           TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status             TEXT NOT NULL DEFAULT 'attempted'
    CHECK (status IN ('attempted','sent','delivered','bounced','failed','complained')),
  error_message      TEXT,
  initiated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  initiated_by_agent BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_send_logs_invoice_id_idx    ON viralizahost.invoice_send_logs(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_send_logs_customer_id_idx   ON viralizahost.invoice_send_logs(customer_id);
CREATE INDEX IF NOT EXISTS invoice_send_logs_provider_msg_idx  ON viralizahost.invoice_send_logs(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- RLS
ALTER TABLE viralizahost.invoice_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_invoice_send_logs" ON viralizahost.invoice_send_logs
  FOR SELECT USING (viralizahost.is_admin());

CREATE POLICY "service_role_all_invoice_send_logs" ON viralizahost.invoice_send_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger updated_at
DROP TRIGGER IF EXISTS invoice_send_logs_updated_at ON viralizahost.invoice_send_logs;
CREATE TRIGGER invoice_send_logs_updated_at
  BEFORE UPDATE ON viralizahost.invoice_send_logs
  FOR EACH ROW EXECUTE FUNCTION viralizahost.set_updated_at();
