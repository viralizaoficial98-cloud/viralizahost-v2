#!/usr/bin/env bash
# Substitui o cron da Vercel (vercel.json → /api/cron/whm-sync a cada 15 min) no servidor PM2.
# O CRON_SECRET é lido do .env.local da aplicação (não fica no crontab).
#   crontab -e  →  */15 * * * * /var/www/viralizahost/scripts/mariadb/cron-whm-sync.sh >> /var/log/viralizahost-whm-sync.log 2>&1
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/viralizahost}"
PORT="${PORT:-3000}"
CRON_SECRET="${CRON_SECRET:-$(grep -E '^CRON_SECRET=' "$APP_DIR/.env.local" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'")}"
[ -n "$CRON_SECRET" ] || { echo "$(date -Is) CRON_SECRET em falta"; exit 1; }
curl -fsS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:$PORT/api/cron/whm-sync" | head -c 400
echo
