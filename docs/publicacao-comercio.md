# Publicação da loja (catálogo, checkout, pagamentos, activação, Área do Cliente)

Servidor WHM/cPanel com PM2: produção = processo `viralizahost` na porta 3000, base `viralizahost_viralizaHost`.
Os processos do Residencial Laguna **não são tocados** (só se usa `pm2 restart viralizahost`, `pm2 start/delete` dos processos de ensaio com nome próprio).

Ordem: 0 confirmar a release activa → 1 release nova a partir do PR #31 → 2 ensaio em base separada (porta 3100, WHM simulado) → 3 backup → 4 migrações + catálogo na base de produção → 5 troca de release → 6 verificação → rollback se necessário.

Nada neste procedimento cobra clientes, regista domínios ou altera contas WHM reais: o ensaio usa uma base própria e um WHM simulado em `127.0.0.1:12087`; em produção, a única escrita no WHM é a criação de contas **depois** de um pagamento confirmado pela equipa.

## 0. Release activa (só leitura)
```bash
pm2 ls | tee ~/pm2-antes-$(date +%F-%H%M).txt
PROD_DIR=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="viralizahost");if(!p)process.exit(1);console.log(p.pm2_env.pm_cwd)})'); echo "$PROD_DIR"
grep -q "min(70svh,680px)" "$PROD_DIR/src/components/landing/HeroVideo.tsx" && echo "release activa contém 95dd1e8 (banner publicado)"
ss -ltnp | grep -E ':3000 |:3100 |:12087 '     # 3000 = produção; 3100 e 12087 têm de estar livres
```
Confirmar que a produção não tem alterações feitas à mão fora do Git (deve listar só `.env*`, `node_modules`, `.next`):
```bash
TESTE=/var/www/viralizahost-mariadb-teste
git -C "$TESTE" fetch origin pull/31/head
mkdir -p /tmp/vh-95dd1e8 && git -C "$TESTE" archive 95dd1e8 | tar -x -C /tmp/vh-95dd1e8
diff -rq --exclude=node_modules --exclude=.next --exclude='.env*' --exclude=ecosystem.config.js /tmp/vh-95dd1e8 "$PROD_DIR" | head -20
```
Se aparecer algum ficheiro de código diferente, parar e enviar a lista (sem conteúdos) para incorporar antes de publicar.

## 1. Release nova (PR #31)
```bash
COMMIT=$(git -C "$TESTE" rev-parse FETCH_HEAD); echo "$COMMIT"
git -C "$TESTE" merge-base --is-ancestor 95dd1e8 "$COMMIT" && echo "inclui a release activa"
REL=/var/www/viralizahost-release-${COMMIT:0:7}
mkdir "$REL" && git -C "$TESTE" archive "$COMMIT" | tar -x -C "$REL"
umask 077 && cp "$PROD_DIR/.env.local" "$REL/.env.local" && chmod 600 "$REL/.env.local"
cp -a "$PROD_DIR"/ecosystem.config.* "$REL"/ 2>/dev/null
grep -oE '^[A-Z_]+=' "$REL/.env.local" | sort        # só nomes
```
Variável nova obrigatória para notificações de pagamento (gateway): acrescentar só se ainda não existir.
```bash
grep -q '^PAYMENT_WEBHOOK_SECRET=' "$REL/.env.local" || printf 'PAYMENT_WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$REL/.env.local"
grep -q '^WHM_ENCRYPTION_KEY=' "$REL/.env.local" && echo "WHM_ENCRYPTION_KEY presente" || echo "FALTA WHM_ENCRYPTION_KEY — parar"
```
```bash
cd "$REL" && npm ci && npm run build 2>&1 | tail -15
```

## 2. Ensaio (base separada, porta 3100, WHM simulado)
Criar a base de ensaio no cPanel (Bases de dados MySQL) ou pela linha de comandos, com o mesmo utilizador da aplicação (`DB_USER` do `.env.local`):
```bash
CPUSER=<utilizador-cpanel>
uapi --user=$CPUSER Mysql create_database name=${CPUSER}_ensaio
DBU=$(node --env-file="$REL/.env.local" -p 'process.env.DB_USER')
uapi --user=$CPUSER Mysql set_privileges_on_database user=$DBU database=${CPUSER}_ensaio privileges=ALL%20PRIVILEGES
```
Estrutura igual à produção + só tabelas de configuração/catálogo (sem clientes, encomendas ou facturas):
```bash
D=viralizahost_viralizaHost; E=${CPUSER}_ensaio
mysqldump --defaults-extra-file=$HOME/.vh-my.cnf --no-data --skip-triggers "$D" | mysql --defaults-extra-file=$HOME/.vh-my.cnf "$E"
mysqldump --defaults-extra-file=$HOME/.vh-my.cnf --no-create-info "$D" products product_features site_domains site_email_plans site_hosting_plans banner_pages plans whm_package_mappings company_billing_settings storage_buckets | mysql --defaults-extra-file=$HOME/.vh-my.cnf "$E"
```
Certificado do WHM simulado (só para o ensaio) e base de ensaio preparada:
```bash
W=/var/www/viralizahost-ensaio; mkdir -p $W/storage && chmod 700 $W
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1 -keyout $W/whm-key.pem -out $W/whm-cert.pem 2>/dev/null
cd "$REL"
DB_NAME=$E node --env-file=.env.local scripts/mariadb/migrate-schema.mjs            # deve mostrar «Base: ..._ensaio»
DB_NAME=$E node --env-file=.env.local scripts/commerce/build-catalog.mjs --apply
DB_NAME=$E node --env-file=.env.local scripts/mariadb/rehearsal/prepare-server-rehearsal.mjs --whm-port=12087
pm2 start scripts/mariadb/rehearsal/mock-whm.mjs --name viralizahost-whm-simulado -- --port=12087 --cert=$W/whm-cert.pem --key=$W/whm-key.pem --log=$W/whm-pedidos.log
DB_NAME=$E STORAGE_DIR=$W/storage NODE_EXTRA_CA_CERTS=$W/whm-cert.pem AUTH_EMAIL_CONFIRMATION=false \
  pm2 start npm --name viralizahost-ensaio --cwd "$REL" -- start -- -p 3100
sleep 6 && curl -s -o /dev/null -w "ensaio %{http_code}\n" http://127.0.0.1:3100/
```
`DB_NAME=` antes do comando tem prioridade sobre o `.env.local`: o processo de ensaio só vê a base de ensaio. `prepare-server-rehearsal.mjs` e `run-all.sh` recusam correr se o nome da base não contiver «ensaio».

