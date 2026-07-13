'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Globe, AlertCircle, X } from 'lucide-react'

export type DomainRow = {
  extension: string
  price_annual: number | null
  price_monthly: number | null
  currency: string
  popular: boolean
}

const currencySymbol: Record<string, string> = { AOA: 'Kz', AKZ: 'Kz', USD: '$', BRL: 'R$', EUR: '€' }

export function DominiosListing({
  extensions,
  fetchError,
}: {
  extensions: DomainRow[]
  fetchError: string | null
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return extensions
    return extensions.filter(
      e =>
        e.extension.toLowerCase().includes(q)
    )
  }, [extensions, query])

  return (
    <section className="bg-white py-16 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Search / filter */}
        <div className="max-w-lg mx-auto mb-10">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#BBB] pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filtrar extensões — .com, .ao, .net…"
              className="w-full pl-10 pr-10 py-3.5 border border-[#E8E8E8] rounded-xl text-sm outline-none focus:border-[#F5B700] transition-colors bg-white"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BBB] hover:text-[#555] transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>
          {query && (
            <p className="text-xs text-[#AAA] mt-2 text-center">
              {filtered.length === 0
                ? 'Nenhuma extensão encontrada'
                : `${filtered.length} extensão${filtered.length !== 1 ? 'ões' : ''} encontrada${filtered.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {/* Error state */}
        {fetchError && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <p className="text-[#333] font-bold mb-2">Não foi possível carregar os domínios</p>
            <p className="text-[#AAA] text-sm mb-4">
              Tente recarregar a página. Se o problema persistir, contacte o suporte.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#F5B700] text-[#0A0A0A] text-sm font-bold rounded-xl hover:bg-[#D9A300] transition-colors"
            >
              Recarregar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!fetchError && filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#FAFAFA] border border-[#E8E8E8] flex items-center justify-center mx-auto mb-4">
              <Globe size={24} className="text-[#CCC]" />
            </div>
            <p className="text-[#333] font-bold mb-2">
              {query ? 'Nenhuma extensão encontrada' : 'Nenhum domínio disponível'}
            </p>
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="text-[#F5B700] text-sm font-bold hover:underline mt-1"
              >
                Limpar filtro
              </button>
            ) : (
              <p className="text-[#AAA] text-sm">Consulte novamente mais tarde.</p>
            )}
          </div>
        )}

        {/* Extensions grid */}
        {!fetchError && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(ext => {
              const price = ext.price_annual ?? ext.price_monthly ?? 0
              const sym = currencySymbol[ext.currency] ?? ext.currency
              const priceText =
                price > 0
                  ? `${sym} ${price.toLocaleString('pt-AO')}/ano`
                  : 'Consultar preço'

              return (
                <Link
                  key={ext.extension}
                  href={`/checkout?tld=${encodeURIComponent(ext.extension)}`}
                  className="group relative flex flex-col items-center text-center bg-white border rounded-2xl p-5 transition-all duration-200 hover:shadow-[0_8px_32px_rgba(245,183,0,0.22)] hover:-translate-y-1"
                  style={{
                    borderColor: ext.popular ? '#F5B700' : '#EBEBEB',
                    boxShadow: ext.popular
                      ? '0 4px 24px rgba(245,183,0,0.18)'
                      : '0 2px 12px rgba(0,0,0,0.05)',
                  }}
                >
                  {ext.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F5B700] text-[#0A0A0A] text-[10px] font-black px-3 py-0.5 rounded-full tracking-wide uppercase">
                      Popular
                    </span>
                  )}
                  <div className="text-2xl font-black text-[#0A0A0A] mb-1">{ext.extension}</div>
                  <div className="text-[11px] text-[#999] mb-3 leading-tight min-h-[2rem]">
                    {ext.extension}
                  </div>
                  <div className="text-[13px] font-bold text-[#0A0A0A] mb-4">{priceText}</div>
                  <span
                    className="w-full py-2 rounded-xl text-xs font-bold border text-center transition-all duration-200 group-hover:bg-[#F5B700] group-hover:border-[#F5B700] group-hover:text-[#0A0A0A]"
                    style={{
                      background: ext.popular ? '#F5B700' : 'transparent',
                      borderColor: ext.popular ? '#F5B700' : '#D0D0D0',
                      color: ext.popular ? '#0A0A0A' : '#444',
                    }}
                  >
                    Registar
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
