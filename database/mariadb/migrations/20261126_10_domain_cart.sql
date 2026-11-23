-- Compra de domínio avulso: carrinho guardado no servidor (retoma depois do login ou da
-- verificação de e-mail, noutro separador ou dispositivo), nameservers escolhidos por item
-- e nameservers padrão configuráveis no painel (Integrações → Registrador).
-- Idempotente. Não altera dados existentes.
CREATE TABLE IF NOT EXISTS shopping_carts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  profile_id CHAR(36) NULL,
  items LONGTEXT NOT NULL DEFAULT '[]' CHECK (json_valid(items)),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY shopping_carts_token_key (token_hash),
  KEY shopping_carts_profile_idx (profile_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nameservers do item de domínio: {"useDefault": true|false, "ns": ["ns1…", "ns2…"]}
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS nameservers LONGTEXT NULL CHECK (nameservers IS NULL OR json_valid(nameservers));

-- Nameservers padrão da ViralizaHost (lista JSON). NULL = ns1/ns2.viralizahost.com
ALTER TABLE registrar_settings ADD COLUMN IF NOT EXISTS default_nameservers LONGTEXT NULL CHECK (default_nameservers IS NULL OR json_valid(default_nameservers));
