'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Rocket, Eye, Diamond, Heart,
  Users, Target, Lightbulb,
  TrendingUp, Palette, Server, BarChart3, Film,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ─── Theme ─────────────────────────────────────────────────── */
const BLUE = '#3B82F6'
const BLUE_DIM = 'rgba(59,130,246,0.18)'
const BLUE_BORDER = 'rgba(59,130,246,0.28)'
const BLUE_GLOW = 'rgba(59,130,246,0.45)'
const GOLD = '#FDBA00'

/* ─── Static fallback data ──────────────────────────────────── */
const CEO_DEFAULT = {
  name: 'Manuel Muenho',
  role: 'CEO & Founder',
  title: 'CEO & FUNDADOR',
  photo: '/Manuel Muenho.jpeg',
  flag: '🇦🇴',
  secondary_flag: '🇧🇷',
  secondary_country_name: 'Brasil',
  bio: 'Fundador da ViralizaHost com visão de democratizar o acesso à tecnologia e liderar a expansão dos serviços digitais em Angola e no Brasil.',
}

const SPECIALTY_ICON: Record<string, React.ElementType> = {
  'tráfego pago': TrendingUp,
  'design gráfico': Palette,
  'hosting & infra': Server,
  'hosting & infraestrutura': Server,
  'crescimento digital': BarChart3,
  audiovisual: Film,
}

function specialtyIcon(role: string): React.ElementType {
  const key = role.toLowerCase().trim()
  return SPECIALTY_ICON[key] ?? TrendingUp
}

const TEAM_DEFAULT = [
  { name: 'Lucas Marcelino',     role: 'Tráfego Pago',              photo: '/Lucas Marcelino.jpeg',    flag: '🇧🇷', bio: 'Especialista em Meta Ads, Google Ads e estratégias de conversão e crescimento digital.' },
  { name: 'Jacob Pessela',       role: 'Design Gráfico',             photo: '/Jacobe Pessela.jpeg',     flag: '🇦🇴', bio: 'Especialista em branding, identidade visual e comunicação criativa empresarial.' },
  { name: 'Vladmiro Francisco',  role: 'Hosting & Infraestrutura',   photo: '/Valdmiro Macedo.jpeg',    flag: '🇦🇴', bio: 'Especialista em servidores web, cloud hosting, e-mails corporativos, redes e infraestrutura tecnológica.' },
  { name: 'Israel Soares',       role: 'Crescimento Digital',        photo: '/Israel Soares.png',       flag: '🇧🇷', bio: 'Especialista em crescimento digital, estratégias para redes sociais, posicionamento online e aquisição de clientes.' },
  { name: 'Arnaldo Eduardo',     role: 'Audiovisual',                photo: '/Arnaldo Eduardo.jpeg',    flag: '🇦🇴', bio: 'Especialista em produção audiovisual, vídeos publicitários, motion graphics e conteúdos digitais premium.' },
]

const STATS = [
  { icon: Users,     value: 6, label: 'Especialistas',      sub: 'Profissionais dedicados' },
  { icon: Target,    value: 5, label: 'Áreas Estratégicas', sub: 'Cobertura completa' },
  { icon: Lightbulb, value: 1, label: 'Visão',              sub: 'Resultados extraordinários' },
]

const VALUES = [
  { icon: Rocket,  label: 'Missão',  text: 'Transformar ideias em presença digital, tecnologia e resultados.' },
  { icon: Eye,     label: 'Visão',   text: 'Ser referência em soluções digitais em Angola, Brasil e no mundo.' },
  { icon: Diamond, label: 'Valores', text: 'Inovação, ética, excelência, compromisso e resultados sustentáveis.' },
  { icon: Heart,   label: 'Cultura', text: 'Foco em pessoas, aprendizado contínuo e crescimento colaborativo.' },
]

/* ─── DB type ───────────────────────────────────────────────── */
type DbTeamMember = {
  id: string
  is_ceo: boolean
  name: string
  role: string | null
  title: string | null
  bio: string | null
  photo_url: string | null
  flag: string | null
  country: string | null
  country_code: string | null
  secondary_flag: string | null
  secondary_country_name: string | null
  specialty: string | null
  accent_color: string
  position: number
}

