-- Empresa → Sobre nós (/sobre), Parceria (/parcerias) e Suporte (/suporte): hero editável em «Banners de páginas».
-- Cria uma entrada por página com os textos e botões que a página já mostra. NUNCA altera entradas existentes
-- (ON DUPLICATE KEY sem efeito): os dados guardados no painel preservam-se. Sem imagem: o administrador carrega-a.
-- Botão principal vazio = sem botão (Sobre nós não tem botões). Nenhuma outra tabela é alterada. Idempotente.
INSERT INTO banner_pages
  (id, page_slug, page_name, breadcrumb, breadcrumb_parent, breadcrumb_parent_href, tag, title, subtitle, bg_image, bg_color, highlights,
   button_primary_text, button_primary_link, button_secondary_text, button_secondary_link, price_text, show_guarantee, is_active)
VALUES
  (UUID(), 'sobre', 'Sobre nós', 'Sobre nós', NULL, NULL, 'Empresa', 'Sobre a ViralizaHost',
   'Alojamento de sites, domínios, e-mail corporativo e servidores para empresas e profissionais — com preços em kwanzas e suporte em português.',
   NULL, '#090909', JSON_ARRAY(), '', '', NULL, NULL, NULL, false, true),
  (UUID(), 'parcerias', 'Parceria', 'Parceria', NULL, NULL, 'Parcerias', 'Torne-se nosso Parceiro',
   'Ganhe comissões recorrentes ao indicar a ViralizaHost para os seus clientes.',
   NULL, '#090909', JSON_ARRAY(), 'Tornar-me Parceiro', '/register?ref=parceiro', 'Falar com Suporte', '/suporte/tickets', NULL, false, true),
  (UUID(), 'suporte', 'Suporte', 'Suporte', NULL, NULL, 'Suporte 24/7', 'Central de Suporte',
   'Estamos disponíveis 24 horas por dia, 7 dias por semana para ajudar o seu negócio.',
   NULL, '#090909', JSON_ARRAY(), 'Abrir Ticket', '/suporte/tickets', 'Base de Conhecimento', '/suporte/base-conhecimento', NULL, false, true)
ON DUPLICATE KEY UPDATE page_slug = page_slug;
