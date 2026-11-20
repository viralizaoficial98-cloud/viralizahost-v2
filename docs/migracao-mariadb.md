# Migração Supabase → MariaDB (cPanel)

Estado: **código pronto e ensaiado localmente. A troca em produção e o reinício do serviço estão pendentes de aprovação.** A origem Supabase não é alterada por nenhum script (a ligação de leitura é `read only`).

## 1. O que o projecto usava do Supabase

| Serviço | Uso real | Substituição |
|---|---|---|
| Base de dados (PostgREST) | 37 tabelas no schema `viralizahost`, ~470 chamadas em 112 ficheiros, servidor **e navegador** | MariaDB + `src/lib/db` (API compatível `from().select().eq()…`) |
| Embeds PostgREST | `profiles(…)`, `plan:plans(…)`, `ticket_messages(count)`, etc. | resolvidos pelas FKs em `schema.generated.ts` |
| RLS | 118 políticas | `src/lib/db/policies.ts` (verificação no servidor, por pedido) |
| RPC | 12 funções `public.*` (encomendas, facturação, catálogo) | `src/lib/db/rpc.ts` (transacções) |
| Triggers | `updated_at`, nº de ticket, sincronização de comprovativos, criação de perfil | `ON UPDATE CURRENT_TIMESTAMP(6)` + `src/lib/db/hooks.ts` + `src/lib/auth/server.ts` |
| Auth | login por senha, registo com confirmação de e-mail, recuperação, alteração de senha, `admin.createUser/updateUserById` | `src/lib/auth` (sessões em `auth_sessions`, hashes bcrypt preservados) |
| Storage | buckets `site-banners`, `site-videos`, `site-team` (públicos), `payment-proofs`, `invoices` (privados); upload assinado do vídeo | `src/lib/storage` + rotas `/storage/v1/object/...` (mesmo formato de URL) |
| Realtime | **não usado** (só `onAuthStateChange`, emulado no cliente) | — |
| Edge Functions | não usadas | — |
| Management API | rotas `/api/admin/migrate`, `/whm/migrate`, `setup-products` aplicavam DDL | passam a só verificar; o schema vem de `database/mariadb/schema.sql` |
| Cron | `vercel.json` → `/api/cron/whm-sync` a cada 15 min | **no cPanel não há cron da Vercel**: criar Cron Job (ver §5.6) |

Outros schemas: as migrações `001_initial.sql` criam tabelas legadas em `public` (`profiles`, `plans`, …) que o código **não usa**. O script de migração lista as contagens em `preflight.other_schemas`; confirme no relatório da produção se têm dados que interessem.

### Diferenças repositório ↔ produção a confirmar
Ao reconstruir o schema aplicando `supabase/migrations` por ordem num PostgreSQL limpo:
- `20260711_002000_site_banners_storage.sql` falha (`CREATE POLICY IF NOT EXISTS` não existe em PostgreSQL);
- `20260711_010000_products_catalog.sql` e `20260711_020000_fix_slugs_and_products.sql` têm `INSERT`s com colunas a mais;
- `20260711_000000_site_schema_fix.sql` referencia o papel `authenticator`;
- há FKs duplicadas (mesmas colunas) — o gerador omite-as.

Por isso **o schema MariaDB deve ser regenerado a partir da produção** antes do corte (§5.2): o gerador lê o catálogo real e `--check` diz se difere do commitado.

### Conteúdo vindo de código (valores de reserva)
Nas migrações, `site_banners`, `site_domains`, `site_email_plans`, `site_hosting_plans` e `site_team` ficam **vazias**: o conteúdo de produção foi criado no painel (ou por `/api/admin/seed-site`). Quando uma destas tabelas não tem linhas activas, o site mostra valores fixos do código (`HeroCarousel` `FALLBACK_SLIDES`, `PricingSection` `FALLBACK_PLANS`, `DynamicServicePricing fallbackPlans`, `TeamSection`, `lib/checkout/catalog.ts`). A migração **não cria** esses registos (para não mudar o que o site mostra); o relatório, em `site_content`, indica por tabela se o site está a usar a reserva e que registos-semente faltam na origem.

## 2. Ficheiros

