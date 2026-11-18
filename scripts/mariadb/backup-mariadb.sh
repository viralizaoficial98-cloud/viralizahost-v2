#!/usr/bin/env bash
# Backup da base MariaDB (antes de cada importação/sincronização e antes da troca).
#   MYSQL_PASSWORD deve estar no ambiente; não é passado na linha de comandos.
#   bash scripts/mariadb/backup-mariadb.sh /root/backups/mariadb-$(date +%F-%H%M)
set -euo pipefail
: "${MYSQL_PASSWORD:?defina MYSQL_PASSWORD no ambiente}"
DB="${MYSQL_DATABASE:-viralizahost_viralizaHost}"
USER_="${MYSQL_USER:-viralizahost_userViralizaHost}"
OUT="${1:-./mariadb-backup-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"; chmod 700 "$OUT"; umask 077
CNF="$(mktemp)"; trap 'shred -u "$CNF" 2>/dev/null || true' EXIT
printf '[client]\nuser=%s\npassword=%s\n%s\n' "$USER_" "$MYSQL_PASSWORD" \
  "$( [ -n "${MYSQL_SOCKET:-}" ] && echo "socket=$MYSQL_SOCKET" || echo "host=${MYSQL_HOST:-localhost}
port=${MYSQL_PORT:-3306}" )" > "$CNF"
mysqldump --defaults-extra-file="$CNF" --single-transaction --routines --triggers --hex-blob \
  --default-character-set=utf8mb4 "$DB" > "$OUT/$DB.sql"
sha256sum "$OUT/$DB.sql" > "$OUT/SHA256SUMS"
echo "✔ $OUT/$DB.sql"
echo "  Ficheiros: tar -czf $OUT/storage.tgz -C \"\${STORAGE_ROOT:-/var/www/viralizahost-storage}\" ."
