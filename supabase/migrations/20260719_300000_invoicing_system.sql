-- ═══════════════════════════════════════════════════════════════
-- Invoicing System: invoice_items, company_billing_settings,
-- ticket_attachments + patch invoices table
-- ═══════════════════════════════════════════════════════════════

-- Patch invoices: add missing columns if they don't exist
ALTER TABLE viralizahost.invoices
  ADD COLUMN IF NOT EXISTS order_id        UUID REFERENCES viralizahost.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_id       UUID REFERENCES viralizahost.tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS emailed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Unique invoice_number
ALTER TABLE viralizahost.invoices
  DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE viralizahost.invoices
  ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);

-- Prevent duplicate invoice for same order
DROP INDEX IF EXISTS viralizahost.invoices_order_id_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_order_id_unique_idx
  ON viralizahost.invoices(order_id) WHERE order_id IS NOT NULL;

-- invoice_items
CREATE TABLE IF NOT EXISTS viralizahost.invoice_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES viralizahost.invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES viralizahost.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON viralizahost.invoice_items(invoice_id);

-- company_billing_settings
CREATE TABLE IF NOT EXISTS viralizahost.company_billing_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name          TEXT NOT NULL DEFAULT 'ViralizaHost',
  logo_url              TEXT,
  email                 TEXT NOT NULL DEFAULT 'comercial@viralizahost.com',
  website               TEXT NOT NULL DEFAULT 'viralizahost.com',
  phone                 TEXT,
  address               TEXT,
  bank_name             TEXT,
  account_holder        TEXT,
  account_number        TEXT,
  iban                  TEXT,
  swift                 TEXT,
  payment_instructions  TEXT,
  footer_text           TEXT DEFAULT 'ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos' || E'\n' || 'E-mail: comercial@viralizahost.com | viralizahost.com | Suporte 24/7',
  default_due_days      INTEGER NOT NULL DEFAULT 7,
  email_subject_template TEXT DEFAULT 'Fatura ViralizaHost nº {invoice_number} — {service_name}',
  email_body_template   TEXT,
  auto_email_on_create  BOOLEAN NOT NULL DEFAULT false,
  active                BOOLEAN NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Ensure only one active settings row
CREATE UNIQUE INDEX IF NOT EXISTS company_billing_settings_active_idx
  ON viralizahost.company_billing_settings(active) WHERE active = true;

-- Insert default settings if empty
INSERT INTO viralizahost.company_billing_settings (company_name, email, website, footer_text)
SELECT 'ViralizaHost', 'comercial@viralizahost.com', 'viralizahost.com',
       E'ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos\nE-mail: comercial@viralizahost.com | viralizahost.com | Suporte profissional 24/7'
WHERE NOT EXISTS (SELECT 1 FROM viralizahost.company_billing_settings LIMIT 1);

-- ticket_attachments
CREATE TABLE IF NOT EXISTS viralizahost.ticket_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL REFERENCES viralizahost.tickets(id) ON DELETE CASCADE,
  message_id   UUID REFERENCES viralizahost.ticket_messages(id) ON DELETE SET NULL,
  invoice_id   UUID REFERENCES viralizahost.invoices(id) ON DELETE SET NULL,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'application/pdf',
  file_size    INTEGER,
  uploaded_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_attachments_ticket_id_idx ON viralizahost.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_attachments_invoice_id_idx ON viralizahost.ticket_attachments(invoice_id);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS invoices_order_id_idx   ON viralizahost.invoices(order_id);
CREATE INDEX IF NOT EXISTS invoices_ticket_id_idx  ON viralizahost.invoices(ticket_id);
CREATE INDEX IF NOT EXISTS invoices_profile_id_idx ON viralizahost.invoices(profile_id);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE viralizahost.invoice_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.company_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.ticket_attachments       ENABLE ROW LEVEL SECURITY;

-- invoice_items: owner via parent invoice
CREATE POLICY "owner_read_invoice_items" ON viralizahost.invoice_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viralizahost.invoices i
      WHERE i.id = invoice_items.invoice_id AND i.profile_id = auth.uid()
    ) OR viralizahost.is_admin()
  );
CREATE POLICY "service_role_all_invoice_items" ON viralizahost.invoice_items
  FOR ALL USING (auth.role() = 'service_role');

-- company_billing_settings: admins and service role only
CREATE POLICY "admin_read_billing_settings" ON viralizahost.company_billing_settings
  FOR SELECT USING (viralizahost.is_admin());
CREATE POLICY "service_role_all_billing_settings" ON viralizahost.company_billing_settings
  FOR ALL USING (auth.role() = 'service_role');

-- ticket_attachments: owner can read their own
CREATE POLICY "owner_read_ticket_attachments" ON viralizahost.ticket_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viralizahost.tickets t
      WHERE t.id = ticket_attachments.ticket_id AND t.profile_id = auth.uid()
    ) OR viralizahost.is_admin()
  );
CREATE POLICY "service_role_all_ticket_attachments" ON viralizahost.ticket_attachments
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger for company_billing_settings
DROP TRIGGER IF EXISTS company_billing_settings_updated_at ON viralizahost.company_billing_settings;
CREATE TRIGGER company_billing_settings_updated_at
  BEFORE UPDATE ON viralizahost.company_billing_settings
  FOR EACH ROW EXECUTE FUNCTION viralizahost.set_updated_at();
