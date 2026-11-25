-- Revenda de Hospedagem: pedidos com aprovação, servidores com capacidade, perfis técnicos dos planos,
-- reservas de capacidade, motor de aprovisionamento WHM (fila persistente e auditada) e área do revendedor.
-- Ordem: depois de 20261208_22_banner_pages_empresa.sql. Idempotente e NÃO destrutiva:
--   • só CREATE TABLE IF NOT EXISTS e ALTER TABLE … ADD COLUMN IF NOT EXISTS (nenhuma tabela/coluna é apagada);
--   • a tabela `servers` existente é reutilizada (Infraestrutura → Servidores). Nenhum servidor fica autorizado
--     para revenda (reseller_authorized = 0) e o ambiente por omissão é «production»;
--   • modo inicial da revenda: «request_only» (pedidos com aprovação manual; sem venda automática);
--   • planos provisórios (Starter/Business/Pro) só são criados se NENHUM plano de revenda estiver à venda com preço.
--     Nesse caso os planos de revenda incompletos (sem preços) passam a rascunho — não são apagados.

-- ── Configuração comercial (linha única) ──
CREATE TABLE IF NOT EXISTS reseller_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  mode ENUM('disabled','test','request_only','automatic') NOT NULL DEFAULT 'request_only',
  -- Venda automática: exige autorização expressa (quem/quando) E aprovação técnica da infraestrutura
  automatic_authorized_by CHAR(36) NULL,
  automatic_authorized_at DATETIME(6) NULL,
  infra_approved_by CHAR(36) NULL,
  infra_approved_at DATETIME(6) NULL,
  infra_approval_note VARCHAR(500) NULL,
  notify_emails VARCHAR(500) NULL,
  request_notice VARCHAR(600) NULL,
  max_open_requests_per_email TINYINT NOT NULL DEFAULT 3,
  default_nameservers VARCHAR(300) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO reseller_settings (id, mode) VALUES (1, 'request_only') ON DUPLICATE KEY UPDATE id = id;

-- ── Infraestrutura → Servidores (tabela existente) ──
ALTER TABLE servers ADD COLUMN IF NOT EXISTS provider VARCHAR(120) NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS port INT NOT NULL DEFAULT 2087;
-- Referência da credencial (nunca o valor): «db:servers.whm_api_token» (cifrado AES-256-GCM) ou nome de variável de ambiente
ALTER TABLE servers ADD COLUMN IF NOT EXISTS credential_ref VARCHAR(120) NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS server_type VARCHAR(40) NOT NULL DEFAULT 'cpanel_whm';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS os_name VARCHAR(80) NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS cpu_cores INT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS ram_mb INT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS storage_total_mb BIGINT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS storage_reserve_mb BIGINT NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS storage_used_mb BIGINT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS license_name VARCHAR(80) NULL;
-- NULL = limite de contas da licença desconhecido → a capacidade não pode ser determinada (aprovação bloqueada)
ALTER TABLE servers ADD COLUMN IF NOT EXISTS license_account_limit INT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS accounts_existing INT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS accounts_unlimited INT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS quota_committed_mb BIGINT NULL;
-- Quota assumida por cada conta sem limite (ilimitada). NULL + contas ilimitadas → capacidade indeterminada
ALTER TABLE servers ADD COLUMN IF NOT EXISTS unlimited_assumed_mb INT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS resellers_existing INT NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS operational_state ENUM('active','maintenance','disabled') NOT NULL DEFAULT 'active';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_sync_at DATETIME(6) NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(16) NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS last_sync_message VARCHAR(500) NULL;
-- Categorias: hosting | wordpress | email | reseller (JSON array)
ALTER TABLE servers ADD COLUMN IF NOT EXISTS services_allowed LONGTEXT NULL CHECK (services_allowed IS NULL OR JSON_VALID(services_allowed));
ALTER TABLE servers ADD COLUMN IF NOT EXISTS environment ENUM('test','production') NOT NULL DEFAULT 'production';
ALTER TABLE servers ADD COLUMN IF NOT EXISTS reseller_authorized TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS reseller_authorized_by CHAR(36) NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS reseller_authorized_at DATETIME(6) NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS reseller_authorization_note VARCHAR(500) NULL;
-- Contas/revendedores do laboratório que o sistema nunca usa comercialmente (ex.: ["vhreslab"])
ALTER TABLE servers ADD COLUMN IF NOT EXISTS protected_accounts LONGTEXT NULL CHECK (protected_accounts IS NULL OR JSON_VALID(protected_accounts));
-- Servidor WHM principal: categorias actuais (sem revenda) e conta de laboratório protegida. Só preenche o que está vazio.
UPDATE servers SET services_allowed = JSON_ARRAY('hosting','wordpress','email') WHERE services_allowed IS NULL;
UPDATE servers SET protected_accounts = JSON_ARRAY('vhreslab') WHERE protected_accounts IS NULL;
UPDATE servers SET credential_ref = 'db:servers.whm_api_token' WHERE credential_ref IS NULL AND whm_api_token IS NOT NULL;

