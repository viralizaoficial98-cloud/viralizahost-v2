# VPS sem 3 meses, menu principal em cinco grupos e planos de Servidor Dedicado

## 1. VPS: ciclo de 3 meses retirado

**Onde deixa de existir.** Para novas aquisições de VPS (página /servidor-vps), o ciclo de 3 meses desaparece de:
- o editor administrativo e a pré-visualização;
- a página pública;
- a configuração da compra (`/comprar/<plano>`, mesmo com `?ciclo=3months`);
- o carrinho e o checkout.

**Servidor.**
- A cotação devolve `cycle_retired` («Este período deixou de estar disponível para novos VPS. Escolha outro período para este item.») e só lista os ciclos à venda.
- Um pedido directo de encomenda com 3 meses é recusado.
- O painel recusa gravar o ciclo.

**Carrinhos antigos.**
- O item VPS de 3 meses fica assinalado e o selector mostra «— escolha outro período —».
- Os restantes itens mantêm-se.
- «Finalizar» só fica disponível depois de escolher outro período.

**O que se preserva.**
- Encomendas, facturas e serviços já contratados a 3 meses não mudam.
- As renovações continuam a funcionar: usam o preço aceite no serviço (`services.renewal_price`), não o catálogo.
- A migração 20 só desactiva o preço de venda (`active = 0`); a linha fica guardada.
- Os VPS com subcategoria (n8n, Evolution API, Viraliza AI Cloud, OpenClaw) não são afectados.

### Ciclos sem item de preço da Hostinger (KVM 2: 6 meses e 3 anos)

**No editor.** Cada ciclo mostra os dados que faltam para a activação automática, por exemplo: «sem item de 6 mês(es) no catálogo da Hostinger, custo, moeda, limite».
- O ciclo pode ser guardado como não publicado.
- Em modo Automático, a caixa «Publicado» fica bloqueada até haver item do mesmo período, custo esperado, moeda e limite de custo.
- Em modo Manual o ciclo pode ser publicado, porque a equipa trata da aquisição.

**No servidor.** O item de cada ciclo é confirmado no catálogo da Hostinger: tem de pertencer ao produto associado e ter **o mesmo período**.
- Um item de 12 meses no ciclo de 6 meses é recusado, mesmo que o ciclo não esteja publicado. Um item inexistente também é recusado.
- Se o catálogo não responder, a publicação automática desse ciclo fica bloqueada.

## 2. Menu principal

O desktop e o telemóvel usam a mesma configuração (`src/lib/site/navigation.ts`). O menu tem exactamente estes cinco grupos:

1. **Hospedagem e site**
   - Hospedagem: Hospedagem de Sites, Revenda.
   - Criação de sites: Criador com IA, Construtor WordPress.
   - Infraestrutura: só Servidor VPS, Servidor Dedicado Linux e Servidor Dedicado Windows.
2. **Domínios**: link directo para /dominios.
3. **E-mail corporativo**: link directo para /email-corporativo.
4. **Serviços**: todas as páginas públicas de serviço, por categoria (Hospedagem e sites, Servidores, Domínios, E-mail corporativo, Segurança e desempenho).
   - A fonte é o registo de páginas publicadas (`src/lib/site/pages.ts`), que também gera o sitemap: uma página retirada do registo sai do menu e do sitemap ao mesmo tempo.
   - No telemóvel, cada categoria abre-se à parte.
5. **Empresa**: Sobre nós, Suporte, Parceria e Blog.

**Comportamento.**
- O painel abre ao passar o rato ou com clique, e fecha com Escape ou com um clique fora.
- No telemóvel, enquanto o menu está aberto, os botões flutuantes (chat e WhatsApp) ficam escondidos.

### Páginas consolidadas

| Antes (no menu) | Agora |
|---|---|
| Hospedagem WordPress (`/hospedagem-wordpress`) | Secção **/hospedagem-de-sites#wordpress**, com o conteúdo, as características e os planos WordPress (compra inalterada) e um link interno junto aos planos. O URL antigo encaminha com **308**. |
| VPS n8n, OpenClaw, Evolution API, Viraliza AI Cloud (Infraestrutura) | Secção **/servidor-vps#aplicacoes** («Aplicações pré-configuradas»). As páginas mantêm-se porque têm planos próprios. |
| Opções dos dedicados | **/servidor-dedicado#compatibilidade** (Linux: distribuições, cPanel/WHM, Docker, automação, bases de dados) e **/servidor-dedicado-windows#compatibilidade** (Windows Server, Plesk, ASP.NET/IIS, MS SQL, RDP), com ligações cruzadas. |
| Submenu Domínios | **/dominios**: atalhos (Pesquisar e registar, Transferir, Renovar, Gestão, Preços) e as secções **#registo**, **#gestao** e **#recursos**, com ligações para os fluxos. Pesquisa, extensões e preços mantêm-se. |
| Submenu E-mail | **/email-corporativo**: planos, períodos e compra mantidos, mais **#planos-detalhe** (Starter, Standard, Premium e Microsoft 365), **#seguranca** e **#produtividade**. |
| — | **/sobre** (nova): Sobre nós, com a equipa, a presença global e os contactos reais. |
| Blog | **/blog**: estado vazio claro («Ainda não há artigos publicados») e ligações para a base de conhecimento e o suporte. |

