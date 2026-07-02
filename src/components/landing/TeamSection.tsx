'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Rocket, Eye, Diamond, Heart,
  Users, Target, Lightbulb,
  TrendingUp, Palette, Server, BarChart3, Film,
} from 'lucide-react'

/* ─── Data ─────────────────────────────────────────────────── */

const CEO = {
  name: 'Manuel Muenho',
  role: 'CEO & Fundador da ViralizaHost',
  photo: '/Manuel Muenho.jpeg',
  flag: '🇦🇴',
  bio: 'Especialista em Tecnologia, Gestão de Projetos, Infraestrutura Digital e Transformação Tecnológica. Lidera a expansão internacional da ViralizaHost com visão estratégica e excelência operacional.',
  expansion: 'Angola & Brasil',
}

const STATS = [
  { icon: Users,     value: '6',  label: 'Especialistas',        sub: 'Profissionais dedicados' },
  { icon: Target,    value: '5',  label: 'Áreas Estratégicas',   sub: 'Cobertura completa' },
  { icon: Lightbulb, value: '1',  label: 'Visão',                sub: 'Resultados extraordinários' },
]

const TEAM = [
  {
    name: 'Lucas Marcelino',
    role: 'Tráfego Pago',
    title: 'Especialista',
    photo: '/Lucas Marcelino.jpeg',
    flag: '🇧🇷',
    icon: TrendingUp,
    color: '#F59E0B',
    bio: 'Especialista em Meta Ads, Google Ads e estratégias de conversão e crescimento digital.',
  },
  {
    name: 'Jacob Pessela',
    role: 'Design Gráfico',
    title: 'Especialista',
    photo: '/Jacobe Pessela.jpeg',
    flag: '🇦🇴',
    icon: Palette,
    color: '#8B5CF6',
    bio: 'Especialista em branding, identidade visual e comunicação criativa empresarial.',
  },
  {
    name: 'Vladimiro Francisco',
    role: 'Hosting & Infraestrutura',
    title: 'Especialista',
    photo: '/Valdmiro Macedo.jpeg',
    flag: '🇦🇴',
    icon: Server,
    color: '#FDBA00',
    bio: 'Especialista em servidores web, cloud hosting, e-mails corporativos e infraestrutura.',
  },
  {
    name: 'Israel Soares',
    role: 'Crescimento Digital',
    title: 'Especialista',
    photo: '/Israel Soares.png',
    flag: '🇧🇷',
    icon: BarChart3,
    color: '#10B981',
    bio: 'Especialista em crescimento digital, estratégias sociais e posicionamento online.',
  },
  {
    name: 'Arnaldo Eduardo',
    role: 'Audiovisual',
    title: 'Especialista',
    photo: '/Arnaldo Eduardo.jpeg',
    flag: '🇦🇴',
    icon: Film,
    color: '#EF4444',
    bio: 'Especialista em produção audiovisual, motion graphics e conteúdos digitais premium.',
  },
]

const VALUES = [
  { icon: Rocket,  label: 'Missão',  text: 'Transformar ideias em presença digital, tecnologia e resultados.' },
  { icon: Eye,     label: 'Visão',   text: 'Ser referência em soluções digitais em Angola, Brasil e no mundo.' },
  { icon: Diamond, label: 'Valores', text: 'Inovação, ética, excelência, compromisso e resultados sustentáveis.' },
  { icon: Heart,   label: 'Cultura', text: 'Foco em pessoas, aprendizado contínuo e crescimento colaborativo.' },
]

/* ─── Animated dashed line (SVG) ───────────────────────────── */
function AnimatedLine({
  x1, y1, x2, y2, delay = 0,
}: { x1: number; y1: number; x2: number; y2: number; delay?: number }) {
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  return (
    <g>
      {/* static dashed track */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#FDBA00" strokeOpacity="0.25" strokeWidth="1.5"
        strokeDasharray="6 6"
      />
      {/* animated travelling dot */}
      <circle r="3" fill="#FDBA00" opacity="0.9">
        <animateMotion
          dur="2.2s"
          repeatCount="indefinite"
          begin={`${delay}s`}
          path={`M${x1},${y1} L${x2},${y2}`}
        />
        <animate attributeName="opacity" values="0;1;1;0" dur="2.2s" repeatCount="indefinite" begin={`${delay}s`} />
      </circle>
    </g>
  )
}

/* ─── Counter hook ──────────────────────────────────────────── */
function useCountUp(target: number, active: boolean, duration = 1200) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      setVal(Math.round(p * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active, target, duration])
  return val
}

