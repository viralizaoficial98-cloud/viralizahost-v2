# Compra de domínio avulso — fluxo, testes e publicação

## Fluxo

1. **Pesquisa** (`/dominios/pesquisar`, separador «Registar»):
   - **Disponível** → «Registrar Agora», no resultado principal e nas alternativas.
   - **A confirmar pela equipa** (ex.: `.ao`, sem consulta automática) → «Solicitar registo», com o aviso de que o pagamento só é pedido depois da confirmação.
   - **Indisponível** → botão desactivado. A configuração de um domínio ocupado também não deixa avançar quando é aberta por endereço directo.
   - Os separadores «Transferir» e «Renovar» mantêm os rótulos e as regras de antes (EPP, «inclui 1 ano», renovar só domínios da conta).
2. **Configuração do domínio** (`/dominios/configurar?dominio=…`):
   - Mostra o período de registo disponível para a extensão (1 a 3 anos quando há preço de renovação), o preço a pagar agora e o de renovação. Os valores vêm de `domain_prices`.
   - Nameservers: os padrão da ViralizaHost ou nameservers próprios (2 a 4, sem repetidos e fora do próprio domínio). São validados no navegador, em `POST /api/domains/config`, na cotação e na encomenda.
   - «Adicionar hospedagem» é opcional. O plano junta-se ao carrinho com o domínio escolhido (`domainMode = register`).
   - «Continuar» valida no servidor, cria ou actualiza o item no mesmo lugar (sem duplicar) e abre `/carrinho`. Ao voltar para editar, a página recupera a configuração guardada.
3. **Carrinho** (`/carrinho`):
   - Mostra todos os itens com período, preço, renovação e total a pagar agora, calculados no servidor.
   - Permite editar, remover, continuar a comprar e esvaziar.
   - O carrinho fica no navegador e no servidor (`shopping_carts`, cookie `vh_cart`), por isso sobrevive a recarregar, ao login e à verificação de e-mail, mesmo noutro dispositivo. O código EPP nunca é guardado.
4. **Finalizar** (`/carrinho/finalizar`) — o servidor decide o passo seguinte:

   | Situação | Destino |
   |---|---|
   | Carrinho vazio | `/carrinho` |
   | Sem sessão | `/checkout/conta`: cadastro com os dados do titular, ou «Já tenho conta» |
   | Sessão com dados obrigatórios em falta | `/checkout/dados`: pede só o que falta, sem e-mail nem senha |
   | Sessão com dados completos | `/checkout/pagamento` |

   - Os dados obrigatórios são nome, telefone, país, morada e cidade. A validação usa os valores guardados, não o facto de o cliente já ter comprado antes.
   - Com verificação de e-mail obrigatória, o carrinho fica associado à conta e o link do e-mail leva a `/carrinho/finalizar`. Funciona noutro navegador e também com «Reenviar e-mail».
5. **Pagamento** (`/checkout/pagamento`):
   - Reaproveita a transferência bancária e a revisão do checkout anterior.
   - Antes de criar a encomenda, o servidor recalcula preços, períodos, disponibilidade e nameservers. A chave de idempotência continua a impedir encomendas duplicadas.
   - Se houver domínios «A confirmar pela equipa», a encomenda fica retida sem cobrança: factura em rascunho e sem pagamento.
   - O endereço antigo `/checkout?plan=…|domain=…|renew=…` continua a funcionar. Junta o item ao carrinho e abre `/carrinho`; com `domain=`, abre a configuração do domínio.

**Nameservers:**
- Cada item de domínio guarda a escolha em `order_items.nameservers` (`{"useDefault":…,"ns":[…]}`). As colunas `orders.ns1..ns4` ficam com os nameservers do primeiro domínio.
- A activação pelo registrador usa os nameservers do item. O painel mostra-os em **Encomendas**.
- Os nameservers padrão configuram-se em **Integrações → Registrador → Nameservers padrão**. Sem configuração, ficam `ns1/ns2.viralizahost.com`.

## Migração

`database/mariadb/migrations/20261126_10_domain_cart.sql` (idempotente, não altera dados existentes):
- cria a tabela `shopping_carts`;
- acrescenta `order_items.nameservers` (JSON, pode ficar vazio);
- acrescenta `registrar_settings.default_nameservers` (JSON, pode ficar vazio).

## Testes (ensaio local: MariaDB 10.11, RDAP, WHM, registrador e Resend simulados)

