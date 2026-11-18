# Migração da base de dados: Supabase PostgreSQL → MySQL/MariaDB (cPanel)

Branch: `feat/migracao-mysql`. Estado dos testes: `database/mysql/TESTES.md`.

## 1. O que muda e o que fica

| Serviço | Depois da troca |
|---|---|
| **Dados** (37 tabelas do schema `viralizahost`) | **MySQL/MariaDB no cPanel**, geridos pelo phpMyAdmin |
| **Supabase Auth** (login, registo, sessões, recuperação de palavra-passe) | Fica no Supabase |
| **Supabase Storage** (banners, equipa, comprovativos, faturas PDF, vídeos) | Fica no Supabase |
| RPCs e triggers do PostgreSQL | Reescritos na aplicação (`src/lib/db/rpc.ts`, `src/lib/db/hooks.ts`) |
| Políticas RLS | Reproduzidas na aplicação (`src/lib/db/policies.ts`) |

Para substituir também o Auth e o Storage seria preciso:
- **Auth:** guardar as palavras-passe exportadas de `auth.users` (bcrypt), gerir sessões e cookies, enviar os emails de recuperação (Resend) e reescrever as páginas de login, registo e recuperação.
- **Storage:** copiar os ficheiros para o disco ou para S3 e reescrever as rotas de upload e os URLs assinados.

Estes dois serviços não dependem das tabelas que passam para o MySQL.

### Como a aplicação usa o MySQL
- `src/lib/supabase/server.ts` e `client.ts` continuam a ser o ponto de entrada.
  - Com `NEXT_PUBLIC_DATA_BACKEND=mysql`, devolvem um cliente "híbrido": `auth` e `storage` vão para o Supabase, `.from()` e `.rpc()` vão para o MySQL.
  - O resto do código não mudou.
- Todas as consultas são **parametrizadas** (`src/lib/db/executor.ts`), e os nomes de tabelas e colunas são validados contra o schema.
- Os componentes do browser já não falam com a base. As consultas passam por `POST /api/db`, que as executa com a sessão do utilizador e as mesmas regras de acesso.
- **Rollback sem mexer no código:** `NEXT_PUBLIC_DATA_BACKEND=supabase`, depois `npm run build` e reinício.

### Permissões: diferenças intencionais face ao Supabase atual (correções de segurança)
1. **`profiles`:** um cliente só altera `full_name`, `phone`, `country`, `currency` e `avatar_url`. Hoje pode alterar o próprio `role` e tornar-se administrador.
2. **Registo:** o perfil criado é sempre `client`. Hoje o papel vem dos metadados enviados pelo browser, por isso qualquer pessoa pode registar-se como `admin`.
3. **Conteúdo do site** (`site_banners`, `site_domains`, `site_email_plans`, `site_hosting_plans`, `site_team`): só administradores escrevem. Hoje qualquer cliente autenticado pode escrever.
4. **`ticket_messages`:** o cliente não lê nem cria notas internas. Hoje a combinação das políticas permite-o.

As falhas 1 e 2 existem **agora** em produção. As correções para o Supabase estão em `database/supabase-hotfix/` e podem ser aplicadas já, independentemente da migração.

### Outras diferenças
- **Definições:** a página usava `createAuthClient().from('profiles')`, que no Supabase aponta para `public.profiles` e não para `viralizahost.profiles`. Com MySQL, grava no perfil correto.
- **Resumo financeiro do admin:** a relação `orders → profiles` (por `user_id`) passa a resolver.
- **Mantido como está:**
  - `reject_order` falha em encomendas com domínio, porque o estado `cancelled` não existe no ENUM `domain_status`. É o mesmo comportamento do PostgreSQL.
  - Os números de ticket (`VH-TKT-AAAA-nnnnnn`) e de fatura (`VH-AAAAMM-nnnn`) seguem a mesma regra de contagem.

## 2. Ficheiros entregues

