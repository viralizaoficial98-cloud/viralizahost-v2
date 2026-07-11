-- Products catalog in viralizahost schema
-- All service plans centralized in one table

CREATE TABLE IF NOT EXISTS viralizahost.products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  category      text NOT NULL, -- hosting, wordpress, vps, dedicated, dedicated-windows, reseller, email, website-builder, domain, ssl, cdn, backup, protection, migration
  name          text NOT NULL,
  description   text,
  badge         text,
  popular       boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  position      int  NOT NULL DEFAULT 0,
  -- Prices per billing cycle (monthly, in Kz)
  price_monthly   numeric(12,2),
  price_6months   numeric(12,2),
  price_1year     numeric(12,2),
  price_2years    numeric(12,2),
  price_3years    numeric(12,2),
  -- Extra
  color         text,
  href_override text, -- if set, CTA links here instead of /checkout
  meta          jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS viralizahost.product_features (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES viralizahost.products(id) ON DELETE CASCADE,
  feature    text NOT NULL,
  included   boolean NOT NULL DEFAULT true,
  position   int  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_features_product_id_idx ON viralizahost.product_features(product_id);

-- RLS
ALTER TABLE viralizahost.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.product_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read products" ON viralizahost.products;
CREATE POLICY "public read products" ON viralizahost.products FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "admin all products" ON viralizahost.products;
CREATE POLICY "admin all products" ON viralizahost.products FOR ALL USING (
  EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "public read features" ON viralizahost.product_features;
CREATE POLICY "public read features" ON viralizahost.product_features FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin all features" ON viralizahost.product_features;
CREATE POLICY "admin all features" ON viralizahost.product_features FOR ALL USING (
  EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Expose to PostgREST
GRANT SELECT ON viralizahost.products TO anon, authenticated;
GRANT ALL ON viralizahost.products TO service_role;
GRANT SELECT ON viralizahost.product_features TO anon, authenticated;
GRANT ALL ON viralizahost.product_features TO service_role;

-- =====================
-- SEED: all products
-- =====================

-- Helper to insert product + features
-- Hosting plans
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, position, price_monthly, price_6months, price_1year, price_2years, price_3years, color) VALUES
('starter',  'hosting', 'Starter',  'Para sites pessoais e blogs',           null,           false, 10, 14900,  12600,  10400,  8200,  6700),
('business', 'hosting', 'Business', 'Para pequenas e médias empresas',        null,           false, 20, 24900,  21200,  17400, 13700, 11200),
('pro',      'hosting', 'Pro',      'Para lojas e projectos profissionais',   'MAIS POPULAR', true,  30, 49900,  42400,  34900, 27400, 22500),
('premium',  'hosting', 'Premium',  'Para alta performance e múltiplos sites',null,           false, 40, 99900,  84900,  69900, 54900, 44900)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- WordPress plans
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, position, price_monthly, price_6months, price_1year, price_2years, price_3years, color) VALUES
('wp-start', 'wordpress', 'WordPress Start', 'Para blogs e sites pessoais',              null,           false, 10, 24900, 21200, 17400, 13700, 11200),
('wp-pro',   'wordpress', 'WordPress Pro',   'Para empresas e lojas WooCommerce',        'MAIS POPULAR', true,  20, 49900, 42400, 34900, 27400, 22500),
('wp-turbo', 'wordpress', 'WordPress Turbo', 'Máxima performance para alta demanda',     'MELHOR VALOR', false, 30, 99900, 84900, 69900, 54900, 44900)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- VPS plans
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, position, price_monthly, price_6months, price_1year, price_2years, price_3years, color) VALUES
('vps-nvme2', 'vps', 'VPS NVMe 2', 'Para projectos iniciais',          null,           false, 10,  45000,  38200,  31500,  24800, 20200),
('vps-nvme4', 'vps', 'VPS NVMe 4', 'Para aplicações e e-commerce',     'MAIS POPULAR', true,  20,  85000,  72200,  59500,  46800, 38200),
('vps-nvme8', 'vps', 'VPS NVMe 8', 'Para alta demanda e escala',       'MELHOR VALOR', false, 30, 159000, 135200, 111300,  87500, 71500)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- Dedicated Linux plans
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, position, price_monthly, price_1year, href_override, color) VALUES
('ded-16',  'dedicated',         'Dedicado NVMe 16',  'Para sistemas e aplicações de médio porte', null,           false, 10, 249000, 174300, null, null),
('ded-32',  'dedicated',         'Dedicado NVMe 32',  'Para projectos de alta demanda',            'MAIS POPULAR', true,  20, 449000, 314300, null, null),
('ded-64',  'dedicated',         'Dedicado NVMe 64',  'Para infra-estruturas empresariais',        'MELHOR VALOR', false, 30, 799000, 559300, null, null),
('ded-128', 'dedicated',         'Dedicado NVMe 128', 'Infra-estrutura exclusiva máxima',          null,           false, 40, null,   null,   '/tickets', null)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year,
  href_override=EXCLUDED.href_override, updated_at=now();

