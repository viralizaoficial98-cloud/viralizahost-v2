# Catálogo de domínios e cartões da página inicial

## O que o administrador gere

**Administração → Catálogo e Preços → Domínios** (`/admin/site/catalog?cat=dominios`). A antiga página `/admin/site/domains` passa a abrir aqui.

- **Extensões:** acrescentar com «Acrescentar extensão» e editar. Aceita extensões compostas como `.co.ao` e normaliza a escrita («CO.AO» → `.co.ao`). Recusa duplicados e extensões inválidas; a extensão final só pode ter letras (ou `xn--`), a mesma regra dos domínios aceites na pesquisa e no carrinho.
- **Preços (Kz, 1 ano):** registo do 1.º ano, renovação e transferência. Os registos de 2–3 anos são o registo mais as renovações.
- **Estado:** «À venda», «Sob consulta» ou «Retirada da venda».
  - O estado controla o registo e a transferência.
  - A renovação mantém-se activa sempre que tem preço, para os clientes que já têm o domínio.
- **Cartão na página inicial:** só aparece se a extensão estiver à venda. A ordem dos cartões muda-se com ↑/↓ e «Guardar ordem». Uma extensão à venda fora do destaque continua no catálogo completo e na pesquisa.
- **Etiqueta:** opcional, «Popular», «Promoção», «Novo» ou texto personalizado (2–20 caracteres, sem HTML). Pode ser removida.
- **Destaque visual:** independente da etiqueta (borda e botão amarelos).

## Fonte única dos preços

- **Preços:** só em `domain_prices`. Os cartões, a pesquisa, a configuração do domínio, o carrinho e o checkout lêem daqui, conforme a operação e o período.
- **Apresentação:** em `domain_extensions` (descrição, destaque, ordem, etiqueta, realce), sem preços.
- **Encomenda:** o servidor recalcula o total antes de a criar. Se o preço mudou com o item no carrinho, devolve o novo total (HTTP 409 «o total foi actualizado») e o cliente vê o novo valor antes de confirmar.
- **Encomendas e facturas já emitidas:** guardam os seus próprios valores e não mudam.
- **Legado:** a tabela `site_domains` (preços duplicados) deixou de ser lida. `/api/domains` devolve agora os cartões do catálogo.

## Oferta, disponibilidade e registrador

Pôr uma extensão à venda só a oferece no site:
- A disponibilidade de cada nome continua a ser verificada na pesquisa e ao criar a encomenda. Extensões sem consulta automática ficam «A confirmar pela equipa», com encomenda retida e sem cobrança.
- O registo automático depende de Integrações → Registrador (fornecedor e extensões autorizadas). Activar no catálogo **não** autoriza o registrador.

## Segurança

- Todas as alterações passam por `requireAdminRole()` no servidor (`/api/admin/catalog`): visitante → 401, cliente → 403.
- Cada alteração fica em `activity_logs` (`domain_extension`).

## Migração

`database/mariadb/migrations/20261129_13_domain_extensions.sql`. Cria `domain_extensions` e preenche-a **preservando os cartões actuais**:
- as 6 primeiras extensões à venda, pela ordem fixa usada até agora;
- as mesmas descrições;
- `.ao` e `.com` com «Popular» e realce.

Usa `INSERT IGNORE`: não altera preços nem sobrepõe edições se correr de novo.

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

echo "== 2. Cartões actuais (antes)"
curl -fsS https://viralizahost.com/api/catalog/domains | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s).extensions.filter(x=>x.status==="active"&&x.register!=null).slice(0,6);console.log(e.map(x=>`${x.extension} ${x.register}`).join(" | "))})' | tee "/var/backups/viralizahost-cartoes-antes-$TS.txt"

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

echo "== 5. Migração (20261129_13_domain_extensions.sql — preserva os cartões actuais)"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs
mysql --defaults-extra-file="$HOME/.vh-my.cnf" "$DB" -e "SELECT extension, featured, featured_position, badge, highlight FROM domain_extensions WHERE featured = 1 ORDER BY featured_position"

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
echo "Cartões depois (devem coincidir com o passo 2):"
curl -fsS https://viralizahost.com/api/catalog/domains | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const f=JSON.parse(s).featured;console.log(f.map(x=>`${x.extension} ${x.register}${x.badge?` [${x.badge}]`:""}`).join(" | "))})'
curl -sS -o /dev/null -w "alterar catálogo sem sessão %{http_code} (esperado 401)\n" -X PATCH -H 'Content-Type: application/json' -d '{"kind":"extension","extension":".com","register":1}' https://viralizahost.com/api/admin/catalog
pm2 ls
PUBLICAR
```

**Reversão:** repor `/var/backups/viralizahost-prod-<TS>.tgz`, compilar e reiniciar `viralizahost`. A tabela nova não afecta a versão anterior, e os preços continuam em `domain_prices`.
