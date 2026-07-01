import Link from 'next/link'

interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
}

/**
 * ViralizaHost Logo — inline SVG
 * variant="dark"  → text preto  (para fundos brancos: header)
 * variant="light" → text branco (para fundos escuros: sidebar, footer, auth)
 */
export function Logo({ variant = 'dark', size = 'md', href = '/', className = '' }: LogoProps) {
  const heights: Record<string, number> = { sm: 38, md: 55, lg: 70 }
  const h = heights[size]

  /* Cores condicionais */
  const textFill   = variant === 'light' ? '#FFFFFF' : '#0A0A0A'
  const hostFill   = variant === 'light' ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,10,0.48)'
  const topFace    = variant === 'light' ? '#3A3A3A' : '#2A2A2A'
  const frontFace  = variant === 'light' ? '#222222' : '#1C1C1C'
  const rightFace  = '#111111'
  const ventSlot   = variant === 'light' ? '#3E3E3E' : '#2E2E2E'

  return (
    <Link href={href} className={`flex items-center shrink-0 ${className}`} aria-label="ViralizaHost — Página inicial">
      {/*
        ViewBox 840 × 172
        ──────────────────────────────────────────────────────────
        [0-22]   speed lines
        [26-165] 3 server units (3D) + 3D offset extends to ~177
        [172-252] yellow pentagon arrow
        [268-830] VIRALIZA text + HOST subtext
        ──────────────────────────────────────────────────────────
      */}
      <svg
        viewBox="0 0 840 172"
        width={h * 4.88}
        height={h}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-hidden="true"
      >
        {/* ── SPEED LINES ─────────────────────────────────────── */}
        <line x1="1"  y1="30"  x2="22" y2="30"  stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.28"/>
        <line x1="0"  y1="44"  x2="22" y2="44"  stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.42"/>
        <line x1="0"  y1="58"  x2="24" y2="58"  stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.60"/>
        <line x1="0"  y1="72"  x2="24" y2="72"  stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.78"/>
        <line x1="0"  y1="86"  x2="26" y2="86"  stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.94"/>
        <line x1="0"  y1="100" x2="26" y2="100" stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.94"/>
        <line x1="0"  y1="114" x2="24" y2="114" stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.78"/>
        <line x1="0"  y1="128" x2="24" y2="128" stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.60"/>
        <line x1="0"  y1="142" x2="22" y2="142" stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.42"/>
        <line x1="1"  y1="156" x2="22" y2="156" stroke="#F5B700" strokeWidth="2.8" strokeLinecap="round" opacity="0.28"/>

        {/* ── SERVER UNIT 1  (front y: 18-60, top y: 8-18, right x: 153-166) ── */}
        <path d={`M26,18 L153,18 L166,8 L39,8 Z`}          fill={topFace}/>
        <path d={`M153,18 L153,60 L166,50 L166,8 Z`}        fill={rightFace}/>
        <rect x="26" y="18" width="127" height="42" rx="2.5" fill={frontFace}/>
        {/* yellow LED bar */}
        <rect x="98"  y="25" width="46" height="5"   rx="2.5" fill="#F5B700"/>
        {/* vent slots */}
        <rect x="34"  y="30" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="35" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="40" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="45" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        {/* status LEDs */}
        <circle cx="103" cy="46" r="3"   fill="#F5B700"/>
        <circle cx="114" cy="46" r="3"   fill="#22C55E"/>
        <circle cx="125" cy="46" r="3"   fill="#F5B700" opacity="0.45"/>
        {/* port slots */}
        <rect x="136"  y="40" width="8"  height="6" rx="1" fill="#F5B700" opacity="0.38"/>
        <rect x="147"  y="40" width="8"  height="6" rx="1" fill="#252525"/>

        {/* ── SERVER UNIT 2  (front y: 68-110) ─────────────────── */}
        <path d={`M26,68 L153,68 L166,58 L39,58 Z`}          fill={topFace}/>
        <path d={`M153,68 L153,110 L166,100 L166,58 Z`}       fill={rightFace}/>
        <rect x="26" y="68" width="127" height="42" rx="2.5"  fill={frontFace}/>
        <rect x="98"  y="75" width="46" height="5"   rx="2.5" fill="#F5B700" opacity="0.85"/>
        <rect x="34"  y="80" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="85" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="90" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="95" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <circle cx="103" cy="96" r="3"   fill="#22C55E"/>
        <circle cx="114" cy="96" r="3"   fill="#F5B700"/>
        <circle cx="125" cy="96" r="3"   fill="#F5B700" opacity="0.45"/>
        <rect x="136"  y="90" width="8"  height="6" rx="1" fill="#252525"/>
        <rect x="147"  y="90" width="8"  height="6" rx="1" fill="#F5B700" opacity="0.38"/>

        {/* ── SERVER UNIT 3  (front y: 118-160) ────────────────── */}
        <path d={`M26,118 L153,118 L166,108 L39,108 Z`}        fill={topFace}/>
        <path d={`M153,118 L153,160 L166,150 L166,108 Z`}      fill={rightFace}/>
        <rect x="26" y="118" width="127" height="42" rx="2.5"  fill={frontFace}/>
        <rect x="98"  y="125" width="46" height="5"  rx="2.5" fill="#F5B700" opacity="0.70"/>
        <rect x="34"  y="130" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="135" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="140" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <rect x="34"  y="145" width="52" height="2.5" rx="1.2" fill={ventSlot}/>
        <circle cx="103" cy="146" r="3"  fill="#F5B700"/>
        <circle cx="114" cy="146" r="3"  fill="#F5B700" opacity="0.55"/>
        <circle cx="125" cy="146" r="3"  fill="#22C55E"/>
        <rect x="136"  y="140" width="8" height="6" rx="1" fill="#F5B700" opacity="0.38"/>
        <rect x="147"  y="140" width="8" height="6" rx="1" fill="#252525"/>

        {/* ── YELLOW PENTAGON ARROW ─────────────────────────────── */}
        {/* Main shape — right-pointing arrow/chevron */}
        <path d="M172,8 L216,8 L254,86 L216,164 L172,164 Z" fill="#F5B700"/>
        {/* Inner gloss */}
        <path d="M180,22 L210,22 L238,86 L210,150 L180,150 Z" fill="#D9A300" opacity="0.22"/>
        {/* Bright left edge highlight */}
        <path d="M172,8 L180,8 L180,164 L172,164 Z" fill="#FFD54F" opacity="0.35"/>

        {/* ── VIRALIZA TEXT ─────────────────────────────────────── */}
        <text
          x="272"
          y="120"
          fontFamily="'Arial Black', 'Franklin Gothic Heavy', Impact, 'Arial Bold', sans-serif"
          fontWeight="900"
          fontSize="92"
          fill={textFill}
          letterSpacing="-2"
        >
          VIRALIZA
        </text>

        {/* Triangle accent on A (last letter) — yellow triangle inside the A crossbar */}
        {/* Positioned approximately where the A's crossbar would be in VIRALIZ-A */}
        <polygon points="800,96 812,72 824,96" fill="#F5B700" opacity="0.90"/>

        {/* ── HOST SUBTEXT ──────────────────────────────────────── */}
        <text
          x="275"
          y="150"
          fontFamily="'Helvetica Neue', Arial, sans-serif"
          fontWeight="500"
          fontSize="18"
          fill={hostFill}
          letterSpacing="12"
        >
          HOST
        </text>
      </svg>
    </Link>
  )
}
