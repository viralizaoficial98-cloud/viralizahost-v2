# Presença Global — globo 3D

Na secção «Presença Global» (página inicial e `/sobre`), o mapa plano azul-claro foi substituído por um **globo terrestre 3D**. Os textos, a legenda, os números, a lista de países e o layout exterior da secção ficam como estavam.

O mapa plano anterior **continua no código** e passa a ser a alternativa: sem WebGL, com «poupança de dados», se a textura ou o código 3D falharem, ou se o contexto gráfico se perder.

## O que o utilizador vê

- **Vista inicial:** África e Atlântico, com Angola visível. Portugal, Reino Unido, França, Alemanha, Turquia, Brasil e restante América do Sul aparecem à volta.
- **Visual:**
  - oceanos em azul profundo;
  - continentes com textura de satélite e relevo;
  - luz suave com sombra azulada;
  - brilho solar discreto nos oceanos;
  - halo atmosférico azul;
  - fundo escuro com estrelas dentro da área do globo;
  - amarelo da ViralizaHost nos pontos, nos pulsos e nas rotas.
- **Bandeiras:** cada rótulo (bandeira + código ISO) acompanha as coordenadas durante a rotação. Os rótulos ficam legíveis: quando dois se tocariam, um é afastado e liga-se ao ponto por uma linha fina.
- **Atrás da Terra:** marcadores, rótulos e troços de rotas que ficam do lado oculto desaparecem. Junto ao limbo desvanecem-se e os pontos achatam-se para seguirem a curvatura.
- **Pulsos e rotas:** são as mesmas animações do mapa plano (`gp-pulse`, `gp-ring` e `gp-flow`, com o mesmo tracejado `5 8`). Cada rota é um arco entre a mesma origem e o mesmo destino que antes (25 rotas).
- **Rodar o globo:**
  - arrastar (rato ou dedo);
  - setas do teclado, com o globo focado;
  - cinco botões: ←, →, ↑, ↓ e repor;
  - **clicar num país da lista, ou no rótulo**, roda o globo até ele (os 23 países ficam consultáveis).
- **Telemóvel:** o globo usa `touch-action: pan-y`, por isso o scroll vertical da página fica livre e o arrasto horizontal roda o globo. Para inclinar para norte ou sul há os botões ↑ e ↓, ou a lista de países.
- **Movimento reduzido** (`prefers-reduced-motion`):
  - pulsos, anéis e rotas tracejadas ficam estáticos;
  - a rotação para um país é imediata;
  - não há inércia nem deslize dos rótulos.

## Carregamento e desempenho

- A decisão (WebGL disponível e sem «poupança de dados») é tomada no cliente. Antes disso o servidor entrega só o espaço reservado: altura fixa de `min(132vw, 600px)` no telemóvel e `clamp(440px, 50vw, 620px)` no desktop. Não há salto de layout (verificado no ensaio).
- O código do globo (three.js) e a textura **só são pedidos quando a secção está a menos de 700 px do ecrã**. O ensaio confirma que, até lá, nenhum ficheiro JS do globo nem a textura são descarregados.
- Chunk do globo: 544 KB (135 KB gzip).
- Texturas em `public/textures/`:
  - `earth-blue-marble-2k.jpg`: 0,27 MB, escolhida por omissão;
  - `earth-blue-marble-4k.jpg`: 1,0 MB, escolhida em ecrãs de alta densidade, quando o diâmetro do globo em píxeis do dispositivo é ≥ 900.
- A renderização é por pedido: só desenha quando há movimento. Pára fora do ecrã e com o separador oculto. A resolução fica limitada a 2× de densidade.

## Origem, licença e atribuição

### Textura da Terra

- **Produto:** NASA *Blue Marble* com relevo sombreado e batimetria. É o produto `BlueMarble_ShadedRelief_Bathymetry` do **NASA GIBS** (Global Imagery Browse Services), com origem no **NASA Earth Observatory**.
- **Licença:** imagens da NASA, em geral sem copyright e livres para uso com crédito, **sem sugerir patrocínio ou aprovação da NASA**. Ver as [diretrizes de uso de imagens e media da NASA](https://www.nasa.gov/nasa-brand-center/images-and-media).
- **Atribuição mostrada no site** (canto do globo): «Textura: NASA Earth Observatory (Blue Marble)».
- **Agradecimento recomendado pelo GIBS** (aqui, na documentação): *We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).*

**Como foi obtida (reproduzível).** Os servidores da NASA não estavam acessíveis a partir do ambiente de desenvolvimento. Os níveis de zoom 0–4 do produto vieram do pacote npm `@freetiler/nasa-bluemarble@1.0.17` (MIT), cuja descrição indica ser o produto `BlueMarble_ShadedRelief_Bathymetry` da NASA.

- **Verificação:** o conteúdo corresponde visualmente ao Blue Marble com relevo e batimetria.
- **Limite:** não foi possível confirmar byte a byte contra o GIBS. Se quiser a prova da cadeia, regenere a textura a partir do GIBS (ver abaixo) e substitua os dois ficheiros.

Processamento: junção dos 16×16 tiles do nível 4 (256 px; Web Mercator, 4096²), reprojeção para equirretangular (4096×2048), correção das faixas polares acima de 85° (fora do alcance do Mercator) e exportação em JPEG progressivo (qualidade 82) para 4K e 2K (Lanczos):

