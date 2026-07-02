'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Rocket, Eye, Diamond, Heart,
  Users, Target, Lightbulb,
  TrendingUp, Palette, Server, BarChart3, Film,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ─── Data ───────────────────────────────────────────────────── */

const CEO = {
  name: 'Manuel Muenho',
  role: 'CEO & Fundador da ViralizaHost',
  photo: '/Manuel Muenho.jpeg',
  flag: '🇦🇴',
  bio: 'Especialista em Tecnologia, Gestão de Projetos, Infraestrutura Digital e Transformação Tecnológica. Lidera a expansão internacional da ViralizaHost com visão estratégica e excelência operacional.',
}

const STATS = [
  { icon: Users,     value: 6,  label: 'Especialistas',       sub: 'Profissionais dedicados' },
  { icon: Target,    value: 5,  label: 'Áreas Estratégicas',  sub: 'Cobertura completa' },
  { icon: Lightbulb, value: 1,  label: 'Visão',               sub: 'Resultados extraordinários' },
]

const TEAM = [
  { name: 'Lucas Marcelino',  role: 'Tráfego Pago',          photo: '/Lucas Marcelino.jpeg',  flag: '🇧🇷', icon: TrendingUp, color: '#F59E0B', bio: 'Especialista em Meta Ads, Google Ads e estratégias de conversão e crescimento digital.' },
  { name: 'Jacob Pessela',    role: 'Design Gráfico',         photo: '/Jacobe Pessela.jpeg',   flag: '🇦🇴', icon: Palette,    color: '#8B5CF6', bio: 'Especialista em branding, identidade visual e comunicação criativa empresarial.' },
  { name: 'Vladimiro Francisco', role: 'Hosting & Infra',    photo: '/Valdmiro Macedo.jpeg',  flag: '🇦🇴', icon: Server,     color: '#FDBA00', bio: 'Especialista em servidores web, cloud hosting, e-mails corporativos e infraestrutura.' },
  { name: 'Israel Soares',    role: 'Crescimento Digital',    photo: '/Israel Soares.png',     flag: '🇧🇷', icon: BarChart3,  color: '#10B981', bio: 'Especialista em crescimento digital, estratégias sociais e posicionamento online.' },
  { name: 'Arnaldo Eduardo',  role: 'Audiovisual',            photo: '/Arnaldo Eduardo.jpeg',  flag: '🇦🇴', icon: Film,       color: '#EF4444', bio: 'Especialista em produção audiovisual, motion graphics e conteúdos digitais premium.' },
]

const VALUES = [
  { icon: Rocket,  label: 'Missão',  text: 'Transformar ideias em presença digital, tecnologia e resultados.' },
  { icon: Eye,     label: 'Visão',   text: 'Ser referência em soluções digitais em Angola, Brasil e no mundo.' },
  { icon: Diamond, label: 'Valores', text: 'Inovação, ética, excelência, compromisso e resultados sustentáveis.' },
  { icon: Heart,   label: 'Cultura', text: 'Foco em pessoas, aprendizado contínuo e crescimento colaborativo.' },
]

/* ─── Counter ───────────────────────────────────────────────── */
function useCountUp(target: number, active: boolean, duration = 1000) {
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
  icon: React.ElementType; value: number; label: string; sub: string; active: boolean; delay: number
}) {
  const num = useCountUp(value, active, 900 + delay * 150)
  return (
    <div className="flex items-start gap-3 py-4 border-b border-white/5 last:border-0">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(253,186,0,0.10)', border: '1px solid rgba(253,186,0,0.20)' }}>
        <Icon size={16} color="#FDBA00" />
      </div>
      <div>
        <div className="text-2xl font-black text-white tabular-nums leading-none mb-0.5">{num}</div>
        <div className="text-sm font-semibold text-white/90">{label}</div>
        <div className="text-xs text-white/40">{sub}</div>
      </div>
    </div>
  )
}

