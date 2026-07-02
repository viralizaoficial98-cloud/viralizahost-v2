'use client'
import { useRef, useEffect, useState } from 'react'

const stats = [
  { value: 20,   suffix: '+',  label: 'Países Atendidos' },
  { value: 5000, suffix: '+',  label: 'Clientes Ativos' },
  { value: 99.9, suffix: '%',  label: 'Uptime Garantido', decimal: true },
  { value: 24,   suffix: '/7', label: 'Suporte Disponível' },
]

// Mercator projection: x = (lon+180)*2.778, y = (90-lat)*2.778 — viewBox 0 0 1000 500
const nodes = [
  { id: 'ao', flag: '🇦🇴', name: 'Angola',      x: 551, y: 283 },
  { id: 'br', flag: '🇧🇷', name: 'Brasil',      x: 358, y: 280 },
  { id: 'pt', flag: '🇵🇹', name: 'Portugal',    x: 475, y: 148 },
  { id: 'us', flag: '🇺🇸', name: 'EUA',         x: 210, y: 150 },
  { id: 'gb', flag: '🇬🇧', name: 'Reino Unido', x: 492, y: 103 },
  { id: 'ca', flag: '🇨🇦', name: 'Canadá',      x: 225, y: 92  },
  { id: 'fr', flag: '🇫🇷', name: 'França',      x: 508, y: 121 },
  { id: 'de', flag: '🇩🇪', name: 'Alemanha',    x: 527, y: 109 },
  { id: 'mx', flag: '🇲🇽', name: 'México',      x: 215, y: 195 },
  { id: 'co', flag: '🇨🇴', name: 'Colômbia',    x: 285, y: 242 },
  { id: 'cl', flag: '🇨🇱', name: 'Chile',       x: 300, y: 348 },
  { id: 'pe', flag: '🇵🇪', name: 'Peru',        x: 276, y: 275 },
  { id: 'bo', flag: '🇧🇴', name: 'Bolívia',     x: 315, y: 305 },
  { id: 'uy', flag: '🇺🇾', name: 'Uruguai',     x: 348, y: 355 },
  { id: 'ar', flag: '🇦🇷', name: 'Argentina',   x: 318, y: 360 },
  { id: 'tr', flag: '🇹🇷', name: 'Turquia',     x: 597, y: 143 },
  { id: 'ru', flag: '🇷🇺', name: 'Rússia',      x: 660, y: 80  },
  { id: 'in', flag: '🇮🇳', name: 'Índia',       x: 708, y: 208 },
  { id: 'cn', flag: '🇨🇳', name: 'China',       x: 775, y: 155 },
  { id: 'hk', flag: '🇭🇰', name: 'Hong Kong',   x: 800, y: 200 },
  { id: 'my', flag: '🇲🇾', name: 'Malásia',     x: 790, y: 248 },
  { id: 'sg', flag: '🇸🇬', name: 'Singapura',   x: 775, y: 260 },
  { id: 'id', flag: '🇮🇩', name: 'Indonésia',   x: 828, y: 270 },
]

// Hub → spoke connection pairs
const connections: [string, string][] = [
  ['pt', 'ao'], ['pt', 'br'], ['pt', 'gb'], ['pt', 'fr'], ['pt', 'de'],
  ['us', 'ca'], ['us', 'mx'], ['us', 'gb'], ['us', 'fr'],
  ['br', 'co'], ['br', 'ar'], ['br', 'pe'], ['br', 'uy'], ['br', 'bo'],
  ['ao', 'br'], ['ao', 'pt'],
  ['cn', 'hk'], ['cn', 'sg'], ['cn', 'my'], ['cn', 'in'], ['cn', 'id'],
  ['ru', 'cn'], ['ru', 'de'], ['tr', 'de'], ['tr', 'ru'],
  ['in', 'sg'],
]

