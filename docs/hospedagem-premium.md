# Hospedagem Premium: períodos, descontos e fichas de plano

Âmbito: só os planos da categoria `hosting`, que aparecem em `/hospedagem-de-sites` e na secção «Hospedagem Premium» da página inicial. WordPress, Criador de Sites, Revenda e E-mail não mudam.

## O que o administrador gere

O editor está em **Administração → Catálogo e Preços → Hospedagem** (`/admin/site/catalog?cat=hosting`), no bloco «Planos de Hospedagem Premium».

**Botões «Novo plano» e «editar plano»:**
- nome, descrição curta, perfil de utilização, estado, ordem, etiqueta opcional («Mais popular») e destaque visual (cartão escuro);
- número de sites, armazenamento em GB e tipo de disco (SSD ou NVMe);
- tráfego mensal, com valor e unidade (GB ou TB) ou «Ilimitado»;
- caixas de e-mail e limite de envio por hora;
- memória RAM e limite de ficheiros (inodes).
- Os limites de sites, caixas de e-mail, tráfego e inodes têm três modos: «Não indicar», «Limite» ou «Ilimitado». O servidor recusa que se indique um valor e «Ilimitado» ao mesmo tempo. Os campos vazios não aparecem no cartão.
- **Grupos de características:** por exemplo, «Recursos Premium» com SSL, backups, construtor de sites ou SSH.
  - Os grupos e as características dentro deles podem ser acrescentados, editados, removidos e reordenados com ↑/↓.
  - Uma característica desmarcada aparece riscada, como já acontecia.
- **Preço mensal base (Kz) e desconto por período:** 1 mês, 1 ano, 2 anos e 3 anos.
  - O desconto é um inteiro entre 0 e 90.
  - A tabela mostra o total, o equivalente mensal, o preço actual («→ muda» quando o total vai mudar) e a renovação.
  - A pré-visualização do cartão usa o mesmo componente da página pública.
  - Nada é gravado antes de carregar em «Guardar plano».
- **«Publicado»:** só os períodos marcados aparecem no site. Um período que ainda não existe aparece como «por configurar» e só pode ser publicado depois de ter um desconto definido (pode ser 0), com o total revisto na tabela.
- **Preços personalizados:** um preço guardado que não corresponda exactamente à regra (por exemplo, um preço anual negociado) aparece como «Preço personalizado mantido (≈X%)».
  - Esse preço não muda quando se guardam outras alterações do plano.
  - Só muda quando o administrador carrega em «Aplicar regra» e guarda; antes disso, vê o novo total.
- **Renovação:** segue a regra actual.
  - Mantém-se o valor guardado de cada período, que pode ser editado.
  - Um período novo renova pelo preço base × meses, sem desconto.
- **Outros ciclos** (trimestral e semestral) mantêm-se como estão e continuam editáveis na linha do produto. Nessa linha, os 4 períodos públicos ficam bloqueados (o servidor responde 400).

### Pacote WHM

- A associação entre plano e pacote WHM/cPanel (`products.whm_package`) **não é alterada pelo editor**. Continua a definir-se na linha do produto ou em Integrações → WHM/cPanel.
- O editor mostra o pacote e os limites que ele aplica, lidos do WHM só para consulta (`listpkgs`). Avisa quando a ficha difere desses limites, por exemplo «Armazenamento 100 GB ≠ pacote (50 GB)».
- **Etiqueta «PACOTE WHM»:** sites (domínios adicionais + 1), armazenamento, tráfego e caixas de e-mail. São os limites reais aplicados pelo pacote; mantenha a ficha igual.
- **Etiqueta «DESCRITIVO»:** perfil, tipo de disco, limite de envio, RAM e inodes. Só descrevem o plano no cartão e não configuram o servidor.

## Regra de preço

Está definida em `src/lib/commerce/period-pricing.ts` (`exactPeriodTotal`) e é aplicada pelo servidor ao gravar, seguindo a regra monetária do projecto (cêntimos, 2 casas):

```
total do período   = arredondar ao cêntimo( base × meses × (100 − desconto) / 100 )
equivalente mensal = total ÷ meses
```

Exemplo: 4 200 × 36 × 0,38 dá Kz 57 456, ou seja, Kz 1 596/mês.

**Onde o total é usado:**
- Fica gravado em `product_prices.price`, a fonte única.
- O cartão, a configuração (`/comprar`), o carrinho, o checkout e a encomenda usam esse valor. O servidor recalcula-o em `quoteCart`.

**Desconto mostrado:** é calculado a partir dos dados guardados, como `arredondar(100 × (1 − total ÷ (base × meses)))`.
- No cartão aparece como «Poupe X%» e com o preço base riscado.
- No carrinho e no checkout aparece como «Desconto X% (−Kz …)».
- **Selector:**
  - «Poupe X%» quando todos os planos disponíveis nesse período têm o mesmo desconto;
  - «Até X%» quando os descontos são diferentes;
  - sem etiqueta quando o desconto é 0.

