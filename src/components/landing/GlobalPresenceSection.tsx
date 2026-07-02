'use client'
import { useRef, useEffect, useState } from 'react'

const stats = [
  { value: 20,   suffix: '+',  label: 'Países Atendidos' },
  { value: 5000, suffix: '+',  label: 'Clientes Ativos' },
  { value: 99.9, suffix: '%',  label: 'Uptime Garantido', decimal: true },
  { value: 24,   suffix: '/7', label: 'Suporte Disponível' },
]

/*
  Mercator projection: viewBox="0 0 1000 500"
  x = (lon + 180) * 2.7778
  y = (90  - lat) * 2.7778
  Reference anchors:
    lon=0   → x=500   lat=0  → y=250
    lon=-180→ x=0     lat=90 → y=0
    lon=180 → x=1000  lat=-90→ y=500
*/

// Country nodes — flag shown always on the map
const nodes = [
  { id:'ao', flag:'🇦🇴', name:'Angola',      x:551, y:283 },
  { id:'br', flag:'🇧🇷', name:'Brasil',      x:360, y:278 },
  { id:'pt', flag:'🇵🇹', name:'Portugal',    x:475, y:148 },
  { id:'us', flag:'🇺🇸', name:'EUA',         x:210, y:155 },
  { id:'gb', flag:'🇬🇧', name:'Reino Unido', x:489, y:108 },
  { id:'ca', flag:'🇨🇦', name:'Canadá',      x:225, y:92  },
  { id:'fr', flag:'🇫🇷', name:'França',      x:508, y:122 },
  { id:'de', flag:'🇩🇪', name:'Alemanha',    x:527, y:110 },
  { id:'mx', flag:'🇲🇽', name:'México',      x:215, y:200 },
  { id:'co', flag:'🇨🇴', name:'Colômbia',    x:285, y:244 },
  { id:'cl', flag:'🇨🇱', name:'Chile',       x:302, y:345 },
  { id:'pe', flag:'🇵🇪', name:'Peru',        x:276, y:275 },
  { id:'bo', flag:'🇧🇴', name:'Bolívia',     x:318, y:305 },
  { id:'uy', flag:'🇺🇾', name:'Uruguai',     x:348, y:352 },
  { id:'ar', flag:'🇦🇷', name:'Argentina',   x:318, y:360 },
  { id:'tr', flag:'🇹🇷', name:'Turquia',     x:597, y:143 },
  { id:'ru', flag:'🇷🇺', name:'Rússia',      x:660, y:82  },
  { id:'in', flag:'🇮🇳', name:'Índia',       x:708, y:208 },
  { id:'cn', flag:'🇨🇳', name:'China',       x:775, y:155 },
  { id:'hk', flag:'🇭🇰', name:'Hong Kong',   x:800, y:202 },
  { id:'my', flag:'🇲🇾', name:'Malásia',     x:790, y:248 },
  { id:'sg', flag:'🇸🇬', name:'Singapura',   x:775, y:258 },
  { id:'id', flag:'🇮🇩', name:'Indonésia',   x:830, y:268 },
]

const connections: [string,string][] = [
  ['pt','ao'],['pt','br'],['pt','gb'],['pt','fr'],['pt','de'],
  ['us','ca'],['us','mx'],['us','gb'],['us','fr'],
  ['br','co'],['br','ar'],['br','pe'],['br','uy'],['br','bo'],['ao','br'],
  ['cn','hk'],['cn','sg'],['cn','my'],['cn','id'],['cn','in'],
  ['ru','cn'],['ru','de'],['tr','de'],['tr','ru'],['in','sg'],
]

function nd(id:string){ return nodes.find(n=>n.id===id)! }

