# Fluxo de compra — referências consultadas e decisões

Consulta: 2026-11-20, navegador (Playwright), como visitante, sem chegar a qualquer pagamento.

## AngoWeb (WHMCS)
- Hospedagem: https://angoweb.ao/store/hospedagem-de-websites/hospedagem-pessoal
  1. O botão do plano abre logo **«Escolher um domínio…»** com 4 opções: *Registar um novo domínio* (nome + extensão + «Verificar»),
     *Transferir o meu domínio*, *Vou usar o meu domínio existente e atualizar os DNS*, *Usar um domínio gratuito* (só .ao, .co.ao, .org.ao, .edu.ao, .it.ao).
  2. Resultado: **Correspondência exacta** («está disponível» com preço, ou «indisponível») + **Domínios recomendados** noutras extensões com preço e «Adicionar ao carrinho».
     Aviso: «Os domínios sugeridos podem não estar disponíveis. A disponibilidade será pesquisada em tempo real aquando da sua adição ao carrinho.»
  3. `cart.php?a=confproduct`: **Escolher ciclo de pagamentos** (Mensal, Trimestral, Semestral, Anual, Bienal, Trienal) com valor/mês e «Poupe x%»,
     opções configuráveis e extras, resumo com «Taxas de instalação» e **«A pagar hoje»**.
  4. Configuração do domínio → carrinho → checkout.
- E-mail: https://angoweb.ao/index.php/store/e-mail-profissional-cpanel/e-mail-profissional-business — mesmo passo de domínio (sem domínio gratuito), depois ciclo.

## Hostinger
- https://www.hostinger.com/support/1583274-how-to-purchase-a-hosting-plan-at-hostinger/ — plano «Add to cart» → **duração** (1, 12, 24, 48 meses, melhor preço/mês em prazos longos) → conta → pagamento → configuração do plano depois de pago.
- https://www.hostinger.com/support/1583421-how-to-purchase-a-domain-name-at-hostinger/ — pesquisa → disponível «Add to cart» + **lista de extensões alternativas** → **período de registo** escolhido no carrinho → pagamento → registo/ligação.

## Decisões ViralizaHost (interface própria)
- Ordem: **Plano → Escolher domínio → Escolher duração → Carrinho → Checkout → Confirmação** (`/comprar/<plano>`).
- Domínio em página própria com as 3 opções (registar, transferir, usar existente). Sem «domínio grátis»: nenhum plano do catálogo aprovado o inclui.
- Resultado com nome exacto + alternativas nas extensões vendidas, cada uma com estado **Disponível / Indisponível / A confirmar pela equipa**,
  preço de registo e de renovação. Indisponível não é seleccionável. Revalidação no servidor ao criar a encomenda (como a AngoWeb faz ao adicionar).
- Duração: cada ciclo mostra equivalente mensal, total a pagar agora, duração e renovação; o domínio aparece à parte, em anos.
- Sem «Poupe x%»: o catálogo aprovado não tem descontos por ciclo (preço/mês × meses).
- Carrinho acessível no cabeçalho com contador; o passo 1 do checkout é o carrinho editável.
