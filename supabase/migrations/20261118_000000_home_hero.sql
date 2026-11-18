-- ============================================================
-- ViralizaHost — Topo da página inicial (carrossel ou vídeo)
--
-- 1. Tabela viralizahost.site_home_hero (uma única linha, id = 1)
-- 2. Bucket público site-videos para o MP4 enviado pelo admin
--
-- Idempotente — pode ser executada mais de uma vez.
-- Executar no Supabase SQL Editor ANTES de publicar o código.
-- ============================================================

-- ── 1. Tabela de configuração ──────────────────────────────
CREATE TABLE IF NOT EXISTS viralizahost.site_home_hero (
  id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode                TEXT NOT NULL DEFAULT 'carousel' CHECK (mode IN ('carousel', 'video')),

  -- URL público do vídeo (Supabase Storage, caminho /public ou HTTPS externo)
  video_url           TEXT,
  -- Caminho do objeto no bucket site-videos (NULL quando o URL é externo)
  video_storage_path  TEXT,
  video_file_name     TEXT,
  video_size_bytes    BIGINT,

  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID,

  -- Não é possível ativar o modo vídeo sem vídeo configurado
  CONSTRAINT site_home_hero_video_required
    CHECK (mode = 'carousel' OR (video_url IS NOT NULL AND length(trim(video_url)) > 0))
);

-- Linha única, começa em modo carrossel (comportamento atual do site)
INSERT INTO viralizahost.site_home_hero (id, mode)
VALUES (1, 'carousel')
ON CONFLICT (id) DO NOTHING;

-- updated_at automático
CREATE OR REPLACE FUNCTION viralizahost.set_site_home_hero_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_site_home_hero_updated_at ON viralizahost.site_home_hero;
CREATE TRIGGER trg_site_home_hero_updated_at
  BEFORE UPDATE ON viralizahost.site_home_hero
  FOR EACH ROW EXECUTE FUNCTION viralizahost.set_site_home_hero_updated_at();

-- Permissões: leitura pública (a página inicial lê com a anon key);
-- escrita só pelo service_role (rotas /api/admin/home-hero).
GRANT USAGE ON SCHEMA viralizahost TO anon, authenticated, service_role;
GRANT SELECT                         ON TABLE viralizahost.site_home_hero TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE viralizahost.site_home_hero TO service_role;

ALTER TABLE viralizahost.site_home_hero ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "home_hero_public_read" ON viralizahost.site_home_hero;
CREATE POLICY "home_hero_public_read"
  ON viralizahost.site_home_hero FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "home_hero_service_role_all" ON viralizahost.site_home_hero;
CREATE POLICY "home_hero_service_role_all"
  ON viralizahost.site_home_hero FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 2. Bucket de vídeos ────────────────────────────────────
-- Público para leitura. O upload é feito pelo browser do admin com um
-- URL assinado emitido por /api/admin/home-hero/upload-url (service role),
-- por isso não são necessárias políticas de INSERT para authenticated.
-- Limite: 100 MB (deve coincidir com HOME_HERO_VIDEO_MAX_BYTES em
-- src/lib/home-hero.ts). O limite global do projeto Supabase também se aplica
-- (no plano Free é 50 MB por ficheiro).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-videos', 'site-videos', true, 104857600, ARRAY['video/mp4'])
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 104857600,
  allowed_mime_types = ARRAY['video/mp4'];

DROP POLICY IF EXISTS "site_videos_public_read" ON storage.objects;
CREATE POLICY "site_videos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-videos');
