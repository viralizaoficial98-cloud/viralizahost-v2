-- Stub mínimo dos schemas auth/storage do Supabase para reconstruir a base a partir de
-- supabase/migrations num PostgreSQL local (ensaio). Não usar em produção.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension if not exists "uuid-ossp"; create extension if not exists pgcrypto;
create table auth.users (id uuid primary key default gen_random_uuid(), instance_id uuid, aud text, role text, email text unique,
 encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}',
 created_at timestamptz default now(), updated_at timestamptz default now(), last_sign_in_at timestamptz, confirmation_token text,
 recovery_token text, email_change text, email_change_token_new text, is_super_admin boolean, phone text, banned_until timestamptz, deleted_at timestamptz, is_sso_user boolean default false, is_anonymous boolean default false);
create table auth.identities (id uuid primary key default gen_random_uuid(), provider_id text, user_id uuid references auth.users on delete cascade, identity_data jsonb, provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz, path_tokens text[] generated always as (string_to_array(name,'/')) stored);
create function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
create function storage.filename(name text) returns text language sql as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
create function storage.extension(name text) returns text language sql as $$ select reverse(split_part(reverse(name),'.',1)) $$;
alter table storage.objects enable row level security;
