# Servidor VPS — planos, compra e Hostinger VPS

Capacidades da API confirmadas na especificação oficial: ver `docs/hostinger-vps-api.md`.

## O que muda

**Página pública `/servidor-vps`**
- Cada plano é uma faixa horizontal. À esquerda fica a imagem; ao centro, o nome, o resumo, vCPU, RAM, armazenamento, tráfego e rede (com ícones e rótulos) e as características extras; à direita, o preço e «Comprar agora».
- No telemóvel a faixa passa a coluna, sem deslocamento horizontal.
- Só aparecem os planos publicados. Os selos («Mais popular», «Disponibilidade limitada»…) só aparecem quando o administrador os define.
- O selector de período mostra o preço em Kz por mês e o total a pagar. Com desconto, mostra o preço mensal original riscado e «Poupe X%». O preço de renovação também aparece.
- Os VPS com subcategoria (n8n, Evolution, AI Cloud, OpenClaw) não mudam.

**«Comprar agora»**
- Substitui «Configurar» nos botões de aquisição da Hospedagem, do E-mail Corporativo e dos VPS. O destino (`/comprar/<plano>?ciclo=`) mantém-se.
- Os controlos que configuram um serviço já adquirido (por exemplo «Configurar Redirecionamento») não mudam.

**Painel → Catálogo e Preços → VPS**
- Na lista: ordenar (↑↓), publicar e despublicar.
- Na ficha: nome, resumo, imagem (PNG/JPEG/WebP até 2 MB, validada pelo conteúdo), selo, destaque, ordem, vCPU, RAM, disco (capacidade e NVMe/SSD), tráfego (limite ou «Ilimitado»), rede e até 20 características extras com ícone de uma lista controlada.
- Preço base mensal e desconto por ciclo (1, 3, 6, 12, 24 e 36 meses), com total, renovação e pré-visualização da faixa.
- **Associação à Hostinger**:
  - produto exacto do catálogo, com modo automático ou manual;
  - por ciclo: item de preço, custo esperado, moeda e limite de custo. O preço de venda em Kz é sempre definido pela ViralizaHost e fica separado do custo do fornecedor.
  - O servidor recusa características anunciadas que não correspondam ao produto associado (vCPU, RAM, disco, tráfego e «Ilimitado» num produto com limite).
- Preços e permissões são validados no servidor (só administradores). As alterações ficam em `activity_logs`.

**Compra** (`/comprar/<plano>`): Plano e período → Localização e sistema → Rever (carrinho) → Pagar → Activação.
- Só aparecem as localizações e os sistemas activados em Integrações → Hostinger VPS.
- A encomenda guarda o plano, o ciclo, as opções (`order_items.options`) e o preço aceite.
- O servidor revalida tudo. Se o total mudar, devolve 409 `price_changed` e o cliente reconfirma.
- O pagamento usa o checkout, a factura e o comprovativo que já existem.
- O estado do pagamento e o da activação aparecem separados na Área do Cliente e no painel.

**Integrações → Hostinger VPS**
- Token guardado cifrado no servidor. Se não houver token próprio, usa o do Registrador Hostinger. O token nunca volta ao navegador.
- «Testar ligação» só faz leituras. Actualiza as localizações e os sistemas.
- O aprovisionamento automático é uma opção explícita. Para a activar é preciso: confirmação, um teste com sucesso e um método de pagamento da conta Hostinger.
- **Compras reais** precisam, além disso, de `VPS_LIVE_PURCHASES=1` no servidor. **Esta variável não é definida nesta publicação** e fica para aprovação.

**Activação depois do pagamento validado**
- Em modo automático, antes de comprar, o preço actual do item é comparado com o limite e a moeda do plano.
- A compra envia só `item_id`, `payment_method_id` e `setup` (template, centro de dados e hostname único por item).
- **Nunca são enviados** comprovativos, dados de pagamento, dados do cliente nem palavra-passe.
- Há uma compra por item (operação única por serviço). Uma resposta inconclusiva **nunca é repetida**: a conciliação procura a VM pelo hostname ou pela subscrição. Se não a confirmar, o caso vai para revisão manual.
- Resposta 202: quando a VM fica `initial`, `/setup` é chamado uma única vez.
- Com a VM `running`, o serviço fica activo com a referência `VM <id> · <IP>`.
- **Sem automação** (opção desligada, plano manual, custo acima do limite ou API indisponível):
  - o checkout funciona igual;
  - o painel mostra a tarefa «Tarefa da equipa: adquirir o VPS…» (filtro «VPS: tarefas e compras»);
  - a equipa compra no hPanel e usa «Associar VPS…»;
  - o cliente vê «Activação em tratamento pela equipa».
