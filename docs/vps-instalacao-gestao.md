# VPS: duração e instalação na mesma página, aprovisionamento e «Os meus VPS»

Este documento descreve a compra, a configuração e a gestão do Servidor VPS (Hostinger VPS). A referência funcional é o ecrã «Choose what to install» da Hostinger, com o design da ViralizaHost.

## Percurso do cliente

1. **«Comprar agora»** abre `/comprar/<plano>`, a página **«Escolha a duração»**. Mantém os períodos publicados (1 mês, 1 ano, 2 anos), os descontos, o total a pagar agora e o valor de renovação. Na mesma página, antes de «Adicionar ao carrinho», o cliente escolhe:
   - **Localização do servidor**, só quando há mais de uma activa. Com uma só localização, esta é indicada e escolhida automaticamente.
   - **Escolha o que instalar**: pesquisa por nome e três separadores (Sistema operativo, Painel de controlo, Aplicações).
     - Cada cartão mostra o ícone, o nome, a versão e a licença (incluída, ou paga com valor/mês). Com uma licença paga, a página mostra também o custo no período antes de continuar.
     - Um painel ou aplicação que inclui um sistema (ex.: «cPanel · inclui AlmaLinux 9») conta como uma única escolha. O resumo mostra «sistema incluído».
     - Só aparecem as opções compatíveis com o plano (planos permitidos e RAM mínima) e com a localização. Se a localização mudar e a escolha deixar de ser compatível, a escolha é anulada e a página explica porquê.
   - **Escolher mais tarde**: só aparece quando o administrador o permite. O cliente paga e escolhe em «Os meus VPS»; nada é comprado na Hostinger antes dessa escolha. Só estão disponíveis opções com licença incluída.
   - Estados da secção: a carregar (esqueleto), catálogo indisponível (com «Tentar novamente»; a compra fica bloqueada) e pesquisa sem resultados.
2. **Carrinho → checkout → pagamento**: sem alterações ao processo. O carrinho, a revisão, a encomenda (cliente e painel) e a tarefa da equipa mostram a configuração completa. Exemplo: «Localização: Lisboa · Painel: cPanel (inclui AlmaLinux 9) · licença Kz 4500/mês».
3. **Aprovisionamento** (só depois do pagamento confirmado; por transferência, depois de a equipa validar o comprovativo):
   - **Automático**: usa a integração existente, com operação única por serviço, limite de custo, hostname único e conciliação de respostas inconclusivas antes de qualquer nova tentativa.
   - **Manual**: tarefa da equipa com a configuração completa. A equipa usa «Associar VPS…» (VM da Hostinger) ou o novo «Confirmar entrega…» (IP, sem VM da Hostinger).
   - **«Pronto a utilizar»** só quando a VM está `running` **e** não há acções pendentes na Hostinger, com a última acção sem erro (fim da instalação do sistema, painel ou aplicação). Em modo manual, quando a equipa confirma a entrega.
   - Uma instalação com erro passa a «Necessita de intervenção» e fica em revisão. A encomenda e a configuração são preservadas.
4. **Área do Cliente → «Os meus VPS»** (`/vps`, `/vps/<id>`): ver a secção abaixo.

### Estados mostrados ao cliente

| Estado | Quando |
|---|---|
| A aguardar pagamento | encomenda por pagar |
| Pagamento em validação | comprovativo enviado (`proof_submitted`) |
| A preparar o VPS | pago; compra/criação/instalação em curso, ou tarefa manual da equipa |
| Pronto a utilizar | VM activa e instalação concluída (ou entrega confirmada pela equipa) |
| Necessita de intervenção | instalação por escolher («escolher mais tarde»), compra recusada, resultado por confirmar, VM com problema ou instalação falhada |

## Validação no servidor (`quote.ts`)

- A localização e a instalação são validadas contra as opções activas. A compatibilidade com o plano e com a localização também é verificada. Erros possíveis: `options_required`, `options_invalid`, `image_incompatible` e `choose_later_unavailable`.
- **Licença paga**: preço mensal × meses × quantidade, somado ao total da linha e ao valor de renovação (as renovações usam o `renewal_price` aceite).
- O carrinho e a encomenda guardam em `order_items.options` o plano, o ciclo (na linha), a região, a imagem (id, categoria, nome, versão, sistema incluído) e os valores da licença aceites.
- Se o preço mudar antes do pagamento, `createOrder` responde **409 `price_changed`** com o novo total, e o cliente revê e confirma de novo.
- Mantêm-se as regras anteriores:
  - ciclos 1 mês, 1 ano e 2 anos para os planos VPS principais;
  - restrições dos planos de aplicações;
  - o item de preço da Hostinger tem de corresponder exactamente ao período.

