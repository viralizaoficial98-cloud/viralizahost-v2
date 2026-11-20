# Publicação da loja — percurso de compra, catálogo e carrinho

Servidor WHM/cPanel com PM2. **Produção** = processo `viralizahost`, porta 3000, pasta servida `/var/www/viralizahost`,
base `viralizahost_viralizaHost`. **Cópia Git** = `/var/www/viralizahost-main` (só serve para obter o código; não é o que está a correr).
Os processos do Residencial Laguna não são tocados: só se reinicia `viralizahost` e só se criam/apagam os processos de ensaio com nome próprio.

Nada aqui cobra clientes, regista domínios ou altera contas WHM: o ensaio usa uma base própria, um WHM simulado em `127.0.0.1:12087`
e um RDAP simulado em `127.0.0.1:12088`. A publicação só acontece com autorização explícita.

> Os valores secretos nunca são impressos: os comandos abaixo mostram apenas **nomes** de variáveis.

## 0. Diagnóstico (só leitura)

```bash
pm2 ls | tee ~/pm2-antes-$(date +%F-%H%M).txt
pm2 describe viralizahost | grep -E "status|exec cwd|script path|script args"
PROD_DIR=/var/www/viralizahost
GIT_DIR=/var/www/viralizahost-main
```
**Que código está a correr?** A cópia Git não o identifica. Use as impressões digitais do próprio site:
```bash
curl -s https://viralizahost.com/api/version                       # releases a partir deste PR: {"commit":"…"}
for p in /api/version /terms /services /api/checkout/quote /comprar/hosting-start; do curl -s -o /dev/null -w "$p %{http_code}\n" https://viralizahost.com$p; done
curl -s "https://viralizahost.com/api/products?category=hosting" | grep -o '"sale_status"' | head -1   # vazio = API anterior ao PR #31
ls -la "$PROD_DIR" | head; cat "$PROD_DIR/RELEASE_COMMIT" 2>/dev/null; grep -o "\$Format\|[0-9a-f]\{40\}" "$PROD_DIR/src/lib/release-id.ts" 2>/dev/null
```
Em 2026-11-20 o site público respondia 404 em `/terms`, `/services` e `/api/checkout/quote`, e `/api/products` não tinha `sale_status`:
**estava a correr a versão anterior ao PR #31** (a do banner, `95dd1e8`), embora a main já contivesse `f31c010`/`301227c`.

**Estado da base de produção** (contagens, sem dados pessoais):
```bash
umask 077
node --env-file="$PROD_DIR/.env.local" -e 'const e=process.env,q=s=>`"${String(s).replace(/\\/g,"\\\\").replace(/"/g,"\\\"")}"`;require("fs").writeFileSync(process.argv[1],`[client]\nuser=${e.DB_USER}\npassword=${q(e.DB_PASSWORD??"")}\n${e.DB_SOCKET?`socket=${e.DB_SOCKET}`:`host=${e.DB_HOST}\nport=${e.DB_PORT||3306}`}\ndefault-character-set=utf8mb4\n`,{mode:0o600})' ~/.vh-my.cnf
mysql --defaults-extra-file=$HOME/.vh-my.cnf viralizahost_viralizaHost -e "
  SELECT migration FROM vh_schema_migrations ORDER BY migration;
  SELECT (SELECT COUNT(*) FROM products) produtos, (SELECT COUNT(*) FROM site_email_plans) site_email_plans,
         (SELECT COUNT(*) FROM site_hosting_plans) site_hosting_plans, (SELECT COUNT(*) FROM site_domains) site_domains;
  SHOW TABLES LIKE 'product_prices'; SHOW TABLES LIKE 'domain_prices';"