-- Dedicated Windows plans
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, position, price_monthly, price_1year, color) VALUES
('win-black',    'dedicated-windows', 'Black',    'Servidor Windows dedicado inicial',   null,           false, 10, 299000, 209300, null),
('win-sapphire', 'dedicated-windows', 'Sapphire', 'Para empresas e sistemas críticos',  'MAIS POPULAR', true,  20, 549000, 384300, null),
('win-diamond',  'dedicated-windows', 'Diamond',  'Alta performance e alta disponibilidade', 'MELHOR VALOR', false, 30, 999000, 699300, null)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year, updated_at=now();

-- Reseller plans
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, position, price_monthly, price_6months, price_1year, price_2years, price_3years, color) VALUES
('revenda-start',      'reseller', 'Reseller Start',      'Para começar no mercado de hospedagem',         null,           false, 10,  59900,  50900,  41900,  33000, 26900),
('revenda-growth',     'reseller', 'Reseller Growth',     'Para resellers em crescimento',                 null,           false, 20,  99900,  84900,  69900,  54900, 44900),
('revenda-business',   'reseller', 'Reseller Business',   'Para agências e resellers profissionais',       'MAIS POPULAR', true,  30, 179900, 152900, 125900,  98900, 80900),
('revenda-enterprise', 'reseller', 'Reseller Enterprise', 'Para grandes revendedores e data centers',      'MELHOR VALOR', false, 40, 349900, 297400, 244900, 192400,157400)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- IA / Website Builder plans
INSERT INTO viralizahost.products (slug, category, name, description, badge, popular, position, price_monthly, price_6months, price_1year, price_2years, price_3years, color) VALUES
('ia-starter',  'website-builder', 'IA Starter',  'Para landing pages e portfólios',       null,           false, 10, 14900, 12600, 10400,  8200,  6700),
('ia-pro',      'website-builder', 'IA Pro',      'Para pequenos negócios e freelancers',  'MAIS POPULAR', true,  20, 29900, 25400, 20900, 16400, 13400),
('ia-business', 'website-builder', 'IA Business', 'Para empresas e lojas online',          'MELHOR VALOR', false, 30, 59900, 50900, 41900, 32900, 26900)
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- =====================
-- FEATURES
-- =====================

-- Delete existing features for these slugs and re-insert
DELETE FROM viralizahost.product_features WHERE product_id IN (
  SELECT id FROM viralizahost.products WHERE slug IN (
    'starter','business','pro','premium',
    'wp-start','wp-pro','wp-turbo',
    'vps-nvme2','vps-nvme4','vps-nvme8',
    'ded-16','ded-32','ded-64','ded-128',
    'win-black','win-sapphire','win-diamond',
    'revenda-start','revenda-growth','revenda-business','revenda-enterprise',
    'ia-starter','ia-pro','ia-business'
  )
);

-- Hosting: Starter
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='starter')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('1 site', true, 1), ('20 GB SSD NVMe', true, 2), ('SSL grátis', true, 3), ('Email profissional (5 contas)', true, 4), ('Backup semanal', true, 5), ('Migração gratuita', true, 6), ('Suporte 24/7', true, 7), ('CDN global', false, 8), ('Recursos com IA', false, 9)) AS f(feature, inc, pos);

-- Hosting: Business
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='business')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('5 sites', true, 1), ('50 GB SSD NVMe', true, 2), ('SSL grátis', true, 3), ('Email profissional (25 contas)', true, 4), ('Backup diário', true, 5), ('CDN global', true, 6), ('Migração gratuita', true, 7), ('Suporte prioritário 24/7', true, 8), ('Recursos com IA', false, 9)) AS f(feature, inc, pos);

-- Hosting: Pro
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='pro')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Sites ilimitados', true, 1), ('100 GB SSD NVMe', true, 2), ('SSL grátis', true, 3), ('Email profissional ilimitado', true, 4), ('Backup diário', true, 5), ('CDN global premium', true, 6), ('Criador de Sites com IA', true, 7), ('Migração gratuita', true, 8), ('Suporte premium 24/7', true, 9)) AS f(feature, inc, pos);