/* ─── Member card ───────────────────────────────────────────── */
function MemberCard({ member, index, visible }: { member: typeof TEAM[0]; index: number; visible: boolean }) {
  const Icon = member.icon
  return (
    <div
      className="group relative flex flex-col items-center text-center rounded-2xl p-5 border transition-all duration-300 cursor-default"
      style={{
        background: '#0A0A0A',
        borderColor: 'rgba(253,186,0,0.22)',
        boxShadow: '0 0 0 0 rgba(253,186,0,0)',
        transitionDelay: `${index * 60}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-8px) scale(1.02)'
        el.style.boxShadow = '0 8px 40px rgba(253,186,0,0.18)'
        el.style.borderColor = '#FDBA00'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(0) scale(1)'
        el.style.boxShadow = '0 0 0 0 rgba(253,186,0,0)'
        el.style.borderColor = 'rgba(253,186,0,0.22)'
      }}
    >
      {/* top colour stripe */}
      <div className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${member.color}, transparent)` }} />

      {/* role badge */}
      <div className="flex items-center gap-1.5 mb-4 self-start">
        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
          style={{ background: `${member.color}1A`, border: `1px solid ${member.color}50` }}>
          <Icon size={11} color={member.color} />
        </div>
        <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: member.color }}>
          {member.role}
        </span>
      </div>

      {/* photo */}
      <div className="relative mb-3">
        <img
          src={member.photo}
          alt={member.name}
          className="w-20 h-20 rounded-full object-cover object-top"
          style={{ border: `2px solid ${member.color}60` }}
        />
        <span className="absolute -bottom-1 -right-0.5 text-sm leading-none select-none"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))' }}>
          {member.flag}
        </span>
      </div>

      <div className="font-black text-white text-sm leading-tight mb-0.5">{member.name}</div>
      <div className="text-xs font-semibold mb-3" style={{ color: '#FDBA00' }}>Especialista</div>
      <p className="text-xs leading-relaxed" style={{ color: '#B0B0B0' }}>{member.bio}</p>
    </div>
  )
}

/* ─── CSS animated dashed connector ─────────────────────────── */
function ConnectorLines({ count }: { count: number }) {
  // horizontal offsets as percentages for each member card (5 cards)
  const offsets = ['10%', '27.5%', '50%', '72.5%', '90%']
  return (
    <div className="hidden lg:block relative w-full h-14 my-0" aria-hidden="true" style={{ overflow: 'visible' }}>
      {/* vertical from CEO down to horizontal rail */}
      <div className="absolute left-1/2 -translate-x-px top-0 h-6 w-px"
        style={{ borderLeft: '2px dashed #FDBA00', opacity: 0.7 }} />
      {/* glow node at junction */}
      <div className="absolute left-1/2 -translate-x-1/2 top-6 w-2.5 h-2.5 rounded-full z-10"
        style={{
          background: '#FDBA00',
          boxShadow: '0 0 8px 3px rgba(253,186,0,0.6)',
          animation: 'nodePulse 2s ease-in-out infinite',
        }} />
      {/* horizontal rail from first to last card — centred between their midpoints */}
      <div className="absolute top-6 h-px"
        style={{
          left: offsets[0], right: `calc(100% - ${offsets[count - 1]})`,
          borderTop: '2px dashed #FDBA00',
          opacity: 0.6,
          backgroundImage: 'linear-gradient(90deg, #FDBA00 40%, transparent 40%)',
          backgroundSize: '14px 2px',
          animation: 'dashMove 1.2s linear infinite',
        }} />
      {/* verticals + nodes for each member */}
      {offsets.slice(0, count).map((x, i) => (
        <div key={i}>
          <div className="absolute top-6 h-8 w-px"
            style={{
              left: x, transform: 'translateX(-50%)',
              borderLeft: '2px dashed #FDBA00',
              opacity: 0.65,
            }} />
          <div className="absolute w-2 h-2 rounded-full z-10"
            style={{
              left: x, transform: 'translateX(-50%)',
              top: '3.25rem',
              background: '#FDBA00',
              boxShadow: '0 0 6px 2px rgba(253,186,0,0.55)',
              animation: `nodePulse 2s ease-in-out ${i * 0.18}s infinite`,
            }} />
        </div>
      ))}
    </div>
  )
}

