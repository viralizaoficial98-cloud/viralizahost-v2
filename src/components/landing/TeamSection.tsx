'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Rocket, Eye, Diamond, Heart,
  Users, Target, Lightbulb,
  TrendingUp, Palette, Server, BarChart3, Film,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/* ─── Theme — black & gold ───────────────────────────────────── */
const GOLD        = '#FDBA00'
const GOLD_DIM    = 'rgba(253,186,0,0.10)'
const GOLD_BORDER = 'rgba(253,186,0,0.22)'
const GOLD_GLOW   = 'rgba(253,186,0,0.38)'
const CARD_BG     = 'linear-gradient(145deg,#131313 0%,#0E0E0E 100%)'
const SECTION_BG  = '#080808'

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
  { name: 'Lucas Marcelino',    role: 'Tráfego Pago',            photo: '/Lucas Marcelino.jpeg',   flag: '🇧🇷', bio: 'Especialista em Meta Ads, Google Ads e estratégias de conversão e crescimento digital.' },
  { name: 'Jacob Pessela',      role: 'Design Gráfico',           photo: '/Jacobe Pessela.jpeg',    flag: '🇦🇴', bio: 'Especialista em branding, identidade visual e comunicação criativa empresarial.' },
  { name: 'Vladmiro Francisco', role: 'Hosting & Infraestrutura', photo: '/Valdmiro Macedo.jpeg',   flag: '🇦🇴', bio: 'Especialista em servidores web, cloud hosting, e-mails corporativos, redes e infraestrutura tecnológica.' },
  { name: 'Israel Soares',      role: 'Crescimento Digital',      photo: '/Israel Soares.png',      flag: '🇧🇷', bio: 'Especialista em crescimento digital, estratégias para redes sociais, posicionamento online e aquisição de clientes.' },
  { name: 'Arnaldo Eduardo',    role: 'Audiovisual',              photo: '/Arnaldo Eduardo.jpeg',   flag: '🇦🇴', bio: 'Especialista em produção audiovisual, vídeos publicitários, motion graphics e conteúdos digitais premium.' },
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
  id: string; is_ceo: boolean; name: string; role: string | null; title: string | null
  bio: string | null; photo_url: string | null; flag: string | null; country: string | null
  country_code: string | null; secondary_flag: string | null; secondary_country_name: string | null
  specialty: string | null; accent_color: string; position: number
}
type CeoData    = typeof CEO_DEFAULT
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
    <div className="flex items-start gap-3 py-4 border-b last:border-0" style={{ borderColor: GOLD_BORDER }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}` }}>
        <Icon size={16} color={GOLD} />
      </div>
      <div>
        <div className="text-2xl font-black text-white tabular-nums leading-none mb-0.5">{num}</div>
        <div className="text-sm font-semibold text-white/90">{label}</div>
        <div className="text-xs text-white/40">{sub}</div>
      </div>
    </div>
  )
}

/* ─── Spinning dashed ring — uses viewBox so CSS can resize it ── */
function SpinningRing({ vb, color }: { vb: number; color: string }) {
  const r = vb / 2 - 4
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${vb} ${vb}`} preserveAspectRatio="xMidYMid meet">
      <circle cx={vb/2} cy={vb/2} r={r} fill="none" stroke={color}
        strokeWidth="1.5" strokeDasharray="8 5" strokeOpacity="0.65"
        style={{ animation: 'spinRing 12s linear infinite', transformOrigin: `${vb/2}px ${vb/2}px` }} />
    </svg>
  )
}

