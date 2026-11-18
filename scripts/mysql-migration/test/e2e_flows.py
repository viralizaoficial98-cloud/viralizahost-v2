"""
TESTE — fluxos reais da aplicação em modo MySQL (Playwright), contra:
  - app Next.js compilada com NEXT_PUBLIC_DATA_BACKEND=mysql   (APP, por omissão http://localhost:3105)
  - Supabase simulado (Auth + Storage)                           (MOCK, mock-supabase.mjs)
  - WHM simulado em HTTPS :2087                                  (mock-whm.mjs)
  - MariaDB/MySQL local (MYSQL_CMD: comando cliente com credenciais)

Uso: python3 e2e_flows.py [secção ...]   — escreve o resultado em $RESULTS (JSON) e sai com 1 se algo falhar.
"""
import json, os, re, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

APP = os.environ.get('APP', 'http://localhost:3105')
MOCK = os.environ.get('MOCK', 'http://localhost:54321')
MYSQL_CMD = os.environ['MYSQL_CMD']
RESULTS = os.environ.get('RESULTS', '/tmp/e2e/results.json')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PWD = 'SenhaForte#2026'
results = []


def check(section, name, cond, detail=''):
    ok = bool(cond)
    results.append({'section': section, 'name': name, 'ok': ok, 'detail': str(detail)[:600]})
    print(('PASS ' if ok else 'FAIL ') + f'[{section}] {name}' + (f' — {str(detail)[:300]}' if detail and not ok else ''), flush=True)
    return ok


def sql(q):
    out = subprocess.run(f"{MYSQL_CMD} -N -B --default-character-set=utf8mb4 -e {json.dumps(q)}", shell=True, capture_output=True, text=True)
    if out.returncode: raise RuntimeError(out.stderr)
    return [line.split('\t') for line in out.stdout.strip().split('\n') if line]


def mock(path, data=None):
    req = urllib.request.Request(MOCK + path, data=json.dumps(data).encode() if data is not None else None,
                                 method='POST' if data is not None else 'GET', headers={'content-type': 'application/json'})
    return json.load(urllib.request.urlopen(req))


def db_api(page, body):
    """Consulta direta a /api/db com a sessão do browser (simula um cliente malicioso a usar a API)."""
    r = page.request.post(APP + '/api/db', data=body, headers={'x-vh-db': '1'})
    return r.json()


def login(ctx, email, password=PWD):
    pg = ctx.new_page()
    pg.goto(APP + '/login')
    pg.get_by_placeholder('seu@email.com').fill(email)
    pg.get_by_placeholder('••••••••').fill(password)
    pg.locator('button[type=submit]').click()
    pg.wait_for_url(re.compile(r'/dashboard'), timeout=20000)
    return pg


def new_ctx(b, mobile=False):
    return b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}, is_mobile=mobile)


