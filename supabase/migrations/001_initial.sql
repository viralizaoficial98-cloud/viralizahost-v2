create extension if not exists "uuid-ossp";

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  phone text,
  role text not null default 'client' check (role in ('client', 'admin', 'reseller')),
  currency text not null default 'USD' check (currency in ('AKZ', 'BRL', 'USD')),
  country text not null default 'AO',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.plans (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null check (type in ('shared', 'vps', 'dedicated', 'reseller')),
  description text,
  features jsonb default '[]',
  price_akz numeric(10,2) not null default 0,
  price_brl numeric(10,2) not null default 0,
  price_usd numeric(10,2) not null default 0,
  disk_gb integer not null default 0,
  bandwidth_gb integer not null default 0,
  email_accounts integer not null default 0,
  domains integer not null default 1,
  subdomains integer not null default 10,
  databases integer not null default 5,
  is_popular boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.domains (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  name text not null,
  extension text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'pending', 'transferred')),
  registered_at timestamptz default now(),
  expires_at timestamptz not null,
  auto_renew boolean default true,
  nameservers jsonb default '[]',
  created_at timestamptz default now()
);

create table public.hostings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  plan_id uuid references public.plans not null,
  domain text not null,
  status text not null default 'pending' check (status in ('active', 'suspended', 'terminated', 'pending')),
  cpanel_username text,
  server_ip text,
  disk_used_gb numeric(10,3) default 0,
  bandwidth_used_gb numeric(10,3) default 0,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

create table public.email_accounts (
  id uuid default uuid_generate_v4() primary key,
  hosting_id uuid references public.hostings on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  email text not null unique,
  quota_mb integer default 1024,
  used_mb numeric(10,3) default 0,
  status text default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz default now()
);

create table public.tickets (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  department text not null default 'technical',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.ticket_messages (
  id uuid default uuid_generate_v4() primary key,
  ticket_id uuid references public.tickets on delete cascade not null,
  user_id uuid references public.profiles not null,
  message text not null,
  is_staff boolean default false,
  created_at timestamptz default now()
);

create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  amount numeric(10,2) not null,
  currency text not null default 'USD' check (currency in ('AKZ', 'BRL', 'USD')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_method text,
  due_date timestamptz not null,
  paid_at timestamptz,
  items jsonb default '[]',
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.domains enable row level security;
alter table public.hostings enable row level security;
alter table public.email_accounts enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.invoices enable row level security;
alter table public.plans enable row level security;

create policy "plans_public_read" on public.plans for select using (true);
create policy "profiles_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "domains_own" on public.domains for select using (auth.uid() = user_id);
create policy "hostings_own" on public.hostings for select using (auth.uid() = user_id);
create policy "emails_own" on public.email_accounts for select using (auth.uid() = user_id);
create policy "tickets_own" on public.tickets for select using (auth.uid() = user_id);
create policy "tickets_insert" on public.tickets for insert with check (auth.uid() = user_id);
create policy "invoices_own" on public.invoices for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, currency, country)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'client',
    coalesce(new.raw_user_meta_data->>'currency', 'USD'),
    coalesce(new.raw_user_meta_data->>'country', 'AO')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.plans (name, type, description, features, price_akz, price_brl, price_usd, disk_gb, bandwidth_gb, email_accounts, domains, subdomains, databases, is_popular) values
('Starter', 'shared', 'Perfeito para iniciar', '["1 Site","10 GB SSD","100 GB Banda","5 Emails","SSL Grátis","cPanel"]', 4500, 19.90, 3.99, 10, 100, 5, 1, 5, 3, false),
('Business', 'shared', 'Ideal para PMEs', '["5 Sites","50 GB SSD","Ilimitado Banda","20 Emails","SSL Grátis","cPanel","Backup Diário"]', 9500, 39.90, 7.99, 50, 0, 20, 5, 20, 10, true),
('Premium', 'shared', 'Para empresas maiores', '["Sites Ilimitados","200 GB SSD","Ilimitado","Emails Ilimitados","SSL Grátis","cPanel","Backup","IP Dedicado"]', 19500, 79.90, 15.99, 200, 0, 0, 0, 0, 0, false);
