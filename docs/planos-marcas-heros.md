# Planos editáveis (Revenda, Criador de Sites, Construtor WordPress), «Nossas Marcas» e heros de Empresa

## 1. Planos editáveis em «Catálogo e Preços»

As páginas `/revenda-de-hospedagem`, `/criador-de-sites` e `/construtor-wordpress` mostram os planos do catálogo. Cada família tem o seu editor em **Catálogo e Preços → Hospedagem**:

| Família | Catálogo | Página |
|---|---|---|
| Revenda de Hospedagem | `category = 'reseller'` | `/revenda-de-hospedagem` |
| Criador de Sites com IA | `category = 'website-builder'` | `/criador-de-sites` |
| Construtor WordPress | `category = 'wordpress'`, `subcategory = 'builder'` | `/construtor-wordpress` |

A Hospedagem WordPress (`wordpress` sem subcategoria) não faz parte destas famílias.

### O que se edita em cada plano

- Nome, descrição curta e características. As características são ordenáveis (↑/↓) e têm ícone da lista controlada já usada nos VPS e dedicados.
- Etiqueta opcional («Mais popular»), destaque (cartão escuro), ordem e estado (À venda, Sob consulta ou Rascunho).
- Preço mensal base em Kz e desconto por período, incluindo 0%. A regra é a mesma da Hospedagem: total = base × meses × (1 − desconto/100), arredondado ao cêntimo.
- Publicação por período e preço de renovação. Num período novo, a renovação é o preço sem desconto, como na Hospedagem.
- Pré-visualização do cartão, do total a pagar no período e do equivalente mensal, antes de gravar.

### Regra dos períodos

**Novas contratações só em 1 mês, 1 ano, 2 anos e 3 anos.** A regra aplica-se em todos os pontos:

| Onde | Comportamento |
|---|---|
| Editor | Só estes 4 períodos. O servidor recusa outros períodos com 400. |
| Página pública | O selector e os cartões só mostram estes períodos. |
| Configuração da compra (`/comprar/...`) | `getPurchasePlan` só devolve estes períodos. |
| Carrinho e checkout | A cotação (`quote.ts`) devolve o erro `cycle_retired_plan` para qualquer outro ciclo. Um carrinho antigo com 3 ou 6 meses mostra «— escolha outro período —», bloqueia «Finalizar» até à escolha e mantém os restantes itens. Uma encomenda directa responde 409 `cart_invalid`. |
| «A partir de» das heros | Calculado só com estes 4 períodos. |

### O que se preserva

- **Preços**: os planos, preços e descontos existentes não mudam. Um preço guardado que não segue a regra («personalizado») é mantido até o administrador escolher «Aplicar regra».
- **Preço base**: se ainda não estiver guardado, o editor propõe o preço de 1 mês (todos os preços actuais seguem a regra com 0%). Só fica guardado quando o administrador grava o plano.
- **Ciclos retirados**: os preços de 3 e 6 meses ficam guardados e o editor mostra-os como retirados. Os contratos, facturas e renovações de ciclos antigos continuam a funcionar, porque a renovação usa o preço aceite no serviço.
- **Activação**: o editor não altera `service_type`, `provisioning` nem `whm_package` de um produto existente. Um plano novo herda o modo de activação dos planos existentes da sua família.
- **Sob consulta**: os planos de Revenda continuam com «Pedir proposta» e o formulário de cotação.

### Apresentação

- O preço do cartão, da configuração, do carrinho e do checkout é o mesmo valor guardado em `product_prices`. A cotação do servidor faz o mesmo cálculo.
- O preço riscado e «Poupe X%» só aparecem quando há desconto face ao preço base. O cartão mostra «A pagar agora» e «Renova por … a cada …».

## 2. «Nossas Marcas» no submenu Empresa

- Grupo novo com **Viralizastudio** e **Automação com IA**, só como texto: sem links, botões nem `href="#"`, e com o cursor normal.
- Mantêm-se os links da Empresa e o cartão de imagem «Fale com um especialista».
- No telemóvel, aparece depois dos links da Empresa e antes do cartão.

