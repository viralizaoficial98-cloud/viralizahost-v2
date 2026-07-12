-- ============================================================
-- ViralizaHost — Tabela banner_pages
-- Conteúdo dinâmico dos banners hero de cada página de serviço
-- ============================================================

CREATE TABLE IF NOT EXISTS viralizahost.banner_pages (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_slug               TEXT NOT NULL UNIQUE,
  page_name               TEXT NOT NULL,

  -- breadcrumb
  breadcrumb              TEXT,
  breadcrumb_parent       TEXT,
  breadcrumb_parent_href  TEXT,

  -- conteúdo principal
  tag                     TEXT,
  title                   TEXT NOT NULL DEFAULT '',
  subtitle                TEXT NOT NULL DEFAULT '',

  -- imagem de fundo
  bg_image                TEXT,
  bg_color                TEXT NOT NULL DEFAULT '#080d1a',

  -- highlights / benefícios (máx. 6)
  highlights              TEXT[] NOT NULL DEFAULT '{}',

  -- botões
  button_primary_text     TEXT NOT NULL DEFAULT 'Ver Planos',
  button_primary_link     TEXT NOT NULL DEFAULT '#planos',
  button_secondary_text   TEXT,
  button_secondary_link   TEXT,

  -- rodapé do hero
  price_text              TEXT,
  show_guarantee          BOOLEAN NOT NULL DEFAULT true,

  -- overlay sobre a imagem (0.0 – 1.0); 0 = usa gradiente padrão do componente
  overlay_opacity         NUMERIC(3,2) NOT NULL DEFAULT 0.0 CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),

  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banner_pages_slug ON viralizahost.banner_pages (page_slug);
CREATE INDEX IF NOT EXISTS idx_banner_pages_active ON viralizahost.banner_pages (is_active);

-- RLS
ALTER TABLE viralizahost.banner_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read banner_pages" ON viralizahost.banner_pages;
CREATE POLICY "public read banner_pages"
  ON viralizahost.banner_pages FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "service_role all banner_pages" ON viralizahost.banner_pages;
CREATE POLICY "service_role all banner_pages"
  ON viralizahost.banner_pages FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Permissões
GRANT SELECT ON viralizahost.banner_pages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON viralizahost.banner_pages TO service_role;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION viralizahost.set_banner_pages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_banner_pages_updated_at ON viralizahost.banner_pages;
CREATE TRIGGER trg_banner_pages_updated_at
  BEFORE UPDATE ON viralizahost.banner_pages
  FOR EACH ROW EXECUTE FUNCTION viralizahost.set_banner_pages_updated_at();

-- ============================================================
-- Seed: banners actuais (hardcoded → DB)
-- ============================================================

INSERT INTO viralizahost.banner_pages
  (page_slug, page_name, breadcrumb, breadcrumb_parent, breadcrumb_parent_href,
   tag, title, subtitle, bg_image, bg_color, highlights,
   button_primary_text, button_primary_link, button_secondary_text, button_secondary_link,
   price_text, show_guarantee)
