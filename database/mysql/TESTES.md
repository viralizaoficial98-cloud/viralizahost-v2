# Registo de testes — migração Supabase PostgreSQL → MySQL/MariaDB

Branch `feat/migracao-mysql`. Testes executados localmente, em bases criadas só para validação. **Não foi feito nenhum teste contra o Supabase, o cPanel ou o WHM de produção.**

## 1. Ambiente

| Componente | Versão / tipo |
|---|---|
| MariaDB | 10.6.20 (utilizador só com `ALL PRIVILEGES` na própria base, como uma conta cPanel) |
| MySQL | 8.0.33 (mesmo tipo de utilizador) |
| PostgreSQL de origem | 16.15, com o schema `viralizahost` reconstruído a partir das 39 migrations do repositório |
| Supabase Auth/Storage, Resend | Simulados (`scripts/mysql-migration/test/mock-supabase.mjs`) |
| WHM | Simulado em HTTPS na porta 2087 (`scripts/mysql-migration/test/mock-whm.mjs`) |
| Aplicação | `npm run build` + `next start` com `NEXT_PUBLIC_DATA_BACKEND=mysql`; browser Chrome (Playwright) |

Para reproduzir os testes: `scripts/mysql-migration/test/run-e2e.sh` (as instruções estão no cabeçalho do ficheiro).

## 2. Migração de dados