# ════════════════════════════════════════════════════════════════════════════
def sec_auth(b):
    S = 'auth'
    mock('/__reset')
    # Registo pela página /register
    ctx = new_ctx(b); pg = ctx.new_page()
    pg.goto(APP + '/register')
    pg.get_by_placeholder('Seu nome completo').fill('Cliente Ação Teste')
    pg.get_by_placeholder('seu@email.com').fill('cliente.a@exemplo.ao')
    pg.get_by_placeholder('+244 900...').fill('+244 923 000 111')
    pg.get_by_placeholder('Mínimo 8 caracteres').fill(PWD)
    pg.get_by_placeholder('Confirme a sua senha').fill(PWD)
    pg.locator('#terms').check()
    pg.locator('button[type=submit]').click()
    pg.wait_for_timeout(4000)
    pg.goto(APP + '/dashboard'); pg.wait_for_timeout(3000)
    rows = sql("SELECT p.email, p.full_name, p.role, (SELECT COUNT(*) FROM clients c WHERE c.profile_id = p.id) FROM profiles p WHERE p.email = 'cliente.a@exemplo.ao'")
    check(S, 'Registo cria perfil + cliente no MySQL (papel client, nome com acentos)', rows and rows[0][1] == 'Cliente Ação Teste' and rows[0][2] == 'client' and rows[0][3] == '1', rows)
    check(S, 'Dashboard do cliente abre após registo', '/dashboard' in pg.url and pg.locator('body').inner_text().strip() != '', pg.url)
    ctx.close()

    # Registo direto na API com role=admin (ataque) → perfil continua 'client'
    r = urllib.request.Request(MOCK + '/auth/v1/signup', data=json.dumps({'email': 'atacante@exemplo.ao', 'password': PWD, 'data': {'role': 'admin', 'full_name': 'X'}}).encode(), method='POST', headers={'content-type': 'application/json'})
    urllib.request.urlopen(r)
    ctx = new_ctx(b); pg = login(ctx, 'atacante@exemplo.ao'); pg.wait_for_timeout(1500)
    role = sql("SELECT role FROM profiles WHERE email = 'atacante@exemplo.ao'")
    check(S, 'Registo com metadata role=admin não cria administrador', role and role[0][0] == 'client', role)
    # Escalada pelo browser: update do próprio role
    uid = sql("SELECT id FROM profiles WHERE email = 'atacante@exemplo.ao'")[0][0]
    res = db_api(pg, {'table': 'profiles', 'action': 'update', 'values': {'role': 'admin'}, 'filters': [{'type': 'op', 'col': 'id', 'op': 'eq', 'value': uid}], 'order': []})
    role = sql(f"SELECT role FROM profiles WHERE id = '{uid}'")[0][0]
    check(S, 'Cliente não consegue alterar o próprio role (403)', role == 'client' and res.get('error', {}).get('code') == '42501', res.get('error'))
    ctx.close()

    # Login / logout / login com senha errada
    ctx = new_ctx(b); pg = ctx.new_page()
    pg.goto(APP + '/login')
    pg.get_by_placeholder('seu@email.com').fill('cliente.a@exemplo.ao')
    pg.get_by_placeholder('••••••••').fill('errada123')
    pg.locator('button[type=submit]').click(); pg.wait_for_timeout(2500)
    check(S, 'Login com senha errada é recusado', '/login' in pg.url, pg.url)
    ctx.close()
    ctx = new_ctx(b); pg = login(ctx, 'cliente.a@exemplo.ao')
    check(S, 'Login com email e senha', '/dashboard' in pg.url, pg.url)
    ctx.close()

    # Recuperação de palavra-passe (PKCE): pedido → link do email → nova senha → login
    ctx = new_ctx(b); pg = ctx.new_page()
    pg.goto(APP + '/forgot-password')
    pg.get_by_placeholder('seu@email.com').fill('cliente.a@exemplo.ao')
    pg.locator('button[type=submit]').click(); pg.wait_for_timeout(2500)
    rec = mock('/__recovery?email=cliente.a@exemplo.ao')
    check(S, 'Pedido de recuperação chega ao Supabase Auth', rec and 'code=' in rec['link'], rec)
    if rec:
        link = re.sub(r'^https?://[^/]+', APP, rec['link'])  # o link real aponta para https://viralizahost.com
        pg.goto(link); pg.wait_for_timeout(3500)
        pg.get_by_placeholder('Mínimo 8 caracteres').fill('NovaSenha#2026')
        pg.get_by_placeholder('Confirme a nova senha').fill('NovaSenha#2026')
        pg.locator('button[type=submit]').click(); pg.wait_for_timeout(2500)
        ctx2 = new_ctx(b)
        try:
            pg2 = login(ctx2, 'cliente.a@exemplo.ao', 'NovaSenha#2026')
            check(S, 'Recuperação de conta: login com a nova senha', '/dashboard' in pg2.url, pg2.url)
        except Exception as e:
            check(S, 'Recuperação de conta: login com a nova senha', False, e)
        ctx2.close()
        # repor a senha para os testes seguintes
        u = [x for x in mock('/__state')['users'] if x['email'] == 'cliente.a@exemplo.ao'][0]
        urllib.request.urlopen(urllib.request.Request(MOCK + f"/auth/v1/admin/users/{u['id']}", data=json.dumps({'password': PWD}).encode(), method='PUT', headers={'content-type': 'application/json'}))
    ctx.close()

    # Definições: atualizar nome/telefone (cliente) → MySQL
    ctx = new_ctx(b); pg = login(ctx, 'cliente.a@exemplo.ao')
    pg.goto(APP + '/settings'); pg.wait_for_timeout(2500)
    name_input = pg.locator('input').filter(has_not=pg.locator('[type=password]')).first
    body = pg.locator('body').inner_text()
    check(S, 'Definições carrega o perfil do MySQL', 'Cliente Ação Teste' in pg.content(), body[:200])
    inputs = pg.locator('input[type=text], input:not([type])')
    if inputs.count():
        inputs.first.fill('Cliente Ação Atualizado')
        pg.get_by_role('button', name=re.compile('Guardar|Salvar', re.I)).first.click(); pg.wait_for_timeout(2000)
        nm = sql("SELECT full_name FROM profiles WHERE email = 'cliente.a@exemplo.ao'")[0][0]
        check(S, 'Definições grava o nome no MySQL', nm == 'Cliente Ação Atualizado', nm)
        sql("UPDATE profiles SET full_name = 'Cliente Ação Teste' WHERE email = 'cliente.a@exemplo.ao'")
    ctx.close()


def upload_mock(bucket, path, content=b'%PDF-1.4 comprovativo', ctype='application/pdf'):
    req = urllib.request.Request(f"{MOCK}/storage/v1/object/{bucket}/{path}", data=content, method='POST',
                                 headers={'content-type': ctype, 'authorization': 'Bearer service-test', 'x-upsert': 'true'})
    return json.load(urllib.request.urlopen(req))


def seed_admin():
    u = mock('/__seed_user', {'email': 'admin@viralizahost.test', 'password': PWD, 'user_metadata': {'full_name': 'Admin Viraliza'}})
    sql(f"INSERT INTO profiles (id, email, full_name, role) VALUES ('{u['id']}', 'admin@viralizahost.test', 'Admin Viraliza', 'admin') ON DUPLICATE KEY UPDATE role = 'admin'")
    mock('/__seed_user', {'email': 'cliente.b@exemplo.ao', 'password': PWD, 'user_metadata': {'full_name': 'Cliente B'}})
    mock('/__seed_user', {'email': 'cliente.a@exemplo.ao', 'password': PWD, 'user_metadata': {'full_name': 'Cliente Ação Teste'}})
    return u


STATE = json.load(open(os.environ['STATE_FILE'])) if os.environ.get('STATE_FILE') else {}


