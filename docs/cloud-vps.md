# Cloud VPS (Hostinger) — módulo completo

Estado entregue: **solicitação mediante aprovação** (`request_only`) activa após a migração 24. A **venda automática** está
implementada e testada só contra a API Hostinger **simulada**, e fica **bloqueada** até autorização expressa. Nenhuma compra real
acontece sem `VPS_LIVE_PURCHASES=1` no processo de produção **e** autorização explícita registada no painel.

## 1. Diagnóstico (antes desta entrega)

| Área | Situação encontrada | Resultado |
|---|---|---|
| Integração | Página única `/admin/settings/integrations/hostinger-vps` (token, teste, localizações/SO). «Ligado» aparecia mesmo com consultas parcialmente falhadas. | Mantida (reutilizada) e ligada à nova área **Cloud VPS**; o teste passa a registar o resultado **por consulta** e só indica «ligado» se as 4 consultas essenciais passarem. |
| Venda | `/comprar` comprava directamente após o pagamento (sem aprovação, sem limite de gasto, sem modos). | 4 modos comerciais aplicados no servidor; pedidos com aprovação; autorização de aquisição explícita; limite mensal; prevenção de duplicados. |
| Preços | Custos em USD introduzidos à mão; sem câmbio, sem custo de renovação, sem verificação de sustentabilidade. | Sincronização dos custos do catálogo BRL (1.º período **e** renovação), câmbio BRL→AOA, taxas, acréscimo (inicial +100%), extras, preço sugerido e bloqueio de ciclos insustentáveis. |
| Inventário | VMs existentes desconhecidas pelo sistema; a VM de produção 1564781 não estava protegida. | Importação de VMs (sempre **não associadas**); associação explícita; **VM 1564781 protegida permanentemente** (código + base). |
| SO / aplicações | Lista simples, sem categorias nem publicação por plano. | 9 categorias, pesquisa, filtros, paginação, selecção múltipla, publicação, disponibilidade por plano, custo de licença. |
| Área do Cliente | Estado, IP, ligar/desligar/reiniciar, senha root, chave SSH, reinstalar. | + detalhes completos, IPv6, métricas reais, backups, snapshot, firewall, hostname, upgrade/renovação; entrega só com acesso definido. |
| Páginas públicas | Botões «Comprar agora» directos; páginas n8n/OpenClaw/Evolution/Viraliza AI com preços próprios. | Identidade preservada; botões levam ao **configurador** com a aplicação pré-seleccionada (só se existir template oficial publicado). |

## 2. Área administrativa — Painel → Cloud VPS (`/admin/cloud-vps`)

| Secção | Rota | Conteúdo |
|---|---|---|
| Visão geral | `/admin/cloud-vps` | KPIs (VPS total/internos/comerciais/activos/suspensos/em aprovisionamento; pedidos pendentes/aprovados; facturação mensal; custos do fornecedor; margem bruta; renovações próximas; falhas), gráficos, alertas. |
| Servidores VPS | `/servidores` | Inventário sincronizado, pesquisa/filtros/paginação, marcar interno, associar/desassociar cliente. VM protegida sem acções. |
| Solicitações | `/solicitacoes` | Pedidos, verificação ao fornecedor (produto, template, datacenter, preço), acções do fluxo, histórico. |
| Planos e preços | `/planos` | Produto/itens Hostinger, especificações, custos 1.º período e renovação, câmbio, extras, preço sugerido vs. actual, sustentabilidade, modo manual/automático. |
| Fornecedores Cloud | `/fornecedores` | Token (nunca devolvido), teste por consulta, histórico de sincronizações, métodos de pagamento **mascarados**, subscrições e renovações, limite de gasto, operações on/off. |
| SO e aplicações | `/sistemas` | Templates reais da API, categorias, publicação, planos compatíveis, licenças. Não publicados não aparecem ao cliente. |
| Datacenters | `/datacenters` | Localizações reais, activação e ordem. |
| Aprovisionamento | `/aprovisionamento` | Operações de compra, estados, 202, conciliação («Conciliar tudo»), revisão manual. |
| Custos e rentabilidade | `/custos` | Custo inicial/renovação, venda, lucro bruto, próxima cobrança Hostinger vs. próxima cobrança ao cliente. |
| Configurações | `/configuracoes` | Modo comercial, finanças, extras (backups/licenças/suporte), limite mensal, operações. |

