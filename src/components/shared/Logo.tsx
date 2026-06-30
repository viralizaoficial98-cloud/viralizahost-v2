import Link from 'next/link'

interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
}

export function Logo({ variant = 'dark', size = 'md', href = '/', className = '' }: LogoProps) {
  const heights = { sm: 32, md: 44, lg: 56 }
  const h = heights[size]

  /* On dark backgrounds (footer, hero): VIRALIZA=yellow, HOST=white */
  /* On light backgrounds (header): VIRALIZA=yellow, HOST=black */
  const hostColor = variant === 'light' ? '#FFFFFF' : '#0A0A0A'
  const hostOpacity = variant === 'light' ? '0.85' : '0.7'

  return (
    <Link href={href} className={`flex items-center shrink-0 ${className}`}>
      <svg
        viewBox="0 0 300 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: h, width: 'auto' }}
        aria-label="ViralizaHost"
      >
        {/* Speed lines */}
        <line x1="2"  y1="20" x2="22" y2="20" stroke="#F5B700" strokeWidth="2.5" strokeLinecap="round" opacity="0.40"/>
        <line x1="4"  y1="29" x2="24" y2="29" stroke="#F5B700" strokeWidth="2.5" strokeLinecap="round" opacity="0.52"/>
        <line x1="6"  y1="38" x2="26" y2="38" stroke="#F5B700" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
        <line x1="8"  y1="47" x2="28" y2="47" stroke="#F5B700" strokeWidth="2.5" strokeLinecap="round" opacity="0.85"/>
        <line x1="6"  y1="56" x2="26" y2="56" stroke="#F5B700" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
        <line x1="4"  y1="65" x2="24" y2="65" stroke="#F5B700" strokeWidth="2.5" strokeLinecap="round" opacity="0.52"/>
        <line x1="2"  y1="74" x2="22" y2="74" stroke="#F5B700" strokeWidth="2.5" strokeLinecap="round" opacity="0.40"/>

        {/* Pentagon V shape */}
        <path d="M34 8 L72 8 L90 40 L53 84 L16 40 Z"
          stroke="#F5B700" strokeWidth="4" fill="none" strokeLinejoin="round"/>
        {/* Inner V fill */}
        <path d="M42 24 L64 24 L53 68 Z" fill="#F5B700"/>

        {/* VIRALIZA */}
        <text
          x="106" y="56"
          fontFamily="'Arial Black', Arial, sans-serif"
          fontWeight="900"
          fontSize="40"
          fill="#F5B700"
          letterSpacing="1"
        >
          VIRALIZA
        </text>

        {/* HOST */}
        <text
          x="108" y="76"
          fontFamily="Arial, sans-serif"
          fontWeight="500"
          fontSize="14"
          fill={hostColor}
          opacity={hostOpacity}
          letterSpacing="8"
        >
          HOST
        </text>
      </svg>
    </Link>
  )
}