| Ficheiro | Função |
|---|---|
| `database/mariadb/schema.sql` | DDL MariaDB 10.11, utf8mb4, idempotente, importável no phpMyAdmin |
| `database/mariadb/seed/*.sql` | dados de reserva do catálogo (equivalentes às RPC `setup_*`) |
| `scripts/mariadb/generate-schema.mjs` | gera `schema.sql` + `src/lib/db/schema.generated.ts` a partir do PostgreSQL (`--check` detecta diferenças) |
| `scripts/mariadb/migrate-data.mjs` | migração em lotes (simulação por omissão, `--execute`, `--mode=sync`, `--verify`) |
| `scripts/mariadb/check-connection.mjs` | confirma host/socket, privilégios e utf8mb4 a partir do Node.js |
| `scripts/mariadb/export-changes.mjs` | lista escritas no MariaDB após o corte (reconciliação em caso de rollback) |
| `scripts/mariadb/rehearsal/*` | ensaio: stub Supabase, dados fictícios, teste de fumo |
| `src/lib/db/*`, `src/lib/auth/*`, `src/lib/storage/*` | camada de dados, autenticação e ficheiros |
| `src/lib/supabase/{server,client}.ts` | compatibilidade: mesmos nomes de funções, agora sobre MariaDB |
| `.env.example` | variáveis necessárias |

## 3. Comportamento preservado e diferenças intencionais

Preservado: rotas públicas, painel `/admin`, Área do Cliente, contratos JSON das APIs, IDs (UUID), relações, precisão `DECIMAL`, datas com microssegundos (UTC), estados (ENUM), texto com acentos/emoji, URLs dos ficheiros (mesmo caminho `/storage/v1/object/public/...`, novo domínio), semântica de `createAdminClient` (com sessão actua como o utilizador, sem sessão como serviço).

Diferenças (todas no sentido de fechar falhas):
1. **Escrita nas tabelas `site_*` exige admin.** No Supabase a política era `USING (true)` para qualquer autenticado — um cliente podia alterar banners/preços pela API.
2. **Registo nunca cria administradores.** O trigger `handle_new_user` aceitava `role` vindo do navegador.
3. **RPCs deixam de estar expostas ao navegador** (no Supabase, `approve_order` etc. eram chamáveis com a anon key).
4. `/api/admin/setup-products` passa a exigir admin (antes bastava sessão).
5. Limite de tentativas: login 10/15 min por e-mail e 30/15 min por IP; recuperação 3/h por e-mail.
6. `reject_order` falhava sempre no PostgreSQL (`'cancelled'` não existe em `domain_status`) e a rota usava o fallback, que não mexe no domínio. A versão portada reproduz esse resultado.
7. **Todos os utilizadores terão de iniciar sessão uma vez** após a troca (os cookies `sb-*` deixam de valer). As senhas mantêm-se.
8. Contas sem hash bcrypt (login social/magic link, se existirem) ficam com `password_reset_required=1` e entram via "Esqueci a senha".
9. Links de recuperação/confirmação enviados pelo Supabase antes do corte deixam de funcionar; os novos e-mails são enviados pela conta Resend (`RESEND_*`).

## 4. Ensaio realizado (base isolada, dados fictícios)

PostgreSQL 16 com o schema reconstruído das migrações + `rehearsal/seed-source.sql`; MariaDB 10.11.14 (mesmo ramo da produção, 10.11.20).

- Schema importado pelo utilizador da aplicação (sem root), reimportação sem erros.
- Simulação → execução → reexecução: **0 duplicados, 0 conflitos, 0 erros**; contas com hash `$2a$10$` copiadas.
- Destino com dados prévios: conflitos por PK e por chave única (`slug`, `page_slug`) **detectados e não sobrescritos**.
- `--mode=sync`: linhas mais recentes na origem actualizadas; linha alterada no MariaDB depois do corte → conflito, não tocada.
- `--verify`: contagens por tabela, 20 amostras aleatórias por ID, totais financeiros por estado/moeda (`invoices`, `payments`, `orders`, `invoice_items`, `clients.credit_balance`), órfãos, ficheiros (existência e tamanho) e contas — **sem diferenças**.
- Teste de fumo HTTP (57/57), fluxos de autenticação (18/18), navegador real (10/10): ver §6.

## 5. Procedimento em produção (cPanel/WHM)

