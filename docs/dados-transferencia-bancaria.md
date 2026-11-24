# Dados de transferência bancária geridos no painel (IBAN, titular e imagem do cartão)

## O que o administrador gere

**Administração → Facturação** (`/admin/settings/billing`), secção **«Transferência bancária»**:

- **Campos:** nome do banco, **titular da conta (entidade)**, **IBAN**, SWIFT e instruções de pagamento.
- **IBAN, validado no servidor ao guardar** (`src/lib/billing/iban.ts`):
  - **Formato:**
    - aceita espaços de formatação, que são retirados;
    - mantém os zeros iniciais, porque o IBAN é tratado sempre como texto;
    - passa a maiúsculas.
  - **Verificações:** código do país (2 letras), 2 dígitos de controlo, comprimento do país (Angola: 25) e controlo mod 97.
  - **Número de conta em vez de IBAN:** se for só um número de conta (por exemplo, 21 dígitos), a mensagem pede o IBAN completo. **Nunca são acrescentados prefixos nem dígitos.**
  - **IBAN incompleto ou com um dígito trocado:** é recusado com uma mensagem própria.
- **Titular:** 3–120 caracteres, sem HTML.
- **Valor antigo inválido:** se o IBAN guardado não for válido (por exemplo, o valor de 21 dígitos usado até agora), o painel mostra um aviso para o corrigir.
  - O valor **não é alterado automaticamente**.
  - Guardar outros campos não o reescreve nem fica bloqueado: o IBAN só é validado quando muda.
- **Imagem do cartão (opcional):**
  - carregar, substituir ou remover, com **pré-visualização no próprio cartão do site antes de guardar**;
  - só PNG, JPEG ou WebP, até 2 MB, verificados no servidor pelo conteúdo real do ficheiro (um texto com extensão `.png` é recusado);
  - o formulário indica que a imagem é decorativa e não pode ter número do cartão, validade ou CVV;
  - fica no armazenamento existente (`lib/storage`, bucket público `billing-assets`);
  - a nova imagem é gravada **antes** de a configuração mudar, e só depois se apaga a anterior. Qualquer falha mantém a imagem anterior.
- **Permissões:** só administradores (`requireAdminRole`), tanto para guardar como para carregar ou remover. Cliente e visitante → 401/403.
- **Auditoria:** cada alteração fica em `activity_logs` (`entity_type = 'billing_settings'`): IBAN e titular «antes → depois», e imagem carregada, substituída ou removida.

## Onde os dados aparecem

Há **uma única configuração guardada** (`company_billing_settings`, linha activa), lida por `src/lib/billing`:

- checkout (`/api/checkout/payment-methods`) e página da encomenda;
- Área do Cliente (pagar factura, `/api/billing/bank-details`);
- **facturas novas**: cada factura guarda uma cópia dos dados em vigor na emissão (`invoices.bank_details`). O PDF e o e-mail usam essa cópia, por isso uma alteração posterior no painel **não muda facturas já emitidas**.

**`BankTransferCard`:**
- IBAN em grupos de 4 (o «Copiar IBAN» copia sem espaços) e titular em texto seleccionável, com botões de copiar;
- a imagem fica **por trás** dos dados (`alt=""`, `aria-hidden`). Sem imagem, ou se não carregar, o cartão usa o fundo vermelho e os dados continuam visíveis;
- o montante e a referência continuam onde já apareciam (encomenda e factura);
- o pagamento por transferência com `.ao` ou `.co.ao` a confirmar mantém-se.

**Também corrigido:** na Área do Cliente, reabrir o pagamento de uma factura com um pagamento já iniciado e ainda sem comprovativo mostrava só «Já existe um pagamento…» e não deixava avançar. Agora continua esse pagamento, sem criar outro.

## Migração

**Ficheiro:** `database/mariadb/migrations/20261203_17_bank_transfer_settings.sql`. É idempotente.

