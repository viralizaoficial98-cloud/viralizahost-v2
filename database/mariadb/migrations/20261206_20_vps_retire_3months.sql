-- Servidor VPS: o ciclo de 3 meses deixa de estar à venda para NOVAS aquisições.
-- Só desactiva o preço de venda (active = 0); a linha fica guardada. Encomendas, facturas e serviços já contratados
-- nesse ciclo não mudam e as renovações usam o preço aceite no serviço (services.renewal_price), não este registo.
-- VPS com subcategoria (n8n, Evolution API, Viraliza AI Cloud, OpenClaw) não são afectados. Idempotente.
UPDATE product_prices pp
JOIN products p ON p.id = pp.product_id AND p.category = 'vps' AND p.subcategory IS NULL
SET pp.active = 0
WHERE pp.cycle = '3months' AND pp.active = 1;
