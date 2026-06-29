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
  },
  {
    name: 'Marina Oliveira',
    role: 'Diretora Digital, ShopBrasil',
    avatar: 'MO',
    country: '🇧🇷',
    rating: 5,
    text: 'Migrei minha loja virtual para a ViralizaHost e os resultados foram imediatos. Zero downtime na migração, velocidade muito superior e o preço em BRL é muito justo. O cPanel é completo e fácil de usar. Excelente custo-benefício!',
    plan: 'Cloud Pro',
  },
  {
    name: 'Carlos Domingos',
    role: 'Desenvolvedor Full Stack',
    avatar: 'CD',
    country: '🇦🇴',
    rating: 5,
    text: 'Como desenvolvedor, valorizo muito a estabilidade e os recursos técnicos. A ViralizaHost oferece tudo: PHP atualizado, SSL automático, backups diários e SSH. O WHM para revenda é completo. Já migrei todos meus clientes para cá.',
    plan: 'Revenda WHM',
  },
  {
    name: 'Beatriz Santos',
    role: 'Empreendedora Digital',
    avatar: 'BS',
    country: '🇧🇷',
    rating: 5,
    text: 'Comecei com o plano Starter e em 3 meses já migrei para o Business Cloud. O suporte é incrível — responderam em menos de 5 minutos! O Softaculous facilitou muito a instalação do WordPress. Site carregando super rápido.',
    plan: 'Business Cloud',
  },
  {
    name: 'João Manuel',
    role: 'Gestor IT, Empresa Petrolífera',
    avatar: 'JM',
    country: '🇦🇴',
    rating: 5,
    text: 'Confiamos nossa infraestrutura web à ViralizaHost há 2 anos. Uptime de 100% no último ano, proteção DDoS que bloqueou vários ataques e suporte técnico de alto nível. A melhor decisão que tomamos para nossa TI.',
    plan: 'Cloud Pro',
  },
  {
    name: 'Fernanda Costa',
    role: 'Criadora de Conteúdo',
    avatar: 'FC',
    country: '🇧🇷',
    rating: 5,
    text: 'Meu blog cresceu muito com a ViralizaHost. O LiteSpeed com cache deixou o site muito mais rápido no Google. O preço é acessível para quem está começando e a escalabilidade é ótima. Super recomendo para criadores!',
    plan: 'Starter Host',
  },
]

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(count)].map((_, i) => (
        <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
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
    <section id="depoimentos" className="py-24 bg-slate-900 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      <div className="absolute inset-0">
        <div className="absolute top-20 right-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16">
          <span className="inline-block text-yellow-400 text-sm font-semibold tracking-widest uppercase mb-4 bg-yellow-950/50 px-4 py-2 rounded-full border border-yellow-800/50">
            ⭐ Depoimentos
          </span>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6">
            O Que Dizem os Nossos <span className="gradient-text">Clientes</span>
          </h2>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">
            +5.000 clientes satisfeitos em Angola, Brasil e outros países. Veja os depoimentos reais.
          </p>
        </div>

        {/* Testimonials grid (desktop: 3, mobile: 1) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {getVisible().map((t, i) => (
            <div key={`${t.name}-${i}`}
              className="relative bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 card-hover"
            >
              {/* Quote icon */}
              <Quote size={32} className="text-indigo-600/40 absolute top-6 right-6" />

              {/* Stars */}
              <StarRating count={t.rating} />

              {/* Text */}
              <p className="text-slate-300 text-sm leading-relaxed my-5 italic">&ldquo;{t.text}&rdquo;</p>

              {/* Plan badge */}
              <div className="inline-flex items-center gap-1.5 bg-indigo-950 border border-indigo-800 text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
                ✓ {t.plan}
              </div>

              {/* Author */}
              <div className="flex items-center gap-4 pt-4 border-t border-slate-700/50">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <div className="text-white font-bold">{t.country} {t.name}</div>
                  <div className="text-slate-500 text-sm">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prev}
            className="w-12 h-12 rounded-2xl glass border border-white/10 flex items-center justify-center text-white hover:border-indigo-500 hover:text-indigo-400 transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${i === current ? 'bg-indigo-500 w-8' : 'bg-slate-700 w-2 hover:bg-slate-500'}`}
              />
            ))}
          </div>
          <button onClick={next}
            className="w-12 h-12 rounded-2xl glass border border-white/10 flex items-center justify-center text-white hover:border-indigo-500 hover:text-indigo-400 transition-all">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  )
}