/* ─── Stat card ─────────────────────────────────────────────── */
function StatCard({ icon: Icon, value, label, sub, active, delay }: {
  icon: React.ElementType; value: string; label: string; sub: string; active: boolean; delay: number
}) {
  const num = useCountUp(parseInt(value), active, 1000 + delay * 200)
  return (
    <div className="flex items-start gap-3 py-3 px-1 group">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'rgba(253,186,0,0.12)', border: '1px solid rgba(253,186,0,0.25)' }}>
        <Icon size={16} style={{ color: '#FDBA00' }} />
      </div>
      <div>
        <div className="text-2xl font-black text-white leading-none mb-0.5 tabular-nums">
          {active ? num : 0}
        </div>
        <div className="text-sm font-semibold text-white/90">{label}</div>
        <div className="text-xs text-white/45">{sub}</div>
      </div>
    </div>
  )
}

/* ─── Team member card ──────────────────────────────────────── */
function MemberCard({ member }: { member: typeof TEAM[0] }) {
  const Icon = member.icon
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col">
      {/* top colour bar */}
      <div className="h-1 w-full" style={{ background: member.color }} />

      <div className="p-5 flex flex-col flex-1">
        {/* role badge */}
        <div className="flex items-center gap-1.5 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${member.color}1A`, border: `1px solid ${member.color}40` }}>
            <Icon size={12} style={{ color: member.color }} />
          </div>
          <span className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: member.color }}>
            {member.role}
          </span>
        </div>

        {/* photo */}
        <div className="relative mx-auto mb-4 w-20 h-20 shrink-0">
          <img
            src={member.photo}
            alt={member.name}
            className="w-20 h-20 rounded-full object-cover object-top border-2 border-white shadow-md"
          />
          {/* country flag */}
          <span className="absolute -bottom-1 -right-1 text-base leading-none select-none"
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
            {member.flag}
          </span>
        </div>

        {/* name */}
        <div className="text-center mb-1">
          <div className="font-black text-gray-900 text-base leading-tight">{member.name}</div>
          <div className="text-xs text-gray-400 font-medium mt-0.5">{member.title}</div>
        </div>

        {/* bio */}
        <p className="text-xs text-gray-500 leading-relaxed text-center mt-3 flex-1">
          {member.bio}
        </p>
      </div>
    </div>
  )
}

