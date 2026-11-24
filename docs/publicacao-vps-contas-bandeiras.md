# Especificações VPS, confirmação de e-mail configurável e bandeiras da Presença Global

## 1. Validação das especificações VPS

**Problema.** No plano associado a `hostingercombr-vps-kvm1`, o painel comparava os 4 TB anunciados com «3,90625 TB» e bloqueava a gravação, mesmo em modo Manual.

**Causa.**
- O tráfego do catálogo vem em MB, convertidos pela Hostinger com ×1024 (4 000 GB → 4 096 000 MB).
- O código antigo dividia por 1024 para obter os 4 000 GB e voltava a dividir por 1024 para chegar a TB, o que dá 3,90625.
- A Hostinger chama «4 TB» a 4 000 GB (TB decimal).

O campo e as unidades estão detalhados em `docs/hostinger-vps-api.md`, secção «Unidades das especificações».

**Correcção.**
- **Unidade de origem explícita** (`src/lib/vps/hostinger-specs.ts`): só se assume MB nas chaves com o nome dos campos documentados da VM (`memory`, `disk_space`, `bandwidth`). Uma chave sem unidade conhecida, ou um valor incoerente com MB, fica **«não foi possível validar»**. O valor bruto (chave, valor e unidade) é guardado e mostrado no formulário.
- **Regra única** `compareSpecs` (`src/lib/commerce/vps-shared.ts`), usada pelo painel e pelo servidor:
  - tudo é convertido para GB decimais antes de comparar;
  - unidades do plano: `GB`/`TB` (decimais) e `GiB`/`TiB` (binárias);
  - 4 000 GB = 4 TB.
- **Por modo:**
  - **Automático:** uma divergência real bloqueia a gravação; um valor não validado exige confirmação da equipa.
  - **Manual:** o plano é gravado e a divergência aparece como aviso no formulário e na lista.
- **Limitação.** Este ambiente de ensaio não chega à API real (a rede bloqueia `developers.hostinger.com` e não há token). O valor bruto do KVM 1 foi deduzido do valor que o painel mostrava. Para o confirmar em produção, abrir o plano em Catálogo e Preços → VPS e ver a linha «Valores brutos da Hostinger», que só lê.

## 2. Confirmação de e-mail configurável

**Configurações → Contas** (`/admin/settings/contas`) tem a opção «Exigir confirmação de e-mail para novos clientes».

**Onde fica e quem a altera**
- Está guardada em `account_settings` e é lida em cada pedido, por isso entra em vigor sem reiniciar o servidor.
- Só administradores a podem alterar (`requireAdminRole`, verificado no servidor). Anónimo recebe 401; cliente e revendedor recebem 403.
- Cada alteração fica em `activity_logs` (`entity_type = 'settings'`, `entity_id = 'accounts'`).

**Valor inicial:** o comportamento actual, ou seja, `AUTH_EMAIL_CONFIRMATION != 'false'` (confirmação exigida em produção).

**Activada:** o fluxo de sempre. O link é enviado e a conta só inicia sessão depois de confirmar.

**Desactivada:**
- O cliente conclui o registo e entra logo.
- Não é enviado e-mail de confirmação.
- O endereço fica **por verificar** (`email_confirmed_at` vazio), com a isenção registada na conta (`auth_users.email_verification_exempt = 1`).

**Onde se aplica:** no formulário `/register` e na criação de conta no checkout (`/checkout/conta`).

**Contas existentes**
- Não mudam: a migração cria a isenção a 0 para todas.
- Desactivar não liberta contas que já estavam por confirmar.
- Reactivar só afecta os registos novos: as contas criadas com a opção desactivada continuam a entrar.

**Fluxos que não mudam:** recuperação de palavra-passe, alteração de e-mail, reenvio de verificação. A associação de contas WHM continua a exigir e-mail confirmado.

## 3. Bandeiras na «Presença Global ViralizaHost»

- **Imagens:** bandeiras locais em `public/flags/<iso>.png`, a partir de flag-icons (MIT, licença em `public/flags/LICENSE-flag-icons.txt`), rasterizadas a 96×72. São 23 ficheiros, cerca de 30 KB no total.
  - Substituem os emojis, que no Windows aparecem como letras.
  - Cada localização está associada ao seu código ISO, incluindo GB (Reino Unido) e HK (Hong Kong).
