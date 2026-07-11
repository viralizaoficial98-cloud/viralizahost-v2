-- ============================================================
-- Fix banner image paths to use files that exist in /public
-- Banner images are rendered as imageOnly (no text overlay);
-- the images contain their own baked-in text.
-- ============================================================

-- Banner 1 (position 1): AI/Automação — video slide, no bg_image
UPDATE viralizahost.site_banners
SET
  bg_image      = NULL,
  bg_color      = '#000000',
  accent_color  = '#F5B700',
  tag           = 'Inteligência Artificial',
  title         = 'Automação & IA',
  subtitle      = 'Soluções de inteligência artificial para automatizar e acelerar o seu negócio.',
  cta_text      = 'Começar Agora',
  cta_href      = '/checkout',
  cta_secondary_text = 'Saiba Mais',
  cta_secondary_href = '#planos',
  features      = ARRAY['IA Avançada', 'Automação 24/7', 'Integração Completa']
WHERE position = 1;

-- Banner 2 (position 2): E-mail Corporativo — /viraliza-email-banner.png exists
UPDATE viralizahost.site_banners
SET
  bg_image      = '/viraliza-email-banner.png',
  bg_color      = '#000000',
  accent_color  = '#8b5cf6',
  tag           = 'Email Profissional',
  title         = 'E-mail Corporativo',
  subtitle      = 'Tenha um email com o nome da sua empresa. Confiável, seguro e integrado com as melhores ferramentas do mercado.',
  cta_text      = 'Criar Email',
  cta_href      = '/checkout',
  cta_secondary_text = 'Ver Planos',
  cta_secondary_href = '#email-plans',
  features      = ARRAY['Anti-spam Avançado', 'Backup Diário', 'Webmail Incluído']
WHERE position = 2;

-- Banner 3 (position 3): Domínios — /servidores_banner.png exists (/viraliza-domain-banner.png does not)
UPDATE viralizahost.site_banners
SET
  bg_image      = '/servidores_banner.png',
  bg_color      = '#000000',
  accent_color  = '#10b981',
  tag           = 'Domínios',
  title         = 'A Sua Identidade Online',
  subtitle      = 'Registe o domínio perfeito para o seu negócio. Disponível em .ao, .com, .net e muitas outras extensões.',
  cta_text      = 'Registar Domínio',
  cta_href      = '/checkout',
  cta_secondary_text = 'Verificar Disponibilidade',
  cta_secondary_href = '#dominios',
  features      = ARRAY['.ao Disponível', '.com Disponível', 'Transferência Grátis']
WHERE position = 3;
