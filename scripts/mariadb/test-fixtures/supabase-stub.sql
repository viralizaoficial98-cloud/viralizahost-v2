-- Simula os schemas/funções do Supabase (auth, storage, papéis) num PostgreSQL local para aplicar supabase/migrations/*.sql.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension if not exists pgcrypto;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, encrypted_password text, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now(), last_sign_in_at timestamptz, instance_id uuid, aud text, role text, confirmation_token text, recovery_token text, email_change_token_new text, email_change text, is_super_admin bool);
create table auth.identities (id text, user_id uuid, identity_data jsonb, provider text, provider_id text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true),'')::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table storage.buckets (id text primary key, name text, public bool default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now(), owner uuid);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create function storage.filename(name text) returns text language sql as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
create function storage.extension(name text) returns text language sql as $$ select split_part(name,'.',-1) $$;