```
Leitura: sem `vh_schema_migrations`/`product_prices` → migrações do PR #31 por aplicar; `site_email_plans = 0` explica o selector «Mensal/Anual» sem cartões
(a versão antiga lê essa tabela); `site_* = 0` explica o painel com «0 itens».

## 1. Release nova a partir da main (cópia Git)

```bash
git -C "$GIT_DIR" fetch origin
git -C "$GIT_DIR" log --oneline -1 origin/main
COMMIT=$(git -C "$GIT_DIR" rev-parse <commit-do-merge-deste-PR>)        # o merge do PR na main
git -C "$GIT_DIR" merge-base --is-ancestor 301227c "$COMMIT" && echo "inclui o PR #31"
REL=/var/www/viralizahost-release-${COMMIT:0:7}
mkdir "$REL" && git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$REL"
grep -c "$COMMIT" "$REL/src/lib/release-id.ts"                           # 1 = commit gravado na release (/api/version)
umask 077 && cp "$PROD_DIR/.env.local" "$REL/.env.local" && chmod 600 "$REL/.env.local"
cp -a "$PROD_DIR"/ecosystem.config.* "$REL"/ 2>/dev/null
chown -R --reference="$PROD_DIR" "$REL"                                  # só se estiver como root
grep -oE '^[A-Z_]+=' "$REL/.env.local" | sort                            # só nomes
grep -q '^WHM_ENCRYPTION_KEY=' "$REL/.env.local" && echo ok-WHM_ENCRYPTION_KEY || echo "FALTA WHM_ENCRYPTION_KEY — parar"
grep -q '^PAYMENT_WEBHOOK_SECRET=' "$REL/.env.local" || printf 'PAYMENT_WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$REL/.env.local"
cd "$REL" && npm ci && npm run build 2>&1 | tail -15
```
O servidor precisa de saída HTTPS para `data.iana.org` e para os servidores RDAP dos registos (`.com`, `.net`, …). Sem isso, todos os
domínios aparecem «A confirmar pela equipa» (nunca como disponíveis).

## 2. Ensaio na porta 3100 (base própria, WHM e RDAP simulados)

```bash
CPUSER=<utilizador-cpanel>
E=${CPUSER}_ensaio
uapi --user=$CPUSER Mysql create_database name=$E
DBU=$(node --env-file="$REL/.env.local" -p 'process.env.DB_USER')
uapi --user=$CPUSER Mysql set_privileges_on_database user=$DBU database=$E privileges=ALL%20PRIVILEGES
D=viralizahost_viralizaHost
mysqldump --defaults-extra-file=$HOME/.vh-my.cnf --no-data --skip-triggers "$D" | mysql --defaults-extra-file=$HOME/.vh-my.cnf "$E"
mysqldump --defaults-extra-file=$HOME/.vh-my.cnf --no-create-info "$D" products product_features site_domains site_email_plans site_hosting_plans banner_pages plans whm_package_mappings company_billing_settings storage_buckets \
  | mysql --defaults-extra-file=$HOME/.vh-my.cnf "$E"
W=/var/www/viralizahost-ensaio; mkdir -p $W/storage && chmod 700 $W
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1 -keyout $W/whm-key.pem -out $W/whm-cert.pem 2>/dev/null
cd "$REL"
DB_NAME=$E node --env-file=.env.local scripts/mariadb/migrate-schema.mjs                     # «Base: …_ensaio»
DB_NAME=$E node --env-file=.env.local scripts/commerce/build-catalog.mjs --apply --sync-email-features
DB_NAME=$E node --env-file=.env.local scripts/mariadb/rehearsal/prepare-server-rehearsal.mjs --whm-port=12087
pm2 start scripts/mariadb/rehearsal/mock-whm.mjs --name viralizahost-whm-simulado -- --port=12087 --cert=$W/whm-cert.pem --key=$W/whm-key.pem --log=$W/whm-pedidos.log
pm2 start scripts/mariadb/rehearsal/mock-rdap.mjs --name viralizahost-rdap-simulado
DB_NAME=$E STORAGE_DIR=$W/storage NODE_EXTRA_CA_CERTS=$W/whm-cert.pem RDAP_BOOTSTRAP_URL=http://127.0.0.1:12088/dns.json \
  AUTH_EMAIL_CONFIRMATION=false ORDER_RATE_LIMIT=500 QUOTE_RATE_LIMIT=200 \
  pm2 start npm --name viralizahost-ensaio --cwd "$REL" -- start -- -p 3100
