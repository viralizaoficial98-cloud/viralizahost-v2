-- ============================================================
-- FIX #1: Correct slugs in site_hosting_plans (was set to random UUIDs)
-- ============================================================
UPDATE viralizahost.site_hosting_plans
SET slug = CASE
  WHEN name ILIKE '%starter%'  OR name ILIKE '%start%'    THEN 'starter'
  WHEN name ILIKE '%business%' OR name ILIKE '%cloud%' AND name NOT ILIKE '%pro%' THEN 'business'
  WHEN name ILIKE '%pro%'      OR name ILIKE '%premium%'  THEN 'pro'
  WHEN name ILIKE '%revenda%'  OR name ILIKE '%reseller%' OR name ILIKE '%whm%' THEN 'reseller'
  ELSE lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
END
WHERE slug IS NULL OR slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ============================================================
-- FIX #2: Correct slugs in site_email_plans (same UUID problem)
-- ============================================================
UPDATE viralizahost.site_email_plans
SET slug = CASE
  WHEN name ILIKE '%microsoft%' OR name ILIKE '%365%' OR name ILIKE '%outlook%' THEN 'microsoft-365'
  WHEN name ILIKE '%enterprise%' THEN 'webmail-enterprise'
  WHEN name ILIKE '%business%'   THEN 'webmail-business'
  WHEN name ILIKE '%start%'      THEN 'webmail-start'
  ELSE lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
END
WHERE slug IS NULL OR slug ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- ============================================================
-- FIX #3: Create products + product_features tables (idempotent)
-- ============================================================
CREATE TABLE IF NOT EXISTS viralizahost.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  category      text NOT NULL,
  name          text NOT NULL,
  description   text,
  badge         text,
  popular       boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  position      int NOT NULL DEFAULT 0,
  price_monthly   numeric(12,2),
  price_6months   numeric(12,2),
  price_1year     numeric(12,2),
  price_2years    numeric(12,2),
  price_3years    numeric(12,2),
  color         text,
  href_override text,
  meta          jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS viralizahost.product_features (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES viralizahost.products(id) ON DELETE CASCADE,
  feature    text NOT NULL,
  included   boolean NOT NULL DEFAULT true,
  position   int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_features_product_id_idx ON viralizahost.product_features(product_id);

-- RLS
ALTER TABLE viralizahost.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.product_features ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='products' AND policyname='public read products') THEN
    CREATE POLICY "public read products" ON viralizahost.products FOR SELECT USING (active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='products' AND policyname='service_role_all_products') THEN
    CREATE POLICY "service_role_all_products" ON viralizahost.products FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='products' AND policyname='admin_all_products') THEN
    CREATE POLICY "admin_all_products" ON viralizahost.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='product_features' AND policyname='public read features') THEN
    CREATE POLICY "public read features" ON viralizahost.product_features FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='product_features' AND policyname='service_role_all_features') THEN
    CREATE POLICY "service_role_all_features" ON viralizahost.product_features FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='viralizahost' AND tablename='product_features' AND policyname='admin_all_features') THEN
    CREATE POLICY "admin_all_features" ON viralizahost.product_features FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON viralizahost.products TO anon, authenticated;
GRANT ALL ON viralizahost.products TO service_role;
GRANT SELECT ON viralizahost.product_features TO anon, authenticated;
GRANT ALL ON viralizahost.product_features TO service_role;

-- ============================================================
-- FIX #4: Populate products from site_hosting_plans (upsert)
-- ============================================================
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, active, position, price_monthly, price_1year)
SELECT
  COALESCE(slug, lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) as slug,
  'hosting' as category,
  name,
  description,
  badge,
  COALESCE(featured, false) as popular,
  active,
  COALESCE(position, 0) as position,
  price_monthly,
  price_annual as price_1year
FROM viralizahost.site_hosting_plans
WHERE slug IS NOT NULL
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_1year = EXCLUDED.price_1year,
  active = EXCLUDED.active,
  updated_at = now();

-- ============================================================
-- FIX #5: Populate products from site_email_plans (upsert)
-- ============================================================
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, active, position, price_monthly, price_1year, color)
SELECT
  slug,
  'email' as category,
  name,
  description,
  badge,
  popular,
  active,
  COALESCE(position, 0) as position,
  price_monthly,
  price_annual as price_1year,
  color
