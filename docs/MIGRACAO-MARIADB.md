# Migração Supabase (PostgreSQL) → MariaDB 10.11

Branch: `claude/trusting-newton-l8kwvl`. Destino: base `viralizahost_viralizaHost`, utilizador
`viralizahost_userViralizaHost`, aplicação em `/var/www/viralizahost` (PM2 `viralizahost`).

> Nenhuma credencial está no repositório. A palavra-passe da base é lida de `MYSQL_PASSWORD`
> no ambiente do servidor. Backups e ficheiros com dados de produção ficam fora do Git.

---

## 1. O que mudou

| Antes (Supabase) | Agora (MariaDB, no servidor Next.js) |
|---|---|
| PostgREST (`supabase.from(...)`) no servidor e no browser | `src/lib/db/*`: mesmo API (`from().select().eq()…`) traduzido para SQL MariaDB **parametrizado** |
| Browser falava diretamente com o Supabase (chave anon + RLS) | Browser envia a consulta para `POST /api/db`; o servidor identifica o utilizador pelo cookie e aplica as regras |
| Políticas RLS | `src/lib/db/policies.ts` (mesmas regras, por tabela e operação) |
| Funções RPC PL/pgSQL | `src/lib/db/rpc.ts` (transações MariaDB) |
| Triggers (`updated_at`, `ticket_number`, `sync_invoice_proof_file`, `handle_new_user`, `handle_user_email_updated`) | Portados para a camada de escrita / módulo de autenticação (não exigem privilégio `TRIGGER` nem `SUPER` no cPanel) |
| Supabase Auth (GoTrue) | `src/lib/auth/*`: tabela `auth_users`, hashes bcrypt migrados, cookie HttpOnly `vh_session` assinado |
| Supabase Storage | `src/lib/storage/server.ts` + rota `/storage/v1/object/...` (ficheiros em `STORAGE_ROOT`, metadados em `storage_objects`) |
| Cron da Vercel (`vercel.json`) | `scripts/mariadb/cron-whm-sync.sh` no crontab do servidor |

Os ficheiros que importavam `@/lib/supabase/server` e `@/lib/supabase/client` continuam iguais:
estes módulos passaram a devolver o cliente MariaDB. As dependências `@supabase/ssr` e
`@supabase/supabase-js` foram removidas.

### Inventário da origem (o que a aplicação usa)

* **Schema `viralizahost`** — 37 tabelas, todas migradas (clientes/perfis, encomendas e itens,
  faturas e itens, pagamentos, tickets, mensagens e anexos, produtos e características, serviços,
  domínios, alojamentos, contas WHM e mapeamentos, servidores, configurações de faturação, taxas
  de câmbio, notificações, logs, conversas IA, `site_banners`, `site_domains`, `site_email_plans`,
  `site_hosting_plans`, `site_team`, `banner_pages`, **`site_home_hero`**).
* **`auth.users`** (+ `auth.identities` no regresso) → `auth_users`.
* **`storage.objects` / `storage.buckets`** → `storage_objects` + disco. Buckets: `site-banners`,
  `site-team` (públicos), `site-videos` (público, vídeo do topo), `payment-proofs` e `invoices` (privados).
* **Funções `public.*`** chamadas por `.rpc()`: `create_order`, `approve_order`, `reject_order`,
  `provision_order_services`, `reconcile_unprovisioned_orders`, `get_client_invoices`,
  `get_client_financial_summary`, `check/setup_product_catalog`, `check/setup_banner_pages`.
* **Schema `public`**: tem tabelas antigas (`profiles`, `plans`, `hostings`, …, de `001_initial.sql`)
  que **a aplicação não usa**; ficam no backup `pg_dump`. O `preflight` lista-as.
* **Webhooks / tarefas**: não há Database Webhooks nem `pg_cron` nas migrações; o `preflight`
  confirma na base real. O único cron é `/api/cron/whm-sync` (15 min). O webhook do Resend
  (`/api/webhooks/resend`) não muda de URL.

### Conversão de tipos

