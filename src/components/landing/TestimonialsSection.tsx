'use client'
import { useState } from 'react'
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'António Sebastião',
    role: 'CEO, TechLuanda',
    avatar: 'AS',
    country: '🇦🇴',
    rating: 5,
    text: 'A ViralizaHost transformou completamente a performance do nosso site. O LiteSpeed é incrível — carregamento 3x mais rápido! O suporte técnico é excelente, sempre disponíveis para ajudar. Recomendo fortemente para qualquer empresa angolana.',
    plan: 'Business Cloud',
    accent: '#F5B700',
  },
  {
    name: 'Marina Oliveira',
    role: 'Diretora Digital, ShopBrasil',
    avatar: 'MO',
    country: '🇧🇷',
    rating: 5,
    text: 'Migrei minha loja virtual para a ViralizaHost e os resultados foram imediatos. Zero downtime na migração, velocidade muito superior e o preço em BRL é muito justo. O cPanel é completo e fácil de usar. Excelente custo-benefício!',
    plan: 'Cloud Pro',
    accent: '#10B981',
  },
  {
    name: 'Carlos Domingos',
    role: 'Desenvolvedor Full Stack',
    avatar: 'CD',
    country: '🇦🇴',
    rating: 5,
    text: 'Como desenvolvedor, valorizo muito a estabilidade e os recursos técnicos. A ViralizaHost oferece tudo: PHP atualizado, SSL automático, backups diários e SSH. O WHM para revenda é completo. Já migrei todos meus clientes para cá.',
    plan: 'Revenda WHM',
    accent: '#8B5CF6',
  },
  {
    name: 'Beatriz Santos',
    role: 'Empreendedora Digital',
    avatar: 'BS',
    country: '🇧🇷',
    rating: 5,
    text: 'Comecei com o plano Starter e em 3 meses já migrei para o Business Cloud. O suporte é incrível — responderam em menos de 5 minutos! O Softaculous facilitou muito a instalação do WordPress. Site carregando super rápido.',
    plan: 'Business Cloud',
    accent: '#3B82F6',
  },
  {
    name: 'João Manuel',
    role: 'Gestor IT, Empresa Petrolífera',
    avatar: 'JM',
    country: '🇦🇴',
    rating: 5,
    text: 'Confiamos nossa infraestrutura web à ViralizaHost há 2 anos. Uptime de 100% no último ano, proteção DDoS que bloqueou vários ataques e suporte técnico de alto nível. A melhor decisão que tomamos para nossa TI.',
    plan: 'Cloud Pro',
    accent: '#EF4444',
  },
  {
    name: 'Fernanda Costa',
    role: 'Criadora de Conteúdo',
    avatar: 'FC',
    country: '🇧🇷',
    rating: 5,
    text: 'Meu blog cresceu muito com a ViralizaHost. O LiteSpeed com cache deixou o site muito mais rápido no Google. O preço é acessível para quem está começando e a escalabilidade é ótima. Super recomendo para criadores!',
    plan: 'Starter Host',
    accent: '#06B6D4',
  },
]

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(count)].map((_, i) => (
        <Star key={i} size={14} className="text-[#F5B700] fill-[#F5B700]" />
      ))}
    </div>
  )
}

export function TestimonialsSection() {
  const [current, setCurrent] = useState(0)
  const visible = 3
  const total = testimonials.length

  const prev = () => setCurrent(c => (c - 1 + total) % total)
  const next = () => setCurrent(c => (c + 1) % total)

  const getVisible = () => {
    const items = []
    for (let i = 0; i < visible; i++) {
      items.push(testimonials[(current + i) % total])
    }
    return items
  }

  return (
    <section id="depoimentos" className="py-24 bg-[#F8F8F8] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#E8E8E8] to-transparent" />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag mb-5 inline-flex">Depoimentos</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            O Que Dizem os Nossos <span className="gradient-text">Clientes</span>
          </h2>
          <p className="text-gray-500 text-xl max-w-2xl mx-auto">
            +5.000 clientes satisfeitos em Angola, Brasil e outros países. Veja os depoimentos reais.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {getVisible().map((t, i) => (
            <div key={`${t.name}-${i}`}
              className="card-light p-8 hover-lift relative overflow-hidden"
            >
              {/* Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl" style={{ background: t.accent }} />

              {/* Quote icon */}
              <Quote size={28} className="text-[#F0F0F0] absolute top-5 right-6" />

              {/* Stars */}
              <StarRating count={t.rating} />

              {/* Text */}
              <p className="text-gray-600 text-sm leading-relaxed my-5">&ldquo;{t.text}&rdquo;</p>

              {/* Plan badge */}
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
                style={{ background: `${t.accent}12`, color: t.accent, border: `1px solid ${t.accent}25` }}>
                ✓ {t.plan}
              </div>

              {/* Author */}
              <div className="flex items-center gap-4 pt-4 border-t border-[#F0F0F0]">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: t.accent }}>
                  {t.avatar}
                </div>
                <div>
                  <div className="text-[#0A0A0A] font-bold text-sm">{t.country} {t.name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prev}
            className="w-11 h-11 rounded-2xl bg-white border border-[#E8E8E8] flex items-center justify-center text-gray-500 hover:border-[#F5B700] hover:text-[#B88900] transition-all shadow-sm">
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${i === current ? 'bg-[#F5B700] w-8' : 'bg-[#E0E0E0] w-2 hover:bg-[#C0C0C0]'}`}
              />
            ))}
          </div>
          <button onClick={next}
            className="w-11 h-11 rounded-2xl bg-white border border-[#E8E8E8] flex items-center justify-center text-gray-500 hover:border-[#F5B700] hover:text-[#B88900] transition-all shadow-sm">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
