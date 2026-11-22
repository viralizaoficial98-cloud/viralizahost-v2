# Integrações: registrador de domínios e WHM/cPanel

Este guia é para a equipa ViralizaHost. Explica como configurar, testar e activar as duas integrações no painel (**Integrações**).

Regras comuns às duas:

- Os segredos (chave do registrador, token WHM) ficam só no servidor. São cifrados com AES-256-GCM pela `WHM_ENCRYPTION_KEY` (64 caracteres hex, no `.env.local` da pasta de produção).
- Sem essa chave, o painel recusa guardar segredos.
- O navegador nunca recebe o segredo. Recebe apenas «guardado / não guardado».
- Os segredos nunca são escritos nos logs.
- «Testar ligação» faz só leituras. Nunca regista, transfere, cria contas nem cobra.
- Durante os testes **não** se fazem registos, transferências, cobranças nem contas reais.
- Para o ensaio há simuladores:
  - `scripts/mariadb/rehearsal/mock-registrar.mjs` (registrador);
  - `scripts/mariadb/rehearsal/mock-whm.mjs` (WHM).

---

## 1. Registrador de domínios

### 1.1 O que existe no código

| Peça | Ficheiro |
|---|---|
| Contrato comum dos fornecedores (consulta, registo, renovação, transferência, consulta de estado) | `src/lib/registrar/types.ts` |
| Configuração cifrada, «Testar ligação», escolha das extensões automatizadas | `src/lib/registrar/settings.ts` |
| Execução única com idempotência e tratamento de timeout | `src/lib/registrar/operations.ts` |
| Fornecedor **simulado**, só para ensaio | `src/lib/registrar/simulated.ts` |
| Página **Integrações → Registrador de domínios** | `/admin/settings/integrations/registrar` |
| Tabelas `registrar_settings` e `registrar_operations` | migração `20261122_06_admin_ops.sql` |

**Estado actual:** não há fornecedor real contratado nem credenciais. Todas as extensões continuam em **fluxo manual**:

- A disponibilidade de .ao/.co.ao é «A confirmar pela equipa». A encomenda fica retida até a equipa marcar «Livre» ou «Ocupado».
- Depois do pagamento, o domínio fica «A aguardar registo».
- A equipa regista-o no painel do fornecedor. Depois marca-o em **Encomendas → Marcar como registado…**, com a **referência do registo**, que é obrigatória.

### 1.2 Como funciona quando um fornecedor estiver activo

1. **Consulta de disponibilidade.** Nas extensões seleccionadas, a pesquisa e o checkout perguntam primeiro ao registrador. As restantes continuam no RDAP.
   - Se a resposta for inconclusiva, o domínio fica «A confirmar pela equipa». Nunca aparece como disponível.
2. **Depois do pagamento validado**, o painel ou a notificação do gateway arrancam o registo:
   - a disponibilidade é confirmada de novo no fornecedor;
   - o registo é pedido **uma única vez**. A referência enviada ao fornecedor é fixa por serviço (`vh-register-<serviço>`) e a base tem uma chave única por (serviço, operação).
3. **Resposta:**
   - **Confirmado:** o domínio passa a «Activo» com a referência do fornecedor (origem «registrador»).
   - **Aceite mas pendente:** o domínio fica a aguardar. «Repetir» consulta o estado.
   - **Recusado:** fica «Registo falhou» com o motivo. Não há cobrança nova.
   - **Timeout ou erro de rede:** a operação fica «inconclusiva». A repetição **consulta primeiro o estado no fornecedor**:
     - se o fornecedor tiver o pedido, usa essa resposta;
     - se não o tiver, pode pedir de novo com segurança;
     - se a consulta também for inconclusiva, fica para **intervenção manual** e não faz um novo pedido.
4. **Renovação e transferência** seguem o mesmo mecanismo (`renew`, `transfer`).
   - Na transferência, o código EPP é decifrado só no momento do pedido.
5. O domínio só fica «Activo» com a **confirmação do registrador**, ou com a marcação manual de um administrador **com referência**. A marcação fica no histórico (`activity_logs`, `services.activated_by`).

### 1.3 Fornecedores com API e suporte .ao / .co.ao

Pesquisa feita a 20/11/2026 nas páginas oficiais.

**Atenção:** «listado» significa que o fornecedor vende a extensão. Isso **não** confirma, por si, que a consulta e o registo estejam disponíveis por API para essa extensão. Essa confirmação tem de ser pedida por escrito ao fornecedor antes de contratar.

