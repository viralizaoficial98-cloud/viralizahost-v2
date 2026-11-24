'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Shield, Zap, Headphones, Lock, Globe, RefreshCw, Check, X, Loader2, ArrowRight } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'

type ExtItem = { tld: string; label: string; priceNum: number; renewNum: number | null; badge: string | null; highlight: boolean }
type ApiExt = { extension: string; status: string; register: number | null; renew: number | null; description: string | null; badge: string | null; highlight: boolean }

// Cartões e preços vêm do catálogo (/api/catalog/domains): preços de domain_prices; descrição, etiqueta,
// realce e ordem de domain_extensions (Administração → Catálogo e Preços → Domínios). Sem valores fixos.
const toItem = (e: ApiExt): ExtItem => ({ tld: e.extension, label: e.description ?? '', priceNum: e.register ?? 0, renewNum: e.renew, badge: e.badge, highlight: e.highlight })

type CheckResult = { tld: string; domain: string; status: 'available' | 'unavailable' | 'confirm' | 'on_request' | null; loading: boolean }

const benefits = [
  { icon: Globe, title: 'Extensões nacionais', desc: '.ao, .co.ao e outras' },
  { icon: Search, title: 'Alternativas', desc: 'Sugestões noutras extensões' },
  { icon: RefreshCw, title: 'Renovação indicada', desc: 'Preço de renovação visível' },
  { icon: Lock, title: 'Código EPP cifrado', desc: 'Nas transferências' },
  { icon: Headphones, title: 'Suporte', desc: 'Equipa técnica por ticket' },
]

const trustItems = [
  { icon: Shield, text: 'Preços em kwanzas' },
  { icon: Zap, text: 'Disponibilidade revalidada na encomenda' },
  { icon: Headphones, text: 'Suporte especializado' },
]

/**
 * Pesquisa de domínios + extensões em destaque (catálogo de Administração → Catálogo e Preços → Domínios).
 * variant «home»: página inicial (onda decorativa, link «Ver todos os domínios», barra de benefícios).
 * variant «page»: secção «Registo de domínios» de /dominios, logo a seguir à hero (sem os elementos da página inicial).
 */