## 3. Hero do painel em Sobre nós, Parceria e Suporte

- Caminhos do submenu Empresa (confirmados em `src/lib/site/pages.ts`): `/sobre`, `/parcerias` e `/suporte`.
- Cada página usa o `BannerHero` com a sua entrada em «Banners de páginas» (`sobre`, `parcerias`, `suporte`). O comportamento responsivo é o da hospedagem e cada página tem um único H1.
- **Migração 22** (`20261208_22_banner_pages_empresa.sql`): não existiam entradas para estas páginas. A migração cria-as com os textos e botões que as páginas já mostravam e não altera entradas existentes. A semente `banner-pages.sql` também as inclui.
- **Botões**: um texto de botão vazio no painel significa «sem botão». Sobre nós não tinha botões e continua sem eles. Parceria mantém «Tornar-me Parceiro» e «Falar com Suporte»; Suporte mantém «Abrir Ticket» e «Base de Conhecimento».
- O conteúdo abaixo da hero, as âncoras e os formulários não mudam. O Blog fica para uma alteração separada.
- **Diferença visual**: os títulos antigos tinham uma palavra a amarelo; a hero do painel mostra o título num só tom, como nas outras páginas.

## Ensaio

```bash
BASE_URL=http://localhost:3000 OUT=/tmp/family node --env-file=.env.local scripts/mariadb/rehearsal/family-plans-e2e.cjs
```

O ensaio, que dá 139 OK em desktop e iPhone, verifica:

- **Criação no painel**: cria pela interface um plano em cada família, com características reordenadas, etiqueta, destaque e descontos de 0, 10, 20 e 30%. Confirma a pré-visualização e os preços calculados no servidor.
- **Páginas públicas**: só os 4 períodos, a descrição, as características pela ordem, a etiqueta, «Poupe» apenas com desconto, e o total e a renovação.
- **Compra**: do cartão à configuração, ao carrinho e ao checkout, o mesmo total que a cotação do servidor.
- **Ciclos retirados**: 6 e 3 meses recusados por pedido directo (cotação e encomenda), carrinho antigo corrigível, e a configuração da compra não os oferece.
- **Contratos antigos**: as renovações de 3 e 6 meses continuam possíveis.
- **Revenda sob consulta**: «Pedir proposta» abre o formulário.
- **«Nossas Marcas»**: só texto, em desktop e telemóvel.
- **Heros**: a descrição e a imagem de Sobre nós alteradas no painel só mudam `/sobre`, e a descrição de Suporte só muda `/suporte`. Confirma o H1 único, os botões, o conteúdo abaixo e a imagem à direita ou atenuada.
- **Reposição**: no fim, verifica que os planos, preços e modo de activação existentes estão iguais.

Capturas: `docs/capturas/planos-marcas-heros/`.

## Publicação (para aprovação)

**Migração 22** (só insere entradas em `banner_pages`; idempotente). O bloco reinicia **só** `viralizahost`, confirma o commit em `/api/version` e verifica que os preços dos planos não mudam.

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

echo "== 2. Antes: encomendas, facturas, serviços; preços dos planos (revenda, criador, construtor); banners"
$Q -e "$SNAP" | tee "/var/backups/viralizahost-antes-$TS.txt"
$Q -e "SELECT p.slug, pp.cycle, pp.price, pp.discount_pct, pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category IN ('reseller','website-builder') OR (p.category = 'wordpress' AND p.subcategory = 'builder') ORDER BY p.slug, pp.months" | tee "/var/backups/viralizahost-planos-antes-$TS.txt"
$Q -e "SELECT page_slug, title FROM banner_pages WHERE page_slug IN ('sobre','parcerias','suporte')"

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