| Fornecedor | .ao | .co.ao | Internacionais (.com/.net/.org…) | Consulta por API | Registo por API | Fonte |
|---|---|---|---|---|---|---|
| **DNS.AO (registo .ao, INFOSI)**: tornar-se registrar acreditado | sim | sim | não | a confirmar no programa de registrar | a confirmar | https://www.dns.ao/ («Quero ser Registrar»), https://www.dns.ao/ao/lojas-de-revendedores-oficiais-autorizados/ |
| **INWX** (registrar internacional) | listado | página própria em `/en/co.ao-domain` | sim | API documentada (página de documentação inacessível desta rede) | idem | https://www.inwx.de/en/ao-domain |
| **101domain** (listado pelo DNS.AO como revendedor oficial internacional) | listado | página `co_ao.htm` | sim | **sim**: «Check single or bulk domain availability» | **não confirmado**: a página da API lista pesquisa, DNS, portefólio e encomendas, não registo | https://www.101domain.com/domain-api.htm |
| **Lexsynergy, Marcaria, ExpanTLD** (listados pelo DNS.AO como internacionais) | revendedores oficiais | — | sim | não verificado | não verificado | lista do DNS.AO |
| **Registrars nacionais** (Angola Cables, Yabaduu, Lello, WEBDOCA.AO, Pleno) | registrars | sim | — | não publicam API; pedir directamente | idem | lista do DNS.AO |
| **REGISTAR.AO / WakuSell** (revenda .ao com API e módulo WHMCS, segundo resultados de pesquisa) | — | — | — | página inacessível desta rede: **não confirmado** | — | https://registar.ao/revenda |

**Requisitos conhecidos para .ao** (101domain, a partir das regras do registo):

- **Empresas:** NIF ou registo comercial, e nome e documento (BI ou passaporte) do administrador do domínio.
- **Particulares:** BI ou passaporte.

A INWX indica 7 dias de registo e transferência com código de autorização.

**Decisão em falta (da equipa):** escolher o fornecedor. O ideal é um registrar nacional acreditado, ou o próprio estatuto de registrar no DNS.AO, para .ao/.co.ao. Junta-se um registrar internacional para .com/.net/.org.

Antes de contratar, peça por escrito ao fornecedor:

1. Consulta **e** registo por API para .ao e .co.ao (e para as outras extensões vendidas), separadamente.
2. Ambiente de ensaio (OT&E/sandbox) e respectivo endereço.
3. Consulta do estado por referência do cliente (idempotência), para tratar timeouts.
4. Renovação e transferência por API.
5. Modelo de pagamento (saldo pré-pago, depósito mínimo) e documentos exigidos ao titular.

### 1.4 Passo a passo para activar

1. **Contratar** o fornecedor e abrir a conta de revendedor. Carregar saldo, se for pré-pago.
2. **Credenciais de API:** criar uma chave só para a ViralizaHost. Se o fornecedor permitir, restringi-la ao IP público do servidor. Pedir também as credenciais do ambiente de ensaio.
3. **Adaptador:** acrescentar `src/lib/registrar/<fornecedor>.ts`, que implementa `RegistrarAdapter`, e registá-lo em `PROVIDERS` e em `build()` (`src/lib/registrar/settings.ts`). Só depois o fornecedor aparece no painel.
   - O simulador mostra o comportamento esperado de cada operação.
4. **Configurar** em **Integrações → Registrador de domínios**:
   - fornecedor;
   - modo **Ensaio**;
   - endereço da API do ambiente de ensaio;
   - utilizador e chave.
   - Clicar **Guardar**.
5. **Testar ligação.** Só faz leitura da conta. Repetir até dar «ligação OK».
6. **Seleccionar extensões:** marcar só as que o fornecedor confirmou por escrito, com consulta **e** registo por API.
7. **Ensaio completo**, no servidor de ensaio (porta 3100, com `REGISTRAR_TEST_PROVISIONING=1`):
   - encomenda;
   - validação do pagamento;
   - registo no ambiente de ensaio do fornecedor;
   - confirmação de que o domínio só fica «Activo» com a referência devolvida;
   - repetir para ver que não há segundo registo.
8. **Produção:**
   - trocar para o endereço e as credenciais de produção;
   - modo **Produção**;
   - Guardar;
   - **Testar ligação**;
   - marcar **Activar integração**.
   - A activação só é aceite depois de um teste bem-sucedido com essa configuração.
9. **Acompanhar** as primeiras encomendas em **Dashboard → Acções pendentes → Encomendas pagas por activar**.

**Importante:** em modo **Ensaio**, uma instalação de produção (sem `REGISTRAR_TEST_PROVISIONING=1`) **nunca** usa o registrador nas encomendas reais. Continuam em registo manual.

