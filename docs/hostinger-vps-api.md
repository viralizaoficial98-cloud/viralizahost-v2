# Hostinger VPS — capacidades da API confirmadas

**Fonte:** especificação OpenAPI oficial da Hostinger, versão **3.7.0**, no repositório `github.com/hostinger/api` (`openapi.json`, lido em 24/11/2026). A página `developers.hostinger.com` não estava acessível a partir do ambiente de desenvolvimento (rede), por isso nada abaixo vem dela. O README do repositório diz que a API está em **beta e sujeita a alterações**.

**O que não se pôde confirmar:** as permissões da **conta** da ViralizaHost. Ficam por confirmar com o «Testar ligação» em Integrações → Hostinger VPS, usando o token real, depois da aprovação.

## Base e autenticação
- **Base:** `https://developers.hostinger.com`, com caminhos `/api/...`, sempre em JSON.
- **Autenticação:** `Authorization: Bearer <token>`. O token é criado no hPanel (perfil → API) e tem as mesmas permissões do utilizador que o criou.
- **Paginação:** 50 itens por página (`?page=`).
- **Limites de pedidos:** 429 quando excedidos, com os cabeçalhos `RateLimit`, `Retry-After` e `X-RateLimit-*`. A quota exacta não está documentada.
- **Erros:** campo `error` e `correlation_id`.

## Comprar um VPS novo — **suportado**
`POST /api/vps/v1/virtual-machines` («Purchase new virtual machine»: compra e configura).

**Pedido** (`VPS.V1.VirtualMachine.PurchaseRequest`):

| Campo | Obrigatório | Notas |
|---|---|---|
| `item_id` | sim | id do **item de preço** do catálogo, ex.: `hostingercom-vps-kvm2-usd-1m` |
| `payment_method_id` | não | inteiro; sem ele, a Hostinger usa o **método de pagamento predefinido** da conta |
| `setup` | sim | ver tabela seguinte |
| `coupons` | não | lista de cupões |

**Campos de `setup`** (`SetupRequest`):

| Campo | Obrigatório | Notas |
|---|---|---|
| `template_id` | sim | inteiro (SO ou imagem) |
| `data_center_id` | sim | inteiro (localização) |
| `hostname` | não | substitui o nome predefinido |
| `password` | não | se faltar, é gerada uma aleatória, que **não é devolvida**. Regras: 12–50 caracteres, maiúscula, minúscula, número e `# + ? @`; palavras-passe comprometidas são recusadas |
| outros | não | `post_install_script_id`, `install_monarx`, `enable_backups` (por omissão `true`), `ns1`, `ns2`, `ssh_keys` (`public_key` está obsoleto) |

**Respostas:**
- **200** `VirtualMachineOrderResource`: `{ order: OrderResource, virtual_machine: VirtualMachineResource }`.
  - `OrderResource`: `id`, `subscription_id`, `status` (completed, pending, processing, failed, refunded, cancelled, awaiting_payment, payment_initiated, fraud_refund), `currency`, `subtotal` e `total` em **cêntimos**.
- **202** `PaymentProcessingResource`: `{ id, subscription_id, status: payment_initiated, message }`.
  - O pagamento ainda está a ser processado e o VPS **não foi configurado**.
  - O `subscription_id` serve para encontrar o produto quando a encomenda concluir; a configuração conclui-se depois com `/setup`.
- **422**, **401**, **500**.
- **Configuração falhada:** se a configuração falhar, a documentação manda concluí-la no hPanel.

**Sem idempotência:** a especificação não tem chave nem cabeçalho de idempotência para a compra. Repetir o pedido pode **comprar duas vezes**.

## Configurar um VPS já comprado
`POST /api/vps/v1/virtual-machines/{id}/setup`: só para uma VM no estado `initial`. Usa o mesmo corpo `SetupRequest`.

## Leituras
| Endpoint | O que devolve |
|---|---|
| `GET /api/vps/v1/virtual-machines` e `GET /api/vps/v1/virtual-machines/{id}` | `id`, `subscription_id`, `data_center_id`, `plan` (ex.: «KVM 4»), `hostname`, `state`, `actions_lock`, `cpus`, `memory`/`disk`/`bandwidth` **em MB**, `ipv4[]`/`ipv6[]` (`address`), `template`, `created_at` |
| `GET /api/vps/v1/data-centers` | `id`, `name`, `location` (país), `city`, `continent` |
| `GET /api/vps/v1/templates` | `id`, `name`, `description`, `documentation` |
| `GET /api/billing/v1/catalog?category=VPS` (também `name`) | itens com `id` (ex.: `hostingercom-vps-kvm2`), `name`, `category`, `metadata` e `prices[]`: `id`, `name`, `currency`, `price` e `first_period_price` em **cêntimos**, `period`, `period_unit` |
| `GET /api/billing/v1/payment-methods` | `id`, `name`, `identifier`, `payment_method`, `is_default`, `is_expired`, `is_suspended` |
| `GET /api/billing/v1/subscriptions` | `id`, `name`, `status`, `billing_period`, `total_price`, `renewal_price`, `is_auto_renewed`, `next_billing_at`, `expires_at` |

**Estados da VM (`state`):** running, starting, stopping, stopped, creating, initial, error, suspending, unsuspending, suspended, destroying, destroyed, recreating, restoring, recovery, stopping_recovery.

