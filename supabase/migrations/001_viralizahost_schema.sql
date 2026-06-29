-- ============================================================
-- ViralizaHost — Schema completo
-- Schema: viralizahost (isolado do public)
-- ============================================================

-- 1. Criar o schema
CREATE SCHEMA IF NOT EXISTS viralizahost;

-- 2. Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE viralizahost.user_role AS ENUM ('client', 'admin', 'reseller');
CREATE TYPE viralizahost.currency_code AS ENUM ('AKZ', 'BRL', 'USD');
CREATE TYPE viralizahost.plan_type AS ENUM ('shared', 'vps', 'dedicated', 'reseller');
CREATE TYPE viralizahost.service_status AS ENUM ('pending', 'active', 'suspended', 'cancelled', 'expired');
CREATE TYPE viralizahost.domain_status AS ENUM ('active', 'expired', 'pending', 'transferred', 'locked');
CREATE TYPE viralizahost.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE viralizahost.ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE viralizahost.invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled', 'refunded');
CREATE TYPE viralizahost.payment_method AS ENUM ('credit_card', 'paypal', 'mercadopago', 'pix', 'bank_transfer', 'multicaixa');
CREATE TYPE viralizahost.notification_type AS ENUM ('info', 'warning', 'error', 'success');
CREATE TYPE viralizahost.log_action AS ENUM ('login', 'logout', 'create', 'update', 'delete', 'payment', 'suspend', 'activate');

-- ============================================================
-- TABELA: profiles (ligada a auth.users)
-- ============================================================

CREATE TABLE viralizahost.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  country       TEXT NOT NULL DEFAULT 'AO',
  role          viralizahost.user_role NOT NULL DEFAULT 'client',
  currency      viralizahost.currency_code NOT NULL DEFAULT 'USD',
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: clients (dados extras do cliente)
-- ============================================================

CREATE TABLE viralizahost.clients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  company_name  TEXT,
  tax_id        TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  postal_code   TEXT,
  notes         TEXT,
  credit_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency      viralizahost.currency_code NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

-- ============================================================
-- TABELA: plans
-- ============================================================

CREATE TABLE viralizahost.plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  type          viralizahost.plan_type NOT NULL DEFAULT 'shared',
  description   TEXT,
  features      JSONB NOT NULL DEFAULT '[]',
  price_akz     DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_brl     DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_usd     DECIMAL(12,2) NOT NULL DEFAULT 0,
  disk_gb       INTEGER NOT NULL DEFAULT 10,
  bandwidth_gb  INTEGER NOT NULL DEFAULT 100,
  email_accounts INTEGER NOT NULL DEFAULT 5,
  max_domains   INTEGER NOT NULL DEFAULT 1,
  max_subdomains INTEGER NOT NULL DEFAULT 5,
  max_databases INTEGER NOT NULL DEFAULT 3,
  is_popular    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: servers
-- ============================================================

CREATE TABLE viralizahost.servers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  hostname      TEXT NOT NULL,
  ip_address    INET NOT NULL,
  location      TEXT NOT NULL DEFAULT 'AO',
  whm_url       TEXT,
  whm_api_token TEXT,
  whm_username  TEXT DEFAULT 'root',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  max_accounts  INTEGER NOT NULL DEFAULT 500,
  current_load  DECIMAL(5,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: services (subscriptions/planos ativos)
-- ============================================================

CREATE TABLE viralizahost.services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  plan_id       UUID NOT NULL REFERENCES viralizahost.plans(id),
  server_id     UUID REFERENCES viralizahost.servers(id),
  status        viralizahost.service_status NOT NULL DEFAULT 'pending',
  currency      viralizahost.currency_code NOT NULL DEFAULT 'USD',
  price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  started_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  auto_renew    BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: hosting_accounts (contas cPanel)
-- ============================================================

CREATE TABLE viralizahost.hosting_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id      UUID NOT NULL REFERENCES viralizahost.services(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  server_id       UUID REFERENCES viralizahost.servers(id),
  cpanel_username TEXT NOT NULL,
  primary_domain  TEXT NOT NULL,
  status          viralizahost.service_status NOT NULL DEFAULT 'pending',
  disk_used_mb    INTEGER NOT NULL DEFAULT 0,
  bandwidth_used_mb INTEGER NOT NULL DEFAULT 0,
  email_count     INTEGER NOT NULL DEFAULT 0,
  db_count        INTEGER NOT NULL DEFAULT 0,
  php_version     TEXT NOT NULL DEFAULT '8.2',
  ssl_enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cpanel_username)
);

