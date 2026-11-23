-- Apresentação das extensões de domínio (cartões da página inicial). Os PREÇOS continuam só em
-- domain_prices (fonte única); aqui fica apenas o que é comercial/visual: descrição, destaque,
-- ordem, etiqueta e realce. Idempotente: não altera dados existentes nem sobrepõe edições.
CREATE TABLE IF NOT EXISTS domain_extensions (
  extension VARCHAR(32) NOT NULL PRIMARY KEY,
  description VARCHAR(80) NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  featured_position INT NOT NULL DEFAULT 0,
  badge ENUM('none','popular','promo','new','custom') NOT NULL DEFAULT 'none',
  badge_text VARCHAR(20) NULL,
  highlight TINYINT(1) NOT NULL DEFAULT 0,
  updated_by CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY domain_extensions_featured (featured, featured_position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Primeira publicação: preserva os cartões que o site mostra hoje
--   * as 6 primeiras extensões à venda (registo activo com preço), pela ordem fixa usada até agora;
--   * as descrições que estavam no componente; .ao e .com com «Popular» e realce.
-- INSERT IGNORE: correr de novo não apaga nem altera o que o administrador já editou.
INSERT IGNORE INTO domain_extensions (extension, description, featured, featured_position, badge, highlight)
SELECT x.extension,
  CASE x.extension
    WHEN '.ao' THEN 'Angola oficial' WHEN '.co.ao' THEN 'Empresas em Angola' WHEN '.com' THEN 'O mais popular'
    WHEN '.net' THEN 'Tecnologia e redes' WHEN '.org' THEN 'Organizações' WHEN '.it.ao' THEN 'Tecnologia em Angola'
    WHEN '.io' THEN 'Startups e tecnologia' WHEN '.online' THEN 'Presença online' WHEN '.shop' THEN 'Lojas' WHEN '.store' THEN 'Lojas'
    ELSE NULL END,
  IF(x.sellable = 1 AND x.rn <= 6, 1, 0),
  x.rn,
  IF(x.extension IN ('.ao', '.com'), 'popular', 'none'),
  IF(x.extension IN ('.ao', '.com'), 1, 0)
FROM (
  SELECT e.extension, e.sellable,
    ROW_NUMBER() OVER (ORDER BY e.sellable DESC,
      IF(FIELD(e.extension, '.ao', '.co.ao', '.com', '.net', '.org', '.it.ao', '.org.ao', '.edu.ao', '.online', '.shop', '.store', '.xyz', '.io', '.tech', '.ai') = 0, 99,
         FIELD(e.extension, '.ao', '.co.ao', '.com', '.net', '.org', '.it.ao', '.org.ao', '.edu.ao', '.online', '.shop', '.store', '.xyz', '.io', '.tech', '.ai')),
      e.extension) AS rn
  FROM (
    SELECT extension, MAX(operation = 'register' AND status = 'active' AND price IS NOT NULL) AS sellable
    FROM domain_prices WHERE years = 1 GROUP BY extension
  ) e
) x;
