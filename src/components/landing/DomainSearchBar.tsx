'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Shield, Zap, Headphones, Lock, Globe, RefreshCw, Check, X, Loader2, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from '@/hooks/useLocale'
import { convertFromAOA } from '@/lib/currency'

type ExtItem = { tld: string; label: string; price: string; priceNum: number; currency: string; popular: boolean }

const defaultExtensions: ExtItem[] = [
  { tld: '.com',    label: 'O mais popular',     price: 'Kz 4.500/ano',  priceNum: 4500,  currency: 'AOA', popular: true  },
  { tld: '.net',    label: 'Tecnologia & redes', price: 'Kz 5.200/ano',  priceNum: 5200,  currency: 'AOA', popular: false },
  { tld: '.org',    label: 'Organizações',       price: 'Kz 4.800/ano',  priceNum: 4800,  currency: 'AOA', popular: false },
  { tld: '.ao',     label: 'Angola oficial',     price: 'Kz 8.000/ano',  priceNum: 8000,  currency: 'AOA', popular: true  },
  { tld: '.com.br', label: 'Brasil',             price: 'R$ 49/ano',     priceNum: 4900,  currency: 'BRL', popular: false },
  { tld: '.io',     label: 'Startups & tech',    price: 'Kz 18.000/ano', priceNum: 18000, currency: 'AOA', popular: false },
]

const currencySymbol: Record<string, string> = { AOA: 'Kz', AKZ: 'Kz', USD: '$', BRL: 'R$', EUR: '€' }

// Suggested TLDs to show when user types without extension
const SUGGEST_TLDS = ['.com', '.ao', '.net', '.org', '.io']

type CheckResult = { tld: string; domain: string; available: boolean | null; loading: boolean }

const benefits = [
  { icon: Lock, title: 'Protecção de Privacidade', desc: 'WHOIS protegido e dados ocultos' },
  { icon: Globe, title: 'DNS Premium', desc: 'Propagação ultrarrápida' },
  { icon: Shield, title: 'Segurança Avançada', desc: 'DNSSEC activado por padrão' },
  { icon: RefreshCw, title: 'Renovação Automática', desc: 'Nunca perca o seu domínio' },
  { icon: Headphones, title: 'Suporte Especializado', desc: 'Equipa técnica 24/7' },
]

const trustItems = [
  { icon: Shield, text: 'Pesquisa 100% segura' },
  { icon: Zap, text: 'Activação rápida' },
  { icon: Headphones, text: 'Suporte especializado' },
]

