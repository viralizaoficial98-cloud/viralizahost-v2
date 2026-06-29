-- ============================================================
-- ViralizaHost — Criar utilizador admin inicial
-- Executar após criar conta no Supabase Auth
-- ============================================================

-- OPÇÃO 1: Promover utilizador existente a admin
-- Substitui 'teu@email.com' pelo email da conta que quiseres tornar admin
UPDATE viralizahost.profiles
SET role = 'admin'
WHERE email = 'teu@email.com';

-- Verificar se ficou admin
SELECT id, email, role, created_at
FROM viralizahost.profiles
WHERE role = 'admin';

-- ============================================================
-- OPÇÃO 2: Criar admin diretamente via SQL (sem passar pelo signup)
-- Só funciona se já tens o UUID do utilizador em auth.users
-- ============================================================

-- INSERT INTO viralizahost.profiles (id, email, full_name, role, country, currency, is_active, email_verified)
-- VALUES (
--   'uuid-do-utilizador-aqui',  -- copiar de auth.users
--   'admin@viralizahost.com',
--   'Administrador',
--   'admin',
--   'AO',
--   'USD',
--   true,
--   true
-- )
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';