sleep 6 && curl -s http://127.0.0.1:3100/api/version
DB_NAME=$E BASE_URL=http://127.0.0.1:3100 APP_LOG=$HOME/.pm2/logs/viralizahost-ensaio-out.log SKIP_UI=1 bash scripts/mariadb/rehearsal/run-all.sh
grep -ci 'password=' $W/whm-pedidos.log                                                     # tem de ser 0
```
Esperado: compras 52/52, Área do Cliente 37/37, importação WHM 19/19, «Conjuntos com falhas: 0». Os testes de navegador
(`purchase-flows-e2e.cjs` 116/116, `ui-e2e.cjs` 68/68, auditorias de links) correm onde houver Chromium, contra o mesmo processo de ensaio
(ex.: túnel `ssh -L 3100:127.0.0.1:3100`) sem `SKIP_UI`.

Limpar:
```bash
pm2 delete viralizahost-ensaio viralizahost-whm-simulado viralizahost-rdap-simulado
uapi --user=$CPUSER Mysql delete_database name=$E
rm -rf /var/www/viralizahost-ensaio
```

## 3. Backup

```bash
TS=$(date +%F-%H%M); BK=/var/www/backups/viralizahost-$TS; mkdir -p "$BK" && chmod 700 "$BK"
mysqldump --defaults-extra-file=$HOME/.vh-my.cnf --single-transaction --routines viralizahost_viralizaHost | gzip > "$BK/base.sql.gz"
gunzip -t "$BK/base.sql.gz" && echo "backup da base OK"
pm2 describe viralizahost > "$BK/pm2-describe.txt"
tar --exclude=node_modules --exclude=.next/cache -czf "$BK/release-anterior.tgz" -C /var/www viralizahost
tar -tzf "$BK/release-anterior.tgz" > /dev/null && echo "backup da release OK"
```

## 4. Base de produção: migrações e catálogo

As migrações `20261120_01..04` (PR #31) e `20261121_05` só acrescentam colunas/tabelas (`IF NOT EXISTS`), alargam o ENUM de ciclos
(trimestral) e removem duas restrições UNIQUE. A release anterior continua a funcionar com a base migrada.
```bash
cd "$REL" && env | grep -q '^DB_NAME=' && echo "ATENÇÃO: DB_NAME definido na shell — abrir nova sessão"
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs                 # «Base: viralizahost_viralizaHost»
node --env-file=.env.local scripts/commerce/build-catalog.mjs --apply         # mostra também diferenças nos recursos de e-mail
```
`build-catalog --apply` é repetível: cria só preços que faltam (não reverte preços editados no painel; `--update-prices` NÃO deve ser usado),
põe «sob consulta» os planos sem equivalente público e em rascunho os produtos antigos sem preço de referência.
Se a lista de diferenças dos planos de e-mail for aceite (ex.: «5 contas de e-mail» num plano cobrado por caixa), alinhar com:
```bash
node --env-file=.env.local scripts/commerce/build-catalog.mjs --apply --sync-email-features
```

## 5. Troca de release — só reinicia `viralizahost`

```bash
OLD=/var/www/viralizahost.anterior-$TS
mv /var/www/viralizahost "$OLD" && mv "$REL" /var/www/viralizahost && pm2 restart viralizahost
sleep 8
```
(Sem `--update-env`. O Next lê o `.env.local` da pasta.)

## 6. Verificação pública (como visitante)

```bash
curl -s https://viralizahost.com/api/version                                      # "commit" = $COMMIT, "source":"git-archive"
for p in / /hospedagem-de-sites /email-corporativo /dominios/pesquisar /comprar/hosting-start /checkout /terms /privacy; do curl -s -o /dev/null -w "$p %{http_code}\n" https://viralizahost.com$p; done
curl -s "https://viralizahost.com/api/products?category=hosting" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.data.map(p=>`${p.slug} ${p.sale_status} ${p.price_monthly}`).join("\n"))})'
curl -s "https://viralizahost.com/api/products?category=email" | grep -o '"slug":"email-[a-z]*"' | sort -u   # 3 planos
curl -s "https://viralizahost.com/api/catalog/domains" | grep -o '"extension":"[^"]*"' | head
curl -s "https://viralizahost.com/api/domains/search?q=google.com" | grep -o '"availability":"[a-z_]*"' | head -1   # unavailable
pm2 ls                                                                            # comparar com ~/pm2-antes-*.txt
```
No navegador, numa janela privada: menu **Hospedagem e Sites → Hospedagem de Sites** → «Escolher plano» → pesquisar domínio → «Adicionar ao carrinho e
continuar» → escolher duração → «Adicionar ao carrinho» → o ícone do carrinho no cabeçalho mostra o contador → checkout. Menu **E-mail Corporativo →
Planos e preços de e-mail** mostra 3 planos com preço por caixa. No painel: `/admin/site` mostra contagens (não 0), `/admin/settings/integrations`
lista o que falta, `/admin/site/catalog?cat=hosting` preenche o **pacote WHM** de cada plano (sem ele a activação é manual).

## Reversão

```bash
pm2 logs viralizahost --lines 80 --nostream > "$BK/erro-arranque.log"
mv /var/www/viralizahost /var/www/viralizahost.falhada-$TS && mv "$OLD" /var/www/viralizahost && pm2 restart viralizahost
sleep 8 && curl -s -o /dev/null -w "site após reversão %{http_code}\n" https://viralizahost.com/
```
A base não precisa de ser reposta (as alterações são aditivas). Repor o dump só para desfazer dados — perde encomendas feitas depois do backup:
```bash
gunzip -c "$BK/base.sql.gz" | mysql --defaults-extra-file=$HOME/.vh-my.cnf viralizahost_viralizaHost
```
Depois de confirmado: `pm2 save`.
