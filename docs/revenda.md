# Revenda de Hospedagem (WHM/cPanel)

Estado entregue: **pedidos com aprovação manual** (`request_only`) activos após a instalação; **venda automática implementada e
testada só com o WHM simulado, bloqueada** até autorização expressa e aprovação técnica. Nenhum revendedor real é criado por
este código sem as salvaguardas descritas em [Segurança](#segurança).

## 1. Modos comerciais (Painel → Revenda de Hospedagem → Configurações)

| Modo | Página pública | Pedidos | Checkout | Aprovisionamento |
|---|---|---|---|---|
| `disabled` | planos com «Em breve» | recusados (403) | recusado | bloqueado |
| `test` | «Em breve» para visitantes; formulário só para administradores | só administradores (marcados `is_test`) | só administradores, só com servidor de **teste** | só servidores de ambiente `test`; pagamento simulado |
| `request_only` (**inicial**) | «Solicitar contratação» + formulário | aceites | recusado (`reseller_request_only`) — só a encomenda criada pelo painel a partir de um pedido aprovado | só depois de pago **e** «Autorizar aprovisionamento» |
| `automatic` | «Contratar agora» | aceites | permitido com capacidade num servidor autorizado | automático após pagamento confirmado no servidor |

`automatic` exige, por esta ordem: aprovação técnica da infraestrutura registada (texto descritivo) **e** autorização expressa
escrita «AUTORIZO VENDA AUTOMATICA». Retirar qualquer uma devolve o modo a `request_only`. Todas as regras são aplicadas no
servidor: `src/lib/reseller/gate.ts` (cotação/checkout), `requests.ts` (pedidos), `provisioning.ts` (motor).

## 2. Fluxo de um pedido

```
submitted → under_review → technically_approved → awaiting_payment → paid → provisioning_authorized
          → provisioning → awaiting_confirmation → active
          ↘ rejected | cancelled (antes de activo)        failed (repetível; retoma no passo)
```

1. **Pedido** (`POST /api/reseller/requests`): nome, empresa, e-mail, telefone/WhatsApp, domínio, plano, ciclo, n.º estimado de
   clientes, tipo de negócio, observações. Cliente com sessão: e-mail/nome/telefone da conta. Referência `VH-REV-AAAAMM-XXXXXX`.
   Anti-spam: campo isco, tempo mínimo de preenchimento (3 s), limite por IP (5/15 min) e por e-mail (3/h), máx. de pedidos em
   aberto por e-mail (configurável), duplicados (mesmo e-mail+domínio+plano em aberto) devolvem o pedido existente.
   Notificações: `notifications` (sino dos administradores) + e-mail (Resend) à equipa (lista configurável) e ao cliente.
2. **Análise** (painel): dados do cliente, plano e perfil técnico, servidores com capacidade e motivos de inelegibilidade, notas.
3. **Aprovação técnica**: exige perfil técnico completo e servidor elegível; **reserva capacidade numa transacção** (linha do
   servidor bloqueada, capacidade recalculada). Não toca no WHM.
4. **Encaminhar para pagamento**: cria a encomenda e a factura pelo fluxo existente (`createOrder`, preço recalculado no servidor,
   chave idempotente `reseller-<id>`). O cliente paga pelo Financeiro existente (transferência + comprovativo).
5. **Pagamento confirmado** (Financeiro → aprovar comprovativo, ou gateway): `provisionService` → pedido «Pago». **Não cria contas.**
6. **Autorizar aprovisionamento**: corre o motor (secção 4). Resultado: «A aguardar confirmação da ACL».
7. **Confirmar ACL** (texto «ACL CONFIRMADA», depois de verificar no WHM): activa serviço, notifica o cliente e dá acesso na área
   de cliente.

## 3. Capacidade (Infraestrutura → Servidores)

`servers` (tabela existente) passou a ter ficha técnica, licença, categorias (`hosting`, `wordpress`, `email`, `reseller`),
ambiente (`test`/`production`), estado operacional, contas protegidas e autorização expressa para revenda.

```
espaço livre seguro = total − reserva operacional − quotas comprometidas (sincronização) − reservas activas
contas licenciadas  = limite da licença − contas existentes − contas reservadas
necessidade do plano = (espaço p/ clientes + quota da conta principal) MB e (1 + contas cPanel) contas
```

Capacidade **indeterminada → aprovação bloqueada** quando: falta o total de espaço; falta o limite da licença; não há
sincronização com sucesso nas últimas 24 h (`RESELLER_SYNC_MAX_AGE_HOURS`); há contas sem quota (ilimitadas) e não está
definida a «quota assumida por conta ilimitada». A sincronização é só de leitura (`version`, `listaccts`, `listresellers`).
Um servidor só é elegível com: estado activo, categoria «Revenda», **autorização expressa** (produção: texto «AUTORIZO REVENDA»),
credencial, compatível com o plano e (modo teste) ambiente de teste. A migração deixa **todos os servidores não autorizados**.

## 4. Motor de aprovisionamento (`src/lib/reseller/provisioning.ts`)

Uma operação persistente por serviço (`reseller_provision_ops`, `UNIQUE service_id`), com bloqueio (`lock_token`,
`locked_until` 5 min), estado retomável (`state.done`), até 5 tentativas com espera crescente para erros transitórios, eventos
por passo (`reseller_provision_events`: função WHM, duração, mensagem sem segredos) e auditoria em `activity_logs`.

| Passo | WHM API 1 | Notas |
|---|---|---|
| 1–5 validações | — | pedido aprovado, modo, autorização, pagamento `paid`, servidor elegível, guardas de ambiente |
| 6 disponibilidade | `listaccts` (domínio, exacto), `verify_new_username`, `accountsummary` | domínio existente → bloqueado (nada é reutilizado); contas protegidas (`vhreslab`) nunca usadas |
| 7 reserva | — | transacção com `FOR UPDATE` no servidor |
| 8 conta principal | `createacct` (POST, sem senha, `reseller=0`, `quota`) | utilizador gravado **antes** da chamada: um tempo limite seguido de repetição adopta a conta (sem duplicar) |
| 9 pacote | `accountsummary` | confirma o pacote aplicado |
| 10 revendedor | `listresellers`, `setupreseller` (`makeowner=0`) | idempotente |
| 11 ACL | `setacls` (`reseller`, `acllist`) | |
| 12–14 limites | `setresellerlimits` | `account_limit`, `diskspace_limit`, `bandwidth_limit`, `enable_*_limit=1`, `enable_overselling*=0`, `enable_package_limits=1` |
| 15 pacotes | `setresellerpackagelimit` (`allowed=1`) | por pacote autorizado do perfil |
| 16 verificação | `listresellers`, `acctcounts`, `resellerstats`, `accountsummary` | compara limites, pacote, quota e estado; diferença → falha sem acesso |
| 17 sincronização | — | `reseller_services`, `whm_accounts`, reserva `committed` |
| 18–20 | — | após «Confirmar ACL»: serviço activo, notificação, acesso na área de cliente |

**Privilégios efectivos**: a WHM API 1 de leitura usada não devolve as ACL efectivas de outro revendedor e **`getresellerprivs`
não existe** (o cliente recusa chamá-la). Por isso o motor distingue o perfil guardado (`acl_name`) das definições observáveis e
exige **confirmação humana** da ACL efectiva antes de dar acesso. Ver roteiro (secção 9) para validar uma alternativa (por
exemplo `myprivs` autenticado como o próprio revendedor).

Falhas: nunca dão acesso; nunca se apagam contas (nem para corrigir falhas parciais); «Repetir» retoma no passo em que parou;
«Repor tentativas» depois de corrigir a causa; «Reconciliar» compara base e WHM sem alterar nada.

## 5. Perfil técnico dos planos (Catálogo e Preços → Revenda)

Preço, descontos, renovação, características, ícones, ordem, destaque e publicação continuam no editor de planos existente
(sem preços duplicados). O perfil técnico acrescenta: espaço distribuível, tráfego, contas cPanel, quota da conta principal, ACL,
pacote da conta principal, pacotes autorizados, servidores compatíveis e (preparado, com confirmação «VALIDADO») gestão de
pacotes próprios. Limites sempre finitos. Nomes com `_lab` (perfis do laboratório) são recusados. «Ler pacotes e ACLs do WHM»
audita cada ACL contra a lista proibida (`all`, `allow-unlimited-*`, `allow-shell`, `quota`, `edit-account`, `limit-bandwidth`,
`rearrange-accts`, `restart`, `clustering`, …) e mostra o que difere da referência do laboratório.

Períodos da revenda: **mensal, trimestral, semestral e anual** (os restantes planos da família continuam em 1 mês, 1, 2 e 3 anos).
Isto altera a regra do PR #55 apenas para a revenda (`familyPeriods('reseller')`).

Planos provisórios criados pela migração (só porque nenhum plano de revenda tinha preço): Starter 10 GB/5 contas 25 000 Kz,
Business 20 GB/10 contas 45 000 Kz, Pro 30 GB/15 contas 65 000 Kz; descontos 0/5/10/15 %; renovação ao preço base. Os 4 planos
antigos sem preço (`reseller-start`, `-growth`, `-business`, `-enterprise`) passaram a **rascunho** (não apagados).

## 6. Área do revendedor (`/revendedor`)

Pedidos (estado, factura, motivo de recusa), plano, estado, utilizador WHM, ciclo, contratação, renovação, nameservers, servidor,
consumo (espaço, contas, tráfego) e lista das **suas** contas-filhas. Botões: Aceder ao WHM / cPanel (sessão temporária
`create_user_session`, `whostmgrd`/`cpaneld`), Gerir contas de clientes, Consultar consumo, Alterar senha (política forte, POST),
Renovar (carrinho existente), Solicitar upgrade (novo pedido `kind=upgrade`), Consultar faturas, Abrir ticket. Cada acção valida
a propriedade no servidor (outro cliente → 404).

## 7. Base de dados — migração `20261209_23_reseller_hosting.sql`

Incremental, idempotente, não destrutiva (só `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`; nenhum `DROP`).
Novas tabelas: `reseller_settings`, `reseller_plan_profiles`, `reseller_requests`, `reseller_request_events`,
`capacity_reservations`, `reseller_services`, `reseller_provision_ops`, `reseller_provision_events`, `reseller_usage_snapshots`.
`servers`: +28 colunas (ficha, licença, capacidade, sincronização, categorias, ambiente, autorização, contas protegidas).
Dados: modo `request_only`; servidores existentes com categorias `hosting/wordpress/email` (sem revenda), não autorizados,
`vhreslab` protegido; planos provisórios só se nenhum plano de revenda tiver preço.

## 8. Configuração

| Variável | Produção (agora) | Ensaio | Efeito |
|---|---|---|---|
| `RESELLER_PROVISIONING_ENABLED` | **ausente** | `1` | sem `1`, o motor nunca escreve no WHM |
| `RESELLER_PRODUCTION_PROVISIONING` | **ausente** | ausente | sem `1`, nenhum servidor de ambiente `production` é aprovisionado |
| `RESELLER_WHM_TIMEOUT_MS` | 20000 (omissão) | 4000 | tempo limite por chamada WHM |
| `RESELLER_SYNC_MAX_AGE_HOURS` | 24 (omissão) | — | idade máxima da sincronização |
| `RESELLER_REQUEST_RATE_LIMIT` / `RESELLER_REQUEST_EMAIL_LIMIT` / `RESELLER_CLIENT_RATE_LIMIT` | omissão (5 / 3 / 30) | 1000 | só ensaio |
| `WHM_ENCRYPTION_KEY`, `RESEND_*` | já existentes | | |

Painel: Revenda → Configurações (e-mails da equipa, aviso do formulário, nameservers, máx. de pedidos em aberto).

## 9. Segurança

- Credenciais WHM só no servidor: token cifrado (AES-256-GCM) em `servers.whm_api_token`, lido só por `loadWhmConfig`; nunca
  devolvido pelas APIs (só «credencial configurada»), nunca registado. `credential_ref` guarda a referência, não o valor.
- HTTPS obrigatório para o WHM (URL `http://` recusada), certificado validado pelo Node (nenhuma desactivação).
- Cada chamada valida o HTTP **e** `metadata.result`; erros limpos de URLs, tokens e senhas.
- Senhas: nunca pedidas no formulário; `passwd` e `createacct` por POST (nunca no URL). **Corrigido também** o «alterar senha»
  existente do painel de clientes, que enviava a senha no URL do WHM.
- Escrita no WHM isolada no motor e nas acções administrativas, protegida por variável de ambiente, autorização do servidor e
  autorização do pedido; produção exige uma segunda variável.
- Painel: `requireAdminRole` em todas as rotas; transições validadas pelo estado actual (concorrência: `UPDATE … WHERE status=?`).
- Cliente: propriedade verificada em cada acção; contas-filhas filtradas por `owner`; limite de pedidos.
- Auditoria: `activity_logs` (modo, autorizações, servidores, perfis, pedidos, aprovisionamento, sessões, senhas, suspensões).
- IP dos pedidos guardado só como hash SHA-256.

## 10. Testes (ensaio, WHM simulado)

`scripts/mariadb/rehearsal/reseller-e2e.cjs` — 168 verificações: página pública e formulário, comparação, FAQ, ciclos;
validação, anti-spam, duplicados; checkout bloqueado; modos `disabled`/`test`/`request_only`/`automatic`; análise, servidor,
aprovação, reserva, factura, pagamento pelo Financeiro existente, pagamento repetido, autorização, motor, chamadas WHM esperadas
(sem `getresellerprivs`, sem `removeacct`, `createacct` por POST sem senha), confirmação de ACL; área do revendedor (sessões,
consumo, contas-filhas, senha por POST, isolamento entre clientes, upgrade); capacidade e licença insuficientes, indeterminada
(ilimitadas, licença desconhecida, sincronização antiga); falha parcial (retoma sem recriar), tempo limite (adopção sem duplicar),
verificação falhada, domínio existente; suspensão/reactivação/reconciliação; renovação; cancelamento; venda automática com
preço do navegador ignorado. Capturas desktop e iPhone em `docs/capturas/revenda/`.

`mock-whm.mjs` ganhou as funções de revenda e injecção de falhas (`lento`, `parcial`, `verificacao` no domínio).

## 11. Publicação (feita pela equipa)

1. Cópia de segurança da base de produção.
2. `git pull` em `/var/www/viralizahost` (depois do merge do PR).
3. `node --env-file=.env.local scripts/mariadb/migrate-schema.mjs --dry-run` → confirmar só a migração 23 pendente; depois sem `--dry-run`.
4. **Não** definir `RESELLER_PROVISIONING_ENABLED` nem `RESELLER_PRODUCTION_PROVISIONING`.
5. `npm ci && npm run build && pm2 restart viralizahost`.
6. Verificar: `/revenda-de-hospedagem` (3 planos, «Solicitar contratação»), um pedido de teste, Painel → Revenda,
   Infraestrutura → Servidores (servidor principal **não autorizado**), Catálogo e Preços → Revenda (perfil técnico).
7. Sincronizar o servidor principal (só leitura) e preencher armazenamento total, reserva, licença (30 contas) e quota assumida.

## 12. Reversão

- Código: reverter o merge e `pm2 restart viralizahost`. As tabelas novas ficam sem uso (inofensivas).
- Desligar a revenda sem reverter: Painel → Revenda → Configurações → «Desactivado».
- Dados: a migração não apaga nada. Para repor os planos antigos: `UPDATE products SET sale_status='on_request' WHERE slug IN
  ('reseller-start','reseller-growth','reseller-business','reseller-enterprise')` e pôr em rascunho `revenda-*`.
- Nada no WHM é criado ou alterado pela publicação (escrita desactivada por omissão).

## 13. Roteiro de testes com o WHM real (futuro — não executar sem autorização)

1. Confirmar na documentação oficial (api.docs.cpanel.net, WHM 138) os parâmetros usados (inacessível neste ambiente): `setupreseller`
   (`makeowner`), `setacls` (`reseller`, `acllist`), `setresellerlimits` (nomes exactos dos campos de overselling e de limites por
   pacote), `setresellerpackagelimit` (`allowed`, `no_limit`), `acctcounts`/`resellerstats` (campos de limite e uso),
   `verify_new_username`, `create_user_session` (`service=whostmgrd`). Ajustar `src/lib/reseller/whm.ts` se necessário.
2. Só leitura contra o WHM real: sincronização; `listacls` (auditar `viraliza_reseller_lab_acl`); `resellerstats`/`acctcounts`
   de `vhreslab` — comparar os campos com os do simulador.
3. Testes manuais pendentes no laboratório: criação de contas-filhas por `vhreslab`, isolamento entre revendedores, limite de 2
   contas, quotas e overselling desactivado.
4. Criar uma ACL comercial auditada (ex.: `viraliza_reseller_std_acl`) e pacotes comerciais (sem ilimitados).
5. Avaliar uma verificação automática da ACL efectiva (`myprivs` com um token do próprio revendedor) — hoje é confirmação humana.
6. Ensaio controlado num servidor/ambiente de teste autorizado, com `RESELLER_PROVISIONING_ENABLED=1`, um pedido de teste e
   remoção manual posterior pela equipa.

## 14. Pendente antes da primeira venda

- [ ] Testes manuais de contas-filhas e isolamento no laboratório (`vhreslab`).
- [ ] Auditoria da ACL de referência e criação da ACL e pacotes **comerciais**; preencher o perfil técnico de cada plano.
- [ ] Confirmar preços, descontos e limites provisórios (Starter/Business/Pro) e o tráfego (provisório: 10× o espaço).
- [ ] Preencher a ficha do servidor (armazenamento total, reserva operacional, licença Pro Cloud = 30 contas — hoje 23 usadas:
      cada revendedor Starter consome 6 contas licenciadas) e sincronizar.
- [ ] Confirmar os parâmetros WHM API 1 na documentação oficial (secção 13.1).
- [ ] Autorização técnica expressa do servidor para revenda e, só então, `RESELLER_PROVISIONING_ENABLED=1` +
      `RESELLER_PRODUCTION_PROVISIONING=1` no processo de produção.
- [ ] Venda automática: só depois de tudo acima, com aprovação técnica e autorização expressa registadas no painel.
