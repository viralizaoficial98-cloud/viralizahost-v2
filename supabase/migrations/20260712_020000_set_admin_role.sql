-- ============================================================
-- ViralizaHost — Promover utilizador a administrador
-- Executar no Supabase Dashboard → SQL Editor
-- ============================================================

-- PASSO 1: Ver todos os utilizadores e os seus roles actuais
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  p.created_at
FROM viralizahost.profiles p
ORDER BY p.created_at;

-- PASSO 2: Promover cizesa@gmail.com a admin
-- (se o perfil existir)
UPDATE viralizahost.profiles
SET role = 'admin', updated_at = now()
WHERE email = 'cizesa@gmail.com';

-- PASSO 3: Se não existir perfil, criá-lo a partir de auth.users
INSERT INTO viralizahost.profiles (id, email, full_name, role, country, currency, is_active, email_verified)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email),
  'admin',
  'AO',
  'USD',
  true,
  true
FROM auth.users
WHERE email = 'cizesa@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin', updated_at = now();

-- PASSO 4: Confirmar resultado
SELECT id, email, role, is_active, created_at
FROM viralizahost.profiles
WHERE email = 'cizesa@gmail.com';