- **Marcadores do mapa:** bandeira + código. O tamanho é calculado em pixels de ecrã e o rótulo fica do lado que evita sobreposições na Europa, no Cone Sul e no Sudeste Asiático. O nome aparece ao passar o rato, do lado oposto.
- **Lista:** bandeira + nome.
- **O que se mantém:** nomes, códigos, as 25 rotas e as interacções.
- **Acessibilidade:** junto de texto, a bandeira é decorativa (`alt=""`, `aria-hidden`). Se a imagem falhar, é retirada e o nome ou código continua legível.
- **Telemóvel:** o mapa ganha uma largura mínima e desloca-se dentro do cartão, sem deslocamento da página. Começa centrado no Atlântico e tem a indicação «Deslize…». Antes, cada marcador ficava com cerca de 4 px.

## Testes (ensaio)

| Conjunto | Resultado |
|---|---|
| `node --test scripts/vps/vps-specs.test.mjs` (novo): KVM 1, 4 000 GB = 4 TB, GiB/TiB, divergência real, «Ilimitado», unidade desconhecida, valor incoerente, VM | 9/9 |
| `vps-purchase-e2e.cjs` (actualizado): KVM 1 em Manual e Automático, divergência real nos dois modos, unidade desconhecida, formulário (aviso ou bloqueio, valores brutos, GiB/TiB) e a compra VPS completa | 142 OK |
| `account-settings-e2e.cjs` (novo): valor inicial, permissões (anónimo, cliente, revendedor), persistência depois de recarregar, auditoria, registo no site e no checkout com a opção desactivada (sem e-mail, por verificar), recuperação de senha, reactivar só para novos registos, contas existentes inalteradas | 25 OK |
| `global-presence-e2e.cjs` (novo), desktop e iPhone: correspondência nome ↔ código ↔ bandeira, imagens carregadas, decorativas, sem sobreposição, texto ≥ 13 px, rotas e interacções, sem deslocamento horizontal, imagens bloqueadas | 32 OK |

## Migração

**Sim:** `database/mariadb/migrations/20261205_19_account_settings.sql`. É idempotente e aplica-se depois da 18.
- cria a tabela `account_settings`, vazia, o que mantém o comportamento actual;
- acrescenta `auth_users.email_verification_exempt TINYINT(1) NOT NULL DEFAULT 0`, a 0 para todas as contas existentes.

A validação VPS e as bandeiras não precisam de migração.

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
SNAP="SELECT COUNT(*) n, SUM(email_confirmed_at IS NULL) por_verificar, MD5(GROUP_CONCAT(CONCAT_WS('|', id, email, email_confirmed_at, banned_until) ORDER BY id)) h FROM auth_users; SELECT COUNT(*) n, MD5(GROUP_CONCAT(CONCAT_WS('|', product_id, cycle, price, active) ORDER BY product_id, cycle)) h FROM product_prices"

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

echo "== 2. Contas e preços (antes)"
$Q -e "$SNAP" | tee "/var/backups/viralizahost-contas-antes-$TS.txt"
grep -E '^AUTH_EMAIL_CONFIRMATION=' "$PROD_DIR/.env.local" || echo "AUTH_EMAIL_CONFIRMATION não definido (confirmação exigida — valor inicial da nova opção)"

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
ls public/flags/*.png | wc -l

echo "== 5. Migrações (18 se pendente, depois 19)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
$Q -e "$SNAP" > "/var/backups/viralizahost-contas-depois-$TS.txt"
diff "/var/backups/viralizahost-contas-antes-$TS.txt" "/var/backups/viralizahost-contas-depois-$TS.txt" && echo "OK: contas e preços inalterados"
$Q -e "SHOW TABLES LIKE 'account_settings'; SELECT COUNT(*) linhas FROM account_settings; SELECT SUM(email_verification_exempt) isentas FROM auth_users"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
for u in / /flags/gb.png /flags/hk.png /register /servidor-vps; do curl -sS -o /dev/null -w "$u %{http_code}\n" "https://viralizahost.com$u"; done
curl -sS -o /dev/null -w "configurações de contas sem sessão %{http_code} (esperado 401)\n" https://viralizahost.com/api/admin/settings/accounts
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:
1. Abrir **Configurações → Contas**. A opção deve aparecer activa, com «Valor inicial». Só deve ser alterada se for essa a decisão.
2. Abrir **Catálogo e Preços → VPS** e, no plano do KVM 1:
   - confirmar a linha «Valores brutos da Hostinger» (`bandwidth = 4 096 000 MB` esperado) e que os 4 TB já não aparecem como divergência;
   - se a chave ou o valor forem outros, o formulário mostra «não foi possível validar»; nesse caso, enviar a linha para revisão.
3. Abrir a página inicial em desktop e telemóvel e ver a secção Presença Global.
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

A tabela e a coluna novas não afectam a versão anterior. Não é preciso desfazer a migração.

**Atenção:** as contas criadas com a confirmação desactivada ficam por verificar. A versão anterior volta a exigir confirmação a essas contas, que podem usar «Reenviar e-mail de verificação».
