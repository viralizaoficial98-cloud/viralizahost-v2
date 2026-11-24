# /dominios — hero do painel e secção «Registo de domínios»

## Ordem da página

| # | Secção | Âncora | Componente |
|---|---|---|---|
| 1 | **Hero** (único H1) | — | `BannerHero slug="dominios"` → `ServiceHero` (layout «split») |
| 2 | **Registo de domínios** (H2) | `#registo-de-dominios` | `DomainSearchBar variant="page"` |
| 3 | Todas as extensões e preços (1 ano) | `#extensoes` | lista do catálogo (já existia) |
| 4 | Registar, transferir e renovar | `#registo` | `PageLinksSection` (já existia) |
| 5 | Gestão e segurança do domínio | `#gestao` | `PageLinksSection` (já existia) |
| 6 | Preços, guias e suporte | `#recursos` | `PageLinksSection` (já existia) |

**Removidos**, porque o novo bloco os substitui e se evita a duplicação:

- o cabeçalho escuro antigo, que tinha o H1;
- o formulário `DomainShop`. A pesquisa e o registo continuam em `/dominios/pesquisar`, com o mesmo componente.

As acções rápidas (Pesquisar e registar, Transferir, Renovar, Gestão e segurança, Tabela de preços) estão agora no fim da secção «Registo de domínios» (`data-testid="domain-actions"`).

## Hero editável (Painel → Site → Banners de páginas)

- `BannerHero` (`src/components/service/BannerHero.tsx`) junta a configuração de `banner_pages` (por `page_slug`) com o `ServiceHero`.
  - `/hospedagem-de-sites` usa o slug `hospedagem-de-sites`; `/dominios` usa o slug `dominios`.
  - O componente e o layout são os mesmos; os conteúdos são independentes.
- O que se edita no painel: título, descrição (subtítulo), etiqueta, destaques, botões, cor e **imagem**. A imagem pode ser carregada (PNG, JPG ou WEBP, até 10 MB) ou indicada por URL.
- Gravar revalida `/<slug>`.
- **Layout**: em desktop, a imagem fica à direita (64 % da largura), com transição para o fundo. Em telemóvel, a imagem fica por trás do texto, atenuada.
- A configuração `dominios` já faz parte da base de banners (`database/mariadb/seed/banner-pages.sql`). Se não existir numa instalação, a hero mostra textos por omissão até ser criada no painel com o slug `dominios`.
- «A partir de Kz …/1.º ano» é calculado do catálogo de domínios: o preço de registo mais baixo à venda.

## Secção «Registo de domínios»

- Reutiliza o `DomainSearchBar` da página inicial, com a variante `page`:
  - título «Encontre o domínio ideal para o seu negócio» (H2), com «domínio ideal» em amarelo;
  - a descrição pedida e fundo claro;
  - sem a onda decorativa, o link «Ver todos» e a barra de benefícios, que só aparecem na página inicial.
- **Cartões**: vêm de `/api/catalog/domains` → `featured`:
  - extensões em destaque, pela ordem, descrição, etiqueta e realce de **Catálogo e Preços → Domínios** (`domain_extensions`);
  - preços de `domain_prices`.
- **Fluxos** (os mesmos de antes):
  - «Pesquisar Domínio» mostra a disponibilidade e alternativas via `/api/domains/search`; «Escolher» leva a `/dominios/pesquisar?q=…`;
  - «Registar» leva a `/dominios/pesquisar?ext=…`, ou a `?q=nome.ext` se já houver um nome escrito.
- **Telemóvel**: o campo e o botão ficam empilhados e os cartões em 2 colunas, sem deslocamento horizontal.

## Ensaio

```bash
BASE_URL=http://localhost:3000 OUT=/tmp/dominios node --env-file=.env.local scripts/mariadb/rehearsal/domains-page-e2e.cjs
```

O ensaio:

- usa o painel (interface) para gravar uma descrição nova e carregar uma imagem nova na configuração «dominios»;
- confirma que a hero de `/dominios` muda e que a de `/hospedagem-de-sites` fica igual;
- confirma a ordem das secções e o H1 único;
- confirma que a imagem fica à direita em desktop e por trás do texto em telemóvel;
- verifica os textos, o campo e o botão amarelo da secção de registo;
- verifica que os cartões correspondem ao catálogo (extensão, ordem, descrição, preço e etiqueta);
- percorre os fluxos: Registar, pesquisa → Escolher e Transferir;
- confirma que a página inicial mantém a sua variante;
- confirma que não há deslocamento horizontal;
- repõe os banners no fim.

Capturas: `docs/capturas/dominios/`.

## Publicação

Sem migração. Usar o bloco de `docs/vps-ciclos-submenus.md` (backup, código, build, reinício **só** de `viralizahost`, confirmação do commit em `/api/version`). Depois:

1. Confirmar em **Banners de páginas** que existe a entrada `dominios`; se não existir, criá-la.
2. Rever o título, a descrição e a imagem.

**A publicação fica para aprovação.**
