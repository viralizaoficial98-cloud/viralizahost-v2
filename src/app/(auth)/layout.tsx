'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

function useBreakpoint() {
  const [bp, setBp] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setBp(w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop')
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return bp
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const bgRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const bp = useBreakpoint()

  /* parallax suave no scroll — GPU-accelerated via transform translateY */
  useEffect(() => {
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (!bgRef.current) return
        const y = window.scrollY * 0.25
        bgRef.current.style.transform = `translateY(${y}px) scale(1.06)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /* background-position por breakpoint */
  const bgPosition =
    bp === 'mobile'  ? '68% center' :
    bp === 'tablet'  ? 'center right' :
                       'center center'

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* ── Background ─────────────────────────────────────── */}
      <div className="absolute inset-0 z-0" style={{ background: '#050608' }}>

        {/* image layer — parallax target */}
        <div
          ref={bgRef}
          className="absolute inset-[-6%] will-change-transform"
          style={{
            backgroundImage: "url('/imagem_login.png')",
            backgroundSize: 'cover',
            backgroundPosition: bgPosition,
            backgroundRepeat: 'no-repeat',
            transition: 'background-position 0.4s ease',
          }}
        />

        {/* dark overlay — 135deg conforme especificado */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(0,0,0,0.78), rgba(0,0,0,0.60), rgba(0,0,0,0.82))',
          }}
        />

        {/* golden grid subtle */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(245,183,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,183,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '52px 52px',
          }}
        />

        {/* golden glow — top right */}
        <div
          className="absolute top-0 right-0 w-[50vw] h-[50vh] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(245,183,0,0.06) 0%, transparent 65%)' }}
        />
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
        <Link href="/" aria-label="ViralizaHost — Página inicial" className="flex items-center shrink-0">
          <Image
            src="/logotipo_branco.png"
            alt="ViralizaHost"
            width={160}
            height={45}
            priority
            className="object-contain"
            style={{ height: 'auto', width: 160 }}
          />
        </Link>
        <Link
          href="/"
          className="text-sm font-medium transition-colors flex items-center gap-1.5"
          style={{ color: 'rgba(255,255,255,0.40)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F5B700')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.40)')}
        >
          ← Voltar ao site
        </Link>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="relative z-10 text-center py-4 px-4">
        <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.18)' }}>
          © {new Date().getFullYear()} ViralizaHost — Todos os direitos reservados
          {' · '}
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>SSL Seguro · Dados Protegidos · Suporte 24/7</span>
        </p>
      </footer>
    </div>
  )
}
