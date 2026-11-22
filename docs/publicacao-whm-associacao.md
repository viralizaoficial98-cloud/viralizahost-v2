# Publicação — associação manual de contas WHM a clientes

Executar **depois do merge** do PR na `main`, por quem tem acesso ao servidor.

Pastas (já existentes):

- `/var/www/viralizahost-main`: cópia Git.
- `/var/www/viralizahost`: produção (PM2 `viralizahost`, porta 3000).

Os backups ficam como ficheiros em `/var/backups`. Não se criam pastas de release.

**Migração:** `20261123_07_whm_manual_link.sql`. Só acrescenta três colunas a `whm_accounts` (`linked_by`, `linked_at`, `link_method`).

- Contas WHM, vínculos, serviços e facturas existentes ficam intactos.
- O executor aplica também as migrações anteriores que ainda faltem; todas só acrescentam.

O bloco:

- compara com o commit que a produção está a servir (`/api/version`);
- remove da produção os ficheiros apagados no Git desde esse commit;
- corre `npm ci` só se as dependências mudaram.

## Bloco único

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
DEPLOYED=${DEPLOYED:-50cbfae}
echo "main: $(git -C "$GIT_DIR" log --oneline -1) · produção: $DEPLOYED"
git -C "$GIT_DIR" merge-base --is-ancestor "$DEPLOYED" "$COMMIT"

echo "== 2. Backup da base e da pasta de produção"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
chmod 600 "/var/backups/viralizahost-base-$TS.sql.gz" "/var/backups/viralizahost-prod-$TS.tgz"
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"
echo "backups: /var/backups/viralizahost-{base,prod,pm2}-$TS.*"

echo "== 3. Código (preserva .env.local, node_modules e ficheiros carregados)"
grep -q '^WHM_ENCRYPTION_KEY=' "$PROD_DIR/.env.local"
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
git -C "$GIT_DIR" diff --name-only --diff-filter=D "$DEPLOYED" "$COMMIT" | while read -r f; do rm -f -- "$PROD_DIR/$f" && echo "removido: $f"; done
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$DEPLOYED" "$COMMIT" -- package.json package-lock.json; then npm ci; fi

echo "== 4. Migração (só acrescenta colunas)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs

echo "== 5. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 6. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -sS -o /dev/null -w "pesquisa de clientes sem sessão %{http_code} (esperado 401)\n" "https://viralizahost.com/api/admin/profiles/search?q=ab"
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SELECT COUNT(*) contas, SUM(profile_id IS NOT NULL) com_cliente, SUM(profile_id IS NULL) sem_cliente FROM whm_accounts"
pm2 ls
PUBLICAR
```

A última consulta só lê os totais de `whm_accounts`. Devem ser os mesmos de antes: a publicação não associa nem desassocia contas.

Depois, com sessão de administrador:

1. Abrir **Servidores → Contas WHM → Sem cliente** e confirmar o botão «Associar cliente» em cada conta.
2. Associar cada conta só depois de confirmar o titular.
3. Correr «Sincronizar» e confirmar que os vínculos se mantêm.

Se tudo estiver bem: `pm2 save`.

## Reversão

```bash
bash -s <<'REVERTER'
set -euo pipefail
TS=<data-hora do backup>
tar -xzf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www
pm2 restart viralizahost
sleep 8
curl -fsS https://viralizahost.com/api/version; echo
REVERTER
```

As três colunas novas não afectam a versão anterior. Os vínculos feitos entretanto ficam gravados (`profile_id`, `service_id` e `hosting_account_id` já existiam).
