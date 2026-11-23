-- Domínios a confirmar pela equipa com pagamento antecipado (ex.: .ao, .co.ao).
-- O pagamento deixa de esperar pela confirmação; se o nome estiver indisponível depois do pagamento, o caso
-- passa a tratamento manual (propor outro domínio ou reembolso pelo fluxo manual), com histórico das decisões.
-- Só acrescenta colunas e uma tabela: não altera encomendas, pagamentos nem facturas existentes. Idempotente.

-- Caso de tratamento manual do domínio (NULL = sem caso)
--   manual_review    indisponível depois do pagamento/comprovativo: a equipa decide
--   alternative      outro domínio proposto ao cliente
--   refund_manual    encaminhado para reembolso (tratado manualmente pela equipa financeira)
--   resolved         caso encerrado
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS domain_case VARCHAR(24) NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS domain_case_note VARCHAR(500) NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS proposed_domain VARCHAR(253) NULL;

-- Histórico das decisões da equipa sobre o domínio (quem, quando, o quê e porquê)
CREATE TABLE IF NOT EXISTS order_domain_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  order_item_id CHAR(36) NOT NULL,
  action VARCHAR(32) NOT NULL,
  domain VARCHAR(253) NULL,
  proposed_domain VARCHAR(253) NULL,
  note VARCHAR(500) NULL,
  admin_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_ode_order (order_id, created_at),
  KEY idx_ode_item (order_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
