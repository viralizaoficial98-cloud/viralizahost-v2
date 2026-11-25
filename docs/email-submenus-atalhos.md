# E-mail corporativo, imagens dos submenus e WhatsApp/chat em todas as páginas públicas

## 1. Hero editável de /email-corporativo

- A página usa o `BannerHero` partilhado, o mesmo componente e layout de `/hospedagem-de-sites` e `/dominios`: imagem à direita em desktop e, em telemóvel, por trás do texto e atenuada.
- Está ligada à entrada **`email-corporativo`** de **Painel → Site → Banners de páginas**. A entrada já existia e é reutilizada com os valores guardados.
- No painel editam-se o título, a descrição e a imagem (carregar ou substituir), além da etiqueta, dos destaques e dos botões.
- Cada página tem a sua entrada (`hospedagem-de-sites`, `dominios`, `email-corporativo`): as configurações são independentes.
- O título da hero é o **único H1**.
- **Atalhos** «Planos e preços», «Microsoft 365», «Segurança» e «Produtividade»: o componente partilhado não tem atalhos, por isso ficam numa barra logo abaixo da hero (`data-testid="email-actions"`).
- **`/email-corporativo#seguranca`**: os planos carregam depois da página e empurram o conteúdo. O hook `useReanchorAfterLoad` (`src/hooks/`) volta a posicionar a âncora quando os planos ficam prontos e outra vez depois de a página assentar, se o visitante não se tiver deslocado entretanto. A hospedagem usa o mesmo hook.

## 2. Imagens dos submenus

- Há um único cartão, `NavAsideCard` (`src/components/layout/Header.tsx`), para «Hospedagem e site», «Serviços» e «Empresa».
- O cartão tem apenas a imagem e o link «Fale com um especialista», numa só peça. O link é HTML e é o nome acessível do cartão; a imagem é decorativa (`alt=""`).
- **Destino**: `/suporte/contactar`, o mesmo da acção «Fale com um especialista» que existia no painel (`SPECIALIST_HREF`).
- **Posição**: em desktop, na coluna direita (260 px); em telemóvel, abaixo dos links do grupo. «Empresa» passou a ter o cartão.
- **Removidos**:
  - o cartão «Precisa de ajuda?»;
  - o título, a descrição e o botão «Ver Infraestrutura»;
  - o link repetido «Fale com um especialista» do rodapé do painel.
- **Imagens**: as três fornecidas, recortadas em 4:3 e convertidas para WEBP 640×480 (`public/nav/`, entre 15 e 25 KB cada); o `next/image` serve o tamanho certo.
  - `hospedagem.webp`: servidor com janela de navegador;
  - `servicos.webp`: nuvem, envelope e servidor;
  - `empresa.webp`: equipa a colaborar. É uma imagem ilustrativa, sem identificar pessoas como colaboradores.

## 3. WhatsApp e chat em todas as páginas públicas

- `PublicFloating` (`src/components/layout/PublicFloating.tsx`) está no layout raiz e mostra o `FloatingChat` existente (o mesmo número de WhatsApp e a mesma configuração do chat) em todas as páginas públicas.
- A instância exclusiva da página inicial foi removida.
- A Área do Cliente mantém a sua instância e o painel de administração não tem nenhuma. A lista das áreas está em `src/lib/site/areas.ts`, partilhada com o `proxy.ts`.
- **Posição**: WhatsApp no canto inferior esquerdo e chat no inferior direito.
- **Não tapam controlos**: sempre que há um botão, link ou campo por baixo de um dos atalhos, o atalho fica transparente e sem cliques, e volta quando o controlo sai de baixo. A verificação corre ao deslocar a página (incluindo contentores), quando a página muda de altura e a cada segundo. O chat aberto fica sempre visível.
- **Telemóvel**: atalhos mais pequenos (48 px), sem a mensagem de boas-vindas ao lado, e 76 px de espaço no fim da página para não taparem os últimos links. O chat abre à largura do ecrã e fecha normalmente.
- Na página inicial, em desktop, o chat afasta-se no topo enquanto estiver por cima da seta do carrossel da hero, e volta ao deslocar a página.

## Ensaio

```bash
BASE_URL=http://localhost:3000 OUT=/tmp/site-chrome node --env-file=.env.local scripts/mariadb/rehearsal/site-chrome-e2e.cjs
```

O ensaio corre em desktop e iPhone e verifica:

- **Painel**: gravar uma descrição nova e carregar uma imagem nova em «email-corporativo» muda a hero de e-mail, preserva o título e não altera hospedagem nem domínios.
- **Página de e-mail**: H1 único, imagem à direita ou atenuada, atalhos logo abaixo da hero, o atalho «Segurança» e o link directo `#seguranca`.
- **Submenus**: cada um com a sua imagem, o link correcto e nada a mais, à direita em desktop e abaixo dos links em telemóvel.
- **Atalhos flutuantes**: um WhatsApp e um chat por página em 7 páginas públicas, nas posições certas; o chat abre e fecha na página inicial e numa página interna.
- **Telemóvel**: os atalhos nunca tapam controlos ao percorrer quatro páginas inteiras, e o botão do percurso de compra continua livre.
- **Áreas privadas**: a Área do Cliente tem um só par de atalhos e o painel nenhum.

Capturas: `docs/capturas/email-submenus-atalhos/`.

## Publicação

Sem migração. Usar o bloco de `docs/vps-ciclos-submenus.md` (reinicia só `viralizahost` e confirma o commit em `/api/version`). Depois, rever em «Banners de páginas» o título, a descrição e a imagem de `email-corporativo`. **Fica para aprovação.**