> Os passos marcados **[aprovação]** só devem ser feitos com a tua autorização.
> Não tenho acesso ao servidor: os caminhos e o nome do processo PM2 abaixo são marcadores — confirma-os no passo 5.1 e substitui.

### 5.1 Confirmar o ambiente
```bash
pm2 ls                                   # nome do processo da ViralizaHost  → <PM2_NOME>
pm2 describe <PM2_NOME> | grep -E "exec cwd|script path|exec mode"   # → <APP_DIR>
cat <APP_DIR>/ecosystem.config.js 2>/dev/null || ls -la <APP_DIR>/.env*
mysqladmin -u <DB_USER> -p variables | grep -E "socket|^\| port"
```
Na pasta da aplicação, com as novas variáveis num ficheiro protegido (`chmod 600`):
```bash
node --env-file=.env.local scripts/mariadb/check-connection.mjs
```
Usar em `DB_HOST`/`DB_SOCKET` a primeira opção marcada ✓ (no cPanel `localhost` costuma resolver para o socket). `DB_NAME` tem de ser escrito exactamente `viralizahost_viralizaHost` (`lower_case_table_names=0`).

### 5.2 Schema a partir da produção
Obter a connection string do Supabase (Project Settings → Database → *Session pooler* ou directa) e, num computador ou no servidor:
```bash
SOURCE_DATABASE_URL='postgres://…' node scripts/mariadb/generate-schema.mjs --check
```
Se indicar diferenças, correr sem `--check`, rever o diff, commitar e refazer o build. Importar `database/mariadb/schema.sql` no phpMyAdmin (base `viralizahost_viralizaHost` → Importar) ou usar `--apply-schema` no passo seguinte.

### 5.3 Backups verificáveis
```bash
# Supabase (só leitura)
pg_dump "$SOURCE_DATABASE_URL" -n viralizahost -n auth -n storage -Fc -f supabase-$(date +%F).dump
pg_restore -l supabase-$(date +%F).dump | wc -l                    # deve listar objectos
# MariaDB (antes de cada escrita)
mysqldump --single-transaction --routines -u <DB_USER> -p viralizahost_viralizaHost | gzip > mariadb-$(date +%F-%H%M).sql.gz
gunzip -t mariadb-*.sql.gz && echo OK
# Release actual
tar czf release-$(date +%F).tgz -C <APP_DIR> .next package.json .env.local ecosystem.config.js 2>/dev/null
```
Guardar os ficheiros fora de `public_html`.

### 5.4 Carga inicial (sem parar o site)
`.env.migration` (chmod 600) com `SOURCE_DATABASE_URL`, `SOURCE_SUPABASE_URL`, `SOURCE_SUPABASE_SERVICE_ROLE_KEY`, `DB_*`, `STORAGE_DIR`, `NEXT_PUBLIC_SITE_URL=https://viralizahost.com`.
```bash
node --env-file=.env.migration scripts/mariadb/migrate-data.mjs                 # simulação + relatório
node --env-file=.env.migration scripts/mariadb/migrate-data.mjs --execute       # carga
node --env-file=.env.migration scripts/mariadb/migrate-data.mjs --verify
```
Rever `migration-reports/*.json`: `errors`, `preflight.column_drift`, conflitos, `site_content`, `other_schemas`. O volume esperado é pequeno; corre por SSH em minutos (lotes de 500, `--batch-size` ajustável). Se não houver SSH, o schema pode ser importado no phpMyAdmin, mas os dados precisam do script (Node.js).

### 5.5 Janela de corte **[aprovação]**
Escolher horário de menor tráfego (≈10–15 min).
1. Backups do 5.3 (MariaDB de novo).
2. Delta: `migrate-data.mjs --execute --mode=sync` e `--verify`.
3. Trocar a configuração: definir as variáveis de `.env.example` (`DB_*`, `STORAGE_*`, `NEXT_PUBLIC_SITE_URL`, `AUTH_EMAIL_CONFIRMATION`), manter as antigas `NEXT_PUBLIC_SUPABASE_*` comentadas para rollback.
4. Deploy desta branch: `npm ci && npm run build` na pasta da release.
5. Reiniciar **só** a ViralizaHost: `pm2 restart <PM2_NOME> --update-env` (ou `pm2 reload` em cluster). Anotar a hora UTC → `<CORTE>`.
6. Imediatamente: `migrate-data.mjs --execute --mode=sync` outra vez (apanha escritas que chegaram ao Supabase durante o restart) e `--verify`. Conflitos listados = linhas alteradas nos dois lados → rever à mão.
7. Testes (5.7).