## 3. Modos comerciais

| Modo | Página pública | Pedidos | `/comprar` e checkout | Compra no fornecedor |
|---|---|---|---|---|
| `disabled` | planos visíveis, compra indisponível | recusados | recusado (`vps_disabled`) | bloqueada |
| `test` | configurador só para administradores | só administradores | só administradores (`vps_test_admin_only`) | só com a API simulada / modo de teste |
| `request_only` (**inicial**) | «Configurar VPS» → «Enviar pedido» | aceites | recusado (`vps_request_only`); só a encomenda criada pelo painel a partir do pedido aprovado (`vps_request_mismatch` se alterada) | só após pagamento **e** «Autorizar aquisição» |
| `automatic` | compra directa | — | permitido | automática após pagamento; exige o texto «AUTORIZO VENDA AUTOMATICA VPS» e, em modo `live`, `VPS_LIVE_PURCHASES=1` |

Regras no servidor: `src/lib/vps/cloud.ts` (`vpsGate`), `src/lib/commerce/quote.ts` (cotação e encomenda),
`src/lib/vps/provisioning.ts` (motor). Ciclos cujo preço de renovação de venda fica abaixo do custo de renovação × câmbio × taxas
são recusados (`vps_cycle_unsustainable`).

## 4. Fluxo

```
Seleção → Configuração (/servidor-vps/configurar) → Solicitação (VH-VPS-…) → Revisão → Aprovação
  → Enviar para pagamento (encomenda criada pelo painel, preço aceite) → Pagamento confirmado
  → Autorizar aquisição («AUTORIZO AQUISICAO») → Compra (POST /api/vps/v1/virtual-machines)
  → Aprovisionamento (202 → conciliação) → Verificação (running + especificações) → Acesso definido pelo cliente → Entregue
```

Antes da compra valida-se: autorização, pagamento do cliente, preço e moeda actuais do item vs. custo esperado e limite,
limite mensal de gasto, produto, template e datacenter activos, e ausência de compra anterior para o serviço.

- **Sem chave de idempotência na API**: uma resposta inconclusiva (tempo esgotado, 5xx, rede) **nunca é repetida
  automaticamente**. A conciliação procura a VM pelo `hostname` único ou pelo `subscription_id`; sem confirmação → revisão manual.
- **HTTP 202**: pagamento em processamento no fornecedor; a conciliação continua até encontrar a VM.
- Estados persistentes em `vps_requests`, `vps_request_events`, `vps_provider_orders` e `services`.

## 5. Inventário e VM interna protegida

- «Sincronizar» importa as VMs do fornecedor para `vps_instances` **sem dono**. Associar a um cliente é uma acção explícita do
  administrador (cria um serviço `import` em modo manual). VMs internas nunca são associadas.
- **VPS ID 1564781** (KVM 4, 16 GB, 200 GB, AlmaLinux 9 + cPanel — produção ViralizaHost): `PROTECTED_VM_IDS` em
  `src/lib/vps/cloud.ts` **e** `vps_instances.is_protected = 1`. O backend recusa associação comercial, ligar/desligar/reiniciar,
  reinstalar, senha, chaves SSH, backups, snapshots, firewall, eliminação e conciliação sobre esta VM — mesmo que a
  base seja alterada, a lista em código prevalece.

## 6. Área do Cliente (`/vps`)