// --- Geographic SVG paths (viewBox 0 0 1000 500, simplified Mercator) ---
const continentPaths = {
  // North America
  northAmerica: `
    M 53,95 Q 48,68 64,53 Q 82,38 115,42 Q 148,46 170,55
    Q 185,48 225,42 Q 270,38 310,50 Q 345,58 356,100
    Q 362,115 353,120 Q 338,124 315,124 Q 296,136 286,150
    Q 280,162 278,178 Q 275,183 278,185 Q 270,200 260,208
    Q 248,220 240,230 Q 230,228 222,218 Q 210,205 205,192
    Q 195,178 188,168 Q 174,158 158,148 Q 153,130 155,112
    Q 157,96 148,88 Q 136,78 120,83 Q 103,88 88,82
    Q 70,75 53,95 Z
  `,
  // Greenland
  greenland: `
    M 310,28 Q 335,15 365,18 Q 385,22 388,38 Q 388,52 372,58
    Q 355,62 338,58 Q 318,52 310,38 Z
  `,
  // Cuba + Caribbean (simplified blob)
  caribbean: `
    M 258,190 Q 272,186 280,192 Q 285,198 278,203 Q 268,205 258,200 Z
  `,
  // Central America
  centralAmerica: `
    M 240,230 Q 255,240 265,250 Q 272,260 278,268 Q 268,270 260,262
    Q 248,252 240,242 Q 235,235 240,230 Z
  `,
  // South America
  southAmerica: `
    M 278,268 Q 282,258 290,250 Q 300,242 310,238
    Q 325,232 340,230 Q 360,228 378,235
    Q 398,242 408,255 Q 416,268 410,282
    Q 405,295 395,305 Q 382,315 372,325
    Q 362,335 355,348 Q 348,360 342,372
    Q 332,390 320,405 Q 308,418 295,415
    Q 280,408 268,395 Q 256,378 252,360
    Q 248,342 250,325 Q 252,308 256,292
    Q 262,275 268,268 Q 272,264 278,268 Z
  `,
  // Europe (simplified)
  europe: `
    M 475,148 Q 478,132 488,120 Q 498,110 510,106
    Q 522,102 534,100 Q 548,98 562,96
    Q 575,95 582,100 Q 590,105 590,115
    Q 588,126 578,132 Q 566,138 552,140
    Q 538,142 528,140 Q 515,138 506,140
    Q 496,142 488,148 Q 480,152 475,148 Z
  `,
  // Scandinavia
  scandinavia: `
    M 492,103 Q 498,88 508,78 Q 520,68 535,66
    Q 548,64 555,72 Q 558,80 552,88
    Q 545,96 535,100 Q 522,103 510,104
    Q 500,104 492,103 Z
  `,
  // UK + Ireland (tiny shapes near Europe)
  uk: `
    M 480,115 Q 484,108 490,106 Q 496,105 498,112
    Q 496,118 490,120 Q 484,120 480,115 Z
  `,
  // Africa
  africa: `
    M 478,155 Q 492,148 510,148 Q 528,148 545,152
    Q 558,156 568,162 Q 578,170 582,182
    Q 585,195 582,210 Q 578,226 570,240
    Q 562,255 558,270 Q 555,285 555,298
    Q 555,312 550,325 Q 542,338 530,345
    Q 516,350 502,346 Q 488,340 476,328
    Q 462,312 455,295 Q 448,278 448,260
    Q 448,242 452,226 Q 456,210 460,196
    Q 464,180 468,168 Q 472,158 478,155 Z
  `,
  // Madagascar
  madagascar: `
    M 572,278 Q 578,268 585,272 Q 590,280 588,295
    Q 584,308 576,310 Q 570,308 570,295
    Q 570,285 572,278 Z
  `,
  // Middle East / Arabian Peninsula
  middleEast: `
    M 572,148 Q 586,145 602,148 Q 618,152 628,162
    Q 635,172 632,185 Q 625,198 615,205
    Q 600,212 585,208 Q 572,202 565,190
    Q 560,178 565,165 Q 568,155 572,148 Z
  `,
  // Russia / Central Asia (top band)
  russia: `
    M 510,105 Q 540,92 580,82 Q 620,72 665,68
    Q 710,62 760,65 Q 810,68 850,75
    Q 885,80 900,92 Q 905,105 895,115
    Q 878,122 845,120 Q 800,118 755,115
    Q 710,112 665,110 Q 618,108 580,110
    Q 545,112 520,114 Q 510,115 510,105 Z
  `,
  // South Asia (India + surroundings)
  southAsia: `
    M 635,148 Q 660,138 690,138 Q 718,138 738,145
    Q 752,152 755,165 Q 752,178 742,188
    Q 728,198 712,205 Q 698,210 685,210
    Q 662,208 645,198 Q 630,188 628,175
    Q 626,160 635,148 Z
  `,
  // India peninsula
  india: `
    M 685,210 Q 700,210 710,215 Q 718,222 720,235
    Q 720,250 712,262 Q 700,272 688,270
    Q 675,266 668,252 Q 662,238 666,225
    Q 670,215 680,210 Q 682,210 685,210 Z
  `,
  // East Asia / China
  eastAsia: `
    M 738,145 Q 762,130 795,125 Q 828,120 858,128
    Q 880,135 888,150 Q 890,165 878,175
    Q 862,185 835,190 Q 808,194 782,192
    Q 756,188 742,178 Q 732,168 735,158
    Q 736,150 738,145 Z
  `,
  // Southeast Asia mainland
  seAsia: `
    M 760,192 Q 778,188 795,192 Q 810,197 815,210
    Q 815,224 802,232 Q 788,238 774,234
    Q 760,228 756,215 Q 754,204 760,192 Z
  `,
  // Malay Peninsula + Sumatra (simplified)
  malay: `
    M 774,238 Q 782,242 790,252 Q 792,265 786,272
    Q 778,278 768,272 Q 760,264 760,252
    Q 760,242 768,238 Q 772,237 774,238 Z
  `,
  // Java / Indonesia islands
  indonesia: `
    M 798,268 Q 820,260 848,262 Q 868,264 875,275
    Q 872,285 855,288 Q 835,290 812,285
    Q 796,280 795,272 Q 796,268 798,268 Z
  `,
  // Japan
  japan: `
    M 848,130 Q 858,122 868,126 Q 875,132 872,142
    Q 868,150 858,152 Q 848,150 845,142
    Q 842,134 848,130 Z
  `,
  // Australia
  australia: `
    M 790,320 Q 820,305 858,308 Q 892,312 912,328
    Q 928,345 925,368 Q 920,390 900,405
    Q 876,418 848,415 Q 818,410 798,392
    Q 778,374 775,350 Q 774,332 790,320 Z
  `,
  // New Zealand
  newZealand: `
    M 932,368 Q 940,358 948,362 Q 952,372 948,382
    Q 942,390 934,386 Q 928,378 932,368 Z
  `,
}

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
        const steps = 60
        const increment = value / steps
        let current = 0
        const timer = setInterval(() => {
          current += increment
          if (current >= value) { setCount(value); clearInterval(timer) }
          else setCount(Math.floor(current * (decimal ? 10 : 1)) / (decimal ? 10 : 1))
        }, 1800 / steps)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, decimal])

  return <span ref={ref}>{decimal ? count.toFixed(1) : count.toLocaleString('pt-BR')}{suffix}</span>
}