type DbTeamMember = {
  id: string
  is_ceo: boolean
  name: string
  role: string | null
  title: string | null
  bio: string | null
  photo_url: string | null
  flag: string | null
  accent_color: string
  position: number
}

/* ─── Main ───────────────────────────────────────────────────── */
export function TeamSection() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [activeCEO, setActiveCEO] = useState(CEO)
  const [activeTeam, setActiveTeam] = useState(TEAM)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('site_team')
      .select('*')
      .order('is_ceo', { ascending: false })
      .order('position')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const members = data as DbTeamMember[]
          const ceoData = members.find(m => m.is_ceo)
          const teamData = members.filter(m => !m.is_ceo)
          if (ceoData) {
            setActiveCEO({
              name: ceoData.name,
              role: ceoData.role ?? '',
              photo: ceoData.photo_url ?? '',
              flag: ceoData.flag ?? '🇦🇴',
              bio: ceoData.bio ?? '',
            })
          }
          if (teamData.length > 0) {
            setActiveTeam(teamData.map(m => ({
              name: m.name,
              role: m.role ?? '',
              photo: m.photo_url ?? '',
              flag: m.flag ?? '',
              icon: TrendingUp,
              color: m.accent_color ?? '#F5B700',
              bio: m.bio ?? '',
            })))
          }
        }
      })
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.08 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative py-24 overflow-hidden" style={{ background: '#0A0A0A' }}>

      {/* bg grid subtle */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(253,186,0,0.025) 1px, transparent 1px),linear-gradient(90deg,rgba(253,186,0,0.025) 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
      {/* top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-64 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(253,186,0,0.06), transparent 70%)' }} />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">

        {/* header */}
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 text-[11px] font-black tracking-widest uppercase px-4 py-2 rounded-full mb-5"
            style={{ background: 'rgba(253,186,0,0.08)', border: '1px solid rgba(253,186,0,0.22)', color: '#FDBA00' }}>
            <Users size={12} />
            Estrutura Organizacional
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Liderança que move o{' '}
            <span style={{ color: '#FDBA00' }}>futuro.</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Uma equipa especializada, focada em inovação, performance e resultados reais para empresas em{' '}
            <span style={{ color: '#FDBA00' }} className="font-semibold">Angola</span>
            {' '}e{' '}
            <span className="text-green-400 font-semibold">Brasil</span>.
          </p>
        </div>

        {/* ─ Top row: CEO + Stats ─ */}
        <div className={`flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto mb-0 transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* CEO card */}
          <div className="flex-1 rounded-3xl p-7 md:p-9 border relative overflow-hidden flex flex-col md:flex-row gap-7 items-center md:items-start"
            style={{
              background: 'linear-gradient(135deg,#111111 0%,#0D0D0D 100%)',
              borderColor: 'rgba(253,186,0,0.30)',
              boxShadow: '0 0 60px rgba(253,186,0,0.07)',
            }}>
            {/* corner glow */}
            <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
              style={{ background: 'radial-gradient(circle at top right, rgba(253,186,0,0.08), transparent 70%)' }} />

            {/* avatar with spinning ring */}
            <div className="relative shrink-0 flex items-center justify-center" style={{ width: 128, height: 128 }}>
              <svg className="absolute inset-0" width="128" height="128" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="58" fill="none" stroke="#FDBA00" strokeWidth="1.8"
                  strokeDasharray="10 6" strokeOpacity="0.55"
                  style={{ animation: 'spinRing 14s linear infinite', transformOrigin: '64px 64px' }} />
                <circle cx="64" cy="64" r="61" fill="none" stroke="#FDBA00" strokeWidth="1" strokeOpacity="0.12">
                  <animate attributeName="r" values="61;67;61" dur="2.8s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.12;0;0.12" dur="2.8s" repeatCount="indefinite" />
                </circle>
              </svg>
              <img src={activeCEO.photo} alt={activeCEO.name}
                className="w-24 h-24 rounded-full object-cover object-top"
                style={{ border: '3px solid #FDBA00', boxShadow: '0 0 20px rgba(253,186,0,0.30)' }} />
              <span className="absolute bottom-0 right-0 text-xl" style={{ filter: 'drop-shadow(0 1px 3px #000)' }}>
                {activeCEO.flag}
              </span>
            </div>

            <div className="flex-1 text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-3"
                style={{ background: 'rgba(253,186,0,0.10)', border: '1px solid rgba(253,186,0,0.30)', color: '#FDBA00' }}>
                👑 CEO & Fundador
              </span>
              <h3 className="text-3xl font-black text-white leading-tight mb-1">{activeCEO.name}</h3>
              <p className="text-sm font-semibold mb-4" style={{ color: '#FDBA00' }}>{activeCEO.role}</p>
              <p className="text-white/55 text-sm leading-relaxed mb-5 max-w-md">{activeCEO.bio}</p>
              <div className="inline-flex items-center gap-2 text-xs text-white/35">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FDBA00' }} />
                Expansão —{' '}
                <strong style={{ color: '#FDBA00' }}>Angola & Brasil</strong>
              </div>
            </div>
          </div>

          {/* Stats card */}
          <div className="rounded-3xl p-7 border flex flex-col justify-center gap-0 lg:min-w-[220px]"
            style={{
              background: 'linear-gradient(135deg,#111111 0%,#0D0D0D 100%)',
              borderColor: 'rgba(253,186,0,0.22)',
            }}>
            <div className="text-[10px] font-black tracking-widest uppercase mb-4"
              style={{ color: 'rgba(253,186,0,0.55)' }}>
              Nossa Equipa
            </div>
            {STATS.map((s, i) => (
              <StatCard key={s.label} {...s} active={visible} delay={i} />
            ))}
            <div className="mt-4 text-[10px] text-white/20 font-medium tracking-wide">
              Angola & Brasil — Expansão Internacional
            </div>
          </div>
        </div>

        {/* ─ Animated connector lines ─ */}
        <div className="max-w-5xl mx-auto">
          <ConnectorLines count={activeTeam.length} />
        </div>

        {/* ─ Team grid ─ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 max-w-5xl mx-auto">
          {activeTeam.map((m, i) => (
            <MemberCard key={m.name} member={m} index={i} visible={visible} />
          ))}
        </div>

        {/* ─ Values row ─ */}
        <div className={`mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {VALUES.map(({ icon: Icon, label, text }) => (
            <div key={label}
              className="group flex flex-col gap-4 rounded-2xl p-6 border transition-all duration-300 hover:border-[#FDBA00]/50 hover:shadow-[0_0_30px_rgba(253,186,0,0.10)]"
              style={{ background: '#111111', borderColor: 'rgba(253,186,0,0.15)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(253,186,0,0.08)', border: '1px solid rgba(253,186,0,0.22)' }}>
                <Icon size={20} color="#FDBA00" />
              </div>
              <div>
                <div className="font-bold text-white text-sm mb-1.5">{label}</div>
                <p className="text-xs leading-relaxed" style={{ color: '#B0B0B0' }}>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* keyframes */}
      <style>{`
        @keyframes spinRing  { to { transform: rotate(360deg); } }
        @keyframes nodePulse { 0%,100%{ opacity:1; transform:translateX(-50%) scale(1); } 50%{ opacity:.5; transform:translateX(-50%) scale(1.5); } }
        @keyframes dashMove  { to { background-position: 14px 0; } }
      `}</style>
    </section>
  )
}
