'use client'
import { useEffect, useRef, useState } from 'react'

const stats = [
  { value: 5000, suffix: '+', label: 'Clientes Ativos', description: 'Angola, Brasil e + países' },
  { value: 99.9, suffix: '%', label: 'Uptime Garantido', description: 'SLA com garantia contratual' },
  { value: 24, suffix: '/7', label: 'Suporte Técnico', description: 'Equipe sempre disponível' },
  { value: 10, suffix: 'x', label: 'Mais Rápido', description: 'LiteSpeed vs Apache' },
]

function Counter({ end, suffix, duration = 2000 }: { end: number; suffix: string; duration?: number }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = Date.now()
          const step = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * end * 10) / 10)
            if (progress < 1) requestAnimationFrame(step)
            else setCount(end)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{count % 1 === 0 ? count.toFixed(0) : count.toFixed(1)}{suffix}</span>
}

export function StatsSection() {
  return (
    <section className="py-16 bg-[#0A0A0A] relative overflow-hidden">
      {/* Yellow top line */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#F5B700] to-transparent" />

      {/* Subtle pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(245,183,0,0.8) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="container mx-auto px-4 relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={stat.label} className="text-center group">
              <div className="text-4xl lg:text-5xl font-black text-[#F5B700] mb-2">
                <Counter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-white font-bold text-base mb-1">{stat.label}</div>
              <div className="text-gray-500 text-sm">{stat.description}</div>
              {i < stats.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-12 bg-[#222]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Yellow bottom line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F5B700]/30 to-transparent" />
    </section>
  )
}
