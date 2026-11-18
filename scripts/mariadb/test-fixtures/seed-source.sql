-- Dados de TESTE fictícios (não são dados de produção). Usados para validar a migração numa réplica local.
SET TIME ZONE 'UTC';
-- contas (palavras-passe: Cliente#2026 / Admin#2026) com hash bcrypt gerado pelo pgcrypto (como o GoTrue)
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, aud, role) values
 ('11111111-1111-4111-8111-111111111111','joao.conceicao@example.ao', crypt('Cliente#2026', gen_salt('bf',10)), now(), '{"full_name":"João Conceição","phone":"+244923000111","country":"AO"}', '2026-01-05 10:11:12.123456+00', now(), 'authenticated','authenticated'),
 ('22222222-2222-4222-8222-222222222222','maria.goncalves@example.br', crypt('Cliente#2026', gen_salt('bf',10)), now(), '{"full_name":"Maria Gonçalves Ávila","country":"BR"}', '2026-02-10 08:00:00.000001+00', now(), 'authenticated','authenticated'),
 ('33333333-3333-4333-8333-333333333333','admin@viralizahost.com', crypt('Admin#2026', gen_salt('bf',10)), now(), '{"full_name":"Administração Viraliza"}', '2026-01-01 00:00:00+00', now(), 'authenticated','authenticated'),
 ('44444444-4444-4444-8444-444444444444','convite@example.ao', null, null, '{"full_name":"Sem Senha"}', '2026-03-01 00:00:00+00', now(), 'authenticated','authenticated');
update viralizahost.profiles set role='admin' where id='33333333-3333-4333-8333-333333333333';
update viralizahost.profiles set avatar_url='https://abcdefghij.supabase.co/storage/v1/object/public/site-team/avatar-joao.png' where id='11111111-1111-4111-8111-111111111111';
update viralizahost.clients set credit_balance=1250.75, company_name='Conceição & Filhos, Lda' where profile_id='11111111-1111-4111-8111-111111111111';

insert into viralizahost.servers (id,name,hostname,ip_address,whm_url) values ('55555555-5555-4555-8555-555555555555','Servidor Luanda','server.viralizahost.com','10.0.0.10','https://server.viralizahost.com:2087');

insert into viralizahost.orders (id,user_id,billing_cycle,domain_name,domain_action,payment_method,amount,status,proof_file,created_at,updated_at) values
 ('66666666-6666-4666-8666-666666666661','11111111-1111-4111-8111-111111111111','annual','conceicao.ao','register','bank_transfer',45999.99,'active','11111111/proof-1.png','2026-03-01 12:00:00.654321+00','2026-03-01 12:00:00.654321+00'),
 ('66666666-6666-4666-8666-666666666662','22222222-2222-4222-8222-222222222222','monthly',null,null,'bank_transfer',3500.50,'pending',null,'2026-04-01 09:30:00+00','2026-04-01 09:30:00+00');
insert into viralizahost.order_items (order_id,service_name,service_type,price,quantity) values
 ('66666666-6666-4666-8666-666666666661','Hospedagem Business','hosting',40000.00,1),('66666666-6666-4666-8666-666666666661','Domínio .ao','domain',5999.99,1),
 ('66666666-6666-4666-8666-666666666662','E-mail Profissional','email',3500.50,1);
insert into viralizahost.services (id,profile_id,status,price,billing_cycle,order_id,service_type,service_name,server_id) values
 ('77777777-7777-4777-8777-777777777771','11111111-1111-4111-8111-111111111111','active',40000,'annual','66666666-6666-4666-8666-666666666661','hosting','Hospedagem Business','55555555-5555-4555-8555-555555555555');
insert into viralizahost.hosting_accounts (service_id,profile_id,server_id,cpanel_username,primary_domain,status) values ('77777777-7777-4777-8777-777777777771','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','conceica','conceicao.ao','active');
insert into viralizahost.domains (profile_id,name,extension,status,order_id,price_paid,currency) values ('11111111-1111-4111-8111-111111111111','conceicao','.ao','active','66666666-6666-4666-8666-666666666661',5999.99,'AKZ');
insert into viralizahost.invoices (id,invoice_number,profile_id,order_id,status,currency,subtotal,total,amount_paid,items,due_date,paid_at,notes) values
 ('88888888-8888-4888-8888-888888888881','VH-202603-0001','11111111-1111-4111-8111-111111111111','66666666-6666-4666-8666-666666666661','paid','AKZ',45999.99,45999.99,45999.99,'[{"name":"Hospedagem Business","price":40000},{"name":"Domínio .ao","price":5999.99}]','2026-03-08 00:00:00+00','2026-03-02 15:45:10.5+00','Domínio: conceicao.ao'),
 ('88888888-8888-4888-8888-888888888882','VH-202604-0001','22222222-2222-4222-8222-222222222222','66666666-6666-4666-8666-666666666662','pending','AKZ',3500.50,3500.50,0,'[]','2026-04-08 00:00:00+00',null,null);
