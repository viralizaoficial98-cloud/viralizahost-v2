-- Gerado a partir de public.setup_product_catalog() (PostgreSQL) — dados de reserva do catálogo.
-- Executado por rpc('setup_product_catalog'). Idempotente.
INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    (UUID(), 'hosting-start',    'hosting', 'Plano Start',    'Ideal para sites pessoais e blogs',  null,           false, true, 10,
     19900, 16900, 13900, 10900,  8900, 'Começar com Start'),
    (UUID(), 'hosting-business', 'hosting', 'Plano Business', 'Para pequenas e médias empresas',    'MAIS POPULAR', true,  true, 20,
     39900, 33900, 27900, 21900, 17900, 'Começar com Business'),
    (UUID(), 'hosting-turbo',    'hosting', 'Plano Turbo',    'Performance máxima sem limites',     'MELHOR VALOR', false, true, 30,
     79900, 67900, 55900, 43900, 35900, 'Começar com Turbo')
  ON DUPLICATE KEY UPDATE
    name=VALUES(name), description=VALUES(description), badge=VALUES(badge),
    popular=VALUES(popular), active=VALUES(active), position=VALUES(position),
    price_monthly=VALUES(price_monthly), price_6months=VALUES(price_6months),
    price_1year=VALUES(price_1year), price_2years=VALUES(price_2years),
    price_3years=VALUES(price_3years), cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

DELETE pf FROM product_features pf JOIN products p ON p.id = pf.product_id WHERE p.slug = 'hosting-start';

INSERT INTO product_features (id, product_id, feature, included, position)
SELECT UUID(), p.id, f.feat, f.inc, f.pos FROM (SELECT id FROM products WHERE slug='hosting-start') p, (SELECT '1 site hospedado' AS feat, true AS inc, 1 AS pos UNION ALL SELECT '20 GB NVMe SSD' AS feat, true AS inc, 2 AS pos UNION ALL SELECT 'SSL grátis' AS feat, true AS inc, 3 AS pos UNION ALL SELECT 'cPanel incluído' AS feat, true AS inc, 4 AS pos UNION ALL SELECT '5 contas de e-mail' AS feat, true AS inc, 5 AS pos UNION ALL SELECT 'Backup semanal' AS feat, true AS inc, 6 AS pos UNION ALL SELECT 'Migração gratuita' AS feat, true AS inc, 7 AS pos UNION ALL SELECT 'Suporte 24/7' AS feat, true AS inc, 8 AS pos UNION ALL SELECT 'Sites ilimitados' AS feat, false AS inc, 9 AS pos UNION ALL SELECT 'CDN global' AS feat, false AS inc, 10 AS pos) f;

DELETE pf FROM product_features pf JOIN products p ON p.id = pf.product_id WHERE p.slug = 'hosting-business';

INSERT INTO product_features (id, product_id, feature, included, position)
SELECT UUID(), p.id, f.feat, f.inc, f.pos FROM (SELECT id FROM products WHERE slug='hosting-business') p, (SELECT '5 sites hospedados' AS feat, true AS inc, 1 AS pos UNION ALL SELECT '50 GB NVMe SSD' AS feat, true AS inc, 2 AS pos UNION ALL SELECT 'SSL grátis' AS feat, true AS inc, 3 AS pos UNION ALL SELECT 'cPanel incluído' AS feat, true AS inc, 4 AS pos UNION ALL SELECT '20 contas de e-mail' AS feat, true AS inc, 5 AS pos UNION ALL SELECT 'Backup diário' AS feat, true AS inc, 6 AS pos UNION ALL SELECT 'Migração gratuita' AS feat, true AS inc, 7 AS pos UNION ALL SELECT 'Suporte prioritário 24/7' AS feat, true AS inc, 8 AS pos UNION ALL SELECT 'CDN básico' AS feat, true AS inc, 9 AS pos UNION ALL SELECT 'Sites ilimitados' AS feat, false AS inc, 10 AS pos) f;

DELETE pf FROM product_features pf JOIN products p ON p.id = pf.product_id WHERE p.slug = 'hosting-turbo';

