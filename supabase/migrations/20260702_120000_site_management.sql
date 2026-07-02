-- ============================================================
-- ViralizaHost — Gestão do Site: tabelas para módulos públicos
-- Schema: viralizahost
-- ============================================================

-- Banners/slides do hero
CREATE TABLE viralizahost.site_banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  bg_image text,
  bg_color text DEFAULT '#000000',
  accent_color text DEFAULT '#F5B700',
  tag text,
  title text,
  subtitle text,
  cta_text text,
  cta_href text,
  cta_secondary_text text,
  cta_secondary_href text,
  features text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Domínios disponíveis
CREATE TABLE viralizahost.site_domains (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  extension text NOT NULL,
  price_monthly numeric(10,2),
  price_annual numeric(10,2),
  currency text DEFAULT 'AOA',
  popular boolean DEFAULT false,
  active boolean DEFAULT true,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Planos de email corporativo
CREATE TABLE viralizahost.site_email_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  badge text,
  price_monthly numeric(10,2),
  price_annual numeric(10,2),
  discount_annual int DEFAULT 0,
  features text[],
  active boolean DEFAULT true,
  featured boolean DEFAULT false,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Equipa / Estrutura organizacional
CREATE TABLE viralizahost.site_team (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  is_ceo boolean DEFAULT false,
  name text NOT NULL,
  role text,
  title text DEFAULT 'Especialista',
  bio text,
  photo_url text,
  flag text,
  country text,
  accent_color text DEFAULT '#F5B700',
  position int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Planos de hospedagem
CREATE TABLE viralizahost.site_hosting_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  badge text,
  price_monthly numeric(10,2),
  price_annual numeric(10,2),
  discount_annual int DEFAULT 0,
  features text[],
  active boolean DEFAULT true,
  featured boolean DEFAULT false,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE viralizahost.site_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_email_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.site_hosting_plans ENABLE ROW LEVEL SECURITY;

-- Leitura pública
CREATE POLICY "public_read_banners" ON viralizahost.site_banners FOR SELECT USING (active = true);
CREATE POLICY "public_read_domains" ON viralizahost.site_domains FOR SELECT USING (active = true);
CREATE POLICY "public_read_email_plans" ON viralizahost.site_email_plans FOR SELECT USING (active = true);
CREATE POLICY "public_read_team" ON viralizahost.site_team FOR SELECT USING (active = true);
CREATE POLICY "public_read_hosting_plans" ON viralizahost.site_hosting_plans FOR SELECT USING (active = true);

-- Admin acesso total
CREATE POLICY "admin_all_banners" ON viralizahost.site_banners FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_domains" ON viralizahost.site_domains FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_email_plans" ON viralizahost.site_email_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_team" ON viralizahost.site_team FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all_hosting_plans" ON viralizahost.site_hosting_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