Mostra estado, IPv4/IPv6, hostname, plano, CPU/RAM/disco/tráfego, SO, datacenter, activação, próxima renovação, histórico e
métricas reais (`/metrics`). Operações reais via API: ligar, desligar, reiniciar, senha root, chaves SSH, reinstalar,
backups (listar/restaurar com confirmação), snapshot (criar/restaurar/apagar com confirmação), firewall (`vh-<vmId>`: regras,
activar/desactivar), upgrade e renovação (pedido), ticket. Operações não suportadas pela API (consola, compra de extras) aparecem
como **indisponíveis**, nunca com falso sucesso.

**Entrega segura do acesso:** a compra não envia palavra-passe. Após a VM estar `running`, o cliente vê «Defina o acesso» e define
a senha root ou a chave SSH (pode indicar a chave pública no configurador, enviada em `ssh_keys`). Nenhuma senha é enviada por
e-mail nem guardada. O serviço só fica «entregue» com `access_configured_at` preenchido. Todas as operações validam a propriedade
do serviço (sem acesso horizontal) e têm limite de taxa (`VPS_CLIENT_RATE_LIMIT`, por omissão 120/10 min).

## 7. Finanças

Preço sugerido = custo × câmbio × (1 + taxas bancárias% + impostos%) × (1 + acréscimo%) + extras × meses, arredondado às centenas
de Kz. Estratégia inicial: **+100%** sobre o custo, usando a **renovação** como referência do preço regular. O painel mostra o
custo total do ciclo, o equivalente mensal e o pagamento inicial; edição manual sempre possível.

Distinções: **cancelamento comercial** (serviço), **suspensão técnica** (VM parada — *não pára a cobrança Hostinger*) e
**desactivação da renovação** no fornecedor (não é feita automaticamente). Não há cancelamentos destrutivos automáticos.
Alertas no painel (Visão geral): renovações de clientes e da Hostinger nos próximos 30 dias (com estado da renovação automática),
custos desconhecidos, câmbio por definir, falhas de aprovisionamento; margem por ciclo e ciclos insustentáveis em Planos e Custos.

## 8. Base de dados — migração `20261210_24_cloud_vps.sql`

- Tabelas: `vps_requests`, `vps_request_events`, `vps_instances` (VM 1564781 semeada como interna e protegida), `vps_sync_runs`.
- Colunas: `product_prices.provider_renewal_minor`; `products.provider_finance` (JSON); `vps_provider_orders.access_method`,
  `access_configured_at`, `client_hostname`, `firewall_id`.
- Dados: `commercialMode = request_only` se não definido; encomendas VPS activas existentes marcadas `access_method='legacy'`
  (continuam entregues). Idempotente; não apaga nada.

## 9. Configuração (variáveis — nenhuma nova flag)

| Variável | Uso |
|---|---|
| `VPS_LIVE_PURCHASES` | **Não definir** até aprovação. Sem ela, compras reais ficam em revisão manual. |
| `VPS_PROVIDER_TIMEOUT_MS` | Tempo máximo por pedido à API (existente). |
| `VPS_REQUEST_RATE_LIMIT` / `VPS_CLIENT_RATE_LIMIT` | Limites de taxa (opcionais; omissão segura). Só o ensaio os aumenta. |

## 10. Segurança

- Token Hostinger só no servidor (cifrado com `WHM_ENCRYPTION_KEY`), nunca devolvido ao navegador nem registado.
- A conta Hostinger nunca é exposta ao cliente; os pedidos à API não levam e-mail, nome, comprovativo nem senha do cliente.
- Todas as rotas `/api/admin/cloud-vps` exigem papel administrativo; rotas do cliente exigem sessão e validam a propriedade.
- Limites de taxa em pedidos, cotações e operações; campo isco no formulário.
- A conciliação corre só por acção do administrador (sem endpoint de cron exposto); os crons existentes continuam protegidos por segredo.
- Auditoria (`audit_logs`) de todas as acções administrativas; histórico de pedidos e sincronizações.
- Métodos de pagamento mascarados (`•••• 1234`); segredos nunca nas respostas.
- Operações destrutivas exigem texto de confirmação (`REINSTALAR`, `RESTAURAR`, `APAGAR`, `AUTORIZO AQUISICAO`…).
- VM de produção protegida em código e na base (secção 5).

