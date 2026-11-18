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
| `scripts/mysql-migration/migrate-data.mjs` (+ `sources.mjs`, `common.mjs`) | `export` (pela API REST do Supabase, sem senha da base), `check`, `import` (`--resume`, `--prune`), `validate`, `reverse` |
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
git worktree add --detach /var/www/viralizahost-mysql FETCH_HEAD
cd /var/www/viralizahost-mysql && npm ci
```
Se a pasta já existir, atualize-a para a versão mais recente da branch:
```bash
cd /var/www/viralizahost-mysql && git fetch origin feat/migracao-mysql && git checkout --detach FETCH_HEAD && npm ci
```

### 4.4 Credenciais MySQL no `.env.local` (o site ainda não muda de base)
A migração **não precisa de acesso ao painel do Supabase**:
- lê os dados pela API REST, com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, que já estão no `.env.local` do site;
- só precisa que lhe acrescente as credenciais MySQL.

Enquanto `NEXT_PUBLIC_DATA_BACKEND` não for `mysql`, o site ignora estas linhas.
```bash
cd /var/www/viralizahost && cp .env.local /root/env.local.backup-$(date +%F) && chmod 600 /root/env.local.backup-*
nano .env.local
```
Acrescente no fim do ficheiro, com os seus valores (a senha fica entre aspas simples):
```
# MySQL (cPanel) — usado pela migração e, depois da troca, pelo site
MYSQL_SOCKET=/var/lib/mysql/mysql.sock
MYSQL_USER=<conta>_vhapp
MYSQL_PASSWORD='<SENHA_MYSQL>'
MYSQL_DATABASE=<conta>_viralizahost
```
Os comandos seguintes usam `node --env-file`, que exige Node 20.6 ou superior (`node -v`).

### 4.5 Criar as tabelas, exportar, importar e validar
```bash
cd /var/www/viralizahost-mysql
E=/var/www/viralizahost/.env.local
mysql --default-character-set=utf8mb4 -S /var/lib/mysql/mysql.sock -u'<conta>_vhapp' -p '<conta>_viralizahost' < database/mysql/001_schema.sql
node --env-file=$E scripts/mysql-migration/migrate-data.mjs export   --dir=/root/vh-export-1
node --env-file=$E scripts/mysql-migration/migrate-data.mjs check    --from=/root/vh-export-1
node --env-file=$E scripts/mysql-migration/migrate-data.mjs import   --from=/root/vh-export-1
node --env-file=$E scripts/mysql-migration/migrate-data.mjs validate --from=/root/vh-export-1
```
- Em vez do comando `mysql … < 001_schema.sql`, pode importar as tabelas pelo phpMyAdmin: selecionar a base → **Importar** → escolher o ficheiro.
- O `export` grava cada tabela em `/root/vh-export-1/*.json` (só root lê). Esta pasta é também um **backup** dos dados do Supabase.
- O `check` tem de terminar com "Schema compatível". Se não terminar, envie-me o resultado.
- O `validate` tem de terminar com **"VALIDAÇÃO OK"**: tabelas idênticas linha a linha, nenhum registo órfão e totais financeiros iguais.

**Importação interrompida:** volte a executar o mesmo `import`. Cada linha é escrita com `INSERT … ON DUPLICATE KEY UPDATE` pela chave primária, por isso não há duplicados. Com `--resume`, cada tabela continua a partir da última chave importada (tabela `_migration_state`).

Com acesso à senha da base do Supabase, pode ler diretamente do PostgreSQL: defina `SOURCE_PG_URL` e omita `--from`.

## 5. Troca em produção (janela de manutenção, ~5 a 10 min sem serviço)
```bash
# 5.1 Parar as escritas
pm2 stop viralizahost

# 5.2 Exportação final (= backup dos dados do Supabase), sincronização e validação
cd /var/www/viralizahost-mysql && E=/var/www/viralizahost/.env.local
F=/root/vh-export-final-$(date +%F-%H%M)
node --env-file=$E scripts/mysql-migration/migrate-data.mjs export   --dir=$F
node --env-file=$E scripts/mysql-migration/migrate-data.mjs import   --from=$F --prune
node --env-file=$E scripts/mysql-migration/migrate-data.mjs validate --from=$F
#    → tem de terminar com "VALIDAÇÃO OK"; se não terminar: pm2 start viralizahost (continua no Supabase) e pare aqui

# 5.3 Código novo + ativar o MySQL + compilar (obrigatório antes de reiniciar)
cd /var/www/viralizahost && git status --short           # tem de estar vazio
git fetch origin feat/migracao-mysql && git checkout -B feat/migracao-mysql FETCH_HEAD   # ou: git pull --ff-only origin main, depois do merge
sed -i '/^NEXT_PUBLIC_DATA_BACKEND=/d' .env.local && echo 'NEXT_PUBLIC_DATA_BACKEND=mysql' >> .env.local
npm ci && npm run build
pm2 start viralizahost --update-env
```

### 5.4 Verificações imediatas
```bash
curl -s -o /dev/null -w "home %{http_code}\n" https://viralizahost.com/
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
cd /var/www/viralizahost-mysql && E=/var/www/viralizahost/.env.local
node --env-file=$E scripts/mysql-migration/migrate-data.mjs export --dir=/root/vh-supabase-antes-rollback   # backup
node --env-file=$E scripts/mysql-migration/migrate-data.mjs reverse --prune
node --env-file=$E scripts/mysql-migration/migrate-data.mjs export --dir=/root/vh-supabase-depois-rollback
node --env-file=$E scripts/mysql-migration/migrate-data.mjs validate --from=/root/vh-supabase-depois-rollback --ignore-cols=updated_at
cd /var/www/viralizahost && sed -i 's/^NEXT_PUBLIC_DATA_BACKEND=.*/NEXT_PUBLIC_DATA_BACKEND=supabase/' .env.local
npm run build && pm2 start viralizahost --update-env
```
- **O que o `reverse` faz pela API:**
  - envia para o Supabase só as linhas **novas ou alteradas** no MySQL; as novas seguem por ordem de criação, para que os tickets fiquem com os mesmos números;
  - com `--prune`, apaga no Supabase o que foi apagado no MySQL.
- **Porque se ignora `updated_at`:** os triggers do Supabase atualizam essa coluna nas linhas alteradas, por isso a validação compara tudo exceto essa coluna.
- Os utilizadores novos já existem no Supabase Auth, porque o Auth nunca saiu do Supabase.

## 7. phpMyAdmin
- Datas e horas estão em **UTC**: Luanda = UTC+1.
- Valores monetários em `DECIMAL(12,2)`.
- Colunas `JSON` (itens de faturas, características, destaques).
- Não editar:
  - `_migration_state` (controlo da migração);
  - `company_billing_settings.active_unique_key` e `domains.full_domain` (colunas geradas).
- Backup diário recomendado: cPanel → Backup, ou `mysqldump --single-transaction` num cron.