| Ficheiro | Para quê |
|---|---|
| `database/mysql/001_schema.sql` | Cria as 37 tabelas (MariaDB 10.6+ / MySQL 8.0.16+). Idempotente. Importável pelo phpMyAdmin. |
| `scripts/mysql-migration/migrate-data.mjs` | `check`, `import` (`--resume`, `--prune`), `validate`, `reverse` |
| `scripts/mysql-migration/generate-schema.mjs` | Regenera o DDL e os metadados a partir do PostgreSQL |
| `scripts/mysql-migration/extract-seeds.mjs` | Dados semeados por `setup_product_catalog` e `setup_banner_pages` |
| `database/supabase-hotfix/*.sql` | Correções de segurança para o Supabase atual |
| `scripts/mysql-migration/test/*` | Testes (simuladores, gerador de dados, fluxos Playwright) |

Conversão de tipos:
- `uuid` → `CHAR(36)`; `timestamptz` → `DATETIME(6)` em **UTC**; `numeric(p,s)` → `DECIMAL(p,s)`; `jsonb` e `text[]` → `JSON`; enums → `ENUM`.
- Texto em `utf8mb4_bin`, para comparações e unicidade iguais às do PostgreSQL (sensíveis a maiúsculas).

## 3. Variáveis de ambiente (`/var/www/viralizahost/.env.local`)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_DATA_BACKEND` | `mysql` (ou `supabase` para voltar) — **fixada no build** |
| `MYSQL_SOCKET` | ex.: `/var/lib/mysql/mysql.sock` (recomendado: utilizadores cPanel são `@localhost`) |
| `MYSQL_HOST` / `MYSQL_PORT` | alternativa ao socket (`localhost` / `3306`) |
| `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` | utilizador e base criados no cPanel (com o prefixo da conta) |
| `MYSQL_POOL_SIZE` | opcional (10) |

As variáveis do Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) continuam necessárias, para o Auth e o Storage.

## 4. Preparação (com o site a funcionar no Supabase)

Comandos no **WHM → Terminal** (root). Substitua `<conta>` pelo utilizador cPanel onde a base vai ficar. Para ver a lista de contas, use WHM → List Accounts, ou `ls /var/cpanel/users`.

### 4.1 Confirmar a versão e o socket do MySQL
```bash
mysql -V
mysql -NBe "SELECT VERSION(), @@socket, @@character_set_server"
/usr/local/cpanel/bin/whmapi1 current_mysql_version | grep -E "version|server"
node -v    # 20 ou superior
```
Testado em MariaDB 10.6 e MySQL 8.0. Se a versão for anterior a MariaDB 10.6 ou MySQL 8.0.16, não avance e envie-me o resultado.

### 4.2 Criar a base de validação e o utilizador
Pelo **cPanel → Database Wizard**:
- Base: `vh_validacao` (fica `<conta>_vh_validacao`).
- Utilizador: `vhapp` (fica `<conta>_vhapp`).
- Privilégios: **ALL PRIVILEGES**.

Ou pelo terminal:
```bash
read -rsp "Senha do utilizador MySQL: " VH_DB_PASS; echo
uapi --user=<conta> Mysql create_database name=<conta>_vh_validacao
uapi --user=<conta> Mysql create_user name=<conta>_vhapp password="$VH_DB_PASS"
uapi --user=<conta> Mysql set_privileges_on_database user=<conta>_vhapp database=<conta>_vh_validacao privileges='ALL PRIVILEGES'
```

### 4.3 Código da migração numa pasta separada (não toca no site em produção)
```bash
cd /var/www/viralizahost && git fetch origin feat/migracao-mysql
git worktree add /var/www/viralizahost-mysql origin/feat/migracao-mysql
cd /var/www/viralizahost-mysql && npm ci
```

### 4.4 Credenciais da migração (fora do repositório, só root)
A ligação ao Supabase está em **Supabase → Connect → Session pooler** (URI). A senha da base está em Project Settings → Database.
```bash
install -m 600 /dev/null /root/.vh-migracao.env
cat > /root/.vh-migracao.env <<'EOF'
SOURCE_PG_URL=postgresql://postgres.<ref>:<SENHA_SUPABASE>@aws-0-<região>.pooler.supabase.com:5432/postgres
MYSQL_SOCKET=/var/lib/mysql/mysql.sock
MYSQL_USER=<conta>_vhapp
MYSQL_PASSWORD=<SENHA_MYSQL>
MYSQL_DATABASE=<conta>_vh_validacao
EOF
nano /root/.vh-migracao.env   # substituir os valores entre < >
```

