-- Registrador real (Hostinger): compra autorizada por um administrador, item a item.
-- Idempotente. Não altera dados existentes.

-- Autorização, custo no fornecedor, nameservers/DNS e reserva contra pedidos concorrentes
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS authorized_by CHAR(36) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS authorized_at DATETIME(6) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS cost_amount DECIMAL(12,2) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS cost_currency VARCHAR(8) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS item_id VARCHAR(120) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(64) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS ns_status ENUM('pending','applied','failed') NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS ns_message VARCHAR(500) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS dns_status ENUM('pending','confirmed') NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS dns_checked_at DATETIME(6) NULL;
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS locked_until DATETIME(6) NULL;

-- Histórico de cada tentativa/consulta (auditoria). Nunca guarda tokens nem dados de cartão.
CREATE TABLE IF NOT EXISTS registrar_operation_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  operation_id CHAR(36) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  http_status INT NULL,
  outcome VARCHAR(32) NULL,
  message VARCHAR(500) NULL,
  actor_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY registrar_operation_events_op (operation_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contactos (perfis WHOIS) criados no fornecedor para o titular, por extensão
CREATE TABLE IF NOT EXISTS registrar_contacts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  profile_id CHAR(36) NOT NULL,
  tld VARCHAR(32) NOT NULL,
  details_hash CHAR(64) NOT NULL,
  provider_contact_id VARCHAR(64) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY registrar_contacts_key (provider, profile_id, tld, details_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