FROM viralizahost.site_email_plans
WHERE slug IS NOT NULL
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_1year = EXCLUDED.price_1year,
  active = EXCLUDED.active,
  updated_at = now();

-- ============================================================
-- FIX #6: Ensure all core products exist with proper pricing
-- ============================================================
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, active, position, price_monthly, price_6months, price_1year, price_2years, price_3years) VALUES
-- Hosting
('starter',  'hosting', 'Starter Host',   'Ideal para começar sua presença online',              null,           false, 10,  4500,  3825,  3150,  2475,  2025),
('business', 'hosting', 'Business Cloud', 'Para pequenas e médias empresas crescerem',           'MAIS POPULAR', true,  20,  9500,  8075,  6650,  5225,  4275),
('pro',      'hosting', 'Cloud Pro',      'Para empresas que exigem alta performance',           'MELHOR VALOR', false, 30, 19500, 16575, 13650, 10725,  8775),
('reseller', 'hosting', 'Revenda WHM',    'Crie o seu próprio negócio de hospedagem',           null,           false, 40, 35000, 29750, 24500, 19250, 15750),
-- WordPress
('wp-start', 'wordpress', 'WordPress Start', 'Para blogs e sites pessoais',               null,           false, 10, 24900, 21165, 17430, 13695, 11205),
('wp-pro',   'wordpress', 'WordPress Pro',   'Para empresas e lojas WooCommerce',         'MAIS POPULAR', true,  20, 49900, 42415, 34930, 27445, 22455),
('wp-turbo', 'wordpress', 'WordPress Turbo', 'Máxima performance para alta demanda',      'MELHOR VALOR', false, 30, 99900, 84915, 69930, 54945, 44955),
-- VPS
('vps-nvme2', 'vps', 'VPS NVMe 2', 'Para projectos iniciais',       null,           false, 10,  45000,  38250,  31500,  24750, 20250),
('vps-nvme4', 'vps', 'VPS NVMe 4', 'Para aplicações e e-commerce',  'MAIS POPULAR', true,  20,  85000,  72250,  59500,  46750, 38250),
('vps-nvme8', 'vps', 'VPS NVMe 8', 'Para alta demanda e escala',    'MELHOR VALOR', false, 30, 159000, 135150, 111300,  87450, 71550),
-- Dedicated Linux
('ded-16',  'dedicated',         'Dedicado NVMe 16',  'Para sistemas de médio porte',       null,           false, 10, 249000, null, 174300, null, null),
('ded-32',  'dedicated',         'Dedicado NVMe 32',  'Para projectos de alta demanda',     'MAIS POPULAR', true,  20, 449000, null, 314300, null, null),
('ded-64',  'dedicated',         'Dedicado NVMe 64',  'Para infra-estruturas empresariais', 'MELHOR VALOR', false, 30, 799000, null, 559300, null, null),
-- Dedicated Windows
('win-black',    'dedicated-windows', 'Black',    'Servidor Windows inicial',              null,           false, 10, 299000, null, 209300, null, null),
('win-sapphire', 'dedicated-windows', 'Sapphire', 'Para sistemas empresariais',           'MAIS POPULAR', true,  20, 549000, null, 384300, null, null),
('win-diamond',  'dedicated-windows', 'Diamond',  'Máxima performance e disponibilidade', 'MELHOR VALOR', false, 30, 999000, null, 699300, null, null),
-- Reseller hosting (detailed)
('revenda-start',      'reseller', 'Reseller Start',      'Para começar no mercado de hospedagem',       null,           false, 10,  59900,  50915,  41930,  32945, 26955),
('revenda-growth',     'reseller', 'Reseller Growth',     'Para agências em crescimento',                null,           false, 20,  99900,  84915,  69930,  54945, 44955),
('revenda-business',   'reseller', 'Reseller Business',   'Para agências e revendedores profissionais', 'MAIS POPULAR', true,  30, 179900, 152915, 125930,  98945, 80955),
('revenda-enterprise', 'reseller', 'Reseller Enterprise', 'Para grandes revendedores',                  'MELHOR VALOR', false, 40, 349900, 297415, 244930, 192445,157455),
-- Website Builder / IA
('ia-starter',  'website-builder', 'IA Starter',  'Para landing pages e portfólios',      null,           false, 10, 14900, 12665, 10430,  8195,  6705),
('ia-pro',      'website-builder', 'IA Pro',      'Para pequenos negócios e freelancers', 'MAIS POPULAR', true,  20, 29900, 25415, 20930, 16445, 13455),
('ia-business', 'website-builder', 'IA Business', 'Para empresas e lojas online',         'MELHOR VALOR', false, 30, 59900, 50915, 41930, 32945, 26955),
-- Email (ensure these exist with correct slugs)
('webmail-start',      'email', 'Webmail Start',         'Para freelancers e consultores',       null,           false, 10,  6800,  5780,  4760,  3740,  3060),
('webmail-business',   'email', 'Webmail Business',      'Para PMEs e equipas',                  'MAIS POPULAR', true,  20, 14800, 12580, 10360,  8140,  6660),
('webmail-enterprise', 'email', 'Webmail Enterprise',    'Para médias e grandes empresas',       null,           false, 30, 28000, 23800, 19600, 15400, 12600),
('microsoft-365',      'email', 'Microsoft 365 Outlook', 'Suite completa Microsoft para negócios', null,         false, 40, 52000, 44200, 36400, 28600, 23400)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  badge = EXCLUDED.badge,
  popular = EXCLUDED.popular,
  active = EXCLUDED.active,
  position = EXCLUDED.position,
  price_monthly = CASE WHEN EXCLUDED.price_monthly IS NOT NULL THEN EXCLUDED.price_monthly ELSE viralizahost.products.price_monthly END,
  price_6months = CASE WHEN EXCLUDED.price_6months IS NOT NULL THEN EXCLUDED.price_6months ELSE viralizahost.products.price_6months END,
  price_1year   = CASE WHEN EXCLUDED.price_1year   IS NOT NULL THEN EXCLUDED.price_1year   ELSE viralizahost.products.price_1year END,
  price_2years  = CASE WHEN EXCLUDED.price_2years  IS NOT NULL THEN EXCLUDED.price_2years  ELSE viralizahost.products.price_2years END,
  price_3years  = CASE WHEN EXCLUDED.price_3years  IS NOT NULL THEN EXCLUDED.price_3years  ELSE viralizahost.products.price_3years END,
  updated_at = now();