---

## 2. WHM / cPanel

### 2.1 Ligação (documentação oficial cPanel)

- **Endpoint:** `https://<servidor>:2087/json-api/<função>?api.version=1`, sempre HTTPS na porta 2087.
- **Cabeçalho:** `Authorization: whm <utilizador>:<token>`.
  - Fonte: https://api.docs.cpanel.net/guides/guide-to-api-authentication/guide-to-api-authentication-api-tokens-in-whm
- **TLS:** a aplicação **valida o certificado**.
  - O servidor WHM precisa de um certificado válido para o nome usado no URL. AutoSSL/Let's Encrypt no hostname é suficiente.
  - Não desligue a validação. Os exemplos da documentação usam `verify_SSL => 0` apenas por simplicidade.
- **Utilizador:** `root`, ou um revendedor com os privilégios abaixo. Um revendedor só vê e cria contas que lhe pertençam.

### 2.2 Privilégios mínimos do token

Fonte: https://api.docs.cpanel.net/guides/guide-to-whm-plugins/guide-to-whm-plugins-acl-reference-chart

| Função usada pela aplicação | Para quê | ACL do token |
|---|---|---|
| `version` | Testar ligação | `basic-system-info` |
| `listaccts` | Testar ligação, importação, sincronização | `list-accts` |
| `accountsummary` | Procurar a conta antes de criar (repetição sem duplicar) | `acct-summary` |
| `listpkgs` | Lista de pacotes para mapear planos | `list-pkgs` |
| `createacct` | Activação automática de alojamento/e-mail | `create-acct` |
| `create_user_session` | Entrar no cPanel/Webmail a partir da Área do Cliente | `create-user-session` ⚠ |
| `suspendacct` / `unsuspendacct` | Suspender/reactivar no painel | `suspend-acct` |
| `changepackage` | Mudar de plano no painel | `upgrade-account` |
| `passwd` | Mudar a senha cPanel no painel | `passwd` |
| UAPI pelo WHM (`/execute/Email/add_pop`, etc.) | Caixas de e-mail, domínios e bases de dados do cliente | `cpanel-api` |
| `removeacct` | Terminar conta (só se a equipa usar) | `kill-acct` (opcional) |

**⚠ Aviso da documentação oficial sobre `create-user-session`:** «This privilege allows an API token user to bypass any restrictions on the API token». Só é necessário para o acesso directo do cliente ao cPanel/Webmail. Proteja o token com a **lista de IPs** (abaixo).

`getdiskusage` e `loadavg` (estatísticas de disco e carga) não aparecem na tabela de ACL. Podem exigir `root`. Se falharem, só faltam estatísticas: a activação e o acesso não dependem deles.

### 2.3 Criar o token no WHM

Fonte: https://docs.cpanel.net/whm/development/manage-api-tokens-in-whm/

1. No WHM: **Home » Development » Manage API Tokens » Generate Token**.
2. **Nome:** por exemplo `viralizahost-portal`.
3. **Privileges:** desmarcar tudo e marcar só as ACL da tabela 2.2. A documentação exige pelo menos uma.
4. **IPs:** indicar o IP público do servidor da ViralizaHost. Em branco, qualquer IP pode usar o token; até 100 entradas.
5. **Expiration:** definir uma data e registar no calendário da equipa quando renovar.
6. **Generate** e copiar o token. O WHM só o mostra uma vez.

### 2.4 Cadastrar o servidor na ViralizaHost

1. Confirmar que `WHM_ENCRYPTION_KEY` está em `/var/www/viralizahost/.env.local`. Sem ela, o painel recusa guardar o token.
2. **Integrações → WHM/cPanel → Configurar servidor e token**. Leva a **Configurações → WHM / cPanel API**.
3. Preencher:
   - URL `https://<hostname>:2087`;
   - utilizador;
   - token.
4. Guardar. A aplicação testa a ligação antes de guardar e grava o token **cifrado**. Se falhar, não guarda nada.
5. Voltar a **Integrações → WHM/cPanel**. A lista deve mostrar «Token guardado cifrado».
   - Se mostrar «SEM cifra» (token antigo), volte a guardá-lo.

### 2.5 Testar e mapear pacotes

1. **Testar ligação.** Só leitura: versão, número de contas e pacotes.
2. Na tabela **Plano → servidor e pacote**, escolha **WHM (automática)** e o pacote de cada plano de alojamento/e-mail.
   - Só são aceites pacotes que existem no WHM.
   - Planos sem pacote ficam em activação manual e aparecem no aviso.