/* ─── Main section ──────────────────────────────────────────── */
export function TeamSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.12 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative py-24 overflow-hidden"
      style={{ background: '#0A0A0A' }}
    >
      {/* bg grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(253,186,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(253,186,0,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      {/* radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center top, rgba(253,186,0,0.07), transparent 70%)' }} />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">

        {/* ── Header ── */}
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full mb-4"
            style={{ background: 'rgba(253,186,0,0.10)', border: '1px solid rgba(253,186,0,0.22)', color: '#FDBA00' }}>
            <Users size={12} />
            Estrutura Organizacional
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Liderança que move o{' '}
            <span style={{ color: '#FDBA00' }}>futuro.</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
            Uma equipa especializada, alinhada e focada em inovação, performance e resultados reais para empresas em{' '}
            <span style={{ color: '#FDBA00' }} className="font-semibold">Angola</span>
            {' '}e{' '}
            <span className="text-green-400 font-semibold">Brasil</span>.
          </p>
        </div>

        {/* ── CEO + Stats row ── */}
        <div className={`grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 mb-0 max-w-4xl mx-auto transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* CEO card */}
          <div className="relative rounded-3xl p-7 md:p-9 border flex flex-col md:flex-row gap-7 items-center md:items-start"
            style={{
              background: 'linear-gradient(135deg, #161616 0%, #111111 100%)',
              borderColor: 'rgba(253,186,0,0.22)',
              boxShadow: '0 0 60px rgba(253,186,0,0.06)',
            }}>

            {/* CEO avatar with animated ring */}
            <div className="relative shrink-0">
              {/* spinning dashed ring */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 128 128" style={{ width: 128, height: 128 }}>
                <circle
                  cx="64" cy="64" r="58"
                  fill="none"
                  stroke="#FDBA00"
                  strokeWidth="2"
                  strokeDasharray="12 6"
                  strokeOpacity="0.5"
                  style={{ animation: 'spin 12s linear infinite', transformOrigin: '64px 64px' }}
                />
                {/* pulse ring */}
                <circle cx="64" cy="64" r="60" fill="none" stroke="#FDBA00" strokeWidth="1" strokeOpacity="0.15">
                  <animate attributeName="r" values="60;66;60" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.15;0;0.15" dur="2.5s" repeatCount="indefinite" />
                </circle>
              </svg>
              <div className="relative w-28 h-28 mx-auto">
                <img
                  src={CEO.photo}
                  alt={CEO.name}
                  className="w-28 h-28 rounded-full object-cover object-top border-4"
                  style={{ borderColor: '#FDBA00' }}
                />
                <span className="absolute -bottom-1 -right-1 text-xl leading-none select-none"
                  style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
                  {CEO.flag}
                </span>
              </div>
            </div>

            {/* CEO info */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-3"
                style={{ background: 'rgba(253,186,0,0.12)', border: '1px solid rgba(253,186,0,0.28)', color: '#FDBA00' }}>
                👑 CEO & Fundador
              </div>
              <h3 className="text-3xl font-black text-white mb-1">{CEO.name}</h3>
              <p className="text-sm font-medium mb-4" style={{ color: '#FDBA00' }}>{CEO.role}</p>
              <p className="text-white/55 text-sm leading-relaxed mb-5 max-w-md">{CEO.bio}</p>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-white/40">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#FDBA00' }} />
                Expansão —{' '}
                <span className="font-bold" style={{ color: '#FDBA00' }}>{CEO.expansion}</span>
              </div>
            </div>
          </div>

          {/* Stats card */}
          <div className="rounded-3xl p-6 border flex flex-col justify-center gap-1 min-w-[200px]"
            style={{
              background: 'linear-gradient(135deg, #161616 0%, #111111 100%)',
              borderColor: 'rgba(253,186,0,0.18)',
            }}>
            <div className="text-xs font-bold tracking-widest uppercase mb-2 px-1"
              style={{ color: 'rgba(253,186,0,0.6)' }}>
              Nossa Equipa
            </div>
            <div className="divide-y divide-white/5">
              {STATS.map((s, i) => (
                <StatCard key={s.label} {...s} active={visible} delay={i} />
              ))}
            </div>
            <div className="mt-3 px-1">
              <div className="text-[10px] text-white/25 font-medium tracking-wide">
                Expansão → Angola & Brasil
              </div>
            </div>
          </div>
        </div>

        {/* ── Animated connector lines (desktop only) ── */}
        <div className="hidden lg:block relative h-16 max-w-4xl mx-auto overflow-visible" aria-hidden="true">
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 64">
            {/* vertical from CEO down */}
            <AnimatedLine x1={300} y1={0} x2={300} y2={64} delay={0} />
            {/* horizontal bar */}
            <AnimatedLine x1={80}  y1={64} x2={520} y2={64} delay={0.4} />
            {/* five verticals down to team */}
            {[80, 200, 300, 400, 520].map((x, i) => (
              <AnimatedLine key={i} x1={x} y1={64} x2={x} y2={64} delay={0.2 * i} />
            ))}
          </svg>
        </div>

        {/* ── Team grid ── */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5 max-w-4xl mx-auto transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {TEAM.map((m) => (
            <MemberCard key={m.name} member={m} />
          ))}
        </div>

        {/* ── Values row ── */}
        <div className={`mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {VALUES.map(({ icon: Icon, label, text }) => (
            <div key={label}
              className="group flex flex-col gap-3 rounded-2xl p-5 border hover:border-[#FDBA00]/40 hover:shadow-lg transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(253,186,0,0.10)', border: '1px solid rgba(253,186,0,0.22)' }}>
                <Icon size={18} style={{ color: '#FDBA00' }} />
              </div>
              <div>
                <div className="font-bold text-white text-sm mb-1">{label}</div>
                <p className="text-white/45 text-xs leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* spin animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  )
}
