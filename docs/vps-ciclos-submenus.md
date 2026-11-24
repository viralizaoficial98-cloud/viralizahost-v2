# VPS só com 1 mês, 1 ano e 2 anos; painel de imagem nos submenus; «Serviços» com dez links

## 1. VPS da Hostinger: «6 meses» e «3 anos» retirados

**Ciclos à venda.** Os planos do Servidor VPS (os que se associam à Hostinger) ficam com **1 mês, 1 ano e 2 anos**, desde que publicados. Em modo automático, cada ciclo precisa também de um item de preço do mesmo período no catálogo da Hostinger.
- Lista em `VPS_CYCLES` (`src/lib/commerce/vps-shared.ts`).
- Retirados: `VPS_RETIRED_CYCLES` = 3 meses (regra anterior, mantida), 6 meses e 3 anos.

**Onde se aplica.**
- Editor administrativo, pré-visualização, página `/servidor-vps` e configuração da compra (mesmo com `?ciclo=6months`).
- Carrinho e checkout.
- Servidor: a cotação devolve `cycle_retired`, uma encomenda directa é recusada e o painel recusa gravar o ciclo.

**Carrinho antigo.** Cada VPS de 6 meses ou 3 anos fica assinalado («Este período deixou de estar disponível para novos VPS. Escolha outro período para este item.»), com o selector em «— escolha outro período —».
- Os restantes itens mantêm-se.
- «Finalizar» só fica disponível depois de corrigidos todos os itens.

**O que se preserva.**
- Encomendas, facturas, serviços e renovações não mudam. As renovações usam o preço aceite no serviço, e o teste renova serviços de 3 meses, 6 meses e 3 anos.
- As linhas de preço (com itens, custos e limites da Hostinger) ficam guardadas, só despublicadas.
- Os VPS com subcategoria (n8n, Evolution API, Viraliza AI Cloud, OpenClaw) e os restantes produtos (hospedagem, e-mail, dedicados) mantêm os seus ciclos.

**Activação automática.**
- O item de cada ciclo continua a ser confirmado no catálogo: tem de ser do produto associado e do período exacto. Por exemplo, um item de 24 meses no ciclo de 1 ano é recusado.
- **Falha temporária do catálogo:**
  - **ao gravar:** o servidor responde 503 «Erro de ligação ao catálogo da Hostinger (…). … nada foi alterado» e nada é gravado (ciclos, preços e itens ficam como estavam);
  - **ao abrir o editor:** aparece o mesmo erro de ligação.

## 2. Painel de imagem à direita dos submenus

**Origem.** É o cartão «Infraestrutura de Classe Mundial» da versão anterior ao PR #48: imagem `/infrastructure-world-class.png`, cartão «Precisa de ajuda?», mesmos textos e cores.

**Desktop.**
- **Hospedagem e site:** posicionamento e proporções anteriores, ou seja, grelha `1fr 1fr 1.4fr 260px`, coluna de 260 px e imagem de 148 px.
- **Serviços:** a variante anterior (imagem de 170 px), à direita dos quatro grupos de links.
- **Domínios e E-mail corporativo:** continuam links directos, sem painel.

**Telemóvel.** O painel é uma versão compacta por baixo dos links do grupo, sem esconder links e sem rolagem horizontal.

## 3. «Serviços»: dez links fixos, em quatro grupos

| Grupo | Links (por esta ordem) |
|---|---|
| Hospedagem | Hospedagem de site (`/hospedagem-de-sites`), Revenda de hospedagem (`/revenda-de-hospedagem`) |
| Infraestrutura | Servidor VPS (`/servidor-vps`), Servidor dedicado Linux (`/servidor-dedicado`), Servidor dedicado Windows (`/servidor-dedicado-windows`) |
| Domínios | Domínios (`/dominios`), Transferir Domínio (`/dominios/transferir`), Renovar domínio (`/dominios/renovar`) |
| E-mail | E-mail corporativo (`/email-corporativo`), Microsoft 365 Outlook (`/email/microsoft-365-outlook`) |

- «Segurança e desempenho» e as restantes entradas saem do submenu.
- As páginas continuam publicadas e no sitemap (registo `src/lib/site/pages.ts`), acessíveis a partir de `/servicos` e das páginas de cada tema.
- A mesma lista é usada no desktop e no telemóvel; no telemóvel os dez links ficam todos visíveis.

