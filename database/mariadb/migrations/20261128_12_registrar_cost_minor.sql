-- Custo do fornecedor em unidades menores (cêntimos), tal como devolvido pela API da Hostinger.
-- cost_amount (decimal) fica só para leitura humana. Idempotente; não altera dados existentes.
ALTER TABLE registrar_operations ADD COLUMN IF NOT EXISTS cost_minor BIGINT NULL AFTER cost_amount;
