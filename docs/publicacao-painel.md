# Publicação — painel administrativo (receita, acções pendentes, registrador, menu, WHM)

Executar **só depois do merge** do PR na `main` e com autorização para publicar.

Pastas usadas (não se criam pastas de release):

- `/var/www/viralizahost-main`: cópia Git.
- `/var/www/viralizahost`: produção. O PM2 serve o processo `viralizahost` na porta 3000.

Os backups ficam como ficheiros em `/var/backups`.

O que esta versão muda na base:

- Migração `20261122_06_admin_ops.sql`. Só acrescenta (`IF NOT EXISTS`):
  - colunas em `orders`, `services` e `products`;
  - tabelas `registrar_settings` e `registrar_operations`.
- Não altera nem apaga encomendas, facturas ou pagamentos.
- A versão anterior continua a funcionar com a base migrada.

Dependências: nenhuma alteração (`package.json` e `package-lock.json` iguais). Nenhum ficheiro apagado: o bloco verifica as duas coisas antes de continuar.

## Bloco único

```bash
bash -s <<'PUBLICAR'
set -euo pipefail
GIT_DIR=/var/www/viralizahost-main
PROD_DIR=/var/www/viralizahost
DB=viralizahost_viralizaHost
TS=$(date +%F-%H%M)

echo "== 1. Commit da main (merge do PR)"
git -C "$GIT_DIR" fetch -q origin main
git -C "$GIT_DIR" checkout -q main
git -C "$GIT_DIR" merge -q --ff-only origin/main
COMMIT=$(git -C "$GIT_DIR" rev-parse HEAD)
git -C "$GIT_DIR" log --oneline -1
git -C "$GIT_DIR" merge-base --is-ancestor 50cbfae "$COMMIT"             # parte da versão em produção
test -z "$(git -C "$GIT_DIR" diff --name-only --diff-filter=D 50cbfae "$COMMIT")"   # nenhum ficheiro apagado
git -C "$GIT_DIR" diff --quiet 50cbfae "$COMMIT" -- package.json package-lock.json # dependências iguais

echo "== 2. Backup da base e da pasta de produção"
mysqldump --defaults-extra-file="$HOME/.vh-my.cnf" --single-transaction --routines "$DB" | gzip > "/var/backups/viralizahost-base-$TS.sql.gz"
gunzip -t "/var/backups/viralizahost-base-$TS.sql.gz"
tar --exclude=node_modules --exclude=.next/cache -czf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www viralizahost
tar -tzf "/var/backups/viralizahost-prod-$TS.tgz" > /dev/null
chmod 600 "/var/backups/viralizahost-base-$TS.sql.gz" "/var/backups/viralizahost-prod-$TS.tgz"
pm2 describe viralizahost > "/var/backups/viralizahost-pm2-$TS.txt"
echo "backups: /var/backups/viralizahost-{base,prod,pm2}-$TS.*"

echo "== 3. Código da main para a produção (preserva .env.local, node_modules e ficheiros carregados)"
grep -q '^WHM_ENCRYPTION_KEY=' "$PROD_DIR/.env.local"
git -C "$GIT_DIR" archive "$COMMIT" | tar -x -C "$PROD_DIR"
grep -q "$COMMIT" "$PROD_DIR/src/lib/release-id.ts"                     # commit gravado para /api/version

echo "== 4. Migração (só acrescenta colunas/tabelas)"
cd "$PROD_DIR"
env | grep -q '^DB_NAME=' && { echo "DB_NAME definido na shell — parar"; exit 1; } || true
node --env-file=.env.local scripts/mariadb/migrate-schema.mjs

echo "== 5. Diagnóstico só de leitura da encomenda VH-ORD-202611-0001 (nada é alterado)"
node --env-file=.env.local scripts/admin/diagnostico-encomendas.mjs --order=VH-ORD-202611-0001 --reconcile

echo "== 6. Build e reinício só de viralizahost"
npm run build 2>&1 | tail -5
pm2 restart viralizahost
sleep 8

echo "== 7. Verificação"
curl -fsS https://viralizahost.com/api/version; echo
curl -fsS https://viralizahost.com/api/version | grep -q "\"commit\":\"$COMMIT\"" && echo "OK: produção a servir $COMMIT"
curl -fsS -o /dev/null -w "página inicial %{http_code}\n" https://viralizahost.com/
curl -sS -o /dev/null -w "/api/admin/pending-actions sem sessão %{http_code} (esperado 401)\n" https://viralizahost.com/api/admin/pending-actions
pm2 ls
PUBLICAR
```

Depois, com sessão de administrador:

1. Abrir **Dashboard**. Confirmar:
   - «Acções pendentes» com contagens;
   - receita em «Kz …»;
   - «Clientes registados».
2. Abrir **Catálogo e Preços**: só esse item fica seleccionado.
3. Abrir **Integrações → WHM/cPanel → Testar ligação**.

Se tudo estiver bem: `pm2 save`.

## Decisões da equipa depois da publicação (não automáticas)

- **VH-ORD-202611-0001:** o passo 5 mostra o comprador (papel da conta), a factura, o pagamento (estado, moeda, data de validação e quem validou) e o estado dos serviços.
  - Se for uma encomenda de teste, marcar **Encomendas → «É teste»**. Sai da receita do painel; a factura e o pagamento ficam como estão.
- **Reconciliação de estados:** o passo 5 lista, sem alterar, os serviços que precisam de correcção (ex.: domínio «activo» sem referência do registo). Para aplicar, depois de rever:
  `node --env-file=.env.local scripts/admin/diagnostico-encomendas.mjs --reconcile --apply --confirm=<n.º mostrado>`
- **Registrador e WHM:** seguir `docs/integracoes-registrador-whm.md`.

## Reversão

```bash
bash -s <<'REVERTER'
set -euo pipefail
TS=<data-hora do backup, ex. 2026-11-22-1430>
pm2 logs viralizahost --lines 80 --nostream > "/var/backups/viralizahost-erro-$TS.log" || true
tar -xzf "/var/backups/viralizahost-prod-$TS.tgz" -C /var/www         # repõe código e build anteriores
pm2 restart viralizahost
sleep 8
curl -fsS https://viralizahost.com/api/version; echo
REVERTER
```

A migração só acrescenta colunas e tabelas, por isso a versão anterior funciona sem repor a base.

Repor a base (`gunzip -c /var/backups/viralizahost-base-$TS.sql.gz | mysql …`) só faz sentido se houver um problema de dados. Repô-la apaga as encomendas feitas depois do backup.
