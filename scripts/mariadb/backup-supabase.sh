#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Backup completo do Supabase (PostgreSQL) ANTES da migração.
#
#   export SOURCE_DATABASE_URL='postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres'
#   bash scripts/mariadb/backup-supabase.sh /root/backups/supabase-$(date +%F)
#
# Produz (fora do Git):
#   full.dump            pg_dump -Fc de toda a base (restaurável com pg_restore)
#   schema.sql           só estrutura (todos os schemas)
#   viralizahost.sql     dados e estrutura do schema da aplicação (texto)
#   auth.sql             auth.users e auth.identities (contém hashes de palavras-passe!)
#   storage.sql          metadados do storage (buckets e objects)
#   csv/<tabela>.csv     uma exportação CSV por tabela (leitura humana / phpMyAdmin)
#   SHA256SUMS
# Requer pg_dump/psql >= versão do servidor (Supabase usa PostgreSQL 15/17).
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
: "${SOURCE_DATABASE_URL:?defina SOURCE_DATABASE_URL}"
OUT="${1:-./supabase-backup-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT/csv"
chmod 700 "$OUT"
umask 077

echo "→ pg_dump completo (formato custom)"
pg_dump "$SOURCE_DATABASE_URL" -Fc --no-owner --no-privileges -f "$OUT/full.dump"

echo "→ estrutura"
pg_dump "$SOURCE_DATABASE_URL" --schema-only --no-owner --no-privileges -f "$OUT/schema.sql"

echo "→ schema viralizahost (dados + estrutura)"
pg_dump "$SOURCE_DATABASE_URL" -n viralizahost --no-owner --no-privileges -f "$OUT/viralizahost.sql"

echo "→ auth (contas)"
pg_dump "$SOURCE_DATABASE_URL" --data-only -t auth.users -t auth.identities --no-owner -f "$OUT/auth.sql"

echo "→ storage (metadados)"
pg_dump "$SOURCE_DATABASE_URL" --data-only -t storage.buckets -t storage.objects --no-owner -f "$OUT/storage.sql"

echo "→ CSV por tabela"
for t in $(psql "$SOURCE_DATABASE_URL" -At -c "select table_schema||'.'||table_name from information_schema.tables where table_schema in ('viralizahost','public') and table_type='BASE TABLE' order by 1"); do
  psql "$SOURCE_DATABASE_URL" -q -c "\\copy (select * from $t) to '$OUT/csv/$t.csv' with (format csv, header true, encoding 'UTF8')"
done
psql "$SOURCE_DATABASE_URL" -q -c "\\copy (select id, email, created_at, last_sign_in_at, email_confirmed_at from auth.users) to '$OUT/csv/auth.users.csv' with (format csv, header true)"

echo "→ contagens"
psql "$SOURCE_DATABASE_URL" -At -c "select 'viralizahost.'||relname||' '||n_live_tup from pg_stat_user_tables where schemaname='viralizahost' order by 1" > "$OUT/row-estimates.txt" || true

(cd "$OUT" && sha256sum full.dump schema.sql viralizahost.sql auth.sql storage.sql > SHA256SUMS)
echo "✔ backup em $OUT (contém dados pessoais e hashes — guardar fora do Git, com acesso restrito)"
echo "  Ficheiros do Storage: node scripts/mariadb/migrate-data.mjs files (descarrega para STORAGE_ROOT)"