Testes (sem Chromium no servidor, `SKIP_UI=1`; a interface desktop/iPhone e os links já foram ensaiados no ambiente de desenvolvimento):
```bash
cd "$REL" && DB_NAME=$E BASE_URL=http://127.0.0.1:3100 APP_LOG=$HOME/.pm2/logs/viralizahost-ensaio-out.log SKIP_UI=1 bash scripts/mariadb/rehearsal/run-all.sh
grep -c createacct $W/whm-pedidos.log; grep -ci 'password=' $W/whm-pedidos.log     # o 2.º tem de ser 0
```
Esperado: compras 52/52, Área do Cliente 37/37, importação WHM 19/19, «Conjuntos com falhas: 0».

Limpar o ensaio:
```bash
pm2 delete viralizahost-ensaio viralizahost-whm-simulado
uapi --user=$CPUSER Mysql delete_database name=${CPUSER}_ensaio
rm -rf /var/www/viralizahost-ensaio
```

## 3. Backup
```bash
TS=$(date +%F-%H%M); BK=/var/www/backups/viralizahost-$TS; mkdir -p "$BK" && chmod 700 "$BK"
mysqldump --defaults-extra-file=$HOME/.vh-my.cnf --single-transaction --routines viralizahost_viralizaHost | gzip > "$BK/base.sql.gz"
gunzip -t "$BK/base.sql.gz" && echo "backup da base OK"
pm2 describe viralizahost > "$BK/pm2-describe.txt"
tar --exclude=node_modules --exclude=.next/cache -czf "$BK/release-anterior.tgz" -C "$(dirname "$PROD_DIR")" "$(basename "$PROD_DIR")"
```

## 4. Base de produção: migrações e catálogo
As migrações só **acrescentam** colunas, tabelas e índices (`IF NOT EXISTS`) e removem duas restrições UNIQUE que impediam domínios iguais em extensões diferentes e duas contas WHM com o mesmo domínio. A release anterior continua a funcionar com a base migrada.
```bash
cd "$REL" && env | grep -q '^DB_NAME=' && echo "ATENÇÃO: DB_NAME definido na shell — abrir nova sessão"
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs              # deve mostrar «Base: viralizahost_viralizaHost»
node --env-file=.env.local scripts/commerce/build-catalog.mjs              # pré-visualização: escreve docs/precos-catalogo.md
node --env-file=.env.local scripts/commerce/build-catalog.mjs --apply      # sem --update-prices: mantém preços já editados no painel
```
`build-catalog --apply` passa a rascunho os produtos à venda sem preço de referência (lista no ecrã) e põe «sob consulta» os planos sem equivalente público.

## 5. Troca de release (só reinicia `viralizahost`)
```bash
OLD="$PROD_DIR.anterior-$TS"
mv "$PROD_DIR" "$OLD" && mv "$REL" "$PROD_DIR" && pm2 restart viralizahost
sleep 8
```
Não usar `--update-env`.

## 6. Verificação
```bash
curl -s -o /dev/null -w "site %{http_code}\n" https://viralizahost.com/
for p in /hospedagem-de-sites /servidor-vps /dominios /checkout /terms /privacy; do curl -s -o /dev/null -w "$p %{http_code}\n" https://viralizahost.com$p; done
curl -s "https://viralizahost.com/api/products?category=hosting" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data.map(p=>`${p.slug} ${p.price_monthly}`).join("\n")))'
curl -s -o /dev/null -w "webhook sem assinatura %{http_code} (esperado 401)\n" -X POST https://viralizahost.com/api/payments/webhook -d '{}'
pm2 ls        # comparar com ~/pm2-antes-*.txt: só viralizahost reiniciou; Laguna intacto
```
No painel (`/admin/settings/integrations`): verificar dados bancários, WHM, pacotes WHM por plano. Em `/admin/site/catalog`, preencher o **pacote WHM** de cada plano de alojamento/e-mail (sem pacote, a activação fica manual e é indicada ao cliente).

## Rollback
```bash
pm2 logs viralizahost --lines 80 --nostream > "$BK/erro-arranque.log"
mv "$PROD_DIR" "$PROD_DIR.falhada-$TS" && mv "$OLD" "$PROD_DIR" && pm2 restart viralizahost
sleep 8 && curl -s -o /dev/null -w "site após rollback %{http_code}\n" https://viralizahost.com/
```
A base não precisa de ser reposta: as colunas/tabelas novas são ignoradas pela release anterior. Repor o dump só se for preciso desfazer dados (perde encomendas feitas depois do backup):
```bash
gunzip -c "$BK/base.sql.gz" | mysql --defaults-extra-file=$HOME/.vh-my.cnf viralizahost_viralizaHost
```

Depois de confirmado: `pm2 save`.