- `domain-checkout-e2e.cjs` (novo, desktop 1440 e iPhone 13): domínio disponível, indisponível e com confirmação manual; nameservers padrão e próprios; edição e recarregar; visitante que cria conta (confirmação noutro navegador e no mesmo); «Já tenho conta»; cliente com dados em falta; cliente com dados completos; carrinho misto; preço alterado antes de confirmar; duplo clique; esvaziar; transferência, hospedagem, renovação e links antigos.
- Os ensaios existentes (`run-all.sh`) foram adaptados aos novos endereços (`/carrinho`, «Finalizar», `/checkout/conta`, `/checkout/pagamento`).
- `prepare-server-rehearsal.mjs` completa os dados dos clientes 1 e 2 e cria o cliente 3, com dados em falta.

## Publicação

Executar depois do merge na `main`. O bloco abaixo:
- faz backup da base e da pasta de produção;
- copia o código e aplica a migração;
- compila e reinicia **só** `viralizahost`;
- confirma o commit em `/api/version`.

```bash
bash -s <<'PUBLICAR'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
DB=viralizahost_viralizaHost
TS=$(date +%F-%H%M)

echo "== 1. Commit da main e versão em produção"
git -C "$GIT_DIR" fetch -q origin main
git -C "$GIT_DIR" checkout -q main
git -C "$GIT_DIR" merge -q --ff-only origin/main
COMMIT=$(git -C "$GIT_DIR" rev-parse HEAD)
DEPLOYED=$(curl -fsS https://viralizahost.com/api/version | grep -o '"commit":"[0-9a-f]\{40\}"' | cut -d'"' -f4 || true)
[ -n "$DEPLOYED" ] || { echo "Não foi possível ler o commit em produção (/api/version) — parar"; exit 1; }
echo "main: $(git -C "$GIT_DIR" log --oneline -1) · produção: $DEPLOYED"
git -C "$GIT_DIR" merge-base --is-ancestor "$DEPLOYED" "$COMMIT"
git -C "$GIT_DIR" diff --name-only "$DEPLOYED" "$COMMIT" -- database/mariadb/migrations

echo "== 2. Backup da base e da pasta de produção"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
chmod 600 "/var/backups/viralizahost-base-$TS.sql.gz" "/var/backups/viralizahost-prod-$TS.tgz"
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"

echo "== 3. Código (preserva .env.local, node_modules e ficheiros carregados)"
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
git -C "$GIT_DIR" diff --name-only --diff-filter=D "$DEPLOYED" "$COMMIT" | while read -r f; do rm -f -- "$PROD_DIR/$f" && echo "removido: $f"; done
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$DEPLOYED" "$COMMIT" -- package.json package-lock.json; then npm ci; fi

echo "== 4. Migração (20261126_10_domain_cart.sql: shopping_carts + colunas de nameservers)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SHOW TABLES LIKE 'shopping_carts'; SHOW COLUMNS FROM order_items LIKE 'nameservers'; SHOW COLUMNS FROM registrar_settings LIKE 'default_nameservers'"

echo "== 5. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 6. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in /carrinho /dominios/pesquisar "/dominios/configurar?dominio=exemplo.ao" /checkout/conta; do curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
curl -sS -o /dev/null -w "/carrinho/finalizar (sem carrinho → /carrinho) %{http_code} %{redirect_url}\n" https://viralizahost.com/carrinho/finalizar
curl -fsS "https://viralizahost.com/api/domains/config?dominio=exemplo.ao" | grep -o '"defaultNameservers":\[[^]]*\]'
curl -sS -o /dev/null -w "encomenda sem sessão %{http_code} (esperado 401)\n" -X POST -H 'Content-Type: application/json' -d '{}' https://viralizahost.com/api/checkout/orders
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:

1. Abrir **Integrações → Registrador → Nameservers padrão** e confirmar os nameservers (por omissão `ns1/ns2.viralizahost.com`).
2. Como visitante, pesquisar um `.com` livre → «Registrar Agora» → «Continuar» → «Finalizar». Deve abrir o cadastro. Não é preciso concluir.
3. Se tudo estiver bem: `pm2 save`.

## Reversão

```bash
bash -s <<'REVERTER'
set -euo pipefail
TS=<data-hora do backup>
tar -xzf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www
cd /var/www/viralizahost && npm run build 2>&1 | tail -3
pm2 restart viralizahost
sleep 8
curl -fsS https://viralizahost.com/api/version; echo
REVERTER
```

A tabela e as colunas novas não afectam a versão anterior. Não é preciso desfazer a migração.
