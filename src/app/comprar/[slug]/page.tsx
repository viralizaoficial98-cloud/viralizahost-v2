import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BuyFlow } from '@/components/purchase/BuyFlow'
import { QuoteRequestForm } from '@/components/purchase/QuoteRequestForm'
import { getPurchasePlan } from '@/lib/commerce/catalog-public'

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
  return (
    <>
      <Header />
      <main className="bg-[#F7F7F7] min-h-screen pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          {plan.saleStatus === 'on_request'
            ? <div className="max-w-2xl"><QuoteRequestForm product={plan.slug} productName={plan.name} note={plan.pricingNote} /></div>
            : <Suspense><BuyFlow plan={plan} initialCycle={ciclo ?? null} /></Suspense>}
        </div>
      </main>
      <Footer />
    </>
  )
}
