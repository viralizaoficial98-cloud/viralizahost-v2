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
      {/* Avatar image inside blue circular frame */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #4A9EF5, #1A5FBB)',
          padding: Math.max(2, size * 0.04),
          boxShadow: '0 4px 12px rgba(47,128,237,0.35)',
          boxSizing: 'border-box',
        }}
      >
        <img
          src="/cizesa.jpeg"
          alt="CIZESA"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
          }}
        />
      </div>

      {/* Online indicator */}
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

      {/* IA Badge */}
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

      <style>{`
        .avatar-ia-root {
          cursor: pointer;
          animation: avatarEntrance 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .avatar-ia-root:hover > div:first-child {
          box-shadow: 0 6px 20px rgba(47,128,237,0.55) !important;
          transform: scale(1.08);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .avatar-ia-root > div:first-child {
          transition: transform 0.2s ease, box-shadow 0.25s ease;
        }
        @keyframes avatarEntrance {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
