-- ============================================================================
-- Dados FICTÍCIOS para o ensaio da migração (PostgreSQL de teste, NUNCA produção).
-- Requer uma base com o stub Supabase (supabase-stub.sql) + supabase/migrations.
-- Contas de teste (palavras-passe só de ensaio):
--   admin@ensaio.test     / Admin#Teste2026
--   cliente1@ensaio.test  / Cliente#Um2026
--   cliente2@ensaio.test  / Cliente#Dois2026
--   social@ensaio.test    (sem palavra-passe → password_reset_required)
-- ============================================================================
SET search_path = viralizahost, public;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at) VALUES
 ('00000000-0000-4000-8000-00000000a001', 'admin@ensaio.test',    crypt('Admin#Teste2026',  gen_salt('bf', 10)), now(), '{"full_name":"Administradora Ensaio","role":"admin"}',  '2026-01-05 09:00:00.123456+00', '2026-01-05 09:00:00.123456+00'),
 ('00000000-0000-4000-8000-00000000c001', 'cliente1@ensaio.test', crypt('Cliente#Um2026',   gen_salt('bf', 10)), now(), '{"full_name":"João Conceição","phone":"+244900000001","country":"AO"}', '2026-02-10 14:30:00+00', '2026-02-10 14:30:00+00'),
 ('00000000-0000-4000-8000-00000000c002', 'cliente2@ensaio.test', crypt('Cliente#Dois2026', gen_salt('bf', 10)), now(), '{"full_name":"Maria Açúcar Gonçalves","country":"BR"}', '2026-03-01 08:15:30.5+00', '2026-03-01 08:15:30.5+00'),
 ('00000000-0000-4000-8000-00000000c003', 'social@ensaio.test',   NULL, now(), '{"full_name":"Conta Social"}', '2026-03-02 10:00:00+00', '2026-03-02 10:00:00+00');

UPDATE profiles SET role = 'admin' WHERE id = '00000000-0000-4000-8000-00000000a001';
UPDATE clients SET company_name = 'Comércio Ñandú & Filhos, Lda.', credit_balance = 1234.56, currency = 'AKZ' WHERE profile_id = '00000000-0000-4000-8000-00000000c001';

INSERT INTO servers (id, name, hostname, ip_address, whm_url, whm_api_token, whm_username) VALUES
 ('00000000-0000-4000-8000-0000000005e1', 'Luanda 01', 'server1.ensaio.test', '10.0.0.10', 'https://server1.ensaio.test:2087', 'cifrado:token-de-ensaio', 'root');

INSERT INTO services (id, profile_id, plan_id, server_id, status, currency, price, billing_cycle, service_type, service_name, expires_at) VALUES
 ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-00000000c001', (SELECT id FROM plans ORDER BY sort_order LIMIT 1), '00000000-0000-4000-8000-0000000005e1', 'active', 'AKZ', 19900.00, 'monthly', 'hosting', 'Plano Start — joaoconceicao.ao', '2027-02-10 14:30:00+00'),
 ('00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-00000000c002', NULL, NULL, 'suspended', 'BRL', 39.90, 'annual', 'email', 'Email Business', NULL);

INSERT INTO hosting_accounts (id, service_id, profile_id, server_id, cpanel_username, primary_domain, status, disk_used_mb, disk_limit_mb, php_version, ssl_enabled) VALUES
 ('00000000-0000-4000-8000-0000000004a1', '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000005e1', 'joaoconc', 'joaoconceicao.ao', 'active', 512, 20480, '8.2', true);

INSERT INTO orders (id, user_id, billing_cycle, domain_name, domain_action, payment_method, amount, status, proof_file, transfer_ref, created_at, updated_at) VALUES
 ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000c001', 'monthly', 'joaoconceicao.ao', 'register', 'bank_transfer', 19900.00, 'active', '2026/02/1707575400000_comprovativo.pdf', 'TRF-0001', '2026-02-10 14:35:00+00', '2026-02-11 09:00:00+00'),
 ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000c002', 'annual', NULL, NULL, 'pix', 478.80, 'pending', NULL, NULL, '2026-03-05 12:00:00+00', '2026-03-05 12:00:00+00');