**Preço alterado com o plano no carrinho:** ao confirmar, o servidor responde 409 «o total foi actualizado». O cliente vê o novo total e confirma de novo.

**Encomendas, facturas e subscrições** existentes guardam os seus próprios valores e não mudam.

## Página pública e página inicial

As duas usam o componente `HostingPlansSection`, com os mesmos dados e os mesmos cálculos.

**Cada cartão mostra:**
- o equivalente mensal;
- o total do período, por exemplo «57 456,00 Kz pagos por 36 meses»;
- a renovação, quando está definida;
- a ficha técnica e os grupos de características.

O botão **«Configurar»** abre `/comprar/<plano>?ciclo=<período>`, que segue o fluxo actual: domínio, duração, carrinho e checkout.

## Migração

Ficheiro: `database/mariadb/migrations/20261201_15_hosting_plans.sql`.

**Ordem:**
1. `20261130_14_email_plans.sql` (PR #42), que cria `base_monthly_price` e `discount_pct`.
2. `20261201_15_hosting_plans.sql`.

O `migrate-schema.mjs` aplica-as por ordem alfabética, por isso basta corrê-lo uma vez. Se a 14 ainda não estiver em produção, corre primeiro a 14 e depois a 15.

**O que faz:**
- Acrescenta as colunas `products.plan_specs` (JSON validado) e `product_features.group_name`. Começam vazias, por isso os cartões mostram as mesmas características de antes.
- Só nos planos `hosting` ainda sem preço base:
  - preço base = preço mensal guardado;
  - desconto de cada um dos 4 períodos = desconto implícito nos preços guardados (por exemplo, um anual a 88% do mensal × 12 dá 12%).

**O que preserva:**
- **Preços e ciclos:** nenhum preço, ciclo ou estado de ciclo é alterado. Um preço que não corresponda a um desconto inteiro fica como «personalizado» no editor.
- **Pacotes e registos:** pacotes WHM, encomendas, facturas e serviços não são tocados.
- **Outras categorias:** não são tocadas.

## Testes (ensaio)

O teste é `scripts/mariadb/rehearsal/hosting-plans-e2e.cjs`, incluído em `run-all.sh`. Usa o WHM simulado, transferências sem cobrança e repõe o catálogo no fim.

## Publicação

Executar depois do merge na `main` e só com aprovação. Reinicia **só** `viralizahost`.

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

echo "== 2. Preços e pacotes actuais (antes)"
$Q -e "SELECT p.category, p.slug, p.whm_package, pp.cycle, pp.price, pp.renewal_price, pp.active FROM products p JOIN product_prices pp ON pp.product_id = p.id ORDER BY p.slug, pp.months" > "/var/backups/viralizahost-precos-antes-$TS.txt"
wc -l "/var/backups/viralizahost-precos-antes-$TS.txt"

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

echo "== 5. Migrações (14 se pendente, depois 15) — não alteram preços"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "SELECT p.category, p.slug, p.whm_package, pp.cycle, pp.price, pp.renewal_price, pp.active FROM products p JOIN product_prices pp ON pp.product_id = p.id ORDER BY p.slug, pp.months" > "/var/backups/viralizahost-precos-depois-$TS.txt"
diff "/var/backups/viralizahost-precos-antes-$TS.txt" "/var/backups/viralizahost-precos-depois-$TS.txt" && echo "OK: preços, ciclos e pacotes WHM inalterados"
$Q -e "SELECT p.slug, p.base_monthly_price, pp.cycle, pp.price, pp.discount_pct FROM products p JOIN product_prices pp ON pp.product_id = p.id WHERE p.category = 'hosting' AND pp.cycle IN ('monthly','1year','2years','3years') ORDER BY p.position, pp.months"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -fsS 'https://viralizahost.com/api/products?category=hosting' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const p of JSON.parse(s).data){const r=(p.product_prices||[]).filter(x=>+x.active&&["monthly","1year","2years","3years"].includes(x.cycle));console.log(p.slug, r.map(x=>`${x.cycle}=${x.price} (-${x.discount_pct}%)`).join(" "))}})'
curl -sS -o /dev/null -w "planos de hospedagem sem sessão %{http_code} (esperado 401)\n" https://viralizahost.com/api/admin/catalog/hosting-plans
curl -sS -o /dev/null -w "/hospedagem-de-sites %{http_code}\n" https://viralizahost.com/hospedagem-de-sites
pm2 ls
PUBLICAR
```

**Reversão:**
1. Repor `/var/backups/viralizahost-prod-<TS>.tgz`, compilar e reiniciar `viralizahost`.
2. As colunas novas são ignoradas pela versão anterior. Os preços continuam em `product_prices`, como antes.
3. Se for preciso, a base completa está em `/var/backups/viralizahost-base-<TS>.sql.gz`.