/*
  Real geographic continent paths (simplified Mercator, viewBox 0 0 1000 500)
  Traced from actual coastline coordinates.
*/
const GEO = {
  // North America — clockwise from NW Alaska
  northAmerica:`
    M 52,72 L 68,53 L 100,50 L 125,56
    L 133,92 L 156,119 L 157,150 L 175,163
    Q 185,175 194,186
    L 210,198 L 243,208 L 260,214 L 270,222 L 281,228
    L 270,218 L 258,208
    Q 252,194 252,188
    L 235,193 Q 228,174 230,170
    L 248,168 L 262,165 L 268,170
    Q 272,177 275,181
    L 278,164 L 289,153 L 294,136 L 314,128
    L 325,125 L 353,119
    L 344,105 L 319,78
    L 285,72 L 225,56 L 175,56 L 133,56
    L 80,67 Z
  `,
  // South America — clockwise
  southAmerica:`
    M 281,228
    L 289,219 L 300,217 L 328,219 L 342,233
    L 403,264 L 394,292 L 381,314
    L 367,328 L 344,342 L 325,356
    L 319,372 L 314,403
    L 311,400 L 303,372 L 303,333
    L 300,300 L 278,258 L 278,250
    L 286,242 L 281,228 Z
  `,
  // Europe mainland + Scandinavian peninsula
  europe:`
    M 475,148 L 486,150
    Q 508,136 528,136
    L 542,145 L 561,148 L 572,145
    L 600,133 L 581,125 L 567,102
    L 548,99 L 530,100 L 526,92
    Q 518,82 528,72
    L 556,56 L 575,59
    L 580,83 L 567,92
    Q 556,99 548,99
    L 534,100 L 511,108 L 492,116
    L 489,128 L 478,133
    L 475,148 Z
  `,
  // UK island
  uk:`
    M 484,116 L 489,108 L 494,104 L 497,98
    L 492,94 L 486,100 L 483,108 L 484,116 Z
  `,
  // Ireland
  ireland:`
    M 475,112 L 480,107 L 483,112 L 478,117 Z
  `,
  // Africa — clockwise from NW corner
  africa:`
    M 478,156 Q 492,148 510,148 Q 528,148 545,152
    L 562,156 L 572,165
    Q 578,178 575,195
    L 570,212 L 562,230 L 558,250 L 555,268
    L 553,285 L 550,298
    Q 543,318 530,330
    Q 516,342 502,338
    Q 486,330 476,316
    Q 462,298 455,278
    L 450,258 L 450,238 L 453,218
    Q 457,198 462,180
    Q 467,163 478,156 Z
  `,
  // Madagascar
  madagascar:`
    M 572,278 L 576,268 L 583,272 L 586,285
    L 584,300 L 578,306 L 572,298 L 571,285 Z
  `,
  // Middle East / Arabian Peninsula
  middleEast:`
    M 572,145 L 600,133 L 614,140
    Q 625,150 632,165
    L 635,180 Q 636,200 628,212
    Q 618,224 605,228
    L 590,225 L 575,215
    Q 562,200 562,185
    Q 562,165 572,145 Z
  `,
  // Russia / northern Asia broad band
  russiaAsia:`
    M 567,102 L 580,83 L 600,72
    L 640,60 L 680,55 L 725,52 L 775,52
    L 820,55 L 858,62 L 890,75
    Q 905,88 900,102
    L 880,110 L 845,115 L 800,118
    L 755,118 L 710,115 L 670,112
    L 630,110 L 600,110 L 580,112
    L 567,110 L 567,102 Z
  `,
  // South Asia — Indian subcontinent
  southAsia:`
    M 614,140 L 645,130 L 680,128 L 712,132
    L 738,140 L 752,152 L 755,165
    L 748,180 L 740,190 L 722,200
    L 708,210 L 700,225 L 695,240
    Q 690,255 682,260
    Q 672,264 662,255
    Q 652,242 648,225
    L 642,210 L 630,200
    Q 618,188 614,172
    L 614,155 L 614,140 Z
  `,
  // East Asia — China / Korea / Japan area
  eastAsia:`
    M 712,132 L 748,118 L 785,115 L 825,118
    L 858,125 L 878,138 L 882,152
    L 870,165 L 850,175 L 820,182
    L 790,185 L 760,182 L 745,170
    L 738,158 L 738,140 Z
  `,
  // Japan (island)
  japan:`
    M 845,128 L 855,120 L 865,124
    L 868,136 L 862,145 L 852,146
    L 845,138 L 845,128 Z
  `,
  // SE Asia mainland (Indochina)
  seAsia:`
    M 745,170 L 762,162 L 782,162
    L 800,170 L 808,182 L 810,196
    L 805,210 L 795,218 L 780,220
    L 765,215 L 754,205 L 748,192 Z
  `,
  // Malay Peninsula
  malay:`
    M 780,220 L 790,228 L 794,240
    L 792,252 L 785,258 L 778,252
    L 773,240 L 774,228 Z
  `,
  // Sumatra + Java islands (Indonesia)
  indonesia:`
    M 760,255 L 782,250 L 805,252 L 825,255
    L 845,258 L 862,262 L 870,272
    L 848,278 L 820,278 L 795,272
    L 772,265 Z
  `,
  // Australia
  australia:`
    M 790,325 Q 820,308 858,312 Q 892,318 912,332
    Q 928,348 928,370 Q 925,392 905,406
    Q 880,420 850,418 Q 818,414 798,396
    Q 778,376 775,352 Q 772,334 790,325 Z
  `,
  // New Zealand (islands)
  newZealand:`
    M 932,370 L 938,360 L 946,364
    L 948,376 L 942,386 L 934,382 Z
  `,
}

