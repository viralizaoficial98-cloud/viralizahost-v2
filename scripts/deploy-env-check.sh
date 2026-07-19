#!/bin/bash
# deploy-env-check.sh
# Executar no servidor de produção ANTES do deploy para verificar variáveis obrigatórias

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

echo ""
echo "═══════════════════════════════════════"
echo "  ViralizaHost — Verificação de Deploy"
echo "═══════════════════════════════════════"
echo ""

echo "── Supabase ──"
check NEXT_PUBLIC_SUPABASE_URL
check NEXT_PUBLIC_SUPABASE_ANON_KEY
check SUPABASE_SERVICE_ROLE_KEY

echo ""
echo "── IA ──"
check ANTHROPIC_API_KEY

echo ""
echo "── Resend (E-mail de Faturas) ──"
check RESEND_API_KEY
check RESEND_FROM_EMAIL
check RESEND_FROM_NAME

echo ""
echo "── Resultado ──"
echo -e "${GREEN}OK: $OK${NC}  ${RED}FALHA: $FAIL${NC}"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}ATENÇÃO: Adicionar as variáveis em falta ao .env.local ou ecosystem.config.js antes de continuar.${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}Todas as variáveis obrigatórias estão configuradas. Pode prosseguir com o deploy.${NC}"