- **Acções do painel:**
  - «Consultar Hostinger»: só lê; nunca compra;
  - «Associar VPS…»: liga ao serviço uma VM adquirida pela equipa;
  - «Confirmar não comprado…»: depois de verificar no hPanel, permite uma nova tentativa, que fica no histórico.
- **Cron** `/api/cron/vps-sync` (protegido por `CRON_SECRET`): concilia as compras em aberto. Só faz leituras e `/setup`.

## Migração `20261204_18_vps_plans.sql`

Idempotente. Aplica-se depois da 17.
- **Colunas novas:**
  - `products`: `image_path`, `provider_product_id`, `provider_mode` (por omissão `manual`), `provider_specs`;
  - `product_features.icon`;
  - `product_prices`: `provider_item_id`, `provider_cost_minor`, `provider_currency`, `provider_cost_limit_minor`;
  - `order_items.options`.
- **Tabelas novas:** `vps_provider_settings`, `vps_provider_orders` (únicas por serviço e por referência) e `vps_provider_events`.
- **Dados:** nos VPS sem subcategoria e ainda sem preço base, calcula `base_monthly_price` e `discount_pct` a partir dos preços **guardados**. Os preços, os planos e as encomendas não mudam, e os planos ficam em activação manual.

## Testes (ensaio: MariaDB 10.11, API Hostinger simulada)

`scripts/mariadb/rehearsal/vps-purchase-e2e.cjs` (novo, incluído em `run-all.sh`, desktop 1440 e iPhone 13). Resultado: **121 OK, 0 falhadas**. Cobre:
- migração e permissões;
- integração: teste só de leitura e activação explícita;
- validação dos planos;
- edição no formulário (descontos, selo, ícones, associação e pré-visualização), imagem, ordem e publicação;
- página pública em desktop e telemóvel;
- «Comprar agora» na Hospedagem e no E-mail;
- compra completa com comprovativo pendente e validação concorrente: um pagamento e uma compra, só com os parâmetros necessários;
- VM activa;
- cenários do fornecedor: recusa, resposta perdida (revisão manual, sem nova compra até a equipa confirmar), resposta lenta (conciliada, sem segunda compra), 202 (`/setup` único com conciliações em paralelo) e custo acima do limite;
- duas encomendas iguais em paralelo (uma compra por item);
- fluxo manual com tarefa e «Associar VPS…»;
- preço alterado (409), opções inválidas e âmbito (outros produtos e encomendas anteriores inalterados).

Variáveis só de ensaio: `REGISTRAR_TEST_PROVISIONING=1` e `VPS_PROVIDER_TIMEOUT_MS=2000`, com `mock-hostinger.mjs --vps-ready=3000`.

## Publicação

Executar depois do merge e **só com aprovação**. Reinicia **só** `viralizahost`. Não define `VPS_LIVE_PURCHASES`, por isso não há compras reais.

