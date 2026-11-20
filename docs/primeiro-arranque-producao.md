# Primeiro arranque em produção com MariaDB (base nova)

Executar por SSH no servidor, **pela ordem**, como o utilizador que gere o PM2.
Nada aqui mostra senhas: são lidas com `read -s` ou ficam em ficheiros `chmod 600`.
Não usar `set -x`. Cada bloco termina com uma verificação; parar se falhar.

Ensaio local deste procedimento (MariaDB 10.11, base `viralizahost_viralizaHost` vazia, release separada, porta 3100): 22/22 testes, troca de pasta da release validada.

## 0. Confirmar o processo de produção (só leitura)
```bash
pm2 ls | tee ~/pm2-antes-$(date +%F-%H%M).txt
pm2 describe viralizahost | grep -E "status|script path|script args|exec cwd|exec mode|interpreter"
PROD_DIR=$(pm2 jlist | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.name==="viralizahost");if(!p)process.exit(1);console.log(p.pm2_env.pm_cwd)})')
echo "PROD_DIR=$PROD_DIR"
ls -la "$PROD_DIR"/.env* "$PROD_DIR"/ecosystem.config.* 2>/dev/null
ss -ltnp | grep -E ':3000 |:3100 '      # 3000 = viralizahost; 3100 deve estar livre
```
Se as variáveis de produção estiverem no `ecosystem.config.js` em vez de `.env.local`, anotar quais (`RESEND_*`, `ANTHROPIC_API_KEY`, `WHM_ENCRYPTION_KEY`, `CRON_SECRET`) para o passo 1.3.

## 1. Release separada a partir do PR #31
```bash
TESTE=/var/www/viralizahost-mariadb-teste
git -C "$TESTE" fetch origin pull/31/head
COMMIT=$(git -C "$TESTE" rev-parse FETCH_HEAD); echo "$COMMIT"
git -C "$TESTE" cat-file -e "$COMMIT:scripts/mariadb/create-admin.mjs" && echo "commit contém create-admin"
REL=/var/www/viralizahost-release-${COMMIT:0:7}
mkdir "$REL" && git -C "$TESTE" archive "$COMMIT" | tar -x -C "$REL"
chown -R --reference="$PROD_DIR" "$REL"     # só se estiver como root
```

### 1.3 Configuração protegida
```bash
umask 077
cp "$PROD_DIR/.env.local" "$REL/.env.local" 2>/dev/null || touch "$REL/.env.local"
printf 'STORAGE_SIGNING_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$REL/.env.local"
nano "$REL/.env.local"
```
No editor, acrescentar (valores reais; **valores com `#` ou espaços entre aspas simples**, senão o `#` é lido como comentário):
```
DB_HOST=localhost            # ou DB_SOCKET=/var/lib/mysql/mysql.sock (ver passo 2)
DB_PORT=3306
DB_NAME=viralizahost_viralizaHost
DB_USER=<utilizador cPanel com acesso à base>
DB_PASSWORD='<senha>'
NEXT_PUBLIC_SITE_URL=https://viralizahost.com
NEXT_PUBLIC_APP_URL=https://viralizahost.com
STORAGE_DIR=/var/www/viralizahost-storage
AUTH_EMAIL_CONFIRMATION=true
```
e garantir `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `ANTHROPIC_API_KEY`, `WHM_ENCRYPTION_KEY`, `CRON_SECRET`.
```bash
chmod 600 "$REL/.env.local"
grep -oE '^[A-Z_]+=' "$REL/.env.local" | sort | uniq -d     # não deve listar nada (chaves duplicadas)
grep -oE '^[A-Z_]+=' "$REL/.env.local" | sort               # só nomes, sem valores
mkdir -p /var/www/viralizahost-storage && chmod 750 /var/www/viralizahost-storage
chown --reference="$PROD_DIR" /var/www/viralizahost-storage
# credenciais para o cliente mariadb (ficheiro 600, gerado sem mostrar a senha)
node --env-file="$REL/.env.local" -e 'const e=process.env,q=s=>`"${String(s).replace(/\\/g,"\\\\").replace(/"/g,"\\\"")}"`;require("fs").writeFileSync(process.argv[1],`[client]\nuser=${e.DB_USER}\npassword=${q(e.DB_PASSWORD??"")}\n${e.DB_SOCKET?`socket=${e.DB_SOCKET}`:`host=${e.DB_HOST}\nport=${e.DB_PORT||3306}`}\ndefault-character-set=utf8mb4\n`,{mode:0o600})' ~/.vh-my.cnf
```

## 2. Ligação, base e esquema
```bash
cd "$REL" && npm ci
node --env-file=.env.local scripts/mariadb/check-connection.mjs
```
Se a ligação marcada ✓ for outra (ex.: socket), corrigir `DB_HOST`/`DB_SOCKET` em `.env.local`, regenerar `~/.vh-my.cnf` e repetir.
```bash
MC="mariadb --defaults-extra-file=$HOME/.vh-my.cnf viralizahost_viralizaHost"
$MC -N -e "SELECT DATABASE(); SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();"
```
A primeira linha tem de ser exactamente `viralizahost_viralizaHost`.

**Se o número de tabelas for maior que 0 — backup e inspecção antes de escrever:**
```bash
mkdir -p ~/backups && chmod 700 ~/backups
mysqldump --defaults-extra-file=$HOME/.vh-my.cnf --single-transaction --routines --triggers viralizahost_viralizaHost | gzip > ~/backups/vh-antes-schema-$(date +%F-%H%M).sql.gz
gunzip -t ~/backups/vh-antes-schema-*.sql.gz && echo "backup OK"
$MC -t -e "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY 1"
```
Parar e rever se existirem tabelas com os mesmos nomes mas estrutura diferente (o esquema usa `CREATE TABLE IF NOT EXISTS` e não altera tabelas existentes).

**Esquema e dados iniciais do projecto:**
```bash
$MC < database/mariadb/schema.sql
$MC < database/mariadb/seed/product-catalog.sql
$MC < database/mariadb/seed/banner-pages.sql
$MC < database/mariadb/seed/base-settings.sql
$MC -t -e "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()) tabelas,
  (SELECT COUNT(*) FROM products) produtos, (SELECT COUNT(*) FROM product_features) features,
  (SELECT COUNT(*) FROM banner_pages) banners, (SELECT COUNT(*) FROM company_billing_settings) facturacao,
  (SELECT COUNT(*) FROM currency_rates) cambio, (SELECT COUNT(*) FROM plans) planos,
  (SELECT mode FROM site_home_hero WHERE id=1) topo"
