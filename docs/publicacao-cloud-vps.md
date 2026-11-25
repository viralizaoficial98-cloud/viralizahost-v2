# Publicação — Cloud VPS (migração 24) e lista de comprovativos

Executar **só depois do merge** do PR na `main` e da sua aprovação, por quem tem acesso ao servidor.

Pastas existentes (não se criam outras):

- `/var/www/viralizahost-main`: cópia Git.
- `/var/www/viralizahost`: produção (PM2 `viralizahost`).
- `/var/backups`: cópias de segurança (ficheiros).

Base: MariaDB `viralizahost_viralizaHost`, com credenciais em `$HOME/.vh-my.cnf`.

## O que muda na base

As migrações são aplicadas por `scripts/mariadb/migrate-schema.mjs`. O script aplica, por ordem, **todas** as que faltem e regista-as em `vh_schema_migrations`. Todas são idempotentes e só acrescentam.

`20261210_24_cloud_vps.sql`:

- cria `vps_requests`, `vps_request_events`, `vps_instances` e `vps_sync_runs`;
- acrescenta colunas opcionais:
  - `product_prices.provider_renewal_minor`;
  - `products.provider_finance`;
  - `vps_provider_orders.access_method`, `access_configured_at`, `client_hostname` e `firewall_id`;
- regista a VM **1564781** como interna e protegida;
- se não existir modo comercial, define `request_only` (solicitação mediante aprovação);
- marca as encomendas VPS já activas como `access_method='legacy'`, para continuarem entregues.

A migração não apaga nem altera preços, encomendas, serviços ou contas.

