#!/usr/bin/env bash
# Ensaio completo contra a base de ENSAIO e o WHM simulado. Nunca apontar para produção.
#   APP_LOG=/caminho/next.log BASE_URL=http://localhost:3000 bash scripts/mariadb/rehearsal/run-all.sh
# O processo Next de ensaio deve correr com RDAP_BOOTSTRAP_URL=http://127.0.0.1:12088/dns.json (mock-rdap.mjs),
# NODE_EXTRA_CA_CERTS=<certificado do WHM simulado>, ORDER_RATE_LIMIT=500, QUOTE_RATE_LIMIT=200,
# REGISTRAR_TEST_PROVISIONING=1, REGISTRAR_TIMEOUT_MS=2000, VPS_PROVIDER_TIMEOUT_MS=2000, LOGIN_RATE_LIMIT=100 e SIGNUP_RATE_LIMIT=200 (nunca em produção); RESEND_API_URL=http://127.0.0.1:12090 com mock-resend.mjs e RESEND_API_KEY fictícia «re_…» (com mock-registrar.mjs --delay=4000 na porta 12089 e mock-hostinger.mjs --delay=4000 --vps-ready=3000 na porta 12091).
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
run "Regras: catálogo de domínios Hostinger e especificações VPS (unidades)" node --test scripts/registrar/hostinger-catalog.test.mjs scripts/vps/vps-specs.test.mjs
run "Compras, pagamentos e activação" node --env-file=.env.local scripts/mariadb/rehearsal/commerce-e2e.mjs
run "Área do Cliente, renovações, catálogo" node --env-file=.env.local scripts/mariadb/rehearsal/client-area-e2e.mjs
run "Importação WHM" node --env-file=.env.local scripts/mariadb/rehearsal/whm-import-e2e.mjs
run "Associação manual de contas WHM a clientes" node --env-file=.env.local scripts/mariadb/rehearsal/whm-link-e2e.mjs
run "Contas: verificação de e-mail e eliminação" node --env-file=.env.local scripts/mariadb/rehearsal/account-email-e2e.mjs
run "Painel: receita, acções pendentes, registrador e WHM" node --env-file=.env.local scripts/mariadb/rehearsal/admin-ops-e2e.mjs
run "Registrador Hostinger (API simulada): compra autorizada, 202, timeout, recuperação" node --env-file=.env.local scripts/mariadb/rehearsal/hostinger-e2e.mjs
run "Hostinger activada depois da encomenda: botão em Encomendas" node --env-file=.env.local scripts/mariadb/rehearsal/hostinger-activation-e2e.cjs
run "Catálogo de domínios e cartões da página inicial" node --env-file=.env.local scripts/mariadb/rehearsal/domain-catalog-e2e.cjs
if [ "${SKIP_UI:-0}" = "1" ]; then
  echo; echo "=== Interface e links: ignorados (SKIP_UI=1, sem Chromium neste servidor)"
else
  run "Domínio avulso: configuração, carrinho, cadastro e pagamento (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/domain-checkout-e2e.cjs
  run "Facturação: IBAN, titular e imagem do cartão (painel, checkout, Área do Cliente)" node --env-file=.env.local scripts/mariadb/rehearsal/bank-settings-e2e.cjs
  run "Transferência com domínio .ao a confirmar: pagar já, comprovativo, painel (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/bank-transfer-domain-e2e.cjs
  run "Hospedagem Premium: períodos, descontos e fichas de plano (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/hosting-plans-e2e.cjs
  run "E-mail Corporativo: períodos, descontos e fichas de plano (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/email-plans-e2e.cjs
  run "Servidor VPS: planos, compra, comprovativo e Hostinger VPS simulada (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/vps-purchase-e2e.cjs
  run "Configurações → Contas: confirmação de e-mail configurável (registo e checkout)" node --env-file=.env.local scripts/mariadb/rehearsal/account-settings-e2e.cjs
  run "Presença Global: bandeiras no mapa e na lista (desktop + telemóvel)" node scripts/mariadb/rehearsal/global-presence-e2e.cjs
  run "VPS: só 1 mês, 1 ano e 2 anos (3 meses, 6 meses e 3 anos retirados), carrinho antigo, renovações, KVM 2" node --env-file=.env.local scripts/mariadb/rehearsal/vps-cycles-e2e.cjs
  run "VPS: duração + localização + instalação, licenças, escolher mais tarde, Os meus VPS (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/vps-install-e2e.cjs
  run "Hospedagem de sites: ordem das secções, H1, âncoras, SSL do catálogo e percurso de compra (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/hosting-page-e2e.cjs
  run "Domínios: hero do painel (independente), Registo de domínios, catálogo e fluxos (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/domains-page-e2e.cjs
  run "Servidores Dedicados Linux e Windows: planos, páginas e compra (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/dedicated-plans-e2e.cjs
  run "Menu principal (5 grupos), páginas consolidadas e encaminhamentos (desktop + telemóvel)" node scripts/mariadb/rehearsal/menu-e2e.cjs
  run "Percursos de compra (desktop + telemóvel)" node --env-file=.env.local scripts/mariadb/rehearsal/purchase-flows-e2e.cjs
  run "Interface desktop + iPhone" node scripts/mariadb/rehearsal/ui-e2e.cjs
  run "Painel: menu, acções pendentes, integrações (desktop + iPhone)" node scripts/mariadb/rehearsal/admin-ui-e2e.cjs
  run "Contas no navegador: registo, verificação e eliminação" node --env-file=.env.local scripts/mariadb/rehearsal/account-ui-e2e.cjs
  run "Links do site" node scripts/mariadb/rehearsal/links-audit.cjs
  run "Links com sessão" node scripts/mariadb/rehearsal/links-audit-auth.cjs
fi
echo; echo "Conjuntos com falhas: $fail"; exit $fail