## Configuração no painel (Integrações → Hostinger VPS)

- «Testar ligação» (só leitura) actualiza os centros de dados e os templates **sem perder** a configuração do administrador. Os templates novos ficam desactivados.
- Configuração por opção:
  - categoria, nome, versão e sistema incluído;
  - licença (incluída, ou paga com preço mensal em Kz);
  - localizações compatíveis;
  - RAM mínima e planos permitidos;
  - endereço de acesso (`https://{ip}:2087`) e utilizador SSH.
- Uma licença paga sem preço não pode ser activada.
- **Opções manuais** (para activação manual): o que a equipa sabe entregar, sem template da Hostinger. Podem ser removidas; as opções da Hostinger só se desactivam.
- **Permitir «Escolher mais tarde»**.

## «Os meus VPS»

- Lista e detalhe com plano, estado (activação e energia), localização, IP, sistema e painel ou aplicação instalados, próximo vencimento e referência («VH-ORD-… · VM …»).
- **Acesso**: comando `ssh <utilizador>@<ip>` (utilizador configurado; por omissão `root`) e botão «Abrir o painel/aplicação» quando existe endereço.
- **Acesso inicial seguro**:
  - **Palavra-passe root**: aplica as regras da Hostinger (12–50 caracteres, maiúscula, minúscula, número e um símbolo de `-().&@?'#;/,+`). É enviada uma única vez por HTTPS para a API e descartada. Nunca é guardada, registada, mostrada nem enviada por e-mail; a auditoria regista só a operação. Palavras-passe comprometidas são recusadas pela Hostinger, com explicação.
  - **Chaves SSH** (públicas, OpenSSH): adicionar e listar, mostrando só a impressão. Uma chave privada ou inválida é recusada.
- **Energia**: ligar, desligar e reiniciar, só quando o estado actual o permite e não há operação em curso. Antes de cada pedido, o estado é verificado na API. O progresso é acompanhado pelas acções da Hostinger até ao resultado.
- **Reinstalar**: aviso explícito de perda de dados e confirmação separada (caixa de aceitação + escrever `REINSTALAR`, validados também no servidor). Só opções compatíveis: com licença incluída, ou a licença paga já contratada.
- **Pedir suporte**: abre um ticket com a referência do VPS.
- **Posse**: cada consulta e operação verifica `services.profile_id`. O VPS de outro cliente responde **404**, sem revelar que existe.
- **VPS entregues manualmente** (sem VM da Hostinger): mostram detalhes e acesso SSH; a gestão faz-se pelo suporte.

### Funções em falta (documentadas)

- **Consola no navegador**: a API da Hostinger não tem endpoint de consola, só o modo de recuperação, que não está exposto ao cliente. O cliente pede suporte.
- Cópias de segurança, snapshots, firewall, PTR e métricas existem na API mas não fazem parte desta entrega.

## Capacidades da API confirmadas (OpenAPI oficial 3.7.0)

| Necessidade | API | Nota |
|---|---|---|
| Regiões | `GET /api/vps/v1/data-centers` | `id, name, location, city, continent` — **sem** compatibilidade com planos/templates |
| Imagens | `GET /api/vps/v1/templates` | só `id, name, description, documentation` — **sem** categoria, versão, licença, preço ou compatibilidade |
| Compra | `POST /api/vps/v1/virtual-machines` | exige `setup` (template + centro de dados) → «escolher mais tarde» adia a compra; sem idempotência |
| Configurar VM paga | `POST …/{id}/setup` | só no estado `initial` |
| Acções / progresso | `GET …/{id}/actions[/{actionId}]` | `state`: success, error, delayed, sent, created, started, cancelled |
| Energia | `POST …/{id}/start` · `/stop` · `/restart` | devolvem a acção |
| Reinstalar | `POST …/{id}/recreate` | `template_id` (+ password opcional); apaga dados e snapshots |
| Palavra-passe root | `PUT …/{id}/root-password` | 12–50, regras de caracteres; comprometidas recusadas |
| Chaves SSH | `GET/POST/DELETE …/{id}/ssh-keys` | utilizador root; `/api/vps/v1/public-keys` (conta) obsoleto |
| Consola | — | inexistente |