def sec_client(b):
    S = 'cliente'
    seed_admin()
    actx = new_ctx(b); admin = login(actx, 'admin@viralizahost.test')
    r = admin.request.post(APP + '/api/admin/seed-site')
    n = sql("SELECT (SELECT COUNT(*) FROM site_domains), (SELECT COUNT(*) FROM site_banners), (SELECT COUNT(*) FROM site_hosting_plans)")[0]
    check(S, 'Admin: "Popular conteúdo padrão" preenche as tabelas do site no MySQL', r.ok and int(n[0]) > 0 and int(n[1]) > 0, (r.status, n))
    actx.close()

    ctx = new_ctx(b); pg = login(ctx, 'cliente.a@exemplo.ao')
    uid = sql("SELECT id FROM profiles WHERE email = 'cliente.a@exemplo.ao'")[0][0]
    STATE['uid_a'] = uid
    price = int(float(sql("SELECT price_monthly FROM products WHERE slug = 'hosting-start'")[0][0]))
    dom_price = int(float(sql("SELECT COALESCE(price_annual, price_monthly) FROM site_domains WHERE extension = '.com'")[0][0]))
    proof = f"{uid}/{int(time.time())}_comprovativo.pdf"
    upload_mock('payment-proofs', proof)
    body = {'items': [{'id': 'hosting-start', 'name': 'Plano Start', 'type': 'hosting', 'price': price, 'quantity': 1},
                      {'id': 'domain-com', 'name': 'Domínio minhaempresa-teste.com', 'type': 'domain', 'price': dom_price, 'quantity': 1}],
            'billingCycle': 'monthly', 'domainName': 'minhaempresa-teste.com', 'domainAction': 'register',
            'paymentMethod': 'bank_transfer', 'proofFileUrl': proof, 'transferRef': 'REF-ÇÃO-001', 'amount': price + dom_price}
    r = pg.request.post(APP + '/api/checkout/orders', data=body)
    j = r.json(); STATE['order1'] = j.get('id')
    check(S, 'Encomenda com domínio e comprovativo (RPC create_order)', r.ok and j.get('id'), j)
    o = sql(f"SELECT o.amount, o.status, o.domain_name, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id), (SELECT COUNT(*) FROM services WHERE order_id = o.id AND status = 'pending'), (SELECT CONCAT(name, extension, ':', status) FROM domains WHERE order_id = o.id) FROM orders o WHERE o.id = '{j.get('id')}'")
    check(S, 'Encomenda grava orders, order_items, services e domains', o and float(o[0][0]) == price + dom_price and o[0][3] == '2' and o[0][4] == '2' and o[0][5] == 'minhaempresa-teste.com:pending', o)
    inv = sql(f"SELECT invoice_number, status, currency, total, proof_file, JSON_LENGTH(items), DATE_FORMAT(due_date, '%Y-%m-%d'), issue_date FROM invoices WHERE order_id = '{j.get('id')}'")
    ym = time.strftime('%Y%m', time.gmtime())
    check(S, 'Fatura criada: número VH-AAAAMM-0001, em análise, AKZ, total certo, 2 itens', inv and inv[0][0] == f'VH-{ym}-0001' and inv[0][1] == 'under_review' and inv[0][2] == 'AKZ' and float(inv[0][3]) == price + dom_price and inv[0][4] == proof and inv[0][5] == '2', inv)
    STATE['inv1'] = sql(f"SELECT id FROM invoices WHERE order_id = '{j.get('id')}'")[0][0]

    body2 = {**body, 'items': [body['items'][0]], 'domainName': '', 'domainAction': '', 'proofFileUrl': '', 'amount': price}
    r = pg.request.post(APP + '/api/checkout/orders', data=body2); j2 = r.json(); STATE['order2'] = j2.get('id')
    inv2 = sql(f"SELECT invoice_number, status FROM invoices WHERE order_id = '{j2.get('id')}'")
    check(S, 'Segunda encomenda sem comprovativo → fatura VH-AAAAMM-0002 pendente', r.ok and inv2 and inv2[0] == [f'VH-{ym}-0002', 'pending'], (j2, inv2))
    STATE['inv2'] = sql(f"SELECT id FROM invoices WHERE order_id = '{j2.get('id')}'")[0][0]
    body3 = {**body2, 'items': [{**body['items'][0], 'price': 1}], 'amount': 1}
    r = pg.request.post(APP + '/api/checkout/orders', data=body3)
    check(S, 'Preço adulterado no carrinho é recusado', r.status == 400, r.status)

    # Faturação do cliente
    r = pg.request.get(APP + '/api/client/billing/invoices'); j = r.json()
    lst = (j.get('invoices') or j.get('data', {}).get('invoices') or []) if isinstance(j, dict) else []
    check(S, 'Lista de faturas (RPC get_client_invoices) com itens da encomenda', r.ok and len(lst) == 2 and any(len(x.get('order_items', [])) == 2 for x in lst), str(j)[:300])
    r = pg.request.get(APP + '/api/client/billing/summary'); j = r.json()
    summ = j.get('summary', j) if isinstance(j, dict) else {}
    check(S, 'Resumo financeiro do cliente (pendente = 2.ª fatura, em análise = 1.ª)', r.ok and float(summ.get('total_pending', -1)) == price and float(summ.get('total_under_review', -1)) == price + dom_price, j)
    pg.goto(APP + '/billing'); pg.wait_for_timeout(2500)
    check(S, 'Página de faturas mostra os números das faturas', f'VH-{ym}-0001' in pg.content() and f'VH-{ym}-0002' in pg.content(), pg.url)
    pg.goto(APP + f"/billing/invoices/{STATE['inv2']}"); pg.wait_for_timeout(2500)
    check(S, 'Detalhe da fatura abre', f'VH-{ym}-0002' in pg.content(), pg.url)
    r = pg.request.get(APP + f"/api/client/billing/invoices/{STATE['inv2']}/pdf")
    check(S, 'PDF da fatura é gerado', r.ok and r.body()[:4] == b'%PDF', (r.status, r.headers.get('content-type')))

    # Pagamento: intenção + comprovativo (o trigger sync_invoice_proof_file passou para a aplicação)
    r = pg.request.post(APP + f"/api/client/billing/invoices/{STATE['inv2']}/payment-intent", data={'method': 'bank_transfer'}); j = r.json()
    pay_id = (j.get('payment') or {}).get('id') or j.get('payment_id') or j.get('id')
    check(S, 'Intenção de pagamento cria registo em payments', r.ok and pay_id, j)
    r = pg.request.post(APP + f"/api/client/billing/invoices/{STATE['inv2']}/payment-proof", multipart={
        'file': {'name': 'comprovativo ação.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 teste'},
        'payment_id': pay_id or '', 'transfer_ref': 'TRF-2026-ÇÃ', 'transfer_date': time.strftime('%Y-%m-%d'),
        'payer_name': 'Cliente Ação', 'payer_bank': 'BAI', 'declared_amount': str(price)})
    p = sql(f"SELECT p.status, p.proof_url IS NOT NULL, p.declared_amount, i.status, i.proof_file IS NOT NULL FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.invoice_id = '{STATE['inv2']}'")
    check(S, 'Comprovativo de pagamento: ficheiro no Storage, payments atualizado e fatura com comprovativo', r.ok and p and p[0][1] == '1' and float(p[0][2]) == price and p[0][4] == '1', (r.status, r.text()[:200], p))

    # Tickets: numeração VH-TKT-AAAA-000001, mensagens
    y = time.strftime('%Y', time.gmtime())
    r = pg.request.post(APP + '/api/client/support/tickets', data={'subject': 'Não consigo aceder ao cPanel — ação', 'category': 'technical', 'priority': 'high', 'description': 'Olá, preciso de ajuda. 🚀'})
    j = r.json(); tid = (j.get('ticket') or {}).get('id') or j.get('id')
    STATE['ticket'] = tid
    t = sql(f"SELECT ticket_number, status, (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) FROM tickets t WHERE t.id = '{tid}'") if tid else []
    check(S, f'Ticket criado com número VH-TKT-{y}-000001 e primeira mensagem', r.ok and t and t[0][0] == f'VH-TKT-{y}-000001' and t[0][2] == '1', (j, t))
    r2 = pg.request.post(APP + '/api/client/support/tickets', data={'subject': 'Segundo pedido', 'category': 'billing', 'priority': 'low', 'description': 'texto'})
    t2 = sql(f"SELECT ticket_number FROM tickets WHERE subject = 'Segundo pedido'")
    check(S, 'Segundo ticket → VH-TKT-AAAA-000002', t2 and t2[0][0] == f'VH-TKT-{y}-000002', t2)
    r = pg.request.post(APP + f'/api/client/support/tickets/{tid}/messages', data={'message': 'Mais detalhes: erro 500.'})
    check(S, 'Cliente responde ao ticket', r.ok and sql(f"SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = '{tid}'")[0][0] == '2', r.status)
    pg.goto(APP + '/tickets'); pg.wait_for_timeout(2500)
    check(S, 'Página de tickets lista os tickets do cliente', f'VH-TKT-{y}-000001' in pg.content() or 'Não consigo aceder' in pg.content(), pg.url)
    ctx.close()