```python
# tiles/4/<x>/<y>.jpeg  →  equirretangular 4096×2048
from PIL import Image; import numpy as np, math
n, S = 16, 256
M = Image.new('RGB', (n*S, n*S))
for x in range(n):
    for y in range(n): M.paste(Image.open(f'tiles/4/{x}/{y}.jpeg').convert('RGB'), (x*S, y*S))
W, H = 4096, 2048
lat = np.clip(90 - (np.arange(H) + 0.5) * 180 / H, -85.0511, 85.0511)
yy = np.clip((0.5 - np.log(np.tan(math.pi/4 + np.radians(lat)/2)) / (2*math.pi)) * n*S - 0.5, 0, n*S - 1.001)
# interpolação bilinear em (xs, yy); depois substituir as linhas |lat| > 84,6° pela última linha válida, desfocada
```

**Texturas avaliadas e descartadas:**

- Repositório oficial `nasa/NASA-3D-Resources`, «Earth (A)»: mapa hipsométrico colorido de 1440×720, sem aspeto de satélite.
- Repositório oficial `nasa/NASA-3D-Resources`, «Earth (B)»: fotografia Apollo de um disco, não é uma textura equirretangular.
- Imagens de exemplo do pacote `three-globe`: a origem não está documentada no pacote.

### Software

- **three.js 0.187.0** (MIT), dependência nova, carregada sob demanda. O aviso de licença MIT acompanha o pacote no `node_modules` e no chunk.
- Bandeiras: `flag-icons` (MIT), já existentes em `public/flags/`.

## Coordenadas dos países

A latitude e a longitude partem das **mesmas posições x/y do mapa plano**, pela inversa da sua fórmula (`lon = x/2,7778 − 180`, `lat = 90 − y/2,7778`). Os códigos ISO, os nomes, os lados dos rótulos, as bandeiras e as 25 rotas são os mesmos.

O mapa plano foi desenhado à mão e, num globo realista, **7 pontos cairiam fora do país**. Esses 7 usam a cidade principal:

| País | Onde cairia com as coordenadas antigas | Passa a usar |
|---|---|---|
| Portugal | no mar, ao largo do Algarve | Lisboa |
| Peru | no Pacífico | Lima |
| Uruguai | no Atlântico | Montevideu |
| Hong Kong | no Mar do Sul da China, junto ao Vietname | Hong Kong |
| Malásia | nas Ilhas Riau (Indonésia) | Kuala Lumpur |
| Singapura | em Samatra | Singapura |
| Indonésia | no Mar de Java | Jacarta |

A tabela está em `src/components/landing/globalPresenceData.ts` (`GEO_FIX`).

## Ficheiros

| Ficheiro | O que muda |
|---|---|
| `src/components/landing/GlobalPresenceSection.tsx` | escolhe globo ou mapa plano, carrega o globo só ao aproximar, o clique na lista roda o globo, reduz o movimento |
| `src/components/landing/GlobalPresenceGlobe.tsx` | **novo**: cena 3D, shaders, rotação, camada SVG de pontos, rótulos e rotas, controlos |
| `src/components/landing/globalPresenceData.ts` | **novo**: dados e rótulos partilhados (países, coordenadas, rotas) |
| `public/textures/earth-blue-marble-{2k,4k}.jpg` | **novo**: textura da Terra |
| `package.json`, `package-lock.json` | `three` (dependência) e `@types/three` (desenvolvimento) |
| `scripts/mariadb/rehearsal/global-presence-e2e.cjs`, `run-all.sh` | ensaio da secção |
| `docs/globo-presenca-global.md`, `docs/capturas/presenca-global-globo/` | esta documentação e as capturas |

## Testes

`global-presence-e2e.cjs`: 107 verificações em desktop e iPhone, estáveis em execuções repetidas.

- **Carregamento:**
  - nenhum código 3D nem textura enquanto a secção está longe;
  - espaço reservado sem salto de layout;
  - textura 2K por omissão e 4K em ecrãs 2×.
- **Vista inicial:** Angola visível, Atlântico, marcadores atrás da Terra ocultos.
- **Países:** os 23 ficam centrados ao clicar na lista (ponto e rótulo visíveis).
- **Rótulos:** legíveis e sem sobreposição em todas as 23 vistas.
- **Animações:** pulsos, anéis e rotas tracejadas animados, com o mesmo `strokeDashoffset`.
- **Interação:** arrasto, setas, botão «repor», hover e destaque.
- **Telemóvel:** `touch-action: pan-y`, sem deslocamento horizontal.
- **Acessibilidade:** `prefers-reduced-motion`.
- **Alternativas:** sem WebGL e textura em falta → mapa plano completo; bandeiras indisponíveis.

O ensaio corre com o Chromium do ensaio (WebGL por software, com poucas imagens por segundo). Os rótulos deslizam suavemente até à posição final e o teste espera que assentem.

Regressão que carrega a página inicial: `ui-e2e` 68/68, `site-chrome-e2e` 78/78, `menu-e2e` 43/43 e `links-audit` sem erros.

## Publicação

Não há migrações. Segue o procedimento habitual. `package.json` e `package-lock.json` mudaram, por isso o `npm ci` é necessário. O bloco de publicação existente já o faz quando detecta essa diferença. `public/textures/` segue no `git archive`.

**Reversão:** reverter o merge e repetir a publicação. As texturas deixam de ser usadas; nada na base de dados depende deste trabalho.

**Cache (opcional):** os ficheiros em `public/` são servidos com revalidação. Se o nginx ou o Next permitirem, `Cache-Control: public, max-age=2592000` em `/textures/*` evita rever os ~0,3–1 MB em visitas repetidas.
