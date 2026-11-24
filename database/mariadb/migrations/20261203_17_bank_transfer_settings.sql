-- Dados de transferência bancária geridos no painel (Configurações → Facturação) e cópia por factura.
-- Ordem: depois de 20261202_16_domain_cases.sql. Idempotente.
-- Não valida nem corrige valores antigos: um IBAN guardado inválido fica como está e o painel avisa o administrador.

-- 1. Imagem decorativa do cartão de transferência (caminho no armazenamento «billing-assets»; NULL = sem imagem)
ALTER TABLE company_billing_settings ADD COLUMN IF NOT EXISTS bank_card_image_path VARCHAR(512) NULL;

-- 2. Uma única configuração guardada: se a linha activa ainda não tem IBAN nem número de conta, guarda os dados
--    que o site mostra hoje (valores por omissão do PR #44), tal como estão — sem completar nem validar.
--    Linhas com dados bancários já guardados não são tocadas.
INSERT INTO company_billing_settings (id, active)
SELECT UUID(), 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM company_billing_settings WHERE active = 1);
UPDATE company_billing_settings
SET bank_name = COALESCE(NULLIF(TRIM(bank_name), ''), 'Banco BIC'),
    account_holder = COALESCE(NULLIF(TRIM(account_holder), ''), 'VIRALIZA FÁCIL ANGOLA LDA'),
    iban = '005100002477517910141'
WHERE active = 1 AND NULLIF(TRIM(COALESCE(iban, '')), '') IS NULL AND NULLIF(TRIM(COALESCE(account_number, '')), '') IS NULL;

-- 3. Cópia dos dados de transferência em cada factura (as facturas novas guardam os dados em vigor ao serem
--    emitidas; uma alteração posterior no painel não muda facturas já emitidas).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bank_details LONGTEXT NULL CHECK (bank_details IS NULL OR JSON_VALID(bank_details));

-- Facturas já emitidas: ficam com os dados que mostravam até agora (os da configuração activa).
UPDATE invoices i
JOIN company_billing_settings s ON s.active = 1
SET i.bank_details = JSON_OBJECT(
  'bank', COALESCE(NULLIF(TRIM(s.bank_name), ''), 'Banco BIC'),
  'holder', COALESCE(NULLIF(TRIM(s.account_holder), ''), 'VIRALIZA FÁCIL ANGOLA LDA'),
  'iban', NULLIF(TRIM(COALESCE(s.iban, '')), ''),
  'accountNumber', IF(NULLIF(TRIM(COALESCE(s.iban, '')), '') IS NULL, NULLIF(TRIM(COALESCE(s.account_number, '')), ''), NULL),
  'swift', NULLIF(TRIM(COALESCE(s.swift, '')), ''),
  'instructions', NULLIF(TRIM(COALESCE(s.payment_instructions, '')), ''),
  'source', 'migration'),
    i.updated_at = i.updated_at  -- mantém a data da factura (a coluna tem ON UPDATE)
WHERE i.bank_details IS NULL;
