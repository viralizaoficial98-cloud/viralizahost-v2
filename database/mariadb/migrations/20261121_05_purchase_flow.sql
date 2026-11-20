-- Fluxo de compra: ciclo trimestral, pedidos de cotação e retenção de encomendas
-- com domínios cuja disponibilidade depende da equipa (ex.: .ao sem consulta automática).
ALTER TABLE product_prices MODIFY cycle ENUM('monthly','3months','6months','1year','2years','3years') NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_reason VARCHAR(40) NULL AFTER activation_status;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS availability VARCHAR(16) NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS years INT NULL;

CREATE TABLE IF NOT EXISTS quote_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reference VARCHAR(32) NOT NULL,
  product_id CHAR(36) NULL,
  product_slug VARCHAR(120) NULL,
  product_name VARCHAR(255) NULL,
  profile_id CHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(60) NULL,
  company VARCHAR(255) NULL,
  message TEXT NULL,
  status ENUM('new','contacted','quoted','closed') NOT NULL DEFAULT 'new',
  admin_notes TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY quote_requests_reference_key (reference),
  KEY quote_requests_status_idx (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
