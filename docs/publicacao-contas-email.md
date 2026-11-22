# Publicação — eliminação de contas e verificação de e-mail

Executar depois do merge do PR na `main`. Pastas existentes:

- `/var/www/viralizahost-main`: cópia Git.
- `/var/www/viralizahost`: produção (PM2 `viralizahost`).

Backups em `/var/backups`. Não se criam pastas de release.

**Migração:** `20261124_08_auth_email_and_deletion.sql`. Só cria a tabela `auth_email_log`; não altera contas existentes.

O bloco:

- verifica (sem mostrar valores) se `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `RESEND_FROM_NAME` estão no `.env.local` da produção;
- mostra os valores públicos `NEXT_PUBLIC_SITE_URL` e `AUTH_EMAIL_CONFIRMATION`;
- lista os últimos resultados de envio.

Se faltar a chave ou o domínio, ver `docs/contas-email-verificacao.md`.

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

echo "== 2. Configuração de e-mail (só nomes; valores públicos à parte)"
for k in RESEND_API_KEY RESEND_FROM_EMAIL RESEND_FROM_NAME WHM_ENCRYPTION_KEY; do grep -q "^$k=." "$PROD_DIR/.env.local" && echo "$k: definido" || echo "$k: EM FALTA"; done
grep -E '^(NEXT_PUBLIC_SITE_URL|AUTH_EMAIL_CONFIRMATION)=' "$PROD_DIR/.env.local" || echo "NEXT_PUBLIC_SITE_URL não definido (links usam https://viralizahost.com por omissão)"
grep -q '^NEXT_PUBLIC_SITE_URL=http://localhost' "$PROD_DIR/.env.local" && { echo "NEXT_PUBLIC_SITE_URL aponta para localhost — corrigir para https://viralizahost.com antes de publicar"; exit 1; } || true

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

echo "== 5. Migração (só cria auth_email_log)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -fsS -o /dev/null -w "/verificar-email %{http_code}\n" https://viralizahost.com/verificar-email
curl -sS -o /dev/null -w "eliminação sem sessão %{http_code} (esperado 401)\n" -X DELETE https://viralizahost.com/api/admin/clients/00000000-0000-0000-0000-000000000000
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SELECT COUNT(*) contas, SUM(email_confirmed_at IS NULL) por_verificar FROM auth_users"
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:

1. **Integrações → E-mail transaccional:**
   - confirmar «RESEND_API_KEY disponível ao processo»;
   - confirmar que os links começam por `https://viralizahost.com`;
   - **Enviar teste** para uma caixa da equipa;
   - depois **Actualizar estado de entrega**: deve aparecer «Entregue».
2. Registar uma conta de teste com um endereço da equipa, abrir o link e confirmar que entra na Área do Cliente. Eliminar a conta em **Clientes → ⋮ → Eliminar conta…**: sem dependências, é elegível.
3. Se tudo estiver bem: `pm2 save`.

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

A tabela `auth_email_log` não afecta a versão anterior.
