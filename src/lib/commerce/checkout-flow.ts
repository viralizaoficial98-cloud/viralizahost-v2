import 'server-only'
import { getSessionUser } from '@/lib/auth/server'
import { loadCartLines } from './cart-server'
import { loadCustomer } from './customer'

// «Finalizar»: o passo seguinte decide-se no servidor, com a sessão e os dados guardados.
//   carrinho vazio                       → /carrinho
//   sem sessão                           → /checkout/conta     (cadastro, com «Já tenho conta»)
//   sessão + dados obrigatórios em falta → /checkout/dados     (só o que falta)
//   sessão + dados completos             → /checkout/pagamento
export type CheckoutStep = '/carrinho' | '/checkout/conta' | '/checkout/dados' | '/checkout/pagamento'

export async function nextCheckoutStep(): Promise<CheckoutStep> {
  const user = await getSessionUser()
  const lines = await loadCartLines(user?.id ?? null)
  if (!lines.length) return '/carrinho'
  if (!user) return '/checkout/conta'
  const c = await loadCustomer(user.id)
  if (!c || c.missing.length) return '/checkout/dados'
  return '/checkout/pagamento'
}
