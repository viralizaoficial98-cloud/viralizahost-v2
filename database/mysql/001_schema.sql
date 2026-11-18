-- ============================================================
-- ViralizaHost — schema MySQL/MariaDB (gerado por scripts/mysql-migration/generate-schema.mjs)
-- Origem: PostgreSQL schema "viralizahost" · 37 tabelas · gerado em 2026-11-18T10:01:00.893Z
-- Compatível com MariaDB 10.6+ e MySQL 8.0.16+ · utf8mb4 · datas em UTC
-- Idempotente (CREATE TABLE IF NOT EXISTS). Importar pelo phpMyAdmin ou: mysql BASE < 001_schema.sql
-- Não usa triggers, procedimentos nem eventos (a lógica correspondente está na aplicação).
-- ============================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ── activity_logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `action` ENUM('login', 'logout', 'create', 'update', 'delete', 'payment', 'suspend', 'activate') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `entity_type` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `entity_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `description` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `ip_address` VARCHAR(45) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `user_agent` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `metadata` JSON NULL DEFAULT ('{}'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_activity_created` (`created_at` DESC),
  KEY `idx_activity_profile` (`profile_id`),
  CONSTRAINT `activity_logs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_audit_logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_audit_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `conversation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `tool_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `tool_input` JSON NULL,
  `result_summary` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `error_message` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ip_address` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ai_audit_logs_created_at_idx` (`created_at`),
  KEY `ai_audit_logs_profile_id_idx` (`profile_id`),
  CONSTRAINT `ai_audit_logs_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_conversations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `session_token` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `title` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `status` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('active'),
  `user_level` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('visitor'),
  `metadata` JSON NULL DEFAULT ('{}'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ai_conversations_profile_id_idx` (`profile_id`),
  KEY `ai_conversations_session_token_idx` (`session_token`),
  CONSTRAINT `ai_conversations_status_check` CHECK ((`status` IN ('active', 'resolved', 'abandoned'))),
  CONSTRAINT `ai_conversations_user_level_check` CHECK ((`user_level` IN ('visitor', 'client', 'admin')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_messages` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `conversation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `role` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `content` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `tool_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `tool_input` JSON NULL,
  `tool_output` JSON NULL,
  `tokens_used` INT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ai_messages_conversation_id_idx` (`conversation_id`),
  CONSTRAINT `ai_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `ai_messages_role_check` CHECK ((`role` IN ('user', 'assistant', 'tool')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── banner_pages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `banner_pages` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `page_slug` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `page_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `breadcrumb` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `breadcrumb_parent` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `breadcrumb_parent_href` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `tag` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `title` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT (''),
  `subtitle` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT (''),
  `bg_image` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `bg_color` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('#080d1a'),
  `highlights` JSON NOT NULL DEFAULT ('[]'),
  `button_primary_text` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('Ver Planos'),
  `button_primary_link` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('#planos'),
  `button_secondary_text` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `button_secondary_link` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `price_text` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `show_guarantee` TINYINT(1) NOT NULL DEFAULT 1,
  `overlay_opacity` DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `banner_pages_page_slug_key` (`page_slug`),
  KEY `idx_banner_pages_active` (`is_active`),
  KEY `idx_banner_pages_slug` (`page_slug`),
  CONSTRAINT `banner_pages_overlay_opacity_check` CHECK (((`overlay_opacity` >= 0) AND (`overlay_opacity` <= 1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── clients ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `clients` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `company_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `tax_id` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `address` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `city` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `state` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `postal_code` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `notes` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `credit_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` ENUM('AKZ', 'BRL', 'USD') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'USD',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `clients_profile_id_key` (`profile_id`),
  KEY `idx_clients_profile` (`profile_id`),
  CONSTRAINT `clients_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── company_billing_settings ────────────────────────────────
CREATE TABLE IF NOT EXISTS `company_billing_settings` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `company_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('ViralizaHost'),
  `logo_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `email` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('comercial@viralizahost.com'),
  `website` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('viralizahost.com'),
  `phone` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `address` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `bank_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `account_holder` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `account_number` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `iban` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `swift` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `payment_instructions` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `footer_text` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos
E-mail: comercial@viralizahost.com | viralizahost.com | Suporte 24/7'),
  `default_due_days` INT NOT NULL DEFAULT 7,
  `email_subject_template` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('Fatura ViralizaHost nº {invoice_number} — {service_name}'),
  `email_body_template` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `auto_email_on_create` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `updated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `active_unique_key` TINYINT GENERATED ALWAYS AS (IF(`active` = 1, 1, NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `company_billing_settings_active_idx` (`active_unique_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── currency_rates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `currency_rates` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `base_currency` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'AOA',
  `target_currency` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `rate` DECIMAL(18,8) NOT NULL,
  `source` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('manual'),
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `currency_rates_base_currency_target_currency_key` (`base_currency`, `target_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── domains ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `domains` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `extension` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `full_domain` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin GENERATED ALWAYS AS (CONCAT(`name`, `extension`)) STORED,
  `status` ENUM('active', 'expired', 'pending', 'transferred', 'locked') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `registrar` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('viralizahost'),
  `nameservers` JSON NOT NULL DEFAULT ('["ns1.viralizahost.com","ns2.viralizahost.com"]'),
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
  `is_locked` TINYINT(1) NOT NULL DEFAULT 1,
  `whois_privacy` TINYINT(1) NOT NULL DEFAULT 0,
  `registered_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `expires_at` DATETIME(6) NULL,
  `price_paid` DECIMAL(12,2) NULL,
  `currency` ENUM('AKZ', 'BRL', 'USD') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `registered` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `domains_name_extension_key` (`name`, `extension`),
  UNIQUE KEY `domains_name_key` (`name`),
  KEY `idx_domains_expires` (`expires_at`),
  KEY `idx_domains_profile` (`profile_id`),
  KEY `idx_domains_profile_id` (`profile_id`),
  KEY `idx_domains_status` (`status`),
  CONSTRAINT `domains_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `domains_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `domains_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── email_logs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `recipient` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `sender` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('ViralizaHost Comercial <comercial@viralizahost.com>'),
  `subject` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `provider` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('resend'),
  `provider_message_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `status` ENUM('queued', 'processing', 'sent', 'delivered', 'bounced', 'failed', 'complained', 'delayed') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'queued',
  `error_message` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `attempts` INT NOT NULL DEFAULT 1,
  `initiated_by_agent` TINYINT(1) NOT NULL DEFAULT 0,
  `initiated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `sent_at` DATETIME(6) NULL,
  `delivered_at` DATETIME(6) NULL,
  `failed_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `email_logs_created_at_idx` (`created_at` DESC),
  KEY `email_logs_invoice_id_idx` (`invoice_id`),
  KEY `email_logs_profile_id_idx` (`profile_id`),
  KEY `email_logs_provider_message_id_idx` (`provider_message_id`),
  KEY `email_logs_status_idx` (`status`),
  CONSTRAINT `email_logs_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `email_logs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `email_logs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── emails ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `emails` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `hosting_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `email_address` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `display_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `quota_mb` INT NOT NULL DEFAULT 500,
  `used_mb` INT NOT NULL DEFAULT 0,
  `status` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('active'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `emails_email_address_key` (`email_address`),
  KEY `idx_emails_hosting` (`hosting_id`),
  KEY `idx_emails_profile_id` (`profile_id`),
  CONSTRAINT `emails_hosting_id_fkey` FOREIGN KEY (`hosting_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `emails_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── hosting_accounts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `hosting_accounts` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `cpanel_username` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `primary_domain` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `status` ENUM('pending', 'active', 'suspended', 'cancelled', 'expired', 'pending_provisioning') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `disk_used_mb` INT NOT NULL DEFAULT 0,
  `bandwidth_used_mb` INT NOT NULL DEFAULT 0,
  `email_count` INT NOT NULL DEFAULT 0,
  `db_count` INT NOT NULL DEFAULT 0,
  `php_version` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('8.2'),
  `ssl_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `disk_limit_mb` INT NULL,
  `package_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ip_address` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `suspension_reason` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `last_synced_at` DATETIME(6) NULL,
  `cpanel_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hosting_accounts_cpanel_username_key` (`cpanel_username`),
  KEY `idx_hosting_accounts_profile_id` (`profile_id`),
  KEY `idx_hosting_domain` (`primary_domain`),
  KEY `idx_hosting_profile` (`profile_id`),
  CONSTRAINT `hosting_accounts_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `hosting_accounts_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `hosting_accounts_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── invoice_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `product_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `description` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `invoice_items_invoice_id_idx` (`invoice_id`),
  CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `invoice_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── invoice_send_logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_send_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `customer_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `recipient` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `provider` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('resend'),
  `provider_message_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `status` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('attempted'),
  `error_message` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `initiated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `initiated_by_agent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `invoice_send_logs_customer_id_idx` (`customer_id`),
  KEY `invoice_send_logs_invoice_id_idx` (`invoice_id`),
  KEY `invoice_send_logs_provider_msg_idx` (`provider_message_id`),
  CONSTRAINT `invoice_send_logs_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `invoice_send_logs_status_check` CHECK ((`status` IN ('attempted', 'sent', 'delivered', 'bounced', 'failed', 'complained')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── invoices ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `invoice_number` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT (CONCAT('INV-', DATE_FORMAT(CURRENT_TIMESTAMP, '%Y'), '-', LPAD(FLOOR(RAND() * 99999), 5, '0'))),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `status` ENUM('pending', 'paid', 'overdue', 'cancelled', 'refunded', 'under_review', 'partially_paid', 'rejected', 'draft', 'sending', 'sent', 'generated', 'failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `currency` ENUM('AKZ', 'BRL', 'USD') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'USD',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `tax` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `items` JSON NOT NULL DEFAULT ('[]'),
  `due_date` DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6) + INTERVAL 7 DAY),
  `paid_at` DATETIME(6) NULL,
  `notes` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `issue_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `pdf_storage_path` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `emailed_at` DATETIME(6) NULL,
  `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `email_to` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `email_from` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `email_provider` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('resend'),
  `email_provider_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `email_sent_at` DATETIME(6) NULL,
  `email_last_error` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `email_attempts` INT NOT NULL DEFAULT 0,
  `email_delivered_at` DATETIME(6) NULL,
  `email_bounced_at` DATETIME(6) NULL,
  `email_status` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'unsent',
  `proof_file` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoices_invoice_number_key` (`invoice_number`),
  KEY `idx_invoices_profile` (`profile_id`),
  KEY `idx_invoices_profile_created` (`profile_id`, `created_at` DESC),
  KEY `idx_invoices_profile_status` (`profile_id`, `status`),
  KEY `idx_invoices_status` (`status`),
  KEY `invoices_due_date_idx` (`due_date`),
  KEY `invoices_email_provider_id_idx` (`email_provider_id`),
  KEY `invoices_email_status_idx` (`email_status`),
  KEY `invoices_order_id_idx` (`order_id`),
  UNIQUE KEY `invoices_order_id_unique_idx` (`order_id`),
  KEY `invoices_profile_id_idx` (`profile_id`),
  KEY `invoices_status_idx` (`status`),
  KEY `invoices_ticket_id_idx` (`ticket_id`),
  CONSTRAINT `invoices_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `invoices_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `invoices_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `invoices_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `invoices_email_status_check` CHECK ((`email_status` IN ('unsent', 'queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'complained')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── notifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `type` ENUM('info', 'warning', 'error', 'success') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'info',
  `title` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `message` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `link` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_profile` (`profile_id`),
  KEY `idx_notifications_read` (`profile_id`, `is_read`),
  CONSTRAINT `notifications_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── order_items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `service_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `service_type` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('other'),
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `order_items_order_idx` (`order_id`),
  CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── orders ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `orders` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `billing_cycle` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('monthly'),
  `domain_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `domain_action` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `payment_method` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('bank_transfer'),
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `proof_file` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `transfer_ref` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `notes` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `use_default_ns` TINYINT(1) NOT NULL DEFAULT 1,
  `ns1` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ns2` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ns3` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ns4` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user_created` (`user_id`, `created_at` DESC),
  KEY `orders_status_idx` (`status`),
  KEY `orders_user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── payments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `method` ENUM('credit_card', 'paypal', 'mercadopago', 'pix', 'bank_transfer', 'multicaixa') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'credit_card',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `currency` ENUM('AKZ', 'BRL', 'USD') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'USD',
  `status` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `gateway_ref` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `gateway_data` JSON NULL DEFAULT ('{}'),
  `paid_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `proof_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `proof_filename` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `proof_mime` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `transfer_ref` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `transfer_date` DATE NULL,
  `payer_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `payer_bank` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `declared_amount` DECIMAL(12,2) NULL,
  `rejection_reason` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `reviewed_at` DATETIME(6) NULL,
  `reviewed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`id`),
  KEY `idx_payments_invoice` (`invoice_id`),
  KEY `payments_invoice_id_idx` (`invoice_id`),
  KEY `payments_order_id_idx` (`order_id`),
  KEY `payments_profile_id_idx` (`profile_id`),
  KEY `payments_status_idx` (`status`),
  CONSTRAINT `payments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `payments_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── plans ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `plans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `slug` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `type` ENUM('shared', 'vps', 'dedicated', 'reseller') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'shared',
  `description` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `features` JSON NOT NULL DEFAULT ('[]'),
  `price_akz` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `price_brl` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `price_usd` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `disk_gb` INT NOT NULL DEFAULT 10,
  `bandwidth_gb` INT NOT NULL DEFAULT 100,
  `email_accounts` INT NOT NULL DEFAULT 5,
  `max_domains` INT NOT NULL DEFAULT 1,
  `max_subdomains` INT NOT NULL DEFAULT 5,
  `max_databases` INT NOT NULL DEFAULT 3,
  `is_popular` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `plans_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── product_features ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_features` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `product_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `feature` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `included` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_features_product_id_idx` (`product_id`),
  CONSTRAINT `product_features_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── products ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `products` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `slug` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `category` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `badge` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `popular` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  `price_monthly` DECIMAL(12,2) NULL,
  `price_6months` DECIMAL(12,2) NULL,
  `price_1year` DECIMAL(12,2) NULL,
  `price_2years` DECIMAL(12,2) NULL,
  `price_3years` DECIMAL(12,2) NULL,
  `color` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `href_override` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `meta` JSON NULL DEFAULT ('{}'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `subcategory` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `cta_label` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `cta_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `currency` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('AOA'),
  `price_aoa` DECIMAL(12,2) NULL,
  `price_brl` DECIMAL(12,2) NULL,
  `price_usd` DECIMAL(12,2) NULL,
  `use_auto_conversion` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `full_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT (''),
  `phone` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `country` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('AO'),
  `role` ENUM('client', 'admin', 'reseller') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'client',
  `currency` ENUM('AKZ', 'BRL', 'USD') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'USD',
  `avatar_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `profiles_email_key` (`email`),
  KEY `idx_profiles_email` (`email`),
  KEY `idx_profiles_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── servers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `servers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `hostname` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `ip_address` VARCHAR(45) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `location` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('AO'),
  `whm_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `whm_api_token` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `whm_username` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('root'),
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `max_accounts` INT NOT NULL DEFAULT 500,
  `current_load` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `notes` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── services ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `services` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `plan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `status` ENUM('pending', 'active', 'suspended', 'cancelled', 'expired', 'pending_provisioning') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `currency` ENUM('AKZ', 'BRL', 'USD') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'USD',
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `billing_cycle` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('monthly'),
  `started_at` DATETIME(6) NULL,
  `expires_at` DATETIME(6) NULL,
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `service_type` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `service_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  KEY `idx_services_expires` (`expires_at`),
  KEY `idx_services_profile` (`profile_id`),
  KEY `idx_services_profile_id` (`profile_id`),
  KEY `idx_services_status` (`status`),
  KEY `services_order_id_idx` (`order_id`),
  CONSTRAINT `services_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `services_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `services_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `services_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── site_banners ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_banners` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `position` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `bg_image` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `bg_color` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('#000000'),
  `accent_color` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('#F5B700'),
  `tag` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `title` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `subtitle` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `cta_text` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `cta_href` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `cta_secondary_text` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `cta_secondary_href` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `features` JSON NULL,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_banners_position_key` (`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── site_domains ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_domains` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `extension` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `currency` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('AOA'),
  `popular` TINYINT(1) NULL DEFAULT 0,
  `active` TINYINT(1) NULL DEFAULT 1,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_domains_extension_key` (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── site_email_plans ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_email_plans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `badge` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `discount_annual` INT NULL DEFAULT 0,
  `features` JSON NULL,
  `active` TINYINT(1) NULL DEFAULT 1,
  `featured` TINYINT(1) NULL DEFAULT 0,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `currency` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('AOA'),
  `storage_gb` INT NULL DEFAULT 10,
  `accounts` INT NULL DEFAULT 5,
  `color` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('#3B82F6'),
  `popular` TINYINT(1) NULL DEFAULT 0,
  `slug` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_email_plans_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── site_home_hero ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_home_hero` (
  `id` SMALLINT NOT NULL DEFAULT 1,
  `mode` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('carousel'),
  `video_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `video_storage_path` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `video_file_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `video_size_bytes` BIGINT NULL,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `updated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `site_home_hero_id_check` CHECK ((`id` = 1)),
  CONSTRAINT `site_home_hero_mode_check` CHECK ((`mode` IN ('carousel', 'video'))),
  CONSTRAINT `site_home_hero_video_required` CHECK (((`mode` = 'carousel') OR ((`video_url` IS NOT NULL ) AND (CHAR_LENGTH(TRIM(video_url)) > 0))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── site_hosting_plans ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_hosting_plans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `badge` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `discount_annual` INT NULL DEFAULT 0,
  `features` JSON NULL,
  `active` TINYINT(1) NULL DEFAULT 1,
  `featured` TINYINT(1) NULL DEFAULT 0,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `currency` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('AOA'),
  `slug` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_hosting_plans_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── site_team ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_team` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `is_ceo` TINYINT(1) NULL DEFAULT 0,
  `name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `role` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `title` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('Especialista'),
  `bio` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `photo_url` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `flag` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `country` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `accent_color` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT ('#F5B700'),
  `position` INT NULL DEFAULT 0,
  `active` TINYINT(1) NULL DEFAULT 1,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `country_code` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `specialty` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `secondary_flag` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `secondary_country_code` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `secondary_country_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_team_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── sso_audit_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sso_audit_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `hosting_account_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `access_type` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `ip_address` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `user_agent` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `error_message` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_sso_audit_created` (`created_at`),
  KEY `idx_sso_audit_logs_profile_id` (`profile_id`),
  KEY `idx_sso_audit_profile` (`profile_id`),
  CONSTRAINT `sso_audit_logs_hosting_account_id_fkey` FOREIGN KEY (`hosting_account_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `sso_audit_logs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `sso_audit_logs_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ticket_attachments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ticket_attachments` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `message_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `file_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `storage_path` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `mime_type` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('application/pdf'),
  `file_size` INT NULL,
  `uploaded_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ticket_attachments_invoice_id_idx` (`invoice_id`),
  KEY `ticket_attachments_ticket_id_idx` (`ticket_id`),
  CONSTRAINT `ticket_attachments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `ticket_attachments_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `ticket_messages` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `ticket_attachments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ticket_messages ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ticket_messages` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `message` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_staff` TINYINT(1) NOT NULL DEFAULT 0,
  `attachments` JSON NULL DEFAULT ('[]'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_messages_ticket` (`ticket_id`),
  KEY `ticket_messages_ticket_idx` (`ticket_id`),
  CONSTRAINT `ticket_messages_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `ticket_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── tickets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `subject` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `status` ENUM('open', 'in_progress', 'resolved', 'closed') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'open',
  `priority` ENUM('low', 'medium', 'high', 'critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'medium',
  `department` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('technical'),
  `assigned_to` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `closed_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `ticket_number` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `category` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `domain_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tickets_ticket_number_key` (`ticket_number`),
  KEY `idx_tickets_profile` (`profile_id`),
  KEY `idx_tickets_status` (`status`),
  KEY `tickets_assigned_to_idx` (`assigned_to`),
  KEY `tickets_created_at_idx` (`created_at` DESC),
  KEY `tickets_priority_idx` (`priority`),
  KEY `tickets_profile_id_idx` (`profile_id`),
  KEY `tickets_status_idx` (`status`),
  CONSTRAINT `tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `profiles` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `tickets_domain_id_fkey` FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `tickets_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `tickets_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── whm_accounts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `whm_accounts` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `whm_username` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `primary_domain` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `contact_email` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `package_name` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `ip_address` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `owner` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `partition` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `disk_used_mb` INT NOT NULL DEFAULT 0,
  `disk_limit_mb` INT NULL,
  `unix_startdate` BIGINT NULL,
  `account_created_at` DATETIME(6) NULL,
  `is_suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `suspension_reason` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `theme` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `php_version` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `max_pop` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `max_sub` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `max_sql` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `max_ftp` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `hosting_account_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `raw_metadata` JSON NULL,
  `status` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'active',
  `last_synced_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `sync_status` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'linked',
  `requires_manual_link` TINYINT(1) NOT NULL DEFAULT 0,
  `link_status` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT ('linked'),
  `notes` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `whm_accounts_server_id_primary_domain_key` (`server_id`, `primary_domain`),
  UNIQUE KEY `whm_accounts_server_id_whm_username_key` (`server_id`, `whm_username`),
  KEY `idx_whm_accounts_email` (`contact_email`),
  KEY `idx_whm_accounts_hosting_acct_id` (`hosting_account_id`),
  KEY `idx_whm_accounts_profile` (`profile_id`),
  KEY `idx_whm_accounts_profile_id` (`profile_id`),
  KEY `idx_whm_accounts_server` (`server_id`),
  KEY `idx_whm_accounts_status` (`status`),
  KEY `idx_whm_accounts_sync_status` (`sync_status`),
  CONSTRAINT `whm_accounts_hosting_account_id_fkey` FOREIGN KEY (`hosting_account_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `whm_accounts_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `whm_accounts_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `whm_accounts_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── whm_package_mappings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS `whm_package_mappings` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()),
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `whm_package_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `plan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `label` MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `whm_package_mappings_server_id_whm_package_name_key` (`server_id`, `whm_package_name`),
  KEY `idx_whm_mappings_server` (`server_id`),
  CONSTRAINT `whm_package_mappings_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT `whm_package_mappings_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Linha única da configuração do topo da página inicial (equivalente à migração 20261118_000000_home_hero.sql)
INSERT IGNORE INTO `site_home_hero` (`id`, `mode`) VALUES (1, 'carousel');

-- Controlo de versão do schema e da migração de dados
CREATE TABLE IF NOT EXISTS `_migration_state` (
  `table_name` VARCHAR(64) CHARACTER SET ascii NOT NULL,
  `rows_imported` BIGINT NOT NULL DEFAULT 0,
  `last_batch_at` DATETIME(6) NULL,
  `completed_at` DATETIME(6) NULL,
  `source_count` BIGINT NULL,
  `checksum` VARCHAR(64) NULL,
  PRIMARY KEY (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
