#!/bin/bash
# deploy-env-check.sh
# Executar no servidor de produção ANTES do deploy para verificar variáveis obrigatórias
# (mostra apenas se estão definidas; nunca imprime os valores).

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

OK=0
FAIL=0

check() {
  local name=$1
  local value="${!name}"
  if [ -z "$value" ] || [ "$value" = "your_${name,,}_here" ]; then
    echo -e "${RED}✗ $name — NÃO CONFIGURADA${NC}"
    FAIL=$((FAIL+1))
  else
    echo -e "${GREEN}✓ $name — OK${NC}"
    OK=$((OK+1))
  fi
}

optional() {
  local name=$1
  if [ -z "${!name}" ]; then echo -e "${YELLOW}• $name — não definida (usa o valor por omissão)${NC}"; else echo -e "${GREEN}✓ $name — OK${NC}"; fi
}

echo ""
echo "═══════════════════════════════════════"
echo "  ViralizaHost — Verificação de Deploy"
echo "═══════════════════════════════════════"
echo ""

echo "── MariaDB ──"
check MYSQL_PASSWORD
optional MYSQL_DATABASE
optional MYSQL_USER
optional MYSQL_HOST
optional MYSQL_SOCKET

echo ""
echo "── Sessões, ficheiros e site ──"
check AUTH_SECRET
check NEXT_PUBLIC_SITE_URL
optional STORAGE_ROOT
if [ -n "$AUTH_SECRET" ] && [ ${#AUTH_SECRET} -lt 32 ]; then echo -e "${RED}✗ AUTH_SECRET tem menos de 32 caracteres${NC}"; FAIL=$((FAIL+1)); fi
STORE="${STORAGE_ROOT:-/var/www/viralizahost-storage}"
if [ -d "$STORE" ] && [ -w "$STORE" ]; then echo -e "${GREEN}✓ $STORE existe e tem escrita${NC}"; else echo -e "${RED}✗ $STORE não existe ou sem permissão de escrita${NC}"; FAIL=$((FAIL+1)); fi

echo ""
echo "── IA ──"
check ANTHROPIC_API_KEY

echo ""
echo "── Resend (faturas, recuperação de conta e confirmação de e-mail) ──"
check RESEND_API_KEY
check RESEND_FROM_EMAIL
check RESEND_FROM_NAME

echo ""
echo "── WHM / cron ──"
check WHM_ENCRYPTION_KEY
check CRON_SECRET

echo ""
echo "── Resultado ──"
echo -e "${GREEN}OK: $OK${NC}  ${RED}FALHA: $FAIL${NC}"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}ATENÇÃO: Adicionar as variáveis em falta ao ambiente do PM2 (ecosystem.config.js) ou ao .env.local do servidor antes de continuar.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}Todas as variáveis obrigatórias estão configuradas. Pode prosseguir com o deploy.${NC}"