INSERT INTO order_items (id, order_id, service_name, service_type, price, quantity) VALUES
 ('00000000-0000-4000-8000-0000000001d1', '00000000-0000-4000-8000-0000000000d1', 'Plano Start', 'hosting', 19900.00, 1),
 ('00000000-0000-4000-8000-0000000001d2', '00000000-0000-4000-8000-0000000000d2', 'Email Business', 'email', 39.90, 12);

INSERT INTO domains (id, profile_id, service_id, name, extension, status, expires_at, order_id) VALUES
 ('00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000005a1', 'joaoconceicao', '.ao', 'active', '2027-02-10 00:00:00+00', '00000000-0000-4000-8000-0000000000d1');

INSERT INTO invoices (id, invoice_number, profile_id, order_id, status, currency, subtotal, discount, tax, total, amount_paid, items, due_date, issue_date, paid_at, notes, proof_file, created_at) VALUES
 ('00000000-0000-4000-8000-0000000003a1', 'VH-202602-0001', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000000d1', 'paid', 'AKZ', 19900.00, 0, 0, 19900.00, 19900.00, '[{"name":"Plano Start","price":19900,"quantity":1}]', '2026-02-17 00:00:00+00', '2026-02-10', '2026-02-11 09:00:00.654321+00', 'Domínio: joaoconceicao.ao', '2026/02/1707575400000_comprovativo.pdf', '2026-02-10 14:35:00+00'),
 ('00000000-0000-4000-8000-0000000003a2', 'VH-202603-0001', '00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-0000000000d2', 'pending', 'BRL', 478.80, 10.05, 0.33, 469.08, 0, '[]', '2026-03-12 00:00:00+00', '2026-03-05', NULL, 'Fatura com cêntimos: 469,08', NULL, '2026-03-05 12:00:00+00');

INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, subtotal, position) VALUES
 ('00000000-0000-4000-8000-0000000006a1', '00000000-0000-4000-8000-0000000003a2', 'Email Business × 12 meses (ação promocional)', 12, 39.90, 478.80, 1);

INSERT INTO payments (id, invoice_id, profile_id, order_id, method, amount, currency, status, proof_url, proof_filename, transfer_ref, transfer_date, declared_amount, created_at) VALUES
 ('00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-0000000000d1', 'bank_transfer', 19900.00, 'AKZ', 'approved', '2026/02/1707575400000_comprovativo.pdf', 'comprovativo.pdf', 'TRF-0001', '2026-02-10', 19900.00, '2026-02-10 14:36:00+00');

INSERT INTO tickets (id, profile_id, assigned_to, subject, status, priority, department, created_at) VALUES
 ('00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a001', 'Não consigo aceder ao cPanel — erro "permissão"', 'in_progress', 'high', 'technical', '2026-02-12 10:00:00+00'),
 ('00000000-0000-4000-8000-0000000008a2', '00000000-0000-4000-8000-00000000c002', NULL, 'Dúvida sobre faturação', 'open', 'low', 'billing', '2026-03-06 16:20:00+00');

INSERT INTO ticket_messages (id, ticket_id, profile_id, message, is_staff, is_internal, created_at) VALUES
 ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000c001', 'Olá! Desde ontem não consigo entrar. Já tentei redefinir a senha… 😕', false, false, '2026-02-12 10:00:00+00'),
 ('00000000-0000-4000-8000-0000000009a2', '00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000a001', 'Nota interna: verificar firewall do servidor Luanda 01.', true, true, '2026-02-12 10:30:00+00'),
 ('00000000-0000-4000-8000-0000000009a3', '00000000-0000-4000-8000-0000000008a1', '00000000-0000-4000-8000-00000000a001', 'Bom dia, João. Já está resolvido — pode tentar de novo?', true, false, '2026-02-12 11:00:00+00');

