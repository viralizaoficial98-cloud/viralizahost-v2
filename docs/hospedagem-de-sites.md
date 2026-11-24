# /hospedagem-de-sites — página simplificada

## Estrutura (ordem fixa)

O cabeçalho global aparece no topo da página e o rodapé global no fim.

| # | Secção | Âncora | Componente |
|---|---|---|---|
| 1 | **Hospedagem de sites — Escolha o seu plano** (H1 único) | `#planos`, `#planos-wordpress` | `HostingPlansSection` (`headingAs="h1"`) + `DynamicServicePricing category="wordpress"` |
| 2 | Todos os planos incluem | `#incluido` | `IncludedFeatures` |
| 3 | Crie e publique o seu site | `#crie-o-seu-site` (opções `#wordpress`, `#editor-visual`, `#site-pela-equipa`) | `BuildSiteSection` |
| 4 | Segurança para o seu site | `#seguranca` | `SecuritySection` |
| 5 | Comece hoje (botão → `#planos`) | — | `FinalCTA` |

### O que foi removido

- **Banner (ServiceHero)**: era o H1 e usava a configuração «Banners de páginas» da página `hospedagem-de-sites`. Essa configuração deixa de ter efeito nesta rota.
- **Faixa «Vai usar WordPress?»**: o link passou para o subtítulo da secção 1.
- **Secção autónoma «Hospedagem WordPress optimizada»**:
  - a informação passou para «Use WordPress»;
  - os planos WordPress continuam na secção 1 (`#planos-wordpress`), através do catálogo.

### Links e encaminhamentos actualizados

- O encaminhamento `/hospedagem-wordpress` aponta para `/hospedagem-de-sites#planos-wordpress` (308; antes apontava para `#wordpress`).
- O link «Hospedagem WordPress» do rodapé aponta para `#planos-wordpress`.
- A âncora `#wordpress` continua a existir (opção «Use WordPress»), por isso links antigos não ficam partidos.
- Não há links guardados na base de dados para âncoras desta página (verificado em todas as tabelas de texto).
- O menu principal liga a `/hospedagem-de-sites` sem âncora.

### Preços e compra

Preços, ciclos, descontos e «Comprar agora» / «Escolher plano» vêm do catálogo (`/api/products`), sem alterações. O percurso continua a ser `/comprar/<slug>` → domínio → duração → carrinho.

## Conteúdo e o que foi confirmado

| Afirmação | Fonte | Na página |
|---|---|---|
| SSL grátis | `product_features` dos 3 planos de hospedagem («SSL grátis») | Nota gerada a partir do catálogo: «incluído em todos os planos de hospedagem» só quando todos os planos à venda o incluem; caso contrário, lista só esses planos |
| cPanel, NVMe SSD, e-mail no domínio, migração gratuita, suporte 24/7 | Presentes em todos os planos de hospedagem do catálogo | «Todos os planos incluem» |
| Cópias de segurança (semanal/diária) | Catálogo (frequência varia por plano) | Em «Segurança», com «a frequência depende do plano» |
| Conta cPanel própria por cliente | Integração WHM | «Cada conta no seu espaço» |
| Criador de sites e Construtor WordPress | Páginas `/criador-de-sites` e `/construtor-wordpress` | Opção «Crie com um editor visual», com descrição genérica |

Saíram desta página por não estarem confirmadas: LiteSpeed «até 6x», «uptime 99,9%», «Proteção DDoS» e «WordPress pré-instalado».

### Pendências: não anunciadas por falta de confirmação

1. **SitePad**: o produto não existe no catálogo nem na documentação. Usa-se «editor visual» sem nome, ligado ao criador de sites existente.
2. **Número de modelos («500+»)**: não confirmado; não há número na página.
3. **Imunify360** e os seus recursos (firewall proactiva, remoção automática de malware, WAF para PHP, monitorização em tempo real, proteção contra exploração de vulnerabilidades, reputação de IP): não confirmados. A secção usa descrições genéricas («medidas de proteção contra acessos e tráfego suspeitos»). Se o Imunify360 estiver activo nos servidores, basta acrescentar o nome e os recursos confirmados em `PROTECTION` (`src/components/service/HostingSiteSections.tsx`).
4. **Desenvolvimento de sites pela equipa**: não há produto nem formulário de proposta específico. «Pedir uma proposta» leva a `/suporte/contactar`. Convém confirmar que a equipa presta o serviço, ou criar um produto «sob consulta» para usar o formulário de cotação.
5. **SSL nos planos WordPress**: estes planos não têm características no catálogo, por isso a nota de SSL refere só os planos de hospedagem.

## Ensaio

```bash
BASE_URL=http://localhost:3000 OUT=/tmp/hosting-page node --env-file=.env.local scripts/mariadb/rehearsal/hosting-page-e2e.cjs
```

O ensaio corre em desktop e iPhone e verifica:

- a ordem das secções, sem outros blocos, e o H1 único;
- os títulos das secções;
- os planos do catálogo, incluindo os WordPress;
- que «Todos os planos incluem» só tem benefícios comuns e não repete SSL nem cópias;
- que não aparecem afirmações por confirmar;
- os links e as âncoras, e que «Comece hoje» leva a `#planos`;
- o encaminhamento 308;
- que a nota de SSL acompanha o catálogo (o teste retira o SSL de um plano e repõe-no);
- o percurso «Comprar agora» → domínio → duração, com o preço do catálogo;
- que não há deslocamento horizontal.

Capturas: `docs/capturas/hospedagem-de-sites/`.

## Publicação

Não há migração. Usar o bloco de publicação de `docs/vps-ciclos-submenus.md` (backup, código, build, reinício **só** de `viralizahost`, confirmação do commit em `/api/version`). Depois, verificar `/hospedagem-de-sites` e `/hospedagem-wordpress` (308 → `#planos-wordpress`) em desktop e telemóvel. **A publicação fica para aprovação.**