-- ============================================================
-- FIX #7: Seed product features for all core products
-- ============================================================
-- Delete and re-insert features (idempotent)
DELETE FROM viralizahost.product_features WHERE product_id IN (
  SELECT id FROM viralizahost.products WHERE category IN ('hosting','wordpress','vps','dedicated','dedicated-windows','reseller','email','website-builder')
);

-- Hosting: Starter
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='starter')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('1 site', true, 1), ('10 GB NVMe SSD', true, 2), ('100 GB Bandwidth', true, 3), ('5 Contas de Email', true, 4), ('SSL Grátis', true, 5), ('cPanel Premium', true, 6), ('3 Bases de Dados MySQL', true, 7), ('Backup Semanal', true, 8), ('IP Dedicado', false, 9), ('Backup Diário', false, 10)) AS f(feature, inc, pos);

-- Hosting: Business
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='business')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('5 Sites', true, 1), ('50 GB NVMe SSD', true, 2), ('Bandwidth Ilimitado', true, 3), ('20 Contas de Email', true, 4), ('SSL Grátis', true, 5), ('cPanel Premium', true, 6), ('10 Bases de Dados MySQL', true, 7), ('Backup Diário', true, 8), ('Softaculous (400+ apps)', true, 9), ('IP Dedicado', false, 10)) AS f(feature, inc, pos);

-- Hosting: Pro
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='pro')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Sites Ilimitados', true, 1), ('200 GB NVMe SSD', true, 2), ('Bandwidth Ilimitado', true, 3), ('Emails Ilimitados', true, 4), ('Wildcard SSL Grátis', true, 5), ('cPanel Premium', true, 6), ('Bases de Dados Ilimitadas', true, 7), ('Backup Diário Automático', true, 8), ('Softaculous Premium', true, 9), ('IP Dedicado', true, 10), ('Proteção DDoS Avançada', true, 11)) AS f(feature, inc, pos);

