#!/usr/bin/env bash
# Reproduz o ensaio de migração numa máquina de desenvolvimento (PostgreSQL 16 + MariaDB 10.11 locais):
#  1) réplica PostgreSQL com o schema do Supabase (supabase/migrations) e dados fictícios
#  2) base MariaDB de teste com database/mariadb/001_schema.sql
#  3) preflight → copy → verify
# Uso: PGURL=postgresql://postgres:pg@127.0.0.1:5432/postgres MYSQL_PASSWORD=... bash scripts/mariadb/test-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${PGURL:?PGURL para um PostgreSQL local}"; : "${MYSQL_PASSWORD:?}"
export MYSQL_DATABASE="${MYSQL_DATABASE:-viralizahost_test}" MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
psql "$PGURL" -q -c 'drop database if exists vh_src' -c 'create database vh_src'
SRC="${PGURL%/*}/vh_src"
psql "$SRC" -q -c "do \$\$ begin create role anon nologin; exception when others then null; end \$\$" -c "do \$\$ begin create role authenticated nologin; exception when others then null; end \$\$" -c "do \$\$ begin create role service_role nologin; exception when others then null; end \$\$" -c "do \$\$ begin create role authenticator nologin; exception when others then null; end \$\$"
grep -v '^create role' scripts/mariadb/test-fixtures/supabase-stub.sql | psql "$SRC" -q
for f in $(ls supabase/migrations/*.sql | sort); do psql "$SRC" -q -f "$f" >/dev/null 2>&1 || true; done
psql "$SRC" -q -v ON_ERROR_STOP=1 -f scripts/mariadb/test-fixtures/seed-source.sql
mysql -h"$MYSQL_HOST" -u"${MYSQL_USER:-viralizahost_userViralizaHost}" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < database/mariadb/001_schema.sql
export SOURCE_DATABASE_URL="$SRC" SUPABASE_URL=https://abcdefghij.supabase.co
node scripts/mariadb/migrate-data.mjs preflight
node scripts/mariadb/migrate-data.mjs copy
node scripts/mariadb/migrate-data.mjs verify
