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