-- Hosting: Premium
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='premium')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Sites ilimitados', true, 1), ('250 GB SSD NVMe', true, 2), ('SSL grátis', true, 3), ('Email profissional ilimitado', true, 4), ('Backup diário automático', true, 5), ('CDN global premium', true, 6), ('Criador de Sites com IA avançado', true, 7), ('Ambiente staging', true, 8), ('IP dedicado', true, 9), ('Suporte VIP 24/7', true, 10)) AS f(feature, inc, pos);

-- WordPress: Start
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='wp-start')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('1 site WordPress', true, 1), ('20 GB NVMe SSD', true, 2), ('WordPress pré-instalado', true, 3), ('SSL grátis', true, 4), ('Backup semanal', true, 5), ('Migração gratuita', true, 6), ('Suporte 24/7', true, 7), ('CDN global', false, 8), ('Criador IA', false, 9), ('Staging', false, 10)) AS f(feature, inc, pos);

-- WordPress: Pro
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='wp-pro')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('5 sites WordPress', true, 1), ('50 GB NVMe SSD', true, 2), ('WordPress pré-instalado', true, 3), ('SSL grátis', true, 4), ('CDN global', true, 5), ('Backup diário', true, 6), ('Criador de Sites com IA', true, 7), ('Otimização SEO automática', true, 8), ('Migração gratuita', true, 9), ('Suporte prioritário 24/7', true, 10)) AS f(feature, inc, pos);

-- WordPress: Turbo
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='wp-turbo')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Sites WordPress ilimitados', true, 1), ('200 GB NVMe SSD', true, 2), ('WordPress pré-instalado', true, 3), ('SSL grátis', true, 4), ('CDN global premium', true, 5), ('Backup diário automático', true, 6), ('Criador de Sites com IA', true, 7), ('Otimização SEO avançada', true, 8), ('Ambiente staging', true, 9), ('IP dedicado', true, 10), ('Suporte premium 24/7', true, 11)) AS f(feature, inc, pos);

-- VPS plans
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='vps-nvme2')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('2 vCPU', true, 1), ('4 GB RAM DDR5', true, 2), ('60 GB NVMe SSD', true, 3), ('IP dedicado', true, 4), ('Transferência ilimitada', true, 5), ('Root access', true, 6), ('Migração grátis', true, 7), ('Suporte 24/7', true, 8), ('cPanel', false, 9), ('Backup gerido', false, 10)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='vps-nvme4')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('4 vCPU', true, 1), ('8 GB RAM DDR5', true, 2), ('120 GB NVMe SSD', true, 3), ('IP dedicado', true, 4), ('Transferência ilimitada', true, 5), ('Root access', true, 6), ('cPanel opcional', true, 7), ('Backup semanal gerido', true, 8), ('Migração grátis', true, 9), ('Suporte prioritário 24/7', true, 10)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='vps-nvme8')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('8 vCPU', true, 1), ('16 GB RAM DDR5', true, 2), ('240 GB NVMe SSD', true, 3), ('IP dedicado', true, 4), ('Transferência ilimitada', true, 5), ('Root access', true, 6), ('cPanel incluído', true, 7), ('Backup diário gerido', true, 8), ('Migração grátis', true, 9), ('Snapshots', true, 10), ('Suporte premium 24/7', true, 11)) AS f(feature, inc, pos);

-- Dedicated Linux
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='ded-16')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('16 vCPU dedicadas', true, 1), ('32 GB RAM DDR5', true, 2), ('480 GB NVMe SSD', true, 3), ('2 IPs dedicados', true, 4), ('cPanel/WHM opcional', true, 5), ('SSL grátis', true, 6), ('Migração gratuita', true, 7), ('Suporte técnico 24/7', true, 8), ('IPs adicionais', false, 9), ('Backup gerido diário', false, 10)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='ded-32')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('32 vCPU dedicadas', true, 1), ('64 GB RAM DDR5', true, 2), ('960 GB NVMe SSD', true, 3), ('4 IPs dedicados', true, 4), ('cPanel/WHM incluído', true, 5), ('SSL grátis', true, 6), ('Backup semanal gerido', true, 7), ('Migração gratuita', true, 8), ('Suporte prioritário 24/7', true, 9)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='ded-64')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('64 vCPU dedicadas', true, 1), ('128 GB RAM DDR5', true, 2), ('1.920 GB NVMe SSD', true, 3), ('8 IPs dedicados', true, 4), ('cPanel/WHM incluído', true, 5), ('SSL grátis', true, 6), ('Backup diário gerido', true, 7), ('Migração gratuita', true, 8), ('Snapshots', true, 9), ('SLA premium', true, 10), ('Suporte premium 24/7', true, 11)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='ded-128')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('128 vCPU dedicadas', true, 1), ('256 GB RAM DDR5', true, 2), ('3.840 GB NVMe SSD', true, 3), ('IPs dedicados ilimitados', true, 4), ('cPanel/WHM incluído', true, 5), ('SSL grátis', true, 6), ('Backup diário + offsite', true, 7), ('Gerente de infra-estrutura', true, 8), ('SLA enterprise', true, 9), ('Suporte VIP 24/7', true, 10)) AS f(feature, inc, pos);