### 4.5 Criar as tabelas, importar e validar
```bash
cd /var/www/viralizahost-mysql && set -a && . /root/.vh-migracao.env && set +a
mysql --default-character-set=utf8mb4 -S "$MYSQL_SOCKET" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < database/mysql/001_schema.sql
mkdir -p /root/vh-migracao-logs
node scripts/mysql-migration/migrate-data.mjs check    | tee /root/vh-migracao-logs/1-check.log
node scripts/mysql-migration/migrate-data.mjs import   | tee /root/vh-migracao-logs/2-import.log
node scripts/mysql-migration/migrate-data.mjs validate | tee /root/vh-migracao-logs/3-validate.log
```
- Em vez do `mysql … < 001_schema.sql`, pode usar o phpMyAdmin: selecionar a base → **Importar** → escolher o ficheiro.
- O `check` tem de terminar com "Schema compatível". Se listar diferenças (por exemplo, colunas criadas no Supabase fora das migrations), envie-me o ficheiro `1-check.log`.
- O `validate` tem de terminar com **"VALIDAÇÃO OK"**: tabelas idênticas linha a linha, nenhum registo órfão e totais financeiros iguais.

**Importação interrompida:** volte a executar `import`. Cada linha é escrita com `INSERT … ON DUPLICATE KEY UPDATE` pela chave primária, por isso não há duplicados. Com `--resume`, cada tabela continua a partir da última chave importada (tabela `_migration_state`).

### 4.6 (Recomendado) Testar a aplicação contra a base de validação
```bash
cd /var/www/viralizahost-mysql
cp /var/www/viralizahost/.env.local .env.local && chmod 600 .env.local
printf '\nNEXT_PUBLIC_DATA_BACKEND=mysql\nMYSQL_SOCKET=%s\nMYSQL_USER=%s\nMYSQL_PASSWORD=%s\nMYSQL_DATABASE=%s\n' \
  "$MYSQL_SOCKET" "$MYSQL_USER" "$MYSQL_PASSWORD" "$MYSQL_DATABASE" >> .env.local
npm run build && nohup npx next start -p 3101 > /root/vh-migracao-logs/validacao-app.log 2>&1 &
```
- Abra a aplicação no seu computador com `ssh -L 3101:localhost:3101 root@<servidor>` e depois **http://localhost:3101**.
- **Atenção:** esta instância usa o Auth e o Storage **reais**. Navegue e faça login à vontade. Não faça uploads, envios de faturas nem ações WHM (suspender, SSO) com clientes reais.
- No fim: `fuser -k 3101/tcp`.

## 5. Troca em produção (janela de manutenção, ~5 a 10 min sem serviço)

### 5.0 Antes da janela
1. Fazer merge da branch `feat/migracao-mysql` na `main`.
2. Criar a base de produção `<conta>_viralizahost` com o mesmo utilizador (4.2), importar `001_schema.sql` e fazer uma primeira importação com validação (4.5, com `MYSQL_DATABASE=<conta>_viralizahost` no `/root/.vh-migracao.env`). Isto pode ser feito dias antes.
3. Ter `pg_dump` 15+ no servidor (`pg_dump --version`). Se não houver, confirmar que há um backup recente em Supabase → Database → Backups.

### 5.1 Backups
```bash
B=/root/backups/vh-$(date +%F-%H%M) && mkdir -p "$B" && chmod 700 "$B"
set -a && . /root/.vh-migracao.env && set +a
pg_dump "$SOURCE_PG_URL" --schema=viralizahost --format=custom --file="$B/supabase-viralizahost.dump"
cp /var/www/viralizahost/.env.local "$B/env.local.antes"
git -C /var/www/viralizahost rev-parse HEAD > "$B/commit.antes"
```

### 5.2 Parar as escritas e fazer a sincronização final
```bash
pm2 stop viralizahost
cd /var/www/viralizahost-mysql && git fetch origin && git checkout --detach origin/main && npm ci
node scripts/mysql-migration/migrate-data.mjs import --prune | tee "$B/sync-final.log"
node scripts/mysql-migration/migrate-data.mjs validate      | tee "$B/validate-final.log"
mysqldump --single-transaction --default-character-set=utf8mb4 -S "$MYSQL_SOCKET" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" > "$B/mysql-apos-sync.sql"
```
Se o `validate` **não** terminar com "VALIDAÇÃO OK", **pare aqui**. Reponha o site com `pm2 start viralizahost` (continua no Supabase) e envie-me o log.