```
Esperado numa base nova: `43 | 36 | 30 | 18 | 1 | 3 | 4 | carousel`. Os ficheiros de seed são idempotentes.

## 3. Primeiro administrador
O registo público cria sempre clientes. O admin é criado pelo script (senha pedida sem eco, guardada só como hash bcrypt):
```bash
node --env-file=.env.local scripts/mariadb/create-admin.mjs --email=<email-do-admin> --name="<Nome>"
```
Senha: ≥10 caracteres com maiúscula, minúscula, número e símbolo.

## 4. Ensaio na porta 3100 (processo PM2 separado)
```bash
npm run build
AUTH_EMAIL_CONFIRMATION=false pm2 start npm --name viralizahost-mariadb-ensaio --cwd "$REL" -- start -- -p 3100
sleep 5 && curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3100/
read -rp 'E-mail do admin: ' ADMIN_EMAIL; read -rsp 'Senha do admin: ' ADMIN_PASSWORD; echo; export ADMIN_EMAIL ADMIN_PASSWORD
BASE_URL=http://127.0.0.1:3100 node --env-file=.env.local scripts/mariadb/first-boot-test.mjs
```
`AUTH_EMAIL_CONFIRMATION=false` só existe no ambiente deste processo; o `.env.local` continua com `true` para a produção. O teste cobre página inicial, `/api/products` com ID confirmado na base, login e painel do admin, registo/login/sessão/logout de uma conta fictícia (apagada no fim), senha errada e bloqueio do painel ao cliente. Tem de terminar com `0 falhadas`.

Teste do envio real de e-mail (com `RESEND_API_KEY` configurada):
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' --data "{\"email\":\"$ADMIN_EMAIL\"}" http://127.0.0.1:3100/api/auth/recover
```
`200` = o Resend aceitou o envio (confirmar a recepção na caixa do admin; o link abre em viralizahost.com, válido 60 min, e só funciona depois da troca do passo 6). `500` = e-mail não configurado: **não pôr em produção com `AUTH_EMAIL_CONFIRMATION=true`**, porque os novos clientes não conseguiriam activar a conta (o registo mostra erro). Nesse caso corrigir o Resend ou, por decisão explícita, usar `false`.
```bash
pm2 delete viralizahost-mariadb-ensaio
```

## 5. Backup para rollback
```bash
TS=$(date +%F-%H%M); BK=/var/www/backups/viralizahost-$TS
mkdir -p "$BK" && chmod 700 "$BK"
pm2 describe viralizahost > "$BK/pm2-describe.txt"
cp -a "$PROD_DIR"/.env* "$PROD_DIR"/ecosystem.config.* "$BK"/ 2>/dev/null
tar --exclude=node_modules --exclude=.next/cache -czf "$BK/release-anterior.tgz" -C "$(dirname "$PROD_DIR")" "$(basename "$PROD_DIR")"
tar -tzf "$BK/release-anterior.tgz" > /dev/null && echo "backup da release OK"
```

## 6. Produção
```bash
cp -a "$PROD_DIR"/ecosystem.config.* "$REL"/ 2>/dev/null
OLD="$PROD_DIR.anterior-$TS"
mv "$PROD_DIR" "$OLD" && mv "$REL" "$PROD_DIR" && pm2 restart viralizahost
sleep 8
curl -s -o /dev/null -w "site %{http_code}\n" https://viralizahost.com/
cd "$PROD_DIR" && BASE_URL=https://viralizahost.com node --env-file=.env.local scripts/mariadb/first-boot-test.mjs --no-signup
pm2 ls        # comparar com ~/pm2-antes-*.txt: só viralizahost reiniciou
```
Não usar `pm2 restart --update-env` (copiaria variáveis da shell para o processo). O Next lê o `.env.local` da pasta.

**Se a verificação falhar — rollback:**
```bash
pm2 logs viralizahost --lines 80 --nostream > "$BK/erro-arranque.log"
mv "$PROD_DIR" "$PROD_DIR.falhada-$TS" && mv "$OLD" "$PROD_DIR" && pm2 restart viralizahost
sleep 8 && curl -s -o /dev/null -w "site após rollback %{http_code}\n" https://viralizahost.com/
```
(Rever `erro-arranque.log` antes de partilhar — pode conter dados pessoais.)

**Depois de tudo verde:**
```bash
pm2 save                        # só quando a produção estiver confirmada
unset ADMIN_PASSWORD
```
- Cron Job no cPanel (a cada 15 min): `curl -s -X POST https://viralizahost.com/api/cron/whm-sync -H "Authorization: Bearer <CRON_SECRET>" > /dev/null`
- Se o vídeo da página inicial for usado: Apache `LimitRequestBody` ≥ 110 MB para `/storage/v1/object/upload/`.
- Todos os utilizadores (antigos do Supabase) iniciam sessão de novo; nesta base nova só existem o admin e quem se registar.
