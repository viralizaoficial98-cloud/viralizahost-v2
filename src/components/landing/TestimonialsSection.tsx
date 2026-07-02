'use client'
import { useState, useEffect, useCallback } from 'react'
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'António Sebastião',
    role: 'CEO, TechLuanda',
    avatar: 'AS',
    flag: '🇦🇴',
    country: 'Angola',
    rating: 5,
    text: 'A ViralizaHost transformou completamente a performance do nosso site. O LiteSpeed é incrível — carregamento 3× mais rápido! O suporte técnico é excelente e sempre disponível. A melhor decisão que tomámos para a nossa empresa.',
    plan: 'Business Cloud',
    accent: '#F5B700',
  },
  {
    name: 'Marina Oliveira',
    role: 'Diretora Digital, ShopBrasil',
    avatar: 'MO',
    flag: '🇧🇷',
    country: 'Brasil',
    rating: 5,
    text: 'Migrei minha loja virtual para a ViralizaHost e os resultados foram imediatos. Zero downtime na migração, velocidade muito superior e preço justo em BRL. O cPanel é completo e fácil de usar. Super recomendo!',
    plan: 'Cloud Pro',
    accent: '#10B981',
  },
  {
    name: 'James Carter',
    role: 'Founder, CartDigital',
    avatar: 'JC',
    flag: '🇺🇸',
    country: 'United States',
    rating: 5,
    text: 'ViralizaHost exceeded every expectation. Rock-solid uptime, lightning-fast LiteSpeed servers, and a support team that replies in minutes. We\'ve hosted 12 client websites here and haven\'t looked back.',
    plan: 'Reseller WHM',
    accent: '#3B82F6',
  },
  {
    name: 'Sophie Marchand',
    role: 'Directrice, AtelierWeb Paris',
    avatar: 'SM',
    flag: '🇫🇷',
    country: 'France',
    rating: 5,
    text: 'Nous avons migré notre agence vers ViralizaHost il y a six mois. La performance est remarquable, le support répond en quelques minutes et les sauvegardes automatiques nous donnent une tranquillité totale. Parfait !',
    plan: 'Cloud Pro',
    accent: '#EF4444',
  },
  {
    name: 'Lukas Becker',
    role: 'CTO, DigitalMind GmbH',
    avatar: 'LB',
    flag: '🇩🇪',
    country: 'Deutschland',
    rating: 5,
    text: 'Hervorragende Performance und absolut zuverlässiger Support. Die LiteSpeed-Server sind deutlich schneller als bei unserem alten Anbieter. SSL, tägliche Backups und PHP-Flexibilität — alles inklusive. Klare Empfehlung!',
    plan: 'Business Cloud',
    accent: '#8B5CF6',
  },
  {
    name: 'Ricardo Ferreira',
    role: 'Dev Full Stack, PortugalTech',
    avatar: 'RF',
    flag: '🇵🇹',
    country: 'Portugal',
    rating: 5,
    text: 'Como programador, a ViralizaHost surpreendeu-me pela estabilidade e pelos recursos técnicos disponíveis. SSH, Git, PHP atualizado e SSL gratuito incluídos. Já migrei todos os projetos dos meus clientes para cá.',
    plan: 'Reseller WHM',
    accent: '#06B6D4',
  },
  {
    name: 'Carlos Menéndez',
    role: 'CEO, IberiaDigital',
    avatar: 'CM',
    flag: '🇪🇸',
    country: 'España',
    rating: 5,
    text: 'ViralizaHost nos ofrece el rendimiento que necesitamos para escalar nuestros proyectos. El soporte en español es excelente, los servidores son ultrarrápidos y el precio es muy competitivo. ¡Totalmente recomendado!',
    plan: 'Cloud Pro',
    accent: '#F59E0B',
  },
  {
    name: 'Oliver Hughes',
    role: 'Managing Director, NexaHosting UK',
    avatar: 'OH',
    flag: '🇬🇧',
    country: 'United Kingdom',
    rating: 5,
    text: 'We\'ve tried several hosting providers over the years, but ViralizaHost stands out for its reliability and customer care. 99.9% uptime guarantee is actually delivered. The LiteSpeed stack is a genuine game-changer.',
    plan: 'Business Cloud',
    accent: '#EC4899',
  },
  {
    name: 'Fernanda Costa',
    role: 'Criadora de Conteúdo',
    avatar: 'FC',
    flag: '🇧🇷',
    country: 'Brasil',
    rating: 5,
    text: 'Meu blog cresceu muito com a ViralizaHost. O LiteSpeed com cache deixou o site muito mais rápido no Google. O preço é acessível para quem está começando e o suporte respondeu em menos de 5 minutos. Indico para todos!',
    plan: 'Starter Host',
    accent: '#10B981',
  },
  {
    name: 'João Manuel',
    role: 'Gestor IT, Empresa Petrolífera',
    avatar: 'JM',
    flag: '🇦🇴',
    country: 'Angola',
    rating: 5,
    text: 'Confiamos a nossa infraestrutura web à ViralizaHost há 2 anos. Uptime de 100% no último ano, protecção DDoS que bloqueou vários ataques e suporte técnico de alto nível. A melhor decisão que tomámos para a nossa TI.',
    plan: 'Cloud Pro',
    accent: '#F5B700',
  },
]

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(count)].map((_, i) => (
        <Star key={i} size={13} className="text-[#F5B700] fill-[#F5B700]" />
      ))}
    </div>
  )
}

