import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BuyFlow } from '@/components/purchase/BuyFlow'
import { QuoteRequestForm } from '@/components/purchase/QuoteRequestForm'
import { getPurchasePlan } from '@/lib/commerce/catalog-public'
import Link from 'next/link'
import { getPool } from '@/lib/db/pool'
import { createAuthClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const plan = await getPurchasePlan((await params).slug).catch(() => null)
  return { title: plan ? `Comprar ${plan.name}` : 'Comprar', robots: { index: false } }
}

// Percurso de compra: Plano → Domínio (alojamento/e-mail) → Duração → Carrinho.
export default async function ComprarPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ciclo?: string }> }) {
  const { slug } = await params
  const { ciclo } = await searchParams
  const plan = await getPurchasePlan(slug)
  if (!plan) notFound()
  // Revenda: o percurso de compra só existe quando o modo comercial o permite (o servidor volta a validar no carrinho)
  let resellerBlock: string | null = null
  if (plan.category === 'reseller' && plan.saleStatus === 'active') {
    const { resellerGate, GATE_MSG } = await import('@/lib/reseller/gate')
    const { data: { user } } = await (await createAuthClient()).auth.getUser()
    const [[prod]] = await getPool().query('SELECT id FROM products WHERE slug = ?', [slug]) as never as [{ id: string }[]]
    const code = await resellerGate(getPool(), { productId: prod.id, cycle: ciclo ?? 'monthly', userId: user?.id ?? null })
    if (code) resellerBlock = GATE_MSG[code] ?? code
  }
  return (
    <>
      <Header />
      <main className="bg-[#F7F7F7] min-h-screen pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          {resellerBlock ? (
            <div className="max-w-2xl bg-white border border-[#E8E8E8] rounded-2xl p-8" data-testid="reseller-buy-blocked">
              <h1 className="text-xl font-black text-[#0A0A0A]">{plan.name}</h1>
              <p className="text-sm text-[#555] mt-2">{resellerBlock}</p>
              <Link href="/revenda-de-hospedagem#pedido" className="inline-block mt-5 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B700] text-black">Solicitar contratação</Link>
            </div>
          ) : plan.saleStatus === 'on_request'
            ? <div className="max-w-2xl"><QuoteRequestForm product={plan.slug} productName={plan.name} note={plan.pricingNote} /></div>
            : <Suspense><BuyFlow plan={plan} initialCycle={ciclo ?? null} /></Suspense>}
        </div>
      </main>
      <Footer />
    </>
  )
}
