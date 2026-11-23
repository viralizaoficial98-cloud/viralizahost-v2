# E-mail Corporativo: períodos, descontos e fichas de plano

## O que o administrador gere

**Administração → Catálogo e Preços → E-mail** (`/admin/site/catalog?cat=email`). A antiga página `/admin/site/email-plans` passa a abrir aqui.

- **Novo plano / editar plano:**
  - nome (2–80 caracteres) e descrição curta (até 160);
  - armazenamento por caixa em GB;
  - limite de envio por hora (opcional);
  - características: acrescentar, editar, remover e reordenar com ↑/↓ (até 20);
  - etiqueta opcional (ex.: «Mais popular»; destaca o cartão);
  - ordem de apresentação e estado («À venda», «Sob consulta», «Rascunho»).
- **Preço mensal base por caixa (Kz)** e **desconto % por período**: 1 mês, 1 ano, 2 anos, 3 anos.
  - Inteiros de 0 a 90; 0 é aceite.
  - A tabela mostra em tempo real o mensal com desconto, o total por caixa e a renovação.
- **Desconto na renovação % (opcional, por período):**
  - Por omissão é 0, e a renovação é o preço base × meses.
  - Os cartões só anunciam um desconto de renovação quando ele está configurado.
- **Armazenamento e limite de envio são informativos.** Descrevem o plano nos cartões, mas não configuram quotas no servidor de e-mail; o painel avisa disso. A quota técnica é a do **pacote WHM** do plano, definido na linha do produto (Catálogo → E-mail) e mostrado na ficha. Mantenha os valores iguais aos do pacote.
- **Preços de e-mail na tabela genérica:** deixam de se editar ali; o servidor recusa com 400. Assim a regra de arredondamento é sempre a mesma.

## Regra única de preço

Definida em `src/lib/commerce/period-pricing.ts` e aplicada pelo servidor ao gravar:

```
mensal com desconto (por caixa) = arredondar ao kwanza( base × (100 − desconto) / 100 )
total do período (por caixa)    = mensal com desconto × meses
total da linha                  = total do período × caixas
```

Exemplo: base Kz 790 com 70% por 36 meses → Kz 237/caixa/mês, Kz 8 532 por caixa (4 caixas: Kz 34 128).

O total de cada período fica gravado em `product_prices.price`, a fonte única. A partir daí:
- os cartões dividem-no pelos meses para mostrar o equivalente mensal;
- a configuração, o carrinho, o checkout e a encomenda usam esse mesmo valor, recalculado no servidor (`quoteCart`).

## Página pública e página inicial

Componente `EmailPlansSection`, usado em `/email-corporativo` e na página inicial.

- **Selector «1 mês», «1 ano», «2 anos», «3 anos»:**
  - mostra «Poupe X%» quando todos os planos têm o mesmo desconto nesse período;
  - mostra «Até X%» quando os descontos diferem entre planos;
  - não mostra etiqueta quando o desconto é 0.
- **Cada cartão mostra:**
  - «Poupe X%» e o preço base riscado, só quando o desconto é maior que 0;
  - o mensal com desconto «por caixa de correio»;
  - o total do período, com a indicação «N meses pagos antecipadamente»;
  - a renovação, o armazenamento, o limite de envio, as características e a etiqueta, pela ordem definida.
- **«Configurar»** abre `/comprar/<plano>?ciclo=<período>` com esse período já escolhido.
- **Carrinho e checkout mostram:**
  - o período, com a indicação «N meses pagos antecipadamente»;
  - o número de caixas de correio;
  - o desconto («Desconto 70% (−Kz …)»);
  - o total.
- **Preço alterado com o plano no carrinho:** a confirmação devolve HTTP 409 «o total foi actualizado» e mostra o novo total antes de o cliente confirmar.
- **Encomendas e facturas já emitidas** guardam os seus valores e não mudam.

## Segurança

