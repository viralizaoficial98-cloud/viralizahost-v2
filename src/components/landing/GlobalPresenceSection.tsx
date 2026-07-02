'use client'
import { useRef, useEffect, useState } from 'react'

const stats = [
  { value: 20, suffix: '+', label: 'Países Atendidos' },
  { value: 5000, suffix: '+', label: 'Clientes Ativos' },
  { value: 99.9, suffix: '%', label: 'Uptime Garantido', decimal: true },
  { value: 24, suffix: '/7', label: 'Suporte Disponível' },
]

// [x, y] in viewBox 0 0 1000 500, flag emoji, country name, slug
const nodes: { x: number; y: number; flag: string; name: string; id: string }[] = [
  { x: 185, y: 300, flag: '🇦🇴', name: 'Angola',     id: 'ao' },
  { x: 265, y: 330, flag: '🇧🇷', name: 'Brasil',     id: 'br' },
  { x: 445, y: 155, flag: '🇵🇹', name: 'Portugal',   id: 'pt' },
  { x: 195, y: 185, flag: '🇺🇸', name: 'EUA',        id: 'us' },
  { x: 458, y: 140, flag: '🇬🇧', name: 'Reino Unido',id: 'gb' },
  { x: 215, y: 155, flag: '🇨🇦', name: 'Canadá',     id: 'ca' },
  { x: 465, y: 148, flag: '🇫🇷', name: 'França',     id: 'fr' },
  { x: 485, y: 140, flag: '🇩🇪', name: 'Alemanha',   id: 'de' },
  { x: 228, y: 248, flag: '🇲🇽', name: 'México',     id: 'mx' },
  { x: 255, y: 280, flag: '🇨🇴', name: 'Colômbia',   id: 'co' },
  { x: 255, y: 365, flag: '🇨🇱', name: 'Chile',      id: 'cl' },
  { x: 262, y: 322, flag: '🇵🇪', name: 'Peru',       id: 'pe' },
  { x: 262, y: 345, flag: '🇧🇴', name: 'Bolívia',    id: 'bo' },
  { x: 278, y: 385, flag: '🇺🇾', name: 'Uruguai',    id: 'uy' },
  { x: 268, y: 380, flag: '🇦🇷', name: 'Argentina',  id: 'ar' },
  { x: 540, y: 148, flag: '🇹🇷', name: 'Turquia',    id: 'tr' },
  { x: 570, y: 125, flag: '🇷🇺', name: 'Rússia',     id: 'ru' },
  { x: 638, y: 215, flag: '🇮🇳', name: 'Índia',      id: 'in' },
  { x: 720, y: 195, flag: '🇨🇳', name: 'China',      id: 'cn' },
  { x: 755, y: 220, flag: '🇭🇰', name: 'Hong Kong',  id: 'hk' },
  { x: 750, y: 270, flag: '🇲🇾', name: 'Malásia',    id: 'my' },
  { x: 768, y: 265, flag: '🇸🇬', name: 'Singapura',  id: 'sg' },
  { x: 775, y: 288, flag: '🇮🇩', name: 'Indonésia',  id: 'id' },
]

// Hub nodes that have many connections drawn from them
const hubIds = ['pt', 'us', 'br', 'cn']

const connections: [string, string][] = [
  ['pt', 'ao'], ['pt', 'br'], ['pt', 'gb'], ['pt', 'fr'],
  ['pt', 'de'], ['pt', 'us'], ['pt', 'tr'], ['pt', 'ru'],
  ['us', 'ca'], ['us', 'mx'], ['us', 'gb'], ['us', 'fr'],
  ['br', 'co'], ['br', 'ar'], ['br', 'pe'], ['br', 'cl'],
  ['br', 'uy'], ['br', 'bo'],
  ['cn', 'hk'], ['cn', 'sg'], ['cn', 'my'], ['cn', 'id'],
  ['cn', 'in'], ['cn', 'ru'],
  ['in', 'sg'], ['in', 'tr'],
  ['ao', 'co'],
]

