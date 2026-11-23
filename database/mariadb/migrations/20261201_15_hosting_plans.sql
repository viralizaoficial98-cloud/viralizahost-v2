-- Hospedagem Premium (categoria «hosting»): ficha técnica do plano, grupos de características e desconto por período.
-- Não altera preços, ciclos, pacotes WHM, encomendas, facturas nem serviços. Só toca nos planos da categoria «hosting».
-- Ordem: depois de 20261130_14_email_plans.sql (que criou base_monthly_price, discount_pct e renewal_discount_pct).

-- Ficha técnica (sites, armazenamento, disco, tráfego, e-mail, RAM, inodes, perfil). NULL = sem ficha: o cartão
-- continua a mostrar só as características, como até agora.
ALTER TABLE products ADD COLUMN IF NOT EXISTS plan_specs LONGTEXT NULL CHECK (plan_specs IS NULL OR JSON_VALID(plan_specs));
-- Grupo da característica (ex.: «Recursos Premium»); NULL = lista simples, como até agora.
ALTER TABLE product_features ADD COLUMN IF NOT EXISTS group_name VARCHAR(60) NULL;

-- Desconto de cada período calculado a partir dos preços GUARDADOS (preço base = preço mensal actual):
--   desconto = arredondar(100 × (1 − preço do período / (preço mensal × meses)))
-- Só os 4 períodos públicos (1 mês, 1, 2 e 3 anos) e só planos ainda sem preço base (primeira aplicação).
-- O preço do período NÃO muda: se não corresponder exactamente a um desconto inteiro, o painel mostra-o como
-- «preço actual mantido» até o administrador decidir aplicar a regra.
UPDATE product_prices pp
JOIN products p ON p.id = pp.product_id AND p.category = 'hosting' AND p.base_monthly_price IS NULL
JOIN product_prices m ON m.product_id = p.id AND m.cycle = 'monthly' AND m.price > 0
SET pp.discount_pct = LEAST(90, GREATEST(0, ROUND(100 * (1 - pp.price / (m.price * pp.months)))))
WHERE pp.cycle IN ('monthly', '1year', '2years', '3years') AND pp.price > 0;

-- Preço mensal base = preço mensal actual
UPDATE products p JOIN product_prices m ON m.product_id = p.id AND m.cycle = 'monthly'
SET p.base_monthly_price = m.price
WHERE p.category = 'hosting' AND p.base_monthly_price IS NULL AND m.price > 0;