def sec_isolation(b):
    S = 'isolamento'
    ctx = new_ctx(b); pg = login(ctx, 'cliente.b@exemplo.ao')
    for table in ['invoices', 'orders', 'tickets', 'ticket_messages', 'payments', 'services', 'domains', 'order_items', 'invoice_items', 'notifications']:
        res = db_api(pg, {'table': table, 'action': 'select', 'columns': '*', 'filters': [], 'order': []})
        check(S, f'Cliente B não vê registos de outros em {table}', res.get('error') is None and res.get('data') == [], str(res)[:200])
    res = db_api(pg, {'table': 'profiles', 'action': 'select', 'columns': 'id, email', 'filters': [], 'order': []})
    check(S, 'Cliente B só vê o próprio perfil', res.get('data') and len(res['data']) == 1 and res['data'][0]['email'] == 'cliente.b@exemplo.ao', res)
    res = db_api(pg, {'table': 'invoices', 'action': 'update', 'values': {'status': 'paid'}, 'filters': [{'type': 'op', 'col': 'id', 'op': 'eq', 'value': STATE.get('inv2')}], 'order': []})
    check(S, 'Cliente B não consegue alterar faturas de outro cliente', sql(f"SELECT status FROM invoices WHERE id = '{STATE.get('inv2')}'")[0][0] != 'paid', res)
    res = db_api(pg, {'table': 'site_banners', 'action': 'insert', 'values': {'title': 'hack', 'position': 999, 'active': True}, 'filters': [], 'order': []})
    check(S, 'Cliente não consegue escrever conteúdo do site (correção de permissões)', res.get('error') and res['error']['code'] == '42501', res)
    r = pg.request.get(APP + '/api/client/billing/invoices'); j = r.json()
    lst = j.get('invoices') or (j.get('data') or {}).get('invoices') or []
    check(S, 'API de faturas do cliente B devolve 0 faturas', r.ok and lst == [], str(j)[:200])
    r = pg.request.get(APP + f"/api/client/billing/invoices/{STATE.get('inv1')}")
    check(S, 'Cliente B não abre fatura do cliente A (API)', r.status in (403, 404), r.status)
    r = pg.request.get(APP + f"/api/client/support/tickets/{STATE.get('ticket')}")
    check(S, 'Cliente B não abre ticket do cliente A (API)', r.status in (403, 404), r.status)
    r = pg.request.post(APP + f"/api/client/support/tickets/{STATE.get('ticket')}/messages", data={'message': 'intruso'})
    check(S, 'Cliente B não responde a ticket do cliente A', r.status in (403, 404) and sql(f"SELECT COUNT(*) FROM ticket_messages WHERE message = 'intruso'")[0][0] == '0', r.status)
    r = pg.request.get(APP + '/api/admin/orders')
    check(S, 'Cliente não acede às APIs de administração', r.status in (401, 403), r.status)
    ctx.close()
    actx = b.new_context(); ap = actx.new_page(); ap.goto(APP + '/')
    res = db_api(ap, {'table': 'profiles', 'action': 'select', 'columns': '*', 'filters': [], 'order': []})
    res2 = db_api(ap, {'table': 'invoices', 'action': 'select', 'columns': '*', 'filters': [], 'order': []})
    check(S, 'Visitante anónimo não lê perfis nem faturas', res.get('data') == [] and res2.get('data') == [], (res, res2))
    r = ap.request.post(APP + '/api/db', data={'table': 'profiles', 'action': 'select', 'filters': [], 'order': []})
    check(S, '/api/db exige o cabeçalho anti-CSRF', r.status == 400, r.status)
    actx.close()


