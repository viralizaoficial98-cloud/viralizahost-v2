# Transferência bancária com domínio nacional a confirmar (.ao, .co.ao)

## O que muda para o cliente

- **Pagamento sem esperar pela confirmação:** um domínio sem consulta automática (por exemplo `.ao` ou `.co.ao`) já não bloqueia o pagamento, tanto em encomendas só de domínio como em carrinhos mistos (domínio + e-mail corporativo ou alojamento).
- **«Total a pagar»:** carrinho, pagamento e revisão mostram o total completo.
  - O aviso passa a ser: «Pode pagar agora. A nossa equipa vai confirmar a disponibilidade do domínio antes de o registar.»
  - Desaparecem «Ainda não pague», «Total (pago após confirmação)» e «Registar encomenda».
- **Fluxo normal de transferência:**
  - a factura fica «por pagar» (antes ficava em rascunho);
  - o comprovativo pode ser enviado no checkout ou depois, na Área do Cliente (comprovativos e facturas existentes).
- **Cartão vermelho de transferência** (`BankTransferCard`), mostrado quando o cliente escolhe «Transferência bancária»:
  - rótulo «Transferência bancária — Banco BIC», IBAN e entidade em texto seleccionável;
  - botões «Copiar IBAN» e «Copiar entidade», com confirmação anunciada (`aria-live`).
  - Depois de criar a encomenda, a página da encomenda mostra também o **montante** e a **referência do pedido**, com «Copiar referência».
  - Na Área do Cliente (pagar factura) mostra o montante e a referência da factura.
  - Não tem número de cartão, validade, CVV nem fotografia: representa os dados da transferência.
  - O pagamento com cartão continua dependente do gateway e indisponível.
- **Validações que se mantêm:** domínios já identificados como indisponíveis, preços (revalidados no servidor, 409 se mudarem), dados do cliente e prevenção de encomendas duplicadas (chave de idempotência).

## Dados bancários: fonte única

`src/lib/billing/bank-details.ts` e `load-bank-details.ts` alimentam:
- o checkout (`/api/checkout/payment-methods`);
- a página da encomenda;
- a Área do Cliente (`/api/billing/bank-details`);
- o PDF e o e-mail da factura.

Usam os dados de **Configurações → Facturação** (`company_billing_settings`, linha activa) quando têm IBAN ou número de conta. Caso contrário, usam os valores fornecidos:

| Campo | Valor |
|---|---|
| Banco | Banco BIC |
| IBAN | `005100002477517910141` (tal como fornecido, sem completar) |
| Entidade | VIRALIZA FÁCIL ANGOLA LDA |

> **Confirmar antes de publicar:** em Angola, o IBAN costuma ter o prefixo `AO06` seguido de 21 dígitos, e `005100002477517910141` tem 21 dígitos. Pode por isso ser o número de conta (NIB) e não o IBAN completo. Confirme com o titular da conta. Se for o NIB, configure em Configurações → Facturação o IBAN completo ou o «número de conta»; neste segundo caso, o cartão mostra o rótulo «N.º de conta».

## Painel de administração (Encomendas)

- **Estados separados:**
  - «Pagamento: Por pagar / Comprovativo por validar / Paga»;
  - «Domínio: A confirmar pela equipa / Confirmado — por registar / Registado / Indisponível — …»;
  - «Activação: …». Uma encomenda paga com o domínio por confirmar mostra «A aguardar confirmação do domínio», em vez de «A aguardar pagamento».
- **Comprovativo:** fica «Por validar». Só «Validar pagamento» (administrador) o marca como validado.
- **Registo do domínio:**
  - com o domínio a confirmar, o registo e os serviços que usam esse domínio (e-mail, alojamento) não avançam, mesmo com o pagamento validado;
  - não aparece «Marcar como registado»;
  - «Livre» confirma a disponibilidade; se a encomenda estiver paga, segue o fluxo existente de registo e activação;
  - o domínio só passa a «Registado» com a referência ou confirmação do registo.
- **«Ocupado…» (motivo obrigatório):**
  - **sem pagamento nem comprovativo:** cancela a encomenda sem cobrança, como antes;
  - **com pagamento validado ou comprovativo enviado:** não cancela nem reembolsa. Abre um **caso manual**:
    - «Propor outro domínio…» (o cliente vê a proposta na encomenda);
    - «Cliente aceitou: substituir…» (só a mesma extensão, ou seja o mesmo preço pago; outra extensão é tratada manualmente);
    - «Encaminhar para reembolso…» (tratado manualmente pela equipa financeira);
    - «Encerrar caso…».
- **Histórico:** todas as decisões ficam em «Histórico do domínio», com data, autor, motivo e proposta.
- **Autorização:** a mesma do painel (`requireAdminRole`). Cliente → 401.

**Encomendas anteriores:** as que já estavam retidas (factura em rascunho) mantêm-se como estão e são libertadas por «Livre», como antes. Nenhuma encomenda, pagamento ou factura existente é alterado.

**Correcção incluída:** marcar como «Ocupado» um domínio de encomenda sem pagamento tentava gravar `domains.status = 'cancelled'`, valor que não existe na coluna. Com `STRICT_TRANS_TABLES`, a operação falhava. Agora remove apenas o registo local pendente, que nunca chegou a ser registado.