3. **E-mail:** a coluna mostra se a activação é automática (conta cPanel criada com o pacote) e quantas caixas o pacote permite (`MAXPOP`).
   - Se o pacote não permitir caixas, ou o plano estiver em «Manual», a activação do e-mail fica para intervenção manual.
4. **Se uma activação falhar:**
   - o motivo fica na encomenda (sem URLs nem segredos);
   - aparece em **Acções pendentes**;
   - «Repetir» procura primeiro a conta no WHM e associa-a se já existir. **Nunca cria uma segunda conta** para o mesmo serviço.

### 2.6 Importar contas existentes

1. **Pré-visualizar** em **Integrações → WHM/cPanel**. Nada é gravado. Mostra:
   - contas encontradas, novas, actualizadas e sem alterações;
   - já associadas;
   - candidatas (e-mail coincidente);
   - sem cliente;
   - conflitos/duplicados (ex.: o mesmo domínio em duas contas);
   - contas do portal que já não estão no WHM.
2. **Aplicar importação.** Pode repetir-se sem duplicar e preserva as contas existentes.
3. **Candidatas:** um e-mail coincidente **não** associa a conta ao cliente. A equipa confirma ou rejeita cada candidata em **Servidores → Contas WHM**.
   - Só clientes elegíveis podem ser candidatos: papel cliente, conta activa e e-mail confirmado no portal. Contas administrativas nunca são sugeridas.
4. O cliente só vê e abre (cPanel/Webmail) as contas associadas ao seu perfil. Um pedido para a conta de outro cliente devolve 404.

### 2.7 Associar manualmente uma conta a um cliente

Para contas «Sem cliente», com ou sem candidata. Também funciona quando o contacto no WHM (ex.: `comercial@…`) é diferente do e-mail do cliente no portal.

1. **Servidores → Contas WHM → Sem cliente → Associar cliente** (na linha da conta).
2. Pesquisar o cliente por nome ou e-mail.
   - Só aparecem clientes registados. As contas administrativas não aparecem.
   - Clientes inactivos ou com o e-mail por confirmar aparecem com o motivo e não podem ser escolhidos.
   - Sem cliente registado e confirmado, a conta fica «Sem cliente»: o painel não cria contas de cliente.
3. Rever o resumo: domínio, utilizador cPanel, servidor, contacto no WHM e cliente seleccionado.
4. Confirmar a titularidade (caixa obrigatória) e clicar **Associar cliente**.

O servidor volta a validar tudo:

- permissões de administrador;
- elegibilidade do cliente;
- a conta WHM fica bloqueada durante a gravação: se dois administradores gravarem ao mesmo tempo, o segundo recebe o conflito com o titular actual;
- vínculos incompatíveis (outro cliente, serviço de outro cliente, domínio de outro cliente) são mostrados para revisão. Nada é substituído.

O que fica gravado:

- quem associou, quando e o método (`linked_by`, `linked_at`, `link_method`), mais uma entrada no histórico (`activity_logs`);
- se a conta não tinha serviço, um serviço de alojamento «importado» sem preço nem renovação (nenhuma factura) e a conta de alojamento. É por aí que a Área do Cliente e o acesso ao cPanel/Webmail encontram a hospedagem.

O contacto do WHM fica como veio. A sincronização seguinte preserva o vínculo e continua a actualizar uso, pacote e estado.

### 2.8 Mecanismo único de credenciais

Todas as rotas que falam com o WHM obtêm e decifram o token pela mesma função, `loadWhmConfig()` (`src/lib/whm/config.ts`):

- activação;
- SSO do cPanel/Webmail;
- importação e sincronização;
- acções do painel;
- caixas de e-mail.

As rotas antigas `/api/whm/accounts` e `/api/whm/sync` usavam o valor cifrado como se fosse o token. Foram corrigidas para este mecanismo.

---

## 3. O que depende de credenciais ou de ensaio real

| Item | Validado no ensaio | Depende de |
|---|---|---|
| Registo, renovação e transferência automáticos | sim, com o simulador (registo único, timeout, perda, inconclusivo, pendente, recusado, renovação) | contrato + adaptador + credenciais do fornecedor; ensaio no OT&E dele |
| Consulta .ao/.co.ao por API | sim, simulador | confirmação escrita do fornecedor |
| WHM: teste, pacotes, activação, repetição sem duplicar, SSO, importação | sim, WHM simulado | token real com as ACL acima; certificado válido no hostname |
| Privilégios mínimos efectivos do token | tabela oficial de ACL | confirmar num WHM real (algumas funções podem exigir root) |