-- ============================================================
-- TABELA: domains
-- ============================================================

CREATE TABLE viralizahost.domains (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  service_id    UUID REFERENCES viralizahost.services(id),
  name          TEXT NOT NULL,
  extension     TEXT NOT NULL,
  full_domain   TEXT GENERATED ALWAYS AS (name || extension) STORED,
  status        viralizahost.domain_status NOT NULL DEFAULT 'pending',
  registrar     TEXT NOT NULL DEFAULT 'viralizahost',
  nameservers   JSONB NOT NULL DEFAULT '["ns1.viralizahost.com","ns2.viralizahost.com"]',
  auto_renew    BOOLEAN NOT NULL DEFAULT true,
  is_locked     BOOLEAN NOT NULL DEFAULT true,
  whois_privacy BOOLEAN NOT NULL DEFAULT false,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,
  price_paid    DECIMAL(12,2),
  currency      viralizahost.currency_code,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, extension)
);

-- ============================================================
-- TABELA: emails (contas de email corporativo)
-- ============================================================

CREATE TABLE viralizahost.emails (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hosting_id      UUID NOT NULL REFERENCES viralizahost.hosting_accounts(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  email_address   TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  quota_mb        INTEGER NOT NULL DEFAULT 500,
  used_mb         INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: tickets
-- ============================================================

CREATE TABLE viralizahost.tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  status        viralizahost.ticket_status NOT NULL DEFAULT 'open',
  priority      viralizahost.ticket_priority NOT NULL DEFAULT 'medium',
  department    TEXT NOT NULL DEFAULT 'technical',
  assigned_to   UUID REFERENCES viralizahost.profiles(id),
  service_id    UUID REFERENCES viralizahost.services(id),
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: ticket_messages
-- ============================================================

CREATE TABLE viralizahost.ticket_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id     UUID NOT NULL REFERENCES viralizahost.tickets(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  is_staff      BOOLEAN NOT NULL DEFAULT false,
  attachments   JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: invoices
-- ============================================================

CREATE TABLE viralizahost.invoices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL UNIQUE DEFAULT ('INV-' || to_char(now(), 'YYYY') || '-' || lpad(floor(random()*99999)::text, 5, '0')),
  profile_id    UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  service_id    UUID REFERENCES viralizahost.services(id),
  status        viralizahost.invoice_status NOT NULL DEFAULT 'pending',
  currency      viralizahost.currency_code NOT NULL DEFAULT 'USD',
  subtotal      DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax           DECIMAL(12,2) NOT NULL DEFAULT 0,
  total         DECIMAL(12,2) NOT NULL DEFAULT 0,
  items         JSONB NOT NULL DEFAULT '[]',
  due_date      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  paid_at       TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: payments
-- ============================================================

CREATE TABLE viralizahost.payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID NOT NULL REFERENCES viralizahost.invoices(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  method          viralizahost.payment_method NOT NULL DEFAULT 'credit_card',
  amount          DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency        viralizahost.currency_code NOT NULL DEFAULT 'USD',
  status          TEXT NOT NULL DEFAULT 'pending',
  gateway_ref     TEXT,
  gateway_data    JSONB DEFAULT '{}',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: notifications
-- ============================================================

CREATE TABLE viralizahost.notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID NOT NULL REFERENCES viralizahost.profiles(id) ON DELETE CASCADE,
  type          viralizahost.notification_type NOT NULL DEFAULT 'info',
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  link          TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELA: activity_logs
-- ============================================================

CREATE TABLE viralizahost.activity_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id    UUID REFERENCES viralizahost.profiles(id) ON DELETE SET NULL,
  action        viralizahost.log_action NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  description   TEXT NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_email ON viralizahost.profiles(email);
CREATE INDEX idx_profiles_role ON viralizahost.profiles(role);
CREATE INDEX idx_clients_profile ON viralizahost.clients(profile_id);
CREATE INDEX idx_services_profile ON viralizahost.services(profile_id);
CREATE INDEX idx_services_status ON viralizahost.services(status);
CREATE INDEX idx_services_expires ON viralizahost.services(expires_at);
CREATE INDEX idx_hosting_profile ON viralizahost.hosting_accounts(profile_id);
CREATE INDEX idx_hosting_domain ON viralizahost.hosting_accounts(primary_domain);
CREATE INDEX idx_domains_profile ON viralizahost.domains(profile_id);
CREATE INDEX idx_domains_status ON viralizahost.domains(status);
CREATE INDEX idx_domains_expires ON viralizahost.domains(expires_at);
CREATE INDEX idx_emails_hosting ON viralizahost.emails(hosting_id);
CREATE INDEX idx_tickets_profile ON viralizahost.tickets(profile_id);
CREATE INDEX idx_tickets_status ON viralizahost.tickets(status);
CREATE INDEX idx_ticket_messages_ticket ON viralizahost.ticket_messages(ticket_id);
CREATE INDEX idx_invoices_profile ON viralizahost.invoices(profile_id);
CREATE INDEX idx_invoices_status ON viralizahost.invoices(status);
CREATE INDEX idx_payments_invoice ON viralizahost.payments(invoice_id);
CREATE INDEX idx_notifications_profile ON viralizahost.notifications(profile_id);
CREATE INDEX idx_notifications_read ON viralizahost.notifications(profile_id, is_read);
CREATE INDEX idx_activity_profile ON viralizahost.activity_logs(profile_id);
CREATE INDEX idx_activity_created ON viralizahost.activity_logs(created_at DESC);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION viralizahost.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','clients','plans','servers','services',
    'hosting_accounts','domains','emails','tickets','invoices'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON viralizahost.%s FOR EACH ROW EXECUTE FUNCTION viralizahost.set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ============================================================
-- TRIGGER: criar profile automaticamente após signup
-- ============================================================

CREATE OR REPLACE FUNCTION viralizahost.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO viralizahost.profiles (id, email, full_name, phone, country, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'country', 'AO'),
    COALESCE((NEW.raw_user_meta_data->>'role')::viralizahost.user_role, 'client')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, viralizahost.profiles.full_name),
    updated_at = now();

  INSERT INTO viralizahost.clients (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION viralizahost.handle_new_user();

-- ============================================================
-- TRIGGER: sync email update
-- ============================================================

CREATE OR REPLACE FUNCTION viralizahost.handle_user_email_updated()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE viralizahost.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_auth_user_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION viralizahost.handle_user_email_updated();

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE viralizahost.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.hosting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper: verificar se é admin
CREATE OR REPLACE FUNCTION viralizahost.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM viralizahost.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: verificar se é admin ou reseller
CREATE OR REPLACE FUNCTION viralizahost.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM viralizahost.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'reseller')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- POLICIES: profiles
-- ============================================================

CREATE POLICY "profiles_select_own" ON viralizahost.profiles
  FOR SELECT USING (id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "profiles_insert_own" ON viralizahost.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON viralizahost.profiles
  FOR UPDATE USING (id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "profiles_delete_admin" ON viralizahost.profiles
  FOR DELETE USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: clients
-- ============================================================

CREATE POLICY "clients_select_own" ON viralizahost.clients
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "clients_insert_own" ON viralizahost.clients
  FOR INSERT WITH CHECK (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "clients_update_own" ON viralizahost.clients
  FOR UPDATE USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "clients_delete_admin" ON viralizahost.clients
  FOR DELETE USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: plans (público para leitura, admin para escrita)
-- ============================================================

CREATE POLICY "plans_select_all" ON viralizahost.plans
  FOR SELECT USING (is_active = true OR viralizahost.is_admin());

CREATE POLICY "plans_write_admin" ON viralizahost.plans
  FOR ALL USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: servers (apenas admin)
-- ============================================================

CREATE POLICY "servers_admin_only" ON viralizahost.servers
  FOR ALL USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: services
-- ============================================================

CREATE POLICY "services_select_own" ON viralizahost.services
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "services_insert_admin" ON viralizahost.services
  FOR INSERT WITH CHECK (viralizahost.is_admin() OR profile_id = auth.uid());

CREATE POLICY "services_update_admin" ON viralizahost.services
  FOR UPDATE USING (viralizahost.is_admin());

CREATE POLICY "services_delete_admin" ON viralizahost.services
  FOR DELETE USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: hosting_accounts
-- ============================================================

CREATE POLICY "hosting_select_own" ON viralizahost.hosting_accounts
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "hosting_write_admin" ON viralizahost.hosting_accounts
  FOR ALL USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: domains
-- ============================================================

CREATE POLICY "domains_select_own" ON viralizahost.domains
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "domains_insert_own" ON viralizahost.domains
  FOR INSERT WITH CHECK (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "domains_update_own" ON viralizahost.domains
  FOR UPDATE USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "domains_delete_admin" ON viralizahost.domains
  FOR DELETE USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: emails
-- ============================================================

CREATE POLICY "emails_select_own" ON viralizahost.emails
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "emails_write_own" ON viralizahost.emails
  FOR ALL USING (profile_id = auth.uid() OR viralizahost.is_admin());

-- ============================================================
-- POLICIES: tickets
-- ============================================================

CREATE POLICY "tickets_select_own" ON viralizahost.tickets
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_staff());

CREATE POLICY "tickets_insert_own" ON viralizahost.tickets
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "tickets_update_own_or_staff" ON viralizahost.tickets
  FOR UPDATE USING (profile_id = auth.uid() OR viralizahost.is_staff());

CREATE POLICY "tickets_delete_admin" ON viralizahost.tickets
  FOR DELETE USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: ticket_messages
-- ============================================================

CREATE POLICY "ticket_messages_select" ON viralizahost.ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM viralizahost.tickets t
      WHERE t.id = ticket_id AND (t.profile_id = auth.uid() OR viralizahost.is_staff())
    )
  );

CREATE POLICY "ticket_messages_insert" ON viralizahost.ticket_messages
  FOR INSERT WITH CHECK (
    profile_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM viralizahost.tickets t
      WHERE t.id = ticket_id AND (t.profile_id = auth.uid() OR viralizahost.is_staff())
    )
  );

-- ============================================================
-- POLICIES: invoices
-- ============================================================

CREATE POLICY "invoices_select_own" ON viralizahost.invoices
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "invoices_write_admin" ON viralizahost.invoices
  FOR ALL USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: payments
-- ============================================================

CREATE POLICY "payments_select_own" ON viralizahost.payments
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "payments_write_admin" ON viralizahost.payments
  FOR ALL USING (viralizahost.is_admin());

-- ============================================================
-- POLICIES: notifications
-- ============================================================

CREATE POLICY "notifications_own" ON viralizahost.notifications
  FOR ALL USING (profile_id = auth.uid() OR viralizahost.is_admin());

-- ============================================================
-- POLICIES: activity_logs
-- ============================================================

CREATE POLICY "activity_logs_select" ON viralizahost.activity_logs
  FOR SELECT USING (profile_id = auth.uid() OR viralizahost.is_admin());

CREATE POLICY "activity_logs_insert" ON viralizahost.activity_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- GRANT: anon e authenticated acedem ao schema
-- ============================================================

GRANT USAGE ON SCHEMA viralizahost TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA viralizahost TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA viralizahost TO authenticated;
GRANT SELECT ON viralizahost.plans TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA viralizahost TO authenticated, service_role;

-- ============================================================
-- SEED: Planos iniciais
-- ============================================================

INSERT INTO viralizahost.plans (slug, name, type, description, features, price_akz, price_brl, price_usd, disk_gb, bandwidth_gb, email_accounts, max_domains, max_subdomains, max_databases, is_popular, sort_order)
VALUES
(
  'starter', 'Starter', 'shared', 'Perfeito para iniciar sua presença online',
  '["1 Site","10 GB NVMe SSD","100 GB Banda","5 Emails","SSL Grátis","cPanel","Suporte 24/7"]',
  4500, 19.90, 3.99, 10, 100, 5, 1, 5, 3, false, 1
),
(
  'business', 'Business', 'shared', 'Ideal para pequenas e médias empresas',
  '["5 Sites","50 GB NVMe SSD","Banda Ilimitada","20 Emails","SSL Grátis","cPanel","Backup Diário","IP Dedicado"]',
  9500, 39.90, 7.99, 50, 0, 20, 5, 20, 10, true, 2
),
(
  'premium', 'Premium', 'shared', 'Para empresas que exigem máxima performance',
  '["Sites Ilimitados","200 GB NVMe SSD","Banda Ilimitada","Emails Ilimitados","SSL Grátis","cPanel","Backup Diário","IP Dedicado","CDN Global","Suporte Prioritário"]',
  19500, 79.90, 15.99, 200, 0, 0, 0, 0, 0, false, 3
),
(
  'reseller', 'Reseller WHM', 'reseller', 'Para revendedores e agências digitais',
  '["WHM + cPanel","500 GB NVMe SSD","Banda Ilimitada","Contas Ilimitadas","SSL Grátis","WHMCS Incluso","Marca Branca","Suporte Dedicado"]',
  45000, 199.90, 39.99, 500, 0, 0, 0, 0, 0, false, 4
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_akz = EXCLUDED.price_akz,
  price_brl = EXCLUDED.price_brl,
  price_usd = EXCLUDED.price_usd,
  updated_at = now();
