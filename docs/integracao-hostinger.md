# Registrador de domínios — Hostinger

Primeiro lançamento: registo de domínios **.com**. A API real respondeu HTTP 200 à disponibilidade e ao catálogo nas 10 extensões internacionais vendidas; **.ai** fica fora da automação até se confirmar um período compatível, com autorização explícita de um administrador em cada encomenda. As outras extensões já podem ser activadas, uma a uma, em Integrações → Registrador. **.ao** e **.co.ao** ficam em registo manual: o painel não as deixa seleccionar. A documentação oficial não confirma o suporte a estas extensões, nem houve consulta à conta.

## Operações da API

Fonte: SDK oficial `github.com/hostinger/api-python-sdk`, pasta `docs/` (DomainsPortfolioApi, DomainsAvailabilityApi, DomainsWHOISApi, BillingCatalogApi, BillingPaymentMethodsApi, BillingOrdersApi e os modelos respectivos).

- Base: `https://developers.hostinger.com`.
- Autenticação: Bearer, com o token gerado no hPanel.
- O portal `developers.hostinger.com` não respondeu a partir do ambiente de desenvolvimento. Tudo o que está abaixo vem do SDK.

| Necessidade | Operação | Confirmada | Uso na ViralizaHost |
|---|---|---|---|
| Listar domínios | `GET /api/domains/v1/portfolio` → `id, domain, type, status, created_at, expires_at, verification` | Sim | «Testar ligação»; recuperação depois de timeout ou 202; encomendas antigas |
| Estado de um domínio | `GET /api/domains/v1/portfolio/{domain}` → `status, registered_at, expires_at, name_servers, …`. Só aparece depois de registado | Sim | «Registado» só com esta confirmação |
| Disponibilidade | `POST /api/domains/v1/availability` `{domain, tlds[], with_alternatives}` → `is_available, is_premium, restriction`. Limite de 90 pedidos/min | Sim | Pesquisa e revalidação antes da compra. Domínios premium vão para revisão manual |
| Preços | `GET /api/billing/v1/catalog?name=.COM*` → `prices[]: id, currency, price, first_period_price, period, period_unit` (cêntimos) | Sim; o filtro é por prefixo (ver «Selecção do produto e do preço») | Produto pela extensão exacta e um só preço do período; caso contrário, revisão manual |
| Comprar e registar | `POST /api/domains/v1/portfolio` `{domain, item_id, payment_method_id?, domain_contacts{owner_id,admin_id,billing_id,tech_id}, additional_details?, coupons?}` → encomenda `{id, status, currency, subtotal, total}` | Sim | Só a partir do diálogo «Registar na Hostinger». Sem `payment_method_id`, a Hostinger usa o método predefinido; a ViralizaHost envia o id do método predefinido mostrado ao administrador |
| Pagamento pendente | Resposta **HTTP 202**: o pagamento está em processamento e o domínio **não** foi registado | Sim | Estado «Pagamento ao fornecedor pendente». Só é possível consultar, nunca comprar de novo |
| Concluir registo já pago | `POST /api/domains/v1/portfolio/{domain}/setup` `{domain_contacts?, additional_details?}`. Sem nova encomenda nem pagamento | Sim | «Concluir registo (sem nova compra)» |
| Nameservers | `PUT /api/domains/v1/portfolio/{domain}/nameservers` `{ns1, ns2, ns3?, ns4?}` | Sim | Aplicados depois de registado (a compra não aceita nameservers) |
| Contactos do titular | `POST /api/domains/v1/whois` `{tld, country, entity_type, whois_details, tld_details?}` → `{id}`. As chaves exigidas dependem da extensão e do país; um 422 lista as que faltam em `errors.whois_details` | Sim (as chaves por extensão não estão documentadas) | Perfil criado uma vez por titular e extensão. Um 422 pede a correcção antes de qualquer compra |
| Método de pagamento | `GET /api/billing/v1/payment-methods` → `id, name, identifier, is_default, is_expired, is_suspended` | Sim | Só o rótulo (ex.: «Visa **** 4242»). O cartão fica na Hostinger |
| Estado de uma encomenda | Não existe GET de encomendas de facturação | **Não** | A recuperação usa o portefólio. Se continuar inconclusivo, vai para revisão manual no hPanel |
| Verificação pendente | `verification.type`: `manual_review`, `sms_code`, `contact_verification` | Sim | Mostra a acção a fazer no hPanel |