| PostgreSQL | MariaDB |
|---|---|
| `uuid` | `CHAR(36) ascii` (IDs preservados) |
| `timestamptz` | `DATETIME(6)` em UTC (microssegundos preservados; a app liga com `time_zone '+00:00'`) |
| `numeric(p,s)` | `DECIMAL(p,s)` (valores copiados como texto exato) |
| `jsonb`, `text[]` | `LONGTEXT` + `CHECK (JSON_VALID(...))` |
| enums | `VARCHAR` + `CHECK (col IN (...))` |
| `boolean` | `TINYINT(1)` |
| coluna gerada `domains.full_domain` | `GENERATED ALWAYS AS (CONCAT(name, extension)) STORED` |
| índice único parcial `company_billing_settings(active) WHERE active` | coluna virtual `active_unique_key` + `UNIQUE` |

O texto usa `utf8mb4_unicode_ci`: acentos preservados; comparações `=` passam a ignorar
maiúsculas. O `preflight` deteta valores que colidiriam em índices únicos por causa disso.

---

## 2. Regras de acesso e correções de segurança

As regras de `policies.ts` aplicam-se a tudo o que chega do browser (`/api/db`, storage) e ao
cliente `createClient()` do servidor. As rotas de API que usam o papel de serviço
(`createAdminClient`, `createAdminWriteClient`) foram auditadas: as do portal filtram sempre pelo
`user.id` da sessão e as de administração exigem `requireAdminRole()`.

Testado (ver §7): cada cliente só lê/altera os seus perfis, faturas, encomendas, itens, pagamentos,
tickets, mensagens, ficheiros e serviços; mensagens internas do suporte ficam ocultas.

Problemas existentes no Supabase que **foram corrigidos** na migração:

1. **Escalada para admin no registo** — o trigger `handle_new_user` copiava `role` dos metadados
   enviados pelo browser (`signUp({ data: { role: 'admin' } })` criava um admin). Agora o papel é sempre `client`.
2. **Cliente podia alterar o próprio `role`** (política `profiles_update_own`). Agora é recusado (42501).
3. **Qualquer utilizador autenticado podia escrever** em `site_banners`, `site_domains`,
   `site_email_plans`, `site_hosting_plans`, `site_team`. Agora só admin.
4. **Comprovativos de pagamento legíveis por qualquer utilizador autenticado** (`payment_proofs_read_own`
   não filtrava o dono). Agora: dono, ou ficheiro ligado a uma fatura/encomenda/pagamento do cliente, ou admin.
5. `POST /api/admin/setup-products` só exigia sessão; agora exige admin.

Comportamento mantido de propósito: `reject_order` no PostgreSQL falhava sempre (usa o estado
`cancelled`, inexistente em `domain_status`) e a rota caía no fallback que não altera domínios. A
versão MariaDB faz o mesmo que o fallback (encomenda `rejected`, serviços e fatura `cancelled`).

---

## 3. Contas e palavras-passe

* `auth.users.encrypted_password` (bcrypt `$2a$`) é copiado tal como está → **as palavras-passe atuais continuam a funcionar**. IDs dos utilizadores, perfis (`profiles`) e papéis (`profiles.role`) são preservados.
* **Todos têm de iniciar sessão outra vez** uma única vez: as sessões Supabase (JWT) não são transferíveis.
* Contas **sem palavra-passe** (criadas por convite/OAuth/magic link) têm de usar "Esqueci a palavra-passe". O `preflight` mostra quantas são.
* Contas com e-mail **não confirmado** continuam bloqueadas no login ("Email not confirmed"), como no Supabase (`AUTH_REQUIRE_EMAIL_CONFIRMATION=true`).
* Recuperação, confirmação de registo e reset enviado pelo admin passam a ser enviados pelo **Resend** (`RESEND_API_KEY`, domínio verificado). Os modelos de e-mail do painel Supabase deixam de ser usados. Os links valem 1 h (recuperação) e são de uso único (o token fica inválido quando a palavra-passe muda).
* Mudar a palavra-passe termina as outras sessões (`session_version`).
* Limitação de tentativas: login 8 / 10 min por IP+e-mail; recuperação 5 / h por IP; registo 10 / h por IP.

## 4. Ficheiros (Storage)

* `node scripts/mariadb/migrate-data.mjs files` descarrega **todos** os objetos do Supabase Storage
  (públicos e privados, incluindo vídeos e comprovativos) para `STORAGE_ROOT/<bucket>/<caminho>`; é retomável.
