import type { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export function ShopPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="bg-[#F7F7F7] min-h-screen pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mb-2">{title}</h1>
          {subtitle && <p className="text-[#666] mb-6">{subtitle}</p>}
          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}