**Campos do titular enviados** (`whois_details`): `first_name`, `last_name`, `company_name`, `email`, `phone`, `address`, `city`, `state`, `zip`, `country`.
- O `entity_type` é `individual`, ou `organization` quando há empresa.
- Os nomes das chaves e os valores de `entity_type` não estão na documentação: são inferidos. Se a Hostinger os recusar, o 422 aparece no diálogo para correcção e nada é comprado.
- A ViralizaHost exige sempre nome, apelido, e-mail, telefone, morada, cidade e país (ISO de 2 letras).

## Selecção do produto e do preço (catálogo)

O filtro `GET /api/billing/v1/catalog?name=.COM*` é por **prefixo**. Respostas reais:

| Filtro | Produtos devolvidos |
|---|---|
| `.COM*` | .COM Domain, .COM.BR Domain, .COM.ES Domain, .COMPANY Domain |
| `.NET*` | .NET Domain, .NET.IN Domain, .NETWORK Domain |
| `.ORG*` | .ORG Domain, .ORG.BR Domain, .ORG.UK Domain |
| `.SHOP*` | .SHOP Domain, .SHOPPING Domain |
| `.AI*` | .AI Domain, sem preço de 1 ano (o teste só listou outro período) |

Regra (`src/lib/registrar/hostinger-catalog.ts`):
1. O produto escolhe-se pela **extensão exacta do nome** («.COM Domain» → `.com`; «.COM.BR Domain» → `.com.br`). A comparação é normalizada e não distingue maiúsculas. Nunca se escolhe por prefixo nem pelo id. Transferências, renovações e outras categorias ficam excluídas.
2. Depois escolhe-se **um** preço para o período pedido: `year` × N, ou `month` × 12·N.
3. Moeda e valores em **unidades menores** ficam tal como a API os devolve (`registrar_operations.cost_minor`, `cost_currency`).
4. Vai para revisão manual quando:
   - não há produto exacto;
   - há mais de um produto exacto;
   - não há preço para o período;
   - há mais de um preço para o período;
   - o preço é inválido.

Testes de regressão com os exemplos reais: `node --test scripts/registrar/hostinger-catalog.test.mjs`.

**Consulta só de leitura** (só faz `GET` ao catálogo). Lista os produtos devolvidos, o produto exacto, todos os seus períodos (unidades menores e moeda) e a selecção. Para confirmar os períodos de «.AI Domain»:

```bash
read -rsp "Token Hostinger: " HOSTINGER_TOKEN; echo; cd /var/www/viralizahost-main && HOSTINGER_TOKEN="$HOSTINGER_TOKEN" node scripts/registrar/hostinger-catalogo.mjs .ai .com .net .org .shop; unset HOSTINGER_TOKEN
```

**.ai** está em registo manual (`manualExtensions` da Hostinger em `src/lib/registrar/settings.ts`): o painel mostra-a desactivada «(por confirmar)» e o servidor recusa-a. Só deve sair desta lista quando a consulta acima mostrar um período compatível com a oferta da ViralizaHost (registo de 1 ano a 3 anos). Os preços de venda **não** são alterados com base nestes valores.

## Comportamento na ViralizaHost

1. **Integrações → Registrador → Hostinger**
   - Token próprio, guardado cifrado (o mesmo mecanismo das outras credenciais). O painel só mostra «configurado»; mudar de fornecedor apaga o token anterior.
   - «Testar ligação» só faz leituras (portefólio e métodos de pagamento) e diz se o token foi aceite.
   - Em produção o endereço da API é sempre o oficial. Em ensaio aponta para a API simulada.
2. **Aprovar o pagamento nunca compra.** O domínio fica em «Aguarda autorização: Registar na Hostinger».
3. **«Registar na Hostinger…»** (encomenda paga, domínio .com autorizado):
   - Pré-visualização com domínio, período, titular, nameservers, custo e moeda da Hostinger, e método de pagamento predefinido, com o aviso de que pode haver débito.
   - O administrador marca a confirmação e confirma.
   - Antes de enviar, o servidor volta a validar pagamento, portefólio, disponibilidade, custo e titular. Se algo mudou desde a pré-visualização, pede nova revisão.
