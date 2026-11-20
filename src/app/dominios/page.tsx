import type { Metadata } from 'next'
import Link from 'next/link'
import { kz as kzFmt } from '@/lib/commerce/status'
import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { DomainShop } from '@/components/purchase/DomainShop'
import { listExtensions } from '@/lib/commerce/domain-catalog'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Domínios — Pesquisa e preços',
  description: 'Pesquise, registe e transfira domínios .ao, .co.ao, .com e outros, com preços em kwanzas.',
}
const kz = (n: number | null) => (n == null ? '—' : kzFmt(Math.round(n)))

export default async function DominiosPage() {
  let exts: Awaited<ReturnType<typeof listExtensions>> | null = null
  try { exts = await listExtensions() } catch { exts = null }
  return (
    <>
      <Header />
      <main>
        <section className="bg-[#0A0A0A] pt-28 pb-12 text-center px-4">
          <p className="text-[#F5B700] text-xs font-bold tracking-widest uppercase mb-4">Registo de Domínios</p>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">Encontre o seu <span className="text-[#F5B700]">domínio</span></h1>
          <p className="text-[#999] text-base md:text-lg max-w-2xl mx-auto">Disponibilidade, alternativas e preços de registo e renovação em kwanzas.</p>
        </section>
        <section className="bg-[#F7F7F7] py-10 px-4">
          <div className="max-w-4xl mx-auto"><Suspense><DomainShop /></Suspense></div>
        </section>
        <section className="bg-white py-14 px-4" aria-labelledby="ext-title">
          <div className="max-w-5xl mx-auto">
            <h2 id="ext-title" className="text-2xl font-black text-[#0A0A0A] mb-6">Extensões e preços (1 ano)</h2>
            {!exts ? (
              <p className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700" role="alert">Não foi possível carregar os preços. Recarregue a página dentro de instantes.</p>
            ) : !exts.length ? (
              <p className="p-4 rounded-xl bg-[#F8F8F8] text-sm">Ainda não há extensões publicadas.</p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {exts.map(e => (
                  <li key={e.extension}>
                    <Link href={e.status === 'active' ? `/dominios/pesquisar?ext=${encodeURIComponent(e.extension)}` : '/suporte/contactar'} className="block rounded-xl border border-[#E8E8E8] p-4 hover:border-[#F5B700] transition-colors">
                      <p className="font-black text-lg text-[#0A0A0A]">{e.extension}</p>
                      {e.status === 'active' ? <><p className="text-sm font-bold">{kz(e.register)}</p><p className="text-[11px] text-[#888]">renova {kz(e.renew)}</p></> : <p className="text-sm text-[#888]">Sob consulta</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-sm"><Link href="/dominios/precos" className="font-bold underline">Tabela completa com transferências</Link></p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