const VISIBLE = 3
const TOTAL = testimonials.length
const AUTO_INTERVAL = 5000

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)

  const go = useCallback((next: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setCurrent(((next % TOTAL) + TOTAL) % TOTAL)
      setAnimating(false)
    }, 280)
  }, [animating])

  const prev = () => go(current - 1)
  const next = () => go(current + 1)

  /* auto-advance */
  useEffect(() => {
    const t = setInterval(() => go(current + 1), AUTO_INTERVAL)
    return () => clearInterval(t)
  }, [current, go])

  const visible = Array.from({ length: VISIBLE }, (_, i) => testimonials[(current + i) % TOTAL])

  return (
    <section id="depoimentos" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      {/* subtle world-dot bg */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, #0A0A0A 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

      <div className="container mx-auto px-4 relative">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex items-center gap-2">
            🌍 Depoimentos Globais
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Clientes de todo o <span className="gradient-text">Mundo</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto">
            +5.000 clientes satisfeitos em Angola, Brasil e mais 6 países. Veja o que dizem.
          </p>

          {/* flag strip */}
          <div className="flex items-center justify-center flex-wrap gap-3 mt-6">
            {['🇦🇴','🇧🇷','🇺🇸','🇫🇷','🇩🇪','🇵🇹','🇪🇸','🇬🇧'].map((f) => (
              <span key={f} className="text-2xl leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10"
          style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.28s ease' }}
        >
          {visible.map((t, i) => (
            <div key={`${t.name}-${current}-${i}`}
              className="card-light p-7 hover-lift relative overflow-hidden flex flex-col">

              {/* accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl" style={{ background: t.accent }} />

              {/* decorative quote */}
              <Quote size={26} className="absolute top-5 right-5 opacity-[0.07] text-[#0A0A0A]" />

              {/* country badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl leading-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }}>
                  {t.flag}
                </span>
                <span className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full"
                  style={{ background: `${t.accent}12`, color: t.accent, border: `1px solid ${t.accent}30` }}>
                  {t.country}
                </span>
                <div className="flex-1" />
                <StarRating count={t.rating} />
              </div>

              {/* quote text */}
              <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-5">
                &ldquo;{t.text}&rdquo;
              </p>

              {/* plan badge */}
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 self-start"
                style={{ background: `${t.accent}12`, color: t.accent, border: `1px solid ${t.accent}25` }}>
                ✓ {t.plan}
              </div>

              {/* author */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#F0F0F0]">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
                  style={{ background: t.accent }}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-[#0A0A0A] font-bold text-sm">{t.name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prev}
            className="w-11 h-11 rounded-2xl bg-white border border-[#E8E8E8] flex items-center justify-center text-gray-500 hover:border-[#F5B700] hover:text-[#B88900] transition-all shadow-sm"
            aria-label="Anterior">
            <ChevronLeft size={18} />
          </button>

          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => go(i)}
                aria-label={`Depoimento ${i + 1}`}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 28 : 8,
                  background: i === current ? '#F5B700' : '#E0E0E0',
                }}
              />
            ))}
          </div>

          <button onClick={next}
            className="w-11 h-11 rounded-2xl bg-white border border-[#E8E8E8] flex items-center justify-center text-gray-500 hover:border-[#F5B700] hover:text-[#B88900] transition-all shadow-sm"
            aria-label="Próximo">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* total count */}
        <p className="text-center text-gray-400 text-xs mt-5 font-medium">
          {current + 1} — {TOTAL} depoimentos verificados
        </p>
      </div>
    </section>
  )
}
