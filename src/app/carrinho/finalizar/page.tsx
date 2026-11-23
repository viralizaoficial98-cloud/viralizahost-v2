import { redirect } from 'next/navigation'
import { nextCheckoutStep } from '@/lib/commerce/checkout-flow'

export const dynamic = 'force-dynamic'

// «Finalizar»: decide no servidor (sessão + dados guardados + carrinho guardado) o passo seguinte.
// Também é o destino do link de verificação de e-mail quando há uma compra a meio.
export default async function FinalizarPage({ searchParams }: { searchParams: Promise<{ verificado?: string }> }) {
  const { verificado } = await searchParams
  const next = await nextCheckoutStep()
  redirect(verificado === '1' && next !== '/carrinho' ? `${next}?verificado=1` : next)
}