echo "== 5. Migração 22 (entradas de banners Sobre nós, Parceria e Suporte; só insere se não existirem)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "$SNAP" > "/var/backups/viralizahost-depois-$TS.txt"
diff "/var/backups/viralizahost-antes-$TS.txt" "/var/backups/viralizahost-depois-$TS.txt" && echo "OK: encomendas, facturas e serviços inalterados"
$Q -e "SELECT p.slug, pp.cycle, pp.price, pp.discount_pct, pp.active FROM product_prices pp JOIN products p ON p.id = pp.product_id WHERE p.category IN ('reseller','website-builder') OR (p.category = 'wordpress' AND p.subcategory = 'builder') ORDER BY p.slug, pp.months" > "/var/backups/viralizahost-planos-depois-$TS.txt"
diff "/var/backups/viralizahost-planos-antes-$TS.txt" "/var/backups/viralizahost-planos-depois-$TS.txt" && echo "OK: preços dos planos inalterados"
$Q -e "SELECT page_slug, title FROM banner_pages WHERE page_slug IN ('sobre','parcerias','suporte')"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in / /revenda-de-hospedagem /criador-de-sites /construtor-wordpress /sobre /parcerias /suporte /sitemap.xml; do curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
pm2 ls
PUBLICAR
```

Depois, em **Catálogo e Preços → Hospedagem**:

1. Rever cada plano das três famílias (características, etiqueta, desconto por período) e gravar. O preço base passa a ficar guardado.
2. Em «Banners de páginas», carregar as imagens de Sobre nós, Parceria e Suporte.
3. Se tudo estiver bem: `pm2 save`.

## Correcção: características e descrições dos planos

### Causa encontrada

Reproduzida em ensaio com um plano existente (Reseller Growth):

1. **Interface e perda silenciosa.**
   - Na linha de cada característica, a lista de ícones mostrava rótulos como «Painel de controlo», «IP / rede» ou «Suporte», que parecem características. O campo de texto ao lado não tinha rótulo visível.
   - Escolher só o ícone e gravar mostrava «Guardado». O servidor, porém, descartava sem aviso as linhas sem texto.
   - O formulário continuava a mostrar as linhas não gravadas, por isso o cartão público ficava sem lista.
2. **Formulário depois de gravar.** O formulário não voltava a ler o que tinha ficado gravado.
3. **Dados antigos.** O editor antigo de produtos guarda características sem ícone e permite marcá-las como não incluídas (`included = 0`). O carregamento só lia as incluídas, e a gravação seguinte apagava as restantes.
4. **API.** Um pedido de gravação sem `features` (só preços) apagava todas as características.

### Correcção

- **Editor**:
  - cada linha tem os campos com rótulo «Ícone» (inicial: «Visto») e «Texto da característica» (texto livre), e a caixa «Incluída»;
  - mantém-se acrescentar, subir, descer e apagar linhas;
  - uma linha sem texto impede a gravação e indica o número da linha a corrigir;
  - depois de gravar, o formulário mostra os valores lidos do catálogo.
- **Servidor** (`family-plans.ts`):
  - grava texto, ícone, ordem e «incluída»;
  - recusa linhas sem texto (400, com a linha indicada);
  - sem `features` no pedido, mantém as características gravadas;
  - texto simples: só retira caracteres de controlo, e o site mostra-o como texto, nunca como HTML.
- **Leitura de formatos antigos** (`readFeature`):
  - texto simples sem ícone e com posição a partir de 0 (editor antigo);
  - linhas não incluídas;
  - texto guardado em JSON (`{"text": …, "icon": …}`).
  - Uma linha só com ícone fica sem texto: o painel assinala-a e o site não a mostra.
- **Cartão público**:
  - descrição curta abaixo do nome;
  - lista com ícones pela ordem do painel, com as não incluídas riscadas;
  - lista também nos planos «Sob consulta», com «Pedir proposta».
- As páginas são dinâmicas, por isso os dados novos aparecem logo depois de gravar, sem novo deploy.

**Sem migração.** Preços, ciclos e fluxos de compra não mudam.

Ensaio: `scripts/mariadb/rehearsal/family-features-e2e.cjs`. Capturas: `docs/capturas/planos-caracteristicas/`.