export function GlobalPresenceSection() {
  const [active, setActive] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.08 })
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="global-presence"
      className="py-24 relative overflow-hidden"
      style={{ background: 'linear-gradient(170deg,#ffffff 0%,#f4f6f9 55%,#eef1f5 100%)' }}
    >
      {/* subtle dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle,#c8d0dc 1px,transparent 1px)',
        backgroundSize: '28px 28px', opacity: 0.4,
      }} />
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-white to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />

      <style>{`
        @keyframes gp-pulse  { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.4);opacity:.5} }
        @keyframes gp-ring   { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(3);opacity:0} }
        @keyframes gp-flow   { to{stroke-dashoffset:-28} }
        @keyframes gp-fadein { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .gp-dot   { animation:gp-pulse  2.6s ease-in-out infinite }
        .gp-ring  { animation:gp-ring   2.6s ease-out  infinite }
        .gp-flow  { animation:gp-flow   1.8s linear    infinite }
        .gp-show  { animation:gp-fadein 0.65s ease both }
      `}</style>

      <div className="container mx-auto px-4 relative">

        {/* Header */}
        <div className={`text-center mb-14 ${visible ? 'gp-show' : 'opacity-0'}`}>
          <span className="section-tag mb-5 inline-flex">Presença Global</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Presença Global <span className="gradient-text">ViralizaHost</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Infraestrutura distribuída globalmente para garantir baixa latência, alta disponibilidade e suporte onde o seu negócio estiver.
          </p>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-5 mb-12 ${visible ? 'gp-show' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
          {stats.map(({ value, suffix, label, decimal }) => (
            <div key={label} className="bg-white border border-[#E2E8F0] rounded-2xl py-7 px-5 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="text-3xl md:text-4xl font-black text-[#F5B700] mb-2">
                <AnimatedCounter value={value} suffix={suffix} decimal={decimal} />
              </div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className={`bg-white border border-[#E2E8F0] rounded-3xl shadow-lg overflow-hidden mb-10 ${visible ? 'gp-show' : 'opacity-0'}`}
          style={{ animationDelay: '0.18s', padding: '1.75rem' }}>

          <svg viewBox="0 0 1000 500" className="w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="gp-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#94a3b8" floodOpacity="0.25"/>
              </filter>
              <filter id="gp-glow-f" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Ocean / background */}
            <rect width="1000" height="500" fill="#EEF4FB" rx="12"/>

            {/* Continents */}
            {Object.entries(continentPaths).map(([key, d]) => (
              <path key={key} d={d}
                fill="#DDE6F0"
                stroke="#C4D0E0"
                strokeWidth="0.8"
                filter="url(#gp-shadow)"
              />
            ))}

            {/* Connection lines */}
            {connections.map(([a, b], i) => {
              const na = nodeById(a)
              const nb = nodeById(b)
              const isActive = active === a || active === b
              const cx = (na.x + nb.x) / 2
              const cy = (na.y + nb.y) / 2 - 35
              return (
                <path key={i}
                  d={`M${na.x},${na.y} Q${cx},${cy} ${nb.x},${nb.y}`}
                  fill="none"
                  stroke="#F5B700"
                  strokeWidth={isActive ? 1.6 : 0.9}
                  strokeDasharray="5 7"
                  opacity={isActive ? 0.8 : 0.32}
                  className="gp-flow"
                  style={{ animationDuration: `${1.5 + (i % 6) * 0.18}s` }}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isActive = active === node.id
              const delay = ((node.x * 3 + node.y * 7) % 2600) / 2600 * 2.6
              return (
                <g key={node.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActive(node.id)}
                  onMouseLeave={() => setActive(null)}
                >
                  {/* outer ring pulse */}
                  <circle cx={node.x} cy={node.y} r="9"
                    fill="#F5B700" opacity="0"
                    className="gp-ring"
                    style={{ animationDelay: `${delay}s` }}
                  />
                  {/* glow halo */}
                  <circle cx={node.x} cy={node.y}
                    r={isActive ? 13 : 9}
                    fill="#F5B700"
                    opacity={isActive ? 0.22 : 0.12}
                    style={{ transition: 'r 0.2s, opacity 0.2s' }}
                  />
                  {/* core dot */}
                  <circle cx={node.x} cy={node.y}
                    r={isActive ? 5.5 : 4}
                    fill={isActive ? '#D9A300' : '#F5B700'}
                    stroke="white"
                    strokeWidth="1.5"
                    className="gp-dot"
                    style={{ animationDelay: `${delay}s`, transition: 'r 0.2s' }}
                    filter={isActive ? 'url(#gp-glow-f)' : undefined}
                  />
                  {/* Always-visible flag emoji */}
                  <text
                    x={node.x}
                    y={node.y - 14}
                    textAnchor="middle"
                    fontSize={isActive ? '13' : '11'}
                    style={{ userSelect: 'none', transition: 'font-size 0.2s', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' }}
                  >
                    {node.flag}
                  </text>
                  {/* Tooltip on hover */}
                  {isActive && (
                    <g>
                      <rect x={node.x - 40} y={node.y + 8} width="80" height="20" rx="4"
                        fill="white" stroke="#E2E8F0" strokeWidth="1"
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
                      />
                      <text x={node.x} y={node.y + 21} textAnchor="middle"
                        fontSize="9.5" fontWeight="600" fill="#1a202c">
                        {node.name}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center justify-center gap-8 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5B700] inline-block shadow-sm"/>
              Ponto de presença
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="24" height="6">
                <line x1="0" y1="3" x2="24" y2="3" stroke="#F5B700" strokeWidth="1.5" strokeDasharray="4 4"/>
              </svg>
              Rota de rede ativa
            </span>
          </div>
        </div>

        {/* Country pill buttons */}
        <div className={`flex flex-wrap justify-center gap-2 ${visible ? 'gp-show' : 'opacity-0'}`} style={{ animationDelay: '0.28s' }}>
          {nodes.map(({ id, flag, name }) => (
            <button
              key={id}
              onMouseEnter={() => setActive(id)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-1.5 border rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                active === id
                  ? 'bg-[#F5B700] border-[#F5B700] text-[#0A0A0A] shadow-md scale-105'
                  : 'bg-white border-[#E2E8F0] text-gray-600 hover:border-[#F5B700]/70 hover:bg-[#FFF8E0] hover:text-[#0A0A0A]'
              }`}
            >
              <span className="text-base leading-none">{flag}</span>
              <span className="text-xs font-semibold">{name}</span>
            </button>
          ))}
        </div>

      </div>
    </section>
  )
}
