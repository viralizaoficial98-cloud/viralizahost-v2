import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import type { ReactNode } from 'react'

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="bg-white">
        <article className="container mx-auto px-4 py-28 max-w-3xl text-[#333] leading-relaxed [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-[#0A0A0A] [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
          <h1 className="text-3xl md:text-4xl font-black text-[#0A0A0A] mb-3">{title}</h1>
          <p className="text-[#666] mb-6">{intro}</p>
          {children}
          <p className="mt-10 text-sm text-[#666]">Dúvidas: <a className="underline" href="mailto:suporte@viralizahost.com">suporte@viralizahost.com</a> ou <a className="underline" href="/suporte/contactar">contacte a equipa</a>.</p>
        </article>
      </main>
      <Footer />
    </>
  )
}