```bash
bash -s <<'PUBLICAR'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
DB=viralizahost_viralizaHost
TS=$(date +%F-%H%M)
Q="mysql --defaults-extra-file=$HOME/.vh-my.cnf $DB"
SNAP="SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', pp.product_id, pp.cycle, pp.price, pp.renewal_price, pp.active) ORDER BY pp.product_id, pp.cycle)) h FROM product_prices pp; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, payment_status, amount) ORDER BY id)) h FROM orders; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, slug, name, sale_status) ORDER BY id)) h FROM products"

echo "== 1. Commit da main e versão em produção"
git -C "$GIT_DIR" fetch -q origin main
git -C "$GIT_DIR" checkout -q main
git -C "$GIT_DIR" merge -q --ff-only origin/main
COMMIT=$(git -C "$GIT_DIR" rev-parse HEAD)
DEPLOYED=$(curl -fsS https://viralizahost.com/api/version | grep -o '"commit":"[0-9a-f]\{40\}"' | cut -d'"' -f4 || true)
[ -n "$DEPLOYED" ] || { echo "Não foi possível ler o commit em produção (/api/version) — parar"; exit 1; }
echo "main: $(git -C "$GIT_DIR" log --oneline -1) · produção: $DEPLOYED"
git -C "$GIT_DIR" merge-base --is-ancestor "$DEPLOYED" "$COMMIT"
echo "Migrações novas (aplicadas por esta ordem):"
git -C "$GIT_DIR" diff --name-only "$DEPLOYED" "$COMMIT" -- database/mariadb/migrations | sort

echo "== 2. Preços, planos e encomendas (antes)"
$Q -e "$SNAP" | tee "/var/backups/viralizahost-vps-antes-$TS.txt"

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
grep -q '^VPS_LIVE_PURCHASES=' .env.local && { echo "VPS_LIVE_PURCHASES definido em .env.local — parar (compras reais por aprovar)"; exit 1; } || true
grep -q '^REGISTRAR_TEST_PROVISIONING=' .env.local && { echo "REGISTRAR_TEST_PROVISIONING definido em produção — parar"; exit 1; } || true

echo "== 5. Migração 18 (depois da 17, se pendente)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "$SNAP" > "/var/backups/viralizahost-vps-depois-$TS.txt"
diff "/var/backups/viralizahost-vps-antes-$TS.txt" "/var/backups/viralizahost-vps-depois-$TS.txt" && echo "OK: preços, planos e encomendas inalterados"
$Q -e "SHOW TABLES LIKE 'vps_provider%'; SHOW COLUMNS FROM order_items LIKE 'options'; SHOW COLUMNS FROM product_features LIKE 'icon'"
$Q -e "SELECT slug, sale_status, base_monthly_price, provider_mode FROM products WHERE category = 'vps' AND subcategory IS NULL ORDER BY position"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in /servidor-vps /hospedagem-de-sites /email-corporativo; do curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
curl -sS -o /dev/null -w "painel VPS sem sessão %{http_code} (esperado 401)\n" https://viralizahost.com/api/admin/catalog/vps-plans
curl -sS -o /dev/null -w "integração sem sessão %{http_code} (esperado 401)\n" https://viralizahost.com/api/admin/integrations/hostinger-vps
curl -sS -o /dev/null -w "cron sem segredo %{http_code} (esperado 401)\n" https://viralizahost.com/api/cron/vps-sync
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:
1. **Catálogo e Preços → VPS:** rever os planos, que continuam com os mesmos preços e em activação manual. Preencher as características (vCPU, RAM, disco, tráfego e rede), os ícones e os selos, e publicar.
2. **Integrações → Hostinger VPS:**
   - modo «Produção»;
   - «Testar ligação» só lê; confirma o que o token e a conta permitem (catálogo VPS, centros de dados, sistemas e métodos de pagamento);
   - activar as localizações e os sistemas a oferecer.
   - **Não activar o aprovisionamento automático** sem aprovação.
3. Até haver aprovação, cada VPS pago fica como tarefa da equipa em **Encomendas** (filtro «VPS: tarefas e compras»): adquirir no hPanel e depois «Associar VPS…».
4. Cron de conciliação (cPanel, a cada 15 min):
   `curl -s -X POST https://viralizahost.com/api/cron/vps-sync -H "Authorization: Bearer <CRON_SECRET>" > /dev/null`
5. Se tudo estiver bem: `pm2 save`.

**Activar compras reais (aprovação separada).** Só depois de rever os planos associados (produto exacto, itens por ciclo, custos e limites):
1. Acrescentar `VPS_LIVE_PURCHASES=1` ao `.env.local` de produção e executar `pm2 restart viralizahost`.
2. Em Integrações → Hostinger VPS: escolher o método de pagamento, marcar «Activar o aprovisionamento automático» e a confirmação, e guardar.
3. Pôr os planos em modo automático.

## Reversão

```bash
bash -s <<'REVERTER'
set -euo pipefail
TS=<data-hora do backup>
tar -xzf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www
cd /var/www/viralizahost && npm run build 2>&1 | tail -3
pm2 restart viralizahost
sleep 8
curl -fsS https://viralizahost.com/api/version; echo
REVERTER
```

As tabelas e colunas novas não afectam a versão anterior. Não é preciso desfazer a migração.
