-- ============================================================
-- HOTFIX DE SEGURANÇA PARA O SUPABASE ATUAL (independente da migração para MySQL)
--
-- Problema: o papel `authenticated` tem UPDATE em todas as colunas de viralizahost.profiles
-- e a política RLS permite a cada cliente atualizar a própria linha. Com a chave pública
-- (anon key) do site, qualquer cliente autenticado pode executar no browser:
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', <o seu id>)
-- e passar a administrador.
--
-- Correção: os clientes só podem alterar os campos editáveis na página Definições.
-- A aplicação altera os restantes campos com a service role (rotas /api/admin/*), que não é afetada.
--
-- Executar no Supabase → SQL Editor. Idempotente.
-- ============================================================
REVOKE UPDATE ON TABLE viralizahost.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, country, currency, avatar_url, updated_at)
  ON TABLE viralizahost.profiles TO authenticated;

-- Os clientes também não podem criar perfis com outro papel nem apagar perfis:
REVOKE INSERT, DELETE ON TABLE viralizahost.profiles FROM anon;

-- Verificação (deve listar só as 6 colunas acima para authenticated/UPDATE):
SELECT column_name FROM information_schema.column_privileges
WHERE table_schema = 'viralizahost' AND table_name = 'profiles'
  AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
ORDER BY column_name;