def sec_admin(b):
    S = 'admin'
    y = time.strftime('%Y', time.gmtime())
    ctx = new_ctx(b); pg = login(ctx, 'admin@viralizahost.test')
    r = pg.request.get(APP + '/api/admin/orders'); j = r.json()
    orders = j.get('orders', j if isinstance(j, list) else [])
    o1 = next((o for o in orders if o.get('id') == STATE.get('order1')), None)
    check(S, 'Lista de encomendas com itens e cliente', r.ok and o1 and len(o1.get('order_items') or o1.get('items') or []) == 2, str(j)[:300])
    r = pg.request.post(APP + '/api/admin/orders', data={'orderId': STATE.get('order1'), 'action': 'approve'})
    s = sql(f"SELECT o.status, (SELECT GROUP_CONCAT(DISTINCT status) FROM services WHERE order_id = o.id), (SELECT status FROM domains WHERE order_id = o.id), i.status, i.amount_paid = i.total, i.paid_at IS NOT NULL FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = '{STATE.get('order1')}'")
    check(S, 'Aprovar encomenda (RPC approve_order): encomenda, serviços, domínio e fatura paga', r.ok and s and s[0] == ['active', 'active', 'active', 'paid', '1', '1'], (r.status, r.text()[:200], s))
    r = pg.request.post(APP + '/api/admin/orders', data={'orderId': STATE.get('order2'), 'action': 'reject', 'notes': 'Comprovativo ilegível — ação'})
    s = sql(f"SELECT o.status, o.notes, i.status FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.id = '{STATE.get('order2')}'")
    check(S, 'Rejeitar encomenda sem domínio (RPC reject_order)', r.ok and s and s[0] == ['rejected', 'Comprovativo ilegível — ação', 'cancelled'], (r.status, r.text()[:200], s))

    r = pg.request.post(APP + f"/api/admin/support/tickets/{STATE.get('ticket')}/messages", data={'message': 'Nota interna: verificar servidor', 'is_internal': True})
    r2 = pg.request.post(APP + f"/api/admin/support/tickets/{STATE.get('ticket')}/messages", data={'message': 'Olá! Já resolvemos.', 'is_internal': False})
    check(S, 'Admin responde e cria nota interna', r.ok and r2.ok and sql(f"SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = '{STATE.get('ticket')}' AND is_staff = 1")[0][0] == '2', (r.status, r2.status))
    cctx = new_ctx(b); cp = login(cctx, 'cliente.a@exemplo.ao')
    res = db_api(cp, {'table': 'ticket_messages', 'action': 'select', 'columns': 'message, is_internal', 'filters': [{'type': 'op', 'col': 'ticket_id', 'op': 'eq', 'value': STATE.get('ticket')}], 'order': []})
    msgs = [m['message'] for m in res.get('data') or []]
    check(S, 'Cliente vê a resposta mas não a nota interna', 'Olá! Já resolvemos.' in msgs and not any('Nota interna' in m for m in msgs), msgs)
    r = cp.request.get(APP + f"/api/client/support/tickets/{STATE.get('ticket')}")
    check(S, 'API de ticket do cliente não devolve a nota interna', r.ok and 'Nota interna' not in r.text() and 'Já resolvemos' in r.text(), r.text()[:200])
    cctx.close()

    for path, needle in [('/admin', ''), ('/admin/financial', ''), ('/admin/orders', ''), ('/admin/clients', 'cliente.a@exemplo.ao'), ('/admin/tickets', f'VH-TKT-{y}-000001'), ('/admin/site/banners', ''), ('/admin/email-logs', '')]:
        pg.goto(APP + path); pg.wait_for_timeout(2500)
        txt = pg.content()
        check(S, f'Página {path} abre sem erro' + (f' e mostra "{needle}"' if needle else ''), 'Application error' not in txt and 'Internal Server Error' not in txt and (needle in txt if needle else True), pg.url)
    r = pg.request.get(APP + '/api/admin/financial/summary')
    check(S, 'Resumo financeiro do admin responde', r.ok, (r.status, r.text()[:200]))
    r = pg.request.get(APP + '/api/admin/clients'); j = r.json()
    check(S, 'Lista de clientes (admin)', r.ok and 'cliente.a@exemplo.ao' in json.dumps(j), str(j)[:200])

    # Conteúdo do site: CRUD de banner como admin pelo browser (/api/db) e upload de imagem
    res = db_api(pg, {'table': 'site_banners', 'action': 'insert', 'values': {'title': 'Banner de teste — ação', 'position': 50, 'active': True, 'bg_image': '/x.png'}, 'returning': True, 'columns': 'id, title', 'filters': [], 'order': []})
    bid = (res.get('data') or [{}])[0].get('id')
    res2 = db_api(pg, {'table': 'site_banners', 'action': 'update', 'values': {'active': False}, 'filters': [{'type': 'op', 'col': 'id', 'op': 'eq', 'value': bid}], 'order': []})
    res3 = db_api(pg, {'table': 'site_banners', 'action': 'delete', 'filters': [{'type': 'op', 'col': 'id', 'op': 'eq', 'value': bid}], 'order': []})
    check(S, 'Admin cria, desativa e apaga banner (browser → /api/db)', bid and res2.get('error') is None and res3.get('error') is None and sql(f"SELECT COUNT(*) FROM site_banners WHERE id = '{bid}'")[0][0] == '0', (res, res2, res3))
    r = pg.request.post(APP + '/api/admin/storage/banner', multipart={'file': {'name': 'banner.png', 'mimeType': 'image/png', 'buffer': b'\x89PNG\r\n\x1a\n' + b'0' * 100}})
    check(S, 'Upload de imagem de banner para o Storage', r.ok and 'publicUrl' in r.text(), (r.status, r.text()[:200]))
    r = pg.request.post(APP + '/api/admin/storage/team', multipart={'file': {'name': 'foto.jpg', 'mimeType': 'image/jpeg', 'buffer': b'\xff\xd8\xff' + b'0' * 100}})
    check(S, 'Upload de foto da equipa para o Storage', r.ok, (r.status, r.text()[:200]))

    # Recuperação de senha pelo admin e senha do portal
    ua = STATE.get('uid_a') or sql("SELECT id FROM profiles WHERE email = 'cliente.a@exemplo.ao'")[0][0]
    n0 = len([x for x in mock('/__state')['recoveries'] if x['email'] == 'cliente.a@exemplo.ao'])
    r = pg.request.post(APP + f'/api/admin/clients/{ua}/send-password-reset')
    n1 = len([x for x in mock('/__state')['recoveries'] if x['email'] == 'cliente.a@exemplo.ao'])
    check(S, 'Admin envia email de recuperação ao cliente', r.ok and n1 == n0 + 1, (r.status, r.text()[:150]))
    r = pg.request.post(APP + f'/api/admin/clients/{ua}/portal-password', data={'password': 'PortalNova#2026'})
    c2 = new_ctx(b)
    try:
        login(c2, 'cliente.a@exemplo.ao', 'PortalNova#2026'); okl = True
    except Exception:
        okl = False
    check(S, 'Admin define senha do portal e o cliente entra com ela', r.ok and okl, (r.status, r.text()[:150]))
    c2.close()
    u = [x for x in mock('/__state')['users'] if x['email'] == 'cliente.a@exemplo.ao'][0]
    urllib.request.urlopen(urllib.request.Request(MOCK + f"/auth/v1/admin/users/{u['id']}", data=json.dumps({'password': PWD}).encode(), method='PUT', headers={'content-type': 'application/json'}))
    ctx.close()


