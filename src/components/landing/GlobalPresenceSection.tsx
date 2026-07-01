'use client'
import { useRef, useEffect, useState } from 'react'

const stats = [
  { value: 20, suffix: '+', label: 'Países atendidos' },
  { value: 5000, suffix: '+', label: 'Clientes activos' },
  { value: 99.9, suffix: '%', label: 'Uptime garantido', decimal: true },
  { value: 24, suffix: '/7', label: 'Suporte disponível' },
]

const countries = [
  { flag: '🇦🇴', name: 'Angola' },
  { flag: '🇧🇷', name: 'Brasil' },
  { flag: '🇵🇹', name: 'Portugal' },
  { flag: '🇺🇸', name: 'EUA' },
  { flag: '🇬🇧', name: 'UK' },
  { flag: '🇨🇦', name: 'Canadá' },
  { flag: '🇫🇷', name: 'França' },
  { flag: '🇩🇪', name: 'Alemanha' },
]

function AnimatedCounter({ value, suffix, decimal }: { value: number; suffix: string; decimal?: boolean }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1800
        const steps = 60
        const increment = value / steps
        let current = 0
        const timer = setInterval(() => {
          current += increment
          if (current >= value) {
            setCount(value)
            clearInterval(timer)
          } else {
            setCount(Math.floor(current * (decimal ? 10 : 1)) / (decimal ? 10 : 1))
          }
        }, duration / steps)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, decimal])

  return (
    <span ref={ref}>
      {decimal ? count.toFixed(1) : count.toLocaleString('pt-BR')}{suffix}
    </span>
  )
}

export function GlobalPresenceSection() {
  return (
    <section className="bg-[#0A0A0A] py-20 relative overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#F5B700 1px, transparent 1px), linear-gradient(90deg, #F5B700 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(245,183,0,0.06),transparent)]" />

      <div className="relative container mx-auto px-4">
        <div className="text-center mb-14">
          <span className="section-tag !bg-yellow-400/10 !text-yellow-400 !border-yellow-400/20">Presença Global</span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-3 mb-4">
            Viraliza chega onde o seu negócio precisa
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto text-sm md:text-base">
            Infraestrutura distribuída globalmente para garantir baixa latência e alta disponibilidade em qualquer continente.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
          {stats.map(({ value, suffix, label, decimal }) => (
            <div key={label} className="text-center bg-[#111] border border-[#1E1E1E] rounded-2xl py-7 px-4">
              <div className="text-3xl md:text-4xl font-black text-[#F5B700] mb-2">
                <AnimatedCounter value={value} suffix={suffix} decimal={decimal} />
              </div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* World map visual — simplified SVG continents */}
        <div className="rounded-3xl bg-[#0D0D0D] border border-[#1A1A1A] p-6 md:p-10 mb-10 overflow-hidden relative">
          <svg viewBox="0 0 900 400" className="w-full opacity-60" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Americas */}
            <path d="M120,60 Q140,40 160,55 L175,100 Q185,130 170,160 L155,200 Q145,240 150,280 Q155,320 140,350 L110,340 Q95,300 100,260 L95,220 Q80,180 85,140 Z" fill="#1E1E1E" stroke="#2A2A2A" strokeWidth="1"/>
            <path d="M160,55 Q200,45 220,70 L230,120 Q240,150 220,170 L190,165 Q175,155 175,100 Z" fill="#1E1E1E" stroke="#2A2A2A" strokeWidth="1"/>
            {/* Europe */}
            <path d="M400,50 Q440,40 470,60 L475,90 Q480,110 460,120 L445,130 Q430,125 420,110 L405,90 Z" fill="#1E1E1E" stroke="#2A2A2A" strokeWidth="1"/>
            {/* Africa */}
            <path d="M420,140 Q460,130 490,150 L510,200 Q520,250 510,300 L490,340 Q465,360 440,345 L415,310 Q400,270 405,220 L410,170 Z" fill="#1E1E1E" stroke="#2A2A2A" strokeWidth="1"/>
            {/* Asia */}
            <path d="M510,50 Q580,35 680,45 L750,70 Q790,90 800,130 L790,160 Q770,180 740,175 L680,165 Q630,155 580,145 L540,130 Q510,115 505,90 Z" fill="#1E1E1E" stroke="#2A2A2A" strokeWidth="1"/>
            {/* Australia */}
            <path d="M720,260 Q760,245 800,260 L820,300 Q825,330 800,345 L760,350 Q730,345 718,320 Z" fill="#1E1E1E" stroke="#2A2A2A" strokeWidth="1"/>

            {/* Data points — yellow dots */}
            {[
              [450, 160], [445, 175], [140, 150], [180, 120], [550, 100], [680, 120], [750, 290], [430, 80],
            ].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="6" fill="#F5B700" opacity="0.9"/>
                <circle cx={cx} cy={cy} r="12" fill="#F5B700" opacity="0.2"/>
                <circle cx={cx} cy={cy} r="18" fill="#F5B700" opacity="0.07"/>
              </g>
            ))}

            {/* Connection lines */}
            {[
              [[450, 160], [140, 150]],
              [[450, 160], [550, 100]],
              [[450, 160], [750, 290]],
              [[450, 160], [180, 120]],
            ].map(([[x1, y1], [x2, y2]], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F5B700" strokeWidth="1" strokeDasharray="4 6" opacity="0.25"/>
            ))}
          </svg>
        </div>

        {/* Country flags */}
        <div className="flex flex-wrap justify-center gap-3">
          {countries.map(({ flag, name }) => (
            <div key={name} className="flex items-center gap-2 bg-[#111] border border-[#1E1E1E] rounded-xl px-4 py-2.5 text-sm text-gray-400">
              <span className="text-lg">{flag}</span>
              <span className="font-medium">{name}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 bg-[#111] border border-[#F5B700]/20 rounded-xl px-4 py-2.5 text-sm text-[#F5B700]">
            <span>🌍</span>
            <span className="font-medium">+12 países</span>
          </div>
        </div>
      </div>
    </section>
  )
}
