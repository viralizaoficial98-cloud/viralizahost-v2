import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  href?: string
}

export function Logo({ size = 'md', href = '/' }: LogoProps) {
  const heights = { sm: 28, md: 36, lg: 44 }
  const h = heights[size]
  return (
    <Link href={href} className="flex items-center gap-2 shrink-0">
      <div className="relative" style={{ height: h, width: h * 2.8 }}>
        <svg viewBox="0 0 280 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: h, width: 'auto' }}>
          {/* Speed lines */}
          <line x1="2"  y1="24" x2="24" y2="24" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.45"/>
          <line x1="5"  y1="32" x2="26" y2="32" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.55"/>
          <line x1="8"  y1="40" x2="28" y2="40" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
          <line x1="11" y1="48" x2="30" y2="48" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.80"/>
          <line x1="8"  y1="56" x2="28" y2="56" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.65"/>
          <line x1="5"  y1="64" x2="26" y2="64" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.55"/>
          <line x1="2"  y1="72" x2="24" y2="72" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" opacity="0.45"/>
          {/* Pentagon V shape */}
          <path d="M36 10 L72 10 L88 40 L54 88 L20 40 Z" stroke="#FFC107" strokeWidth="4.5" fill="none" strokeLinejoin="round"/>
          {/* Inner V fill */}
          <path d="M44 26 L64 26 L54 70 Z" fill="#FFC107"/>
          {/* VIRALIZA text */}
          <text x="104" y="62" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="42" fill="#FFC107" letterSpacing="1">VIRALIZA</text>
          {/* HOST subtext */}
          <text x="106" y="80" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="14" fill="#888888" letterSpacing="7">HOST</text>
        </svg>
      </div>
    </Link>
  )
}