def sec_hero(b):
    S = 'video-carrossel'
    ctx = new_ctx(b); pg = login(ctx, 'admin@viralizahost.test')
    pg.goto(APP + '/admin/site/hero'); pg.get_by_text('O que mostrar no topo').wait_for(timeout=20000)
    check(S, 'Página Topo da Página Inicial abre (lê site_home_hero do MySQL)', pg.get_by_role('radio', name='Carrossel').get_attribute('aria-checked') == 'true')
    clip = os.environ.get('CLIP', '/tmp/herotest/clip-a.mp4')
    pg.get_by_test_id('home-hero-video-input').set_input_files(clip)
    pg.get_by_text('Vídeo enviado.').wait_for(timeout=30000)
    pg.get_by_role('button', name='Publicar vídeo').click()
    pg.get_by_text('Publicado: a página inicial passa a mostrar o vídeo.').wait_for(timeout=15000)
    row = sql("SELECT mode, video_storage_path, video_size_bytes FROM site_home_hero WHERE id = 1")[0]
    check(S, 'Publicar vídeo grava no MySQL', row[0] == 'video' and row[1].startswith('home-hero/') and int(row[2]) > 0, row)

    def home_state(mobile=False):
        c = new_ctx(b, mobile); h = c.new_page(); h.goto(APP + '/', wait_until='load'); h.wait_for_timeout(2500)
        r = h.evaluate("""() => { const s = document.querySelector('main > section'); const v = s.querySelector('video');
          const bx = e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] };
          return { label: s.getAttribute('aria-label'), box: bx(s), video: v ? { controls: v.controls, autoplay: v.autoplay, fit: getComputedStyle(v).objectFit, box: bx(v) } : null } }""")
        h.screenshot(path=f"/tmp/e2e/hero-{'mobile' if mobile else 'desktop'}-{r['label'][:5]}.png"); c.close(); return r

    h = home_state()
    check(S, 'Página inicial mostra o vídeo no mesmo espaço (desktop 1440×833)', h['label'] == 'Vídeo de apresentação' and h['box'] == [1440, 833] and h['video']['box'] == [1440, 765] and h['video']['controls'] and not h['video']['autoplay'] and h['video']['fit'] == 'contain', h)
    hm = home_state(True)
    check(S, 'Página inicial mostra o vídeo em mobile (390×528)', hm['label'] == 'Vídeo de apresentação' and hm['box'] == [390, 528], hm)
    pg.get_by_role('radio', name='Carrossel').click()
    pg.get_by_role('button', name='Publicar carrossel').click()
    pg.get_by_text('Publicado: a página inicial passa a mostrar o carrossel.').wait_for(timeout=15000)
    h = home_state()
    check(S, 'Voltar ao carrossel: a página inicial mostra o carrossel', h['label'] == 'Hero Slideshow' and h['box'] == [1440, 833] and sql("SELECT mode FROM site_home_hero WHERE id = 1")[0][0] == 'carousel', h)
    ctx.close()


