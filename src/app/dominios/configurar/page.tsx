import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { DomainConfig } from '@/components/purchase/DomainConfig'

export const metadata: Metadata = { title: 'Configuração do domínio', robots: { index: false } }

export default function ConfigurarDominioPage() {
  return (
    <>
      <Header />
      <main className="bg-[#F7F7F7] min-h-screen pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-4">
          <Suspense><DomainConfig /></Suspense>
        </div>
      </main>
      <Footer />
    </>
  )
}