* Os URLs públicos guardados nas tabelas (`https://<ref>.supabase.co/storage/v1/object/public/...`)
  são reescritos durante a cópia para `https://viralizahost.com/storage/v1/object/public/...`
  (mesmo caminho, servido pelo Next.js com suporte a `Range` para o vídeo).
* Ficheiros privados: só por URL assinado (HMAC, expira) ou por `/storage/v1/object/authenticated/...` com sessão e permissão.
* Envio do vídeo do topo (até 100 MB) e dos comprovativos passam pelo Next.js. O proxy web (Nginx/Apache)
  tem de aceitar pedidos de 110 MB em `/storage/` (ver §6.5, passo 7).

---

## 5. Ficheiros entregues

| Ficheiro | Função |
|---|---|
| `database/mariadb/001_schema.sql` | SQL de criação das tabelas (phpMyAdmin → Importar). Idempotente (`IF NOT EXISTS`). |
| `scripts/mariadb/generate-schema.mjs` | Gera o SQL e `src/lib/db/schema.generated.ts` a partir do catálogo PostgreSQL; `--check-only` compara a produção com o versionado |
| `scripts/mariadb/migrate-data.mjs` | `preflight`, `copy` (retomável, sem duplicar), `files`, `verify`, `mark-cutover`, `reverse` |
| `scripts/mariadb/backup-supabase.sh` / `backup-mariadb.sh` | Backups antes de qualquer importação |
| `scripts/mariadb/check-connection.mjs` | Confirma a ligação com as variáveis do processo e a associação utilizador ↔ base |
| `scripts/mariadb/smoke-test.mjs` | 91 verificações HTTP (login, RLS, faturas, pagamentos, tickets, uploads, Vídeo/Carrossel, checkout, recuperação) |
| `tests/db-compat.test.ts` | 40 verificações da camada de consultas (embeds, filtros, tipos, erros, RLS, RPC) |
| `scripts/mariadb/test-local.sh` + `test-fixtures/` | Ensaio completo reproduzível com dados fictícios |
| `scripts/mariadb/cron-whm-sync.sh` | Cron WHM no servidor |
| `docs/env.mariadb.example` | Nomes das variáveis de ambiente |

---

## 6. Passos no servidor

Tudo é preparado numa pasta **separada** (`/var/www/viralizahost-mariadb`), para não mexer no
`node_modules`/`.next` do processo PM2 em produção. Na troca, as pastas são trocadas; o regresso é
trocar de volta (a pasta antiga mantém o build Supabase intacto). Corra os comandos como o utilizador
do PM2. Guarde segredos só no `.env.local` (`chmod 600`) ou com `read -s`; nunca no histórico.

### 6.1 Preparar o código e as variáveis

```bash
git clone --branch claude/trusting-newton-l8kwvl https://github.com/viralizaoficial98-cloud/viralizahost-v2.git /var/www/viralizahost-mariadb
```

```bash
cd /var/www/viralizahost-mariadb && npm ci
```

```bash
cp /var/www/viralizahost/.env.local /var/www/viralizahost-mariadb/.env.local && chmod 600 /var/www/viralizahost-mariadb/.env.local
```

Acrescente a esse `.env.local` (lista completa em `docs/env.mariadb.example`): `MYSQL_DATABASE`,
`MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_SOCKET` (ou `MYSQL_HOST`), `AUTH_SECRET`, `STORAGE_ROOT`,
`NEXT_PUBLIC_SITE_URL`. Para o `AUTH_SECRET`:

```bash
openssl rand -base64 48
```

Pasta dos ficheiros (substitua `<user>` pelo utilizador do PM2):

```bash
sudo install -d -o <user> -g <user> -m 750 /var/www/viralizahost-storage /var/www/viralizahost-storage-teste
```

### 6.2 Confirmar a ligação a partir do processo Next.js

```bash
cd /var/www/viralizahost-mariadb && set -a && . ./.env.local && set +a && npm run db:check
```

Esperado: `✔ ligado` e `✔ utilizador associado à base: GRANT ALL PRIVILEGES ON viralizahost\_viralizaHost.*`.
* `✗ o utilizador NÃO tem privilégios` → cPanel → **MySQL® Databases → Add User To Database** →
  `viralizahost_userViralizaHost` + `viralizahost_viralizaHost` → **ALL PRIVILEGES**.
