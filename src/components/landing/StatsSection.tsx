'use client'
import { useEffect, useRef, useState } from 'react'

const stats = [
  { value: 5000, suffix: '+', label: 'Clientes Ativos', description: 'Em Angola, Brasil e + países' },
  { value: 99.9, suffix: '%', label: 'Uptime Garantido', description: 'SLA com garantia contratual' },
  { value: 24, suffix: '/7', label: 'Suporte Técnico', description: 'Equipe sempre disponível' },
  { value: 10, suffix: 'x', label: 'Mais Rápido', description: 'Com LiteSpeed vs Apache' },
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
    <section className="py-16 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl lg:text-5xl font-black text-white mb-1">
                <Counter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-indigo-200 font-bold text-lg mb-1">{stat.label}</div>
              <div className="text-indigo-300 text-sm">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