type CeoData = typeof CEO_DEFAULT
type MemberData = typeof TEAM_DEFAULT[0]

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
        style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}` }}>
        <Icon size={16} color={BLUE} />
      </div>
      <div>
        <div className="text-2xl font-black text-white tabular-nums leading-none mb-0.5">{num}</div>
        <div className="text-sm font-semibold text-white/90">{label}</div>
        <div className="text-xs text-white/40">{sub}</div>
      </div>
    </div>
  )
}

/* ─── Spinning dashed ring ───────────────────────────────────── */
function SpinningRing({ size, color }: { size: number; color: string }) {
  const r = size / 2 - 3
  return (
    <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="1.5"
        strokeDasharray="8 5" strokeOpacity="0.6"
        style={{ animation: 'spinRing 12s linear infinite', transformOrigin: `${size/2}px ${size/2}px` }} />
    </svg>
  )
}

/* ─── Member card ───────────────────────────────────────────── */
function MemberCard({ member, index, visible }: { member: MemberData; index: number; visible: boolean }) {
  const Icon = specialtyIcon(member.role)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group relative flex flex-col items-center text-center rounded-2xl p-5 transition-all duration-300 cursor-default"
      style={{
        background: 'linear-gradient(145deg, #0D1B2E 0%, #0A1628 100%)',
        border: `1px solid ${hovered ? BLUE : BLUE_BORDER}`,
        boxShadow: hovered ? `0 8px 40px ${BLUE_GLOW}` : '0 4px 24px rgba(0,0,0,0.30)',
        transitionDelay: `${index * 60}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? 'translateY(-8px) scale(1.03)' : 'translateY(0)') : 'translateY(24px)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* top blue line */}
      <div className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${BLUE}, transparent)`, opacity: 0.7 }} />

      {/* flag — top-right */}
      {member.flag && (
        <span className="absolute top-3 right-3 text-lg leading-none select-none"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))' }}>
          {member.flag}
        </span>
      )}

      {/* specialty badge */}
      <div className="flex items-center gap-1.5 mb-4 self-start mt-1">
        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
          style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}` }}>
          <Icon size={11} color={BLUE} />
        </div>
        <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: BLUE }}>
          {member.role}
        </span>
      </div>

      {/* photo with spinning ring */}
      <div className="relative mb-3" style={{ width: 88, height: 88 }}>
        <SpinningRing size={88} color={BLUE} />
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="absolute inset-0 m-auto w-[72px] h-[72px] rounded-full object-cover object-top"
            style={{ border: `2px solid ${BLUE}80`, boxShadow: `0 0 12px ${BLUE_GLOW}` }}
            onError={e => {
              e.currentTarget.style.display = 'none'
              const next = e.currentTarget.nextElementSibling as HTMLElement | null
              if (next) next.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="absolute inset-0 m-auto w-[72px] h-[72px] rounded-full items-center justify-center font-black text-2xl"
          style={{ display: member.photo ? 'none' : 'flex', background: BLUE_DIM, color: BLUE, border: `2px solid ${BLUE}80` }}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="font-black text-white text-sm leading-tight mb-0.5">{member.name}</div>
      <div className="text-xs font-semibold mb-3" style={{ color: '#60A5FA' }}>Especialista</div>
      <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{member.bio}</p>
    </div>
  )
}

/* ─── Animated blue connector lines ─────────────────────────── */
function ConnectorLines({ count }: { count: number }) {
  const offsets = ['10%', '27.5%', '50%', '72.5%', '90%']
  return (
    <div className="hidden lg:block relative w-full h-14 my-0" aria-hidden="true" style={{ overflow: 'visible' }}>
      {/* vertical from CEO to rail */}
      <div className="absolute left-1/2 -translate-x-px top-0 h-6 w-px"
        style={{ borderLeft: `2px dashed ${BLUE}`, opacity: 0.7 }} />
      {/* glow node at junction */}
      <div className="absolute left-1/2 -translate-x-1/2 top-6 w-2.5 h-2.5 rounded-full z-10"
        style={{
          background: BLUE,
          boxShadow: `0 0 8px 3px ${BLUE_GLOW}`,
          animation: 'nodePulse 2s ease-in-out infinite',
        }} />
      {/* horizontal rail */}
      <div className="absolute top-6 h-px"
        style={{
          left: offsets[0], right: `calc(100% - ${offsets[count - 1]})`,
          borderTop: `2px dashed ${BLUE}`,
          opacity: 0.6,
          backgroundImage: `linear-gradient(90deg, ${BLUE} 40%, transparent 40%)`,
          backgroundSize: '14px 2px',
          animation: 'dashMove 1.2s linear infinite',
        }} />
      {/* verticals + nodes per member */}
      {offsets.slice(0, count).map((x, i) => (
        <div key={i}>
          <div className="absolute top-6 h-8 w-px"
            style={{ left: x, transform: 'translateX(-50%)', borderLeft: `2px dashed ${BLUE}`, opacity: 0.65 }} />
          <div className="absolute w-2 h-2 rounded-full z-10"
            style={{
              left: x, transform: 'translateX(-50%)', top: '3.25rem',
              background: BLUE,
              boxShadow: `0 0 6px 2px ${BLUE_GLOW}`,
              animation: `nodePulse 2s ease-in-out ${i * 0.18}s infinite`,
            }} />
        </div>
      ))}
    </div>
  )
}

