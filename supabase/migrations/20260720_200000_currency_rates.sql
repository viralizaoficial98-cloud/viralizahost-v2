-- currency_rates: taxas de conversão de moeda
-- Moeda base: AOA (Kwanza angolano)

SET search_path TO viralizahost, public;

CREATE TABLE IF NOT EXISTS currency_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency   TEXT NOT NULL DEFAULT 'AOA',
  target_currency TEXT NOT NULL,
  rate            DECIMAL(18,8) NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_currency, target_currency)
);

-- Taxas iniciais (actualizar manualmente conforme mercado)
INSERT INTO currency_rates (base_currency, target_currency, rate, source) VALUES
  ('AOA', 'AOA', 1.00000000,    'manual'),
  ('AOA', 'BRL', 0.00420000,    'manual'),   -- 1 AOA ≈ 0.0042 BRL (1 BRL ≈ 238 AOA)
  ('AOA', 'USD', 0.00109000,    'manual')    -- 1 AOA ≈ 0.00109 USD (1 USD ≈ 917 AOA)
ON CONFLICT (base_currency, target_currency)
DO UPDATE SET rate = EXCLUDED.rate, updated_at = NOW();

-- RLS
ALTER TABLE currency_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "currency_rates: public_read"        ON currency_rates;
DROP POLICY IF EXISTS "currency_rates: service_role_all"   ON currency_rates;

CREATE POLICY "currency_rates: public_read"
  ON currency_rates FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "currency_rates: service_role_all"
  ON currency_rates FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON currency_rates TO anon, authenticated;
GRANT ALL    ON currency_rates TO service_role;

-- Adicionar colunas de preço por moeda à tabela products (se não existirem)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_aoa    DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS price_brl    DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS price_usd    DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS use_auto_conversion BOOLEAN NOT NULL DEFAULT true;

-- Backfill: usar price_monthly como price_aoa
UPDATE products SET price_aoa = price_monthly WHERE price_aoa IS NULL AND price_monthly IS NOT NULL;