4. **Segurança contra duplicação**
   - Uma operação por item (`registrar_operations`) e uma reserva de 120 s: duplo clique, dois separadores ou dois administradores geram uma só compra.
   - Timeout ou resposta ambígua (5xx) → «inconclusivo». A acção seguinte consulta o portefólio; se o domínio aparecer, associa-o sem nova compra.
   - Se continuar ausente, vai para revisão manual no hPanel. Só então «Libertar nova tentativa…», com nota obrigatória e nova consulta antes de libertar.
5. **Encomendas antigas** (cenário de referência VH-ORD-202611-0002 / krutuja.com). Antes de qualquer compra, a ViralizaHost consulta a conta:
   - domínio já registado → «Associar (sem nova compra)»;
   - domínio pago a aguardar configuração → «Concluir registo (sem nova compra)».
6. **Nameservers e DNS.** Os nameservers da encomenda são aplicados depois do registo. Uma falha aparece à parte («Nameservers por aplicar», com repetição) e não desfaz o registo. «DNS pendente» mantém-se até a delegação pública responder com os nameservers esperados («Verificar DNS»).
7. **«Marcar como registado…»** mantém-se para registos manuais (com referência) e nunca chama a Hostinger.

## Migração

`database/mariadb/migrations/20261127_11_registrar_hostinger.sql`. É idempotente e não altera dados existentes:
- acrescenta colunas a `registrar_operations` (autorização, custo, item, encomenda do fornecedor, nameservers, DNS e reserva);
- cria `registrar_operation_events`, com a auditoria de cada tentativa e consulta;
- cria `registrar_contacts`, com os perfis WHOIS criados na Hostinger.

## Configurar em produção (só leitura)

1. hPanel → perfil → **API** → gerar um token. Guarde-o só no painel da ViralizaHost.
2. Painel ViralizaHost → **Integrações → Registrador de domínios**:
   - Fornecedor «Hostinger», modo «Produção»;
   - colar o token;
   - seleccionar só **.com**;
   - «Guardar».
3. **Testar ligação**. Deve aparecer «Token aceite pela Hostinger: N domínio(s) na conta. Método de pagamento predefinido: …». Este teste só lê; não compra nem regista.
4. Activar a integração (exige um teste bem-sucedido). Activar não compra nada: cada compra continua a exigir «Confirmar e registar» numa encomenda.
5. Validar a encomenda antiga, só por leitura: Encomendas → VH-ORD-202611-0002 → «Registar na Hostinger…» abre a pré-visualização, que só consulta a conta.
   - Se krutuja.com já estiver pago na conta Hostinger, o diálogo propõe «Concluir registo (sem nova compra)».
   - Se já estiver registado, propõe «Associar domínio já registado».
   - Se não estiver na conta, mostra o custo e o botão de compra. **Não confirmar a compra** sem decisão explícita.

## Publicação

Executar depois do merge na `main`. Aplica a migração `20261127_11_registrar_hostinger.sql`, compila e reinicia **só** `viralizahost`. Não altera a configuração do registrador e não chama a Hostinger.

