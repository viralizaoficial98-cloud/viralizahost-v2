'use client'

interface AvatarIAProps {
  size?: number
  showBadge?: boolean
  showOnline?: boolean
  className?: string
}

export function AvatarIA({ size = 56, showBadge = true, showOnline = true, className = '' }: AvatarIAProps) {
  return (
    <div
      className={`relative inline-block avatar-ia-root ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Main avatar SVG */}
      <svg
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        style={{ display: 'block', filter: 'drop-shadow(0 4px 12px rgba(47,128,237,0.35))' }}
        aria-label="Assistente Virtual ViralizaHost"
      >
        <defs>
          <clipPath id="avatar-clip">
            <circle cx="60" cy="60" r="55" />
          </clipPath>
          <radialGradient id="bg-grad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#4A9EF5" />
            <stop offset="100%" stopColor="#1A5FBB" />
          </radialGradient>
          <radialGradient id="skin-grad" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FCDBB5" />
            <stop offset="100%" stopColor="#F0B07A" />
          </radialGradient>
          <radialGradient id="hair-grad" cx="50%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#5C2E1A" />
            <stop offset="100%" stopColor="#2D1208" />
          </radialGradient>
        </defs>

        {/* ── Outer ring ── */}
        <circle cx="60" cy="60" r="58" fill="#2F80ED" />
        <circle cx="60" cy="60" r="55" fill="url(#bg-grad)" />

        {/* ── Clipped avatar content ── */}
        <g clipPath="url(#avatar-clip)">

          {/* Background inner */}
          <circle cx="60" cy="60" r="55" fill="#D8ECFF" />

          {/* ── Uniform / body ── */}
          <path d="M10 130 Q10 96 38 90 Q48 93 60 94 Q72 93 82 90 Q110 96 110 130Z" fill="#0A0A0A" />

          {/* Uniform collar V - yellow accent */}
          <path d="M46 91 L60 103 L74 91 L71 89 L60 100 L49 89Z" fill="#F5B700" />

          {/* Uniform logo area - VH text */}
          <text x="55" y="114" fontSize="8" fontFamily="Arial, sans-serif" fontWeight="800" fill="#F5B700" letterSpacing="0.5">VH</text>

          {/* ── Neck ── */}
          <rect x="52" y="73" width="16" height="20" rx="7" fill="url(#skin-grad)" />

          {/* Neck shadow */}
          <path d="M52 80 Q60 84 68 80" fill="none" stroke="#D4956A" strokeWidth="1.5" opacity="0.3" />

          {/* ── Hair back layer (behind head) ── */}
          <ellipse cx="60" cy="40" rx="32" ry="26" fill="url(#hair-grad)" />

          {/* Hair volume - sides */}
          <path d="M28 42 Q22 55 26 70 Q30 60 33 55Z" fill="url(#hair-grad)" />
          <path d="M92 42 Q98 55 94 70 Q90 60 87 55Z" fill="url(#hair-grad)" />

          {/* ── Headset arc ── */}
          <path d="M29 52 Q60 16 91 52" fill="none" stroke="#111" strokeWidth="6" strokeLinecap="round" />

          {/* Headset cushion highlight */}
          <path d="M31 52 Q60 19 89 52" fill="none" stroke="#2A2A2A" strokeWidth="3" strokeLinecap="round" />

          {/* Left ear cup */}
          <ellipse cx="28" cy="57" rx="9" ry="11" fill="#0A0A0A" />
          <ellipse cx="28" cy="57" rx="6" ry="7.5" fill="#1E1E1E" />
          <ellipse cx="28" cy="57" rx="3.5" ry="4.5" fill="#F5B700" />

          {/* Right ear cup */}
          <ellipse cx="92" cy="57" rx="9" ry="11" fill="#0A0A0A" />
          <ellipse cx="92" cy="57" rx="6" ry="7.5" fill="#1E1E1E" />
          <ellipse cx="92" cy="57" rx="3.5" ry="4.5" fill="#F5B700" />

          {/* Microphone arm */}
          <path d="M22 62 Q13 68 15 78" fill="none" stroke="#111" strokeWidth="4" strokeLinecap="round" />
          {/* Mic head */}
          <ellipse cx="15" cy="80" rx="5" ry="4" fill="#F5B700" />
          <ellipse cx="15" cy="80" rx="3" ry="2.5" fill="#FFD84D" />

          {/* ── Head / face ── */}
          <ellipse cx="60" cy="54" rx="29" ry="31" fill="url(#skin-grad)" />

          {/* Face shadow bottom */}
          <ellipse cx="60" cy="80" rx="18" ry="8" fill="#D4956A" opacity="0.2" />

          {/* ── Ears ── */}
          <ellipse cx="31" cy="56" rx="5.5" ry="7" fill="#F0B07A" />
          <ellipse cx="31" cy="56" rx="3" ry="4" fill="#E09060" />
          <ellipse cx="89" cy="56" rx="5.5" ry="7" fill="#F0B07A" />
          <ellipse cx="89" cy="56" rx="3" ry="4" fill="#E09060" />

          {/* ── Hair front ── */}
          {/* Main fringe */}
          <path d="M30 40 Q32 20 60 16 Q88 20 90 40 Q80 32 68 30 Q60 28 52 30 Q40 32 30 40Z" fill="url(#hair-grad)" />

          {/* Hair curls - left */}
          <circle cx="33" cy="44" r="9" fill="url(#hair-grad)" />
          <circle cx="27" cy="52" r="7" fill="url(#hair-grad)" />

          {/* Hair curls - right */}
          <circle cx="87" cy="44" r="9" fill="url(#hair-grad)" />
          <circle cx="93" cy="52" r="7" fill="url(#hair-grad)" />

          {/* Curl highlights */}
          <path d="M34 38 Q37 34 42 37" fill="none" stroke="#7A4030" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <path d="M78 38 Q83 34 86 37" fill="none" stroke="#7A4030" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

          {/* ── Eyebrows ── */}
          <path d="M43 46 Q50 42 56 45" fill="none" stroke="#3D1F1A" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M64 45 Q70 42 77 46" fill="none" stroke="#3D1F1A" strokeWidth="2.5" strokeLinecap="round" />

          {/* ── Glasses ── */}
          {/* Left lens */}
          <rect x="39" y="49" width="18" height="13" rx="5" fill="none" stroke="#222" strokeWidth="2.2" />
          <rect x="39" y="49" width="18" height="13" rx="5" fill="#E8F4FF" opacity="0.35" />
          {/* Right lens */}
          <rect x="63" y="49" width="18" height="13" rx="5" fill="none" stroke="#222" strokeWidth="2.2" />
          <rect x="63" y="49" width="18" height="13" rx="5" fill="#E8F4FF" opacity="0.35" />
          {/* Bridge */}
          <line x1="57" y1="55" x2="63" y2="55" stroke="#222" strokeWidth="2.2" />
          {/* Left arm */}
          <line x1="39" y1="55" x2="32" y2="57" stroke="#222" strokeWidth="2.2" strokeLinecap="round" />
          {/* Right arm */}
          <line x1="81" y1="55" x2="88" y2="57" stroke="#222" strokeWidth="2.2" strokeLinecap="round" />
          {/* Glasses shine */}
          <path d="M42 52 Q45 51 47 53" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
          <path d="M66 52 Q69 51 71 53" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />

          {/* ── Eyes ── */}
          <ellipse cx="48" cy="56" rx="5" ry="5.5" fill="#2D1208" />
          <ellipse cx="72" cy="56" rx="5" ry="5.5" fill="#2D1208" />
          {/* Iris */}
          <ellipse cx="48" cy="56" rx="3.5" ry="3.8" fill="#5C3020" />
          <ellipse cx="72" cy="56" rx="3.5" ry="3.8" fill="#5C3020" />
          {/* Pupil */}
          <ellipse cx="48" cy="56" rx="2" ry="2.2" fill="#0A0A0A" />
          <ellipse cx="72" cy="56" rx="2" ry="2.2" fill="#0A0A0A" />
          {/* Shine */}
          <circle cx="50" cy="54" r="1.5" fill="white" />
          <circle cx="74" cy="54" r="1.5" fill="white" />
          <circle cx="49" cy="57" r="0.8" fill="white" opacity="0.5" />
          <circle cx="73" cy="57" r="0.8" fill="white" opacity="0.5" />

          {/* ── Nose ── */}
          <path d="M57 65 Q60 69 63 65" fill="none" stroke="#D4956A" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="57" cy="65" r="1" fill="#D4956A" opacity="0.4" />
          <circle cx="63" cy="65" r="1" fill="#D4956A" opacity="0.4" />

          {/* ── Mouth / Smile ── */}
          {/* Smile arc */}
          <path d="M47 73 Q60 83 73 73" fill="none" stroke="#C07060" strokeWidth="2.2" strokeLinecap="round" />
          {/* Teeth */}
          <path d="M49 73 Q60 82 71 73 L71 75 Q60 84 49 75Z" fill="white" />
          <line x1="60" y1="73" x2="60" y2="82" stroke="#E8E8E8" strokeWidth="0.8" />
          {/* Lower lip */}
          <path d="M50 76 Q60 80 70 76" fill="#D4806A" opacity="0.4" />

          {/* ── Cheek blush ── */}
          <ellipse cx="38" cy="68" rx="9" ry="5.5" fill="#FFB0A0" opacity="0.35" />
          <ellipse cx="82" cy="68" rx="9" ry="5.5" fill="#FFB0A0" opacity="0.35" />

        </g>

        {/* ── Border ring ── */}
        <circle cx="60" cy="60" r="57" fill="none" stroke="#1A5FBB" strokeWidth="2" />

      </svg>

      {/* ── Online indicator ── */}
      {showOnline && (
        <span
          className="absolute rounded-full border-2 border-white"
          style={{
            width: size * 0.22,
            height: size * 0.22,
            bottom: size * 0.04,
            right: size * 0.04,
            background: '#22C55E',
            boxShadow: '0 0 6px rgba(34,197,94,0.7)',
          }}
        />
      )}

      {/* ── IA Badge ── */}
      {showBadge && (
        <span
          className="absolute flex items-center justify-center font-black"
          style={{
            width: size * 0.28,
            height: size * 0.2,
            top: 0,
            right: 0,
            background: '#F5B700',
            borderRadius: '6px',
            fontSize: size * 0.11,
            color: '#0A0A0A',
            letterSpacing: '0.03em',
            border: '2px solid white',
            lineHeight: 1,
          }}
        >
          IA
        </span>
      )}

      {/* CSS for hover and entrance animations */}
      <style>{`
        .avatar-ia-root {
          cursor: pointer;
          animation: avatarEntrance 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .avatar-ia-root:hover svg {
          transform: scale(1.08);
          filter: drop-shadow(0 6px 20px rgba(47,128,237,0.55)) !important;
          transition: transform 0.2s ease, filter 0.2s ease;
        }
        .avatar-ia-root svg {
          transition: transform 0.2s ease, filter 0.25s ease;
        }
        @keyframes avatarEntrance {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