### 5.3 Trocar a configuração, compilar e reiniciar
```bash
cd /var/www/viralizahost && git status --short     # tem de estar vazio
git pull --ff-only origin main
sed -i '/^NEXT_PUBLIC_DATA_BACKEND=/d;/^MYSQL_/d' .env.local
printf '\nNEXT_PUBLIC_DATA_BACKEND=mysql\nMYSQL_SOCKET=%s\nMYSQL_USER=%s\nMYSQL_PASSWORD=%s\nMYSQL_DATABASE=%s\n' \
  "$MYSQL_SOCKET" "$MYSQL_USER" "$MYSQL_PASSWORD" "$MYSQL_DATABASE" >> .env.local
(set -a && . ./.env.local && set +a && bash scripts/deploy-env-check.sh)
npm ci && npm run build
pm2 start viralizahost --update-env
```
**É obrigatório recompilar antes de reiniciar:** `NEXT_PUBLIC_DATA_BACKEND` é fixada no build.

### 5.4 Verificações imediatas
```bash
curl -s -o /dev/null -w "home %{http_code}\n" https://viralizahost.com/
curl -s -X POST https://viralizahost.com/api/db -H 'content-type: application/json' -H 'x-vh-db: 1' \
  -d '{"table":"site_banners","action":"select","columns":"id","filters":[],"order":[],"limit":1}'
pm2 logs viralizahost --lines 200 --nostream | grep -iE "error|\[db\]" | tail -20
```
No browser:
- Login de cliente → dashboard, faturas, tickets.
- Login de admin → encomendas, financeiro, clientes, Topo da Página Inicial.

## 6. Voltar ao Supabase (rollback)

O código suporta os dois modos, por isso não é preciso reverter commits.

### A) Rollback imediato (nada de importante foi criado depois da troca)
```bash
pm2 stop viralizahost
cd /var/www/viralizahost && sed -i 's/^NEXT_PUBLIC_DATA_BACKEND=.*/NEXT_PUBLIC_DATA_BACKEND=supabase/' .env.local
npm run build && pm2 start viralizahost --update-env
```
O que for criado no MySQL depois da troca não aparece no Supabase.

### B) Rollback preservando os registos criados depois da troca
```bash
pm2 stop viralizahost
B=/root/backups/vh-rollback-$(date +%F-%H%M) && mkdir -p "$B"
cd /var/www/viralizahost-mysql && set -a && . /root/.vh-migracao.env && set +a   # MYSQL_DATABASE = base de produção
pg_dump "$SOURCE_PG_URL" --schema=viralizahost --format=custom --file="$B/supabase-antes-reverse.dump"
node scripts/mysql-migration/migrate-data.mjs reverse | tee "$B/reverse.log"
node scripts/mysql-migration/migrate-data.mjs validate | tee "$B/validate.log"
cd /var/www/viralizahost && sed -i 's/^NEXT_PUBLIC_DATA_BACKEND=.*/NEXT_PUBLIC_DATA_BACKEND=supabase/' .env.local
npm run build && pm2 start viralizahost --update-env
```
- O `reverse` copia para o Supabase todas as linhas do MySQL, novas e alteradas, sem duplicados (`ON CONFLICT`).
- Durante a cópia, os triggers ficam desligados, para preservar números de tickets e datas.
- Com `reverse --prune`, também apaga no Supabase as linhas que foram apagadas no MySQL depois da troca. Use só se tiver a certeza.
- Os utilizadores novos já existem no Supabase Auth, porque o Auth nunca saiu do Supabase.

## 7. phpMyAdmin
- Datas e horas estão em **UTC**: Luanda = UTC+1.
- Valores monetários em `DECIMAL(12,2)`.
- Colunas `JSON` (itens de faturas, características, destaques).
- Não editar:
  - `_migration_state` (controlo da migração);
  - `company_billing_settings.active_unique_key` e `domains.full_domain` (colunas geradas).
- Backup diário recomendado: cPanel → Backup, ou `mysqldump --single-transaction` num cron.