```bash
bash -s <<'PUBLICAR'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
DB=viralizahost_viralizaHost
TS=$(date +%F-%H%M)

echo "== 1. Commit da main e versão em produção"
git -C "$GIT_DIR" fetch -q origin main
git -C "$GIT_DIR" checkout -q main
git -C "$GIT_DIR" merge -q --ff-only origin/main
COMMIT=$(git -C "$GIT_DIR" rev-parse HEAD)
DEPLOYED=$(curl -fsS https://viralizahost.com/api/version | grep -o '"commit":"[0-9a-f]\{40\}"' | cut -d'"' -f4 || true)
[ -n "$DEPLOYED" ] || { echo "Não foi possível ler o commit em produção (/api/version) — parar"; exit 1; }
echo "main: $(git -C "$GIT_DIR" log --oneline -1) · produção: $DEPLOYED"
git -C "$GIT_DIR" merge-base --is-ancestor "$DEPLOYED" "$COMMIT"
git -C "$GIT_DIR" diff --name-only "$DEPLOYED" "$COMMIT" -- database/mariadb/migrations

echo "== 2. Configuração (só nomes, sem valores)"
for k in WHM_ENCRYPTION_KEY; do grep -q "^$k=." "$PROD_DIR/.env.local" && echo "$k: definido" || { echo "$k: EM FALTA — o token não pode ser cifrado"; exit 1; }; done
grep -q '^REGISTRAR_TEST_PROVISIONING=1' "$PROD_DIR/.env.local" && { echo "REGISTRAR_TEST_PROVISIONING=1 em produção — remover antes de publicar"; exit 1; } || true

echo "== 3. Backup da base e da pasta de produção"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
chmod 600 "/var/backups/viralizahost-base-$TS.sql.gz" "/var/backups/viralizahost-prod-$TS.tgz"
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"

echo "== 4. Código (preserva .env.local, node_modules e ficheiros carregados)"
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
git -C "$GIT_DIR" diff --name-only --diff-filter=D "$DEPLOYED" "$COMMIT" | while read -r f; do rm -f -- "$PROD_DIR/$f" && echo "removido: $f"; done
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$DEPLOYED" "$COMMIT" -- package.json package-lock.json; then npm ci; fi

echo "== 5. Migração (20261127_11_registrar_hostinger.sql)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SHOW TABLES LIKE 'registrar_operation_events'; SHOW TABLES LIKE 'registrar_contacts'; SHOW COLUMNS FROM registrar_operations LIKE 'locked_until'; SELECT provider, mode, enabled, JSON_LENGTH(extensions) ext FROM registrar_settings"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -sS -o /dev/null -w "registo Hostinger sem sessão %{http_code} (esperado 401)\n" -X POST -H 'Content-Type: application/json' -d '{}' https://viralizahost.com/api/admin/registrar/hostinger
curl -sS -o /dev/null -w "/admin/settings/integrations/registrar %{http_code}\n" https://viralizahost.com/admin/settings/integrations/registrar
pm2 ls
PUBLICAR
```

Depois seguir «Configurar em produção (só leitura)», acima.

**Reversão:** repor `/var/backups/viralizahost-prod-<TS>.tgz`, compilar e reiniciar `viralizahost`. A migração só acrescenta colunas e tabelas, por isso a versão anterior continua a funcionar.

## Activar e diagnosticar «Registar na Hostinger»

**Correcção do PR seguinte ao #39.** Activar a integração pelo painel era sempre recusado com «Teste a ligação com sucesso antes de activar a integração»:
- A página envia o campo «Utilizador», que fica escondido para a Hostinger, como `''`, e o servidor comparava esse valor com o `NULL` guardado. A configuração contava como «alterada» e o teste de ligação deixava de valer.
- A caixa «Activar integração» ficava marcada depois do erro, por isso a integração parecia activa com `enabled = 0` na base.
- Com `enabled = 0`, a lista de encomendas escondia o botão e «Repetir» gravava «extensão sem integração automática activa».

Agora:
- Os campos vazios contam como «sem valor».
- Se a gravação falhar, a caixa volta ao estado guardado, com a etiqueta «activa/inactiva» e um aviso «ligação testada, mas inactiva».
- A elegibilidade é calculada no servidor com a configuração actual e o domínio normalizado (`GET /api/admin/orders` → `services[].hostinger`), com o motivo visível quando não é elegível.
- As encomendas antigas com acções pendentes aparecem sempre na lista, mesmo fora das 300 mais recentes.

**Consulta só de leitura** em produção (não altera nada):

```bash
mysql --defaults-extra-file="$HOME/.vh-my.cnf" viralizahost_viralizaHost -e "
SELECT provider, mode, enabled, extensions, last_test_ok, last_test_at FROM registrar_settings WHERE id = 1;
SELECT o.order_number, o.payment_status, s.service_type, CONCAT('[', s.domain, ']') dominio, s.provisioning_status, s.provisioning_error, oi.domain_operation
  FROM orders o JOIN services s ON s.order_id = o.id LEFT JOIN order_items oi ON oi.id = s.order_item_id WHERE o.order_number = 'VH-ORD-202611-0002';
SELECT ro.provider, ro.status, ro.provider_status, ro.attempts FROM registrar_operations ro JOIN services s ON s.id = ro.service_id JOIN orders o ON o.id = s.order_id WHERE o.order_number = 'VH-ORD-202611-0002';"
```

Interpretação:
- **`enabled = 0` com `last_test_ok = 1`:** é o bug acima. Depois de publicar, marque «Activar integração» e «Guardar».
- **Linha em `registrar_operations` de outro fornecedor com estado `submitted`/`unknown`:** resolva-a com «Libertar nova tentativa…» ou «Marcar como registado…».