VALUES
  (
    'hospedagem-de-sites', 'Hospedagem de Sites',
    'Hospedagem de Sites', NULL, NULL,
    'Hospedagem Premium',
    'Hospedagem de Sites Premium para o seu Negócio',
    'Performance ultrarrápida com LiteSpeed, NVMe SSD, SSL grátis, cPanel e suporte técnico especializado 24/7.',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80&auto=format&fit=crop',
    '#080d1a',
    ARRAY['LiteSpeed Enterprise','NVMe SSD Gen4','Uptime 99.9%','cPanel Incluído'],
    'Ver Planos', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 19.900/mês', true
  ),
  (
    'hospedagem-wordpress', 'Hospedagem WordPress',
    'Hospedagem WordPress', NULL, NULL,
    'WordPress Optimizado',
    'Hospedagem WordPress optimizada para máxima performance',
    'WordPress pré-instalado, LiteSpeed, SSL grátis, CDN global e criador de sites com IA incluído em todos os planos.',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=80&auto=format&fit=crop',
    '#080d1a',
    ARRAY['WordPress Pré-instalado','LiteSpeed Cache','CDN Global','SSL Grátis'],
    'Ver Planos WordPress', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 24.900/mês', true
  ),
  (
    'revenda-de-hospedagem', 'Revenda de Hospedagem',
    'Revenda de Hospedagem', NULL, NULL,
    'Revenda WHM/cPanel',
    'Crie a sua própria empresa de hospedagem com a ViralizaHost',
    'Venda hospedagem para os seus clientes usando a nossa infraestrutura premium. WHM, cPanel, DNS privado e marca própria.',
    'https://images.unsplash.com/photo-1591808216268-1e7c1b31b9d2?w=1920&q=80&auto=format&fit=crop',
    '#0a0a14',
    ARRAY['WHM/cPanel Incluído','DNS Whitelabel','SSL por Conta','Suporte Revendedor'],
    'Ver Planos de Revenda', '#planos', 'Falar com Comercial', '/tickets',
    'A partir de Kz 59.900/mês', true
  ),
  (
    'servidor-vps', 'Servidor VPS',
    'Servidor VPS', NULL, NULL,
    'Servidores Cloud VPS',
    'Servidor VPS de alta performance para projectos exigentes',
    'Infraestrutura segura, rápida e escalável para sistemas, sites, automações e aplicações. RAM DDR5 e NVMe SSD incluídos.',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80&auto=format&fit=crop',
    '#060b14',
    ARRAY['RAM DDR5','NVMe SSD','IP Dedicado','Root Access'],
    'Ver Planos VPS', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 45.000/mês', true
  ),
  (
    'vps-n8n', 'VPS n8n Auto-hospedado',
    'VPS n8n Auto-hospedado', 'Servidor VPS', '/servidor-vps',
    'Automação com n8n',
    'Crie e rode as suas automações em minutos',
    'Servidor VPS com n8n preparado para automações, integrações com WhatsApp, Google Sheets, CRMs e muito mais. Fluxos ilimitados.',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80&auto=format&fit=crop',
    '#060b14',
    ARRAY['n8n Pré-instalado','Fluxos Ilimitados','WhatsApp Integrado','Root Access'],
    'Ver Planos n8n', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 55.000/mês', true
  ),
  (
    'vps-openclaw', 'VPS OpenClaw',
    'VPS OpenClaw', 'Servidor VPS', '/servidor-vps',
    'Agentes de IA Autónomos',
    'Coloque um agente de IA a agir por si',
    'Mais autonomia, mais controlo e menos tarefas manuais no seu dia a dia. OpenClaw pré-instalado e pronto para começar.',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1920&q=80&auto=format&fit=crop',
    '#06060f',
    ARRAY['Agentes Autónomos','Automação Sem Código','Cofre Seguro','Integrações Ilimitadas'],
    'Ver Planos OpenClaw', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 65.000/mês', true
  ),
  (
    'vps-evolution-api', 'VPS Evolution API',
    'VPS Evolution API', 'Servidor VPS', '/servidor-vps',
    'WhatsApp Business API',
    'Automatize, integre e escale o seu WhatsApp com Evolution API',
    'Servidor VPS preparado para WhatsApp Business, chatbots, integrações e automações. Múltiplos números, webhooks e painel completo.',
    'https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=1920&q=80&auto=format&fit=crop',
    '#062006',
    ARRAY['Evolution API Instalada','Múltiplos Números','Webhooks Avançados','Integrações CRM'],
    'Ver Planos Evolution API', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 69.000/mês', true
  ),
  (
    'vps-viraliza-ai-cloud', 'Viraliza AI Cloud',
    'Viraliza AI Cloud', 'Servidor VPS', '/servidor-vps',
    'IA & Automação Empresarial',
    'Agentes de IA prontos para automatizar o seu negócio',
    'Configure assistentes inteligentes, integrações e automações sem complicação. WhatsApp, Gmail, Slack, Trello e muito mais.',
    'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=80&auto=format&fit=crop',
    '#04060f',
    ARRAY['Agentes de IA','WhatsApp + Telegram','Gmail + Google Agenda','Integrações Empresariais'],
    'Ver Planos AI Cloud', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 89.000/mês', true
  ),
  (
    'servidor-dedicado', 'Servidor Dedicado Linux',
    'Servidor Dedicado Linux', NULL, NULL,
    'Infraestrutura Dedicada',
    'Infraestrutura dedicada para alta performance',
    'Servidores Linux dedicados para projectos robustos, sistemas críticos e alta demanda. Recursos exclusivos, root access e SLA garantido.',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1920&q=80&auto=format&fit=crop',
    '#060810',
    ARRAY['vCPU Exclusivas','RAM DDR5','NVMe SSD','Root Access Total'],
    'Ver Planos Dedicado', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 249.000/mês', true
  ),
  (
    'servidor-dedicado-windows', 'Servidor Dedicado Windows',
    'Servidor Dedicado Windows', NULL, NULL,
    'Windows Server + Plesk',
    'Máxima performance para projectos em ASP.NET e MS SQL',
    'Servidor dedicado Windows com Plesk, ASP.NET, Microsoft SQL Server, Remote Desktop e alta estabilidade para sistemas críticos.',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80&auto=format&fit=crop',
    '#060810',
    ARRAY['Windows Server 2022','Plesk Incluído','MS SQL Server','Remote Desktop'],
    'Ver Planos Windows', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 299.000/mês', true
  ),
  (
    'criador-de-sites', 'Criador de Sites com IA',
    'Criador de Sites com IA', NULL, NULL,
    'Com Inteligência Artificial',
    'Crie o seu site profissional em minutos com IA',
    'Descreve o teu negócio. A inteligência artificial cria o site completo, com textos, imagens e design. Sem código, sem design.',
    'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1920&q=80&auto=format&fit=crop',
    '#05080f',
    ARRAY['Site pronto em minutos','Sem código','Hospedagem incluída','SEO automático'],
    'Criar Meu Site com IA', '#planos', 'Ver Demonstração', '/tickets',
    'A partir de Kz 14.900/mês', true
  ),
  (
    'construtor-wordpress', 'Construtor WordPress',
    'Construtor WordPress', NULL, NULL,
    'WordPress + Builder Visual',
    'Crie sites WordPress incríveis com builder visual',
    'WordPress optimizado com builder drag-and-drop, plugins premium, SSL grátis e hospedagem de alta performance.',
    'https://images.unsplash.com/photo-1580584126903-c17d41830450?w=1920&q=80&auto=format&fit=crop',
    '#0a0c14',
    ARRAY['Builder Visual','Plugins Premium','WordPress Pré-instalado','CDN Global'],
    'Ver Planos', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 29.900/mês', true
  ),
  (
    'email-corporativo', 'E-mail Corporativo',
    'E-mail Corporativo', NULL, NULL,
    'E-mail Profissional',
    'E-mail Corporativo com o seu domínio',
    'Comunicação empresarial segura com domínio personalizado, antispam avançado e alta disponibilidade. SPF, DKIM e DMARC incluídos.',
    'https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=1920&q=80&auto=format&fit=crop',
    '#090909',
    ARRAY['Domínio Personalizado','AntiSpam Avançado','SPF/DKIM/DMARC','Backup Diário'],
    'Ver Planos de E-mail', '#planos', 'Falar com Especialista', '/tickets',
    'A partir de Kz 6.800/mês', true
  ),
  (
    'dominios', 'Domínios',
    'Domínios', NULL, NULL,
    'Registe o seu domínio',
    'Registe a sua identidade online com o domínio perfeito',
    'Pesquise e registe o domínio perfeito para a sua marca. .ao, .com, .net, .org e muito mais, com DNS ultrarrápido e SSL grátis.',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1920&q=80&auto=format&fit=crop',
    '#06080f',
    ARRAY['Registo .ao Oficial','DNS Ultrarrápido','SSL Grátis','WHOIS Protegido'],
    'Pesquisar Domínio', '/dominios/pesquisar', 'Ver Preços', '/dominios/precos',
    NULL, true
  ),
  (
    'certificado-ssl', 'Certificado SSL',
    'Certificado SSL', NULL, NULL,
    'HTTPS Grátis',
    'Proteja o seu site com SSL e ganhe mais confiança',
    'Certificado SSL gratuito em todos os planos. Activação imediata, renovação automática e criptografia 256-bit. SEO melhorado.',
    'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=1920&q=80&auto=format&fit=crop',
    '#04070f',
    ARRAY['Criptografia 256-bit','Ativação Imediata','Renovação Automática','Wildcard Suportado'],
    'Ativar SSL Grátis', '/hospedagem-de-sites', 'Saber Mais', '/suporte/faq',
    NULL, true
  ),
  (
    'backup-cloud', 'Backup Cloud',
    'Backup Cloud', NULL, NULL,
    'Backup Automático',
    'Proteja os seus dados com Backup Cloud automático',
    'Cópias de segurança diárias automáticas encriptadas em múltiplas localizações. Restauro em minutos com um clique.',
    'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1920&q=80&auto=format&fit=crop',
    '#04060a',
    ARRAY['Backup Diário','Encriptação AES-256','Restauro Rápido','Armazenamento Redundante'],
    'Activar Backup', '/hospedagem-de-sites', 'Saber Mais', '/suporte/faq',
    NULL, true
  ),
  (
    'protecao-de-site', 'Protecção de Site',
    'Protecção de Site', NULL, NULL,
    'Segurança Web',
    'Proteja o seu site contra ameaças e ataques',
    'Firewall avançada, protecção contra malware, DDoS e ataques de força bruta. Monitorização 24/7 e relatórios em tempo real.',
    'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=1920&q=80&auto=format&fit=crop',
    '#04050a',
    ARRAY['Firewall Avançada','Protecção DDoS','Anti-Malware','Monitorização 24/7'],
    'Proteger o Meu Site', '/hospedagem-de-sites', 'Saber Mais', '/suporte/faq',
    NULL, true
  ),
  (
    'cdn-premium', 'CDN Premium',
    'CDN Premium', NULL, NULL,
    'Rede de Entrega de Conteúdo',
    'Acelere o seu site com CDN Premium global',
    'Distribua o conteúdo do seu site por servidores em todo o mundo para reduzir a latência e melhorar a experiência do utilizador.',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&q=80&auto=format&fit=crop',
    '#04060f',
    ARRAY['CDN Global','Latência Mínima','Cache Inteligente','Suporte 24/7'],
    'Activar CDN', '/hospedagem-de-sites', 'Saber Mais', '/suporte/faq',
    NULL, true
  )
ON CONFLICT (page_slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
