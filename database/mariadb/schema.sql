-- ============================================================================
-- ViralizaHost — schema MariaDB 10.11 (gerado por scripts/mariadb/generate-schema.mjs)
-- Origem: PostgreSQL schema `viralizahost` (37 tabelas)
-- Importável pelo phpMyAdmin: seleccione a base `viralizahost_viralizaHost` e
-- importe este ficheiro. Não cria a base nem utilizadores.
-- Idempotente: usa CREATE TABLE IF NOT EXISTS (não apaga dados existentes).
-- ============================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;

-- ----------------------------------------------------------------------------
-- Tabelas de plataforma: substituem o Supabase Auth e o Supabase Storage.
-- ----------------------------------------------------------------------------

-- auth_users ← auth.users (IDs preservados; hashes bcrypt compatíveis)
CREATE TABLE IF NOT EXISTS `auth_users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `encrypted_password` VARCHAR(255) NULL,
  `email_confirmed_at` DATETIME(6) NULL,
  `raw_user_meta_data` JSON NOT NULL DEFAULT ('{}') CHECK (json_valid(`raw_user_meta_data`)),
  `raw_app_meta_data` JSON NOT NULL DEFAULT ('{}') CHECK (json_valid(`raw_app_meta_data`)),
  `password_reset_required` TINYINT(1) NOT NULL DEFAULT 0,
  `banned_until` DATETIME(6) NULL,
  `last_sign_in_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessões de login (o cookie guarda um token aleatório; aqui só o SHA-256)
CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `user_agent` VARCHAR(255) NULL,
  `ip` VARCHAR(45) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `last_seen_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `expires_at` DATETIME(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_sessions_token_hash_key` (`token_hash`),
  KEY `auth_sessions_user_id_idx` (`user_id`),
  CONSTRAINT `auth_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens de uso único (recuperação de palavra-passe, confirmação de e-mail)
CREATE TABLE IF NOT EXISTS `auth_tokens` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `type` ENUM('recovery','signup','invite') NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `redirect_to` VARCHAR(512) NULL,
  `expires_at` DATETIME(6) NOT NULL,
  `used_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_tokens_token_hash_key` (`token_hash`),
  KEY `auth_tokens_user_id_idx` (`user_id`),
  CONSTRAINT `auth_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- storage_buckets ← storage.buckets