/* ─── CEO card ───────────────────────────────────────────────── */
function CeoCard({ ceo, visible }: { ceo: CeoData; visible: boolean }) {
  return (
    <div className={`flex-1 rounded-3xl p-7 md:p-9 border relative overflow-hidden flex flex-col md:flex-row gap-7 items-center md:items-start transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{
        background: 'linear-gradient(135deg, #0D1B2E 0%, #0A1628 100%)',
        borderColor: BLUE_BORDER,
        boxShadow: `0 0 60px ${BLUE_DIM}`,
      }}>
      {/* corner glow */}
      <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${BLUE_DIM}, transparent 70%)` }} />

      {/* avatar with spinning ring */}
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: 128, height: 128 }}>
        <svg className="absolute inset-0" width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r="58" fill="none" stroke={BLUE} strokeWidth="1.8"
            strokeDasharray="10 6" strokeOpacity="0.55"
            style={{ animation: 'spinRing 14s linear infinite', transformOrigin: '64px 64px' }} />
          <circle cx="64" cy="64" r="61" fill="none" stroke={BLUE} strokeWidth="1" strokeOpacity="0.12">
            <animate attributeName="r" values="61;67;61" dur="2.8s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.12;0;0.12" dur="2.8s" repeatCount="indefinite" />
          </circle>
        </svg>
        {ceo.photo ? (
          <img src={ceo.photo} alt={ceo.name}
            className="w-24 h-24 rounded-full object-cover object-top"
            style={{ border: `3px solid ${BLUE}`, boxShadow: `0 0 20px ${BLUE_GLOW}` }}
            onError={e => {
              e.currentTarget.style.display = 'none'
              const next = e.currentTarget.nextElementSibling as HTMLElement | null
              if (next) next.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="w-24 h-24 rounded-full items-center justify-center font-black text-3xl"
          style={{ display: ceo.photo ? 'none' : 'flex', background: BLUE_DIM, color: BLUE, border: `3px solid ${BLUE}`, boxShadow: `0 0 20px ${BLUE_GLOW}` }}
        >
          {ceo.name.charAt(0).toUpperCase()}
        </div>

        {/* two flags for CEO — overlapping bottom-right */}
        <div className="absolute bottom-0 right-0 flex items-center gap-0.5"
          style={{ filter: 'drop-shadow(0 1px 3px #000)' }}>
          <span className="text-lg leading-none">{ceo.flag}</span>
          <span className="text-lg leading-none">{ceo.secondary_flag}</span>
        </div>
      </div>

      <div className="flex-1 text-center md:text-left">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-3"
          style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, color: BLUE }}>
          👑 {ceo.title}
        </span>
        <h3 className="text-3xl font-black text-white leading-tight mb-1">{ceo.name}</h3>
        <p className="text-sm font-semibold mb-4" style={{ color: '#60A5FA' }}>{ceo.role}</p>
        <p className="text-white/55 text-sm leading-relaxed mb-5 max-w-md">{ceo.bio}</p>
        <div className="inline-flex items-center gap-2 text-xs text-white/35">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BLUE }} />
          Expansão —{' '}
          <strong style={{ color: '#F59E0B' }}>Angola</strong>
          {' '}&{' '}
          <strong className="text-green-400">Brasil</strong>
          {' '}
          <span>{ceo.flag}</span>
          <span>{ceo.secondary_flag}</span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────────── */