def sec_whm(b):
    S = 'whm-cpanel'
    ctx = new_ctx(b); pg = login(ctx, 'admin@viralizahost.test')
    r = pg.request.post(APP + '/api/admin/settings/whm', data={'url': 'https://localhost:2087', 'username': 'root', 'token': 'WHMTESTTOKEN'})
    srv = sql("SELECT whm_api_token LIKE 'WHMTESTTOKEN' FROM servers WHERE name = '__whm_config__'")
    check(S, 'Configurar servidor WHM grava em servers com token cifrado', r.ok and srv and srv[0][0] == '0', (r.status, r.text()[:200], srv))
    r = pg.request.get(APP + '/api/admin/settings/whm'); j = r.json()
    check(S, 'Ler configuração WHM (sem expor o token)', r.ok and 'WHMTESTTOKEN' not in r.text(), r.text()[:200])
    test = pg.request.post(APP + '/api/admin/settings/whm/test') if False else None
    r = pg.request.post(APP + '/api/admin/whm/sync'); j = r.json()
    rows = sql("SELECT whm_username, primary_domain, is_suspended, COALESCE(profile_id, '') FROM whm_accounts ORDER BY whm_username")
    check(S, 'Sincronizar contas do WHM (listaccts) → whm_accounts', r.ok and [x[0] for x in rows] == ['antigo', 'clientea', 'loja'], (r.status, str(j)[:200], rows))
    ua = STATE.get('uid_a') or sql("SELECT id FROM profiles WHERE email = 'cliente.a@exemplo.ao'")[0][0]
    clientea = next((x for x in rows if x[0] == 'clientea'), None)
    if clientea and clientea[3] != ua:
        wid = sql("SELECT id FROM whm_accounts WHERE whm_username = 'clientea'")[0][0]
        r = pg.request.post(APP + f'/api/admin/whm/accounts/{wid}/link', data={'profile_id': ua})
    linked = sql(f"SELECT COUNT(*) FROM whm_accounts WHERE whm_username = 'clientea' AND profile_id = '{ua}'")[0][0]
    check(S, 'Conta cPanel ligada ao cliente (automática pelo email ou manual)', linked == '1', linked)
    r = pg.request.get(APP + '/api/admin/whm/accounts?page=1&limit=20'); j = r.json()
    check(S, 'Lista de contas WHM no painel (filtros, paginação e relações)', r.ok and 'clientea' in r.text() and 'loja' in r.text(), r.text()[:200])
    sql("UPDATE whm_accounts SET profile_id = NULL WHERE whm_username = 'antigo'")
    r = pg.request.get(APP + '/api/admin/whm/accounts?linked=false')
    r2 = pg.request.get(APP + '/api/admin/whm/accounts?linked=true')
    names = lambda resp: sorted(a.get('whm_username') for a in resp.json().get('data', []))
    expected_f = [x[0] for x in sql("SELECT whm_username FROM whm_accounts WHERE profile_id IS NULL ORDER BY whm_username")]
    expected_t = [x[0] for x in sql("SELECT whm_username FROM whm_accounts WHERE profile_id IS NOT NULL ORDER BY whm_username")]
    check(S, 'Filtros "ligadas/não ligadas" (is / not is null) coincidem com a base', r.ok and names(r) == expected_f == ['antigo'] and names(r2) == expected_t, (names(r), expected_f, names(r2), expected_t))
    r = pg.request.post(APP + f'/api/admin/clients/{ua}/whm/suspend', data={'reason': 'Teste de suspensão — ação'})
    s1 = sql("SELECT is_suspended, suspension_reason FROM whm_accounts WHERE whm_username = 'clientea'")[0]
    r2 = pg.request.post(APP + f'/api/admin/clients/{ua}/whm/unsuspend')
    s2 = sql("SELECT is_suspended FROM whm_accounts WHERE whm_username = 'clientea'")[0][0]
    check(S, 'Suspender e reativar conta cPanel (WHM + MySQL)', r.ok and r2.ok and s1 == ['1', 'Teste de suspensão — ação'] and s2 == '0', (r.status, r2.status, s1, s2))
    admin_id = sql("SELECT id FROM profiles WHERE email = 'admin@viralizahost.test'")[0][0]
    n0 = int(sql(f"SELECT COUNT(*) FROM sso_audit_logs WHERE profile_id = '{admin_id}' AND access_type = 'cpanel'")[0][0])
    r = pg.request.post(APP + f'/api/admin/clients/{ua}/whm/cpanel-sso', data={})
    sso = int(sql(f"SELECT COUNT(*) FROM sso_audit_logs WHERE profile_id = '{admin_id}' AND access_type = 'cpanel'")[0][0]) - n0
    check(S, 'SSO para cPanel devolve URL e regista auditoria', r.ok and 'cpsess' in r.text() and int(sso) >= 1, (r.status, r.text()[:200], sso))
    r = pg.request.get(APP + f'/api/admin/clients/{ua}/whm/details')
    check(S, 'Detalhes da conta cPanel do cliente', r.ok, (r.status, r.text()[:200]))
    r = pg.request.post(APP + f'/api/admin/clients/{ua}/whm/sync')
    check(S, 'Sincronizar conta do cliente', r.ok, (r.status, r.text()[:200]))
    r = pg.request.get(APP + '/api/admin/whm/package-mappings')
    check(S, 'Mapeamento de pacotes WHM', r.ok, (r.status, r.text()[:200]))
    pg.goto(APP + '/admin/servers/whm-accounts'); pg.wait_for_timeout(3000)
    check(S, 'Página Servidores → Contas WHM abre e lista contas', 'clientea' in pg.content() and 'Application error' not in pg.content(), pg.url)
    ctx.close()
    # Cliente vê a sua conta de alojamento
    cctx = new_ctx(b); cp = login(cctx, 'cliente.a@exemplo.ao')
    res = db_api(cp, {'table': 'whm_accounts', 'action': 'select', 'columns': 'whm_username', 'filters': [], 'order': []})
    check(S, 'Cliente só vê a própria conta WHM', [x['whm_username'] for x in res.get('data') or []] == ['clientea'], res)
    cp.goto(APP + '/hosting'); cp.wait_for_timeout(3000)
    check(S, 'Página Alojamento do cliente abre', 'Application error' not in cp.content(), cp.url)
    cctx.close()
    # Tarefa agendada
    anon = b.new_context(); ap = anon.new_page()
    r = ap.request.post(APP + '/api/cron/whm-sync')
    r2 = ap.request.post(APP + '/api/cron/whm-sync', headers={'authorization': 'Bearer cron-test'})
    check(S, 'Cron /api/cron/whm-sync: recusa sem segredo e sincroniza com segredo', r.status in (401, 403) and r2.ok, (r.status, r2.status, r2.text()[:200]))
    anon.close()


def sec_public(b):
    S = 'publico'
    ctx = new_ctx(b); pg = ctx.new_page(); reqs = []
    pg.on('request', lambda r: reqs.append(r.url) if 'domain-check' in r.url else None)
    pg.goto(APP + '/'); pg.wait_for_timeout(2500)
    check(S, 'Página inicial abre com o carrossel', pg.evaluate("document.querySelector('main > section').getAttribute('aria-label')") == 'Hero Slideshow')
    inp = pg.get_by_placeholder('Digite o nome do domínio desejado'); inp.scroll_into_view_if_needed()
    inp.fill('viralizateste123'); inp.press('Enter'); pg.wait_for_timeout(4000)
    check(S, 'Pesquisa de domínios mostra resultados', len(reqs) >= 1 and pg.locator('text=viralizateste123.').count() >= 1, len(reqs))
    for path in ['/dominios', '/hospedagem-de-sites', '/email-corporativo', '/checkout?tld=.com&domain=teste.com']:
        pg.goto(APP + path); pg.wait_for_timeout(2000)
        check(S, f'Página pública {path} abre', 'Application error' not in pg.content() and 'Internal Server Error' not in pg.content(), pg.url)
    r = pg.request.get(APP + '/api/products'); j = r.json()
    check(S, 'Catálogo de produtos (MySQL) com características', r.ok and len(j.get('data') or []) > 0 and any(p.get('product_features') for p in j['data']), str(j)[:200])
    ctx.close()