### URLs alterados ou encaminhados

| URL | Estado |
|---|---|
| `/hospedagem-wordpress` | **308 → /hospedagem-de-sites#wordpress** (página removida, conteúdo integrado) |
| `/sobre` | **novo** |
| `/servicos` | mantido; agora lista todos os serviços por categoria (mesma fonte do menu) |
| `/dominios/*`, `/email/*`, `/servidor-vps/*`, `/servidor-dedicado*`, `/certificado-ssl`, `/backup-cloud`, `/protecao-de-site`, `/cdn-premium`, `/migracao-gratis`, `/parcerias`, `/blog`, `/suporte/*` | mantidos (função própria), ligados a partir das secções e do grupo Serviços |
| Rodapé: «Sobre a ViralizaHost» | passa de `/servicos` para `/sobre` |
| Rodapé: «Hospedagem WordPress» | passa para `/hospedagem-de-sites#wordpress` |
| Sitemap | sai `/hospedagem-wordpress` (encaminhado) e saem `/email/starter`, `/email/business` e `/email/enterprise`, que já eram encaminhamentos para `/comprar/email-*` (entradas erradas antigas); entra `/sobre`. As 58 entradas respondem 200. |

## 3. Servidores Dedicados Linux e Windows

**Catálogo e Preços.** Tem os separadores «Dedicado Linux» e «Dedicado Windows», cada um com o seu editor: criar, editar, ordenar, publicar e despublicar.

**Ficha do plano.**
- Nome, descrição, imagem, etiqueta e destaque.
- Processador, núcleos e threads, RAM e tipo de RAM.
- Grupos de discos (quantidade × capacidade e tipo NVMe/SSD/HDD) e RAID.
- Tráfego (limite ou ilimitado), velocidade de rede, sistema operativo e licença.
- Características adicionais reordenáveis, com ícones da lista controlada.

**Preços.** Preço base em Kz, desconto por período (1, 3 e 6 meses; 1, 2 e 3 anos), renovação e pré-visualização da faixa antes de publicar.

**Validação no servidor (só administradores).**
- Threads ≥ núcleos.
- RAID, armazenamento e ícones têm de vir das listas permitidas.
- Licença Windows num plano Linux é recusada.
- Publicar exige pelo menos um período.

**Páginas.** /servidor-dedicado e /servidor-dedicado-windows usam a faixa da página Servidor VPS: imagem à esquerda, especificações com ícones ao centro, preço e «Comprar agora» à direita. No telemóvel, os elementos ficam empilhados.
- Só aparecem os planos e os períodos publicados.
- Os planos «sob consulta» continuam visíveis na mesma faixa, sem preço, com «Pedir proposta». Esse botão leva ao fluxo de cotação existente em `/comprar/<plano>`.

**Compra.**
- «Comprar agora» abre `/comprar/<plano>?ciclo=…`, o fluxo existente: plano e período, carrinho e checkout, com o período e o total.
- O preço aplicado é o do catálogo (total adulterado → 409; período não publicado → recusado).

**Activação.** Depois do pagamento validado, a activação é **manual** (`provisioning = 'manual'`, «Activação manual (dedicated)»). Nunca há compra de VPS na Hostinger: o servidor repõe `service_type = 'dedicated'` e `provisioning = 'manual'` ao gravar.

**Migração.** Não é precisa para os dedicados: as colunas já existem desde a migração 18. Os planos, preços e encomendas actuais mantêm-se.

## Migração

**Sim:** `20261206_20_vps_retire_3months.sql`. É idempotente e aplica-se depois da 19.
- Só desactiva o preço de 3 meses dos planos VPS sem subcategoria (`active = 0`); as linhas ficam guardadas.
- Não toca em encomendas, facturas nem serviços.

## Testes (ensaio, pagamentos e Hostinger simulados)