export function TeamSection() {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [ceo, setCeo] = useState<CeoData>(CEO_DEFAULT)
  const [team, setTeam] = useState<MemberData[]>(TEAM_DEFAULT)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('site_team')
      .select('*')
      .order('is_ceo', { ascending: false })
      .order('position')
      .then(({ data }) => {
        if (!data || data.length === 0) return
        const members = data as DbTeamMember[]
        const ceoData = members.find(m => m.is_ceo)
        const teamData = members.filter(m => !m.is_ceo)

        if (ceoData) {
          setCeo({
            name: ceoData.name,
            role: ceoData.role ?? 'CEO & Founder',
            title: ceoData.title ?? 'CEO & FUNDADOR',
            photo: ceoData.photo_url ?? '',
            flag: ceoData.flag ?? '🇦🇴',
            secondary_flag: ceoData.secondary_flag ?? '🇧🇷',
            secondary_country_name: ceoData.secondary_country_name ?? 'Brasil',
            bio: ceoData.bio ?? '',
          })
        }

        if (teamData.length > 0) {
          setTeam(teamData.map(m => ({
            name: m.name,
            role: m.specialty ?? m.role ?? '',
            photo: m.photo_url ?? '',
            flag: m.flag ?? '',
            bio: m.bio ?? '',
          })))
        }
      })
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.08 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className="relative py-24 overflow-hidden" style={{ background: '#070F1A' }}>

      {/* bg grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${BLUE_DIM} 1px, transparent 1px),linear-gradient(90deg,${BLUE_DIM} 1px,transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
      {/* top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-64 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${BLUE_DIM}, transparent 70%)` }} />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">

        {/* header */}
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 text-[11px] font-black tracking-widest uppercase px-4 py-2 rounded-full mb-5"
            style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, color: BLUE }}>
            <Users size={12} />
            Estrutura Organizacional
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Liderança que move o{' '}
            <span style={{ color: BLUE }}>futuro.</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Uma equipa especializada, focada em inovação, performance e resultados reais para empresas em{' '}
            <span style={{ color: GOLD }} className="font-semibold">Angola</span>
            {' '}e{' '}
            <span className="text-green-400 font-semibold">Brasil</span>.
          </p>
        </div>

        {/* ─ CEO + Stats row ─ */}
        <div className={`flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto mb-0 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <CeoCard ceo={ceo} visible={visible} />

          {/* Stats card */}
          <div className="rounded-3xl p-7 border flex flex-col justify-center gap-0 lg:min-w-[220px]"
            style={{
              background: 'linear-gradient(135deg, #0D1B2E 0%, #0A1628 100%)',
              borderColor: BLUE_BORDER,
            }}>
            <div className="text-[10px] font-black tracking-widest uppercase mb-4"
              style={{ color: `${BLUE}99` }}>
              Nossa Equipa
            </div>
            {STATS.map((s, i) => (
              <StatCard key={s.label} {...s} active={visible} delay={i} />
            ))}
            <div className="mt-4 flex items-center gap-2 text-[10px] text-white/20 font-medium tracking-wide">
              <span>🇦🇴</span><span>Angola & Brasil</span><span>🇧🇷</span>
            </div>
          </div>
        </div>

        {/* ─ Connector lines ─ */}
        <div className="max-w-5xl mx-auto">
          <ConnectorLines count={team.length} />
        </div>

        {/* ─ Team grid ─ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 max-w-5xl mx-auto">
          {team.map((m, i) => (
            <MemberCard key={m.name} member={m} index={i} visible={visible} />
          ))}
        </div>

        {/* ─ Values row ─ */}
        <div className={`mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {VALUES.map(({ icon: Icon, label, text }) => (
            <div key={label}
              className="group flex flex-col gap-4 rounded-2xl p-6 border transition-all duration-300"
              style={{
                background: 'linear-gradient(145deg, #0D1B2E 0%, #0A1628 100%)',
                borderColor: BLUE_BORDER,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = BLUE
                el.style.boxShadow = `0 0 30px ${BLUE_DIM}`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = BLUE_BORDER
                el.style.boxShadow = 'none'
              }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}` }}>
                <Icon size={20} color={BLUE} />
              </div>
              <div>
                <div className="font-bold text-white text-sm mb-1.5">{label}</div>
                <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* keyframes — respects prefers-reduced-motion */}
      <style>{`
        @keyframes spinRing  { to { transform: rotate(360deg); } }
        @keyframes nodePulse { 0%,100%{ opacity:1; transform:translateX(-50%) scale(1); } 50%{ opacity:.5; transform:translateX(-50%) scale(1.5); } }
        @keyframes dashMove  { to { background-position: 14px 0; } }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </section>
  )
}
