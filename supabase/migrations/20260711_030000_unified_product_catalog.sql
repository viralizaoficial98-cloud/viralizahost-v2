-- ============================================================
-- Migration: Unified Product Catalog
-- Date: 2026-07-11
-- Description: Add new columns to products table and upsert the
--              complete product catalog (hosting, wordpress, email,
--              reseller, vps, dedicated, domain, website-builder).
--              Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. ADD COLUMNS (IF NOT EXISTS)
-- ============================================================

ALTER TABLE viralizahost.products
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS cta_label   text,
  ADD COLUMN IF NOT EXISTS cta_url     text,
  ADD COLUMN IF NOT EXISTS currency    text NOT NULL DEFAULT 'AOA';

-- ============================================================
-- 2. ENSURE RLS POLICIES ARE CORRECT
-- ============================================================

-- anon can SELECT active products
DROP POLICY IF EXISTS "public read products" ON viralizahost.products;
CREATE POLICY "public read products" ON viralizahost.products
  FOR SELECT USING (active = true);

-- authenticated admin can do everything
DROP POLICY IF EXISTS "admin all products" ON viralizahost.products;
CREATE POLICY "admin all products" ON viralizahost.products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM viralizahost.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "public read features" ON viralizahost.product_features;
CREATE POLICY "public read features" ON viralizahost.product_features
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin all features" ON viralizahost.product_features;
CREATE POLICY "admin all features" ON viralizahost.product_features
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM viralizahost.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Grants
GRANT SELECT ON viralizahost.products TO anon, authenticated;
GRANT ALL    ON viralizahost.products TO service_role;
GRANT SELECT ON viralizahost.product_features TO anon, authenticated;
GRANT ALL    ON viralizahost.product_features TO service_role;

-- ============================================================
-- 3. UPSERT ALL PRIMARY PRODUCTS
-- ============================================================