| Teste | MariaDB 10.6 | MySQL 8.0 |
|---|---|---|
| DDL aplicado 2 vezes (idempotente): 37 tabelas, 50 chaves estrangeiras, CHECKs | ✅ | ✅ |
| `check` sem diferenças de schema entre origem e destino | ✅ | ✅ |
| `import` de ~1 330 linhas sintéticas (acentos, emoji, aspas, `\`, microssegundos com fusos +01/-03/+05:30, DECIMAL até 9 999 999 999,99, JSON aninhado, arrays, NULL) | ✅ | ✅ |
| `validate`: 37 tabelas idênticas linha a linha (hash por chave primária), 0 relações órfãs, todas as somas DECIMAL iguais (por moeda/estado em faturas, pagamentos e encomendas) | ✅ | ✅ |
| `import` repetido: sem duplicados, validação OK | ✅ | ✅ |
| Importação morta a meio (`kill -9`) → validação falha → `import --resume` conclui sem duplicados → validação OK | ✅ | — (testado em MariaDB) |
| Sincronização final com alterações na origem (linhas novas, alteradas e apagadas) → `import --prune` → validação OK | ✅ | — (testado em MariaDB) |
| `site_home_hero` (modo vídeo, URL com acentos, tamanho) preservado | ✅ | ✅ |
| Rollback `reverse` (MySQL → PostgreSQL) com papel **sem superutilizador**, como o `postgres` do Supabase: registos criados, alterados e apagados depois da troca voltam ao PostgreSQL, os triggers ficam desligados durante a cópia (o número do ticket não é recalculado) e são religados; validação OK | ✅ | — |
| Exportação/importação dos dados de base das migrations (planos, produtos, banners das páginas, câmbios, faturação, topo) e validação | ✅ | ✅ |

### Migração sem acesso ao painel do Supabase (API REST + chave de serviço)

Testado contra o PostgREST 12.2.8, o mesmo motor da API REST do Supabase, ligado a uma cópia dos dados de teste. Usa uma chave `service_role` e o acesso anónimo é recusado.

| Teste | MariaDB 10.6 |
|---|---|
| `export`: 37 tabelas → JSON (ficheiros 600, pasta 700); decimais e bigint lidos como texto exato; microssegundos preservados | ✅ |
| Paginação acima de 1 000 linhas (2 640 linhas em `activity_logs`) | ✅ |
| `check` / `import` / `validate --from=<snapshot>` → VALIDAÇÃO OK; validação cruzada direta contra o PostgreSQL de origem → OK | ✅ |
| Sincronização final: a validação deteta linhas novas, alteradas (incluindo +0,07 nos totais financeiros) e apagadas; `import --prune` → OK | ✅ |
| Importação morta a meio (`kill -9`, `activity_logs` 1 811/2 640) → `import --resume` → OK | ✅ |
| `reverse --prune` pela API: só linhas novas ou alteradas são enviadas (2 tickets novos com os mesmos números, 1 fatura alterada, 2 notificações apagadas); validação direta ignorando `updated_at` → OK | ✅ |
| Leitura das credenciais do `.env.local` com `node --env-file`, incluindo uma senha com `#`, `$`, `"` e `=` | ✅ |
| Modo de ligação direta (`SOURCE_PG_URL`) continua a funcionar depois da reorganização do script | ✅ |

## 3. Fluxos da aplicação em modo MySQL

Resultado: **MariaDB 10.6 — 155/155** · **MySQL 8.0 — 155/155**. Em ambos os casos a execução partiu de uma base nova.

### Site público

| Verificação | MariaDB | MySQL |
|---|---|---|
| Página inicial abre com o carrossel | ✅ | ✅ |
| Pesquisa de domínios mostra resultados | ✅ | ✅ |
| Página pública /dominios abre | ✅ | ✅ |
| Página pública /hospedagem-de-sites abre | ✅ | ✅ |
| Página pública /email-corporativo abre | ✅ | ✅ |
| Página pública /checkout?tld=.com&domain=teste.com abre | ✅ | ✅ |
| Catálogo de produtos (MySQL) com características | ✅ | ✅ |

### Autenticação e conta

| Verificação | MariaDB | MySQL |
|---|---|---|
| Registo cria perfil + cliente no MySQL (papel client, nome com acentos) | ✅ | ✅ |
| Dashboard do cliente abre após registo | ✅ | ✅ |
| Registo com metadata role=admin não cria administrador | ✅ | ✅ |
| Cliente não consegue alterar o próprio role (403) | ✅ | ✅ |
| Login com senha errada é recusado | ✅ | ✅ |
| Login com email e senha | ✅ | ✅ |
| Pedido de recuperação chega ao Supabase Auth | ✅ | ✅ |
| Recuperação de conta: login com a nova senha | ✅ | ✅ |
| Definições carrega o perfil do MySQL | ✅ | ✅ |
| Definições grava o nome no MySQL | ✅ | ✅ |

### Portal do cliente

| Verificação | MariaDB | MySQL |
|---|---|---|
| Admin: "Popular conteúdo padrão" preenche as tabelas do site no MySQL | ✅ | ✅ |
| Encomenda com domínio e comprovativo (RPC create_order) | ✅ | ✅ |
| Encomenda grava orders, order_items, services e domains | ✅ | ✅ |
| Fatura criada: número VH-AAAAMM-0001, em análise, AKZ, total certo, 2 itens | ✅ | ✅ |
| Segunda encomenda sem comprovativo → fatura VH-AAAAMM-0002 pendente | ✅ | ✅ |
| Preço adulterado no carrinho é recusado | ✅ | ✅ |
| Lista de faturas (RPC get_client_invoices) com itens da encomenda | ✅ | ✅ |
| Resumo financeiro do cliente (pendente = 2.ª fatura, em análise = 1.ª) | ✅ | ✅ |
| Página de faturas mostra os números das faturas | ✅ | ✅ |
| Detalhe da fatura abre | ✅ | ✅ |
| PDF da fatura é gerado | ✅ | ✅ |
| Intenção de pagamento cria registo em payments | ✅ | ✅ |
| Comprovativo de pagamento: ficheiro no Storage, payments atualizado e fatura com comprovativo | ✅ | ✅ |
| Ticket criado com número VH-TKT-2026-000001 e primeira mensagem | ✅ | ✅ |
| Segundo ticket → VH-TKT-AAAA-000002 | ✅ | ✅ |
| Cliente responde ao ticket | ✅ | ✅ |
| Página de tickets lista os tickets do cliente | ✅ | ✅ |

### Isolamento entre clientes e permissões

| Verificação | MariaDB | MySQL |
|---|---|---|
| Cliente B não vê registos de outros em invoices | ✅ | ✅ |
| Cliente B não vê registos de outros em orders | ✅ | ✅ |
| Cliente B não vê registos de outros em tickets | ✅ | ✅ |
| Cliente B não vê registos de outros em ticket_messages | ✅ | ✅ |
| Cliente B não vê registos de outros em payments | ✅ | ✅ |
| Cliente B não vê registos de outros em services | ✅ | ✅ |
| Cliente B não vê registos de outros em domains | ✅ | ✅ |
| Cliente B não vê registos de outros em order_items | ✅ | ✅ |
| Cliente B não vê registos de outros em invoice_items | ✅ | ✅ |
| Cliente B não vê registos de outros em notifications | ✅ | ✅ |
| Cliente B só vê o próprio perfil | ✅ | ✅ |
| Cliente B não consegue alterar faturas de outro cliente | ✅ | ✅ |
| Cliente não consegue escrever conteúdo do site (correção de permissões) | ✅ | ✅ |
| API de faturas do cliente B devolve 0 faturas | ✅ | ✅ |
| Cliente B não abre fatura do cliente A (API) | ✅ | ✅ |
| Cliente B não abre ticket do cliente A (API) | ✅ | ✅ |
| Cliente B não responde a ticket do cliente A | ✅ | ✅ |
| Cliente não acede às APIs de administração | ✅ | ✅ |
| Visitante anónimo não lê perfis nem faturas | ✅ | ✅ |
| /api/db exige o cabeçalho anti-CSRF | ✅ | ✅ |

### Painel administrativo

| Verificação | MariaDB | MySQL |
|---|---|---|
| Lista de encomendas com itens e cliente | ✅ | ✅ |
| Aprovar encomenda (RPC approve_order): encomenda, serviços, domínio e fatura paga | ✅ | ✅ |
| Rejeitar encomenda sem domínio (RPC reject_order) | ✅ | ✅ |
| Admin responde e cria nota interna | ✅ | ✅ |
| Cliente vê a resposta mas não a nota interna | ✅ | ✅ |
| API de ticket do cliente não devolve a nota interna | ✅ | ✅ |
| Página /admin abre sem erro | ✅ | ✅ |
| Página /admin/financial abre sem erro | ✅ | ✅ |
| Página /admin/orders abre sem erro | ✅ | ✅ |
| Página /admin/clients abre sem erro e mostra "cliente.a@exemplo.ao" | ✅ | ✅ |
| Página /admin/tickets abre sem erro e mostra "VH-TKT-2026-000001" | ✅ | ✅ |
| Página /admin/site/banners abre sem erro | ✅ | ✅ |
| Página /admin/email-logs abre sem erro | ✅ | ✅ |
| Resumo financeiro do admin responde | ✅ | ✅ |
| Lista de clientes (admin) | ✅ | ✅ |
| Admin cria, desativa e apaga banner (browser → /api/db) | ✅ | ✅ |
| Upload de imagem de banner para o Storage | ✅ | ✅ |
| Upload de foto da equipa para o Storage | ✅ | ✅ |
| Admin envia email de recuperação ao cliente | ✅ | ✅ |
| Admin define senha do portal e o cliente entra com ela | ✅ | ✅ |

### Topo da página inicial (vídeo/carrossel)

| Verificação | MariaDB | MySQL |
|---|---|---|
| Página Topo da Página Inicial abre (lê site_home_hero do MySQL) | ✅ | ✅ |
| Publicar vídeo grava no MySQL | ✅ | ✅ |
| Página inicial mostra o vídeo no mesmo espaço (desktop 1440×833) | ✅ | ✅ |
| Página inicial mostra o vídeo em mobile (390×528) | ✅ | ✅ |
| Voltar ao carrossel: a página inicial mostra o carrossel | ✅ | ✅ |

### Integração WHM/cPanel

| Verificação | MariaDB | MySQL |
|---|---|---|
| Configurar servidor WHM grava em servers com token cifrado | ✅ | ✅ |
| Ler configuração WHM (sem expor o token) | ✅ | ✅ |
| Sincronizar contas do WHM (listaccts) → whm_accounts | ✅ | ✅ |
| Conta cPanel ligada ao cliente (automática pelo email ou manual) | ✅ | ✅ |
| Lista de contas WHM no painel (filtros, paginação e relações) | ✅ | ✅ |
| Filtros "ligadas/não ligadas" (is / not is null) coincidem com a base | ✅ | ✅ |
| Suspender e reativar conta cPanel (WHM + MySQL) | ✅ | ✅ |
| SSO para cPanel devolve URL e regista auditoria | ✅ | ✅ |
| Detalhes da conta cPanel do cliente | ✅ | ✅ |
| Sincronizar conta do cliente | ✅ | ✅ |
| Mapeamento de pacotes WHM | ✅ | ✅ |
| Página Servidores → Contas WHM abre e lista contas | ✅ | ✅ |
| Cliente só vê a própria conta WHM | ✅ | ✅ |
| Página Alojamento do cliente abre | ✅ | ✅ |
| Cron /api/cron/whm-sync: recusa sem segredo e sincroniza com segredo | ✅ | ✅ |

### RPCs, agente de IA e email de faturas

| Verificação | MariaDB | MySQL |
|---|---|---|
| RPC check/setup_product_catalog (catálogo semeado como no PostgreSQL) | ✅ | ✅ |
| RPC check/setup_banner_pages | ✅ | ✅ |
| RPC reconcile_unprovisioned_orders cria serviços em falta | ✅ | ✅ |
| Envio de fatura por email (PDF anexado) e registo emailed_at no MySQL | ✅ | ✅ |
| Agente (client): getPlans | ✅ | ✅ |
| Agente (client): getProducts | ✅ | ✅ |
| Agente (client): getProductCategories | ✅ | ✅ |
| Agente (client): getDomainPrices | ✅ | ✅ |
| Agente (client): getEmailPlans | ✅ | ✅ |
| Agente (client): getCompanyInfo | ✅ | ✅ |
| Agente (client): getPaymentMethods | ✅ | ✅ |
| Agente (client): getMyProfile | ✅ | ✅ |
| Agente (client): getMyServices | ✅ | ✅ |
| Agente (client): getMyHosting | ✅ | ✅ |
| Agente (client): getCpanelAccess | ✅ | ✅ |
| Agente (client): getMyDomains | ✅ | ✅ |
| Agente (client): getMyEmails | ✅ | ✅ |
| Agente (client): getMyInvoices | ✅ | ✅ |
| Agente (client): getMyPayments | ✅ | ✅ |
| Agente (client): getMyTickets | ✅ | ✅ |
| Agente (client): getTicketMessages | ✅ | ✅ |
| Agente (client): createTicket | ✅ | ✅ |
| Agente (client): replyToTicket | ✅ | ✅ |
| Agente (client): getMyOrders | ✅ | ✅ |
| Agente (client): getInvoiceDetails | ✅ | ✅ |
| Agente (client): closeTicket | ✅ | ✅ |
| Agente (client): reopenTicket | ✅ | ✅ |
| Agente (client): getPaymentInstructions | ✅ | ✅ |
| Agente (client): sendInvoiceToCustomer | ✅ | ✅ |
| Agente (admin): getPlans | ✅ | ✅ |
| Agente (admin): getProducts | ✅ | ✅ |
| Agente (admin): getProductCategories | ✅ | ✅ |
| Agente (admin): getDomainPrices | ✅ | ✅ |
| Agente (admin): getEmailPlans | ✅ | ✅ |
| Agente (admin): getCompanyInfo | ✅ | ✅ |
| Agente (admin): getPaymentMethods | ✅ | ✅ |
| Agente (admin): getMyProfile | ✅ | ✅ |
| Agente (admin): getMyServices | ✅ | ✅ |
| Agente (admin): getMyHosting | ✅ | ✅ |
| Agente (admin): getCpanelAccess | ✅ | ✅ |
| Agente (admin): getMyDomains | ✅ | ✅ |
| Agente (admin): getMyEmails | ✅ | ✅ |
| Agente (admin): getMyInvoices | ✅ | ✅ |
| Agente (admin): getMyPayments | ✅ | ✅ |
| Agente (admin): getMyTickets | ✅ | ✅ |
| Agente (admin): getTicketMessages | ✅ | ✅ |
| Agente (admin): createTicket | ✅ | ✅ |
| Agente (admin): replyToTicket | ✅ | ✅ |
| Agente (admin): getMyOrders | ✅ | ✅ |
| Agente (admin): getInvoiceDetails | ✅ | ✅ |
| Agente (admin): closeTicket | ✅ | ✅ |
| Agente (admin): reopenTicket | ✅ | ✅ |
| Agente (admin): getPaymentInstructions | ✅ | ✅ |
| Agente (admin): sendInvoiceToCustomer | ✅ | ✅ |
| Agente (admin): adminSearchClient | ✅ | ✅ |
| Agente (admin): adminGetTicketStats | ✅ | ✅ |
| Agente (admin): adminGetConversations | ✅ | ✅ |
| Agente (admin): adminGetClientServices | ✅ | ✅ |
| Agente (admin): adminGetFinancialSummary | ✅ | ✅ |
| Envio de fatura pelo agente grava invoice_send_logs/email_logs e o estado da fatura | ✅ | ✅ |

### Global

| Verificação | MariaDB | MySQL |
|---|---|---|
| Nenhum pedido ao PostgREST em modo MySQL | ✅ | ✅ |

## 4. Regressão do modo Supabase (rollback por configuração)

Compilação com `NEXT_PUBLIC_DATA_BACKEND` por definir (= `supabase`), contra o Supabase simulado com PostgREST: os 27 testes de ontem do vídeo/carrossel passam (27/27) e `/api/db` responde 404 (desativado).

## 5. Ainda por validar (não foi possível testar aqui)

- **Exportação real do Supabase de produção** (`export` pela API REST, ou `SOURCE_PG_URL`). Sem acesso, o schema foi reconstruído a partir das migrations. Se a produção tiver colunas ou tabelas fora das migrations, o `check` mostra-as e a importação não arranca até serem corrigidas.
- **Versão do MySQL/MariaDB do cPanel**: testado em MariaDB 10.6 e MySQL 8.0. Versões mais antigas (MariaDB < 10.6, MySQL < 8.0.16) não foram testadas.
- **Supabase Auth e Storage reais**: login, recuperação (email real com link), uploads e URLs assinados foram testados contra o simulador, que segue a mesma API.
- **WHM real**: testadas as funções que a app usa (version, listaccts, accountsummary, suspendacct, unsuspendacct, create_user_session, …) contra o simulador. Não foram testados a criação real de contas nem o UAPI de emails/bases de dados.
- **Envio real pelo Resend**: testado com o simulador (`RESEND_BASE_URL`). O webhook `/api/webhooks/resend` (verificação de assinatura) não foi testado.
- **Chat do agente de IA** (`/api/agent/chat`): o modelo não foi chamado. As 31 ferramentas do agente, que fazem as consultas à base, foram executadas diretamente como cliente e como admin.
- **Desempenho com o volume real de dados** e concorrência de vários utilizadores (testado com dezenas a centenas de linhas por tabela).
