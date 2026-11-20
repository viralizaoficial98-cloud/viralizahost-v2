#!/usr/bin/env bash
# Ensaio completo contra a base de ENSAIO e o WHM simulado. Nunca apontar para produção.
#   APP_LOG=/caminho/next.log BASE_URL=http://localhost:3000 bash scripts/mariadb/rehearsal/run-all.sh
set -u
cd "$(dirname "$0")/../../.."
case "$(node --env-file=.env.local -p 'process.env.DB_NAME')" in
  *rehearsal*|*ensaio*) ;;
  *) echo "Recusado: DB_NAME em .env.local não parece uma base de ensaio."; exit 2 ;;
esac
# A importação WHM é repetida do zero: remove as contas do WHM simulado (só existem no ensaio)
node --env-file=.env.local -e "
const m=require('mysql2/promise');(async()=>{const c=await m.createConnection({host:process.env.DB_HOST,port:+process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
await c.query(\"DELETE s FROM services s JOIN hosting_accounts h ON h.service_id=s.id WHERE h.cpanel_username='mariaacu'\");
await c.query(\"DELETE FROM hosting_accounts WHERE cpanel_username='mariaacu'\");
await c.query(\"DELETE FROM whm_accounts WHERE whm_username IN ('joaoconc','mariaacu','semdono','dupdom')\");await c.end()})()"
fail=0
run() { echo; echo "=== $1"; shift; "$@" || fail=$((fail+1)); }
run "Compras, pagamentos e activação" node --env-file=.env.local scripts/mariadb/rehearsal/commerce-e2e.mjs
run "Área do Cliente, renovações, catálogo" node --env-file=.env.local scripts/mariadb/rehearsal/client-area-e2e.mjs
run "Importação WHM" node --env-file=.env.local scripts/mariadb/rehearsal/whm-import-e2e.mjs
if [ "${SKIP_UI:-0}" = "1" ]; then
  echo; echo "=== Interface e links: ignorados (SKIP_UI=1, sem Chromium neste servidor)"
else
  run "Interface desktop + iPhone" node scripts/mariadb/rehearsal/ui-e2e.cjs
  run "Links do site" node scripts/mariadb/rehearsal/links-audit.cjs
  run "Links com sessão" node scripts/mariadb/rehearsal/links-audit-auth.cjs
fi
echo; echo "Conjuntos com falhas: $fail"; exit $fail
