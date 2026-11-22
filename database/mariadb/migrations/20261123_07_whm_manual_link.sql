-- Associação manual de contas WHM a clientes: quem associou, quando e como.
-- Só acrescenta colunas (IF NOT EXISTS): contas, vínculos e serviços existentes ficam intactos.
ALTER TABLE whm_accounts ADD COLUMN IF NOT EXISTS linked_by CHAR(36) NULL;
ALTER TABLE whm_accounts ADD COLUMN IF NOT EXISTS linked_at DATETIME(6) NULL;
ALTER TABLE whm_accounts ADD COLUMN IF NOT EXISTS link_method VARCHAR(16) NULL;