### 5.6 Ajustes do servidor
- `STORAGE_DIR` fora da release (ex.: `/home/<user>/viralizahost-storage`), `chmod 750`, dono = utilizador do PM2.
- Upload do vídeo (até 100 MB): no Apache/proxy reverso do cPanel, garantir `LimitRequestBody` ≥ 110 MB e timeout de proxy ≥ 300 s para `/storage/v1/object/upload/`.
- Cron Job no cPanel (substitui o da Vercel), a cada 15 min:
  `curl -s -X POST https://viralizahost.com/api/cron/whm-sync -H "Authorization: Bearer <CRON_SECRET>" > /dev/null`
- Remetente Resend verificado: os e-mails de recuperação e confirmação de conta passam a sair daí.

### 5.7 Testes após o arranque
```bash
BASE_URL=https://viralizahost.com SMOKE_WRITE=false \
ADMIN_EMAIL=… ADMIN_PASSWORD=… CLIENT_EMAIL=… CLIENT_PASSWORD=… CLIENT2_EMAIL=… CLIENT2_PASSWORD=… \
node scripts/mariadb/rehearsal/smoke-test.mjs
```
(`SMOKE_WRITE=false` não cria tickets/encomendas nem altera preços; usar contas de teste.) Manualmente: login admin e cliente, `/admin/site` (carrossel/vídeo, banners de páginas, domínios, e-mail, hospedagem, catálogo, equipa) e publicação de uma alteração no site, comprovativo no checkout, "Esqueci a senha" (recepção do e-mail), Agente IA.

### 5.8 Rollback
Critério: erro funcional grave sem correcção rápida.
1. Repor a release anterior (`git checkout e24d6bd` ou o `.tgz` do 5.3) e as variáveis `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE_KEY`; `npm ci && npm run build`; `pm2 restart <PM2_NOME> --update-env`.
2. Reconciliação das escritas feitas no MariaDB:
   ```bash
   node --env-file=.env.migration scripts/mariadb/export-changes.mjs --since="<CORTE>"
   ```
   O ficheiro (permissões 600, contém dados pessoais) lista por tabela as linhas criadas/alteradas e se existem no Supabase. Reaplicar no Supabase por esta ordem: contas novas (o cliente define senha via "Esqueci a senha"), `orders`/`order_items`, `invoices`, `payments` (+ ficheiros novos em `payment-proofs`), `tickets`/`ticket_messages`, alterações da Gestão do Site. Tabelas sem `updated_at` (ex.: `site_domains`) só mostram linhas novas — comparar com `--verify` em sentido inverso se tiverem sido editadas.
3. O MariaDB fica intacto para nova tentativa.

## 6. Resultados dos testes (ensaio local)
- `tsc --noEmit`: 0 erros. `next build`: OK. ESLint: 0 erros nos ficheiros novos; total do projecto 407 → 405 erros (pré-existentes, quase todos `no-explicit-any`).
- `smoke-test.mjs`: 57/57 — páginas públicas, isolamento entre clientes (leitura e escrita), bloqueio de visitantes, admin, edição → site público, tickets (nº `VH-TKT-AAAA-NNNNNN`), checkout → `create_order` → `approve_order` → factura paga, upload de comprovativo, vídeo com `Range` (206), URLs assinados, logout.
- Fluxos de auth: 18/18 — registo com confirmação, link de uso único, alteração e recuperação de senha, senha definida pelo admin, conta sem hash, limite de tentativas.
- Navegador (Playwright): login pelo formulário, Área do Cliente (facturas, tickets), Gestão do Site (domínios, equipa), clientes, página inicial em modo vídeo, reset-password — sem erros JS.
- Não testado aqui: envio real de e-mails (sem `RESEND_API_KEY`), Agente IA (sem `ANTHROPIC_API_KEY`), sincronização WHM (sem servidor WHM), download real do Supabase Storage (testado com cópia local `--storage-source-dir`).