function nodeById(id: string) {
  return nodes.find(n => n.id === id)!
}

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
  const [active, setActive] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.1 })
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="global-presence"
      className="py-24 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #ffffff 0%, #f7f8fa 50%, #f0f2f5 100%)' }}
    >
      {/* subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #d0d5dd 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.35,
        }}
      />
      {/* top gradient fade */}
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-white to-transparent pointer-events-none" />
      {/* bottom gradient fade */}
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />

      <style>{`
        @keyframes gp-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%       { transform: scale(1.35); opacity: 0.5; }
        }
        @keyframes gp-ring {
          0%   { transform: scale(1); opacity: 0.45; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes gp-dash {
          to { stroke-dashoffset: -28; }
        }
        @keyframes gp-fadein {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gp-node { animation: gp-pulse 2.4s ease-in-out infinite; }
        .gp-ring  { animation: gp-ring  2.4s ease-out  infinite; }
        .gp-line  { animation: gp-dash  1.6s linear     infinite; }
        .gp-fadein { animation: gp-fadein 0.7s ease both; }
      `}</style>

      <div className="container mx-auto px-4 relative">

        {/* ── Header ── */}
        <div className={`text-center mb-14 ${visible ? 'gp-fadein' : 'opacity-0'}`}>
          <span className="section-tag mb-5 inline-flex">Presença Global</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Presença Global <span className="gradient-text">ViralizaHost</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Infraestrutura distribuída globalmente para garantir baixa latência, alta disponibilidade e suporte onde o seu negócio estiver.
          </p>
        </div>

        {/* ── Stats cards ── */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-5 mb-14 ${visible ? 'gp-fadein' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
          {stats.map(({ value, suffix, label, decimal }) => (
            <div
              key={label}
              className="bg-white border border-[#E8ECF0] rounded-2xl py-7 px-5 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="text-3xl md:text-4xl font-black text-[#F5B700] mb-2">
                <AnimatedCounter value={value} suffix={suffix} decimal={decimal} />
              </div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* ── World Map ── */}
        <div
          className={`rounded-3xl bg-white border border-[#E8ECF0] shadow-lg overflow-hidden mb-10 ${visible ? 'gp-fadein' : 'opacity-0'}`}
          style={{ animationDelay: '0.2s', padding: '2rem' }}
        >
          <svg
            viewBox="0 0 1000 500"
            className="w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="gp-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F5B700" stopOpacity="0.18"/>
                <stop offset="100%" stopColor="#F5B700" stopOpacity="0"/>
              </radialGradient>
            </defs>

            {/* ── Continents (light fills, subtle strokes) ── */}

            {/* North America */}
            <path d="M95,80 Q115,62 138,68 L162,72 Q190,70 210,80 L232,90 Q248,100 252,118 L254,138 Q256,158 248,170 L238,185 Q228,198 220,210 L215,228 Q210,245 215,260 L218,272 Q220,280 215,285 L200,295 Q190,300 180,295 L165,285 Q155,275 150,260 L145,240 Q138,218 132,200 L120,178 Q108,158 105,138 L98,115 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Central America + Mexico */}
            <path d="M215,260 Q225,268 232,280 L236,296 Q238,310 230,322 L220,330 Q212,336 205,330 L198,318 Q195,305 200,295 L210,285 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Caribbean — tiny islands omitted for clarity */}

            {/* South America */}
            <path d="M232,296 Q250,285 268,286 L285,290 Q302,296 310,310 L315,330 Q318,350 312,368 L300,390 Q285,412 270,425 L255,435 Q238,440 225,430 L212,415 Q202,395 205,372 L208,348 Q212,325 220,308 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Europe */}
            <path d="M425,85 Q445,72 468,74 L492,78 Q510,82 518,96 L520,112 Q518,128 505,136 L488,142 Q470,146 455,138 L438,125 Q426,112 424,98 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>
            {/* Iberian peninsula */}
            <path d="M424,120 Q436,126 438,138 L435,150 Q430,158 420,156 L412,148 Q408,138 412,128 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>
            {/* Scandinavia */}
            <path d="M460,55 Q475,44 490,48 L498,60 Q500,72 492,78 L475,76 Q462,70 460,60 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Africa */}
            <path d="M438,152 Q462,144 488,150 L510,160 Q530,172 538,192 L545,218 Q550,248 545,275 L535,305 Q520,332 500,350 L478,362 Q455,368 435,355 L415,335 Q400,312 398,285 L398,255 Q400,225 408,200 L420,175 Q432,162 438,152 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>
            {/* Madagascar */}
            <path d="M548,290 Q556,282 564,290 L566,310 Q564,325 555,328 L548,318 Q544,305 548,290 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Middle East */}
            <path d="M520,135 Q545,125 568,128 L580,138 Q585,150 578,160 L562,168 Q545,170 530,162 L520,150 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Russia / Central Asia */}
            <path d="M505,60 Q560,42 640,40 L720,42 Q780,46 820,58 L840,72 Q850,84 845,96 L828,108 Q800,115 765,112 L720,108 Q665,104 615,100 L565,96 Q528,92 510,80 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* South Asia */}
            <path d="M595,145 Q630,135 660,138 L678,148 Q688,160 685,175 L678,192 Q665,205 648,210 L628,212 Q608,208 598,195 L592,178 Q590,160 595,145 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* India */}
            <path d="M625,175 Q645,168 665,172 L672,188 Q675,205 668,220 L655,238 Q640,250 626,245 L614,232 Q608,215 612,198 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* China / East Asia */}
            <path d="M665,95 Q715,80 770,82 L808,90 Q835,100 840,118 L835,135 Q820,148 795,152 L758,155 Q718,152 685,142 L660,128 Q652,115 655,100 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Japan */}
            <path d="M818,105 Q828,98 840,102 L845,115 Q843,126 834,128 L822,124 Q815,116 818,105 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Southeast Asia */}
            <path d="M715,178 Q742,168 765,172 L778,183 Q782,198 772,210 L755,220 Q738,224 722,216 L712,202 Q710,188 715,178 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>
            {/* Malaysia / Indonesia archipelago */}
            <path d="M735,228 Q758,220 778,225 L790,238 Q792,252 780,258 L760,260 Q742,258 733,245 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>
            <path d="M790,248 Q820,238 848,242 L858,258 Q856,272 840,276 L815,275 Q795,270 790,258 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* Australia */}
            <path d="M770,330 Q815,315 858,320 L882,335 Q892,355 885,378 L868,398 Q845,412 818,410 L790,400 Q768,385 765,362 L766,342 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>
            {/* New Zealand */}
            <path d="M900,368 Q910,358 920,364 L922,380 Q918,392 908,392 L900,382 Z"
              fill="#EDF2F7" stroke="#CBD5E0" strokeWidth="0.8"/>

            {/* ── Connection lines ── */}
            {connections.map(([a, b], i) => {
              const na = nodeById(a)
              const nb = nodeById(b)
              const isActive = active === a || active === b
              const mx = (na.x + nb.x) / 2
              const my = (na.y + nb.y) / 2 - 38
              return (
                <path
                  key={i}
                  d={`M${na.x},${na.y} Q${mx},${my} ${nb.x},${nb.y}`}
                  fill="none"
                  stroke="#F5B700"
                  strokeWidth={isActive ? 1.5 : 0.9}
                  strokeDasharray="6 8"
                  strokeDashoffset="0"
                  opacity={isActive ? 0.7 : 0.28}
                  className="gp-line"
                  style={{ animationDuration: `${1.4 + (i % 5) * 0.2}s` }}
                />
              )
            })}

            {/* ── Nodes ── */}
            {nodes.map((node) => {
              const isActive = active === node.id
              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActive(node.id)}
                  onMouseLeave={() => setActive(null)}
                >
                  {/* pulse ring */}
                  <circle
                    cx={node.x} cy={node.y} r="10"
                    fill="#F5B700"
                    opacity="0"
                    className="gp-ring"
                    style={{ animationDelay: `${Math.random() * 1.5}s` }}
                  />
                  {/* glow bg */}
                  <circle cx={node.x} cy={node.y} r={isActive ? 14 : 10}
                    fill="#F5B700"
                    opacity={isActive ? 0.18 : 0.1}
                    style={{ transition: 'all 0.25s' }}
                  />
                  {/* core dot */}
                  <circle
                    cx={node.x} cy={node.y} r={isActive ? 6 : 4}
                    fill={isActive ? '#F5B700' : '#F5B700'}
                    stroke="white"
                    strokeWidth="1.5"
                    opacity={isActive ? 1 : 0.88}
                    className="gp-node"
                    style={{ animationDelay: `${(node.x + node.y) % 2000 / 2000 * 2.4}s`, transition: 'r 0.2s' }}
                  />
                  {/* flag label — shown on hover */}
                  {isActive && (
                    <g>
                      <rect
                        x={node.x - 42} y={node.y - 44}
                        width="84" height="26"
                        rx="5" ry="5"
                        fill="white"
                        stroke="#E8ECF0"
                        strokeWidth="1"
                        filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))"
                      />
                      <text x={node.x} y={node.y - 26} textAnchor="middle" fontSize="11" fontWeight="600" fill="#0A0A0A">
                        {node.flag} {node.name}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {/* legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5B700] inline-block" />
              Ponto de presença
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#F5B700" strokeWidth="1.5" strokeDasharray="4 4"/></svg>
              Rota de rede
            </span>
          </div>
        </div>

        {/* ── Country buttons ── */}
        <div className={`flex flex-wrap justify-center gap-2.5 ${visible ? 'gp-fadein' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
          {nodes.map(({ flag, name, id }) => (
            <button
              key={id}
              onMouseEnter={() => setActive(id)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-2 border rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                active === id
                  ? 'bg-[#F5B700] border-[#F5B700] text-[#0A0A0A] shadow-md scale-105'
                  : 'bg-white border-[#E8ECF0] text-gray-600 hover:border-[#F5B700]/60 hover:text-[#0A0A0A] hover:shadow-sm'
              }`}
            >
              <span className="text-base leading-none">{flag}</span>
              <span>{name}</span>
            </button>
          ))}
        </div>

      </div>
    </section>
  )
}
