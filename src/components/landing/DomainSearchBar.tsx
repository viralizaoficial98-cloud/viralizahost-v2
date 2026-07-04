'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Shield, Zap, Headphones, Lock, Globe, RefreshCw, Server } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCheckoutStore } from '@/store/checkoutStore'

type ExtItem = { tld: string; label: string; price: string; popular: boolean }

const defaultExtensions: ExtItem[] = [
  { tld: '.com',    label: 'O mais popular',     price: 'Kz 4.500/ano',  popular: true  },
  { tld: '.net',    label: 'Tecnologia & redes', price: 'Kz 5.200/ano',  popular: false },
  { tld: '.org',    label: 'Organizações',       price: 'Kz 4.800/ano',  popular: false },
  { tld: '.ao',     label: 'Angola oficial',     price: 'Kz 8.000/ano',  popular: true  },
  { tld: '.com.br', label: 'Brasil',             price: 'R$ 49/ano',     popular: false },
  { tld: '.io',     label: 'Startups & tech',    price: 'Kz 18.000/ano', popular: false },
]

const currencySymbol: Record<string, string> = { AOA: 'Kz', USD: '$', BRL: 'R$', EUR: '€' }

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
  const [query, setQuery] = useState('')
  const [extensions, setExtensions] = useState<ExtItem[]>(defaultExtensions)
  const router = useRouter()
  const { setItems, setDomainName, setDomainAction, setStep } = useCheckoutStore()

  useEffect(() => {
    const supabase = createClient()
    supabase.from('site_domains').select('*').eq('active', true).order('position')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setExtensions(data.map((d: any) => ({
            tld: d.extension,
            label: d.popular ? 'Angola oficial' : d.extension,
            price: `${currencySymbol[d.currency] ?? d.currency} ${(d.price_annual ?? d.price_monthly ?? 0).toLocaleString('pt-AO')}/ano`,
            popular: d.popular ?? false,
          })))
        }
      })
  }, [])

  const handleSearch = () => {
    if (!query.trim()) return
    setItems([{ id: 'domain-search', name: `Domínio ${query.trim()}`, type: 'domain', price: 4500, currency: 'AOA', quantity: 1 }])
    setDomainName(query.trim())
    setDomainAction('register')
    setStep(1)
    router.push(`/checkout?plan=domain-search`)
  }

  const handleRegisterTld = (tld: string, price: string) => {
    const name = query.trim() ? `${query.trim()}${tld}` : tld
    setItems([{ id: `domain${tld}`, name: `Domínio ${name}`, type: 'domain', price: 4500, currency: 'AOA', quantity: 1 }])
    setDomainAction('register')
    if (query.trim()) setDomainName(name)
    setStep(1)
    router.push(`/checkout?plan=domain${tld}`)
  }

  return (
    <>
      {/* Premium LED wave separator */}
      <div className="relative w-full overflow-hidden" style={{ background: '#000000', marginBottom: '-1px' }}>
        <style>{`
          @keyframes wave-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.72; }
          }
          @keyframes wave-shift {
            0%, 100% { transform: translateX(0px); }
            50% { transform: translateX(6px); }
          }
          .led-wave-glow { animation: wave-pulse 3.5s ease-in-out infinite; }
          .led-wave-line { animation: wave-shift 6s ease-in-out infinite; }
        `}</style>
        <svg
          viewBox="0 0 1440 56"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full block"
          style={{ height: 56 }}
        >
          <defs>
            {/* Outer bloom — widest, softest */}
            <filter id="glow-bloom" x="-10%" y="-200%" width="120%" height="500%">
              <feGaussianBlur stdDeviation="10" result="bloom" />
            </filter>
            {/* Mid glow */}
            <filter id="glow-mid" x="-5%" y="-150%" width="110%" height="400%">
              <feGaussianBlur stdDeviation="5" result="mid" />
            </filter>
            {/* Inner crisp glow */}
            <filter id="glow-inner" x="-2%" y="-80%" width="104%" height="260%">
              <feGaussianBlur stdDeviation="2" result="inner" />
            </filter>
          </defs>

          {/* White fill — domain section background */}
          <path
            d="M0,56 L0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22 L1440,56 Z"
            fill="#ffffff"
          />

          {/* Layer 1 — outer bloom (widest, most diffuse, amber) */}
          <path
            className="led-wave-glow"
            d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22"
            fill="none"
            stroke="#F5B700"
            strokeWidth="12"
            filter="url(#glow-bloom)"
            opacity="0.25"
          />

          {/* Layer 2 — mid glow (yellow) */}
          <path
            className="led-wave-glow"
            d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22"
            fill="none"
            stroke="#F5B700"
            strokeWidth="6"
            filter="url(#glow-mid)"
            opacity="0.55"
          />

          {/* Layer 3 — inner glow (brighter yellow) */}
          <path
            className="led-wave-glow"
            d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22"
            fill="none"
            stroke="#FFD54F"
            strokeWidth="3"
            filter="url(#glow-inner)"
            opacity="0.85"
          />

          {/* Layer 4 — white core (LED hotspot) */}
          <path
            className="led-wave-line"
            d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            opacity="0.7"
          />

          {/* Layer 5 — solid yellow main line */}
          <path
            className="led-wave-line"
            d="M0,38 C180,20 360,8 540,12 C720,16 900,36 1080,32 C1260,28 1350,18 1440,22"
            fill="none"
            stroke="#F5B700"
            strokeWidth="2"
            opacity="1"
          />
        </svg>
      </div>

      {/* Domain Section */}
      <section className="bg-white pt-0 pb-20">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8">

          {/* Heading */}
          <div className="text-center mb-12 pt-4">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#F5B700]" />
              <p className="text-[#F5B700] text-xs font-bold tracking-widest uppercase">Registo de Domínios</p>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#F5B700]" />
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#0A0A0A] leading-tight mb-4">
              Encontre o{' '}
              <span className="text-[#F5B700]">domínio ideal</span>
              {' '}para<br className="hidden md:block" /> o seu negócio
            </h2>
            <p className="text-[#666] text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
              Pesquise, registe e proteja o nome da sua marca com rapidez,<br className="hidden md:block" /> segurança e o melhor preço.
            </p>
          </div>

          {/* Search bar */}
          <div className="max-w-3xl mx-auto mb-5">
            <div
              className="flex items-center bg-white rounded-[20px] border border-[#E8E8E8] overflow-hidden transition-all duration-200"
              style={{
                height: 72,
                boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(245,183,0,0.08)',
              }}
            >
              <div className="flex items-center pl-5 pr-3 shrink-0">
                <Search size={22} className="text-[#BBB]" />
              </div>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Digite o nome do domínio desejado"
                className="flex-1 text-[#0A0A0A] text-base md:text-lg outline-none bg-transparent placeholder:text-[#C0C0C0] pr-3"
              />
              <div className="pr-2 shrink-0">
                <button
                  onClick={handleSearch}
                  className="h-[54px] px-7 rounded-[14px] font-bold text-sm md:text-base text-[#0A0A0A] transition-all duration-200 flex items-center gap-2 shrink-0"
                  style={{
                    background: '#F5B700',
                    boxShadow: '0 4px 20px rgba(245,183,0,0.35)',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.background = '#0A0A0A'
                    el.style.color = '#F5B700'
                    el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.background = '#F5B700'
                    el.style.color = '#0A0A0A'
                    el.style.boxShadow = '0 4px 20px rgba(245,183,0,0.35)'
                  }}
                >
                  <Search size={16} />
                  Pesquisar Domínio
                </button>
              </div>
            </div>
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
                  boxShadow: popular
                    ? '0 4px 24px rgba(245,183,0,0.18)'
                    : '0 2px 12px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget
                  el.style.borderColor = '#F5B700'
                  el.style.boxShadow = '0 8px 32px rgba(245,183,0,0.22)'
                  el.style.transform = 'translateY(-3px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget
                  el.style.borderColor = popular ? '#F5B700' : '#EBEBEB'
                  el.style.boxShadow = popular
                    ? '0 4px 24px rgba(245,183,0,0.18)'
                    : '0 2px 12px rgba(0,0,0,0.05)'
                  el.style.transform = 'translateY(0)'
                }}
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
                  onClick={() => handleRegisterTld(tld, price)}
                  className="w-full py-2 rounded-xl text-xs font-bold transition-all duration-200 border"
                  style={{
                    background: popular ? '#F5B700' : 'transparent',
                    borderColor: popular ? '#F5B700' : '#D0D0D0',
                    color: popular ? '#0A0A0A' : '#444',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.background = '#F5B700'
                    el.style.borderColor = '#F5B700'
                    el.style.color = '#0A0A0A'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.background = popular ? '#F5B700' : 'transparent'
                    el.style.borderColor = popular ? '#F5B700' : '#D0D0D0'
                    el.style.color = popular ? '#0A0A0A' : '#444'
                  }}
                >
                  Registar
                </button>
              </div>
            ))}
          </div>

          {/* CTA link */}
          <div className="text-center mb-16">
            <a
              href="/dominios"
              className="inline-flex items-center gap-2 text-[#F5B700] font-bold text-sm hover:gap-3 transition-all duration-200"
            >
              Ver todos os domínios disponíveis
              <span>→</span>
            </a>
          </div>

          {/* Benefits bar */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-px bg-[#F0F0F0] rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.06)' }}
          >
            {benefits.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="bg-white px-6 py-6 flex flex-col items-center text-center gap-3 group hover:bg-[#FAFAFA] transition-colors duration-200"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200"
                  style={{ background: '#FFF8E1' }}
                >
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
