-- Servidor VPS (categoria «vps», sem subcategoria): ficha do plano, imagem, ícones das características,
-- associação a um produto da Hostinger (custo do fornecedor separado do preço de venda), opções da encomenda
-- (localização / sistema operativo) e operações de aprovisionamento no fornecedor (uma compra por item).
-- Ordem: depois de 20261203_17_bank_transfer_settings.sql. Idempotente.
-- Não altera planos, preços, ciclos, encomendas nem serviços existentes; os VPS ficam em activação manual.

-- Ficha e apresentação (plan_specs já existe desde a migração 15)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_path VARCHAR(512) NULL;
ALTER TABLE product_features ADD COLUMN IF NOT EXISTS icon VARCHAR(32) NULL;

-- Produto exacto do fornecedor (ex.: catálogo Hostinger «KVM 2») e modo de activação do plano
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_product_id VARCHAR(160) NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_mode VARCHAR(10) NOT NULL DEFAULT 'manual';
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_specs LONGTEXT NULL CHECK (provider_specs IS NULL OR JSON_VALID(provider_specs));

-- Por ciclo: item de preço do fornecedor, custo esperado (unidades mínimas, ex.: cêntimos), moeda e limite de custo
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS provider_item_id VARCHAR(160) NULL;
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS provider_cost_minor INT NULL;
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS provider_currency CHAR(3) NULL;
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS provider_cost_limit_minor INT NULL;

-- Opções escolhidas pelo cliente (ex.: {"location":{"id":..,"label":..},"os":{"id":..,"label":..}})
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS options LONGTEXT NULL CHECK (options IS NULL OR JSON_VALID(options));

-- Integração Hostinger VPS (Integrações → Hostinger VPS). Credencial cifrada como as restantes integrações.
CREATE TABLE IF NOT EXISTS vps_provider_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL DEFAULT 'hostinger',
  mode VARCHAR(10) NOT NULL DEFAULT 'test',
  api_url VARCHAR(255) NULL,
  secret_enc TEXT NULL,
  auto_provision TINYINT(1) NOT NULL DEFAULT 0,
  payment_method_id BIGINT NULL,
  options LONGTEXT NULL CHECK (options IS NULL OR JSON_VALID(options)),
  last_test_ok TINYINT(1) NULL,
  last_test_at DATETIME(6) NULL,
  last_test_message VARCHAR(500) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT IGNORE INTO vps_provider_settings (id) VALUES (1);

-- Uma operação (compra) por serviço: UNIQUE(service_id) e client_ref impedem compras duplicadas
CREATE TABLE IF NOT EXISTS vps_provider_orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  order_item_id CHAR(36) NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'hostinger',
  mode VARCHAR(10) NOT NULL,
  client_ref VARCHAR(64) NOT NULL,
  item_id VARCHAR(160) NOT NULL,
  expected_cost_minor INT NULL,
  cost_limit_minor INT NULL,
  currency CHAR(3) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider_vm_id VARCHAR(64) NULL,
  provider_order_id VARCHAR(64) NULL,
  provider_subscription_id VARCHAR(64) NULL,
  provider_status VARCHAR(40) NULL,
  ipv4 VARCHAR(64) NULL,
  attempts INT NOT NULL DEFAULT 0,
  message VARCHAR(500) NULL,
  request LONGTEXT NULL CHECK (request IS NULL OR JSON_VALID(request)),
  locked_until DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_vps_order_service (service_id),
  UNIQUE KEY uq_vps_order_ref (client_ref),
  KEY idx_vps_order_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vps_provider_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  provider_order_id CHAR(36) NOT NULL,
  event VARCHAR(40) NOT NULL,
  detail VARCHAR(500) NULL,
  actor CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_vps_ev (provider_order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preço base e desconto por ciclo calculados a partir dos preços GUARDADOS (como na Hospedagem Premium);
-- os preços não mudam. Só VPS sem subcategoria e ainda sem preço base.
UPDATE product_prices pp
JOIN products p ON p.id = pp.product_id AND p.category = 'vps' AND p.subcategory IS NULL AND p.base_monthly_price IS NULL
JOIN product_prices m ON m.product_id = p.id AND m.cycle = 'monthly' AND m.price > 0
SET pp.discount_pct = LEAST(90, GREATEST(0, ROUND(100 * (1 - pp.price / (m.price * pp.months)))))
WHERE pp.price > 0;
UPDATE products p JOIN product_prices m ON m.product_id = p.id AND m.cycle = 'monthly'
SET p.base_monthly_price = m.price
WHERE p.category = 'vps' AND p.subcategory IS NULL AND p.base_monthly_price IS NULL AND m.price > 0;