export function DomainSearchBar({ variant = 'home' }: { variant?: 'home' | 'page' }) {
  const page = variant === 'page'
  const { formatCurrency, currency } = useLocale()
  const fmtAOA = (n: number) => formatCurrency(convertFromAOA(n, currency))
  const [query, setQuery] = useState('')
  const [extensions, setExtensions] = useState<ExtItem[]>([])   // cartões em destaque
  const [onSale, setOnSale] = useState<ExtItem[]>([])          // todas à venda (preço nos resultados da pesquisa)
  const [results, setResults] = useState<CheckResult[]>([])
  const [searching, setSearching] = useState(false)
  const [revealed, setRevealed] = useState<boolean[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const router = useRouter()

  const [extError, setExtError] = useState(false)
  const [searchError, setSearchError] = useState('')
  useEffect(() => {
    fetch('/api/catalog/domains', { cache: 'no-store' })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j })
      .then(j => {
        setExtensions((j.featured as ApiExt[] ?? []).map(toItem))
        setOnSale((j.extensions as ApiExt[]).filter(e => e.status === 'active' && e.register != null).map(toItem))
      })
      .catch(() => setExtError(true))
  }, [])

  function getExtByTld(tld: string): ExtItem | undefined {
    return onSale.find(e => e.tld === tld)
  }

  async function handleSearch() {
    const q = query.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '')
    if (!q) return
    if (abortRef.current) abortRef.current.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setSearching(true); setSearchError(''); setResults([])
    try {
      const res = await fetch(`/api/domains/search?q=${encodeURIComponent(q)}`, { signal: abort.signal, cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'A pesquisa falhou.')
      const all = [j.exact, ...j.alternatives].slice(0, 6) as { domain: string; extension: string; availability: CheckResult['status'] }[]
      setResults(all.map(r => ({ tld: r.extension, domain: r.domain, status: r.availability, loading: false })))
      setRevealed(all.map(() => false))
      all.forEach((_, idx) => setTimeout(() => setRevealed(prev => { const n = [...prev]; n[idx] = true; return n }), 120 + idx * 100))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setSearchError((e as Error).message === 'Failed to fetch' ? 'Sem ligação. Tente novamente.' : (e as Error).message)
    } finally { setSearching(false) }
  }

  // Escolher a duração do registo e adicionar ao carrinho acontece na página de domínios
  function goToCheckout(domain: string) {
    router.push(`/dominios/pesquisar?q=${encodeURIComponent(domain)}`)
  }

  function handleRegisterTld(tld: string) {
    const name = query.trim().toLowerCase().split('.')[0]
    router.push(name ? `/dominios/pesquisar?q=${encodeURIComponent(name + tld)}` : `/dominios/pesquisar?ext=${encodeURIComponent(tld)}`)
  }

  return (
    <>
      {/* Premium LED wave separator */}
      {!page && <div className="relative w-full overflow-hidden" style={{ background: '#000000', marginBottom: '-1px' }}>
        <style>{`
          @keyframes wave-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
          @keyframes wave-shift { 0%, 100% { transform: translateX(0px); } 50% { transform: translateX(6px); } }
          .led-wave-glow { animation: wave-pulse 3.5s ease-in-out infinite; }
          .led-wave-line { animation: wave-shift 6s ease-in-out infinite; }
        `}</style>
        <svg viewBox="0 0 1440 56" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="w-full block" style={{ height: 56 }}>
          <defs>
            <filter id="glow-bloom" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="10" result="bloom" /></filter>
            <filter id="glow-mid" x="-5%" y="-150%" width="110%" height="400%"><feGaussianBlur stdDeviation="5" result="mid" /></filter>
            <filter id="glow-inner" x="-2%" y="-80%" width="104%" height="260%"><feGaussianBlur stdDeviation="2" result="inner" /></filter>
          </defs>
          <path d="M0,56 L0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22 L1440,56 Z" fill="#ffffff" />
          <path className="led-wave-glow" d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22" fill="none" stroke="#F5B700" strokeWidth="12" filter="url(#glow-bloom)" opacity="0.25" />
          <path className="led-wave-glow" d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22" fill="none" stroke="#F5B700" strokeWidth="6" filter="url(#glow-mid)" opacity="0.55" />
          <path className="led-wave-glow" d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22" fill="none" stroke="#FFD54F" strokeWidth="3" filter="url(#glow-inner)" opacity="0.85" />
          <path className="led-wave-line" d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22" fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.7" />
          <path className="led-wave-line" d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22" fill="none" stroke="#F5B700" strokeWidth="2" opacity="1" />
        </svg>
      </div>}

      {/* Domain Section */}
      <section {...(page ? { id: 'registo-de-dominios', 'data-section': 'domain-register', 'data-testid': 'domain-register', 'aria-labelledby': 'registo-title' } : {})}
        className={page ? 'bg-[#FAFAFA] py-16 md:py-20 scroll-mt-24' : 'bg-white pt-0 pb-20'}>
        <style>{`
          @keyframes domain-slide-up {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes check-pop {
            0%   { transform: scale(0); opacity: 0; }
            70%  { transform: scale(1.25); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes skeleton-shimmer {
            0%   { background-position: -400px 0; }
            100% { background-position: 400px 0; }
          }
          .domain-row-enter { animation: domain-slide-up 0.28s cubic-bezier(0.22,1,0.36,1) both; }
          .check-pop { animation: check-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
          .skeleton-bar {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 800px 100%;
            animation: skeleton-shimmer 1.4s ease-in-out infinite;
            border-radius: 6px;
          }
        `}</style>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8">

          {/* Heading */}
          <div className="text-center mb-12 pt-4">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#F5B700]" />
              <p className="text-[#F5B700] text-xs font-bold tracking-widest uppercase">Registo de Domínios</p>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#F5B700]" />
            </div>
            <h2 id={page ? 'registo-title' : undefined} className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0A0A0A] leading-tight mb-4">
              {page ? 'Encontre' : 'Encontra'} o{' '}<span className="text-[#F5B700]" data-testid="domain-register-highlight">domínio ideal</span>{' '}para<br className="hidden md:block" /> o seu negócio
            </h2>
            <p className="text-[#666] text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              {page ? 'Pesquise, registe e proteja o nome da sua marca com rapidez e segurança.'
                : <>Pesquise, registe e proteja o nome da sua marca com rapidez,<br className="hidden md:block" /> segurança e o melhor preço.</>}
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-3xl mx-auto mb-5">
            <div
              className="flex flex-col sm:flex-row sm:items-center sm:h-[72px] gap-2 sm:gap-0 p-2 sm:p-0 bg-white rounded-[20px] border transition-all duration-300"
              style={{
                borderColor: results.length > 0 ? '#F5B700' : '#E8E8E8',
                boxShadow: results.length > 0
                  ? '0 8px 40px rgba(245,183,0,0.18), 0 2px 8px rgba(245,183,0,0.10)'
                  : '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(245,183,0,0.08)',
              }}
            >
              <div className="flex items-center flex-1 min-w-0 h-12 sm:h-auto">
              <div className="flex items-center pl-3 sm:pl-5 pr-3 shrink-0">
                <Search size={22} className={`transition-colors duration-200 ${searching ? 'text-[#F5B700]' : 'text-[#BBB]'}`} />
              </div>
              <input
                aria-label="Nome do domínio"
                data-testid="domain-search-input"
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setResults([]); setRevealed([]) }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Digite o nome do domínio desejado"
                className="flex-1 min-w-0 text-[#0A0A0A] text-base md:text-lg outline-none bg-transparent placeholder:text-[#C0C0C0] pr-3"
              />
              </div>
              <div className="sm:pr-2 shrink-0">
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  data-testid="domain-search-submit"
                  className="h-[54px] w-full sm:w-auto sm:min-w-[180px] px-7 rounded-[14px] font-bold text-sm md:text-base transition-all duration-200 flex items-center justify-center gap-2 shrink-0"
                  style={{
                    background: searching ? '#0A0A0A' : '#F5B700',
                    color: searching ? '#F5B700' : '#0A0A0A',
                    boxShadow: '0 4px 20px rgba(245,183,0,0.35)',
                  }}
                  onMouseEnter={e => { if (!searching) { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.color = '#F5B700' } }}
                  onMouseLeave={e => { if (!searching) { e.currentTarget.style.background = '#F5B700'; e.currentTarget.style.color = '#0A0A0A' } }}
                >
                  {searching
                    ? <><Loader2 size={16} className="animate-spin" /> A pesquisar...</>
                    : <><Search size={16} /> Pesquisar Domínio</>
                  }
                </button>
              </div>
            </div>

            {searchError && <p className="mt-2 text-sm text-red-600 text-center" role="alert">{searchError} <button className="underline font-bold" onClick={handleSearch}>Tentar novamente</button></p>}
            {/* Results panel */}
            {results.length > 0 && (
              <div
                className="mt-2 bg-white rounded-2xl overflow-hidden"
                style={{ border: '1.5px solid #F5B700', boxShadow: '0 12px 48px rgba(245,183,0,0.12), 0 2px 12px rgba(0,0,0,0.06)' }}
              >
                {results.map((r, idx) => {
                  const ext = getExtByTld(r.tld)
                  const isVisible = revealed[idx]
                  const isLoading = r.loading
                  const isUnverified = !isLoading && r.status === 'confirm'
                  const isAvailable = !isLoading && (r.status === 'available' || isUnverified)
                  const isOccupied = !isLoading && r.status === 'unavailable'
                  const isOnRequest = !isLoading && r.status === 'on_request'

                  return (
                    <div
                      key={r.tld}
                      className={`domain-row-enter flex items-center justify-between px-5 py-4 transition-colors duration-150 ${
                        isAvailable ? 'hover:bg-[#FFFDF0]' : isOccupied ? 'hover:bg-[#FFF5F5]' : 'hover:bg-[#FAFAFA]'
                      } ${idx < results.length - 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                      style={{ animationDelay: `${idx * 0.12}s`, opacity: isVisible ? undefined : 0 }}
                    >
                      {/* Left: domain + price */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isLoading ? 'bg-[#DDD]' : isUnverified ? 'bg-amber-400' : isAvailable ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                        <span className="font-black text-[#0A0A0A] text-sm md:text-base truncate">{r.domain}</span>
                        {isLoading
                          ? <span className="skeleton-bar h-4 w-20 inline-block" />
                          : ext ? <span className="text-[#AAA] text-xs font-medium hidden sm:inline">{fmtAOA(ext.priceNum)}/1.º ano</span> : null
                        }
                      </div>

                      {/* Right: status + CTA */}
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        {isLoading && (
                          <span className="flex items-center gap-1.5 text-[#BBB] text-xs">
                            <Loader2 size={12} className="animate-spin" />
                            <span className="hidden sm:inline">A verificar...</span>
                          </span>
                        )}

                        {isAvailable && (
                          <>
                            {isUnverified ? (
                              <span className="flex items-center gap-1.5 text-amber-600 text-xs font-bold" title="Sem consulta automática nesta extensão: encomenda já, paga depois de a equipa confirmar.">
                                <span className="hidden sm:inline">A confirmar pela equipa</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                                <span className="check-pop inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100">
                                  <Check size={10} className="text-green-600" />
                                </span>
                                <span className="hidden sm:inline">Disponível</span>
                              </span>
                            )}
                            <button
                              onClick={() => goToCheckout(r.domain)}
                              className="group flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 hover:gap-2.5 hover:scale-105"
                              style={{ background: '#F5B700', color: '#0A0A0A', boxShadow: '0 2px 12px rgba(245,183,0,0.35)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.color = '#F5B700' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#F5B700'; e.currentTarget.style.color = '#0A0A0A' }}
                            >
                              Escolher <ArrowRight size={11} />
                            </button>
                          </>
                        )}

                        {isOccupied && (
                          <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100">
                              <X size={10} className="text-red-500" />
                            </span>
                            Indisponível
                          </span>
                        )}
                        {isOnRequest && <span className="text-[#888] text-xs font-bold">Sob consulta</span>}
                      </div>
                    </div>
                  )
                })}

                {/* Footer hint */}
                <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#F0F0F0] flex items-center gap-2">
                  <Shield size={11} className="text-[#F5B700]" />
                  <span className="text-[#AAA] text-[11px]">A disponibilidade volta a ser verificada quando confirmar a encomenda</span>
                </div>
              </div>
            )}
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-14" data-testid="domain-trust">
            {trustItems.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[#555] text-sm">
                <Icon size={14} className="text-[#F5B700]" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Extension cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {extError && <p className="col-span-full text-center text-sm text-[#888]" role="alert">Não foi possível carregar as extensões. <a href="/dominios" className="underline">Ver domínios</a></p>}
            {extensions.map(({ tld, label, priceNum, badge, highlight: popular }) => (
              <div
                key={tld}
                data-testid="ext-card" data-ext={tld} data-highlight={popular ? '1' : '0'}
                className="group relative flex flex-col items-center text-center bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-200"
                style={{
                  borderColor: popular ? '#F5B700' : '#EBEBEB',
                  boxShadow: popular ? '0 4px 24px rgba(245,183,0,0.18)' : '0 2px 12px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#F5B700'; el.style.boxShadow = '0 8px 32px rgba(245,183,0,0.22)'; el.style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = popular ? '#F5B700' : '#EBEBEB'; el.style.boxShadow = popular ? '0 4px 24px rgba(245,183,0,0.18)' : '0 2px 12px rgba(0,0,0,0.05)'; el.style.transform = 'translateY(0)' }}
              >
                {badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F5B700] text-[#0A0A0A] text-[10px] font-black px-3 py-0.5 rounded-full tracking-wide uppercase whitespace-nowrap max-w-[90%] truncate" data-testid="ext-card-badge">
                    {badge}
                  </span>
                )}
                <div className="text-2xl font-black text-[#0A0A0A] mb-1">{tld}</div>
                <div className="text-[11px] text-[#999] mb-3 leading-tight" data-testid="ext-card-desc">{label}</div>
                <div className="text-[13px] font-bold text-[#0A0A0A] mb-4" data-testid="ext-card-price">{fmtAOA(priceNum)}<span className="whitespace-nowrap">/1.º ano</span></div>
                <button
                  data-testid="ext-card-register"
                  onClick={() => handleRegisterTld(tld)}
                  className="w-full py-2 rounded-xl text-xs font-bold transition-all duration-200 border"
                  style={{ background: popular ? '#F5B700' : 'transparent', borderColor: popular ? '#F5B700' : '#D0D0D0', color: popular ? '#0A0A0A' : '#444' }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.background = '#F5B700'; el.style.borderColor = '#F5B700'; el.style.color = '#0A0A0A' }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.background = popular ? '#F5B700' : 'transparent'; el.style.borderColor = popular ? '#F5B700' : '#D0D0D0'; el.style.color = popular ? '#0A0A0A' : '#444' }}
                >
                  Registar
                </button>
              </div>
            ))}
          </div>

          {page ? (
            <nav className="flex flex-wrap justify-center gap-2" aria-label="Outras acções de domínios" data-testid="domain-actions">
              {[['/dominios/pesquisar', 'Pesquisar e registar'], ['/dominios/transferir', 'Transferir'], ['/dominios/renovar', 'Renovar'], ['#gestao', 'Gestão e segurança'], ['/dominios/precos', 'Tabela de preços']].map(([h, l]) => (
                <a key={h} href={h} className="px-4 py-2 rounded-xl text-sm font-bold border border-[#E2E2E2] bg-white text-[#0A0A0A] hover:border-[#F5B700]">{l}</a>
              ))}
            </nav>
          ) : (<>
          {/* CTA link */}
          <div className="text-center mb-16">
            <a href="/dominios" className="inline-flex items-center gap-2 text-[#F5B700] font-bold text-sm hover:gap-3 transition-all duration-200">
              Ver todos os domínios e preços <span>→</span>
            </a>
          </div>

          {/* Benefits bar */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-[#F0F0F0] rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.06)' }}
          >
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white px-6 py-6 flex flex-col items-center text-center gap-3 group hover:bg-[#FAFAFA] transition-colors duration-200">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200" style={{ background: '#FFF8E1' }}>
                  <Icon size={20} className="text-[#F5B700]" />
                </div>
                <div>
                  <p className="text-[#0A0A0A] font-bold text-sm leading-tight mb-1">{title}</p>
                  <p className="text-[#999] text-xs leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          </>)}
        </div>
      </section>
    </>
  )
}