-- Hosting: Reseller
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='reseller')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('WHM + cPanel Incluído', true, 1), ('500 GB NVMe SSD', true, 2), ('Bandwidth Ilimitado', true, 3), ('Contas de Email Ilimitadas', true, 4), ('SSL Ilimitado', true, 5), ('Criar Planos Personalizados', true, 6), ('Marca Branca (White Label)', true, 7), ('Backup Diário Completo', true, 8), ('IP Dedicado', true, 9)) AS f(feature, inc, pos);

-- WordPress: Start
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='wp-start')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('1 site WordPress', true, 1), ('20 GB NVMe SSD', true, 2), ('WordPress pré-instalado', true, 3), ('SSL grátis', true, 4), ('Backup semanal', true, 5), ('Migração gratuita', true, 6), ('Suporte 24/7', true, 7), ('CDN global', false, 8), ('Staging', false, 9)) AS f(feature, inc, pos);

-- WordPress: Pro
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='wp-pro')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('5 sites WordPress', true, 1), ('50 GB NVMe SSD', true, 2), ('WordPress pré-instalado', true, 3), ('SSL grátis', true, 4), ('CDN global', true, 5), ('Backup diário', true, 6), ('Criador de Sites com IA', true, 7), ('Otimização SEO', true, 8), ('Migração gratuita', true, 9), ('Suporte prioritário 24/7', true, 10)) AS f(feature, inc, pos);

-- WordPress: Turbo
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='wp-turbo')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Sites WordPress ilimitados', true, 1), ('200 GB NVMe SSD', true, 2), ('WordPress pré-instalado', true, 3), ('SSL grátis', true, 4), ('CDN global premium', true, 5), ('Backup diário automático', true, 6), ('Criador de Sites com IA', true, 7), ('SEO avançado', true, 8), ('Ambiente staging', true, 9), ('IP dedicado', true, 10)) AS f(feature, inc, pos);

-- VPS
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='vps-nvme2')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('2 vCPU', true, 1), ('4 GB RAM DDR5', true, 2), ('60 GB NVMe SSD', true, 3), ('IP dedicado', true, 4), ('Transferência ilimitada', true, 5), ('Root access', true, 6), ('Migração grátis', true, 7), ('Suporte 24/7', true, 8)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='vps-nvme4')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('4 vCPU', true, 1), ('8 GB RAM DDR5', true, 2), ('120 GB NVMe SSD', true, 3), ('IP dedicado', true, 4), ('Transferência ilimitada', true, 5), ('Root access', true, 6), ('cPanel opcional', true, 7), ('Backup semanal gerido', true, 8), ('Migração grátis', true, 9), ('Suporte prioritário 24/7', true, 10)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='vps-nvme8')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('8 vCPU', true, 1), ('16 GB RAM DDR5', true, 2), ('240 GB NVMe SSD', true, 3), ('IP dedicado', true, 4), ('Transferência ilimitada', true, 5), ('Root access', true, 6), ('cPanel incluído', true, 7), ('Backup diário gerido', true, 8), ('Migração grátis', true, 9), ('Snapshots', true, 10)) AS f(feature, inc, pos);

-- Email plans features
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='webmail-start')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('1 conta de email', true, 1), ('5 GB de armazenamento', true, 2), ('Webmail incluído', true, 3), ('SSL grátis', true, 4), ('Suporte básico', true, 5)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='webmail-business')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('5 contas de email', true, 1), ('20 GB de armazenamento', true, 2), ('Webmail incluído', true, 3), ('Anti-spam avançado', true, 4), ('Suporte prioritário', true, 5)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='webmail-enterprise')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('20 contas de email', true, 1), ('50 GB de armazenamento', true, 2), ('Webmail incluído', true, 3), ('Anti-spam avançado', true, 4), ('Backup diário', true, 5), ('Suporte 24/7', true, 6)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='microsoft-365')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('1 conta Microsoft 365', true, 1), ('50 GB de armazenamento', true, 2), ('Outlook, Teams, Word, Excel', true, 3), ('OneDrive 1 TB', true, 4), ('Suporte Microsoft', true, 5), ('Integração completa Office', true, 6)) AS f(feature, inc, pos);
