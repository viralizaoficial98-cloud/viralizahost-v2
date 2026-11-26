# Bandeiras nos centros de dados

Cada centro de dados mostra a bandeira do seu país ao lado do nome da cidade, em três pontos:

- **Configuração de VPS**, passo «Centro de dados» (`/servidor-vps/configurar`): a bandeira substitui o ícone de localização em cada opção.
- **Compra**, seletor «Localização do servidor» (`/comprar/<plano>`): idem. O ícone do título do seletor mantém-se.
- **Painel → Cloud VPS → Datacenters:** a bandeira vai antes do nome da cidade em cada cartão, que mantém a caixa de seleção, o ID, o código do centro e o selo «Oferecido»/«Não oferecido».

Não mudam os cartões de sistemas operativos, o campo Hostname, o globo 3D, nem os IDs, a seleção, a disponibilidade e a gravação.

## De onde vem o país

- **Fonte:** o código de país que o fornecedor envia em cada centro (`location` na API da Hostinger). A sincronização guarda-o normalizado em `options.locations[].country` (ISO alfa-2, minúsculas).
- **Normalização:** `LT`, `lt` e ` Lt ` dão `lt`. `UK` passa a `gb`. Valores que não são duas letras são ignorados.
- **Centros já guardados:** os centros sincronizados antes de existir o campo `country` não precisam de nova sincronização. O código é lido do fim do rótulo («Vilnius, LT» ou «Mumbai 2 (IN)»).
- **Código técnico:** o nome técnico do centro (`bnk`, `fast`, `mum2`…, guardado em `detail`) **nunca** escolhe a bandeira. O ensaio usa nomes enganadores de propósito (um centro da Malásia chama-se `de`, um da Alemanha chama-se `us`).
- **Código:** `src/lib/vps/country.ts`.

## Fallback

Sem país identificado, ou se a imagem falhar (ficheiro em falta ou erro de rede), aparece um ícone de localização cinzento. A cidade nunca depende da bandeira e o centro continua selecionável. Componente: `src/components/ui/CountryFlag.tsx` (pequena, 20×15, decorativa).

## Ficheiros de bandeira

`public/flags/<iso2>.png` (96×72, [flag-icons](https://github.com/lipis/flag-icons) 7.5.0, MIT; licença em `public/flags/LICENSE-flag-icons.txt`). Já existiam os 23 países da «Presença Global». Foram acrescentados 56 países para cobrir os centros atuais (por exemplo, Lituânia) e as localizações futuras mais prováveis:

`lt nl es it pl se fi no dk ie ch at be cz ro bg gr ua il ae sa za ng ke eg ma jp kr au nz th vn ph tw pk bd lk qa kw cr pa ec py ve do hu sk si hr rs lv ee is lu cy mt`

Um país sem ficheiro mostra o ícone neutro. Para adicionar outro, gere o PNG com 96×72 a partir do SVG 4×3 do flag-icons.

## Ensaios

- `scripts/vps/vps-country.test.mjs`: 5 testes unitários (normalização, alias, valores inválidos, código técnico ignorado, centros antigos).
- `scripts/mariadb/rehearsal/dc-flags-e2e.cjs`: 58 verificações em desktop e iPhone com o fornecedor simulado, que passa a ter `POST /_dcs?set=ten` (os dez centros, com países em maiúsculas e minúsculas mistas).

O ensaio cobre:
- os dez centros (LT, SG, GB, IN, ID, MY, BR, US, DE, FR) nos três ecrãs, com a bandeira certa, pequena e alinhada com a cidade;
- selecionar um centro na compra (e a escolha chega ao carrinho);
- ativar e desativar um centro no painel (grava, persiste e atualiza o seletor da compra);
- centro sem país, país sem ficheiro e bandeira bloqueada → ícone neutro com a cidade visível;
- cartões de sistemas operativos e Hostname sem bandeiras.

Capturas em `docs/capturas/bandeiras-centros-dados/`.

## Publicação

Sem migrações nem novas dependências. Segue o procedimento habitual (`git archive` → `npm run build` → `pm2 restart viralizahost`). Os PNG em `public/flags/` seguem no `git archive`.
