-- ═══════════════════════════════════════════════════════════════════════
-- ViralizaHost — Schema MariaDB 10.11 (gerado por scripts/mariadb/generate-schema.mjs)
-- Origem: PostgreSQL schema "viralizahost" (Supabase)
-- Importar no phpMyAdmin: base viralizahost_viralizaHost → Importar → este ficheiro.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS; não apaga dados existentes.
-- Datas: guardadas em UTC (DATETIME(6)); a aplicação liga com time_zone '+00:00'.
-- ═══════════════════════════════════════════════════════════════════════
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ─── auth_users (substitui auth.users do Supabase Auth) ────────────────
-- encrypted_password guarda o hash bcrypt ($2a$/$2b$) copiado do Supabase,
-- por isso as palavras-passe existentes continuam válidas após a migração.
CREATE TABLE IF NOT EXISTS `auth_users` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` VARCHAR(255) NULL,
  `encrypted_password` VARCHAR(255) NULL,
  `email_confirmed_at` DATETIME(6) NULL,
  `phone` VARCHAR(64) NULL,
  `raw_user_meta_data` LONGTEXT NULL,
  `raw_app_meta_data` LONGTEXT NULL,
  `role` VARCHAR(64) NULL DEFAULT 'authenticated',
  `last_sign_in_at` DATETIME(6) NULL,
  `banned_until` DATETIME(6) NULL,
  `session_version` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `deleted_at` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_users_email_key` (`email`),
  CONSTRAINT `chk_auth_users_meta_json` CHECK (`raw_user_meta_data` IS NULL OR JSON_VALID(`raw_user_meta_data`)),
  CONSTRAINT `chk_auth_users_app_json` CHECK (`raw_app_meta_data` IS NULL OR JSON_VALID(`raw_app_meta_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── storage_objects (substitui storage.objects do Supabase Storage) ───
-- Os ficheiros ficam no disco do servidor (STORAGE_ROOT); esta tabela guarda os metadados.
CREATE TABLE IF NOT EXISTS `storage_objects` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `bucket_id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(700) NOT NULL,
  `owner` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `mime_type` VARCHAR(255) NULL,
  `size_bytes` BIGINT NULL,
  `metadata` LONGTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `storage_objects_bucket_name` (`bucket_id`, `name`(500)),
  KEY `storage_objects_owner` (`owner`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── migration_state (checkpoints do script de migração / sincronização) ─
CREATE TABLE IF NOT EXISTS `migration_state` (
  `table_name` VARCHAR(100) NOT NULL,
  `direction` VARCHAR(20) NOT NULL DEFAULT 'pg_to_mysql',
  `last_run_at` DATETIME(6) NULL,
  `last_watermark` DATETIME(6) NULL,
  `rows_copied` BIGINT NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  PRIMARY KEY (`table_name`, `direction`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `full_name` TEXT NOT NULL DEFAULT '',
  `phone` TEXT NULL,
  `country` TEXT NOT NULL DEFAULT 'AO',
  `role` VARCHAR(32) NOT NULL DEFAULT 'client',
  `currency` VARCHAR(32) NOT NULL DEFAULT 'USD',
  `avatar_url` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_profiles_email` (`email`),
  KEY `idx_profiles_role` (`role`),
  UNIQUE KEY `profiles_email_key` (`email`),
  CONSTRAINT `chk_profiles_role` CHECK (`role` IN ('client', 'admin', 'reseller')),
  CONSTRAINT `chk_profiles_currency` CHECK (`currency` IN ('AKZ', 'BRL', 'USD')),
  CONSTRAINT `profiles_id_fkey` FOREIGN KEY (`id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── activity_logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `action` VARCHAR(32) NOT NULL,
  `entity_type` TEXT NULL,
  `entity_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `description` TEXT NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `metadata` LONGTEXT NULL DEFAULT ('{}'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_activity_profile` (`profile_id`),
  KEY `idx_activity_created` (`created_at` DESC),
  CONSTRAINT `chk_activity_logs_action` CHECK (`action` IN ('login', 'logout', 'create', 'update', 'delete', 'payment', 'suspend', 'activate')),
  CONSTRAINT `chk_activity_logs_metadata_json` CHECK (`metadata` IS NULL OR JSON_VALID(`metadata`)),
  CONSTRAINT `activity_logs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ai_conversations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `session_token` VARCHAR(255) NULL,
  `title` TEXT NULL,
  `status` TEXT NOT NULL DEFAULT 'active',
  `user_level` TEXT NOT NULL DEFAULT 'visitor',
  `metadata` LONGTEXT NULL DEFAULT ('{}'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ai_conversations_profile_id_idx` (`profile_id`),
  KEY `ai_conversations_session_token_idx` (`session_token`),
  CONSTRAINT `chk_ai_conversations_metadata_json` CHECK (`metadata` IS NULL OR JSON_VALID(`metadata`)),
  CONSTRAINT `ai_conversations_status_check` CHECK (`status` IN ('active', 'resolved', 'abandoned')),
  CONSTRAINT `ai_conversations_user_level_check` CHECK (`user_level` IN ('visitor', 'client', 'admin')),
  CONSTRAINT `ai_conversations_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ai_audit_logs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_audit_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `conversation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `tool_name` TEXT NOT NULL,
  `tool_input` LONGTEXT NULL,
  `result_summary` TEXT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `error_message` TEXT NULL,
  `ip_address` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ai_audit_logs_profile_id_idx` (`profile_id`),
  KEY `ai_audit_logs_created_at_idx` (`created_at`),
  CONSTRAINT `chk_ai_audit_logs_tool_input_json` CHECK (`tool_input` IS NULL OR JSON_VALID(`tool_input`)),
  CONSTRAINT `ai_audit_logs_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ai_audit_logs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ai_messages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ai_messages` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `conversation_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `role` TEXT NOT NULL,
  `content` TEXT NOT NULL,
  `tool_name` TEXT NULL,
  `tool_input` LONGTEXT NULL,
  `tool_output` LONGTEXT NULL,
  `tokens_used` INT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ai_messages_conversation_id_idx` (`conversation_id`),
  CONSTRAINT `chk_ai_messages_tool_input_json` CHECK (`tool_input` IS NULL OR JSON_VALID(`tool_input`)),
  CONSTRAINT `chk_ai_messages_tool_output_json` CHECK (`tool_output` IS NULL OR JSON_VALID(`tool_output`)),
  CONSTRAINT `ai_messages_role_check` CHECK (`role` IN ('user', 'assistant', 'tool')),
  CONSTRAINT `ai_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── banner_pages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `banner_pages` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `page_slug` VARCHAR(255) NOT NULL,
  `page_name` TEXT NOT NULL,
  `breadcrumb` TEXT NULL,
  `breadcrumb_parent` TEXT NULL,
  `breadcrumb_parent_href` TEXT NULL,
  `tag` TEXT NULL,
  `title` TEXT NOT NULL DEFAULT '',
  `subtitle` TEXT NOT NULL DEFAULT '',
  `bg_image` TEXT NULL,
  `bg_color` TEXT NOT NULL DEFAULT '#080d1a',
  `highlights` LONGTEXT NOT NULL DEFAULT ('[]'),
  `button_primary_text` TEXT NOT NULL DEFAULT 'Ver Planos',
  `button_primary_link` TEXT NOT NULL DEFAULT '#planos',
  `button_secondary_text` TEXT NULL,
  `button_secondary_link` TEXT NULL,
  `price_text` TEXT NULL,
  `show_guarantee` TINYINT(1) NOT NULL DEFAULT 1,
  `overlay_opacity` DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_banner_pages_active` (`is_active`),
  UNIQUE KEY `banner_pages_page_slug_key` (`page_slug`),
  KEY `idx_banner_pages_slug` (`page_slug`),
  CONSTRAINT `chk_banner_pages_highlights_json` CHECK (`highlights` IS NULL OR JSON_VALID(`highlights`)),
  CONSTRAINT `banner_pages_overlay_opacity_check` CHECK (((overlay_opacity >= 0) AND (overlay_opacity <= 1)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── clients ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `clients` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `company_name` TEXT NULL,
  `tax_id` TEXT NULL,
  `address` TEXT NULL,
  `city` TEXT NULL,
  `state` TEXT NULL,
  `postal_code` TEXT NULL,
  `notes` TEXT NULL,
  `credit_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(32) NOT NULL DEFAULT 'USD',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_clients_profile` (`profile_id`),
  UNIQUE KEY `clients_profile_id_key` (`profile_id`),
  CONSTRAINT `chk_clients_currency` CHECK (`currency` IN ('AKZ', 'BRL', 'USD')),
  CONSTRAINT `clients_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── company_billing_settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `company_billing_settings` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `company_name` TEXT NOT NULL DEFAULT 'ViralizaHost',
  `logo_url` TEXT NULL,
  `email` TEXT NOT NULL DEFAULT 'comercial@viralizahost.com',
  `website` TEXT NOT NULL DEFAULT 'viralizahost.com',
  `phone` TEXT NULL,
  `address` TEXT NULL,
  `bank_name` TEXT NULL,
  `account_holder` TEXT NULL,
  `account_number` TEXT NULL,
  `iban` TEXT NULL,
  `swift` TEXT NULL,
  `payment_instructions` TEXT NULL,
  `footer_text` TEXT NULL DEFAULT 'ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos
E-mail: comercial@viralizahost.com | viralizahost.com | Suporte 24/7',
  `default_due_days` INT NOT NULL DEFAULT 7,
  `email_subject_template` TEXT NULL DEFAULT 'Fatura ViralizaHost nº {invoice_number} — {service_name}',
  `email_body_template` TEXT NULL,
  `auto_email_on_create` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  PRIMARY KEY (`id`),
  `active_unique_key` TINYINT GENERATED ALWAYS AS (IF(`active`, 1, NULL)) VIRTUAL,
  UNIQUE KEY `company_billing_settings_active_idx` (`active_unique_key`),
  CONSTRAINT `company_billing_settings_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── currency_rates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `currency_rates` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `base_currency` VARCHAR(255) NOT NULL DEFAULT 'AOA',
  `target_currency` VARCHAR(255) NOT NULL,
  `rate` DECIMAL(18,8) NOT NULL,
  `source` TEXT NOT NULL DEFAULT 'manual',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `currency_rates_base_currency_target_currency_key` (`base_currency`, `target_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── plans ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `plans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `name` TEXT NOT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'shared',
  `description` TEXT NULL,
  `features` LONGTEXT NOT NULL DEFAULT ('[]'),
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
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `plans_slug_key` (`slug`),
  CONSTRAINT `chk_plans_type` CHECK (`type` IN ('shared', 'vps', 'dedicated', 'reseller')),
  CONSTRAINT `chk_plans_features_json` CHECK (`features` IS NULL OR JSON_VALID(`features`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── servers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `servers` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` TEXT NOT NULL,
  `hostname` TEXT NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `location` TEXT NOT NULL DEFAULT 'AO',
  `whm_url` TEXT NULL,
  `whm_api_token` TEXT NULL,
  `whm_username` TEXT NULL DEFAULT 'root',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `max_accounts` INT NOT NULL DEFAULT 500,
  `current_load` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `notes` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── orders ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `orders` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `user_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `billing_cycle` TEXT NOT NULL DEFAULT 'monthly',
  `domain_name` TEXT NULL,
  `domain_action` TEXT NULL,
  `payment_method` TEXT NOT NULL DEFAULT 'bank_transfer',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(255) NOT NULL DEFAULT 'pending',
  `proof_file` TEXT NULL,
  `transfer_ref` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `use_default_ns` TINYINT(1) NOT NULL DEFAULT 1,
  `ns1` TEXT NULL,
  `ns2` TEXT NULL,
  `ns3` TEXT NULL,
  `ns4` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `orders_user_id_idx` (`user_id`),
  KEY `orders_status_idx` (`status`),
  KEY `idx_orders_user_created` (`user_id`, `created_at`),
  CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── services ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `services` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `plan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `currency` VARCHAR(32) NOT NULL DEFAULT 'USD',
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `billing_cycle` TEXT NOT NULL DEFAULT 'monthly',
  `started_at` DATETIME(6) NULL,
  `expires_at` DATETIME(6) NULL,
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `service_type` TEXT NULL,
  `service_name` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_services_profile` (`profile_id`),
  KEY `idx_services_status` (`status`),
  KEY `idx_services_expires` (`expires_at`),
  KEY `idx_services_profile_id` (`profile_id`),
  KEY `services_order_id_idx` (`order_id`),
  CONSTRAINT `chk_services_status` CHECK (`status` IN ('pending', 'active', 'suspended', 'cancelled', 'expired', 'pending_provisioning')),
  CONSTRAINT `chk_services_currency` CHECK (`currency` IN ('AKZ', 'BRL', 'USD')),
  CONSTRAINT `services_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `services_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `services_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `services_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── domains ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `domains` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `name` VARCHAR(255) NOT NULL,
  `extension` VARCHAR(255) NOT NULL,
  `full_domain` VARCHAR(512) GENERATED ALWAYS AS (CONCAT(name, extension)) STORED,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `registrar` TEXT NOT NULL DEFAULT 'viralizahost',
  `nameservers` LONGTEXT NOT NULL DEFAULT ('["ns1.viralizahost.com", "ns2.viralizahost.com"]'),
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
  `is_locked` TINYINT(1) NOT NULL DEFAULT 1,
  `whois_privacy` TINYINT(1) NOT NULL DEFAULT 0,
  `registered_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `expires_at` DATETIME(6) NULL,
  `price_paid` DECIMAL(12,2) NULL,
  `currency` VARCHAR(32) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `registered` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_domains_profile` (`profile_id`),
  KEY `idx_domains_status` (`status`),
  KEY `idx_domains_expires` (`expires_at`),
  UNIQUE KEY `domains_name_extension_key` (`name`, `extension`),
  UNIQUE KEY `domains_name_key` (`name`),
  KEY `idx_domains_profile_id` (`profile_id`),
  CONSTRAINT `chk_domains_status` CHECK (`status` IN ('active', 'expired', 'pending', 'transferred', 'locked')),
  CONSTRAINT `chk_domains_nameservers_json` CHECK (`nameservers` IS NULL OR JSON_VALID(`nameservers`)),
  CONSTRAINT `chk_domains_currency` CHECK (`currency` IN ('AKZ', 'BRL', 'USD')),
  CONSTRAINT `domains_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `domains_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `domains_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `subject` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'open',
  `priority` VARCHAR(32) NOT NULL DEFAULT 'medium',
  `department` TEXT NOT NULL DEFAULT 'technical',
  `assigned_to` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `closed_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `ticket_number` VARCHAR(255) NULL,
  `category` TEXT NULL,
  `domain_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tickets_profile` (`profile_id`),
  KEY `idx_tickets_status` (`status`),
  KEY `tickets_profile_id_idx` (`profile_id`),
  KEY `tickets_status_idx` (`status`),
  KEY `tickets_priority_idx` (`priority`),
  KEY `tickets_assigned_to_idx` (`assigned_to`),
  KEY `tickets_created_at_idx` (`created_at` DESC),
  UNIQUE KEY `tickets_ticket_number_key` (`ticket_number`),
  CONSTRAINT `chk_tickets_status` CHECK (`status` IN ('open', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT `chk_tickets_priority` CHECK (`priority` IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT `tickets_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `tickets_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `profiles` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `tickets_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `tickets_domain_id_fkey` FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── invoices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `invoice_number` VARCHAR(255) NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `currency` VARCHAR(32) NOT NULL DEFAULT 'USD',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `tax` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `items` LONGTEXT NOT NULL DEFAULT ('[]'),
  `due_date` DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6) + INTERVAL 7 DAY),
  `paid_at` DATETIME(6) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `issue_date` DATE NOT NULL DEFAULT (CURDATE()),
  `pdf_storage_path` TEXT NULL,
  `emailed_at` DATETIME(6) NULL,
  `created_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `email_to` TEXT NULL,
  `email_from` TEXT NULL,
  `email_provider` TEXT NULL DEFAULT 'resend',
  `email_provider_id` VARCHAR(255) NULL,
  `email_sent_at` DATETIME(6) NULL,
  `email_last_error` TEXT NULL,
  `email_attempts` INT NOT NULL DEFAULT 0,
  `email_delivered_at` DATETIME(6) NULL,
  `email_bounced_at` DATETIME(6) NULL,
  `email_status` VARCHAR(255) NOT NULL DEFAULT 'unsent',
  `proof_file` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_invoices_profile` (`profile_id`),
  KEY `idx_invoices_status` (`status`),
  KEY `invoices_profile_id_idx` (`profile_id`),
  KEY `invoices_status_idx` (`status`),
  KEY `invoices_due_date_idx` (`due_date`),
  KEY `invoices_order_id_idx` (`order_id`),
  UNIQUE KEY `invoices_invoice_number_key` (`invoice_number`),
  UNIQUE KEY `invoices_order_id_unique_idx` (`order_id`),
  KEY `invoices_ticket_id_idx` (`ticket_id`),
  KEY `idx_invoices_profile_status` (`profile_id`, `status`),
  KEY `invoices_email_provider_id_idx` (`email_provider_id`),
  KEY `invoices_email_status_idx` (`email_status`),
  KEY `idx_invoices_profile_created` (`profile_id`, `created_at`),
  CONSTRAINT `chk_invoices_status` CHECK (`status` IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded', 'under_review', 'partially_paid', 'rejected', 'draft', 'sending', 'sent', 'generated', 'failed')),
  CONSTRAINT `chk_invoices_currency` CHECK (`currency` IN ('AKZ', 'BRL', 'USD')),
  CONSTRAINT `chk_invoices_items_json` CHECK (`items` IS NULL OR JSON_VALID(`items`)),
  CONSTRAINT `invoices_email_status_check` CHECK (`email_status` IN ('unsent', 'queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'complained')),
  CONSTRAINT `invoices_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invoices_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `invoices_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoices_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invoices_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── email_logs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `recipient` TEXT NOT NULL,
  `sender` TEXT NOT NULL DEFAULT 'ViralizaHost Comercial <comercial@viralizahost.com>',
  `subject` TEXT NULL,
  `provider` TEXT NOT NULL DEFAULT 'resend',
  `provider_message_id` VARCHAR(255) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'queued',
  `error_message` TEXT NULL,
  `attempts` INT NOT NULL DEFAULT 1,
  `initiated_by_agent` TINYINT(1) NOT NULL DEFAULT 0,
  `initiated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `sent_at` DATETIME(6) NULL,
  `delivered_at` DATETIME(6) NULL,
  `failed_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `email_logs_profile_id_idx` (`profile_id`),
  KEY `email_logs_invoice_id_idx` (`invoice_id`),
  KEY `email_logs_provider_message_id_idx` (`provider_message_id`),
  KEY `email_logs_status_idx` (`status`),
  KEY `email_logs_created_at_idx` (`created_at` DESC),
  CONSTRAINT `chk_email_logs_status` CHECK (`status` IN ('queued', 'processing', 'sent', 'delivered', 'bounced', 'failed', 'complained', 'delayed')),
  CONSTRAINT `email_logs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `email_logs_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `email_logs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── hosting_accounts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `hosting_accounts` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `cpanel_username` VARCHAR(255) NOT NULL,
  `primary_domain` VARCHAR(255) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `disk_used_mb` INT NOT NULL DEFAULT 0,
  `bandwidth_used_mb` INT NOT NULL DEFAULT 0,
  `email_count` INT NOT NULL DEFAULT 0,
  `db_count` INT NOT NULL DEFAULT 0,
  `php_version` TEXT NOT NULL DEFAULT '8.2',
  `ssl_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `disk_limit_mb` INT NULL,
  `package_name` TEXT NULL,
  `ip_address` TEXT NULL,
  `suspension_reason` TEXT NULL,
  `last_synced_at` DATETIME(6) NULL,
  `cpanel_url` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hosting_profile` (`profile_id`),
  KEY `idx_hosting_domain` (`primary_domain`),
  UNIQUE KEY `hosting_accounts_cpanel_username_key` (`cpanel_username`),
  KEY `idx_hosting_accounts_profile_id` (`profile_id`),
  CONSTRAINT `chk_hosting_accounts_status` CHECK (`status` IN ('pending', 'active', 'suspended', 'cancelled', 'expired', 'pending_provisioning')),
  CONSTRAINT `hosting_accounts_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hosting_accounts_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `hosting_accounts_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── emails ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `emails` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `hosting_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email_address` VARCHAR(255) NOT NULL,
  `display_name` TEXT NULL,
  `quota_mb` INT NOT NULL DEFAULT 500,
  `used_mb` INT NOT NULL DEFAULT 0,
  `status` TEXT NOT NULL DEFAULT 'active',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_emails_hosting` (`hosting_id`),
  UNIQUE KEY `emails_email_address_key` (`email_address`),
  KEY `idx_emails_profile_id` (`profile_id`),
  CONSTRAINT `emails_hosting_id_fkey` FOREIGN KEY (`hosting_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `emails_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── products ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `products` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `category` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT NULL,
  `badge` TEXT NULL,
  `popular` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  `price_monthly` DECIMAL(12,2) NULL,
  `price_6months` DECIMAL(12,2) NULL,
  `price_1year` DECIMAL(12,2) NULL,
  `price_2years` DECIMAL(12,2) NULL,
  `price_3years` DECIMAL(12,2) NULL,
  `color` TEXT NULL,
  `href_override` TEXT NULL,
  `meta` LONGTEXT NULL DEFAULT ('{}'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `subcategory` TEXT NULL,
  `cta_label` TEXT NULL,
  `cta_url` TEXT NULL,
  `currency` TEXT NOT NULL DEFAULT 'AOA',
  `price_aoa` DECIMAL(12,2) NULL,
  `price_brl` DECIMAL(12,2) NULL,
  `price_usd` DECIMAL(12,2) NULL,
  `use_auto_conversion` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_key` (`slug`),
  CONSTRAINT `chk_products_meta_json` CHECK (`meta` IS NULL OR JSON_VALID(`meta`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── invoice_items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `product_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `description` TEXT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `invoice_items_invoice_id_idx` (`invoice_id`),
  CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invoice_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── invoice_send_logs ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_send_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `customer_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `recipient` TEXT NOT NULL,
  `provider` TEXT NOT NULL DEFAULT 'resend',
  `provider_message_id` VARCHAR(255) NULL,
  `status` TEXT NOT NULL DEFAULT 'attempted',
  `error_message` TEXT NULL,
  `initiated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `initiated_by_agent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `invoice_send_logs_invoice_id_idx` (`invoice_id`),
  KEY `invoice_send_logs_customer_id_idx` (`customer_id`),
  KEY `invoice_send_logs_provider_msg_idx` (`provider_message_id`),
  CONSTRAINT `invoice_send_logs_status_check` CHECK (`status` IN ('attempted', 'sent', 'delivered', 'bounced', 'failed', 'complained')),
  CONSTRAINT `invoice_send_logs_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invoice_send_logs_initiated_by_fkey` FOREIGN KEY (`initiated_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── notifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'info',
  `title` TEXT NOT NULL,
  `message` TEXT NOT NULL,
  `link` TEXT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_profile` (`profile_id`),
  KEY `idx_notifications_read` (`profile_id`, `is_read`),
  CONSTRAINT `chk_notifications_type` CHECK (`type` IN ('info', 'warning', 'error', 'success')),
  CONSTRAINT `notifications_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── order_items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `service_name` TEXT NOT NULL,
  `service_type` TEXT NOT NULL DEFAULT 'other',
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `order_items_order_idx` (`order_id`),
  CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── payments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `method` VARCHAR(32) NOT NULL DEFAULT 'credit_card',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(32) NOT NULL DEFAULT 'USD',
  `status` VARCHAR(255) NOT NULL DEFAULT 'pending',
  `gateway_ref` TEXT NULL,
  `gateway_data` LONGTEXT NULL DEFAULT ('{}'),
  `paid_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `proof_url` TEXT NULL,
  `proof_filename` TEXT NULL,
  `proof_mime` TEXT NULL,
  `transfer_ref` TEXT NULL,
  `transfer_date` DATE NULL,
  `payer_name` TEXT NULL,
  `payer_bank` TEXT NULL,
  `declared_amount` DECIMAL(12,2) NULL,
  `rejection_reason` TEXT NULL,
  `reviewed_at` DATETIME(6) NULL,
  `reviewed_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  PRIMARY KEY (`id`),
  KEY `idx_payments_invoice` (`invoice_id`),
  KEY `payments_invoice_id_idx` (`invoice_id`),
  KEY `payments_profile_id_idx` (`profile_id`),
  KEY `payments_order_id_idx` (`order_id`),
  KEY `payments_status_idx` (`status`),
  CONSTRAINT `chk_payments_method` CHECK (`method` IN ('credit_card', 'paypal', 'mercadopago', 'pix', 'bank_transfer', 'multicaixa')),
  CONSTRAINT `chk_payments_currency` CHECK (`currency` IN ('AKZ', 'BRL', 'USD')),
  CONSTRAINT `chk_payments_gateway_data_json` CHECK (`gateway_data` IS NULL OR JSON_VALID(`gateway_data`)),
  CONSTRAINT `payments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payments_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── product_features ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_features` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `product_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `feature` TEXT NOT NULL,
  `included` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_features_product_id_idx` (`product_id`),
  CONSTRAINT `product_features_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── site_banners ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_banners` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `bg_image` TEXT NULL,
  `bg_color` TEXT NULL DEFAULT '#000000',
  `accent_color` TEXT NULL DEFAULT '#F5B700',
  `tag` TEXT NULL,
  `title` TEXT NULL,
  `subtitle` TEXT NULL,
  `cta_text` TEXT NULL,
  `cta_href` TEXT NULL,
  `cta_secondary_text` TEXT NULL,
  `cta_secondary_href` TEXT NULL,
  `features` LONGTEXT NULL,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_banners_position_key` (`position`),
  CONSTRAINT `chk_site_banners_features_json` CHECK (`features` IS NULL OR JSON_VALID(`features`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── site_domains ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_domains` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `extension` VARCHAR(255) NOT NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `currency` TEXT NULL DEFAULT 'AOA',
  `popular` TINYINT(1) NULL DEFAULT 0,
  `active` TINYINT(1) NULL DEFAULT 1,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_domains_extension_key` (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── site_email_plans ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_email_plans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT NULL,
  `badge` TEXT NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `discount_annual` INT NULL DEFAULT 0,
  `features` LONGTEXT NULL,
  `active` TINYINT(1) NULL DEFAULT 1,
  `featured` TINYINT(1) NULL DEFAULT 0,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `currency` TEXT NULL DEFAULT 'AOA',
  `storage_gb` INT NULL DEFAULT 10,
  `accounts` INT NULL DEFAULT 5,
  `color` TEXT NULL DEFAULT '#3B82F6',
  `popular` TINYINT(1) NULL DEFAULT 0,
  `slug` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_email_plans_slug_key` (`slug`),
  CONSTRAINT `chk_site_email_plans_features_json` CHECK (`features` IS NULL OR JSON_VALID(`features`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── site_home_hero ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_home_hero` (
  `id` SMALLINT NOT NULL DEFAULT 1,
  `mode` TEXT NOT NULL DEFAULT 'carousel',
  `video_url` TEXT NULL,
  `video_storage_path` TEXT NULL,
  `video_file_name` TEXT NULL,
  `video_size_bytes` BIGINT NULL,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `site_home_hero_id_check` CHECK ((id = 1)),
  CONSTRAINT `site_home_hero_mode_check` CHECK (`mode` IN ('carousel', 'video')),
  CONSTRAINT `site_home_hero_video_required` CHECK (((mode = 'carousel') OR ((video_url IS NOT NULL) AND (CHAR_LENGTH(TRIM(video_url)) > 0))))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── site_hosting_plans ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_hosting_plans` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` TEXT NOT NULL,
  `description` TEXT NULL,
  `badge` TEXT NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `discount_annual` INT NULL DEFAULT 0,
  `features` LONGTEXT NULL,
  `active` TINYINT(1) NULL DEFAULT 1,
  `featured` TINYINT(1) NULL DEFAULT 0,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `currency` TEXT NULL DEFAULT 'AOA',
  `slug` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_hosting_plans_slug_key` (`slug`),
  CONSTRAINT `chk_site_hosting_plans_features_json` CHECK (`features` IS NULL OR JSON_VALID(`features`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── site_team ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `site_team` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `is_ceo` TINYINT(1) NULL DEFAULT 0,
  `name` VARCHAR(255) NOT NULL,
  `role` TEXT NULL,
  `title` TEXT NULL DEFAULT 'Especialista',
  `bio` TEXT NULL,
  `photo_url` TEXT NULL,
  `flag` TEXT NULL,
  `country` TEXT NULL,
  `accent_color` TEXT NULL DEFAULT '#F5B700',
  `position` INT NULL DEFAULT 0,
  `active` TINYINT(1) NULL DEFAULT 1,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `country_code` TEXT NULL,
  `specialty` TEXT NULL,
  `secondary_flag` TEXT NULL,
  `secondary_country_code` TEXT NULL,
  `secondary_country_name` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_team_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── sso_audit_logs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sso_audit_logs` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `hosting_account_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `access_type` TEXT NOT NULL,
  `ip_address` TEXT NULL,
  `user_agent` TEXT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `error_message` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_sso_audit_profile` (`profile_id`),
  KEY `idx_sso_audit_created` (`created_at`),
  KEY `idx_sso_audit_logs_profile_id` (`profile_id`),
  CONSTRAINT `sso_audit_logs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `sso_audit_logs_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `sso_audit_logs_hosting_account_id_fkey` FOREIGN KEY (`hosting_account_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ticket_messages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ticket_messages` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `message` TEXT NOT NULL,
  `is_staff` TINYINT(1) NOT NULL DEFAULT 0,
  `attachments` LONGTEXT NULL DEFAULT ('[]'),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_messages_ticket` (`ticket_id`),
  KEY `ticket_messages_ticket_idx` (`ticket_id`),
  CONSTRAINT `chk_ticket_messages_attachments_json` CHECK (`attachments` IS NULL OR JSON_VALID(`attachments`)),
  CONSTRAINT `ticket_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ticket_messages_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ticket_attachments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ticket_attachments` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `ticket_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `message_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `invoice_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `file_name` TEXT NOT NULL,
  `storage_path` TEXT NOT NULL,
  `mime_type` TEXT NOT NULL DEFAULT 'application/pdf',
  `file_size` INT NULL,
  `uploaded_by` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ticket_attachments_ticket_id_idx` (`ticket_id`),
  KEY `ticket_attachments_invoice_id_idx` (`invoice_id`),
  CONSTRAINT `ticket_attachments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ticket_attachments_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `ticket_messages` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ticket_attachments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ticket_attachments_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── whm_accounts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `whm_accounts` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `whm_username` VARCHAR(255) NOT NULL,
  `primary_domain` VARCHAR(255) NOT NULL,
  `contact_email` VARCHAR(255) NULL,
  `package_name` TEXT NULL,
  `ip_address` TEXT NULL,
  `owner` TEXT NULL,
  `partition` TEXT NULL,
  `disk_used_mb` INT NOT NULL DEFAULT 0,
  `disk_limit_mb` INT NULL,
  `unix_startdate` BIGINT NULL,
  `account_created_at` DATETIME(6) NULL,
  `is_suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `suspension_reason` TEXT NULL,
  `theme` TEXT NULL,
  `php_version` TEXT NULL,
  `max_pop` TEXT NULL,
  `max_sub` TEXT NULL,
  `max_sql` TEXT NULL,
  `max_ftp` TEXT NULL,
  `profile_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `service_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `hosting_account_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `raw_metadata` LONGTEXT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'active',
  `last_synced_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `sync_status` VARCHAR(255) NOT NULL DEFAULT 'linked',
  `requires_manual_link` TINYINT(1) NOT NULL DEFAULT 0,
  `link_status` TEXT NOT NULL DEFAULT 'linked',
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `whm_accounts_server_id_primary_domain_key` (`server_id`, `primary_domain`),
  UNIQUE KEY `whm_accounts_server_id_whm_username_key` (`server_id`, `whm_username`),
  KEY `idx_whm_accounts_server` (`server_id`),
  KEY `idx_whm_accounts_profile` (`profile_id`),
  KEY `idx_whm_accounts_email` (`contact_email`),
  KEY `idx_whm_accounts_status` (`status`),
  KEY `idx_whm_accounts_sync_status` (`sync_status`),
  KEY `idx_whm_accounts_profile_id` (`profile_id`),
  KEY `idx_whm_accounts_hosting_acct_id` (`hosting_account_id`),
  CONSTRAINT `chk_whm_accounts_raw_metadata_json` CHECK (`raw_metadata` IS NULL OR JSON_VALID(`raw_metadata`)),
  CONSTRAINT `whm_accounts_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `whm_accounts_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `whm_accounts_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `whm_accounts_hosting_account_id_fkey` FOREIGN KEY (`hosting_account_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── whm_package_mappings ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `whm_package_mappings` (
  `id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `server_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `whm_package_name` VARCHAR(255) NOT NULL,
  `plan_id` CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  `label` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `whm_package_mappings_server_id_whm_package_name_key` (`server_id`, `whm_package_name`),
  KEY `idx_whm_mappings_server` (`server_id`),
  CONSTRAINT `whm_package_mappings_server_id_fkey` FOREIGN KEY (`server_id`) REFERENCES `servers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `whm_package_mappings_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
