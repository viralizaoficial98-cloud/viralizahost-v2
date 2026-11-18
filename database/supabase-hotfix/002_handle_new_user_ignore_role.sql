-- ============================================================
-- HOTFIX DE SEGURANÇA PARA O SUPABASE ATUAL (independente da migração para MySQL)
--
-- Problema: o trigger viralizahost.handle_new_user() cria o perfil com o papel lido de
-- raw_user_meta_data->>'role'. Esses metadados são enviados pelo próprio utilizador no registo
-- (supabase.auth.signUp({ options: { data: { role: ... } } })), por isso qualquer pessoa pode
-- registar-se diretamente na API com role = 'admin'.
--
-- Correção: os perfis novos são sempre 'client'. A promoção a admin/revendedor continua a ser feita
-- no painel (service role).
-- Executar no Supabase → SQL Editor. Idempotente.
-- ============================================================
CREATE OR REPLACE FUNCTION viralizahost.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO viralizahost.profiles (id, email, full_name, phone, country, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'country', 'AO'),
    'client'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, viralizahost.profiles.full_name),
    updated_at = now();

  INSERT INTO viralizahost.clients (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Perfis criados com papel diferente de 'client' (rever manualmente):
SELECT p.id, p.email, p.role, p.created_at
FROM viralizahost.profiles p
WHERE p.role <> 'client'
ORDER BY p.created_at DESC;
