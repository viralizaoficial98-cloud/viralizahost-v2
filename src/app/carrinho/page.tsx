import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartView } from '@/components/cart/CartView'

export const metadata: Metadata = { title: 'Carrinho', robots: { index: false } }

export default function CarrinhoPage() {
  return (
    <>
      <Header />
      <main className="bg-[#F7F7F7] min-h-screen pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <CartView />
        </div>
      </main>
      <Footer />
    </>
  )
}
