# Publicação — diagnóstico de entrega de e-mail (domínio do destinatário e registo de tentativas)

Executar depois do merge do PR na `main`. Pastas existentes:

- `/var/www/viralizahost-main`: cópia Git.
- `/var/www/viralizahost`: produção.

Reinicia apenas `viralizahost`.

**Migração:** `20261125_09_auth_email_skipped.sql`. Só alarga a lista de estados de `auth_email_log`; não apaga nem altera linhas existentes.

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

echo "== 5. Migração (alarga os estados de auth_email_log)"
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
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SELECT name, applied_at FROM vh_schema_migrations WHERE name LIKE '2026112%'"
for h in 8.8.8.8 1.1.1.1; do dig +short +time=3 +tries=1 MX gmail.com @$h | grep -q . && echo "DNS público $h: acessível" || echo "DNS público $h: sem resposta — abrir saída UDP/TCP 53 (sem ela a verificação de domínio fica «não confirmado» e não bloqueia)"; done
dig +short TXT send.viralizahost.com @8.8.8.8 | grep -q amazonses && echo "SPF send.viralizahost.com: OK" || echo "SPF send.viralizahost.com: EM FALTA (ver docs/diagnostico-email-destinatario.md, B)"
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:

1. Abrir **Integrações → E-mail transaccional → Diagnosticar um destinatário** → `comercial@3manuelseguranca.ao`.
2. Seguir `docs/diagnostico-email-destinatario.md`.

## Reversão
Igual a `docs/publicacao-contas-email.md` (extrair `/var/backups/viralizahost-prod-<TS>.tgz` e `pm2 restart viralizahost`). A versão anterior não depende dos estados novos.