function AnimatedCounter({value,suffix,decimal}:{value:number;suffix:string;decimal?:boolean}) {
  const [count,setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)
  useEffect(()=>{
    const obs = new IntersectionObserver(([e])=>{
      if(e.isIntersecting && !started.current){
        started.current=true
        const steps=60; const inc=value/steps; let cur=0
        const t=setInterval(()=>{
          cur+=inc
          if(cur>=value){setCount(value);clearInterval(t)}
          else setCount(Math.floor(cur*(decimal?10:1))/(decimal?10:1))
        },1800/steps)
      }
    },{threshold:0.3})
    if(ref.current) obs.observe(ref.current)
    return ()=>obs.disconnect()
  },[value,decimal])
  return <span ref={ref}>{decimal?count.toFixed(1):count.toLocaleString('pt-BR')}{suffix}</span>
}

export function GlobalPresenceSection() {
  const [active, setActive] = useState<string|null>(null)
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(()=>{
    const obs = new IntersectionObserver(([e])=>{if(e.isIntersecting) setVisible(true)},{threshold:0.06})
    if(sectionRef.current) obs.observe(sectionRef.current)
    return ()=>obs.disconnect()
  },[])

  return (
    <section
      ref={sectionRef}
      id="global-presence"
      className="py-24 relative overflow-hidden"
      style={{background:'linear-gradient(160deg,#ffffff 0%,#f5f7fa 55%,#eef1f5 100%)'}}
    >
      {/* dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage:'radial-gradient(circle,#c5ced9 1px,transparent 1px)',
        backgroundSize:'30px 30px',opacity:0.38,
      }}/>
      <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-b from-white to-transparent pointer-events-none"/>
      <div className="absolute bottom-0 left-0 w-full h-28 bg-gradient-to-t from-white to-transparent pointer-events-none"/>

      <style>{`
        @keyframes gp-pulse  {0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.45);opacity:.5}}
        @keyframes gp-ring   {0%{r:8;opacity:.6}100%{r:22;opacity:0}}
        @keyframes gp-flow   {to{stroke-dashoffset:-28}}
        @keyframes gp-fadein {from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .gp-dot  {animation:gp-pulse 2.8s ease-in-out infinite}
        .gp-flow {animation:gp-flow  1.8s linear infinite}
        .gp-show {animation:gp-fadein 0.65s ease both}
      `}</style>

      <div className="container mx-auto px-4 relative">

        {/* Header */}
        <div className={`text-center mb-14 ${visible?'gp-show':'opacity-0'}`}>
          <span className="section-tag mb-5 inline-flex">Presença Global</span>
          <h2 className="text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-5">
            Presença Global <span className="gradient-text">ViralizaHost</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Infraestrutura distribuída globalmente para garantir baixa latência, alta disponibilidade e suporte onde o seu negócio estiver.
          </p>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-5 mb-12 ${visible?'gp-show':'opacity-0'}`} style={{animationDelay:'0.1s'}}>
          {stats.map(({value,suffix,label,decimal})=>(
            <div key={label} className="bg-white border border-[#E2E8F0] rounded-2xl py-7 px-5 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
              <div className="text-3xl md:text-4xl font-black text-[#F5B700] mb-2">
                <AnimatedCounter value={value} suffix={suffix} decimal={decimal}/>
              </div>
              <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {/* MAP */}
        <div
          className={`bg-white border border-[#E2E8F0] rounded-3xl shadow-lg overflow-hidden mb-10 ${visible?'gp-show':'opacity-0'}`}
          style={{animationDelay:'0.18s',padding:'1.5rem 1.5rem 1rem'}}
        >
          <svg viewBox="0 0 1000 500" className="w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="gp-drop" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#8fabc7" floodOpacity="0.22"/>
              </filter>
              <filter id="gp-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <radialGradient id="gp-ocean" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#E8F2FC"/>
                <stop offset="100%" stopColor="#D8EAF7"/>
              </radialGradient>
            </defs>

            {/* Ocean */}
            <rect width="1000" height="500" fill="url(#gp-ocean)" rx="14"/>

            {/* Continent fills */}
            {Object.entries(GEO).map(([k,d])=>(
              <path key={k} d={d}
                fill="#D8E4EF"
                stroke="#B8CEDE"
                strokeWidth="0.7"
                strokeLinejoin="round"
                filter="url(#gp-drop)"
              />
            ))}

            {/* Connection lines with flow animation */}
            {connections.map(([a,b],i)=>{
              const na=nd(a), nb=nd(b)
              const isActive = active===a || active===b
              const cx=(na.x+nb.x)/2
              const cy=(na.y+nb.y)/2 - 38
              return (
                <path key={i}
                  d={`M${na.x},${na.y} Q${cx},${cy} ${nb.x},${nb.y}`}
                  fill="none"
                  stroke="#F5B700"
                  strokeWidth={isActive ? 1.8 : 1}
                  strokeDasharray="5 8"
                  opacity={isActive ? 0.85 : 0.3}
                  className="gp-flow"
                  style={{animationDuration:`${1.4+(i%7)*0.15}s`}}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map(node=>{
              const isActive = active===node.id
              const delay = ((node.x*3+node.y*7)%2800)/2800*2.8
              return (
                <g key={node.id}
                  style={{cursor:'pointer'}}
                  onMouseEnter={()=>setActive(node.id)}
                  onMouseLeave={()=>setActive(null)}
                >
                  {/* animated outer ring */}
                  <circle cx={node.x} cy={node.y} r="8"
                    fill="none"
                    stroke="#F5B700"
                    strokeWidth="1.5"
                    opacity="0"
                    style={{
                      animation:`gp-ring 2.8s ease-out infinite`,
                      animationDelay:`${delay}s`,
                    }}
                  />
                  {/* glow halo */}
                  <circle cx={node.x} cy={node.y}
                    r={isActive?15:10}
                    fill="#F5B700"
                    opacity={isActive?0.25:0.12}
                    style={{transition:'r 0.2s,opacity 0.2s'}}
                  />
                  {/* core dot */}
                  <circle cx={node.x} cy={node.y}
                    r={isActive?5:3.8}
                    fill="#F5B700"
                    stroke="white"
                    strokeWidth="1.4"
                    className="gp-dot"
                    style={{animationDelay:`${delay}s`,transition:'r 0.2s'}}
                    filter={isActive?'url(#gp-glow)':undefined}
                  />
                  {/* Flag always visible above dot */}
                  <text
                    x={node.x}
                    y={node.y-12}
                    textAnchor="middle"
                    fontSize={isActive?'13':'10'}
                    style={{
                      userSelect:'none',
                      filter:'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
                      transition:'font-size 0.2s',
                    }}
                  >
                    {node.flag}
                  </text>
                  {/* Country name on hover */}
                  {isActive&&(
                    <g>
                      <rect
                        x={node.x-38} y={node.y+6}
                        width="76" height="18"
                        rx="4" fill="white"
                        stroke="#DDE6F0" strokeWidth="1"
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.12))"
                      />
                      <text x={node.x} y={node.y+18}
                        textAnchor="middle"
                        fontSize="9" fontWeight="700" fill="#0A0A0A"
                      >
                        {node.name}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Legend */}
          <div className="flex items-center justify-center gap-8 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5B700] inline-block"/>
              Ponto de presença
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="26" height="6">
                <line x1="0" y1="3" x2="26" y2="3" stroke="#F5B700" strokeWidth="1.5" strokeDasharray="5 5"/>
              </svg>
              Rota de rede ativa
            </span>
          </div>
        </div>

        {/* Country pill buttons — flag + full name */}
        <div className={`flex flex-wrap justify-center gap-2 ${visible?'gp-show':'opacity-0'}`} style={{animationDelay:'0.28s'}}>
          {nodes.map(({id,flag,name})=>(
            <button
              key={id}
              onMouseEnter={()=>setActive(id)}
              onMouseLeave={()=>setActive(null)}
              className={`flex items-center gap-1.5 border rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                active===id
                  ?'bg-[#F5B700] border-[#F5B700] text-[#0A0A0A] shadow-md scale-105'
                  :'bg-white border-[#E2E8F0] text-gray-600 hover:border-[#F5B700] hover:bg-[#FFFBEA] hover:text-[#0A0A0A]'
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
