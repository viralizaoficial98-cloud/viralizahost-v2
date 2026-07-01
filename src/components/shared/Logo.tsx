import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
}

const dimensions: Record<string, { h: number; w: number }> = {
  sm: { h: 40, w: 160 },
  md: { h: 52, w: 208 },
  lg: { h: 64, w: 256 },
}

export function Logo({ variant = 'dark', size = 'md', href = '/', className = '' }: LogoProps) {
  const { h, w } = dimensions[size]

  return (
    <Link href={href} className={`flex items-center shrink-0 ${className}`} aria-label="ViralizaHost — Página inicial">
      <Image
        src="/logo-viraliza-yellow.png"
        alt="ViralizaHost"
        width={w}
        height={h}
        priority
        style={{
          height: h,
          width: 'auto',
          filter: variant === 'light' ? 'brightness(0) invert(1)' : 'none',
        }}
      />
    </Link>
  )
}
