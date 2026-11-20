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
