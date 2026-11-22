-- Painel: receita por pagamentos confirmados, acções pendentes, registrador de domínios
-- e mapeamento plano → servidor/pacote WHM. Só acrescenta (IF NOT EXISTS): não altera
-- nem apaga encomendas, facturas ou pagamentos existentes.

-- Revisão de encomendas pela equipa (ex.: encomenda de teste). Nunca é preenchido
-- automaticamente; não altera valores nem pagamentos — só a forma como o painel as conta.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_flag ENUM('test','real') NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_note VARCHAR(500) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_by CHAR(36) NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS review_at DATETIME(6) NULL;

-- Origem da activação de cada serviço: 'whm', 'registrar' (confirmado pelo fornecedor)
-- ou 'manual' (marcado no painel por um administrador, com referência).
ALTER TABLE services ADD COLUMN IF NOT EXISTS activation_source VARCHAR(16) NULL;
ALTER TABLE services ADD COLUMN IF NOT EXISTS activated_by CHAR(36) NULL;

-- Servidor WHM de cada plano (NULL = configuração WHM principal)
ALTER TABLE products ADD COLUMN IF NOT EXISTS whm_server_id CHAR(36) NULL;

-- Configuração do registrador (linha única id = 1). O segredo fica cifrado
-- (WHM_ENCRYPTION_KEY) e nunca é devolvido ao navegador.
CREATE TABLE IF NOT EXISTS registrar_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  provider VARCHAR(32) NOT NULL DEFAULT 'none',
  mode ENUM('test','live') NOT NULL DEFAULT 'test',
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  api_url VARCHAR(255) NULL,
  username VARCHAR(255) NULL,
  secret_enc MEDIUMTEXT NULL,
  extensions JSON NULL CHECK (json_valid(extensions)),
  last_test_at DATETIME(6) NULL,
  last_test_ok TINYINT(1) NULL,
  last_test_message VARCHAR(500) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Uma operação por serviço e tipo: garante que o registo é pedido uma única vez.
-- status: pending (reservada) → submitted (enviada) → succeeded | failed | unknown (inconclusivo)
CREATE TABLE IF NOT EXISTS registrar_operations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  operation ENUM('register','renew','transfer') NOT NULL,
  domain VARCHAR(255) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  mode ENUM('test','live') NOT NULL,
  client_ref VARCHAR(64) NOT NULL,
  status ENUM('pending','submitted','succeeded','failed','unknown') NOT NULL DEFAULT 'pending',
  provider_ref VARCHAR(255) NULL,
  provider_status VARCHAR(64) NULL,
  message VARCHAR(500) NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY registrar_operations_service_op (service_id, operation),
  UNIQUE KEY registrar_operations_client_ref (client_ref),
  KEY registrar_operations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