insert into viralizahost.payments (invoice_id,profile_id,method,amount,currency,status,proof_url,order_id,declared_amount) values ('88888888-8888-4888-8888-888888888881','11111111-1111-4111-8111-111111111111','bank_transfer',45999.99,'AKZ','approved','11111111/proof-1.png','66666666-6666-4666-8666-666666666661',45999.99);
insert into viralizahost.tickets (id,profile_id,subject,status,priority,ticket_number) values ('99999999-9999-4999-8999-999999999991','11111111-1111-4111-8111-111111111111','Não consigo aceder ao e-mail — ação urgente','open','high','VH-TKT-2026-000001'),('99999999-9999-4999-8999-999999999992','22222222-2222-4222-8222-222222222222','Dúvida sobre faturação','open','low','VH-TKT-2026-000002');
insert into viralizahost.ticket_messages (ticket_id,profile_id,message,is_staff,is_internal) values ('99999999-9999-4999-8999-999999999991','11111111-1111-4111-8111-111111111111','Olá, o webmail dá erro 500 desde ontem. Obrigado!',false,false),('99999999-9999-4999-8999-999999999991','33333333-3333-4333-8333-333333333333','Nota interna: verificar quota',true,true),('99999999-9999-4999-8999-999999999991','33333333-3333-4333-8333-333333333333','Estamos a verificar, João.',true,false);
insert into viralizahost.whm_accounts (server_id,whm_username,primary_domain,contact_email,profile_id,raw_metadata) values ('55555555-5555-4555-8555-555555555555','conceica','conceicao.ao','joao.conceicao@example.ao','11111111-1111-4111-8111-111111111111','{"plan":"business","ç":"ã"}');
insert into viralizahost.site_home_hero (id,mode,video_url,video_storage_path) values (1,'video','https://abcdefghij.supabase.co/storage/v1/object/public/site-videos/home-hero/1-x.mp4','home-hero/1-x.mp4') on conflict (id) do update set mode=excluded.mode, video_url=excluded.video_url, video_storage_path=excluded.video_storage_path;
insert into viralizahost.currency_rates (target_currency, rate) values ('USD', 0.00109876) on conflict do nothing;
insert into storage.objects (bucket_id,name,owner,metadata) values ('payment-proofs','11111111/proof-1.png','11111111-1111-4111-8111-111111111111','{"mimetype":"image/png","size":68}'),('site-videos','home-hero/1-x.mp4',null,'{"mimetype":"video/mp4","size":1000}');
insert into viralizahost.site_banners (position,active,bg_image,title,subtitle,features) values (1,true,'https://abcdefghij.supabase.co/storage/v1/object/public/site-banners/b1.webp','Hospedagem rápida em Angola','Servidores NVMe com suporte em português','{"SSL grátis","Migração grátis"}'),(2,false,null,'Banner inativo','x','{}');
insert into viralizahost.site_domains (extension,price_monthly,price_annual,currency,active,position) values ('.ao',0,15000.00,'AOA',true,1),('.co.ao',0,12500.50,'AOA',true,2),('.old',0,1,'AOA',false,3);
insert into viralizahost.site_email_plans (name,price_monthly,price_annual,features,active,slug) values ('Email Starter',1500.00,15000.00,'{"5 GB","Webmail"}',true,'email-starter');
insert into viralizahost.site_team (name,role,photo_url,active,position) values ('Ana Luísa Fernandes','CTO','https://abcdefghij.supabase.co/storage/v1/object/public/site-team/ana.png',true,1);
insert into viralizahost.site_hosting_plans (name,price_monthly,price_annual,features,active,slug) values ('Básico',2500.00,25000.00,'{"10 GB"}',true,'basico');
