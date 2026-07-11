-- ============================================================
-- Supabase Storage: create site-banners bucket
-- Bucket is public so uploaded images are accessible via
-- getPublicUrl() without signed URLs.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-banners',
  'site-banners',
  true,
  10485760,  -- 10 MB
  ARRAY['image/png','image/jpeg','image/jpg','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/webp'];

-- Allow authenticated admin users to upload
CREATE POLICY IF NOT EXISTS "site_banners_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-banners');

-- Allow authenticated admin users to update/replace
CREATE POLICY IF NOT EXISTS "site_banners_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-banners');

-- Allow authenticated admin users to delete
CREATE POLICY IF NOT EXISTS "site_banners_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-banners');

-- Public read access (bucket is public, but explicit policy for clarity)
CREATE POLICY IF NOT EXISTS "site_banners_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'site-banners');