**Metadados do catálogo:** o campo `metadata` é «flexível, varia por categoria». As chaves das especificações (CPU, RAM, disco, tráfego) **não estão documentadas**.

## Unidades das especificações (tráfego, RAM, disco)

| Origem | Campo | Unidade | Estado |
|---|---|---|---|
| `VirtualMachineResource` (VM criada) | `memory`, `disk`, `bandwidth` | **megabytes**, tal como a especificação os descreve. Os exemplos oficiais (`memory` 8192 = 8 GB, `disk` 51200 = 50 GB) mostram que GB = MB ÷ 1024 | **Confirmado** na especificação |
| Catálogo (`metadata`) | `bandwidth` (e `memory`, `disk_space`) | Lido como os campos da VM com o mesmo nome: MB, e GB = MB ÷ 1024 | **Inferido**: ver abaixo |
| Catálogo (`metadata`) | qualquer outra chave sem unidade explícita (ex.: `traffic`) | desconhecida | O valor **não é validado** e o painel diz isso |

**Caso do KVM 1** (`hostingercombr-vps-kvm1`):
- O painel mostrava «4 TB anunciados ≠ 3,90625 TB». Com a conversão anterior, esse número só sai de um valor bruto de ≈ 4 096 000.
- 4 096 000 MB ÷ 1024 = **4 000 GB**: exactamente os «4 TB» que a Hostinger anuncia. A Hostinger faz GB → MB com ×1024 e chama «4 TB» a 4 000 GB (**TB decimal**).
- O erro estava na conversão antiga, que voltava a dividir 4 000 GB por 1024 (3,90625 «TB» binários).
- Este ambiente de ensaio não consegue chamar a API real: a rede bloqueia `developers.hostinger.com` e o token de produção não está aqui.
  - Por isso, **o valor bruto deve ser confirmado em produção**. O formulário do plano mostra «Valores brutos da Hostinger» (chave, valor e unidade) a partir do catálogo, em modo só de leitura.
  - Se a chave real não for `bandwidth`, ou o valor não for coerente com MB, o painel mostra «não foi possível validar» em vez de adivinhar.

**Regra de comparação** (`compareSpecs`, `src/lib/commerce/vps-shared.ts`, a mesma no painel e no servidor):
- Tudo é convertido para **GB decimais** antes de comparar: GB = 1, TB = 1000 GB, GiB = 1,0737 GB, TiB = 1099,51 GB.
- Rótulos: `GB`/`TB` para unidades decimais e `GiB`/`TiB` para unidades binárias.
- **Modo Automático:** uma divergência real bloqueia a gravação, e um valor não validado exige confirmação explícita da equipa.
- **Modo Manual:** o plano é gravado e as divergências aparecem como aviso.
- Testes de regressão: `node --test scripts/vps/vps-specs.test.mjs`.

## Cobrança ao fornecedor
- **Quem paga:** a compra é paga com um método de pagamento **guardado na conta Hostinger** (o predefinido, ou o indicado em `payment_method_id`). Nenhum dado de pagamento do cliente é enviado.
- **Renovação:** as subscrições renovam-se automaticamente. A API permite activar ou desactivar a renovação (`PATCH …/auto-renewal/enable`, `DELETE …/auto-renewal/disable`) e renovar (`POST …/renew`).
- **Parar cobranças:** parar a VM não pára a cobrança; para isso é preciso desactivar a renovação da subscrição.

## Como a ViralizaHost usa a API
- **Leituras e configuração:**
  - «Testar ligação» só lê: catálogo VPS, centros de dados, templates, métodos de pagamento e VMs;
  - as localizações e os SO oferecidos ao cliente vêm de `data-centers` e `templates`, e são escolhidos pelo administrador.
- **Compra automática** (só com a opção explícita activada, pagamento validado e plano em modo automático):
  - envia apenas `item_id`, `payment_method_id` e `setup` (`template_id`, `data_center_id`, `hostname` único por item);
  - **não envia** palavra-passe, comprovativos nem dados do cliente;
  - antes de comprar, compara o preço actual do item (`first_period_price`, ou `price`) com o **custo esperado** e o **limite de custo** do plano e ciclo; acima do limite ou noutra moeda, passa a tratamento manual.
- **Uma compra por item:** a operação é registada antes do pedido (chave única por serviço) e só uma execução consegue passar de «por enviar» a «a enviar».
  - **Resposta inconclusiva** (tempo esgotado, 5xx, falha de rede): **não se repete a compra**. A conciliação procura a VM pelo `hostname` único ou pelo `subscription_id` (`GET /virtual-machines`).
  - **Sem confirmação possível:** o caso fica em revisão manual.
- **Resposta 202:** a conciliação encontra a VM pela subscrição e, no estado `initial`, chama `/setup` uma única vez.
- **Conclusão:** activo quando `state = running`. Guarda a referência (VM, encomenda, subscrição, IPv4) e compara CPU, RAM, disco e tráfego da VM com o anunciado.
- **Compras reais:** exigem modo `live`, a opção explícita activada **e** a variável `VPS_LIVE_PURCHASES=1` no servidor. Sem isso, a compra fica em tratamento manual.
