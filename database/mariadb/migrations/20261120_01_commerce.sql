-- ============================================================================
-- Comércio: preços por ciclo, preços de domínios, estados de encomenda,
-- pagamento e activação. Só acrescenta (ADD COLUMN IF NOT EXISTS /
-- CREATE TABLE IF NOT EXISTS): preserva dados, IDs e slugs existentes.
-- Aplicar com scripts/mariadb/migrate-schema.mjs (regista em vh_schema_migrations).
-- ============================================================================

-- Produtos: estado comercial e forma de activação
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `sale_status` ENUM('active','draft','on_request') NOT NULL DEFAULT 'active';
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `service_type` VARCHAR(32) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `provisioning` ENUM('whm','registrar','manual') NOT NULL DEFAULT 'manual';
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `whm_package` VARCHAR(255) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `quantity_unit` VARCHAR(32) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `max_quantity` INT NOT NULL DEFAULT 1;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `pricing_note` MEDIUMTEXT NULL;

-- Preço por produto e ciclo (valor cobrado no ciclo + valor de renovação comunicado)
CREATE TABLE IF NOT EXISTS `product_prices` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `product_id` CHAR(36) NOT NULL,
  `cycle` ENUM('monthly','6months','1year','2years','3years') NOT NULL,
  `months` INT NOT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `renewal_price` DECIMAL(12,2) NOT NULL,
  `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'AKZ',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `reference` JSON NULL CHECK (json_valid(`reference`)),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_prices_product_cycle_key` (`product_id`, `cycle`),
  CONSTRAINT `product_prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preços de domínios por extensão e operação
CREATE TABLE IF NOT EXISTS `domain_prices` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `extension` VARCHAR(32) NOT NULL,
  `operation` ENUM('register','renew','transfer') NOT NULL,
  `years` INT NOT NULL DEFAULT 1,
  `price` DECIMAL(12,2) NULL,
  `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'AKZ',
  `status` ENUM('active','draft','on_request') NOT NULL DEFAULT 'active',
  `registrar` VARCHAR(64) NULL,
  `reference` JSON NULL CHECK (json_valid(`reference`)),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `domain_prices_ext_op_years_key` (`extension`, `operation`, `years`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Encomendas: idempotência, totais, estados de pagamento e activação
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `idempotency_key` VARCHAR(64) NULL;
ALTER TABLE `orders` ADD UNIQUE KEY IF NOT EXISTS `orders_idempotency_key` (`user_id`, `idempotency_key`);
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `order_number` VARCHAR(32) NULL;
ALTER TABLE `orders` ADD UNIQUE KEY IF NOT EXISTS `orders_order_number_key` (`order_number`);
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'AKZ';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `subtotal` DECIMAL(12,2) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `payment_status` ENUM('unpaid','proof_submitted','paid','failed','refunded') NOT NULL DEFAULT 'unpaid';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `activation_status` ENUM('pending','in_progress','active','partial','manual_required','failed','cancelled') NOT NULL DEFAULT 'pending';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `paid_at` DATETIME(6) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `billing_details` JSON NULL CHECK (json_valid(`billing_details`));

-- Itens: valores aceites pelo cliente
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `product_id` CHAR(36) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `product_slug` VARCHAR(128) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `billing_cycle` VARCHAR(16) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `months` INT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `unit_price` DECIMAL(12,2) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `line_total` DECIMAL(12,2) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `renewal_price` DECIMAL(12,2) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `domain_name` VARCHAR(255) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `domain_operation` ENUM('register','transfer','existing','renew') NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `epp_code_enc` MEDIUMTEXT NULL;

-- Serviços: ligação ao item, estado de activação e renovação
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `product_id` CHAR(36) NULL;
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `order_item_id` CHAR(36) NULL;
ALTER TABLE `services` ADD UNIQUE KEY IF NOT EXISTS `services_order_item_key` (`order_item_id`);
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `domain` VARCHAR(255) NULL;
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `renewal_price` DECIMAL(12,2) NULL;
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `provisioning_status` ENUM('pending','in_progress','active','manual_required','failed') NOT NULL DEFAULT 'pending';
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `provisioning_error` MEDIUMTEXT NULL;
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `provisioning_attempts` INT NOT NULL DEFAULT 0;
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `provisioned_at` DATETIME(6) NULL;
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `external_ref` VARCHAR(255) NULL;
ALTER TABLE `services` ADD COLUMN IF NOT EXISTS `next_due_date` DATE NULL;

-- Pagamentos: identificador do evento do gateway (notificações repetidas)
ALTER TABLE `payments` ADD COLUMN IF NOT EXISTS `gateway_event_id` VARCHAR(191) NULL;
ALTER TABLE `payments` ADD UNIQUE KEY IF NOT EXISTS `payments_gateway_event_key` (`gateway_event_id`);

-- Imposto configurável (decisão fiscal da empresa; 0 = não aplicado)
ALTER TABLE `company_billing_settings` ADD COLUMN IF NOT EXISTS `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE `company_billing_settings` ADD COLUMN IF NOT EXISTS `tax_label` VARCHAR(32) NOT NULL DEFAULT 'IVA';
ALTER TABLE `company_billing_settings` ADD COLUMN IF NOT EXISTS `payment_methods` JSON NULL CHECK (json_valid(`payment_methods`));

-- WHM: identificador estável da conta no servidor (quando o WHM o devolve)
ALTER TABLE `whm_accounts` ADD COLUMN IF NOT EXISTS `whm_uuid` VARCHAR(64) NULL;
ALTER TABLE `whm_accounts` ADD COLUMN IF NOT EXISTS `link_candidate_profile_id` CHAR(36) NULL;
ALTER TABLE `whm_accounts` ADD COLUMN IF NOT EXISTS `link_candidate_reason` VARCHAR(255) NULL;