CREATE TABLE IF NOT EXISTS `storage_buckets` (
  `id` VARCHAR(100) NOT NULL,
  `public` TINYINT(1) NOT NULL DEFAULT 0,
  `file_size_limit` BIGINT NULL,
  `allowed_mime_types` JSON NULL CHECK (json_valid(`allowed_mime_types`)),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- storage_objects ← storage.objects (o conteúdo fica em STORAGE_DIR/<bucket>/<name>)
CREATE TABLE IF NOT EXISTS `storage_objects` (
  `id` CHAR(36) NOT NULL,
  `bucket_id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(512) NOT NULL,
  `owner` CHAR(36) NULL,
  `mime_type` VARCHAR(255) NULL,
  `size` BIGINT NOT NULL DEFAULT 0,
  `sha256` CHAR(64) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `storage_objects_bucket_name_key` (`bucket_id`, `name`),
  CONSTRAINT `storage_objects_bucket_id_fkey` FOREIGN KEY (`bucket_id`) REFERENCES `storage_buckets` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `storage_buckets` (`id`, `public`) VALUES
  ('site-banners', 1), ('site-videos', 1), ('payment-proofs', 0);

-- Registo das execuções do script de migração (sem dados sensíveis)
CREATE TABLE IF NOT EXISTS `vh_migration_runs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `started_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `finished_at` DATETIME(6) NULL,
  `mode` VARCHAR(32) NOT NULL,
  `summary` JSON NULL CHECK (json_valid(`summary`)),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- activity_logs
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NULL,
  `action` ENUM('login','logout','create','update','delete','payment','suspend','activate') NOT NULL,
  `entity_type` MEDIUMTEXT NULL,
  `entity_id` CHAR(36) NULL,
  `description` MEDIUMTEXT NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` MEDIUMTEXT NULL,
  `metadata` JSON NULL DEFAULT ('{}') CHECK (json_valid(`metadata`)),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_activity_created` (`created_at` DESC),
  KEY `idx_activity_profile` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ai_audit_logs
CREATE TABLE IF NOT EXISTS `ai_audit_logs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `conversation_id` CHAR(36) NULL,
  `profile_id` CHAR(36) NULL,
  `tool_name` MEDIUMTEXT NOT NULL,
  `tool_input` JSON NULL CHECK (json_valid(`tool_input`)),
  `result_summary` MEDIUMTEXT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `error_message` MEDIUMTEXT NULL,
  `ip_address` MEDIUMTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ai_audit_logs_created_at_idx` (`created_at`),
  KEY `ai_audit_logs_profile_id_idx` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ai_conversations
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NULL,
  `session_token` VARCHAR(255) NULL,
  `title` MEDIUMTEXT NULL,
  `status` MEDIUMTEXT NOT NULL DEFAULT 'active',
  `user_level` MEDIUMTEXT NOT NULL DEFAULT 'visitor',
  `metadata` JSON NULL DEFAULT ('{}') CHECK (json_valid(`metadata`)),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `ai_conversations_status_check` CHECK (`status` IN ('active', 'resolved', 'abandoned')),
  CONSTRAINT `ai_conversations_user_level_check` CHECK (`user_level` IN ('visitor', 'client', 'admin')),
  KEY `ai_conversations_profile_id_idx` (`profile_id`),
  KEY `ai_conversations_session_token_idx` (`session_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ai_messages
CREATE TABLE IF NOT EXISTS `ai_messages` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `conversation_id` CHAR(36) NOT NULL,
  `role` MEDIUMTEXT NOT NULL,
  `content` MEDIUMTEXT NOT NULL,
  `tool_name` MEDIUMTEXT NULL,
  `tool_input` JSON NULL CHECK (json_valid(`tool_input`)),
  `tool_output` JSON NULL CHECK (json_valid(`tool_output`)),
  `tokens_used` INT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `ai_messages_role_check` CHECK (`role` IN ('user', 'assistant', 'tool')),
  KEY `ai_messages_conversation_id_idx` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- banner_pages
CREATE TABLE IF NOT EXISTS `banner_pages` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `page_slug` VARCHAR(255) NOT NULL,
  `page_name` MEDIUMTEXT NOT NULL,
  `breadcrumb` MEDIUMTEXT NULL,
  `breadcrumb_parent` MEDIUMTEXT NULL,
  `breadcrumb_parent_href` MEDIUMTEXT NULL,
  `tag` MEDIUMTEXT NULL,
  `title` MEDIUMTEXT NOT NULL DEFAULT '',
  `subtitle` MEDIUMTEXT NOT NULL DEFAULT '',
  `bg_image` MEDIUMTEXT NULL,
  `bg_color` MEDIUMTEXT NOT NULL DEFAULT '#080d1a',
  `highlights` JSON NOT NULL DEFAULT ('[]') CHECK (json_valid(`highlights`)),
  `button_primary_text` MEDIUMTEXT NOT NULL DEFAULT 'Ver Planos',
  `button_primary_link` MEDIUMTEXT NOT NULL DEFAULT '#planos',
  `button_secondary_text` MEDIUMTEXT NULL,
  `button_secondary_link` MEDIUMTEXT NULL,
  `price_text` MEDIUMTEXT NULL,
  `show_guarantee` TINYINT(1) NOT NULL DEFAULT 1,
  `overlay_opacity` DECIMAL(3,2) NOT NULL DEFAULT 0.0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `banner_pages_overlay_opacity_check` CHECK ((overlay_opacity >= 0) AND (overlay_opacity <= 1)),
  UNIQUE KEY `banner_pages_page_slug_key` (`page_slug`),
  KEY `idx_banner_pages_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- clients
CREATE TABLE IF NOT EXISTS `clients` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NOT NULL,
  `company_name` MEDIUMTEXT NULL,
  `tax_id` MEDIUMTEXT NULL,
  `address` MEDIUMTEXT NULL,
  `city` MEDIUMTEXT NULL,
  `state` MEDIUMTEXT NULL,
  `postal_code` MEDIUMTEXT NULL,
  `notes` MEDIUMTEXT NULL,
  `credit_balance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'USD',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `clients_profile_id_key` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- company_billing_settings
CREATE TABLE IF NOT EXISTS `company_billing_settings` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `company_name` MEDIUMTEXT NOT NULL DEFAULT 'ViralizaHost',
  `logo_url` MEDIUMTEXT NULL,
  `email` MEDIUMTEXT NOT NULL DEFAULT 'comercial@viralizahost.com',
  `website` MEDIUMTEXT NOT NULL DEFAULT 'viralizahost.com',
  `phone` MEDIUMTEXT NULL,
  `address` MEDIUMTEXT NULL,
  `bank_name` MEDIUMTEXT NULL,
  `account_holder` MEDIUMTEXT NULL,
  `account_number` MEDIUMTEXT NULL,
  `iban` MEDIUMTEXT NULL,
  `swift` MEDIUMTEXT NULL,
  `payment_instructions` MEDIUMTEXT NULL,
  `footer_text` MEDIUMTEXT NULL DEFAULT 'ViralizaHost — Hospedagem Web, Domínios e E-mails Corporativos
E-mail: comercial@viralizahost.com | viralizahost.com | Suporte 24/7',
  `default_due_days` INT NOT NULL DEFAULT 7,
  `email_subject_template` MEDIUMTEXT NULL DEFAULT 'Fatura ViralizaHost nº {invoice_number} — {service_name}',
  `email_body_template` MEDIUMTEXT NULL,
  `auto_email_on_create` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `updated_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  `active_unique_key` TINYINT(1) AS (IF(`active`, 1, NULL)) VIRTUAL,
  UNIQUE KEY `company_billing_settings_active_idx` (`active_unique_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- currency_rates
CREATE TABLE IF NOT EXISTS `currency_rates` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `base_currency` VARCHAR(255) NOT NULL DEFAULT 'AOA',
  `target_currency` VARCHAR(255) NOT NULL,
  `rate` DECIMAL(18,8) NOT NULL,
  `source` MEDIUMTEXT NOT NULL DEFAULT 'manual',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `currency_rates_base_currency_target_currency_key` (`base_currency`, `target_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- domains
CREATE TABLE IF NOT EXISTS `domains` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NOT NULL,
  `service_id` CHAR(36) NULL,
  `name` VARCHAR(255) NOT NULL,
  `extension` VARCHAR(255) NOT NULL,
  `full_domain` VARCHAR(255) AS (CONCAT(name , extension)) STORED,
  `status` ENUM('active','expired','pending','transferred','locked') NOT NULL DEFAULT 'pending',
  `registrar` MEDIUMTEXT NOT NULL DEFAULT 'viralizahost',
  `nameservers` JSON NOT NULL DEFAULT ('["ns1.viralizahost.com", "ns2.viralizahost.com"]') CHECK (json_valid(`nameservers`)),
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
  `is_locked` TINYINT(1) NOT NULL DEFAULT 1,
  `whois_privacy` TINYINT(1) NOT NULL DEFAULT 0,
  `registered_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `expires_at` DATETIME(6) NULL,
  `price_paid` DECIMAL(12,2) NULL,
  `currency` ENUM('AKZ','BRL','USD') NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) NULL,
  `registered` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `domains_name_extension_key` (`name`, `extension`),
  UNIQUE KEY `domains_name_key` (`name`),
  KEY `idx_domains_expires` (`expires_at`),
  KEY `idx_domains_profile` (`profile_id`),
  KEY `idx_domains_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- email_logs
CREATE TABLE IF NOT EXISTS `email_logs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `order_id` CHAR(36) NULL,
  `recipient` MEDIUMTEXT NOT NULL,
  `sender` MEDIUMTEXT NOT NULL DEFAULT 'ViralizaHost Comercial <comercial@viralizahost.com>',
  `subject` MEDIUMTEXT NULL,
  `provider` MEDIUMTEXT NOT NULL DEFAULT 'resend',
  `provider_message_id` VARCHAR(255) NULL,
  `status` ENUM('queued','processing','sent','delivered','bounced','failed','complained','delayed') NOT NULL DEFAULT 'queued',
  `error_message` MEDIUMTEXT NULL,
  `attempts` INT NOT NULL DEFAULT 1,
  `initiated_by_agent` TINYINT(1) NOT NULL DEFAULT 0,
  `initiated_by` CHAR(36) NULL,
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
  KEY `email_logs_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- emails
CREATE TABLE IF NOT EXISTS `emails` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `hosting_id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `email_address` VARCHAR(255) NOT NULL,
  `display_name` MEDIUMTEXT NULL,
  `quota_mb` INT NOT NULL DEFAULT 500,
  `used_mb` INT NOT NULL DEFAULT 0,
  `status` MEDIUMTEXT NOT NULL DEFAULT 'active',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `emails_email_address_key` (`email_address`),
  KEY `idx_emails_hosting` (`hosting_id`),
  KEY `idx_emails_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- hosting_accounts
CREATE TABLE IF NOT EXISTS `hosting_accounts` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `service_id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `server_id` CHAR(36) NULL,
  `cpanel_username` VARCHAR(255) NOT NULL,
  `primary_domain` VARCHAR(255) NOT NULL,
  `status` ENUM('pending','active','suspended','cancelled','expired','pending_provisioning') NOT NULL DEFAULT 'pending',
  `disk_used_mb` INT NOT NULL DEFAULT 0,
  `bandwidth_used_mb` INT NOT NULL DEFAULT 0,
  `email_count` INT NOT NULL DEFAULT 0,
  `db_count` INT NOT NULL DEFAULT 0,
  `php_version` MEDIUMTEXT NOT NULL DEFAULT '8.2',
  `ssl_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `disk_limit_mb` INT NULL,
  `package_name` MEDIUMTEXT NULL,
  `ip_address` MEDIUMTEXT NULL,
  `suspension_reason` MEDIUMTEXT NULL,
  `last_synced_at` DATETIME(6) NULL,
  `cpanel_url` MEDIUMTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hosting_accounts_cpanel_username_key` (`cpanel_username`),
  KEY `idx_hosting_accounts_profile_id` (`profile_id`),
  KEY `idx_hosting_domain` (`primary_domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- invoice_items
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `invoice_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NULL,
  `description` MEDIUMTEXT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `position` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `invoice_items_invoice_id_idx` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- invoice_send_logs
CREATE TABLE IF NOT EXISTS `invoice_send_logs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `invoice_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NULL,
  `ticket_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NOT NULL,
  `recipient` MEDIUMTEXT NOT NULL,
  `provider` MEDIUMTEXT NOT NULL DEFAULT 'resend',
  `provider_message_id` VARCHAR(255) NULL,
  `status` MEDIUMTEXT NOT NULL DEFAULT 'attempted',
  `error_message` MEDIUMTEXT NULL,
  `initiated_by` CHAR(36) NULL,
  `initiated_by_agent` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `invoice_send_logs_status_check` CHECK (`status` IN ('attempted', 'sent', 'delivered', 'bounced', 'failed', 'complained')),
  KEY `invoice_send_logs_customer_id_idx` (`customer_id`),
  KEY `invoice_send_logs_invoice_id_idx` (`invoice_id`),
  KEY `invoice_send_logs_provider_msg_idx` (`provider_message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `invoice_number` VARCHAR(255) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `service_id` CHAR(36) NULL,
  `status` ENUM('pending','paid','overdue','cancelled','refunded','under_review','partially_paid','rejected','draft','sending','sent','generated','failed') NOT NULL DEFAULT 'pending',
  `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'USD',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `discount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `tax` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `items` JSON NOT NULL DEFAULT ('[]') CHECK (json_valid(`items`)),
  `due_date` DATETIME(6) NOT NULL DEFAULT (CURRENT_TIMESTAMP(6) + INTERVAL 7 DAY),
  `paid_at` DATETIME(6) NULL,
  `notes` MEDIUMTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) NULL,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `ticket_id` CHAR(36) NULL,
  `issue_date` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `pdf_storage_path` MEDIUMTEXT NULL,
  `emailed_at` DATETIME(6) NULL,
  `created_by` CHAR(36) NULL,
  `email_to` MEDIUMTEXT NULL,
  `email_from` MEDIUMTEXT NULL,
  `email_provider` MEDIUMTEXT NULL DEFAULT 'resend',
  `email_provider_id` VARCHAR(255) NULL,
  `email_sent_at` DATETIME(6) NULL,
  `email_last_error` MEDIUMTEXT NULL,
  `email_attempts` INT NOT NULL DEFAULT 0,
  `email_delivered_at` DATETIME(6) NULL,
  `email_bounced_at` DATETIME(6) NULL,
  `email_status` VARCHAR(255) NOT NULL DEFAULT 'unsent',
  `proof_file` MEDIUMTEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `invoices_email_status_check` CHECK (`email_status` IN ('unsent', 'queued', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'complained')),
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
  KEY `invoices_ticket_id_idx` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- notifications
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NOT NULL,
  `type` ENUM('info','warning','error','success') NOT NULL DEFAULT 'info',
  `title` MEDIUMTEXT NOT NULL,
  `message` MEDIUMTEXT NOT NULL,
  `link` MEDIUMTEXT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_notifications_profile` (`profile_id`),
  KEY `idx_notifications_read` (`profile_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- order_items
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `order_id` CHAR(36) NOT NULL,
  `service_name` MEDIUMTEXT NOT NULL,
  `service_type` MEDIUMTEXT NOT NULL DEFAULT 'other',
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `order_items_order_idx` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- orders
CREATE TABLE IF NOT EXISTS `orders` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` CHAR(36) NULL,
  `billing_cycle` MEDIUMTEXT NOT NULL DEFAULT 'monthly',
  `domain_name` MEDIUMTEXT NULL,
  `domain_action` MEDIUMTEXT NULL,
  `payment_method` MEDIUMTEXT NOT NULL DEFAULT 'bank_transfer',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(255) NOT NULL DEFAULT 'pending',
  `proof_file` MEDIUMTEXT NULL,
  `transfer_ref` MEDIUMTEXT NULL,
  `notes` MEDIUMTEXT NULL,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `use_default_ns` TINYINT(1) NOT NULL DEFAULT 1,
  `ns1` MEDIUMTEXT NULL,
  `ns2` MEDIUMTEXT NULL,
  `ns3` MEDIUMTEXT NULL,
  `ns4` MEDIUMTEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user_created` (`user_id`, `created_at` DESC),
  KEY `orders_status_idx` (`status`),
  KEY `orders_user_id_idx` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- payments
CREATE TABLE IF NOT EXISTS `payments` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `invoice_id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `method` ENUM('credit_card','paypal','mercadopago','pix','bank_transfer','multicaixa') NOT NULL DEFAULT 'credit_card',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'USD',
  `status` VARCHAR(255) NOT NULL DEFAULT 'pending',
  `gateway_ref` MEDIUMTEXT NULL,
  `gateway_data` JSON NULL DEFAULT ('{}') CHECK (json_valid(`gateway_data`)),
  `paid_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) NULL,
  `proof_url` MEDIUMTEXT NULL,
  `proof_filename` MEDIUMTEXT NULL,
  `proof_mime` MEDIUMTEXT NULL,
  `transfer_ref` MEDIUMTEXT NULL,
  `transfer_date` DATE NULL,
  `payer_name` MEDIUMTEXT NULL,
  `payer_bank` MEDIUMTEXT NULL,
  `declared_amount` DECIMAL(12,2) NULL,
  `rejection_reason` MEDIUMTEXT NULL,
  `reviewed_at` DATETIME(6) NULL,
  `reviewed_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_payments_invoice` (`invoice_id`),
  KEY `payments_order_id_idx` (`order_id`),
  KEY `payments_profile_id_idx` (`profile_id`),
  KEY `payments_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- plans
CREATE TABLE IF NOT EXISTS `plans` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `slug` VARCHAR(255) NOT NULL,
  `name` MEDIUMTEXT NOT NULL,
  `type` ENUM('shared','vps','dedicated','reseller') NOT NULL DEFAULT 'shared',
  `description` MEDIUMTEXT NULL,
  `features` JSON NOT NULL DEFAULT ('[]') CHECK (json_valid(`features`)),
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

-- product_features
CREATE TABLE IF NOT EXISTS `product_features` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `product_id` CHAR(36) NOT NULL,
  `feature` MEDIUMTEXT NOT NULL,
  `included` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `product_features_product_id_idx` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- products
CREATE TABLE IF NOT EXISTS `products` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `slug` VARCHAR(255) NOT NULL,
  `category` MEDIUMTEXT NOT NULL,
  `name` MEDIUMTEXT NOT NULL,
  `description` MEDIUMTEXT NULL,
  `badge` MEDIUMTEXT NULL,
  `popular` TINYINT(1) NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `position` INT NOT NULL DEFAULT 0,
  `price_monthly` DECIMAL(12,2) NULL,
  `price_6months` DECIMAL(12,2) NULL,
  `price_1year` DECIMAL(12,2) NULL,
  `price_2years` DECIMAL(12,2) NULL,
  `price_3years` DECIMAL(12,2) NULL,
  `color` MEDIUMTEXT NULL,
  `href_override` MEDIUMTEXT NULL,
  `meta` JSON NULL DEFAULT ('{}') CHECK (json_valid(`meta`)),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `subcategory` MEDIUMTEXT NULL,
  `cta_label` MEDIUMTEXT NULL,
  `cta_url` MEDIUMTEXT NULL,
  `currency` MEDIUMTEXT NOT NULL DEFAULT 'AOA',
  `price_aoa` DECIMAL(12,2) NULL,
  `price_brl` DECIMAL(12,2) NULL,
  `price_usd` DECIMAL(12,2) NULL,
  `use_auto_conversion` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- profiles
CREATE TABLE IF NOT EXISTS `profiles` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `full_name` MEDIUMTEXT NOT NULL DEFAULT '',
  `phone` MEDIUMTEXT NULL,
  `country` MEDIUMTEXT NOT NULL DEFAULT 'AO',
  `role` ENUM('client','admin','reseller') NOT NULL DEFAULT 'client',
  `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'USD',
  `avatar_url` MEDIUMTEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `profiles_email_key` (`email`),
  KEY `idx_profiles_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- servers
CREATE TABLE IF NOT EXISTS `servers` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` MEDIUMTEXT NOT NULL,
  `hostname` MEDIUMTEXT NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `location` MEDIUMTEXT NOT NULL DEFAULT 'AO',
  `whm_url` MEDIUMTEXT NULL,
  `whm_api_token` MEDIUMTEXT NULL,
  `whm_username` MEDIUMTEXT NULL DEFAULT 'root',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `max_accounts` INT NOT NULL DEFAULT 500,
  `current_load` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `notes` MEDIUMTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- services
CREATE TABLE IF NOT EXISTS `services` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NOT NULL,
  `plan_id` CHAR(36) NULL,
  `server_id` CHAR(36) NULL,
  `status` ENUM('pending','active','suspended','cancelled','expired','pending_provisioning') NOT NULL DEFAULT 'pending',
  `currency` ENUM('AKZ','BRL','USD') NOT NULL DEFAULT 'USD',
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `billing_cycle` MEDIUMTEXT NOT NULL DEFAULT 'monthly',
  `started_at` DATETIME(6) NULL,
  `expires_at` DATETIME(6) NULL,
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` MEDIUMTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `order_id` CHAR(36) NULL,
  `service_type` MEDIUMTEXT NULL,
  `service_name` MEDIUMTEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_services_expires` (`expires_at`),
  KEY `idx_services_profile` (`profile_id`),
  KEY `idx_services_status` (`status`),
  KEY `services_order_id_idx` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- site_banners
CREATE TABLE IF NOT EXISTS `site_banners` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `position` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `bg_image` MEDIUMTEXT NULL,
  `bg_color` MEDIUMTEXT NULL DEFAULT '#000000',
  `accent_color` MEDIUMTEXT NULL DEFAULT '#F5B700',
  `tag` MEDIUMTEXT NULL,
  `title` MEDIUMTEXT NULL,
  `subtitle` MEDIUMTEXT NULL,
  `cta_text` MEDIUMTEXT NULL,
  `cta_href` MEDIUMTEXT NULL,
  `cta_secondary_text` MEDIUMTEXT NULL,
  `cta_secondary_href` MEDIUMTEXT NULL,
  `features` JSON NULL CHECK (json_valid(`features`)),
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_banners_position_key` (`position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- site_domains
CREATE TABLE IF NOT EXISTS `site_domains` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `extension` VARCHAR(255) NOT NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `currency` MEDIUMTEXT NULL DEFAULT 'AOA',
  `popular` TINYINT(1) NULL DEFAULT 0,
  `active` TINYINT(1) NULL DEFAULT 1,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_domains_extension_key` (`extension`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- site_email_plans
CREATE TABLE IF NOT EXISTS `site_email_plans` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` MEDIUMTEXT NOT NULL,
  `description` MEDIUMTEXT NULL,
  `badge` MEDIUMTEXT NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `discount_annual` INT NULL DEFAULT 0,
  `features` JSON NULL CHECK (json_valid(`features`)),
  `active` TINYINT(1) NULL DEFAULT 1,
  `featured` TINYINT(1) NULL DEFAULT 0,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `currency` MEDIUMTEXT NULL DEFAULT 'AOA',
  `storage_gb` INT NULL DEFAULT 10,
  `accounts` INT NULL DEFAULT 5,
  `color` MEDIUMTEXT NULL DEFAULT '#3B82F6',
  `popular` TINYINT(1) NULL DEFAULT 0,
  `slug` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_email_plans_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- site_home_hero
CREATE TABLE IF NOT EXISTS `site_home_hero` (
  `id` SMALLINT NOT NULL DEFAULT 1,
  `mode` MEDIUMTEXT NOT NULL DEFAULT 'carousel',
  `video_url` MEDIUMTEXT NULL,
  `video_storage_path` MEDIUMTEXT NULL,
  `video_file_name` MEDIUMTEXT NULL,
  `video_size_bytes` BIGINT NULL,
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `updated_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `site_home_hero_id_check` CHECK (id = 1),
  CONSTRAINT `site_home_hero_mode_check` CHECK (`mode` IN ('carousel', 'video')),
  CONSTRAINT `site_home_hero_video_required` CHECK ((mode = 'carousel') OR ((video_url IS NOT NULL) AND (CHAR_LENGTH(TRIM(video_url)) > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- site_hosting_plans
CREATE TABLE IF NOT EXISTS `site_hosting_plans` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `name` MEDIUMTEXT NOT NULL,
  `description` MEDIUMTEXT NULL,
  `badge` MEDIUMTEXT NULL,
  `price_monthly` DECIMAL(10,2) NULL,
  `price_annual` DECIMAL(10,2) NULL,
  `discount_annual` INT NULL DEFAULT 0,
  `features` JSON NULL CHECK (json_valid(`features`)),
  `active` TINYINT(1) NULL DEFAULT 1,
  `featured` TINYINT(1) NULL DEFAULT 0,
  `position` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `currency` MEDIUMTEXT NULL DEFAULT 'AOA',
  `slug` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_hosting_plans_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- site_team
CREATE TABLE IF NOT EXISTS `site_team` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `is_ceo` TINYINT(1) NULL DEFAULT 0,
  `name` VARCHAR(255) NOT NULL,
  `role` MEDIUMTEXT NULL,
  `title` MEDIUMTEXT NULL DEFAULT 'Especialista',
  `bio` MEDIUMTEXT NULL,
  `photo_url` MEDIUMTEXT NULL,
  `flag` MEDIUMTEXT NULL,
  `country` MEDIUMTEXT NULL,
  `accent_color` MEDIUMTEXT NULL DEFAULT '#F5B700',
  `position` INT NULL DEFAULT 0,
  `active` TINYINT(1) NULL DEFAULT 1,
  `created_at` DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  `country_code` MEDIUMTEXT NULL,
  `specialty` MEDIUMTEXT NULL,
  `secondary_flag` MEDIUMTEXT NULL,
  `secondary_country_code` MEDIUMTEXT NULL,
  `secondary_country_name` MEDIUMTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `site_team_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sso_audit_logs
CREATE TABLE IF NOT EXISTS `sso_audit_logs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NOT NULL,
  `service_id` CHAR(36) NULL,
  `hosting_account_id` CHAR(36) NULL,
  `access_type` MEDIUMTEXT NOT NULL,
  `ip_address` MEDIUMTEXT NULL,
  `user_agent` MEDIUMTEXT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 0,
  `error_message` MEDIUMTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_sso_audit_created` (`created_at`),
  KEY `idx_sso_audit_logs_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ticket_attachments
CREATE TABLE IF NOT EXISTS `ticket_attachments` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `ticket_id` CHAR(36) NOT NULL,
  `message_id` CHAR(36) NULL,
  `invoice_id` CHAR(36) NULL,
  `file_name` MEDIUMTEXT NOT NULL,
  `storage_path` MEDIUMTEXT NOT NULL,
  `mime_type` MEDIUMTEXT NOT NULL DEFAULT 'application/pdf',
  `file_size` INT NULL,
  `uploaded_by` CHAR(36) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `ticket_attachments_invoice_id_idx` (`invoice_id`),
  KEY `ticket_attachments_ticket_id_idx` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ticket_messages
CREATE TABLE IF NOT EXISTS `ticket_messages` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `ticket_id` CHAR(36) NOT NULL,
  `profile_id` CHAR(36) NOT NULL,
  `message` MEDIUMTEXT NOT NULL,
  `is_staff` TINYINT(1) NOT NULL DEFAULT 0,
  `attachments` JSON NULL DEFAULT ('[]') CHECK (json_valid(`attachments`)),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `is_internal` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ticket_messages_ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- tickets
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `profile_id` CHAR(36) NOT NULL,
  `subject` MEDIUMTEXT NOT NULL,
  `status` ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `priority` ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `department` MEDIUMTEXT NOT NULL DEFAULT 'technical',
  `assigned_to` CHAR(36) NULL,
  `service_id` CHAR(36) NULL,
  `closed_at` DATETIME(6) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `ticket_number` VARCHAR(255) NULL,
  `category` MEDIUMTEXT NULL,
  `domain_id` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tickets_ticket_number_key` (`ticket_number`),
  KEY `idx_tickets_profile` (`profile_id`),
  KEY `idx_tickets_status` (`status`),
  KEY `tickets_assigned_to_idx` (`assigned_to`),
  KEY `tickets_created_at_idx` (`created_at` DESC),
  KEY `tickets_priority_idx` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- whm_accounts
CREATE TABLE IF NOT EXISTS `whm_accounts` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `server_id` CHAR(36) NOT NULL,
  `whm_username` VARCHAR(255) NOT NULL,
  `primary_domain` VARCHAR(255) NOT NULL,
  `contact_email` VARCHAR(255) NULL,
  `package_name` MEDIUMTEXT NULL,
  `ip_address` MEDIUMTEXT NULL,
  `owner` MEDIUMTEXT NULL,
  `partition` MEDIUMTEXT NULL,
  `disk_used_mb` INT NOT NULL DEFAULT 0,
  `disk_limit_mb` INT NULL,
  `unix_startdate` BIGINT NULL,
  `account_created_at` DATETIME(6) NULL,
  `is_suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `suspension_reason` MEDIUMTEXT NULL,
  `theme` MEDIUMTEXT NULL,
  `php_version` MEDIUMTEXT NULL,
  `max_pop` MEDIUMTEXT NULL,
  `max_sub` MEDIUMTEXT NULL,
  `max_sql` MEDIUMTEXT NULL,
  `max_ftp` MEDIUMTEXT NULL,
  `profile_id` CHAR(36) NULL,
  `service_id` CHAR(36) NULL,
  `hosting_account_id` CHAR(36) NULL,
  `raw_metadata` JSON NULL CHECK (json_valid(`raw_metadata`)),
  `status` VARCHAR(255) NOT NULL DEFAULT 'active',
  `last_synced_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `sync_status` VARCHAR(255) NOT NULL DEFAULT 'linked',
  `requires_manual_link` TINYINT(1) NOT NULL DEFAULT 0,
  `link_status` MEDIUMTEXT NOT NULL DEFAULT 'linked',
  `notes` MEDIUMTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `whm_accounts_server_id_primary_domain_key` (`server_id`, `primary_domain`),
  UNIQUE KEY `whm_accounts_server_id_whm_username_key` (`server_id`, `whm_username`),
  KEY `idx_whm_accounts_email` (`contact_email`),
  KEY `idx_whm_accounts_hosting_acct_id` (`hosting_account_id`),
  KEY `idx_whm_accounts_profile` (`profile_id`),
  KEY `idx_whm_accounts_server` (`server_id`),
  KEY `idx_whm_accounts_status` (`status`),
  KEY `idx_whm_accounts_sync_status` (`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- whm_package_mappings
CREATE TABLE IF NOT EXISTS `whm_package_mappings` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `server_id` CHAR(36) NULL,
  `whm_package_name` VARCHAR(255) NOT NULL,
  `plan_id` CHAR(36) NULL,
  `label` MEDIUMTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `whm_package_mappings_server_id_whm_package_name_key` (`server_id`, `whm_package_name`),
  KEY `idx_whm_mappings_server` (`server_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Chaves estrangeiras (adicionadas no fim para respeitar dependências)
-- Reexecução segura: FOREIGN KEY IF NOT EXISTS (MariaDB) salta FKs existentes.
-- ============================================================================
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL;
ALTER TABLE `ai_audit_logs` ADD CONSTRAINT `ai_audit_logs_conversation_id_fkey` FOREIGN KEY IF NOT EXISTS (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE SET NULL;
ALTER TABLE `ai_audit_logs` ADD CONSTRAINT `ai_audit_logs_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL;
ALTER TABLE `ai_conversations` ADD CONSTRAINT `ai_conversations_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL;
ALTER TABLE `ai_messages` ADD CONSTRAINT `ai_messages_conversation_id_fkey` FOREIGN KEY IF NOT EXISTS (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE;
ALTER TABLE `clients` ADD CONSTRAINT `clients_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `company_billing_settings` ADD CONSTRAINT `company_billing_settings_updated_by_fkey` FOREIGN KEY IF NOT EXISTS (`updated_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL;
ALTER TABLE `domains` ADD CONSTRAINT `domains_order_id_fkey` FOREIGN KEY IF NOT EXISTS (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL;
ALTER TABLE `domains` ADD CONSTRAINT `domains_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `domains` ADD CONSTRAINT `domains_service_id_fkey` FOREIGN KEY IF NOT EXISTS (`service_id`) REFERENCES `services` (`id`);
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_invoice_id_fkey` FOREIGN KEY IF NOT EXISTS (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL;
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_order_id_fkey` FOREIGN KEY IF NOT EXISTS (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL;
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL;
ALTER TABLE `emails` ADD CONSTRAINT `emails_hosting_id_fkey` FOREIGN KEY IF NOT EXISTS (`hosting_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE CASCADE;
ALTER TABLE `emails` ADD CONSTRAINT `emails_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `hosting_accounts` ADD CONSTRAINT `hosting_accounts_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `hosting_accounts` ADD CONSTRAINT `hosting_accounts_server_id_fkey` FOREIGN KEY IF NOT EXISTS (`server_id`) REFERENCES `servers` (`id`);
ALTER TABLE `hosting_accounts` ADD CONSTRAINT `hosting_accounts_service_id_fkey` FOREIGN KEY IF NOT EXISTS (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE;
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY IF NOT EXISTS (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE;
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_product_id_fkey` FOREIGN KEY IF NOT EXISTS (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL;
ALTER TABLE `invoice_send_logs` ADD CONSTRAINT `invoice_send_logs_initiated_by_fkey` FOREIGN KEY IF NOT EXISTS (`initiated_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL;
ALTER TABLE `invoice_send_logs` ADD CONSTRAINT `invoice_send_logs_invoice_id_fkey` FOREIGN KEY IF NOT EXISTS (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_created_by_fkey` FOREIGN KEY IF NOT EXISTS (`created_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_order_id_fkey` FOREIGN KEY IF NOT EXISTS (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_service_id_fkey` FOREIGN KEY IF NOT EXISTS (`service_id`) REFERENCES `services` (`id`);
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_ticket_id_fkey` FOREIGN KEY IF NOT EXISTS (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE SET NULL;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY IF NOT EXISTS (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY IF NOT EXISTS (`user_id`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL;
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoice_id_fkey` FOREIGN KEY IF NOT EXISTS (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY IF NOT EXISTS (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL;
ALTER TABLE `payments` ADD CONSTRAINT `payments_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `product_features` ADD CONSTRAINT `product_features_product_id_fkey` FOREIGN KEY IF NOT EXISTS (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE;
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fkey` FOREIGN KEY IF NOT EXISTS (`id`) REFERENCES `auth_users` (`id`) ON DELETE CASCADE;
ALTER TABLE `services` ADD CONSTRAINT `services_order_id_fkey` FOREIGN KEY IF NOT EXISTS (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL;
ALTER TABLE `services` ADD CONSTRAINT `services_plan_id_fkey` FOREIGN KEY IF NOT EXISTS (`plan_id`) REFERENCES `plans` (`id`);
ALTER TABLE `services` ADD CONSTRAINT `services_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `services` ADD CONSTRAINT `services_server_id_fkey` FOREIGN KEY IF NOT EXISTS (`server_id`) REFERENCES `servers` (`id`);
ALTER TABLE `sso_audit_logs` ADD CONSTRAINT `sso_audit_logs_hosting_account_id_fkey` FOREIGN KEY IF NOT EXISTS (`hosting_account_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE SET NULL;
ALTER TABLE `sso_audit_logs` ADD CONSTRAINT `sso_audit_logs_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `sso_audit_logs` ADD CONSTRAINT `sso_audit_logs_service_id_fkey` FOREIGN KEY IF NOT EXISTS (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL;
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_invoice_id_fkey` FOREIGN KEY IF NOT EXISTS (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL;
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_message_id_fkey` FOREIGN KEY IF NOT EXISTS (`message_id`) REFERENCES `ticket_messages` (`id`) ON DELETE SET NULL;
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_ticket_id_fkey` FOREIGN KEY IF NOT EXISTS (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE;
ALTER TABLE `ticket_attachments` ADD CONSTRAINT `ticket_attachments_uploaded_by_fkey` FOREIGN KEY IF NOT EXISTS (`uploaded_by`) REFERENCES `auth_users` (`id`) ON DELETE SET NULL;
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticket_id_fkey` FOREIGN KEY IF NOT EXISTS (`ticket_id`) REFERENCES `tickets` (`id`) ON DELETE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_assigned_to_fkey` FOREIGN KEY IF NOT EXISTS (`assigned_to`) REFERENCES `profiles` (`id`);
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_domain_id_fkey` FOREIGN KEY IF NOT EXISTS (`domain_id`) REFERENCES `domains` (`id`) ON DELETE SET NULL;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE CASCADE;
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_service_id_fkey` FOREIGN KEY IF NOT EXISTS (`service_id`) REFERENCES `services` (`id`);
ALTER TABLE `whm_accounts` ADD CONSTRAINT `whm_accounts_hosting_account_id_fkey` FOREIGN KEY IF NOT EXISTS (`hosting_account_id`) REFERENCES `hosting_accounts` (`id`) ON DELETE SET NULL;
ALTER TABLE `whm_accounts` ADD CONSTRAINT `whm_accounts_profile_id_fkey` FOREIGN KEY IF NOT EXISTS (`profile_id`) REFERENCES `profiles` (`id`) ON DELETE SET NULL;
ALTER TABLE `whm_accounts` ADD CONSTRAINT `whm_accounts_server_id_fkey` FOREIGN KEY IF NOT EXISTS (`server_id`) REFERENCES `servers` (`id`) ON DELETE CASCADE;
ALTER TABLE `whm_accounts` ADD CONSTRAINT `whm_accounts_service_id_fkey` FOREIGN KEY IF NOT EXISTS (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL;
ALTER TABLE `whm_package_mappings` ADD CONSTRAINT `whm_package_mappings_plan_id_fkey` FOREIGN KEY IF NOT EXISTS (`plan_id`) REFERENCES `plans` (`id`) ON DELETE SET NULL;
ALTER TABLE `whm_package_mappings` ADD CONSTRAINT `whm_package_mappings_server_id_fkey` FOREIGN KEY IF NOT EXISTS (`server_id`) REFERENCES `servers` (`id`) ON DELETE CASCADE;

SET foreign_key_checks = 1;