Se a produção ainda não tiver a migração 23 (Revenda, PR #57), ela também aparece como pendente. Isso é esperado.

**Nada é comprado na Hostinger.** `VPS_LIVE_PURCHASES` **não** deve ser definida. Sem ela, nenhuma compra real acontece, mesmo com o modo automático ou com «Autorizar aquisição».

## Passo 1 — verificação (só leitura)

```bash
bash -s <<'VERIFICAR'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
git -C "$GIT_DIR" fetch -q origin main
echo "main remota: $(git -C "$GIT_DIR" log --oneline -1 origin/main)"
echo "produção:    $(curl -fsS https://viralizahost.com/api/version)"
cd "$PROD_DIR"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
grep -q '^WHM_ENCRYPTION_KEY=' .env.local && echo "WHM_ENCRYPTION_KEY: presente"
grep -q '^CRON_SECRET=' .env.local && echo "CRON_SECRET: presente" || echo "AVISO: sem CRON_SECRET (a conciliação por cron fica desligada: 503)"
if grep -q '^VPS_LIVE_PURCHASES=1' .env.local; then echo "PARAR: VPS_LIVE_PURCHASES=1 definido — retirar antes de publicar"; exit 1; else echo "VPS_LIVE_PURCHASES: não definido (compras reais bloqueadas)"; fi
echo "Migrações pendentes na base de produção (sem aplicar):"
# Usa o executor da nova versão (da main remota), em modo --dry-run, com a configuração de produção
TMP=$(mktemp -d); git -C "$GIT_DIR" archive origin/main scripts/mariadb database/mariadb/migrations | tar -x -C "$TMP"
ln -s "$PROD_DIR/node_modules" "$TMP/node_modules"
( cd "$PROD_DIR" && node --env-file=.env.local "$TMP/scripts/mariadb/migrate-schema.mjs" --dry-run ) | grep -v 'já aplicada'
rm -rf "$TMP"
VERIFICAR
```

O resultado esperado é `• 20261210_24_cloud_vps.sql (pendente)`. A `23` também aparece se ainda não tiver sido publicada.

**Pare** se aparecer «(alterada desde a última aplicação)» ou se aparecer outra migração inesperada.

## Passo 2 — publicação (bloco único)

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
echo "$DEPLOYED" > "/var/backups/viralizahost-commit-anterior-$TS.txt"

echo "== 2. Backup da base, da pasta de produção e do PM2"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"
chmod 600 /var/backups/viralizahost-*-"$TS".*
echo "backups: /var/backups/viralizahost-{base,prod,pm2,commit-anterior}-$TS.*"

echo "== 3. Código (preserva .env.local, node_modules e ficheiros carregados)"
grep -q '^WHM_ENCRYPTION_KEY=' "$PROD_DIR/.env.local"
if grep -q '^VPS_LIVE_PURCHASES=1' "$PROD_DIR/.env.local"; then echo "VPS_LIVE_PURCHASES=1 definido — parar"; exit 1; fi
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
git -C "$GIT_DIR" diff --name-only --diff-filter=D "$DEPLOYED" "$COMMIT" | while read -r f; do rm -f -- "$PROD_DIR/$f" && echo "removido: $f"; done
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$DEPLOYED" "$COMMIT" -- package.json package-lock.json; then npm ci; fi

echo "== 4. Migrações pendentes (24 e anteriores em falta; só acrescentam)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs --dry-run | grep -v 'já aplicada'
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs | grep -v 'já aplicada'
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs --dry-run | grep -q 'pendente' && { echo "Ainda há migrações pendentes — parar"; exit 1; } || echo "Migrações: todas aplicadas"

echo "== 5. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 6. Verificação"
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in /servidor-vps /servidor-vps/configurar /n8n /openclaw /evolution-api /viraliza-ai-cloud /hospedagem-de-sites /email-corporativo /dominios /revenda-de-hospedagem; do
  curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
curl -sS -o /dev/null -w "API Cloud VPS sem sessão %{http_code} (esperado 401/403)\n" "https://viralizahost.com/api/admin/cloud-vps?section=overview"
curl -sS -o /dev/null -w "cron VPS sem segredo %{http_code} (esperado 401 ou 503)\n" -X POST "https://viralizahost.com/api/cron/vps-sync"
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "
  SELECT provider_vm_id, is_internal, is_protected, link_status FROM vps_instances WHERE provider_vm_id = '1564781';
  SELECT JSON_UNQUOTE(JSON_EXTRACT(options, '$.commercialMode')) modo_comercial, mode, auto_provision FROM vps_provider_settings WHERE id = 1;
  SELECT COUNT(*) pedidos_vps FROM vps_requests;"
pm2 ls
PUBLICAR
```

Resultado esperado da verificação:

- VM `1564781` com `is_internal=1`, `is_protected=1` e `link_status=unlinked`;
- `modo_comercial = request_only`;
- `pedidos_vps = 0`.

## Passo 3 — configuração no painel (com sessão de administrador, sem compras)

1. **Painel → Cloud VPS → Fornecedores → «Testar ligação».** As 7 consultas aparecem com o resultado de cada uma, e as 4 essenciais têm de estar a verde. Depois, «Sincronizar inventário»: a VM 1564781 aparece como **Interna · Protegida**, sem «Associar».
2. **Configurações:** câmbio BRL→AOA, taxas bancárias e impostos, limite mensal de despesas e extras. O modo mantém-se em **Solicitação mediante aprovação**.
3. **Planos e preços:**
   - associar cada plano ao item BRL real (`hostingercombr-vps-kvm1…kvm8`);
   - «Sincronizar custos»;
   - rever o preço sugerido e confirmar que todos os ciclos publicados aparecem como sustentáveis.
4. **SO e aplicações / Datacenters:** publicar só o que deve ficar visível. Os planos Game Panel **não** são publicados.
5. **Encomendas → «Comprovativos por validar»:** confirmar a nova lista, com pesquisa, estado, ordenação e páginas.

## Reversão (rollback)

**1. Desligar a venda VPS sem reverter código** (imediato e reversível):

- no painel: Cloud VPS → Configurações → «Desactivado»;
- ou na base: `UPDATE vps_provider_settings SET options = JSON_SET(COALESCE(options,'{}'), '$.commercialMode', 'disabled') WHERE id = 1;`

**2. Repor o código anterior** (a base fica como está: a migração só acrescenta, e o código anterior ignora as tabelas e colunas novas):

```bash
bash -s <<'REVERTER'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
TS=<carimbo-da-publicação>          # ex.: 2026-11-26-1015 (nome dos ficheiros em /var/backups)
PREV=$(cat "/var/backups/viralizahost-commit-anterior-$TS.txt")
CUR=$(git -C "$GIT_DIR" rev-parse main)
git -C "$GIT_DIR" archive "$PREV" | tar -x -C "$PROD_DIR"
# remove os ficheiros que só existem na versão nova
git -C "$GIT_DIR" diff --name-only --diff-filter=A "$PREV" "$CUR" | while read -r f; do rm -f -- "$PROD_DIR/$f"; done
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$PREV" "$CUR" -- package.json package-lock.json; then npm ci; fi
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8; curl -fsS https://viralizahost.com/api/version; echo
REVERTER
```

Alternativa equivalente: repor a pasta inteira a partir de `/var/backups/viralizahost-prod-$TS.tgz` e depois executar `npm ci && npm run build && pm2 restart viralizahost`.

**3. Base de dados — só em último caso.** Repor o dump apaga tudo o que foi registado depois da publicação (encomendas, pagamentos). Antes disso, prefira os passos 1 e 2.

```bash
gunzip -c /var/backups/viralizahost-base-<TS>.sql.gz | mysql --defaults-extra-file="$HOME/.vh-my.cnf" viralizahost_viralizaHost
```

Nada na Hostinger é comprado, parado ou alterado pela publicação nem pela reversão.