- `/api/admin/catalog/email-plans` (GET, POST, PUT) passa por `requireAdminRole()`: visitante → 401, cliente → 403.
- Todos os valores são validados no servidor:
  - nome, limites numéricos e descontos inteiros 0–90;
  - preço com até 2 casas decimais;
  - texto sem HTML nem caracteres de controlo.
- Cada alteração fica em `activity_logs`.

## Migração

`database/mariadb/migrations/20261130_14_email_plans.sql` (idempotente):

- **Colunas novas:**
  - `products.base_monthly_price`, `storage_gb` e `send_limit_hour`;
  - `product_prices.discount_pct` e `renewal_discount_pct` (por omissão 0).
- **Planos e preços actuais preservados:**
  - o preço base é o preço mensal actual;
  - o armazenamento vem da característica «N GB» já publicada;
  - os totais existentes não são alterados.
- **Descontos:** ficam todos a 0. Os promocionais só se aplicam quando o administrador os grava.
- **Ciclos trimestral e semestral:** ao gravar a ficha de um plano no painel, ficam inactivos nesse plano. A oferta pública já mostra só os 4 períodos.

## Testes (ensaio)

`scripts/mariadb/rehearsal/email-plans-e2e.cjs` (incluído em `run-all.sh`). Cobre:
- a migração;
- a autorização e a validação;
- criar e editar um plano no painel;
- os 4 períodos;
- o desconto 0;
- descontos diferentes por plano;
- o exemplo 790/70%/36 meses;
- 4 caixas, com cartão = configuração = carrinho = checkout;
- o preço alterado com o plano no carrinho;
- as encomendas e facturas preservadas;
- o telemóvel.

O teste repõe o catálogo de e-mail no fim, e as encomendas de ensaio são por transferência, sem cobrança.

## Publicação

Executar depois do merge na `main`. Reinicia **só** `viralizahost`.

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

echo "== 2. Preços de e-mail actuais (antes)"
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SELECT p.slug, pp.cycle, pp.price, pp.renewal_price, pp.active FROM products p JOIN product_prices pp ON pp.product_id = p.id WHERE p.category = 'email' ORDER BY p.slug, pp.months" | tee "/var/backups/viralizahost-email-precos-antes-$TS.txt"

echo "== 3. Backup da base e da pasta de produção"
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

echo "== 5. Migração (20261130_14_email_plans.sql — preserva planos e preços)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SELECT slug, base_monthly_price, storage_gb, send_limit_hour FROM products WHERE category = 'email' ORDER BY position"
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SELECT p.slug, pp.cycle, pp.price, pp.renewal_price, pp.active FROM products p JOIN product_prices pp ON pp.product_id = p.id WHERE p.category = 'email' ORDER BY p.slug, pp.months" > "/var/backups/viralizahost-email-precos-depois-$TS.txt"
diff "/var/backups/viralizahost-email-precos-antes-$TS.txt" "/var/backups/viralizahost-email-precos-depois-$TS.txt" && echo "OK: preços de e-mail inalterados pela migração"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -fsS 'https://viralizahost.com/api/products?category=email' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s).data){const r=(p.product_prices||[]).filter(x=>+x.active);console.log(p.slug, r.map(x=>`${x.cycle}=${x.price} (-${x.discount_pct}%)`).join(" "))}})'
curl -sS -o /dev/null -w "planos de e-mail sem sessão %{http_code} (esperado 401)\n" https://viralizahost.com/api/admin/catalog/email-plans
curl -sS -o /dev/null -w "/email-corporativo %{http_code}\n" https://viralizahost.com/email-corporativo
pm2 ls
PUBLICAR
```

**Reversão:**
1. Repor `/var/backups/viralizahost-prod-<TS>.tgz`, compilar e reiniciar `viralizahost`.
2. As colunas novas não afectam a versão anterior. Os preços continuam em `product_prices`.
3. Se algum desconto já tiver sido gravado, a versão anterior mostra os totais gravados, sem a etiqueta.
