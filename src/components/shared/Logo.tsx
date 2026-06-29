import Link from 'next/link'

interface LogoProps {
  variant?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ variant = 'dark', size = 'md' }: LogoProps) {
  const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }
  const colors = { dark: 'text-slate-900', light: 'text-white' }
  return (
    <Link href="/" className={`font-bold ${sizes[size]} ${colors[variant]} flex items-center gap-0.5`}>
      <span className="text-indigo-500">Viraliza</span>
      <span>Host</span>
    </Link>
  )
}