-- Dedicated Windows
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='win-black')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('16 vCPU dedicadas', true, 1), ('32 GB RAM DDR5', true, 2), ('480 GB NVMe SSD', true, 3), ('Windows Server 2022', true, 4), ('2 IPs dedicados', true, 5), ('RDP/Remote Desktop', true, 6), ('Licença Windows incluída', true, 7), ('Suporte 24/7', true, 8)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='win-sapphire')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('32 vCPU dedicadas', true, 1), ('64 GB RAM DDR5', true, 2), ('960 GB NVMe SSD', true, 3), ('Windows Server 2022', true, 4), ('4 IPs dedicados', true, 5), ('RDP/Remote Desktop', true, 6), ('Licença Windows incluída', true, 7), ('Backup semanal', true, 8), ('Suporte prioritário 24/7', true, 9)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='win-diamond')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('64 vCPU dedicadas', true, 1), ('128 GB RAM DDR5', true, 2), ('1.920 GB NVMe SSD', true, 3), ('Windows Server 2022', true, 4), ('8 IPs dedicados', true, 5), ('RDP/Remote Desktop', true, 6), ('Licença Windows incluída', true, 7), ('Backup diário', true, 8), ('SLA premium', true, 9), ('Suporte premium 24/7', true, 10)) AS f(feature, inc, pos);

-- Reseller
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='revenda-start')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('20 cPanels para clientes', true, 1), ('100 GB SSD NVMe', true, 2), ('WHM reseller panel', true, 3), ('SSL grátis (WHMCS)', true, 4), ('Suporte 24/7', true, 5), ('Migração gratuita', true, 6), ('Marca branca', false, 7), ('IP dedicado', false, 8)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='revenda-growth')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('50 cPanels para clientes', true, 1), ('250 GB SSD NVMe', true, 2), ('WHM reseller panel', true, 3), ('SSL grátis (WHMCS)', true, 4), ('Marca branca', true, 5), ('Suporte prioritário 24/7', true, 6), ('Migração gratuita', true, 7), ('IP dedicado', false, 8)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='revenda-business')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Contas cPanel ilimitadas', true, 1), ('500 GB SSD NVMe', true, 2), ('WHM reseller panel', true, 3), ('SSL grátis (WHMCS)', true, 4), ('Marca branca', true, 5), ('IP dedicado', true, 6), ('Backup diário', true, 7), ('Suporte prioritário 24/7', true, 8), ('Migração gratuita', true, 9)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='revenda-enterprise')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Contas cPanel ilimitadas', true, 1), ('1 TB SSD NVMe', true, 2), ('WHM reseller panel', true, 3), ('SSL grátis (WHMCS)', true, 4), ('Marca branca', true, 5), ('IPs dedicados múltiplos', true, 6), ('Backup diário automático', true, 7), ('SLA premium', true, 8), ('Suporte VIP 24/7', true, 9), ('Migração gratuita', true, 10)) AS f(feature, inc, pos);

-- Website Builder / IA
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='ia-starter')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('1 site', true, 1), ('Criador de sites com IA', true, 2), ('10 GB armazenamento', true, 3), ('SSL grátis', true, 4), ('Domínio grátis (1 ano)', true, 5), ('Suporte 24/7', true, 6), ('Loja online', false, 7), ('Domínio personalizado extra', false, 8)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='ia-pro')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('3 sites', true, 1), ('Criador de sites com IA avançado', true, 2), ('30 GB armazenamento', true, 3), ('SSL grátis', true, 4), ('Domínio grátis (1 ano)', true, 5), ('Loja online básica', true, 6), ('Integração WhatsApp', true, 7), ('Suporte prioritário 24/7', true, 8)) AS f(feature, inc, pos);

WITH p AS (SELECT id FROM viralizahost.products WHERE slug='ia-business')
INSERT INTO viralizahost.product_features (product_id, feature, included, position) SELECT p.id, f.feature, f.inc, f.pos FROM p,
(VALUES ('Sites ilimitados', true, 1), ('Criador de sites com IA premium', true, 2), ('100 GB armazenamento', true, 3), ('SSL grátis', true, 4), ('Domínio grátis (1 ano)', true, 5), ('Loja online avançada', true, 6), ('Integração WhatsApp + CRM', true, 7), ('Analytics avançado', true, 8), ('Suporte VIP 24/7', true, 9)) AS f(feature, inc, pos);