* `Access denied … @'localhost'` por TCP → use `MYSQL_SOCKET=/var/lib/mysql/mysql.sock`.
* Se o MariaDB estiver noutra máquina, o "localhost:3306" do phpMyAdmin não serve: adicione o IP do
  servidor da aplicação em **Remote MySQL®** e use `MYSQL_HOST`.

Depois da troca, para confirmar que o PM2 tem as variáveis (mostra só a contagem):

```bash
pm2 env $(pm2 id viralizahost | tr -dc '0-9') | grep -c '^MYSQL_'
```

### 6.3 Backups

```bash
read -s SOURCE_DATABASE_URL && export SOURCE_DATABASE_URL
```

(cole `postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres` — Supabase → Project Settings → Database → Connection string)

```bash
bash scripts/mariadb/backup-supabase.sh /root/backups/supabase-$(date +%F)
```

```bash
bash scripts/mariadb/backup-mariadb.sh /root/backups/mariadb-antes-$(date +%F)
```

### 6.4 Ensaio numa base de TESTE (obrigatório antes da produção)

1. cPanel → MySQL® Databases → criar `viralizahost_viralizaTeste` e associar `viralizahost_userViralizaHost` (ALL PRIVILEGES).
2. Importar o schema: phpMyAdmin → base de teste → Importar → `database/mariadb/001_schema.sql`, ou:

```bash
MYSQL_PWD="$MYSQL_PASSWORD" mysql -u "$MYSQL_USER" viralizahost_viralizaTeste < database/mariadb/001_schema.sql
```

3. Confirmar que o schema real do Supabase é igual ao versionado (colunas criadas à mão no painel aparecem aqui):

```bash
node scripts/mariadb/generate-schema.mjs --check-only
```

Se houver diferenças: `node scripts/mariadb/generate-schema.mjs`, rever o `git diff`, voltar ao passo 2 e fazer commit.

4. Inventário, cópia, ficheiros e verificação na base de teste:

```bash
export MYSQL_DATABASE=viralizahost_viralizaTeste STORAGE_ROOT=/var/www/viralizahost-storage-teste SUPABASE_URL=https://<ref>.supabase.co NEW_SITE_URL=https://viralizahost.com
```

```bash
npm run db:migrate -- preflight
```

```bash
npm run db:migrate -- copy
```

```bash
read -s SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY && npm run db:migrate -- files
```

```bash
npm run db:migrate -- verify
```

`verify` compara, tabela a tabela: contagens, hash de cada linha (todas as colunas), somas exatas de
todas as colunas DECIMAL (totais, valores pagos, preços, saldos) e relações órfãs. Tem de terminar com
`✔ Origem e destino coincidem.` Repetir `copy` é seguro: atualiza por chave primária e nunca duplica.

5. Instância de teste (porta 3001, a partir da pasta nova; não toca no PM2 de produção). O
   `NEXT_PUBLIC_SITE_URL` é embutido no build e é usado nos URLs assinados (envio do vídeo, comprovativos),
   por isso o build de teste aponta para a própria instância; o build de produção é refeito em §6.5:

```bash
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 npm run build
```

```bash
AUTH_REQUIRE_EMAIL_CONFIRMATION=false npx next start -p 3001
```

(as variáveis `MYSQL_DATABASE`/`STORAGE_ROOT` exportadas no passo 4 sobrepõem-se ao `.env.local`)

Noutra sessão, crie dois clientes de teste em `http://127.0.0.1:3001/register` (túnel SSH) e corra:

```bash
BASE_URL=http://127.0.0.1:3001 CLIENT_EMAIL=... CLIENT_PASSWORD=... OTHER_CLIENT_EMAIL=... OTHER_CLIENT_PASSWORD=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run test:smoke
```

O teste cria um ticket e uma encomenda de convidado **na base de teste**. Verifique também à mão:
login com uma conta real, recuperação de conta (e-mail do Resend), WHM (contas WHM → Sincronizar; cPanel
SSO) e a troca Vídeo/Carrossel em Gestão do Site → Topo da Página Inicial. Pare a instância (Ctrl+C) no fim.

### 6.5 Troca em produção

1. Primeira cópia para a base de produção (o site continua no Supabase). Importe
   `database/mariadb/001_schema.sql` na base `viralizahost_viralizaHost` (phpMyAdmin) e depois:

