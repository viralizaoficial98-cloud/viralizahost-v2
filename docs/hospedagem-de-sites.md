# /hospedagem-de-sites — página simplificada

## Estrutura (ordem fixa)

O cabeçalho global aparece no topo da página e o rodapé global no fim.

| # | Secção | Âncora | Componente |
|---|---|---|---|
| 0 | **Hero** (único H1) | — | `ServiceHero` com a configuração de **Painel → Site → Banners de páginas** (`page_slug = hospedagem-de-sites`): título, subtítulo, etiqueta, destaques, botões, imagem e cor. Sem configuração activa, usa os textos por omissão anteriores. |
| 1 | Hospedagem de sites — Escolha o seu plano (H2) | `#planos` | `HostingPlansSection` (**só** planos de hospedagem de sites) |
| 2 | Todos os planos incluem | `#incluido` | `IncludedFeatures` |
| 3 | Crie e publique o seu site | `#crie-o-seu-site` (opções `#wordpress`, `#editor-visual`, `#site-pela-equipa`) | `BuildSiteSection` |
| 4 | Segurança para o seu site | `#seguranca` | `SecuritySection` |
| 5 | Comece hoje (botão → `#planos`) | — | `FinalCTA` |

### Planos WordPress

A grelha de planos WordPress **não é apresentada nesta página**:

- Os registos do catálogo (`category = 'wordpress'`), os preços e os percursos de compra (`/comprar/wp-…`) continuam iguais.
- `/construtor-wordpress` continua a mostrar os planos WordPress Builder.
- «Use WordPress» é um bloco informativo, sem botão.

### Links e encaminhamentos

- O encaminhamento `/hospedagem-wordpress` aponta para `/hospedagem-de-sites#wordpress` (308): o bloco «Use WordPress».
- O link «Hospedagem WordPress» do rodapé aponta para `#wordpress`.
- Não há links para `#planos-wordpress`.
- Os cartões de planos carregam depois da página e empurram o conteúdo para baixo. Quando terminam de carregar, a página volta a posicionar a âncora do endereço (ex.: `#wordpress`), para o visitante ficar no bloco certo.
- Não há links guardados na base de dados para âncoras desta página.

### Preços e compra

Preços, ciclos, descontos e «Comprar agora» vêm do catálogo (`/api/products?category=hosting`), sem alterações. O percurso continua a ser `/comprar/<slug>` → domínio → duração → carrinho.

## Conteúdo e o que foi confirmado

| Afirmação | Fonte | Na página |
|---|---|---|
| SSL grátis | `product_features` dos 3 planos de hospedagem («SSL grátis») | Nota gerada a partir do catálogo: «incluído em todos os planos de hospedagem» só quando todos os planos à venda o incluem; caso contrário, lista só esses planos |
| cPanel, NVMe SSD, e-mail no domínio, migração gratuita, suporte 24/7 | Presentes em todos os planos de hospedagem do catálogo | «Todos os planos incluem» |
| Cópias de segurança (semanal/diária) | Catálogo (frequência varia por plano) | Em «Segurança», com «a frequência depende do plano» |
| Conta cPanel própria por cliente | Integração WHM | «Cada conta no seu espaço» |
| Criador de sites e Construtor WordPress | Páginas `/criador-de-sites` e `/construtor-wordpress` | Opção «Crie com um editor visual», com descrição genérica |

As secções criadas pela equipa (2 a 5) não usam afirmações por confirmar (LiteSpeed «até 6x», «uptime 99,9%», «Proteção DDoS», «WordPress pré-instalado»).

A **hero** mostra o conteúdo configurado no painel. Os textos e destaques actuais (ex.: «LiteSpeed Enterprise», «Uptime 99.9%») devem ser revistos pela equipa em «Banners de páginas» se não estiverem confirmados.

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

- a hero: título, subtítulo, imagem e botão vêm de «Banners de páginas», e alterar o título no painel altera a página;
- que a grelha de planos WordPress desapareceu e não há links para `#planos-wordpress`, mantendo os planos WordPress no catálogo e o percurso `/comprar/wp-…`;
- a ordem das secções, sem outros blocos, e o H1 único (na hero);
- os títulos das secções;
- os planos do catálogo, incluindo os WordPress;
- que «Todos os planos incluem» só tem benefícios comuns e não repete SSL nem cópias;
- que não aparecem afirmações por confirmar;
- os links e as âncoras, e que «Comece hoje» leva a `#planos`;
- o encaminhamento 308 para `#wordpress`, que abre o bloco «Use WordPress» no ecrã;
- que a nota de SSL acompanha o catálogo (o teste retira o SSL de um plano e repõe-no);
- o percurso «Comprar agora» → domínio → duração, com o preço do catálogo;
- que não há deslocamento horizontal.

Capturas: `docs/capturas/hospedagem-de-sites/`.

## Publicação

Não há migração. Usar o bloco de publicação de `docs/vps-ciclos-submenus.md` (backup, código, build, reinício **só** de `viralizahost`, confirmação do commit em `/api/version`). Depois, verificar `/hospedagem-de-sites` e `/hospedagem-wordpress` (308 → `#wordpress`) em desktop e telemóvel. **A publicação fica para aprovação.**