## 11. Testes (ensaio, API simulada)

`scripts/mariadb/rehearsal/cloud-vps-e2e.cjs` (132 verificações, desktop + iPhone): página pública, planos, configurador, SO,
datacenters, pedidos, aprovação, checkout, pagamento, compra simulada, 202, conciliação, duplicados, limites financeiros, entrega,
Área do Cliente, operações, isolamento entre clientes, protecção da VM interna, falhas de rede, responsividade. Os ensaios VPS
anteriores (`vps-purchase`, `vps-install`, `vps-cycles`) correm em modo `automatic` e repõem o modo no fim.
Capturas: `docs/capturas/cloud-vps/`.

## 12. Publicação (feita pela equipa — nunca automática)

1. Cópia de segurança da base de produção (`mysqldump`).
2. Em `/var/www/viralizahost-main`: `git fetch && git checkout main && git pull` (depois do merge do PR); copiar para
   `/var/www/viralizahost` segundo o procedimento habitual (sem tocar em `.env.local`).
3. `node --env-file=.env.local scripts/mariadb/migrate-schema.mjs --dry-run` → confirmar só a migração 24 pendente; depois sem `--dry-run`.
4. **Não** definir `VPS_LIVE_PURCHASES`.
5. `npm ci && npm run build && pm2 restart viralizahost`.
6. Verificar: Painel → Cloud VPS → Fornecedores → «Testar ligação» (7 consultas, essenciais a verde) → «Sincronizar inventário»
   (VM 1564781 aparece **interna e protegida**); `/servidor-vps` → «Configurar VPS»; Configurações → modo `request_only`.

## 13. Reversão

- Código: reverter o merge e `pm2 restart viralizahost`. As tabelas novas ficam sem uso.
- Desligar sem reverter: Cloud VPS → Configurações → «Desactivado».
- A migração não apaga dados; as colunas novas são opcionais para o código anterior.
- Nada é comprado, parado ou alterado na Hostinger pela publicação.

## 14. Limitações reais da API Hostinger

- Sem chave de idempotência na compra (por isso não há repetição automática).
- A palavra-passe gerada na criação não é devolvida (por isso o cliente define o acesso).
- Extras (backups diários, licenças cPanel) não são compráveis pela API — tratados como custo/serviço manual.
- Sem consola web/VNC na API pública.
- Alteração de hostname pelo cliente não exposta (o hostname escolhido no configurador é aplicado uma vez na entrega).
- Upgrade de plano não é automatizável pela API: segue como pedido com aprovação.

## 15. Pendente antes da activação comercial

- [ ] Definir o câmbio BRL→AOA (e taxas bancárias/impostos) em Cloud VPS → Configurações.
- [ ] Sincronizar os custos em produção e associar cada plano aos itens **BRL** reais (`hostingercombr-vps-kvm1…kvm8`, ciclos 1 mês / 1 ano / 2 anos).
- [ ] Rever preços sugeridos (+100%) e aplicar; confirmar sustentabilidade de todos os ciclos publicados.
- [ ] Publicar os templates (SO/aplicações) e datacenters desejados; confirmar as páginas n8n/OpenClaw/Evolution/Viraliza AI.
- [ ] Escolher o método de pagamento Hostinger e o limite mensal de gasto.
- [ ] Primeiro pedido real em `request_only` com compra autorizada manualmente, após aprovação expressa e `VPS_LIVE_PURCHASES=1`.
- [ ] Modo automático só depois do anterior, com o texto de autorização registado.
- [ ] Planos Game Panel: **não publicar** (continuam fora do catálogo).

## Capturas

Desktop e iPhone em [`capturas/cloud-vps/`](capturas/cloud-vps/): configurador (01, 02, 17), Área do Cliente (03, 04) e as 10 secções do painel (05–16).