```bash
export MYSQL_DATABASE=viralizahost_viralizaHost STORAGE_ROOT=/var/www/viralizahost-storage
```

```bash
date -u +%Y-%m-%dT%H:%M:%SZ > /root/primeira-copia.txt
```

```bash
npm run db:migrate -- preflight && npm run db:migrate -- copy && npm run db:migrate -- files && npm run db:migrate -- verify
```

```bash
npm run build
```

2. Janela de manutenção (alguns minutos): parar as escritas no Supabase.

```bash
pm2 stop viralizahost
```

3. Sincronizar o que mudou no Supabase desde a primeira cópia (inclui remoções):

```bash
npm run db:migrate -- copy --since "$(cat /root/primeira-copia.txt)" --sync-deletes
```

```bash
npm run db:migrate -- files && npm run db:migrate -- verify
```

4. Registar a hora da troca (bloqueia cópias acidentais por cima de dados novos; é a base do regresso):

```bash
npm run db:migrate -- mark-cutover
```

5. Trocar as pastas e arrancar:

```bash
mv /var/www/viralizahost /var/www/viralizahost-supabase && mv /var/www/viralizahost-mariadb /var/www/viralizahost
```

```bash
pm2 restart viralizahost --update-env && pm2 save
```

6. Cron WHM (substitui o da Vercel):

```bash
(crontab -l 2>/dev/null; echo '*/15 * * * * /var/www/viralizahost/scripts/mariadb/cron-whm-sync.sh >> /var/log/viralizahost-whm-sync.log 2>&1') | crontab -
```

7. Proxy web: permitir uploads de vídeo de 100 MB em `/storage/` — Nginx `client_max_body_size 110m;`,
   Apache `LimitRequestBody 115343360`.

### 6.6 Verificação depois do reinício do PM2

```bash
pm2 status viralizahost && pm2 logs viralizahost --lines 50 --nostream
```