/* ─── Member card ─── responsive photo via CSS class vh-member-* */
function MemberCard({ member, index, visible }: { member: MemberData; index: number; visible: boolean }) {
  const Icon = specialtyIcon(member.role)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="vh-member-card group relative flex flex-col items-center text-center rounded-2xl transition-all duration-300 cursor-default"
      style={{
        padding: '28px 22px',
        background: CARD_BG,
        border: `1px solid ${hovered ? GOLD : GOLD_BORDER}`,
        boxShadow: hovered ? `0 8px 40px ${GOLD_GLOW}` : '0 4px 24px rgba(0,0,0,0.40)',
        transitionDelay: `${index * 60}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? 'translateY(-8px) scale(1.03)' : 'translateY(0)') : 'translateY(24px)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* top gold accent line */}
      <div className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.5 }} />

      {/* flag — top-right */}
      {member.flag && (
        <span className="absolute top-3 right-3 text-xl leading-none select-none"
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}>
          {member.flag}
        </span>
      )}

      {/* specialty badge */}
      <div className="flex items-center gap-1.5 self-start mb-5">
        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
          style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}` }}>
          <Icon size={11} color={GOLD} />
        </div>
        <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: GOLD }}>
          {member.role}
        </span>
      </div>

      {/* photo wrapper — size controlled by CSS .vh-member-wrap */}
      <div className="vh-member-wrap relative shrink-0 mx-auto mb-5">
        <SpinningRing vb={168} color={GOLD} />
        {/* glow halo */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${GOLD_GLOW} 0%, transparent 70%)`,
            opacity: hovered ? 0.55 : 0.28,
            transition: 'opacity 0.3s',
          }} />
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            className="vh-member-photo absolute inset-0 m-auto rounded-full object-cover object-top"
            style={{
              border: `2.5px solid ${GOLD}`,
              boxShadow: `0 0 20px ${GOLD_GLOW}, 0 0 5px ${GOLD}55`,
            }}
            onError={e => {
              e.currentTarget.style.display = 'none'
              const next = e.currentTarget.nextElementSibling as HTMLElement | null
              if (next) next.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="vh-member-photo absolute inset-0 m-auto rounded-full items-center justify-center font-black text-3xl"
          style={{
            display: member.photo ? 'none' : 'flex',
            background: GOLD_DIM, color: GOLD,
            border: `2.5px solid ${GOLD}`,
            boxShadow: `0 0 20px ${GOLD_GLOW}`,
          }}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="font-black text-white text-base leading-tight mb-1">{member.name}</div>
      <div className="text-xs font-semibold mb-4" style={{ color: `${GOLD}BB` }}>Especialista</div>
      <p className="text-xs leading-relaxed flex-1" style={{ color: '#94A3B8' }}>{member.bio}</p>
    </div>
  )
}

/* ─── Connector lines — gold ─────────────────────────────────── */
function ConnectorLines({ count }: { count: number }) {
  const offsets = ['10%', '27.5%', '50%', '72.5%', '90%']
  return (
    <div className="hidden lg:block relative w-full h-14 my-0" aria-hidden="true" style={{ overflow: 'visible' }}>
      <div className="absolute left-1/2 -translate-x-px top-0 h-6 w-px"
        style={{ borderLeft: `2px dashed ${GOLD}`, opacity: 0.7 }} />
      <div className="absolute left-1/2 -translate-x-1/2 top-6 w-2.5 h-2.5 rounded-full z-10"
        style={{ background: GOLD, boxShadow: `0 0 8px 3px ${GOLD_GLOW}`, animation: 'nodePulse 2s ease-in-out infinite' }} />
      <div className="absolute top-6 h-px"
        style={{
          left: offsets[0], right: `calc(100% - ${offsets[count - 1]})`,
          borderTop: `2px dashed ${GOLD}`,
          opacity: 0.6,
          backgroundImage: `linear-gradient(90deg, ${GOLD} 40%, transparent 40%)`,
          backgroundSize: '14px 2px',
          animation: 'dashMove 1.2s linear infinite',
        }} />
      {offsets.slice(0, count).map((x, i) => (
        <div key={i}>
          <div className="absolute top-6 h-8 w-px"
            style={{ left: x, transform: 'translateX(-50%)', borderLeft: `2px dashed ${GOLD}`, opacity: 0.65 }} />
          <div className="absolute w-2 h-2 rounded-full z-10"
            style={{
              left: x, transform: 'translateX(-50%)', top: '3.25rem',
              background: GOLD, boxShadow: `0 0 6px 2px ${GOLD_GLOW}`,
              animation: `nodePulse 2s ease-in-out ${i * 0.18}s infinite`,
            }} />
        </div>
      ))}
    </div>
  )
}

/* ─── CEO card — photo/ring sized via CSS .vh-ceo-* classes ─────── */
function CeoCard({ ceo, visible }: { ceo: CeoData; visible: boolean }) {
  /* Fixed viewBox for the SVG — CSS scales the container */
  const VB = 240
  const r1 = VB / 2 - 6   // dashed ring radius
  const r2 = VB / 2 - 1   // pulse ring radius

  return (
    <div className={`flex-1 rounded-3xl p-7 md:p-9 border relative overflow-hidden flex flex-col md:flex-row gap-8 items-center md:items-start transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{
        background: CARD_BG,
        borderColor: GOLD_BORDER,
        boxShadow: `0 0 60px ${GOLD_DIM}`,
      }}>

      {/* corner glow */}
      <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${GOLD_DIM}, transparent 70%)` }} />

      {/* avatar — size driven by CSS .vh-ceo-wrap */}
      <div className="vh-ceo-wrap relative shrink-0 flex items-center justify-center mx-auto md:mx-0">

        {/* dashed spinning ring — fills container via viewBox */}
        <svg className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid meet">
          <circle cx={VB/2} cy={VB/2} r={r1} fill="none" stroke={GOLD} strokeWidth="1.8"
            strokeDasharray="10 6" strokeOpacity="0.55"
            style={{ animation: 'spinRing 14s linear infinite', transformOrigin: `${VB/2}px ${VB/2}px` }} />
          <circle cx={VB/2} cy={VB/2} r={r2} fill="none" stroke={GOLD} strokeWidth="1" strokeOpacity="0.12">
            <animate attributeName="r" values={`${r2};${r2+9};${r2}`} dur="2.8s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.12;0;0.12" dur="2.8s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* glow halo */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${GOLD_GLOW} 0%, transparent 65%)`, opacity: 0.35 }} />

        {ceo.photo ? (
          <img src={ceo.photo} alt={ceo.name}
            className="vh-ceo-photo rounded-full object-cover object-top relative z-10"
            style={{
              border: `3px solid ${GOLD}`,
              boxShadow: `0 0 36px ${GOLD_GLOW}, 0 0 8px ${GOLD}55`,
            }}
            onError={e => {
              e.currentTarget.style.display = 'none'
              const next = e.currentTarget.nextElementSibling as HTMLElement | null
              if (next) next.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="vh-ceo-photo rounded-full items-center justify-center font-black text-5xl relative z-10"
          style={{
            display: ceo.photo ? 'none' : 'flex',
            background: GOLD_DIM, color: GOLD,
            border: `3px solid ${GOLD}`,
            boxShadow: `0 0 36px ${GOLD_GLOW}`,
          }}
        >
          {ceo.name.charAt(0).toUpperCase()}
        </div>

        {/* two flags — bottom-right */}
        <div className="absolute bottom-1 right-1 flex items-center gap-0.5 z-20"
          style={{ filter: 'drop-shadow(0 1px 3px #000)' }}>
          <span className="text-2xl leading-none">{ceo.flag}</span>
          <span className="text-2xl leading-none">{ceo.secondary_flag}</span>
        </div>
      </div>

      <div className="flex-1 text-center md:text-left">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full mb-3"
          style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, color: GOLD }}>
          👑 {ceo.title}
        </span>
        <h3 className="text-3xl font-black text-white leading-tight mb-1">{ceo.name}</h3>
        <p className="text-sm font-semibold mb-4" style={{ color: `${GOLD}CC` }}>{ceo.role}</p>
        <p className="text-white/55 text-sm leading-relaxed mb-5 max-w-md">{ceo.bio}</p>
        <div className="inline-flex items-center gap-2 text-xs text-white/35">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GOLD }} />
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
  const [ceo, setCeo]   = useState<CeoData>(CEO_DEFAULT)
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
        const ceoData  = members.find(m => m.is_ceo)
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
            name:  m.name,
            role:  m.specialty ?? m.role ?? '',
            photo: m.photo_url ?? '',
            flag:  m.flag ?? '',
            bio:   m.bio ?? '',
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
    <section ref={ref} className="relative py-24 overflow-hidden" style={{ background: SECTION_BG }}>

      {/* subtle grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${GOLD_DIM} 1px,transparent 1px),linear-gradient(90deg,${GOLD_DIM} 1px,transparent 1px)`,
          backgroundSize: '64px 64px',
        }} />

      {/* top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-72 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at top, ${GOLD_DIM}, transparent 70%)` }} />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">

        {/* header */}
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <span className="inline-flex items-center gap-2 text-[11px] font-black tracking-widest uppercase px-4 py-2 rounded-full mb-5"
            style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, color: GOLD }}>
            <Users size={12} />
            Estrutura Organizacional
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Liderança que move o{' '}
            <span style={{ color: GOLD }}>futuro.</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Uma equipa especializada, focada em inovação, performance e resultados reais para empresas em{' '}
            <span style={{ color: GOLD }} className="font-semibold">Angola</span>
            {' '}e{' '}
            <span className="text-green-400 font-semibold">Brasil</span>.
          </p>
        </div>

        {/* ─ CEO + Stats ─ */}
        <div className={`flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto mb-0 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <CeoCard ceo={ceo} visible={visible} />

          <div className="rounded-3xl p-7 border flex flex-col justify-center gap-0 lg:min-w-[220px]"
            style={{ background: CARD_BG, borderColor: GOLD_BORDER }}>
            <div className="text-[10px] font-black tracking-widest uppercase mb-4"
              style={{ color: `${GOLD}88` }}>
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

        {/* ─ Team grid — equal-height cards ─ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 max-w-5xl mx-auto items-stretch">
          {team.map((m, i) => (
            <MemberCard key={m.name} member={m} index={i} visible={visible} />
          ))}
        </div>

        {/* ─ Values ─ */}
        <div className={`mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {VALUES.map(({ icon: Icon, label, text }) => (
            <div key={label}
              className="group flex flex-col gap-4 rounded-2xl p-6 border transition-all duration-300"
              style={{ background: CARD_BG, borderColor: GOLD_BORDER }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = GOLD
                el.style.boxShadow = `0 0 30px ${GOLD_DIM}`
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = GOLD_BORDER
                el.style.boxShadow = 'none'
              }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}` }}>
                <Icon size={20} color={GOLD} />
              </div>
              <div>
                <div className="font-bold text-white text-sm mb-1.5">{label}</div>
                <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>{text}</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* keyframes + responsive photo sizing */}
      <style>{`
        @keyframes spinRing  { to { transform: rotate(360deg); } }
        @keyframes nodePulse { 0%,100%{ opacity:1; transform:translateX(-50%) scale(1); } 50%{ opacity:.45; transform:translateX(-50%) scale(1.6); } }
        @keyframes dashMove  { to { background-position: 14px 0; } }

        /* ── CEO photo sizing ── */
        .vh-ceo-wrap  { width:240px; height:240px; }
        .vh-ceo-photo { width:196px; height:196px; }

        /* ── Member ring + photo sizing ── */
        .vh-member-wrap  { width:168px; height:168px; }
        .vh-member-photo { width:140px; height:140px; }
        .vh-member-card  { min-height:430px; }

        /* tablet (≤ 1024px) */
        @media (max-width:1024px) {
          .vh-ceo-wrap  { width:195px; height:195px; }
          .vh-ceo-photo { width:158px; height:158px; }
          .vh-member-wrap  { width:148px; height:148px; }
          .vh-member-photo { width:122px; height:122px; }
          .vh-member-card  { min-height:400px; }
        }

        /* mobile (≤ 640px) */
        @media (max-width:640px) {
          .vh-ceo-wrap  { width:160px; height:160px; }
          .vh-ceo-photo { width:128px; height:128px; }
          .vh-member-wrap  { width:132px; height:132px; }
          .vh-member-photo { width:108px; height:108px; }
          .vh-member-card  { min-height:370px; }
        }

        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </section>
  )
}
