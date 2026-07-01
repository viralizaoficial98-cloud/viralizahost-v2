'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'

const tlds = ['.com', '.net', '.org', '.ao', '.com.br', '.io']

export function DomainSearchBar() {
  const [query, setQuery] = useState('')
  const [activeTld, setActiveTld] = useState('.com')

  return (
    <section className="bg-white py-14 border-b border-[#F0F0F0]">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-black text-[#0A0A0A] mb-2">
            Encontre o domínio ideal para o seu negócio
          </h2>
          <p className="text-[#666] text-sm md:text-base">
            Pesquise disponibilidade e registe já o seu domínio
          </p>
        </div>

        {/* Search box */}
        <div className="flex rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.10)] overflow-hidden border border-[#E8E8E8]">
          <div className="flex items-center px-4 bg-[#F8F8F8] border-r border-[#E8E8E8] text-[#999] font-semibold text-sm select-none">
            www
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && query && alert(`A pesquisar: ${query}${activeTld}`)}
            placeholder="Pesquise seu domínio..."
            className="flex-1 px-4 py-4 text-[#0A0A0A] text-sm md:text-base outline-none bg-white placeholder:text-[#BBB]"
          />
          <button
            onClick={() => query && alert(`A pesquisar: ${query}${activeTld}`)}
            className="btn-primary px-6 py-4 text-sm font-bold flex items-center gap-2 rounded-none shrink-0"
          >
            <Search size={16} />
            Pesquisar
          </button>
        </div>

        {/* TLD pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {tlds.map(tld => (
            <button
              key={tld}
              onClick={() => setActiveTld(tld)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeTld === tld
                  ? 'bg-[#F5B700] border-[#F5B700] text-[#0A0A0A]'
                  : 'bg-white border-[#E8E8E8] text-[#666] hover:border-[#F5B700] hover:text-[#0A0A0A]'
              }`}
            >
              {tld}
            </button>
          ))}
        </div>

        {/* Popular TLD prices */}
        <div className="flex flex-wrap justify-center gap-6 mt-6 text-center">
          {[
            { tld: '.com', price: 'Kz 4.500/ano' },
            { tld: '.net', price: 'Kz 5.200/ano' },
            { tld: '.ao', price: 'Kz 8.000/ano' },
            { tld: '.com.br', price: 'R$ 49/ano' },
          ].map(({ tld, price }) => (
            <div key={tld} className="text-xs text-[#888]">
              <span className="font-bold text-[#0A0A0A]">{tld}</span> — {price}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