def sec_extra(b):
    S = 'rpc-agente-email'
    ctx = new_ctx(b); pg = login(ctx, 'admin@viralizahost.test')
    r = pg.request.get(APP + '/api/admin/setup-products'); r2 = pg.request.post(APP + '/api/admin/setup-products')
    n = sql("SELECT COUNT(*) FROM product_features f JOIN products p ON p.id = f.product_id WHERE p.slug = 'hosting-start'")[0][0]
    check(S, 'RPC check/setup_product_catalog (catálogo semeado como no PostgreSQL)', r.ok and r2.ok and int(n) == 10, (r.status, r2.status, r2.text()[:150], n))
    r = pg.request.get(APP + '/api/admin/setup-banner-pages'); r2 = pg.request.post(APP + '/api/admin/setup-banner-pages')
    check(S, 'RPC check/setup_banner_pages', r.ok and r2.ok and '"success":true' in r2.text().replace(' ', ''), (r.status, r2.status, r2.text()[:150]))
    sql("UPDATE orders SET status = 'active' WHERE id = (SELECT id FROM (SELECT id FROM orders WHERE status = 'rejected' LIMIT 1) x)")
    sql("DELETE FROM services WHERE order_id IN (SELECT id FROM (SELECT id FROM orders WHERE status = 'active') x) AND service_name = 'Plano Start' AND order_id NOT IN (SELECT id FROM (SELECT order_id AS id FROM invoices WHERE status = 'paid') y)")
    r = pg.request.post(APP + '/api/admin/orders/reconcile')
    check(S, 'RPC reconcile_unprovisioned_orders cria serviços em falta', r.ok, (r.status, r.text()[:200]))
    # Envio de fatura por email: o Resend real não é contactado (rede bloqueada) → a falha tem de ficar registada no MySQL
    ctx.close()
    cctx = new_ctx(b); cp = login(cctx, 'cliente.a@exemplo.ao')
    inv = sql("SELECT i.id FROM invoices i JOIN profiles p ON p.id = i.profile_id WHERE p.email = 'cliente.a@exemplo.ao' ORDER BY invoice_number LIMIT 1")[0][0]
    n0 = int(sql("SELECT COUNT(*) FROM invoice_send_logs")[0][0]) + int(sql("SELECT COUNT(*) FROM email_logs")[0][0])
    r = cp.request.post(APP + '/api/agent/invoices/send-email', data={'invoice_id': inv})
    n1 = int(sql("SELECT COUNT(*) FROM invoice_send_logs")[0][0]) + int(sql("SELECT COUNT(*) FROM email_logs")[0][0])
    em = sql(f"SELECT emailed_at IS NOT NULL FROM invoices WHERE id = '{inv}'")[0][0]
    sent = [e for e in mock('/__state')['emails'] if 'cliente.a@exemplo.ao' in json.dumps(e.get('to'))]
    check(S, 'Envio de fatura por email (PDF anexado) e registo emailed_at no MySQL', r.ok and em == '1' and sent and sent[-1]['attachments'] == 1, (r.status, r.text()[:200], em, sent[-1:]))
    # Envio pelo agente (sendInvoiceEmail): grava email_logs / invoice_send_logs
    out_inv = sql(f"SELECT i.id FROM invoices i JOIN profiles p ON p.id = i.profile_id WHERE p.email = 'cliente.a@exemplo.ao' ORDER BY invoice_number DESC LIMIT 1")[0][0]
    STATE['agent_invoice'] = out_inv
    cctx.close()
    env = dict(os.environ, CLIENT_ID=STATE.get('uid_a') or sql("SELECT id FROM profiles WHERE email = 'cliente.a@exemplo.ao'")[0][0],
               ADMIN_ID=sql("SELECT id FROM profiles WHERE email = 'admin@viralizahost.test'")[0][0])
    out = subprocess.run(['npx', '--yes', 'tsx', '--tsconfig', 'tsconfig.json', 'scripts/mysql-migration/test/agent-tools.test.ts'], capture_output=True, text=True, env=env, cwd=os.path.dirname(os.path.abspath(__file__)) + '/../../..')
    try:
        res = json.loads(out.stdout.strip().split('\n')[-1])
    except Exception:
        check(S, 'Ferramentas do agente de IA executam', False, out.stderr[-500:]); return
    for x in res:
        check(S, f"Agente ({x['level']}): {x['tool']}", x['ok'], x['detail'])
    logs = sql("SELECT (SELECT COUNT(*) FROM invoice_send_logs WHERE status IN ('sent','delivered')), (SELECT COUNT(*) FROM email_logs), (SELECT COUNT(*) FROM invoices WHERE email_status = 'sent')")[0]
    check(S, 'Envio de fatura pelo agente grava invoice_send_logs/email_logs e o estado da fatura', int(logs[0]) >= 1 and int(logs[2]) >= 1, logs)


SECTIONS = {'extra': sec_extra, 'whm': sec_whm, 'publico': sec_public, 'auth': sec_auth, 'cliente': sec_client, 'isolamento': sec_isolation, 'admin': sec_admin, 'hero': sec_hero}

if __name__ == '__main__':
    wanted = sys.argv[1:] or list(SECTIONS)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME)
        for s in wanted:
            try:
                SECTIONS[s](b)
            except Exception as e:
                check(s, 'secção terminou sem exceção', False, repr(e))
        b.close()
    st = mock('/__state')
    check('global', 'Nenhum pedido ao PostgREST em modo MySQL', not st['unexpected'], st['unexpected'][:10])
    prev = json.load(open(RESULTS)) if os.path.exists(RESULTS) and os.environ.get('APPEND') else []
    json.dump(prev + results, open(RESULTS, 'w'), ensure_ascii=False, indent=1)
    fails = [r for r in results if not r['ok']]
    print(f"\n{len(results) - len(fails)}/{len(results)} verificações passaram")
    sys.exit(1 if fails else 0)
