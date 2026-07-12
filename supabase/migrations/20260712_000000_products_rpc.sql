-- ============================================================
-- Public RPC: setup_product_catalog()
-- Creates viralizahost.products + product_features tables,
-- applies RLS policies, grants, and seeds the full catalog.
-- SECURITY DEFINER so any authenticated caller can run it.
-- Safe to call repeatedly (idempotent).
-- ============================================================

CREATE OR REPLACE FUNCTION public.setup_product_catalog()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, viralizahost
AS $$
DECLARE
  v_products_count int;
BEGIN

  -- ── Tables ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS viralizahost.products (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            text UNIQUE NOT NULL,
    category        text NOT NULL,
    subcategory     text,
    name            text NOT NULL,
    description     text,
    badge           text,
    popular         boolean NOT NULL DEFAULT false,
    active          boolean NOT NULL DEFAULT true,
    position        int  NOT NULL DEFAULT 0,
    price_monthly   numeric(12,2),
    price_6months   numeric(12,2),
    price_1year     numeric(12,2),
    price_2years    numeric(12,2),
    price_3years    numeric(12,2),
    color           text,
    href_override   text,
    cta_label       text,
    image_url       text,
    meta            jsonb DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS viralizahost.product_features (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES viralizahost.products(id) ON DELETE CASCADE,
    feature    text NOT NULL,
    included   boolean NOT NULL DEFAULT true,
    position   int  NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS product_features_product_id_idx
    ON viralizahost.product_features(product_id);

  -- ── Missing columns (idempotent) ─────────────────────────
  ALTER TABLE viralizahost.products ADD COLUMN IF NOT EXISTS subcategory  text;
  ALTER TABLE viralizahost.products ADD COLUMN IF NOT EXISTS cta_label    text;
  ALTER TABLE viralizahost.products ADD COLUMN IF NOT EXISTS image_url    text;

  -- ── RLS ──────────────────────────────────────────────────
  ALTER TABLE viralizahost.products         ENABLE ROW LEVEL SECURITY;
  ALTER TABLE viralizahost.product_features ENABLE ROW LEVEL SECURITY;

  -- products
  DROP POLICY IF EXISTS "public read products"       ON viralizahost.products;
  DROP POLICY IF EXISTS "admin all products"         ON viralizahost.products;
  DROP POLICY IF EXISTS "service_role products"      ON viralizahost.products;
  DROP POLICY IF EXISTS "service_role_all_products"  ON viralizahost.products;
  DROP POLICY IF EXISTS "admin_all_products"         ON viralizahost.products;

  CREATE POLICY "public read products" ON viralizahost.products
    FOR SELECT USING (active = true);

  CREATE POLICY "service_role products" ON viralizahost.products
    FOR ALL TO service_role USING (true) WITH CHECK (true);

  CREATE POLICY "admin all products" ON viralizahost.products
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin'));

  -- product_features
  DROP POLICY IF EXISTS "public read features"      ON viralizahost.product_features;
  DROP POLICY IF EXISTS "admin all features"        ON viralizahost.product_features;
  DROP POLICY IF EXISTS "service_role features"     ON viralizahost.product_features;
  DROP POLICY IF EXISTS "service_role_all_features" ON viralizahost.product_features;
  DROP POLICY IF EXISTS "admin_all_features"        ON viralizahost.product_features;

  CREATE POLICY "public read features" ON viralizahost.product_features
    FOR SELECT USING (true);

  CREATE POLICY "service_role features" ON viralizahost.product_features
    FOR ALL TO service_role USING (true) WITH CHECK (true);

  CREATE POLICY "admin all features" ON viralizahost.product_features
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin'));

  -- ── Grants ────────────────────────────────────────────────
  GRANT SELECT ON viralizahost.products         TO anon, authenticated;
  GRANT ALL    ON viralizahost.products         TO service_role;
  GRANT SELECT ON viralizahost.product_features TO anon, authenticated;
  GRANT ALL    ON viralizahost.product_features TO service_role;

  -- ── Seed — Hospedagem de Sites ────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    ('hosting-start',    'hosting', 'Plano Start',    'Ideal para sites pessoais e blogs',  null,           false, true, 10,
     19900, 16900, 13900, 10900,  8900, 'Começar com Start'),
    ('hosting-business', 'hosting', 'Plano Business', 'Para pequenas e médias empresas',    'MAIS POPULAR', true,  true, 20,
     39900, 33900, 27900, 21900, 17900, 'Começar com Business'),
    ('hosting-turbo',    'hosting', 'Plano Turbo',    'Performance máxima sem limites',     'MELHOR VALOR', false, true, 30,
     79900, 67900, 55900, 43900, 35900, 'Começar com Turbo')
  ON CONFLICT (slug) DO UPDATE SET
    name=EXCLUDED.name, description=EXCLUDED.description, badge=EXCLUDED.badge,
    popular=EXCLUDED.popular, active=EXCLUDED.active, position=EXCLUDED.position,
    price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
    price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
    price_3years=EXCLUDED.price_3years, cta_label=EXCLUDED.cta_label, updated_at=now();

  -- Features — Start
  DELETE FROM viralizahost.product_features
    WHERE product_id = (SELECT id FROM viralizahost.products WHERE slug='hosting-start');
  WITH p AS (SELECT id FROM viralizahost.products WHERE slug='hosting-start')
  INSERT INTO viralizahost.product_features (product_id, feature, included, position)
  SELECT p.id, f.feat, f.inc, f.pos FROM p, (VALUES
    ('1 site hospedado', true, 1), ('20 GB NVMe SSD', true, 2), ('SSL grátis', true, 3),
    ('cPanel incluído', true, 4), ('5 contas de e-mail', true, 5), ('Backup semanal', true, 6),
    ('Migração gratuita', true, 7), ('Suporte 24/7', true, 8),
    ('Sites ilimitados', false, 9), ('CDN global', false, 10)
  ) AS f(feat, inc, pos);

  -- Features — Business
  DELETE FROM viralizahost.product_features
    WHERE product_id = (SELECT id FROM viralizahost.products WHERE slug='hosting-business');
  WITH p AS (SELECT id FROM viralizahost.products WHERE slug='hosting-business')
  INSERT INTO viralizahost.product_features (product_id, feature, included, position)
  SELECT p.id, f.feat, f.inc, f.pos FROM p, (VALUES
    ('5 sites hospedados', true, 1), ('50 GB NVMe SSD', true, 2), ('SSL grátis', true, 3),
    ('cPanel incluído', true, 4), ('20 contas de e-mail', true, 5), ('Backup diário', true, 6),
    ('Migração gratuita', true, 7), ('Suporte prioritário 24/7', true, 8),
    ('CDN básico', true, 9), ('Sites ilimitados', false, 10)
  ) AS f(feat, inc, pos);

  -- Features — Turbo
  DELETE FROM viralizahost.product_features
    WHERE product_id = (SELECT id FROM viralizahost.products WHERE slug='hosting-turbo');
  WITH p AS (SELECT id FROM viralizahost.products WHERE slug='hosting-turbo')
  INSERT INTO viralizahost.product_features (product_id, feature, included, position)
  SELECT p.id, f.feat, f.inc, f.pos FROM p, (VALUES
    ('Sites ilimitados', true, 1), ('200 GB NVMe SSD', true, 2), ('SSL grátis', true, 3),
    ('cPanel incluído', true, 4), ('E-mails ilimitados', true, 5),
    ('Backup diário automático', true, 6), ('Migração gratuita', true, 7),
    ('Suporte premium 24/7', true, 8), ('CDN global', true, 9), ('IP dedicado', true, 10)
  ) AS f(feat, inc, pos);

  -- ── Seed — WordPress ──────────────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    ('wp-start', 'wordpress', 'WordPress Start', 'Para blogs e sites pessoais',           null,           false, true, 10,
     24900, 21200, 17400, 13700, 11200, 'Começar com Start'),
    ('wp-pro',   'wordpress', 'WordPress Pro',   'Para empresas e lojas WooCommerce',     'MAIS POPULAR', true,  true, 20,
     49900, 42400, 34900, 27400, 22500, 'Começar com Pro'),
    ('wp-turbo', 'wordpress', 'WordPress Turbo', 'Máxima performance para alta demanda',  'MELHOR VALOR', false, true, 30,
     99900, 84900, 69900, 54900, 44900, 'Começar com Turbo')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
    price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
    price_3years=EXCLUDED.price_3years, cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — E-mail Corporativo ─────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    ('email-starter',         'email', 'Email Starter',         'Para freelancers e profissionais', null,           false, true, 10,
      6800,  5780,  4760,  3740,  3060, 'Contratar'),
    ('email-standard',        'email', 'Email Standard',        'Para equipas e pequenas empresas', 'MAIS POPULAR', true,  true, 20,
     14800, 12580, 10360,  8140,  6660, 'Contratar'),
    ('email-premium',         'email', 'Email Premium',         'Para empresas em crescimento',     'MELHOR VALOR', false, true, 30,
     28000, 23800, 19600, 15400, 12600, 'Contratar'),
    ('microsoft-365-outlook', 'email', 'Microsoft 365 Outlook', 'Suite completa Microsoft 365',     null,           false, true, 40,
     52000, 44200, 36400, 28600, 23400, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
    price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
    price_3years=EXCLUDED.price_3years, cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — VPS ────────────────────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    ('vps-nvme2', 'vps', 'VPS NVMe 2', 'Para projectos iniciais',      null,           false, true, 10,
      45000,  38200,  31500,  24800,  20200, 'Contratar'),
    ('vps-nvme4', 'vps', 'VPS NVMe 4', 'Para aplicações e e-commerce', 'MAIS POPULAR', true,  true, 20,
      85000,  72200,  59500,  46800,  38200, 'Contratar'),
    ('vps-nvme8', 'vps', 'VPS NVMe 8', 'Para alta demanda e escala',   'MELHOR VALOR', false, true, 30,
     159000, 135200, 111300,  87500,  71500, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
    price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
    price_3years=EXCLUDED.price_3years, cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — Revenda ────────────────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    ('reseller-start',      'reseller', 'Reseller Start',      'Para começar no mercado',           null,           false, true, 10,
      59900,  50900,  41900,  33000,  26900, 'Contratar'),
    ('reseller-growth',     'reseller', 'Reseller Growth',     'Para resellers em crescimento',      null,           false, true, 20,
      99900,  84900,  69900,  54900,  44900, 'Contratar'),
    ('reseller-business',   'reseller', 'Reseller Business',   'Para agências profissionais',        'MAIS POPULAR', true,  true, 30,
     179900, 152900, 125900,  98900,  80900, 'Contratar'),
    ('reseller-enterprise', 'reseller', 'Reseller Enterprise', 'Para grandes revendedores',          'MELHOR VALOR', false, true, 40,
     349900, 297400, 244900, 192400, 157400, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
    price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
    price_3years=EXCLUDED.price_3years, cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — Servidor Dedicado Linux ───────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    ('ded-16', 'dedicated', 'Dedicado NVMe 16', 'Para sistemas de médio porte',  null,           false, true, 10,
     249000, 174300, 'Contratar'),
    ('ded-32', 'dedicated', 'Dedicado NVMe 32', 'Para alta demanda',             'MAIS POPULAR', true,  true, 20,
     449000, 314300, 'Contratar'),
    ('ded-64', 'dedicated', 'Dedicado NVMe 64', 'Para infra-estruturas empresa', 'MELHOR VALOR', false, true, 30,
     799000, 559300, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year,
    cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — Servidor Dedicado Windows ─────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    ('win-black',    'dedicated-windows', 'Black',    'Servidor Windows dedicado inicial',  null,           false, true, 10,
     299000, 209300, 'Contratar'),
    ('win-sapphire', 'dedicated-windows', 'Sapphire', 'Para empresas e sistemas críticos',  'MAIS POPULAR', true,  true, 20,
     549000, 384300, 'Contratar'),
    ('win-diamond',  'dedicated-windows', 'Diamond',  'Alta performance e disponibilidade', 'MELHOR VALOR', false, true, 30,
     999000, 699300, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year,
    cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — Criador de Sites com IA ───────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    ('ia-starter',  'website-builder', 'IA Starter',  'Para landing pages e portfólios', null,           false, true, 10,
     14900, 12600, 10400,  8200,  6700, 'Começar'),
    ('ia-pro',      'website-builder', 'IA Pro',      'Para pequenos negócios',           'MAIS POPULAR', true,  true, 20,
     29900, 25400, 20900, 16400, 13400, 'Começar'),
    ('ia-business', 'website-builder', 'IA Business', 'Para empresas e lojas online',     'MELHOR VALOR', false, true, 30,
     59900, 50900, 41900, 32900, 26900, 'Começar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
    price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
    price_3years=EXCLUDED.price_3years, cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — SSL ────────────────────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    ('ssl-dv',       'ssl', 'SSL Domain Validated',       'Certificado SSL básico DV',      null,           false, true, 10,
      4900,  3430, 'Contratar'),
    ('ssl-ov',       'ssl', 'SSL Organization Validated', 'Validação de organização OV',    'MAIS POPULAR', true,  true, 20,
      9900,  6930, 'Contratar'),
    ('ssl-ev',       'ssl', 'SSL Extended Validation',    'Máxima confiança EV',            'MELHOR VALOR', false, true, 30,
     19900, 13930, 'Contratar'),
    ('ssl-wildcard', 'ssl', 'SSL Wildcard',               'Todos os subdomínios cobertos',  null,           false, true, 40,
     29900, 20930, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year,
    cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — Backup Cloud ───────────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, cta_label)
  VALUES
    ('backup-100',  'backup', 'Backup 100 GB',  'Para sites e pequenos projectos', null,           false, true, 10,
      4900,  4200,  3430, 'Contratar'),
    ('backup-500',  'backup', 'Backup 500 GB',  'Para empresas e e-commerce',      'MAIS POPULAR', true,  true, 20,
      9900,  8400,  6930, 'Contratar'),
    ('backup-2000', 'backup', 'Backup 2 TB',    'Para grandes infra-estruturas',   'MELHOR VALOR', false, true, 30,
     19900, 16900, 13930, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
    price_1year=EXCLUDED.price_1year, cta_label=EXCLUDED.cta_label, updated_at=now();

  -- ── Seed — Protecção de Site ──────────────────────────────
  INSERT INTO viralizahost.products
    (slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    ('protection-basic',   'protection', 'Protecção Basic',    'Firewall e monitorização básica',     null,           false, true, 10,
      7900,  5530, 'Contratar'),
    ('protection-pro',     'protection', 'Protecção Pro',      'Anti-malware + WAF avançado',         'MAIS POPULAR', true,  true, 20,
     14900, 10430, 'Contratar'),
    ('protection-premium', 'protection', 'Protecção Premium',  'Protecção total DDoS + CDN',          'MELHOR VALOR', false, true, 30,
     29900, 20930, 'Contratar')
  ON CONFLICT (slug) DO UPDATE SET
    price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year,
    cta_label=EXCLUDED.cta_label, updated_at=now();

  SELECT COUNT(*) INTO v_products_count FROM viralizahost.products;

  RETURN jsonb_build_object('success', true, 'products', v_products_count);
END;
$$;

-- Public read access on the function
GRANT EXECUTE ON FUNCTION public.setup_product_catalog() TO anon, authenticated, service_role;

-- ── Helper: check catalog status ─────────────────────────────
CREATE OR REPLACE FUNCTION public.check_product_catalog()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, viralizahost
AS $$
DECLARE
  v_products_count int := 0;
  v_features_count int := 0;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO v_products_count FROM viralizahost.products;
    SELECT COUNT(*) INTO v_features_count FROM viralizahost.product_features;
  EXCEPTION WHEN undefined_table THEN
    RETURN jsonb_build_object('exists', false, 'products', 0, 'features', 0);
  END;
  RETURN jsonb_build_object('exists', true, 'products', v_products_count, 'features', v_features_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_product_catalog() TO anon, authenticated, service_role;