```bash
cd /var/www/viralizahost && set -a && . ./.env.local && set +a && bash scripts/deploy-env-check.sh && npm run db:check
```

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://viralizahost.com/
```

```bash
curl -s -X POST https://viralizahost.com/api/db -H 'content-type: application/json' -d '{"q":{"table":"profiles","op":"select","select":"id","filters":[],"orders":[]}}'
```

(esperado: `"data":[]` — um visitante anónimo não vê perfis)

```bash
curl -s -o /dev/null -w '%{http_code}\n' -r 0-99 "$(curl -s https://viralizahost.com/ | grep -o 'https://viralizahost.com/storage/v1/object/public/[^"]*' | head -1)"
```

(esperado `206` se o topo estiver em modo Vídeo com ficheiro do Storage)

No browser: login de cliente e admin, Financeiro, abrir uma fatura e o PDF, enviar comprovativo, criar
e responder a um ticket, aprovar uma encomenda no admin, alternar Vídeo/Carrossel e confirmar a página
inicial, sincronizar WHM, pedir recuperação de palavra-passe. Não corra `test:smoke` em produção (cria registos).

### 6.7 Plano de regresso ao Supabase (preservando o que foi criado no MariaDB)

O projeto Supabase fica intacto durante o período de regresso. Para voltar:

```bash
pm2 stop viralizahost
```

```bash
cd /var/www/viralizahost && set -a && . ./.env.local && set +a && bash scripts/mariadb/backup-mariadb.sh /root/backups/mariadb-regresso-$(date +%F-%H%M)
```

Enviar para o Supabase tudo o que foi criado/alterado depois da troca (usa a hora do `mark-cutover`;
`INSERT … ON CONFLICT (id) DO UPDATE`; contas novas entram em `auth.users` + `auth.identities` com o mesmo
hash bcrypt; ficheiros novos vão para o Storage):

```bash
read -s SOURCE_DATABASE_URL && read -s SUPABASE_SERVICE_ROLE_KEY && export SOURCE_DATABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_URL=https://<ref>.supabase.co
```

```bash
npm run db:migrate -- reverse
```

Voltar à pasta antiga (build Supabase intacto):

```bash
mv /var/www/viralizahost /var/www/viralizahost-mariadb && mv /var/www/viralizahost-supabase /var/www/viralizahost
```

```bash
pm2 restart viralizahost --update-env && pm2 save
```

Limitações do regresso: linhas **apagadas** no MariaDB depois da troca não são apagadas no Supabase;
tabelas sem `created_at/updated_at` (`product_features`) são reenviadas por inteiro (upsert idempotente);
URLs públicos reescritos para `viralizahost.com/storage/...` ficam assim no Supabase (para os repor,
substituir o prefixo por SQL). Os utilizadores voltam a iniciar sessão. Retire também a linha do crontab.

---

## 7. Resultados dos testes (ambiente de ensaio)

Sem acesso ao Supabase nem ao servidor a partir desta sessão, o ensaio foi feito com uma réplica:
PostgreSQL 16 com `supabase/migrations/*.sql` aplicadas sobre um stub dos schemas `auth`/`storage`
(`test-fixtures/supabase-stub.sql`) e dados fictícios com acentos, valores decimais, microssegundos,
JSON, arrays, contas bcrypt, conta sem palavra-passe e ficheiros; destino MariaDB 10.11.14 com um
utilizador só com `ALL PRIVILEGES` na base (como no cPanel).

| Verificação | Resultado |
|---|---|
| `001_schema.sql` importado 2× (idempotente) com utilizador sem privilégios globais | ✔ 40 tabelas |
| `preflight` / `copy` / `verify` | ✔ 39 tabelas iguais (contagens, hash por linha, Σ financeiros, sem órfãs) |
| Acentos (`João Conceição`, `ção`, JSON `{"ç":"ã"}`), DECIMAL exato, microssegundos | ✔ |
| Reescrita de URLs do Storage | ✔ |
| Cópia repetida (sem duplicados) e sincronização incremental `--since --sync-deletes` | ✔ |
| `mark-cutover` bloqueia `--sync-deletes` | ✔ |
| `reverse`: conta, perfil, encomenda, fatura e ticket criados no MariaDB aparecem no PostgreSQL; hash válido no `pgcrypto` | ✔ |
| `tests/db-compat.test.ts` | ✔ 40/40 |
| `smoke-test.mjs` contra `next start` (build de produção) | ✔ 91/91 (inclui recuperação de conta com link real) |
| Browser (Playwright): login → dashboard, definições, faturação, admin (domínios, clientes, topo), redefinição com link válido e inválido | ✔ 10/10 |
| WHM (servidor WHM simulado em HTTPS): gravar credenciais cifradas, `cron/whm-sync` com e sem `CRON_SECRET`, associação por e-mail, suspender/reativar | ✔ |
| `npm run build` | ✔ sem avisos; `/` com ISR 60 s |
| `tsc --noEmit` | ✔ |

**Não testado aqui (tem de ser feito no servidor, §6.4):** a base Supabase real (o `--check-only` e o
`preflight` mostram diferenças de schema, webhooks, `pg_cron`, contas sem palavra-passe), o download real
do Storage, o envio real de e-mails pelo Resend, o WHM real e o cPanel SSO, e a configuração do proxy web.

## 8. Dependências do Supabase que restam

Na aplicação em execução: **nenhuma** (sem pacotes `@supabase/*`, sem chamadas a `*.supabase.co`).

Restam, e o que falta para as retirar:

1. **Scripts de migração/regresso** (`migrate-data.mjs`, `backup-supabase.sh`, `generate-schema.mjs`) leem o
   Supabase via `SOURCE_DATABASE_URL`/`SUPABASE_URL`. Retirar quando o período de regresso terminar.
2. **Projeto Supabase** (dados, contas, ficheiros) é a base do regresso. Depois do período combinado:
   backup final, pausar/apagar o projeto e revogar a service role key.
3. **URLs `*.supabase.co` fora da base de dados** (e-mails já enviados, conteúdo externo, links guardados
   noutros sistemas) deixam de funcionar quando o projeto for apagado. URLs dentro das tabelas são reescritos.
4. **Variáveis** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_ACCESS_TOKEN` já não são lidas; apagar do servidor depois do período de regresso.
5. **Nomes históricos** no código: pasta `supabase/migrations/` (histórico do schema), `src/types/database.ts`,
   módulos `src/lib/supabase/*` (nome mantido para não alterar ~100 ficheiros; já são MariaDB). Podem ser
   renomeados/removidos numa limpeza posterior.
6. **`vercel.json`** (cron) não é usado no servidor PM2; o cron passa a ser o do §6.5, passo 6.