-- ── 3.1  HOSTING ─────────────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('hosting-start',    'hosting', NULL, 'Plano Start',    'Ideal para sites pessoais e blogs',   NULL,          false, true, 1,
   19900, 16915, 13930, 10945,  8955, 'Começar com Start',    NULL, 'AOA'),
  ('hosting-business', 'hosting', NULL, 'Plano Business', 'Para pequenas e médias empresas',      'MAIS POPULAR', true,  true, 2,
   39900, 33915, 27930, 21945, 17955, 'Começar com Business', NULL, 'AOA'),
  ('hosting-turbo',    'hosting', NULL, 'Plano Turbo',    'Performance máxima sem limites',       'MELHOR VALOR', false, true, 3,
   79900, 67915, 55930, 43945, 35955, 'Começar com Turbo',    NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.2  WORDPRESS ───────────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('wp-start', 'wordpress', NULL, 'WordPress Start', 'Para blogs e sites simples',        NULL,           false, true, 1,
   24900, 21165, 17430, 13695, 11205, 'Contratar WordPress Start', NULL, 'AOA'),
  ('wp-pro',   'wordpress', NULL, 'WordPress Pro',   'Para empresas e e-commerce',        'MAIS POPULAR', true,  true, 2,
   49900, 42415, 34930, 27445, 22455, 'Contratar WordPress Pro',   NULL, 'AOA'),
  ('wp-turbo', 'wordpress', NULL, 'WordPress Turbo', 'Para alta performance e escala',    'MELHOR VALOR', false, true, 3,
   99900, 84915, 69930, 54945, 44955, 'Contratar WordPress Turbo', NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.3  EMAIL ───────────────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('email-starter',        'email', NULL, 'Email Starter',        'Para pequenas equipas',          NULL,           false, true, 1,
    6800,  5780,  4760,  3740, 3060, 'Contratar Email Starter',  NULL, 'AOA'),
  ('email-standard',       'email', NULL, 'Email Standard',       'Para equipas em crescimento',    'MAIS POPULAR', true,  true, 2,
   14800, 12580, 10360,  8140, 6660, 'Contratar Email Standard', NULL, 'AOA'),
  ('email-premium',        'email', NULL, 'Email Premium',        'Para empresas estabelecidas',    'MELHOR VALOR', false, true, 3,
   28000, 23800, 19600, 15400,12600, 'Contratar Email Premium',  NULL, 'AOA'),
  ('microsoft-365-outlook','email', NULL, 'Microsoft 365 Outlook','Ecossistema Microsoft completo', NULL,           false, true, 4,
   52000, 44200, 36400, 28600,23400, 'Contratar Microsoft 365',  NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.4  RESELLER ────────────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('reseller-start',      'reseller', NULL, 'Revenda Start',      'Para começar no mercado de revenda', NULL,           false, true, 1,
    59900,  50915,  41930,  32945, 26955, 'Começar Revenda Start',      NULL,      'AOA'),
  ('reseller-growth',     'reseller', NULL, 'Revenda Growth',     'Para agências em crescimento',       'MAIS POPULAR', true,  true, 2,
    99900,  84915,  69930,  54945, 44955, 'Começar Revenda Growth',     NULL,      'AOA'),
  ('reseller-business',   'reseller', NULL, 'Revenda Business',   'Para empresas estabelecidas',        'MELHOR VALOR', false, true, 3,
   179900, 152915, 125930,  98945, 80955, 'Começar Revenda Business',   NULL,      'AOA'),
  ('reseller-enterprise', 'reseller', NULL, 'Revenda Enterprise', 'Infraestrutura sem limites',         'ENTERPRISE',   false, true, 4,
    NULL,    NULL,    NULL,   NULL,  NULL, 'Contatar Comercial',         '/tickets','AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.5  VPS — Main ──────────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('vps-nvme2', 'vps', NULL, 'VPS NVMe 2', 'Para projectos iniciais',       NULL,           false, true, 1,
    45000,  38250,  31500, 24750, 20250, 'Contratar VPS NVMe 2', NULL, 'AOA'),
  ('vps-nvme4', 'vps', NULL, 'VPS NVMe 4', 'Para aplicações e e-commerce',  'MAIS POPULAR', true,  true, 2,
    85000,  72250,  59500, 46750, 38250, 'Contratar VPS NVMe 4', NULL, 'AOA'),
  ('vps-nvme8', 'vps', NULL, 'VPS NVMe 8', 'Para alta demanda e escala',    'MELHOR VALOR', false, true, 3,
   159000, 135150, 111300, 87450, 71550, 'Contratar VPS NVMe 8', NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.6  VPS — n8n ───────────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('vps-n8n-start', 'vps', 'n8n', 'n8n Start', 'Para começar com automações',           NULL,           false, true, 1,
    55000,  46750,  38500, 30250, 24750, 'Começar com n8n Start', NULL, 'AOA'),
  ('vps-n8n-pro',   'vps', 'n8n', 'n8n Pro',   'Para agências e equipas',               'MAIS POPULAR', true,  true, 2,
    99000,  84150,  69300, 54450, 44550, 'Começar com n8n Pro',   NULL, 'AOA'),
  ('vps-n8n-scale', 'vps', 'n8n', 'n8n Scale', 'Para alta demanda e múltiplas equipas', 'MELHOR VALOR', false, true, 3,
   179000, 152150, 125300, 98450, 80550, 'Começar com n8n Scale', NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.7  VPS — OpenClaw ──────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('vps-openclaw-start', 'vps', 'openclaw', 'OpenClaw Start', 'Para experimentar agentes de IA',  NULL,           false, true, 1,
    65000,  55250,  45500, 35750, 29250, 'Começar com OpenClaw Start', NULL, 'AOA'),
  ('vps-openclaw-pro',   'vps', 'openclaw', 'OpenClaw Pro',   'Para equipas e empresas',           'MAIS POPULAR', true,  true, 2,
   119000, 101150,  83300, 65450, 53550, 'Começar com OpenClaw Pro',   NULL, 'AOA'),
  ('vps-openclaw-scale', 'vps', 'openclaw', 'OpenClaw Scale', 'Para operações de larga escala',    'MELHOR VALOR', false, true, 3,
   219000, 186150, 153300,120450, 98550, 'Começar com OpenClaw Scale', NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.8  VPS — Evolution API ─────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('vps-evolution-start', 'vps', 'evolution-api', 'Evolution Start', 'Para começar com WhatsApp API',           NULL,           false, true, 1,
    69000,  58650,  48300,  37950, 31050, 'Começar com Evolution Start', NULL, 'AOA'),
  ('vps-evolution-pro',   'vps', 'evolution-api', 'Evolution Pro',   'Para empresas e agências',                'MAIS POPULAR', true,  true, 2,
   129000, 109650,  90300,  70950, 58050, 'Começar com Evolution Pro',   NULL, 'AOA'),
  ('vps-evolution-scale', 'vps', 'evolution-api', 'Evolution Scale', 'Para alto volume e múltiplas empresas',   'MELHOR VALOR', false, true, 3,
   249000, 211650, 174300, 136950,112050, 'Começar com Evolution Scale', NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.9  VPS — Viraliza AI Cloud ─────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('vps-ai-cloud-start',      'vps', 'viraliza-ai-cloud', 'AI Cloud Start',      'Para começar com agentes de IA',   NULL,           false, true, 1,
    89000, 75650, 62300, 48950, 40050, 'Começar com AI Cloud Start',      NULL,      'AOA'),
  ('vps-ai-cloud-pro',        'vps', 'viraliza-ai-cloud', 'AI Cloud Pro',        'Para empresas e equipas',           'MAIS POPULAR', true,  true, 2,
   169000,143650,118300, 92950, 76050, 'Começar com AI Cloud Pro',        NULL,      'AOA'),
  ('vps-ai-cloud-enterprise', 'vps', 'viraliza-ai-cloud', 'AI Cloud Enterprise', 'Para grandes operações com IA',     'ENTERPRISE',   false, true, 3,
   349000,  NULL,  NULL,  NULL,  NULL, 'Contatar Comercial',              '/tickets','AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.10 DEDICATED LINUX ─────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('ded-16',  'dedicated', NULL, 'Dedicado NVMe 16',  'Para sistemas e aplicações de médio porte', NULL,           false, true, 1,
   249000, 211650, 174300, 136950, 112050, 'Contratar NVMe 16',  NULL,      'AOA'),
  ('ded-32',  'dedicated', NULL, 'Dedicado NVMe 32',  'Para projectos de alta demanda',            'MAIS POPULAR', true,  true, 2,
   449000, 381650, 314300, 246950, 202050, 'Contratar NVMe 32',  NULL,      'AOA'),
  ('ded-64',  'dedicated', NULL, 'Dedicado NVMe 64',  'Para infra-estruturas empresariais',        'MELHOR VALOR', false, true, 3,
   799000, 679150, 559300, 439450, 359550, 'Contratar NVMe 64',  NULL,      'AOA'),
  ('ded-128', 'dedicated', NULL, 'Dedicado NVMe 128', 'Infra-estrutura exclusiva máxima',          NULL,           false, true, 4,
     NULL,    NULL,    NULL,    NULL,    NULL, 'Contatar Comercial', '/tickets','AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.11 DEDICATED WINDOWS ───────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('win-black',    'dedicated-windows', NULL, 'Black',    'Para projectos iniciais Windows',    NULL,           false, true, 1,
   299000, 254150, 209300, 164450, 134550, 'Contratar Black',    NULL, 'AOA'),
  ('win-sapphire', 'dedicated-windows', NULL, 'Sapphire', 'Para sistemas empresariais',          'MAIS POPULAR', true,  true, 2,
   549000, 466650, 384300, 301950, 247050, 'Contratar Sapphire', NULL, 'AOA'),
  ('win-diamond',  'dedicated-windows', NULL, 'Diamond',  'Máxima performance para MS SQL',      'MELHOR VALOR', false, true, 3,
   999000, 849150, 699300, 549450, 449550, 'Contratar Diamond',  NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.12 AI SITE BUILDER ─────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('ia-starter',  'website-builder', NULL, 'IA Starter',  'Para começar com IA',              NULL,           false, true, 1,
   14900, 12665, 10430, 8195, 6705, 'Criar Meu Site',      NULL, 'AOA'),
  ('ia-pro',      'website-builder', NULL, 'IA Pro',      'Para empresas e profissionais',     'MAIS POPULAR', true,  true, 2,
   29900, 25415, 20930,16445,13455, 'Criar com IA Pro',    NULL, 'AOA'),
  ('ia-business', 'website-builder', NULL, 'IA Business', 'Para lojas e alto tráfego',         'MELHOR VALOR', false, true, 3,
   59900, 50915, 41930,32945,26955, 'Criar com IA Business',NULL,'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ── 3.13 DOMAINS ─────────────────────────────────────────────
INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  ('domain-com',    'domain', NULL, 'Domínio .com',    'O domínio mais popular do mundo', NULL,   false, true, 1,
   NULL, NULL, 4500, NULL, NULL, 'Registar .com',    NULL, 'AOA'),
  ('domain-net',    'domain', NULL, 'Domínio .net',    'Ideal para tecnologia e redes',   NULL,   false, true, 2,
   NULL, NULL, 5200, NULL, NULL, 'Registar .net',    NULL, 'AOA'),
  ('domain-org',    'domain', NULL, 'Domínio .org',    'Para organizações e nonprofits',  NULL,   false, true, 3,
   NULL, NULL, 4800, NULL, NULL, 'Registar .org',    NULL, 'AOA'),
  ('domain-ao',     'domain', NULL, 'Domínio .ao',     'O domínio nacional de Angola',    'LOCAL', true, true, 4,
   NULL, NULL, 8000, NULL, NULL, 'Registar .ao',     NULL, 'AOA'),
  ('domain-co-ao',  'domain', NULL, 'Domínio .co.ao',  'Empresas angolanas',              NULL,   false, true, 5,
   NULL, NULL, 7500, NULL, NULL, 'Registar .co.ao',  NULL, 'AOA'),
  ('domain-com-br', 'domain', NULL, 'Domínio .com.br', 'Para o mercado brasileiro',       NULL,   false, true, 6,
   NULL, NULL, 4900, NULL, NULL, 'Registar .com.br', NULL, 'AOA'),
  ('domain-io',     'domain', NULL, 'Domínio .io',     'Para startups e tecnologia',      NULL,   false, true, 7,
   NULL, NULL,18000, NULL, NULL, 'Registar .io',     NULL, 'AOA')
ON CONFLICT (slug) DO UPDATE SET
  category      = EXCLUDED.category,
  subcategory   = EXCLUDED.subcategory,
  name          = EXCLUDED.name,
  description   = EXCLUDED.description,
  badge         = EXCLUDED.badge,
  popular       = EXCLUDED.popular,
  active        = EXCLUDED.active,
  position      = EXCLUDED.position,
  price_monthly = EXCLUDED.price_monthly,
  price_6months = EXCLUDED.price_6months,
  price_1year   = EXCLUDED.price_1year,
  price_2years  = EXCLUDED.price_2years,
  price_3years  = EXCLUDED.price_3years,
  cta_label     = EXCLUDED.cta_label,
  cta_url       = EXCLUDED.cta_url,
  currency      = EXCLUDED.currency,
  updated_at    = now();

-- ============================================================
-- 4. PRODUCT FEATURES
--    Delete-then-reinsert for each primary slug to keep clean.
--    Uses a DO $$ block per product to avoid multiple-row CTE issues.
-- ============================================================

DO $$
DECLARE
  v_id uuid;
BEGIN

  -- ── HOSTING: Start ─────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'hosting-start';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '1 site hospedado',    true,  1),
      (v_id, '20 GB NVMe SSD',      true,  2),
      (v_id, 'SSL grátis',          true,  3),
      (v_id, 'cPanel incluído',     true,  4),
      (v_id, '5 contas de e-mail',  true,  5),
      (v_id, 'Backup semanal',      true,  6),
      (v_id, 'Migração gratuita',   true,  7),
      (v_id, 'Suporte 24/7',        true,  8),
      (v_id, 'Sites ilimitados',    false, 9),
      (v_id, 'CDN global',          false, 10);
  END IF;

  -- ── HOSTING: Business ──────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'hosting-business';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '10 sites hospedados',        true,  1),
      (v_id, '50 GB NVMe SSD',             true,  2),
      (v_id, 'SSL grátis',                 true,  3),
      (v_id, 'cPanel incluído',            true,  4),
      (v_id, '25 contas de e-mail',        true,  5),
      (v_id, 'Backup diário',              true,  6),
      (v_id, 'CDN global',                 true,  7),
      (v_id, 'Migração gratuita',          true,  8),
      (v_id, 'Suporte prioritário 24/7',   true,  9),
      (v_id, 'Sites ilimitados',           false, 10);
  END IF;

  -- ── HOSTING: Turbo ─────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'hosting-turbo';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Sites ilimitados',           true,  1),
      (v_id, '100 GB NVMe SSD',            true,  2),
      (v_id, 'SSL grátis',                 true,  3),
      (v_id, 'cPanel incluído',            true,  4),
      (v_id, 'E-mail ilimitado',           true,  5),
      (v_id, 'Backup diário automático',   true,  6),
      (v_id, 'CDN global premium',         true,  7),
      (v_id, 'Criador de Sites com IA',    true,  8),
      (v_id, 'Migração gratuita',          true,  9),
      (v_id, 'Suporte premium 24/7',       true,  10);
  END IF;

  -- ── WORDPRESS: Start ───────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'wp-start';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '1 site WordPress',       true,  1),
      (v_id, '20 GB NVMe SSD',         true,  2),
      (v_id, 'WordPress pré-instalado',true,  3),
      (v_id, 'SSL grátis',             true,  4),
      (v_id, 'Backup semanal',         true,  5),
      (v_id, 'Migração gratuita',      true,  6),
      (v_id, 'Suporte 24/7',           true,  7),
      (v_id, 'CDN global',             false, 8),
      (v_id, 'Criador IA',             false, 9),
      (v_id, 'Staging',                false, 10);
  END IF;

  -- ── WORDPRESS: Pro ─────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'wp-pro';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '5 sites WordPress',            true,  1),
      (v_id, '50 GB NVMe SSD',               true,  2),
      (v_id, 'WordPress pré-instalado',      true,  3),
      (v_id, 'SSL grátis',                   true,  4),
      (v_id, 'CDN global',                   true,  5),
      (v_id, 'Backup diário',                true,  6),
      (v_id, 'Criador de Sites com IA',      true,  7),
      (v_id, 'Otimização SEO automática',    true,  8),
      (v_id, 'Migração gratuita',            true,  9),
      (v_id, 'Suporte prioritário 24/7',     true,  10);
  END IF;

  -- ── WORDPRESS: Turbo ───────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'wp-turbo';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Sites WordPress ilimitados',   true,  1),
      (v_id, '200 GB NVMe SSD',              true,  2),
      (v_id, 'WordPress pré-instalado',      true,  3),
      (v_id, 'SSL grátis',                   true,  4),
      (v_id, 'CDN global premium',           true,  5),
      (v_id, 'Backup diário automático',     true,  6),
      (v_id, 'Criador de Sites com IA',      true,  7),
      (v_id, 'Otimização SEO avançada',      true,  8),
      (v_id, 'Ambiente staging',             true,  9),
      (v_id, 'IP dedicado',                  true,  10),
      (v_id, 'Suporte premium 24/7',         true,  11);
  END IF;

  -- ── EMAIL: Starter ─────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'email-starter';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '5 contas de e-mail',         true,  1),
      (v_id, '5 GB por caixa',             true,  2),
      (v_id, 'Webmail incluído',           true,  3),
      (v_id, 'Anti-spam avançado',         true,  4),
      (v_id, 'SSL/TLS',                   true,  5),
      (v_id, 'Suporte 24/7',              true,  6),
      (v_id, 'Alias ilimitados',           false, 7),
      (v_id, 'Calendário e contactos',     false, 8);
  END IF;

  -- ── EMAIL: Standard ────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'email-standard';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '25 contas de e-mail',        true,  1),
      (v_id, '10 GB por caixa',            true,  2),
      (v_id, 'Webmail incluído',           true,  3),
      (v_id, 'Anti-spam avançado',         true,  4),
      (v_id, 'SSL/TLS',                   true,  5),
      (v_id, 'Alias ilimitados',           true,  6),
      (v_id, 'Calendário e contactos',     true,  7),
      (v_id, 'Suporte prioritário 24/7',   true,  8);
  END IF;

  -- ── EMAIL: Premium ─────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'email-premium';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Contas ilimitadas',          true,  1),
      (v_id, '25 GB por caixa',            true,  2),
      (v_id, 'Webmail incluído',           true,  3),
      (v_id, 'Anti-spam + anti-vírus',     true,  4),
      (v_id, 'SSL/TLS',                   true,  5),
      (v_id, 'Alias ilimitados',           true,  6),
      (v_id, 'Calendário e contactos',     true,  7),
      (v_id, 'Backup diário',              true,  8),
      (v_id, 'Suporte premium 24/7',       true,  9);
  END IF;

  -- ── EMAIL: Microsoft 365 ───────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'microsoft-365-outlook';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Outlook + Exchange',              true,  1),
      (v_id, '50 GB por caixa',                 true,  2),
      (v_id, 'Office 365 Apps incluídas',       true,  3),
      (v_id, 'Teams + SharePoint',              true,  4),
      (v_id, 'OneDrive 1 TB',                   true,  5),
      (v_id, 'Anti-spam Microsoft Defender',    true,  6),
      (v_id, 'Suporte prioritário 24/7',        true,  7);
  END IF;

  -- ── RESELLER: Start ────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'reseller-start';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '20 contas cPanel',      true,  1),
      (v_id, '100 GB NVMe SSD',       true,  2),
      (v_id, 'WHM Reseller Panel',    true,  3),
      (v_id, 'SSL grátis',            true,  4),
      (v_id, 'Suporte 24/7',          true,  5),
      (v_id, 'Migração gratuita',     true,  6),
      (v_id, 'Marca branca',          false, 7),
      (v_id, 'IP dedicado',           false, 8);
  END IF;

  -- ── RESELLER: Growth ───────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'reseller-growth';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '50 contas cPanel',           true,  1),
      (v_id, '250 GB NVMe SSD',            true,  2),
      (v_id, 'WHM Reseller Panel',         true,  3),
      (v_id, 'SSL grátis',                 true,  4),
      (v_id, 'Marca branca',               true,  5),
      (v_id, 'Suporte prioritário 24/7',   true,  6),
      (v_id, 'Migração gratuita',          true,  7),
      (v_id, 'IP dedicado',                false, 8);
  END IF;

  -- ── RESELLER: Business ─────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'reseller-business';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Contas cPanel ilimitadas',   true,  1),
      (v_id, '500 GB NVMe SSD',            true,  2),
      (v_id, 'WHM Reseller Panel',         true,  3),
      (v_id, 'SSL grátis',                 true,  4),
      (v_id, 'Marca branca',               true,  5),
      (v_id, 'IP dedicado',                true,  6),
      (v_id, 'Backup diário',              true,  7),
      (v_id, 'Suporte prioritário 24/7',   true,  8),
      (v_id, 'Migração gratuita',          true,  9);
  END IF;

  -- ── RESELLER: Enterprise ───────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'reseller-enterprise';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Contas cPanel ilimitadas',   true,  1),
      (v_id, '1 TB NVMe SSD',             true,  2),
      (v_id, 'WHM Reseller Panel',         true,  3),
      (v_id, 'SSL grátis',                 true,  4),
      (v_id, 'Marca branca',               true,  5),
      (v_id, 'IPs dedicados múltiplos',    true,  6),
      (v_id, 'Backup diário automático',   true,  7),
      (v_id, 'SLA premium',                true,  8),
      (v_id, 'Suporte VIP 24/7',           true,  9),
      (v_id, 'Migração gratuita',          true,  10);
  END IF;

  -- ── VPS: NVMe 2 ────────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-nvme2';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '2 vCPU',                   true,  1),
      (v_id, '4 GB RAM DDR5',            true,  2),
      (v_id, '60 GB NVMe SSD',           true,  3),
      (v_id, 'IP dedicado',              true,  4),
      (v_id, 'Transferência ilimitada',  true,  5),
      (v_id, 'Root access',              true,  6),
      (v_id, 'Migração grátis',          true,  7),
      (v_id, 'Suporte 24/7',             true,  8),
      (v_id, 'cPanel',                   false, 9),
      (v_id, 'Backup gerido',            false, 10);
  END IF;

  -- ── VPS: NVMe 4 ────────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-nvme4';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '4 vCPU',                   true,  1),
      (v_id, '8 GB RAM DDR5',            true,  2),
      (v_id, '120 GB NVMe SSD',          true,  3),
      (v_id, 'IP dedicado',              true,  4),
      (v_id, 'Transferência ilimitada',  true,  5),
      (v_id, 'Root access',              true,  6),
      (v_id, 'cPanel opcional',          true,  7),
      (v_id, 'Backup semanal gerido',    true,  8),
      (v_id, 'Migração grátis',          true,  9),
      (v_id, 'Suporte prioritário 24/7', true,  10);
  END IF;

  -- ── VPS: NVMe 8 ────────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-nvme8';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '8 vCPU',                   true,  1),
      (v_id, '16 GB RAM DDR5',           true,  2),
      (v_id, '240 GB NVMe SSD',          true,  3),
      (v_id, 'IP dedicado',              true,  4),
      (v_id, 'Transferência ilimitada',  true,  5),
      (v_id, 'Root access',              true,  6),
      (v_id, 'cPanel incluído',          true,  7),
      (v_id, 'Backup diário gerido',     true,  8),
      (v_id, 'Migração grátis',          true,  9),
      (v_id, 'Snapshots',                true,  10),
      (v_id, 'Suporte premium 24/7',     true,  11);
  END IF;

  -- ── VPS: n8n Start ─────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-n8n-start';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '2 vCPU',                     true,  1),
      (v_id, '4 GB RAM',                   true,  2),
      (v_id, '60 GB NVMe SSD',             true,  3),
      (v_id, 'n8n pré-instalado',          true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Suporte 24/7',               true,  7),
      (v_id, 'Workflows ilimitados',       false, 8),
      (v_id, 'Backup gerido',              false, 9);
  END IF;

  -- ── VPS: n8n Pro ───────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-n8n-pro';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '4 vCPU',                     true,  1),
      (v_id, '8 GB RAM',                   true,  2),
      (v_id, '120 GB NVMe SSD',            true,  3),
      (v_id, 'n8n pré-instalado',          true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Workflows ilimitados',       true,  7),
      (v_id, 'Backup semanal gerido',      true,  8),
      (v_id, 'Suporte prioritário 24/7',   true,  9);
  END IF;

  -- ── VPS: n8n Scale ─────────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-n8n-scale';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '8 vCPU',                     true,  1),
      (v_id, '16 GB RAM',                  true,  2),
      (v_id, '240 GB NVMe SSD',            true,  3),
      (v_id, 'n8n pré-instalado',          true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Workflows ilimitados',       true,  7),
      (v_id, 'Backup diário gerido',       true,  8),
      (v_id, 'Snapshots',                  true,  9),
      (v_id, 'Suporte premium 24/7',       true,  10);
  END IF;

  -- ── VPS: OpenClaw Start ────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-openclaw-start';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '2 vCPU',                     true,  1),
      (v_id, '4 GB RAM',                   true,  2),
      (v_id, '60 GB NVMe SSD',             true,  3),
      (v_id, 'OpenClaw pré-instalado',     true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Suporte 24/7',               true,  7),
      (v_id, 'Agentes de IA ilimitados',   false, 8),
      (v_id, 'Backup gerido',              false, 9);
  END IF;

  -- ── VPS: OpenClaw Pro ──────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-openclaw-pro';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '4 vCPU',                     true,  1),
      (v_id, '8 GB RAM',                   true,  2),
      (v_id, '120 GB NVMe SSD',            true,  3),
      (v_id, 'OpenClaw pré-instalado',     true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Agentes de IA ilimitados',   true,  7),
      (v_id, 'Backup semanal gerido',      true,  8),
      (v_id, 'Suporte prioritário 24/7',   true,  9);
  END IF;

  -- ── VPS: OpenClaw Scale ────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-openclaw-scale';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '8 vCPU',                     true,  1),
      (v_id, '16 GB RAM',                  true,  2),
      (v_id, '240 GB NVMe SSD',            true,  3),
      (v_id, 'OpenClaw pré-instalado',     true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Agentes de IA ilimitados',   true,  7),
      (v_id, 'Backup diário gerido',       true,  8),
      (v_id, 'Snapshots',                  true,  9),
      (v_id, 'Suporte premium 24/7',       true,  10);
  END IF;

  -- ── VPS: Evolution Start ───────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-evolution-start';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '2 vCPU',                         true,  1),
      (v_id, '4 GB RAM',                        true,  2),
      (v_id, '60 GB NVMe SSD',                  true,  3),
      (v_id, 'Evolution API pré-instalado',     true,  4),
      (v_id, 'IP dedicado',                     true,  5),
      (v_id, 'SSL grátis',                      true,  6),
      (v_id, 'Suporte 24/7',                    true,  7),
      (v_id, 'Instâncias WhatsApp ilimitadas',  false, 8),
      (v_id, 'Backup gerido',                   false, 9);
  END IF;

  -- ── VPS: Evolution Pro ─────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-evolution-pro';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '4 vCPU',                          true,  1),
      (v_id, '8 GB RAM',                         true,  2),
      (v_id, '120 GB NVMe SSD',                  true,  3),
      (v_id, 'Evolution API pré-instalado',      true,  4),
      (v_id, 'IP dedicado',                      true,  5),
      (v_id, 'SSL grátis',                       true,  6),
      (v_id, 'Instâncias WhatsApp ilimitadas',   true,  7),
      (v_id, 'Backup semanal gerido',            true,  8),
      (v_id, 'Suporte prioritário 24/7',         true,  9);
  END IF;

  -- ── VPS: Evolution Scale ───────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-evolution-scale';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '8 vCPU',                          true,  1),
      (v_id, '16 GB RAM',                        true,  2),
      (v_id, '240 GB NVMe SSD',                  true,  3),
      (v_id, 'Evolution API pré-instalado',      true,  4),
      (v_id, 'IP dedicado',                      true,  5),
      (v_id, 'SSL grátis',                       true,  6),
      (v_id, 'Instâncias WhatsApp ilimitadas',   true,  7),
      (v_id, 'Backup diário gerido',             true,  8),
      (v_id, 'Snapshots',                        true,  9),
      (v_id, 'Suporte premium 24/7',             true,  10);
  END IF;

  -- ── VPS: AI Cloud Start ────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-ai-cloud-start';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '4 vCPU',                     true,  1),
      (v_id, '8 GB RAM',                   true,  2),
      (v_id, '100 GB NVMe SSD',            true,  3),
      (v_id, 'Stack IA pré-instalada',     true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Suporte 24/7',               true,  7),
      (v_id, 'Agentes ilimitados',         false, 8),
      (v_id, 'Backup gerido',              false, 9);
  END IF;

  -- ── VPS: AI Cloud Pro ──────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-ai-cloud-pro';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '8 vCPU',                     true,  1),
      (v_id, '16 GB RAM',                  true,  2),
      (v_id, '200 GB NVMe SSD',            true,  3),
      (v_id, 'Stack IA pré-instalada',     true,  4),
      (v_id, 'IP dedicado',                true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Agentes ilimitados',         true,  7),
      (v_id, 'Backup diário gerido',       true,  8),
      (v_id, 'Suporte prioritário 24/7',   true,  9);
  END IF;

  -- ── VPS: AI Cloud Enterprise ───────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'vps-ai-cloud-enterprise';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '16+ vCPU',                   true,  1),
      (v_id, '32+ GB RAM',                 true,  2),
      (v_id, '500+ GB NVMe SSD',           true,  3),
      (v_id, 'Stack IA pré-instalada',     true,  4),
      (v_id, 'IPs dedicados múltiplos',    true,  5),
      (v_id, 'SSL grátis',                 true,  6),
      (v_id, 'Agentes ilimitados',         true,  7),
      (v_id, 'Backup diário + offsite',    true,  8),
      (v_id, 'SLA enterprise',             true,  9),
      (v_id, 'Gestor de infra dedicado',   true,  10),
      (v_id, 'Suporte VIP 24/7',           true,  11);
  END IF;

  -- ── DEDICATED: NVMe 16 ─────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'ded-16';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '16 vCPU dedicadas',         true,  1),
      (v_id, '32 GB RAM DDR5',            true,  2),
      (v_id, '480 GB NVMe SSD',           true,  3),
      (v_id, '2 IPs dedicados',           true,  4),
      (v_id, 'cPanel/WHM opcional',       true,  5),
      (v_id, 'SSL grátis',                true,  6),
      (v_id, 'Migração gratuita',         true,  7),
      (v_id, 'Suporte técnico 24/7',      true,  8),
      (v_id, 'IPs adicionais',            false, 9),
      (v_id, 'Backup gerido diário',      false, 10);
  END IF;

  -- ── DEDICATED: NVMe 32 ─────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'ded-32';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '32 vCPU dedicadas',         true,  1),
      (v_id, '64 GB RAM DDR5',            true,  2),
      (v_id, '960 GB NVMe SSD',           true,  3),
      (v_id, '4 IPs dedicados',           true,  4),
      (v_id, 'cPanel/WHM incluído',       true,  5),
      (v_id, 'SSL grátis',                true,  6),
      (v_id, 'Backup semanal gerido',     true,  7),
      (v_id, 'Migração gratuita',         true,  8),
      (v_id, 'Suporte prioritário 24/7',  true,  9);
  END IF;

  -- ── DEDICATED: NVMe 64 ─────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'ded-64';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '64 vCPU dedicadas',         true,  1),
      (v_id, '128 GB RAM DDR5',           true,  2),
      (v_id, '1.920 GB NVMe SSD',         true,  3),
      (v_id, '8 IPs dedicados',           true,  4),
      (v_id, 'cPanel/WHM incluído',       true,  5),
      (v_id, 'SSL grátis',                true,  6),
      (v_id, 'Backup diário gerido',      true,  7),
      (v_id, 'Migração gratuita',         true,  8),
      (v_id, 'Snapshots',                 true,  9),
      (v_id, 'SLA premium',               true,  10),
      (v_id, 'Suporte premium 24/7',      true,  11);
  END IF;

  -- ── DEDICATED: NVMe 128 ────────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'ded-128';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '128 vCPU dedicadas',        true,  1),
      (v_id, '256 GB RAM DDR5',           true,  2),
      (v_id, '3.840 GB NVMe SSD',         true,  3),
      (v_id, 'IPs dedicados ilimitados',  true,  4),
      (v_id, 'cPanel/WHM incluído',       true,  5),
      (v_id, 'SSL grátis',                true,  6),
      (v_id, 'Backup diário + offsite',   true,  7),
      (v_id, 'Gerente de infra-estrutura',true,  8),
      (v_id, 'SLA enterprise',            true,  9),
      (v_id, 'Suporte VIP 24/7',          true,  10);
  END IF;

  -- ── DEDICATED WINDOWS: Black ───────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'win-black';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '16 vCPU dedicadas',         true,  1),
      (v_id, '32 GB RAM DDR5',            true,  2),
      (v_id, '480 GB NVMe SSD',           true,  3),
      (v_id, 'Windows Server 2022',       true,  4),
      (v_id, '2 IPs dedicados',           true,  5),
      (v_id, 'RDP/Remote Desktop',        true,  6),
      (v_id, 'Licença Windows incluída',  true,  7),
      (v_id, 'Suporte 24/7',              true,  8);
  END IF;

  -- ── DEDICATED WINDOWS: Sapphire ────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'win-sapphire';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '32 vCPU dedicadas',         true,  1),
      (v_id, '64 GB RAM DDR5',            true,  2),
      (v_id, '960 GB NVMe SSD',           true,  3),
      (v_id, 'Windows Server 2022',       true,  4),
      (v_id, '4 IPs dedicados',           true,  5),
      (v_id, 'RDP/Remote Desktop',        true,  6),
      (v_id, 'Licença Windows incluída',  true,  7),
      (v_id, 'Backup semanal',            true,  8),
      (v_id, 'Suporte prioritário 24/7',  true,  9);
  END IF;

  -- ── DEDICATED WINDOWS: Diamond ─────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'win-diamond';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '64 vCPU dedicadas',         true,  1),
      (v_id, '128 GB RAM DDR5',           true,  2),
      (v_id, '1.920 GB NVMe SSD',         true,  3),
      (v_id, 'Windows Server 2022',       true,  4),
      (v_id, '8 IPs dedicados',           true,  5),
      (v_id, 'RDP/Remote Desktop',        true,  6),
      (v_id, 'Licença Windows incluída',  true,  7),
      (v_id, 'Backup diário',             true,  8),
      (v_id, 'SLA premium',               true,  9),
      (v_id, 'Suporte premium 24/7',      true,  10);
  END IF;

  -- ── WEBSITE BUILDER: IA Starter ────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'ia-starter';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '1 site',                      true,  1),
      (v_id, 'Criador de sites com IA',     true,  2),
      (v_id, '10 GB armazenamento',         true,  3),
      (v_id, 'SSL grátis',                  true,  4),
      (v_id, 'Domínio grátis (1 ano)',      true,  5),
      (v_id, 'Suporte 24/7',                true,  6),
      (v_id, 'Loja online',                 false, 7),
      (v_id, 'Domínio personalizado extra', false, 8);
  END IF;

  -- ── WEBSITE BUILDER: IA Pro ────────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'ia-pro';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, '3 sites',                          true,  1),
      (v_id, 'Criador de sites com IA avançado', true,  2),
      (v_id, '30 GB armazenamento',              true,  3),
      (v_id, 'SSL grátis',                       true,  4),
      (v_id, 'Domínio grátis (1 ano)',           true,  5),
      (v_id, 'Loja online básica',               true,  6),
      (v_id, 'Integração WhatsApp',              true,  7),
      (v_id, 'Suporte prioritário 24/7',         true,  8);
  END IF;

  -- ── WEBSITE BUILDER: IA Business ──────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'ia-business';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Sites ilimitados',                  true,  1),
      (v_id, 'Criador de sites com IA premium',   true,  2),
      (v_id, '100 GB armazenamento',              true,  3),
      (v_id, 'SSL grátis',                        true,  4),
      (v_id, 'Domínio grátis (1 ano)',            true,  5),
      (v_id, 'Loja online avançada',              true,  6),
      (v_id, 'Integração WhatsApp + CRM',         true,  7),
      (v_id, 'Analytics avançado',                true,  8),
      (v_id, 'Suporte VIP 24/7',                  true,  9);
  END IF;

  -- ── DOMAINS (generic features) ─────────────────────────────
  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'domain-com';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Registo por 1 ano',          true, 1),
      (v_id, 'DNS gerido gratuito',        true, 2),
      (v_id, 'Protecção WHOIS',           true, 3),
      (v_id, 'Renovação automática',       true, 4);
  END IF;

  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'domain-net';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Registo por 1 ano',          true, 1),
      (v_id, 'DNS gerido gratuito',        true, 2),
      (v_id, 'Protecção WHOIS',           true, 3),
      (v_id, 'Renovação automática',       true, 4);
  END IF;

  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'domain-org';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Registo por 1 ano',          true, 1),
      (v_id, 'DNS gerido gratuito',        true, 2),
      (v_id, 'Protecção WHOIS',           true, 3),
      (v_id, 'Renovação automática',       true, 4);
  END IF;

  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'domain-ao';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Registo por 1 ano',          true, 1),
      (v_id, 'DNS gerido gratuito',        true, 2),
      (v_id, 'Domínio nacional angolano',  true, 3),
      (v_id, 'Renovação automática',       true, 4);
  END IF;

  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'domain-co-ao';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Registo por 1 ano',          true, 1),
      (v_id, 'DNS gerido gratuito',        true, 2),
      (v_id, 'Para empresas angolanas',    true, 3),
      (v_id, 'Renovação automática',       true, 4);
  END IF;

  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'domain-com-br';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Registo por 1 ano',          true, 1),
      (v_id, 'DNS gerido gratuito',        true, 2),
      (v_id, 'Protecção WHOIS',           true, 3),
      (v_id, 'Renovação automática',       true, 4);
  END IF;

  SELECT id INTO v_id FROM viralizahost.products WHERE slug = 'domain-io';
  IF v_id IS NOT NULL THEN
    DELETE FROM viralizahost.product_features WHERE product_id = v_id;
    INSERT INTO viralizahost.product_features (product_id, feature, included, position) VALUES
      (v_id, 'Registo por 1 ano',          true, 1),
      (v_id, 'DNS gerido gratuito',        true, 2),
      (v_id, 'Protecção WHOIS',           true, 3),
      (v_id, 'Renovação automática',       true, 4);
  END IF;