INSERT INTO product_features (id, product_id, feature, included, position)
SELECT UUID(), p.id, f.feat, f.inc, f.pos FROM (SELECT id FROM products WHERE slug='hosting-turbo') p, (SELECT 'Sites ilimitados' AS feat, true AS inc, 1 AS pos UNION ALL SELECT '200 GB NVMe SSD' AS feat, true AS inc, 2 AS pos UNION ALL SELECT 'SSL grátis' AS feat, true AS inc, 3 AS pos UNION ALL SELECT 'cPanel incluído' AS feat, true AS inc, 4 AS pos UNION ALL SELECT 'E-mails ilimitados' AS feat, true AS inc, 5 AS pos UNION ALL SELECT 'Backup diário automático' AS feat, true AS inc, 6 AS pos UNION ALL SELECT 'Migração gratuita' AS feat, true AS inc, 7 AS pos UNION ALL SELECT 'Suporte premium 24/7' AS feat, true AS inc, 8 AS pos UNION ALL SELECT 'CDN global' AS feat, true AS inc, 9 AS pos UNION ALL SELECT 'IP dedicado' AS feat, true AS inc, 10 AS pos) f;

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    (UUID(), 'wp-start', 'wordpress', 'WordPress Start', 'Para blogs e sites pessoais',           null,           false, true, 10,
     24900, 21200, 17400, 13700, 11200, 'Começar com Start'),
    (UUID(), 'wp-pro',   'wordpress', 'WordPress Pro',   'Para empresas e lojas WooCommerce',     'MAIS POPULAR', true,  true, 20,
     49900, 42400, 34900, 27400, 22500, 'Começar com Pro'),
    (UUID(), 'wp-turbo', 'wordpress', 'WordPress Turbo', 'Máxima performance para alta demanda',  'MELHOR VALOR', false, true, 30,
     99900, 84900, 69900, 54900, 44900, 'Começar com Turbo')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_6months=VALUES(price_6months),
    price_1year=VALUES(price_1year), price_2years=VALUES(price_2years),
    price_3years=VALUES(price_3years), cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    (UUID(), 'email-starter',         'email', 'Email Starter',         'Para freelancers e profissionais', null,           false, true, 10,
      6800,  5780,  4760,  3740,  3060, 'Contratar'),
    (UUID(), 'email-standard',        'email', 'Email Standard',        'Para equipas e pequenas empresas', 'MAIS POPULAR', true,  true, 20,
     14800, 12580, 10360,  8140,  6660, 'Contratar'),
    (UUID(), 'email-premium',         'email', 'Email Premium',         'Para empresas em crescimento',     'MELHOR VALOR', false, true, 30,
     28000, 23800, 19600, 15400, 12600, 'Contratar'),
    (UUID(), 'microsoft-365-outlook', 'email', 'Microsoft 365 Outlook', 'Suite completa Microsoft 365',     null,           false, true, 40,
     52000, 44200, 36400, 28600, 23400, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_6months=VALUES(price_6months),
    price_1year=VALUES(price_1year), price_2years=VALUES(price_2years),
    price_3years=VALUES(price_3years), cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    (UUID(), 'vps-nvme2', 'vps', 'VPS NVMe 2', 'Para projectos iniciais',      null,           false, true, 10,
      45000,  38200,  31500,  24800,  20200, 'Contratar'),
    (UUID(), 'vps-nvme4', 'vps', 'VPS NVMe 4', 'Para aplicações e e-commerce', 'MAIS POPULAR', true,  true, 20,
      85000,  72200,  59500,  46800,  38200, 'Contratar'),
    (UUID(), 'vps-nvme8', 'vps', 'VPS NVMe 8', 'Para alta demanda e escala',   'MELHOR VALOR', false, true, 30,
     159000, 135200, 111300,  87500,  71500, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_6months=VALUES(price_6months),
    price_1year=VALUES(price_1year), price_2years=VALUES(price_2years),
    price_3years=VALUES(price_3years), cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    (UUID(), 'reseller-start',      'reseller', 'Reseller Start',      'Para começar no mercado',           null,           false, true, 10,
      59900,  50900,  41900,  33000,  26900, 'Contratar'),
    (UUID(), 'reseller-growth',     'reseller', 'Reseller Growth',     'Para resellers em crescimento',      null,           false, true, 20,
      99900,  84900,  69900,  54900,  44900, 'Contratar'),
    (UUID(), 'reseller-business',   'reseller', 'Reseller Business',   'Para agências profissionais',        'MAIS POPULAR', true,  true, 30,
     179900, 152900, 125900,  98900,  80900, 'Contratar'),
    (UUID(), 'reseller-enterprise', 'reseller', 'Reseller Enterprise', 'Para grandes revendedores',          'MELHOR VALOR', false, true, 40,
     349900, 297400, 244900, 192400, 157400, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_6months=VALUES(price_6months),
    price_1year=VALUES(price_1year), price_2years=VALUES(price_2years),
    price_3years=VALUES(price_3years), cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    (UUID(), 'ded-16', 'dedicated', 'Dedicado NVMe 16', 'Para sistemas de médio porte',  null,           false, true, 10,
     249000, 174300, 'Contratar'),
    (UUID(), 'ded-32', 'dedicated', 'Dedicado NVMe 32', 'Para alta demanda',             'MAIS POPULAR', true,  true, 20,
     449000, 314300, 'Contratar'),
    (UUID(), 'ded-64', 'dedicated', 'Dedicado NVMe 64', 'Para infra-estruturas empresa', 'MELHOR VALOR', false, true, 30,
     799000, 559300, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_1year=VALUES(price_1year),
    cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    (UUID(), 'win-black',    'dedicated-windows', 'Black',    'Servidor Windows dedicado inicial',  null,           false, true, 10,
     299000, 209300, 'Contratar'),
    (UUID(), 'win-sapphire', 'dedicated-windows', 'Sapphire', 'Para empresas e sistemas críticos',  'MAIS POPULAR', true,  true, 20,
     549000, 384300, 'Contratar'),
    (UUID(), 'win-diamond',  'dedicated-windows', 'Diamond',  'Alta performance e disponibilidade', 'MELHOR VALOR', false, true, 30,
     999000, 699300, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_1year=VALUES(price_1year),
    cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, price_2years, price_3years, cta_label)
  VALUES
    (UUID(), 'ia-starter',  'website-builder', 'IA Starter',  'Para landing pages e portfólios', null,           false, true, 10,
     14900, 12600, 10400,  8200,  6700, 'Começar'),
    (UUID(), 'ia-pro',      'website-builder', 'IA Pro',      'Para pequenos negócios',           'MAIS POPULAR', true,  true, 20,
     29900, 25400, 20900, 16400, 13400, 'Começar'),
    (UUID(), 'ia-business', 'website-builder', 'IA Business', 'Para empresas e lojas online',     'MELHOR VALOR', false, true, 30,
     59900, 50900, 41900, 32900, 26900, 'Começar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_6months=VALUES(price_6months),
    price_1year=VALUES(price_1year), price_2years=VALUES(price_2years),
    price_3years=VALUES(price_3years), cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    (UUID(), 'ssl-dv',       'ssl', 'SSL Domain Validated',       'Certificado SSL básico DV',      null,           false, true, 10,
      4900,  3430, 'Contratar'),
    (UUID(), 'ssl-ov',       'ssl', 'SSL Organization Validated', 'Validação de organização OV',    'MAIS POPULAR', true,  true, 20,
      9900,  6930, 'Contratar'),
    (UUID(), 'ssl-ev',       'ssl', 'SSL Extended Validation',    'Máxima confiança EV',            'MELHOR VALOR', false, true, 30,
     19900, 13930, 'Contratar'),
    (UUID(), 'ssl-wildcard', 'ssl', 'SSL Wildcard',               'Todos os subdomínios cobertos',  null,           false, true, 40,
     29900, 20930, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_1year=VALUES(price_1year),
    cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_6months, price_1year, cta_label)
  VALUES
    (UUID(), 'backup-100',  'backup', 'Backup 100 GB',  'Para sites e pequenos projectos', null,           false, true, 10,
      4900,  4200,  3430, 'Contratar'),
    (UUID(), 'backup-500',  'backup', 'Backup 500 GB',  'Para empresas e e-commerce',      'MAIS POPULAR', true,  true, 20,
      9900,  8400,  6930, 'Contratar'),
    (UUID(), 'backup-2000', 'backup', 'Backup 2 TB',    'Para grandes infra-estruturas',   'MELHOR VALOR', false, true, 30,
     19900, 16900, 13930, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_6months=VALUES(price_6months),
    price_1year=VALUES(price_1year), cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);

INSERT INTO products
  (id, slug, category, name, description, badge, popular, active, position,
     price_monthly, price_1year, cta_label)
  VALUES
    (UUID(), 'protection-basic',   'protection', 'Protecção Basic',    'Firewall e monitorização básica',     null,           false, true, 10,
      7900,  5530, 'Contratar'),
    (UUID(), 'protection-pro',     'protection', 'Protecção Pro',      'Anti-malware + WAF avançado',         'MAIS POPULAR', true,  true, 20,
     14900, 10430, 'Contratar'),
    (UUID(), 'protection-premium', 'protection', 'Protecção Premium',  'Protecção total DDoS + CDN',          'MELHOR VALOR', false, true, 30,
     29900, 20930, 'Contratar')
  ON DUPLICATE KEY UPDATE
    price_monthly=VALUES(price_monthly), price_1year=VALUES(price_1year),
    cta_label=VALUES(cta_label), updated_at=CURRENT_TIMESTAMP(6);