INSERT INTO activity_logs (profile_id, action, entity_type, entity_id, description, metadata, created_at) VALUES
 ('00000000-0000-4000-8000-00000000a001', 'update', 'order', '00000000-0000-4000-8000-0000000000d1', 'Encomenda aprovada', '{"via":"painel"}', '2026-02-11 09:00:00+00'),
 ('00000000-0000-4000-8000-00000000c001', 'login', NULL, NULL, 'Início de sessão', '{}', '2026-02-12 09:59:00+00');

INSERT INTO notifications (profile_id, title, message, type, is_read) VALUES
 ('00000000-0000-4000-8000-00000000c001', 'Fatura paga', 'A fatura VH-202602-0001 foi confirmada.', 'success', true);

-- Gestão do Site: conteúdo parcial (deixa registos-semente em falta de propósito)
INSERT INTO site_banners (id, position, active, bg_image, tag, title, subtitle, cta_text, cta_href, features) VALUES
 ('00000000-0000-4000-8000-00000000b001', 1, true, 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/site-banners/banners/hero-ia.webp', 'Inteligência Artificial', 'Automação & IA', 'Soluções de IA para o seu negócio.', 'Começar Agora', '/checkout', ARRAY['IA Avançada','Automação 24/7']),
 ('00000000-0000-4000-8000-00000000b002', 2, false, NULL, 'Email', 'E-mail Corporativo', 'Inactivo no ensaio', 'Criar Email', '/checkout', ARRAY[]::text[]);
INSERT INTO site_domains (id, extension, price_monthly, price_annual, currency, popular, active, position) VALUES
 ('00000000-0000-4000-8000-00000000b101', '.ao', 2500.00, 25000.00, 'AOA', true, true, 1),
 ('00000000-0000-4000-8000-00000000b102', '.com', 1500.50, 15000.75, 'AOA', false, true, 2);
INSERT INTO site_team (id, name, role, title, bio, photo_url, flag, country, position, active, is_ceo) VALUES
 ('00000000-0000-4000-8000-00000000b201', 'Pessoa Fictícia', 'CEO', 'Fundadora', 'Bio com acentuação: ção, ã, é, ü.', 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/site-team/team/pessoa.jpg', '🇦🇴', 'Angola', 1, true, true);

UPDATE site_home_hero SET mode = 'video',
  video_url = 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/site-videos/home-hero/1760000000000-abc123-apresentacao.mp4',
  video_storage_path = 'home-hero/1760000000000-abc123-apresentacao.mp4', video_file_name = 'apresentação.mp4', video_size_bytes = 2048
 WHERE id = 1;

INSERT INTO ai_conversations (id, profile_id, title, user_level, status) VALUES
 ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000c001', 'Ajuda com domínio', 'client', 'resolved');
INSERT INTO ai_messages (conversation_id, role, content) VALUES
 ('00000000-0000-4000-8000-00000000e001', 'user', 'Como aponto o meu domínio?'),
 ('00000000-0000-4000-8000-00000000e001', 'assistant', 'Altere os nameservers para ns1/ns2.viralizahost.com.');

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('site-team', 'site-team', true), ('invoices', 'invoices', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES
 ('site-banners', 'banners/hero-ia.webp', '{"size": 1024, "mimetype": "image/webp"}'),
 ('site-team', 'team/pessoa.jpg', '{"size": 512, "mimetype": "image/jpeg"}'),
 ('site-videos', 'home-hero/1760000000000-abc123-apresentacao.mp4', '{"size": 2048, "mimetype": "video/mp4"}'),
 ('payment-proofs', '2026/02/1707575400000_comprovativo.pdf', '{"size": 300, "mimetype": "application/pdf"}');