**Limitações que dependem da conta Hostinger (confirmar no hPanel antes de activar compras reais):**

- os templates e as regiões disponíveis para a conta;
- a disponibilidade de cada template por região/plano (a API não expõe esta informação);
- as licenças pagas (cPanel/Plesk) e o seu custo real;
- o método de pagamento da conta.

## Ensaio (sem compras reais)

`scripts/mariadb/rehearsal/vps-install-e2e.cjs` corre contra `mock-hostinger.mjs`, que agora simula:

- templates de painéis e aplicações (cPanel pago, CyberPanel, Plesk, n8n e um template com erro);
- acções, energia, reinstalação, palavra-passe root e chaves SSH.

Com o servidor e os simuladores de ensaio ligados:

```bash
BASE_URL=http://localhost:3000 OUT=/tmp/vps-install node --env-file=.env.local scripts/mariadb/rehearsal/vps-install-e2e.cjs
```

O ensaio cobre:

- o percurso completo: «Comprar agora» → duração e instalação → carrinho → pagamento → aprovisionamento → «Os meus VPS» → acesso;
- um sistema operativo, um painel e uma aplicação;
- uma região incompatível;
- uma licença com custo, com o preço alterado antes do pagamento (409);
- «escolher mais tarde»;
- a activação manual;
- uma resposta inconclusiva sem compra duplicada;
- uma instalação falhada;
- o acesso ao VPS de outro cliente;
- os estados de carregamento e de catálogo indisponível;
- desktop e iPhone.

No fim, o ensaio repõe os planos, a integração e os carrinhos.

Capturas: `docs/capturas/vps-instalacao/`.

## Migração

**Nenhuma.**

- As novas propriedades ficam em JSON já existente: `vps_provider_settings.options` (configuração das instalações) e `order_items.options` (escolhas aceites).
- As linhas antigas (`{id,label,enabled}`) são lidas com valores por omissão: a classificação é deduzida do nome e a licença fica «incluída».
- As encomendas e os VPS existentes não são alterados. Uma encomenda antiga sem opções continua a seguir para tarefa manual, como antes.

## Publicação (para aprovação)

Executar depois do merge e **só com aprovação**. O bloco reinicia **só** `viralizahost`, verifica o commit em `/api/version` e pára se `VPS_LIVE_PURCHASES` estiver definido (compras reais por aprovar). Sem migração nova.

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

echo "== 2. Antes: encomendas, facturas, serviços; integração VPS"
$Q -e "$SNAP" | tee "/var/backups/viralizahost-antes-$TS.txt"
$Q -e "SELECT mode, auto_provision, last_test_ok, JSON_LENGTH(options, '$.images') imagens FROM vps_provider_settings"
$Q -e "SELECT provisioning_status, COUNT(*) n FROM services WHERE service_type = 'vps' GROUP BY 1"

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

echo "== 5. Migrações (nenhuma nova nesta versão; aplica só pendentes anteriores)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "$SNAP" > "/var/backups/viralizahost-depois-$TS.txt"
diff "/var/backups/viralizahost-antes-$TS.txt" "/var/backups/viralizahost-depois-$TS.txt" && echo "OK: encomendas, facturas e serviços inalterados"


echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in / /servidor-vps /comprar/vps-nvme2 /api/catalog/vps-options?plano=vps-nvme2 /sitemap.xml; do curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:

1. Em **Integrações → Hostinger VPS**, usar «Testar ligação».
2. Rever cada template: categoria, licença e preço, localizações, RAM mínima e endereço de acesso. Activar só o que a equipa confirmou na conta.
3. Decidir se permite «Escolher mais tarde».
4. Abrir `/comprar/vps-nvme2` em desktop e em telemóvel e confirmar as opções mostradas.
5. Se tudo estiver bem: `pm2 save`.

**Reversão:** o mesmo procedimento de `docs/vps-ciclos-submenus.md` (repor `/var/backups/viralizahost-prod-<TS>.tgz`, build, `pm2 restart viralizahost`). Não há dados a reverter: as escolhas novas ficam em JSON e são ignoradas pelo código anterior, que trata essas encomendas como tarefa manual.