| Conjunto | Resultado |
|---|---|
| `vps-cycles-e2e.cjs` (novo) | 40 OK |
| `dedicated-plans-e2e.cjs` (novo) | 54 OK |
| `menu-e2e.cjs` (novo) | 38 OK |
| `purchase-flows-e2e.cjs` (adaptado ao novo menu; inclui o pedido de proposta de um dedicado «sob consulta») | 116 OK |

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
SNAP="SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, payment_status, amount) ORDER BY id)) h FROM orders; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, total, amount_paid) ORDER BY id)) h FROM invoices; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, billing_cycle, renewal_price, next_due_date) ORDER BY id)) h FROM services; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', pp.product_id, pp.cycle, pp.price, pp.renewal_price) ORDER BY pp.product_id, pp.cycle)) h FROM product_prices pp"

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

echo "== 2. Encomendas, facturas, serviços e preços (antes)"
$Q -e "$SNAP" | tee "/var/backups/viralizahost-antes-$TS.txt"
$Q -e "SELECT p.slug, pp.cycle, pp.price, pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NULL AND pp.cycle = '3months'"
$Q -e "SELECT COUNT(*) servicos_3_meses FROM services WHERE service_type = 'vps' AND billing_cycle = '3months'"

echo "== 3. Backup da base e da pasta de produção"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
chmod 600 "/var/backups/viralizahost-base-$TS.sql.gz" "/var/backups/viralizahost-prod-$TS.tgz"
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"

echo "== 4. Código (preserva .env.local, node_modules e ficheiros carregados; remove ficheiros apagados, ex.: hospedagem-wordpress)"
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
git -C "$GIT_DIR" diff --name-only --diff-filter=D "$DEPLOYED" "$COMMIT" | while read -r f; do rm -f -- "$PROD_DIR/$f" && echo "removido: $f"; done
rmdir "$PROD_DIR/src/app/hospedagem-wordpress" 2>/dev/null || true
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"
cd "$PROD_DIR"
if ! git -C "$GIT_DIR" diff --quiet "$DEPLOYED" "$COMMIT" -- package.json package-lock.json; then npm ci; fi
grep -q '^VPS_LIVE_PURCHASES=' .env.local && { echo "VPS_LIVE_PURCHASES definido — parar (compras reais por aprovar)"; exit 1; } || true

echo "== 5. Migração 20 (depois da 19, se pendente)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, payment_status, amount) ORDER BY id)) h FROM orders; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, total, amount_paid) ORDER BY id)) h FROM invoices; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', id, status, billing_cycle, renewal_price, next_due_date) ORDER BY id)) h FROM services" > "/var/backups/viralizahost-depois-$TS.txt"
head -6 "/var/backups/viralizahost-antes-$TS.txt" | diff - "/var/backups/viralizahost-depois-$TS.txt" && echo "OK: encomendas, facturas e serviços inalterados"
$Q -e "SELECT p.slug, pp.cycle, pp.price, pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category = 'vps' AND p.subcategory IS NULL AND pp.cycle = '3months'"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in / /sobre /blog /dominios /email-corporativo /servidor-vps /servidor-dedicado /servidor-dedicado-windows /hospedagem-de-sites /servicos /sitemap.xml; do curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
curl -sS -o /dev/null -w "/hospedagem-wordpress %{http_code} → %{redirect_url} (esperado 308 → /hospedagem-de-sites#wordpress)\n" https://viralizahost.com/hospedagem-wordpress
curl -sS -o /dev/null -w "dedicados no painel sem sessão %{http_code} (esperado 401)\n" "https://viralizahost.com/api/admin/catalog/dedicated-plans?kind=linux"
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:
1. **Catálogo e Preços → VPS:** confirmar que nenhum plano mostra 3 meses. No KVM 2, os ciclos sem item de preço da Hostinger aparecem como não publicados, com os dados em falta.
2. **Catálogo e Preços → Dedicado Linux / Dedicado Windows:** os planos actuais continuam «Sob consulta», com «Pedir proposta» na página. Para os vender online, preencher a ficha, o preço base e os períodos, e publicar.
3. **Site:** abrir o menu em desktop e telemóvel, e as páginas Sobre nós e Blog.
4. Se tudo estiver bem: `pm2 save`.

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

Para voltar a vender VPS a 3 meses depois de reverter o código:

```sql
UPDATE product_prices pp
JOIN products p ON p.id = pp.product_id AND p.category = 'vps' AND p.subcategory IS NULL
SET pp.active = 1
WHERE pp.cycle = '3months';
```