## Migração

**Sim:** `20261207_21_vps_retire_6m_3y.sql`. É idempotente e aplica-se depois da 20.
- Despublica (`active = 0`) os preços de 6 meses e 3 anos dos planos VPS sem subcategoria.
- Não apaga linhas e não toca em encomendas, facturas nem serviços.

O menu não precisa de migração.

## Testes (ensaio, sem compras reais na Hostinger)

| Conjunto | Resultado |
|---|---|
| `vps-cycles-e2e.cjs` (reescrito) | 52 OK |
| `menu-e2e.cjs` (actualizado) | 43 OK |
| Regressão completa (`run-all.sh`) | ver o PR |

`vps-cycles-e2e.cjs` cobre:
- migrações 20 e 21, VPS com subcategoria e restantes produtos;
- editor, pré-visualização, página e configuração da compra só com 1 mês, 1 ano e 2 anos;
- cotação, encomenda directa e painel a recusar os três ciclos retirados;
- carrinho antigo com 6 meses e 3 anos (desktop e iPhone);
- renovações de 3 meses, 6 meses e 3 anos;
- KVM 2 guardado com os ciclos elegíveis, item de outro período recusado, ciclo sem item só como não publicado;
- catálogo em baixo: erro de ligação, nada alterado.

`menu-e2e.cjs` cobre:
- os cinco grupos;
- Serviços com os dez links por ordem e a imagem à direita, sem outras entradas;
- Hospedagem com `1fr 1fr 1.4fr 260px`;
- telemóvel com os mesmos dez links e o painel compacto por baixo;
- destinos, encaminhamento 308 e sitemap.

## Publicação

Executar depois do merge e **só com aprovação**. O bloco reinicia **só** `viralizahost`.

```bash
bash -s <<'PUBLICAR'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
DB=viralizahost_viralizaHost
TS=$(date +%F-%H%M)
Q="mysql --defaults-extra-file=$HOME/.vh-my.cnf $DB"
SNAP="SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, payment_status, amount) ORDER BY id)) h FROM orders; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, total, amount_paid) ORDER BY id)) h FROM invoices; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, billing_cycle, renewal_price, next_due_date) ORDER BY id)) h FROM services"

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

echo "== 2. Antes: encomendas, facturas, serviços; ciclos VPS"
$Q -e "$SNAP" | tee "/var/backups/viralizahost-antes-$TS.txt"
$Q -e "SELECT p.slug, pp.cycle, pp.price, pp.active, pp.provider_item_id FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NULL ORDER BY p.slug, pp.months"
$Q -e "SELECT billing_cycle, COUNT(*) n FROM services WHERE service_type = 'vps' GROUP BY 1"

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
grep -q '^VPS_LIVE_PURCHASES=' .env.local && { echo "VPS_LIVE_PURCHASES definido — parar (compras reais por aprovar)"; exit 1; } || true

echo "== 5. Migração 21 (depois da 20, se pendente)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "$SNAP" > "/var/backups/viralizahost-depois-$TS.txt"
diff "/var/backups/viralizahost-antes-$TS.txt" "/var/backups/viralizahost-depois-$TS.txt" && echo "OK: encomendas, facturas e serviços inalterados"
$Q -e "SELECT p.slug, pp.cycle, pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NULL AND pp.active = 1 ORDER BY p.slug, pp.months"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in / /servidor-vps /dominios /email-corporativo /dominios/transferir /dominios/renovar /email/microsoft-365-outlook /infrastructure-world-class.png /sitemap.xml; do curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:
1. Abrir **Catálogo e Preços → VPS**. Os planos devem mostrar só 1 mês, 1 ano e 2 anos. Nos planos em modo automático, cada ciclo publicado deve ter o item da Hostinger do mesmo período.
2. No site, abrir «Hospedagem e site» e «Serviços» em desktop (imagem à direita) e em telemóvel.
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

Para voltar a vender 6 meses e 3 anos depois de reverter o código:

```sql
UPDATE product_prices pp
JOIN products p ON p.id = pp.product_id AND p.category = 'vps' AND p.subcategory IS NULL
SET pp.active = 1
WHERE pp.cycle IN ('6months', '3years');
```