export function DomainSearchBar() {
  const { formatCurrency, currency } = useLocale()
  const fmtAOA = (n: number) => formatCurrency(convertFromAOA(n, currency))
  const [query, setQuery] = useState('')
  const [extensions, setExtensions] = useState<ExtItem[]>(defaultExtensions)
  const [results, setResults] = useState<CheckResult[]>([])
  const [searching, setSearching] = useState(false)
  const [revealed, setRevealed] = useState<boolean[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.from('site_domains').select('*').eq('active', true).order('position')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setExtensions(data.map((d: any) => {
            const priceNum = d.price_annual ?? d.price_monthly ?? 0
            const sym = currencySymbol[d.currency] ?? d.currency
            return {
              tld: d.extension,
              label: d.label || d.extension,
              price: `${fmtAOA(priceNum)}/ano`,
              priceNum,
              currency: d.currency,
              popular: d.popular ?? false,
            }
          }))
        }
      })
  }, [])

  function getExtByTld(tld: string): ExtItem {
    return extensions.find(e => e.tld === tld) ?? defaultExtensions.find(e => e.tld === tld) ?? defaultExtensions[0]
  }

  async function handleSearch() {
    const q = query.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!q) return

    // Cancel previous search
    if (abortRef.current) abortRef.current.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setSearching(true)
    setResults([])

    // Determine which TLDs to check
    const allTlds = extensions.map(e => e.tld)
    const matchedTld = allTlds.find(tld => q.endsWith(tld))
    let tlds: string[]
    let baseName: string

    if (matchedTld) {
      // User typed full domain — check that TLD plus alternatives
      baseName = q.slice(0, q.length - matchedTld.length)
      const others = SUGGEST_TLDS.filter(t => t !== matchedTld).slice(0, 3)
      tlds = [matchedTld, ...others]
    } else {
      // No extension — suggest defaults
      baseName = q
      tlds = SUGGEST_TLDS
    }

    // Seed skeleton state — all loading
    const initial: CheckResult[] = tlds.map(tld => ({
      tld,
      domain: `${baseName}${tld}`,
      available: null,
      loading: true,
    }))
    setResults(initial)
    setRevealed(tlds.map(() => false))
    setSearching(false)

    // Stagger reveal: each row slides in 120ms apart after a 200ms initial delay
    tlds.forEach((_, idx) => {
      setTimeout(() => {
        setRevealed(prev => { const next = [...prev]; next[idx] = true; return next })
      }, 200 + idx * 120)
    })

    // Fire checks in parallel
    await Promise.allSettled(tlds.map(async (tld, idx) => {
      const domain = `${baseName}${tld}`
      try {
        const res = await fetch(`/api/checkout/domain-check?domain=${encodeURIComponent(domain)}`, {
          signal: abort.signal,
        })
        const json = await res.json()
        setResults(prev => prev.map((r, i) => i === idx ? { ...r, available: json.available, loading: false } : r))
      } catch {
        setResults(prev => prev.map((r, i) => i === idx ? { ...r, available: true, loading: false } : r))
      }
    }))
  }

  function goToCheckout(domain: string, tld: string) {
    router.push(`/checkout?tld=${encodeURIComponent(tld)}&domain=${encodeURIComponent(domain)}`)
  }

  function handleRegisterTld(tld: string) {
    const domainName = query.trim() ? `${query.trim()}${tld}` : ''
    const url = domainName
      ? `/checkout?tld=${encodeURIComponent(tld)}&domain=${encodeURIComponent(domainName)}`
      : `/checkout?tld=${encodeURIComponent(tld)}`
    router.push(url)
  }

  return (
    <>
      {/* Premium LED wave separator */}
      <div className="relative w-full overflow-hidden" style={{ background: '#000000', marginBottom: '-1px' }}>
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
      </div>

      {/* Domain Section */}
      <section className="bg-white pt-0 pb-20">
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
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0A0A0A] leading-tight mb-4">
              Encontre o{' '}<span className="text-[#F5B700]">domínio ideal</span>{' '}para<br className="hidden md:block" /> o seu negócio
            </h2>
            <p className="text-[#666] text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Pesquise, registe e proteja o nome da sua marca com rapidez,<br className="hidden md:block" /> segurança e o melhor preço.
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-3xl mx-auto mb-5">
            <div
              className="flex items-center bg-white rounded-[20px] border transition-all duration-300"
              style={{
                height: 72,
                borderColor: results.length > 0 ? '#F5B700' : '#E8E8E8',
                boxShadow: results.length > 0
                  ? '0 8px 40px rgba(245,183,0,0.18), 0 2px 8px rgba(245,183,0,0.10)'
                  : '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(245,183,0,0.08)',
              }}
            >
              <div className="flex items-center pl-5 pr-3 shrink-0">
                <Search size={22} className={`transition-colors duration-200 ${searching ? 'text-[#F5B700]' : 'text-[#BBB]'}`} />
              </div>
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setResults([]); setRevealed([]) }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Digite o nome do domínio desejado"
                className="flex-1 text-[#0A0A0A] text-base md:text-lg outline-none bg-transparent placeholder:text-[#C0C0C0] pr-3"
              />
              <div className="pr-2 shrink-0">
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="h-[54px] px-7 rounded-[14px] font-bold text-sm md:text-base transition-all duration-200 flex items-center gap-2 shrink-0"
                  style={{
                    background: searching ? '#0A0A0A' : '#F5B700',
                    color: searching ? '#F5B700' : '#0A0A0A',
                    boxShadow: '0 4px 20px rgba(245,183,0,0.35)',
                    minWidth: 180,
                    justifyContent: 'center',
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
                  const isAvailable = !isLoading && r.available === true
                  const isOccupied = !isLoading && r.available === false

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
                          isLoading ? 'bg-[#DDD]' : isAvailable ? 'bg-green-400' : 'bg-red-400'
                        }`} />
                        <span className="font-black text-[#0A0A0A] text-sm md:text-base truncate">{r.domain}</span>
                        {isLoading
                          ? <span className="skeleton-bar h-4 w-20 inline-block" />
                          : <span className="text-[#AAA] text-xs font-medium hidden sm:inline">{fmtAOA(ext.priceNum)}/ano</span>
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
                            <span className="flex items-center gap-1.5 text-green-600 text-xs font-bold">
                              <span className="check-pop inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100">
                                <Check size={10} className="text-green-600" />
                              </span>
                              <span className="hidden sm:inline">Disponível</span>
                            </span>
                            <button
                              onClick={() => goToCheckout(r.domain, r.tld)}
                              className="group flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all duration-200 hover:gap-2.5 hover:scale-105"
                              style={{ background: '#F5B700', color: '#0A0A0A', boxShadow: '0 2px 12px rgba(245,183,0,0.35)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#0A0A0A'; e.currentTarget.style.color = '#F5B700' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#F5B700'; e.currentTarget.style.color = '#0A0A0A' }}
                            >
                              Registar agora <ArrowRight size={11} />
                            </button>
                          </>
                        )}

                        {isOccupied && (
                          <span className="flex items-center gap-1.5 text-red-500 text-xs font-bold">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100">
                              <X size={10} className="text-red-500" />
                            </span>
                            Ocupado
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Footer hint */}
                <div className="px-5 py-3 bg-[#FAFAFA] border-t border-[#F0F0F0] flex items-center gap-2">
                  <Shield size={11} className="text-[#F5B700]" />
                  <span className="text-[#AAA] text-[11px]">Resultados em tempo real · Activação em minutos · SSL incluído</span>
                </div>
              </div>
            )}
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap justify-center gap-6 mb-14">
            {trustItems.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[#555] text-sm">
                <Icon size={14} className="text-[#F5B700]" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          {/* Extension cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {extensions.map(({ tld, label, price, popular }) => (
              <div
                key={tld}
                className="group relative flex flex-col items-center text-center bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-200"
                style={{
                  borderColor: popular ? '#F5B700' : '#EBEBEB',
                  boxShadow: popular ? '0 4px 24px rgba(245,183,0,0.18)' : '0 2px 12px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = '#F5B700'; el.style.boxShadow = '0 8px 32px rgba(245,183,0,0.22)'; el.style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = popular ? '#F5B700' : '#EBEBEB'; el.style.boxShadow = popular ? '0 4px 24px rgba(245,183,0,0.18)' : '0 2px 12px rgba(0,0,0,0.05)'; el.style.transform = 'translateY(0)' }}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F5B700] text-[#0A0A0A] text-[10px] font-black px-3 py-0.5 rounded-full tracking-wide uppercase">
                    Popular
                  </span>
                )}
                <div className="text-2xl font-black text-[#0A0A0A] mb-1">{tld}</div>
                <div className="text-[11px] text-[#999] mb-3 leading-tight">{label}</div>
                <div className="text-[13px] font-bold text-[#0A0A0A] mb-4">{price}</div>
                <button
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

        </div>
      </section>
    </>
  )
}
