import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createAuthClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const auth = await createAuthClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  return user
}

const SETUP_SQL = `
-- ══════════════════════════════════════════════
--  viralizahost.products + product_features
--  Idempotent — safe to run multiple times
-- ══════════════════════════════════════════════

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

-- RLS
ALTER TABLE viralizahost.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE viralizahost.product_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read products" ON viralizahost.products;
CREATE POLICY "public read products" ON viralizahost.products
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "admin all products" ON viralizahost.products;
CREATE POLICY "admin all products" ON viralizahost.products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "service_role products" ON viralizahost.products;
CREATE POLICY "service_role products" ON viralizahost.products
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "public read features" ON viralizahost.product_features;
CREATE POLICY "public read features" ON viralizahost.product_features
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin all features" ON viralizahost.product_features;
CREATE POLICY "admin all features" ON viralizahost.product_features
  FOR ALL USING (
    EXISTS (SELECT 1 FROM viralizahost.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "service_role features" ON viralizahost.product_features;
CREATE POLICY "service_role features" ON viralizahost.product_features
  FOR ALL USING (auth.role() = 'service_role');

-- Grants
GRANT SELECT ON viralizahost.products TO anon, authenticated;
GRANT ALL    ON viralizahost.products TO service_role;
GRANT SELECT ON viralizahost.product_features TO anon, authenticated;
GRANT ALL    ON viralizahost.product_features TO service_role;

-- ══════════════════════════════════════════════
--  SEED — Hospedagem de Sites
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
VALUES
  ('hosting-start',    'hosting', 'Plano Start',    'Ideal para sites pessoais e blogs',       null,           false, true, 10,
   19900, 16900, 13900, 10900,  8900, 'Começar com Start'),
  ('hosting-business', 'hosting', 'Plano Business', 'Para pequenas e médias empresas',         'MAIS POPULAR', true,  true, 20,
   39900, 33900, 27900, 21900, 17900, 'Começar com Business'),
  ('hosting-turbo',    'hosting', 'Plano Turbo',    'Performance máxima sem limites',          'MELHOR VALOR', false, true, 30,
   79900, 67900, 55900, 43900, 35900, 'Começar com Turbo')
ON CONFLICT (slug) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, badge=EXCLUDED.badge,
  popular=EXCLUDED.popular, active=EXCLUDED.active, position=EXCLUDED.position,
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, cta_label=EXCLUDED.cta_label,
  updated_at=now();

-- Features — Start
DELETE FROM viralizahost.product_features
  WHERE product_id = (SELECT id FROM viralizahost.products WHERE slug='hosting-start');
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='hosting-start')
INSERT INTO viralizahost.product_features (product_id, feature, included, position)
SELECT p.id, f.feat, f.inc, f.pos FROM p,
(VALUES
  ('1 site hospedado',       true,  1),
  ('20 GB NVMe SSD',         true,  2),
  ('SSL grátis',             true,  3),
  ('cPanel incluído',        true,  4),
  ('5 contas de e-mail',     true,  5),
  ('Backup semanal',         true,  6),
  ('Migração gratuita',      true,  7),
  ('Suporte 24/7',           true,  8),
  ('Sites ilimitados',       false, 9),
  ('CDN global',             false, 10)
) AS f(feat, inc, pos);

-- Features — Business
DELETE FROM viralizahost.product_features
  WHERE product_id = (SELECT id FROM viralizahost.products WHERE slug='hosting-business');
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='hosting-business')
INSERT INTO viralizahost.product_features (product_id, feature, included, position)
SELECT p.id, f.feat, f.inc, f.pos FROM p,
(VALUES
  ('5 sites hospedados',         true,  1),
  ('50 GB NVMe SSD',             true,  2),
  ('SSL grátis',                 true,  3),
  ('cPanel incluído',            true,  4),
  ('20 contas de e-mail',        true,  5),
  ('Backup diário',              true,  6),
  ('Migração gratuita',          true,  7),
  ('Suporte prioritário 24/7',   true,  8),
  ('CDN básico',                 true,  9),
  ('Sites ilimitados',           false, 10)
) AS f(feat, inc, pos);

-- Features — Turbo
DELETE FROM viralizahost.product_features
  WHERE product_id = (SELECT id FROM viralizahost.products WHERE slug='hosting-turbo');
WITH p AS (SELECT id FROM viralizahost.products WHERE slug='hosting-turbo')
INSERT INTO viralizahost.product_features (product_id, feature, included, position)
SELECT p.id, f.feat, f.inc, f.pos FROM p,
(VALUES
  ('Sites ilimitados',           true,  1),
  ('200 GB NVMe SSD',            true,  2),
  ('SSL grátis',                 true,  3),
  ('cPanel incluído',            true,  4),
  ('E-mails ilimitados',         true,  5),
  ('Backup diário automático',   true,  6),
  ('Migração gratuita',          true,  7),
  ('Suporte premium 24/7',       true,  8),
  ('CDN global',                 true,  9),
  ('IP dedicado',                true,  10)
) AS f(feat, inc, pos);

-- ══════════════════════════════════════════════
--  SEED — WordPress
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
VALUES
  ('wp-start', 'wordpress', 'WordPress Start', 'Para blogs e sites pessoais',              null,           false, true, 10,
   24900, 21200, 17400, 13700, 11200, 'Começar com Start'),
  ('wp-pro',   'wordpress', 'WordPress Pro',   'Para empresas e lojas WooCommerce',        'MAIS POPULAR', true,  true, 20,
   49900, 42400, 34900, 27400, 22500, 'Começar com Pro'),
  ('wp-turbo', 'wordpress', 'WordPress Turbo', 'Máxima performance para alta demanda',     'MELHOR VALOR', false, true, 30,
   99900, 84900, 69900, 54900, 44900, 'Começar com Turbo')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- ══════════════════════════════════════════════
--  SEED — E-mail Corporativo
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
VALUES
  ('email-starter',         'email', 'Email Starter',         'Para freelancers e profissionais',  null,           false, true, 10,
    6800,  5780,  4760,  3740,  3060, 'Contratar'),
  ('email-standard',        'email', 'Email Standard',        'Para equipas e pequenas empresas',  'MAIS POPULAR', true,  true, 20,
   14800, 12580, 10360,  8140,  6660, 'Contratar'),
  ('email-premium',         'email', 'Email Premium',         'Para empresas em crescimento',      'MELHOR VALOR', false, true, 30,
   28000, 23800, 19600, 15400, 12600, 'Contratar'),
  ('microsoft-365-outlook', 'email', 'Microsoft 365 Outlook', 'Suite completa Microsoft 365',      null,           false, true, 40,
   52000, 44200, 36400, 28600, 23400, 'Contratar')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- ══════════════════════════════════════════════
--  SEED — VPS
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
VALUES
  ('vps-nvme2', 'vps', 'VPS NVMe 2', 'Para projectos iniciais',      null,           false, true, 10,
    45000, 38200, 31500, 24800, 20200, 'Contratar'),
  ('vps-nvme4', 'vps', 'VPS NVMe 4', 'Para aplicações e e-commerce', 'MAIS POPULAR', true,  true, 20,
    85000, 72200, 59500, 46800, 38200, 'Contratar'),
  ('vps-nvme8', 'vps', 'VPS NVMe 8', 'Para alta demanda e escala',   'MELHOR VALOR', false, true, 30,
   159000,135200,111300, 87500, 71500, 'Contratar')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- ══════════════════════════════════════════════
--  SEED — Revenda
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
VALUES
  ('reseller-start',      'reseller', 'Reseller Start',      'Para começar no mercado',           null,           false, true, 10,
    59900, 50900, 41900, 33000, 26900, 'Contratar'),
  ('reseller-growth',     'reseller', 'Reseller Growth',     'Para resellers em crescimento',      null,           false, true, 20,
    99900, 84900, 69900, 54900, 44900, 'Contratar'),
  ('reseller-business',   'reseller', 'Reseller Business',   'Para agências profissionais',        'MAIS POPULAR', true,  true, 30,
   179900,152900,125900, 98900, 80900, 'Contratar'),
  ('reseller-enterprise', 'reseller', 'Reseller Enterprise', 'Para grandes revendedores',          'MELHOR VALOR', false, true, 40,
   349900,297400,244900,192400,157400, 'Contratar')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();

-- ══════════════════════════════════════════════
--  SEED — Servidor Dedicado Linux
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_1year, cta_label)
VALUES
  ('ded-16', 'dedicated', 'Dedicado NVMe 16', 'Para sistemas de médio porte',   null,           false, true, 10,
   249000, 174300, 'Contratar'),
  ('ded-32', 'dedicated', 'Dedicado NVMe 32', 'Para alta demanda',              'MAIS POPULAR', true,  true, 20,
   449000, 314300, 'Contratar'),
  ('ded-64', 'dedicated', 'Dedicado NVMe 64', 'Para infra-estruturas empresa',  'MELHOR VALOR', false, true, 30,
   799000, 559300, 'Contratar')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year,
  updated_at=now();

-- ══════════════════════════════════════════════
--  SEED — Servidor Dedicado Windows
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_1year, cta_label)
VALUES
  ('win-black',    'dedicated-windows', 'Black',    'Servidor Windows dedicado inicial',   null,           false, true, 10,
   299000, 209300, 'Contratar'),
  ('win-sapphire', 'dedicated-windows', 'Sapphire', 'Para empresas e sistemas críticos',   'MAIS POPULAR', true,  true, 20,
   549000, 384300, 'Contratar'),
  ('win-diamond',  'dedicated-windows', 'Diamond',  'Alta performance e disponibilidade',  'MELHOR VALOR', false, true, 30,
   999000, 699300, 'Contratar')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_1year=EXCLUDED.price_1year,
  updated_at=now();

-- ══════════════════════════════════════════════
--  SEED — Criador de Sites com IA
-- ══════════════════════════════════════════════

INSERT INTO viralizahost.products
  (slug, category, name, description, badge, popular, active, position,
   price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
VALUES
  ('ia-starter',  'website-builder', 'IA Starter',  'Para landing pages e portfólios',   null,           false, true, 10,
   14900, 12600, 10400,  8200,  6700, 'Começar'),
  ('ia-pro',      'website-builder', 'IA Pro',      'Para pequenos negócios',             'MAIS POPULAR', true,  true, 20,
   29900, 25400, 20900, 16400, 13400, 'Começar'),
  ('ia-business', 'website-builder', 'IA Business', 'Para empresas e lojas online',       'MELHOR VALOR', false, true, 30,
   59900, 50900, 41900, 32900, 26900, 'Começar')
ON CONFLICT (slug) DO UPDATE SET
  price_monthly=EXCLUDED.price_monthly, price_6months=EXCLUDED.price_6months,
  price_1year=EXCLUDED.price_1year, price_2years=EXCLUDED.price_2years,
  price_3years=EXCLUDED.price_3years, updated_at=now();
`

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ success: false, message: 'Não autenticado' }, { status: 401 })
  }

  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!
    .replace('https://', '').split('.')[0]

  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: SETUP_SQL }),
    }
  )

  if (mgmtRes.ok) {
    return NextResponse.json({ success: true, message: 'Tabelas criadas e catálogo carregado com sucesso.' })
  }

  const errText = await mgmtRes.text()

  // If Management API rejected, try to validate whether tables already exist
  try {
    const supabase = await createAdminClient()
    const { count, error } = await (supabase as any)
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (!error && count != null) {
      return NextResponse.json({
        success: true,
        message: `A tabela viralizahost.products já existe com ${count} produto(s). Nenhuma acção necessária.`,
      })
    }
  } catch {}

  // Return the SQL so the admin can run it manually in the Supabase Dashboard
  return NextResponse.json({
    success: false,
    message: 'Não foi possível aplicar a migração automaticamente. Execute o SQL abaixo no Supabase Dashboard → SQL Editor.',
    mgmtApiError: errText,
    sql: SETUP_SQL,
  }, { status: 200 })
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ success: false, message: 'Não autenticado' }, { status: 401 })
  }

  try {
    const supabase = await createAdminClient()

    const { count: productsCount, error: productsErr } = await (supabase as any)
      .from('products')
      .select('*', { count: 'exact', head: true })

    if (productsErr) {
      return NextResponse.json({
        exists: false,
        error: productsErr.message,
        sql: SETUP_SQL,
      })
    }

    const { count: featuresCount } = await (supabase as any)
      .from('product_features')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      exists: true,
      products: productsCount ?? 0,
      features: featuresCount ?? 0,
    })
  } catch (err: any) {
    return NextResponse.json({ exists: false, error: err.message, sql: SETUP_SQL })
  }
}
