-- Servidor VPS (planos associáveis à Hostinger): «6 meses» e «3 anos» deixam de estar à venda para NOVAS aquisições.
-- Ciclos à venda: 1 mês, 1 ano e 2 anos. Só despublica o preço de venda (active = 0): as linhas de preço, os itens e
-- custos da Hostinger guardados, as encomendas, facturas, serviços e renovações (preço aceite no serviço) mantêm-se.
-- VPS com subcategoria (n8n, Evolution API, Viraliza AI Cloud, OpenClaw) e os restantes produtos não são afectados.
-- A regra dos 3 meses (migração 20) mantém-se. Idempotente.
UPDATE product_prices pp
JOIN products p ON p.id = pp.product_id AND p.category = 'vps' AND p.subcategory IS NULL
SET pp.active = 0
WHERE pp.cycle IN ('6months', '3years') AND pp.active = 1;