## Migração

**Sim:** `database/mariadb/migrations/20261202_16_domain_cases.sql`, que corre depois da 15.
- **O que acrescenta:**
  - `order_items.domain_case`, `domain_case_note` e `proposed_domain`, que ficam a NULL nas linhas existentes;
  - a tabela `order_domain_events` (histórico).
- **O que não altera:** dados existentes. É idempotente.

## Testes (ensaio)

`scripts/mariadb/rehearsal/bank-transfer-domain-e2e.cjs`, incluído em `run-all.sh`. Usa pagamentos simulados (transferência sem cobrança real) e o WHM e o RDAP simulados.

## Publicação

Executar depois do merge e só com aprovação. Reinicia **só** `viralizahost`.

```bash
bash -s <<'PUBLICAR'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
DB=viralizahost_viralizaHost
TS=$(date +%F-%H%M)
Q="mysql --defaults-extra-file=$HOME/.vh-my.cnf $DB"

echo "== 1. Commit da main e versão em produção"
git -C "$GIT_DIR" fetch -q origin main
git -C "$GIT_DIR" checkout -q main
git -C "$GIT_DIR" merge -q --ff-only origin/main
COMMIT=$(git -C "$GIT_DIR" rev-parse HEAD)
DEPLOYED=$(curl -fsS https://viralizahost.com/api/version | grep -o '"commit":"[0-9a-f]\{40\}"' | cut -d'"' -f4 || true)
[ -n "$DEPLOYED" ] || { echo "Não foi possível ler o commit em produção (/api/version) — parar"; exit 1; }
echo "main: $(git -C "$GIT_DIR" log --oneline -1) · produção: $DEPLOYED"
git -C "$GIT_DIR" merge-base --is-ancestor "$DEPLOYED" "$COMMIT"
git -C "$GIT_DIR" diff --name-only "$DEPLOYED" "$COMMIT" -- database/mariadb/migrations | sort

echo "== 2. Dados bancários configurados (confirmar IBAN vs número de conta com o titular)"
$Q -e "SELECT bank_name, account_holder, account_number, iban FROM company_billing_settings WHERE active = 1"
echo "Sem linha com IBAN/conta → o site usa: Banco BIC · IBAN 005100002477517910141 · VIRALIZA FÁCIL ANGOLA LDA"

echo "== 3. Estado antes (encomendas, facturas e pagamentos)"
$Q -e "SELECT 'orders', payment_status, COUNT(*) FROM orders GROUP BY payment_status UNION ALL SELECT 'invoices', status, COUNT(*) FROM invoices GROUP BY status UNION ALL SELECT 'payments', status, COUNT(*) FROM payments GROUP BY status" > "/var/backups/viralizahost-estados-antes-$TS.txt"
$Q -e "SELECT o.order_number, i.status FROM orders o JOIN invoices i ON i.order_id = o.id WHERE o.hold_reason = 'domain_confirmation'" | tee "/var/backups/viralizahost-retidas-$TS.txt"

echo "== 4. Backup da base e da pasta de produção"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
chmod 600 "/var/backups/viralizahost-base-$TS.sql.gz" "/var/backups/viralizahost-prod-$TS.tgz"
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"

echo "== 5. Código (preserva .env.local, node_modules e ficheiros carregados)"
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
git -C "$GIT_DIR" diff --name-only --diff-filter=D "$DEPLOYED" "$COMMIT" | while read -r f; do rm -f -- "$PROD_DIR/$f" && echo "removido: $f"; done
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$DEPLOYED" "$COMMIT" -- package.json package-lock.json; then npm ci; fi

echo "== 6. Migração 20261202_16_domain_cases.sql (só acrescenta colunas e uma tabela)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "SELECT 'orders', payment_status, COUNT(*) FROM orders GROUP BY payment_status UNION ALL SELECT 'invoices', status, COUNT(*) FROM invoices GROUP BY status UNION ALL SELECT 'payments', status, COUNT(*) FROM payments GROUP BY status" > "/var/backups/viralizahost-estados-depois-$TS.txt"
diff "/var/backups/viralizahost-estados-antes-$TS.txt" "/var/backups/viralizahost-estados-depois-$TS.txt" && echo "OK: encomendas, facturas e pagamentos inalterados"

echo "== 7. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 8. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -fsS https://viralizahost.com/api/billing/bank-details; echo
curl -sS -o /dev/null -w "acções do painel sem sessão %{http_code} (esperado 401)\n" -X POST -H 'Content-Type: application/json' -d '{"action":"domain_case"}' https://viralizahost.com/api/admin/orders
pm2 ls
PUBLICAR
```

**Reversão:**
1. Repor `/var/backups/viralizahost-prod-<TS>.tgz`, compilar e reiniciar `viralizahost`.
2. As colunas novas e a tabela de histórico são ignoradas pela versão anterior.
3. Encomendas criadas entretanto com domínio a confirmar ficam com a factura «por pagar». A versão anterior trata-as como encomendas normais, sem retenção.