**Ordem:** depois da `…_16_domain_cases.sql` (PR #44). O `migrate-schema.mjs` aplica as pendentes por ordem.

**O que faz:**
1. Acrescenta `company_billing_settings.bank_card_image_path` (NULL = sem imagem).
2. **Uma só configuração:** se a linha activa ainda não tiver IBAN nem número de conta, guarda nela os dados que o site mostra hoje (Banco BIC · `005100002477517910141` · VIRALIZA FÁCIL ANGOLA LDA), tal como estão, sem validar nem completar. Linhas com dados já guardados não são tocadas.
3. Acrescenta `invoices.bank_details` e preenche-o nas facturas existentes com os dados que mostravam. Mantém `updated_at`; estado, valores e números ficam iguais.

**Depois da migração:** se o valor guardado não for um IBAN válido, o painel mostra o aviso. O administrador corrige-o com o IBAN completo confirmado pelo titular da conta.

> **Nota:** `AO06` seguido dos 21 dígitos actuais (`AO06 0051 0000 2477 5179 1014 1`) passa na verificação dos dígitos de controlo. Isso sugere que o valor actual é o NIB e que o IBAN completo começa por `AO06`. O valor **não foi alterado**: confirme-o com o titular e introduza-o no painel.

## Testes (ensaio)

`scripts/mariadb/rehearsal/bank-settings-e2e.cjs`, incluído em `run-all.sh`. Usa IBAN e titulares fictícios e as imagens de `scripts/mariadb/rehearsal/fixtures/`, e repõe a configuração original no fim.

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
echo "Migrações novas (aplicadas por esta ordem):"
git -C "$GIT_DIR" diff --name-only "$DEPLOYED" "$COMMIT" -- database/mariadb/migrations | sort

echo "== 2. Dados bancários guardados e facturas (antes)"
$Q -e "SELECT bank_name, account_holder, account_number, iban FROM company_billing_settings WHERE active = 1"
$Q -e "SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, total, amount_paid, updated_at, invoice_number) ORDER BY id)) h FROM invoices" | tee "/var/backups/viralizahost-facturas-antes-$TS.txt"

echo "== 3. Backup da base, da pasta de produção e do armazenamento"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
chmod 600 "/var/backups/viralizahost-base-$TS.sql.gz" "/var/backups/viralizahost-prod-$TS.tgz"
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"

echo "== 4. Código (preserva .env.local, node_modules e ficheiros carregados)"
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
git -C "$GIT_DIR" diff --name-only --diff-filter=D "$DEPLOYED" "$COMMIT" | while read -r f; do rm -f -- "$PROD_DIR/$f" && echo "removido: $f"; done
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$DEPLOYED" "$COMMIT" -- package.json package-lock.json; then npm ci; fi

echo "== 5. Migrações (16 se pendente, depois 17)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, total, amount_paid, updated_at, invoice_number) ORDER BY id)) h FROM invoices" > "/var/backups/viralizahost-facturas-depois-$TS.txt"
diff "/var/backups/viralizahost-facturas-antes-$TS.txt" "/var/backups/viralizahost-facturas-depois-$TS.txt" && echo "OK: facturas emitidas inalteradas"
$Q -e "SELECT COUNT(*) total, SUM(bank_details IS NOT NULL) com_dados FROM invoices"
$Q -e "SELECT bank_name, account_holder, iban, bank_card_image_path FROM company_billing_settings WHERE active = 1"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -fsS https://viralizahost.com/api/billing/bank-details; echo
curl -sS -o /dev/null -w "definições sem sessão %{http_code} (esperado 401)\n" https://viralizahost.com/api/admin/billing-settings
curl -sS -o /dev/null -w "imagem sem sessão %{http_code} (esperado 401)\n" -X DELETE https://viralizahost.com/api/admin/billing-settings/bank-card-image
pm2 ls
echo "Depois: em Facturação → Transferência bancária, corrigir o IBAN se aparecer o aviso (valor confirmado pelo titular)."
PUBLICAR
```

**Reversão:**
1. Repor `/var/backups/viralizahost-prod-<TS>.tgz`, compilar e reiniciar `viralizahost`.
2. As colunas novas são ignoradas pela versão anterior. A linha de facturação mantém os valores (o PR #44 já mostrava os mesmos dados por omissão).