-- ── Perfil técnico de cada plano de revenda (Catálogo e Preços) ──
CREATE TABLE IF NOT EXISTS reseller_plan_profiles (
  product_id CHAR(36) NOT NULL PRIMARY KEY,
  storage_mb INT NOT NULL,                 -- espaço total que o revendedor pode distribuir pelas contas-filhas
  bandwidth_mb INT NOT NULL,               -- tráfego mensal total distribuível
  max_accounts INT NOT NULL,               -- contas cPanel que o revendedor pode criar
  main_quota_mb INT NOT NULL,              -- quota da conta principal do revendedor
  acl_name VARCHAR(64) NULL,               -- lista de privilégios (ACL) do WHM
  main_package VARCHAR(255) NULL,          -- pacote WHM da conta principal
  allowed_packages LONGTEXT NULL CHECK (allowed_packages IS NULL OR JSON_VALID(allowed_packages)),
  server_ids LONGTEXT NULL CHECK (server_ids IS NULL OR JSON_VALID(server_ids)),
  allow_own_packages TINYINT(1) NOT NULL DEFAULT 0, -- preparado; exige validação técnica e comercial
  notes VARCHAR(500) NULL,
  updated_by CHAR(36) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT reseller_plan_profiles_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Pedidos de contratação ──
CREATE TABLE IF NOT EXISTS reseller_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reference VARCHAR(32) NOT NULL,
  kind ENUM('new','upgrade') NOT NULL DEFAULT 'new',
  upgrade_service_id CHAR(36) NULL,
  profile_id CHAR(36) NULL,
  full_name VARCHAR(160) NOT NULL,
  company VARCHAR(160) NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  domain VARCHAR(191) NOT NULL,
  product_id CHAR(36) NOT NULL,
  cycle ENUM('monthly','3months','6months','1year','2years','3years') NOT NULL,
  estimated_clients INT NULL,
  business_type VARCHAR(60) NULL,
  notes VARCHAR(2000) NULL,
  status ENUM('submitted','under_review','technically_approved','awaiting_payment','paid','provisioning_authorized','provisioning','awaiting_confirmation','active','rejected','cancelled','failed') NOT NULL DEFAULT 'submitted',
  server_id CHAR(36) NULL,
  quoted_total DECIMAL(12,2) NULL,
  order_id CHAR(36) NULL,
  service_id CHAR(36) NULL,
  internal_notes TEXT NULL,
  decision_reason VARCHAR(600) NULL,
  reviewed_by CHAR(36) NULL,
  technical_approved_by CHAR(36) NULL,
  technical_approved_at DATETIME(6) NULL,
  provisioning_authorized_by CHAR(36) NULL,
  provisioning_authorized_at DATETIME(6) NULL,
  ip_hash CHAR(64) NULL,
  dedupe_key CHAR(64) NULL,
  is_test TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY reseller_requests_reference (reference),
  KEY reseller_requests_status (status, created_at),
  KEY reseller_requests_email (email),
  KEY reseller_requests_profile (profile_id),
  KEY reseller_requests_dedupe (dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reseller_request_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  request_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NULL,
  action VARCHAR(40) NOT NULL,
  note VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY reseller_request_events_req (request_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Reservas de capacidade (espaço + contas licenciadas) ──
CREATE TABLE IF NOT EXISTS capacity_reservations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  server_id CHAR(36) NOT NULL,
  request_id CHAR(36) NULL,
  service_id CHAR(36) NULL,
  storage_mb BIGINT NOT NULL,
  accounts INT NOT NULL,
  status ENUM('reserved','committed','released') NOT NULL DEFAULT 'reserved',
  created_by CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY capacity_reservations_request (request_id),
  KEY capacity_reservations_server (server_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Revendedores (um por serviço contratado) ──
CREATE TABLE IF NOT EXISTS reseller_services (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  request_id CHAR(36) NULL,
  profile_id CHAR(36) NOT NULL,
  server_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  whm_username VARCHAR(32) NULL,
  domain VARCHAR(191) NOT NULL,
  status ENUM('provisioning','awaiting_confirmation','active','suspended','failed','terminated') NOT NULL DEFAULT 'provisioning',
  storage_mb INT NOT NULL,
  bandwidth_mb INT NOT NULL,
  max_accounts INT NOT NULL,
  main_quota_mb INT NOT NULL,
  acl_name VARCHAR(64) NULL,
  acl_confirmed_by CHAR(36) NULL,
  acl_confirmed_at DATETIME(6) NULL,
  verified_at DATETIME(6) NULL,
  verification LONGTEXT NULL CHECK (verification IS NULL OR JSON_VALID(verification)),
  suspended_reason VARCHAR(300) NULL,
  activated_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY reseller_services_service (service_id),
  UNIQUE KEY reseller_services_user (server_id, whm_username),
  KEY reseller_services_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Fila persistente de aprovisionamento (uma operação por serviço; passos retomáveis) ──
CREATE TABLE IF NOT EXISTS reseller_provision_ops (
  id CHAR(36) NOT NULL PRIMARY KEY,
  service_id CHAR(36) NOT NULL,
  request_id CHAR(36) NULL,
  server_id CHAR(36) NULL,
  status ENUM('queued','running','awaiting_confirmation','succeeded','failed','blocked') NOT NULL DEFAULT 'queued',
  step VARCHAR(40) NOT NULL DEFAULT 'start',
  state LONGTEXT NULL CHECK (state IS NULL OR JSON_VALID(state)),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  locked_until DATETIME(6) NULL,
  lock_token CHAR(36) NULL,
  next_attempt_at DATETIME(6) NULL,
  last_error VARCHAR(600) NULL,
  authorized_by CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY reseller_provision_ops_service (service_id),
  KEY reseller_provision_ops_status (status, next_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reseller_provision_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  op_id CHAR(36) NOT NULL,
  step VARCHAR(40) NOT NULL,
  outcome ENUM('ok','skipped','error','info') NOT NULL,
  whm_function VARCHAR(48) NULL,
  message VARCHAR(600) NULL,
  duration_ms INT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY reseller_provision_events_op (op_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Histórico de utilização (sincronização WHM) ──
CREATE TABLE IF NOT EXISTS reseller_usage_snapshots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reseller_service_id CHAR(36) NOT NULL,
  disk_used_mb BIGINT NULL,
  disk_allocated_mb BIGINT NULL,
  bandwidth_used_mb BIGINT NULL,
  bandwidth_allocated_mb BIGINT NULL,
  accounts_used INT NULL,
  accounts_suspended INT NULL,
  accounts_limit INT NULL,
  source VARCHAR(16) NOT NULL DEFAULT 'whm',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY reseller_usage_snapshots_svc (reseller_service_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Planos provisórios (só se nenhum plano de revenda estiver à venda com preço activo) ──
SET @vh_rev_need := (SELECT COUNT(*) = 0 FROM products p JOIN product_prices pp ON pp.product_id = p.id
  WHERE p.category = 'reseller' AND p.subcategory IS NULL AND p.active = 1 AND p.sale_status = 'active' AND pp.active = 1);
UPDATE products SET sale_status = 'draft'
  WHERE @vh_rev_need = 1 AND category = 'reseller' AND subcategory IS NULL AND sale_status <> 'draft'
    AND slug NOT IN ('revenda-starter','revenda-business','revenda-pro');
INSERT INTO products (id, slug, category, subcategory, name, description, badge, popular, active, position, sale_status, service_type, provisioning, max_quantity, currency, base_monthly_price, pricing_note)
SELECT UUID(), v.slug, 'reseller', NULL, v.name, v.descr, v.badge, v.popular, 1, v.pos, 'active', 'reseller', 'manual', 1, 'AOA', v.base, 'Preço provisório (revenda)'
FROM (SELECT 'revenda-starter' slug, 'Revenda Starter' name, 'Para começar a revender alojamento com a sua marca.' descr, NULL badge, 0 popular, 110 pos, 25000.00 base
      UNION ALL SELECT 'revenda-business', 'Revenda Business', 'Para agências com uma carteira de clientes em crescimento.', 'MAIS POPULAR', 1, 120, 45000.00
      UNION ALL SELECT 'revenda-pro', 'Revenda Pro', 'Para revendedores com mais clientes e mais espaço.', NULL, 0, 130, 65000.00) v
WHERE @vh_rev_need = 1 AND NOT EXISTS (SELECT 1 FROM products x WHERE x.slug = v.slug);

-- Preços: base × meses × (1 − desconto). Renovação = preço base sem desconto. Valores provisórios, editáveis no painel.
INSERT INTO product_prices (id, product_id, cycle, months, price, renewal_price, currency, active, discount_pct, reference)
SELECT UUID(), p.id, c.cycle, c.months, ROUND(p.base_monthly_price * c.months * (100 - c.disc) / 100, 2), ROUND(p.base_monthly_price * c.months, 2), 'AKZ', 1, c.disc, JSON_OBJECT('provisional', TRUE)
FROM products p
JOIN (SELECT 'monthly' cycle, 1 months, 0 disc UNION ALL SELECT '3months', 3, 5 UNION ALL SELECT '6months', 6, 10 UNION ALL SELECT '1year', 12, 15) c
WHERE p.slug IN ('revenda-starter','revenda-business','revenda-pro') AND p.base_monthly_price IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM product_prices x WHERE x.product_id = p.id);

INSERT INTO product_features (id, product_id, feature, included, position, icon)
SELECT UUID(), p.id, f.txt, 1, f.pos, f.icon FROM products p
JOIN (SELECT 'revenda-starter' slug, 1 pos, '10 GB de armazenamento' txt, 'database' icon
      UNION ALL SELECT 'revenda-starter', 2, 'Até 5 contas cPanel', 'panel'
      UNION ALL SELECT 'revenda-starter', 3, 'Painel WHM de revendedor', 'panel'
      UNION ALL SELECT 'revenda-starter', 4, 'SSL gratuito em todas as contas', 'shield'
      UNION ALL SELECT 'revenda-starter', 5, 'Suporte técnico em português', 'headphones'
      UNION ALL SELECT 'revenda-business', 1, '20 GB de armazenamento', 'database'
      UNION ALL SELECT 'revenda-business', 2, 'Até 10 contas cPanel', 'panel'
      UNION ALL SELECT 'revenda-business', 3, 'Painel WHM de revendedor', 'panel'
      UNION ALL SELECT 'revenda-business', 4, 'SSL gratuito em todas as contas', 'shield'
      UNION ALL SELECT 'revenda-business', 5, 'Suporte prioritário', 'headphones'
      UNION ALL SELECT 'revenda-pro', 1, '30 GB de armazenamento', 'database'
      UNION ALL SELECT 'revenda-pro', 2, 'Até 15 contas cPanel', 'panel'
      UNION ALL SELECT 'revenda-pro', 3, 'Painel WHM de revendedor', 'panel'
      UNION ALL SELECT 'revenda-pro', 4, 'SSL gratuito em todas as contas', 'shield'
      UNION ALL SELECT 'revenda-pro', 5, 'Suporte prioritário', 'headphones') f ON f.slug = p.slug
WHERE NOT EXISTS (SELECT 1 FROM product_features x WHERE x.product_id = p.id);

-- Perfis técnicos provisórios. Pacotes, ACL e servidores ficam por configurar: sem eles a aprovação técnica é bloqueada.
INSERT INTO reseller_plan_profiles (product_id, storage_mb, bandwidth_mb, max_accounts, main_quota_mb, acl_name, main_package, allowed_packages, server_ids, notes)
SELECT p.id, v.storage, v.bw, v.accts, v.mainq, NULL, NULL, JSON_ARRAY(), JSON_ARRAY(), 'Perfil provisório: confirmar ACL, pacotes e servidor antes da primeira venda.'
FROM products p JOIN (SELECT 'revenda-starter' slug, 10240 storage, 102400 bw, 5 accts, 1024 mainq
  UNION ALL SELECT 'revenda-business', 20480, 204800, 10, 1024
  UNION ALL SELECT 'revenda-pro', 30720, 307200, 15, 1024) v ON v.slug = p.slug
ON DUPLICATE KEY UPDATE product_id = product_id;