END $$;

-- ============================================================
-- 5. BACKWARD-COMPATIBLE SLUG ALIASES
--    INSERT only if the slug does not already exist.
-- ============================================================

INSERT INTO viralizahost.products
  (slug, category, subcategory, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years,
   cta_label, cta_url, currency)
VALUES
  -- 'starter' → hosting-start equivalent
  ('starter', 'hosting', NULL, 'Starter', 'Para sites pessoais e blogs', NULL, false, true, 10,
   19900, 16915, 13930, 10945, 8955, 'Começar com Start', NULL, 'AOA'),

  -- 'business' → hosting-business equivalent
  ('business', 'hosting', NULL, 'Business', 'Para pequenas e médias empresas', 'MAIS POPULAR', true, true, 20,
   39900, 33915, 27930, 21945, 17955, 'Começar com Business', NULL, 'AOA'),

  -- 'pro' → hosting-turbo equivalent
  ('pro', 'hosting', NULL, 'Pro', 'Performance máxima sem limites', NULL, false, true, 30,
   79900, 67915, 55930, 43945, 35955, 'Começar com Pro', NULL, 'AOA'),

  -- 'premium' → hosting-turbo equivalent (alias)
  ('premium', 'hosting', NULL, 'Premium', 'Performance máxima sem limites', NULL, false, true, 40,
   79900, 67915, 55930, 43945, 35955, 'Começar com Premium', NULL, 'AOA'),

  -- 'reseller' → reseller-start equivalent
  ('reseller', 'reseller', NULL, 'Reseller', 'Para começar no mercado de revenda', NULL, false, true, 50,
   59900, 50915, 41930, 32945, 26955, 'Começar com Revenda', NULL, 'AOA'),

  -- 'webmail-start' → email-starter equivalent
  ('webmail-start', 'email', NULL, 'Webmail Start', 'Para pequenas equipas', NULL, false, true, 60,
    6800,  5780,  4760,  3740, 3060, 'Contratar Webmail Start', NULL, 'AOA'),

  -- 'webmail-business' → email-standard equivalent
  ('webmail-business', 'email', NULL, 'Webmail Business', 'Para equipas em crescimento', NULL, false, true, 70,
   14800, 12580, 10360,  8140, 6660, 'Contratar Webmail Business', NULL, 'AOA'),

  -- 'webmail-enterprise' → email-premium equivalent
  ('webmail-enterprise', 'email', NULL, 'Webmail Enterprise', 'Para empresas estabelecidas', NULL, false, true, 80,
   28000, 23800, 19600, 15400,12600, 'Contratar Webmail Enterprise', NULL, 'AOA')

ON CONFLICT (slug) DO NOTHING;
