-- E-mail Corporativo: preço mensal base, desconto por período e ficha do plano.
-- Os preços cobrados continuam em product_prices (total por caixa e por período). Idempotente.
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_monthly_price DECIMAL(12,2) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS storage_gb INT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS send_limit_hour INT NULL;
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS discount_pct TINYINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS renewal_discount_pct TINYINT UNSIGNED NOT NULL DEFAULT 0;

-- Planos de e-mail existentes: preço base = preço mensal actual; desconto 0 (preços inalterados)
UPDATE products p JOIN product_prices pp ON pp.product_id = p.id AND pp.cycle = 'monthly'
SET p.base_monthly_price = pp.price
WHERE p.category = 'email' AND p.base_monthly_price IS NULL AND pp.price IS NOT NULL;

-- Armazenamento por caixa a partir das características já publicadas (ex.: «20 GB por caixa»); não altera as características
UPDATE products p
SET p.storage_gb = (
  SELECT CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(f.feature, '[0-9]+ ?GB'), '[0-9]+') AS UNSIGNED)
  FROM product_features f WHERE f.product_id = p.id AND f.included = 1 AND f.feature REGEXP '[0-9]+ ?GB' ORDER BY f.position LIMIT 1)
WHERE p.category = 'email' AND p.storage_gb IS NULL;
