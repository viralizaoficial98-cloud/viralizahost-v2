#!/usr/bin/env bash
# TESTE — execução completa e reproduzível dos testes de fluxos em modo MySQL (ambiente local, nunca produção).
#
# Requer: Node 20+, Python 3 + Playwright, Google Chrome, cliente mysql/mariadb, um servidor MariaDB/MySQL de teste
# e um PostgreSQL com o schema viralizahost (réplica local das migrations) para os dados de base.
#
#   DB_ADMIN_CMD="mariadb -uroot -S /run/mysqld.sock"   # cliente com privilégio para criar a base de teste
#   DB_HOST=127.0.0.1 DB_PORT=3307                       # onde a app liga
#   SOURCE_PG_URL=postgresql://…/vh_src                  # origem dos dados de base
#   TLS_DIR=/tmp/e2e/tls (ca.pem, srv.pem, srv.key)      # certificado do WHM simulado
#   ./run-e2e.sh [secções…]
set -euo pipefail
cd "$(dirname "$0")/../../.."
DB=vhtest_app USER_=vhtest_app PASS='Teste#Local2026' APP_PORT=${APP_PORT:-3105}
: "${DB_ADMIN_CMD:?}" "${DB_HOST:?}" "${DB_PORT:?}" "${SOURCE_PG_URL:?}" "${TLS_DIR:?}"
MYSQL_APP="${MYSQL_CLIENT:-mysql} -u$USER_ -p$PASS -h$DB_HOST -P$DB_PORT --default-character-set=utf8mb4 $DB"

echo "1/6 Base de teste com utilizador limitado (como uma conta cPanel)"
$DB_ADMIN_CMD -e "DROP DATABASE IF EXISTS $DB; CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  DROP USER IF EXISTS '$USER_'@'$DB_HOST'; CREATE USER '$USER_'@'$DB_HOST' IDENTIFIED BY '$PASS';
  GRANT ALL PRIVILEGES ON $DB.* TO '$USER_'@'$DB_HOST'; FLUSH PRIVILEGES;"
$MYSQL_APP < database/mysql/001_schema.sql

echo "2/6 Dados de base: PostgreSQL → MySQL com o script de migração"
export SOURCE_PG_URL MYSQL_HOST=$DB_HOST MYSQL_PORT=$DB_PORT MYSQL_USER=$USER_ MYSQL_PASSWORD=$PASS MYSQL_DATABASE=$DB
node scripts/mysql-migration/migrate-data.mjs import > /tmp/e2e-import.log
node scripts/mysql-migration/migrate-data.mjs validate | tail -1

echo "3/6 Serviços simulados (Supabase Auth/Storage, WHM)"
pkill -f mock-supabase.mjs || true; pkill -f mock-whm.mjs || true; sleep 1
node scripts/mysql-migration/test/mock-supabase.mjs > /tmp/e2e-mock.log 2>&1 &
TLS_KEY=$TLS_DIR/srv.key TLS_CERT=$TLS_DIR/srv.pem node scripts/mysql-migration/test/mock-whm.mjs > /tmp/e2e-whm.log 2>&1 &
sleep 1

echo "4/6 Compilação em modo MySQL"
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test SUPABASE_SERVICE_ROLE_KEY=service-test
export NEXT_PUBLIC_DATA_BACKEND=mysql RESEND_API_KEY=re_dummy RESEND_BASE_URL=http://localhost:54321/resend CRON_SECRET=cron-test WHM_ENCRYPTION_KEY=$(printf '%064d' 7)
export NEXT_PUBLIC_SITE_URL=http://localhost:$APP_PORT NEXT_PUBLIC_APP_URL=http://localhost:$APP_PORT NODE_EXTRA_CA_CERTS=$TLS_DIR/ca.pem
rm -rf .next && npm run build > /tmp/e2e-build.log 2>&1 || { tail -30 /tmp/e2e-build.log; exit 1; }
grep -m1 "^┌" /tmp/e2e-build.log || true

echo "5/6 Arranque"
fuser -k $APP_PORT/tcp > /dev/null 2>&1 || true; sleep 1
npx next start -p $APP_PORT > /tmp/e2e-app.log 2>&1 &
sleep 6

echo "6/6 Fluxos"
[ $# -eq 0 ] && set -- publico auth cliente isolamento admin hero whm extra
APP=http://localhost:$APP_PORT MYSQL_CMD="$MYSQL_APP" python3 scripts/mysql-migration/test/e2e_flows.py "$@"
