-- Renovação de serviços pela Área do Cliente: a encomenda de renovação cria um
-- serviço «renovação» ligado ao original; quando pago, prolonga next_due_date do original.
ALTER TABLE services ADD COLUMN IF NOT EXISTS renews_service_id CHAR(36) NULL AFTER order_item_id;
ALTER TABLE services ADD INDEX IF NOT EXISTS services_renews_idx (renews_service_id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS renews_service_id CHAR(36) NULL;
