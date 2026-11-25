-- Cloud VPS: pedidos com aprovação, autorização de aquisição separada, inventário das VMs do fornecedor (importação,
-- associação explícita a clientes, protecção da infraestrutura interna), histórico de sincronização, finanças
-- (custo de renovação do fornecedor, câmbio, margem) e acesso do cliente (senha/chave definidas por ele).
-- Ordem: depois de 20261209_23_reseller_hosting.sql. Idempotente e NÃO destrutiva (sem DROP; nada é apagado).
-- O modo comercial fica em vps_provider_settings.options.commercialMode (por omissão «request_only»).

-- ── Pedidos de contratação (modo «solicitação mediante aprovação») ──
CREATE TABLE IF NOT EXISTS vps_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  reference VARCHAR(32) NOT NULL,
  kind ENUM('new','upgrade') NOT NULL DEFAULT 'new',
  upgrade_service_id CHAR(36) NULL,
  profile_id CHAR(36) NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(40) NULL,
  company VARCHAR(160) NULL,
  product_id CHAR(36) NOT NULL,
  cycle ENUM('monthly','3months','6months','1year','2years','3years') NOT NULL,
  -- localização, instalação, hostname, chave SSH pública, extras — validados no servidor (nunca senhas)
  options LONGTEXT NULL CHECK (options IS NULL OR JSON_VALID(options)),
  notes VARCHAR(2000) NULL,
  status ENUM('submitted','under_review','approved','awaiting_payment','paid','purchase_authorized','provisioning','active','rejected','cancelled','failed') NOT NULL DEFAULT 'submitted',
  quoted_total DECIMAL(12,2) NULL,
  provider_cost_minor INT NULL,
  provider_currency CHAR(3) NULL,
  order_id CHAR(36) NULL,
  service_id CHAR(36) NULL,
  internal_notes TEXT NULL,
  decision_reason VARCHAR(600) NULL,
  reviewed_by CHAR(36) NULL,
  approved_by CHAR(36) NULL,
  approved_at DATETIME(6) NULL,
  purchase_authorized_by CHAR(36) NULL,
  purchase_authorized_at DATETIME(6) NULL,
  is_test TINYINT(1) NOT NULL DEFAULT 0,
  ip_hash CHAR(64) NULL,
  dedupe_key CHAR(64) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY vps_requests_reference (reference),
  KEY vps_requests_status (status, created_at),
  KEY vps_requests_profile (profile_id),
  KEY vps_requests_service (service_id),
  KEY vps_requests_dedupe (dedupe_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vps_request_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  request_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NULL,
  action VARCHAR(40) NOT NULL,
  note VARCHAR(1000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY vps_request_events_req (request_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Inventário das VMs da conta do fornecedor (importadas; associação comercial só explícita) ──
CREATE TABLE IF NOT EXISTS vps_instances (
  id CHAR(36) NOT NULL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL DEFAULT 'hostinger',
  provider_vm_id VARCHAR(64) NOT NULL,
  subscription_id VARCHAR(64) NULL,
  plan VARCHAR(80) NULL,
  hostname VARCHAR(191) NULL,
  state VARCHAR(40) NULL,
  cpus INT NULL,
  memory_mb INT NULL,
  disk_mb INT NULL,
  bandwidth_mb BIGINT NULL,
  ipv4 VARCHAR(64) NULL,
  ipv6 VARCHAR(80) NULL,
  data_center_id VARCHAR(20) NULL,
  template_name VARCHAR(160) NULL,
  provider_created_at DATETIME(6) NULL,
  -- interno = infraestrutura da ViralizaHost; protegido = nenhuma operação do módulo Cloud VPS (nem comercial)
  is_internal TINYINT(1) NOT NULL DEFAULT 0,
  is_protected TINYINT(1) NOT NULL DEFAULT 0,
  protection_reason VARCHAR(300) NULL,
  link_status ENUM('unlinked','linked') NOT NULL DEFAULT 'unlinked',
  service_id CHAR(36) NULL,
  profile_id CHAR(36) NULL,
  linked_by CHAR(36) NULL,
  linked_at DATETIME(6) NULL,
  -- subscrição do fornecedor (GET /api/billing/v1/subscriptions): custos e renovação
  sub_status VARCHAR(30) NULL,
  sub_currency CHAR(3) NULL,
  sub_total_minor INT NULL,
  sub_renewal_minor INT NULL,
  sub_billing_period INT NULL,
  sub_billing_unit VARCHAR(10) NULL,
  sub_auto_renew TINYINT(1) NULL,
  sub_next_billing_at DATETIME(6) NULL,
  sub_expires_at DATETIME(6) NULL,
  missing_since DATETIME(6) NULL,
  last_sync_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY vps_instances_vm (provider, provider_vm_id),
  KEY vps_instances_service (service_id),
  KEY vps_instances_profile (profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VPS de produção da ViralizaHost (KVM 4, AlmaLinux 9 + cPanel): protegido permanentemente (também no código).
INSERT INTO vps_instances (id, provider, provider_vm_id, plan, template_name, is_internal, is_protected, protection_reason)
VALUES (UUID(), 'hostinger', '1564781', 'KVM 4', 'AlmaLinux 9 with cPanel', 1, 1, 'Infraestrutura de produção da ViralizaHost (KVM 4, 16 GB, 200 GB, AlmaLinux 9 + cPanel)')
ON DUPLICATE KEY UPDATE is_internal = 1, is_protected = 1, protection_reason = COALESCE(protection_reason, VALUES(protection_reason));

-- ── Histórico de sincronização com o fornecedor (resultado individual de cada consulta) ──
CREATE TABLE IF NOT EXISTS vps_sync_runs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  kind VARCHAR(30) NOT NULL,
  ok TINYINT(1) NOT NULL,
  results LONGTEXT NULL CHECK (results IS NULL OR JSON_VALID(results)),
  message VARCHAR(500) NULL,
  actor CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY vps_sync_runs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Finanças por ciclo: custo de RENOVAÇÃO do fornecedor (o custo inicial já existe em provider_cost_minor) ──
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS provider_renewal_minor INT NULL;
-- Por plano: custos de suporte/licenças (Kz/mês) e acréscimo próprio (%), em JSON
ALTER TABLE products ADD COLUMN IF NOT EXISTS provider_finance LONGTEXT NULL CHECK (provider_finance IS NULL OR JSON_VALID(provider_finance));

-- ── Operações de compra: acesso do cliente e hostname pedido ──
ALTER TABLE vps_provider_orders ADD COLUMN IF NOT EXISTS access_method VARCHAR(20) NULL;
ALTER TABLE vps_provider_orders ADD COLUMN IF NOT EXISTS access_configured_at DATETIME(6) NULL;
ALTER TABLE vps_provider_orders ADD COLUMN IF NOT EXISTS client_hostname VARCHAR(191) NULL;
ALTER TABLE vps_provider_orders ADD COLUMN IF NOT EXISTS firewall_id VARCHAR(32) NULL;

-- Modo comercial inicial: «solicitação mediante aprovação» (só se ainda não estiver definido)
UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options, '{}'), '$.commercialMode', 'request_only')
WHERE options IS NULL OR JSON_EXTRACT(options, '$.commercialMode') IS NULL;

-- VPS já entregues antes desta migração: o acesso foi tratado pelo processo anterior (não ficam «a aguardar acesso»)
UPDATE vps_provider_orders SET access_method = 'legacy', access_configured_at = COALESCE(updated_at, CURRENT_TIMESTAMP(6))
WHERE status = 'active' AND access_configured_at IS NULL AND access_method IS NULL;
