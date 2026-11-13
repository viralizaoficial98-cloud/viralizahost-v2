import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Página não encontrada',
  robots: { index: false },
}

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-[70vh] flex items-center justify-center px-4 pt-32 pb-20 bg-white">
        <div className="text-center max-w-lg">
          <p className="text-7xl md:text-8xl font-black text-[#F5B700] leading-none mb-4">404</p>
          <h1 className="text-2xl md:text-3xl font-black text-[#0A0A0A] mb-3">Página não encontrada</h1>
          <p className="text-[#666] mb-8">
            A página que procura não existe ou foi movida. Verifique o endereço ou volte à página inicial.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/" className="px-6 py-3 rounded-xl font-bold text-sm bg-[#F5B700] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-[#F5B700] transition-colors">
              Voltar à página inicial
            </Link>
            <Link href="/suporte" className="px-6 py-3 rounded-xl font-semibold text-sm border border-[#E8E8E8] text-[#0A0A0A] hover:border-[#F5B700] transition-colors">
              Falar com o suporte
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
