'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef } from 'react'

/*
 * Para usar uma imagem real de atendente/call-center:
 *   1. Coloque o ficheiro em /public/auth-bg.jpg
 *   2. Defina BG_IMAGE = '/auth-bg.jpg'
 *   3. Troque o bloco de gradient por: backgroundImage: `url(${BG_IMAGE})`
 */
const BG_IMAGE = '' // '/auth-bg.jpg'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const bgRef = useRef<HTMLDivElement>(null)

  /* parallax suave no background */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!bgRef.current) return
      const x = (e.clientX / window.innerWidth  - 0.5) * 14
      const y = (e.clientY / window.innerHeight - 0.5) * 10
      bgRef.current.style.transform = `translate(${x}px, ${y}px) scale(1.05)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* ── Background ─────────────────────────────────────── */}
      <div className="absolute inset-0 z-0" style={{ background: '#060810' }}>

        {/* bg image / gradient layer — parallax target */}
        <div
          ref={bgRef}
          className="absolute inset-[-5%]"
          style={{
            transition: 'transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94)',
            willChange: 'transform',
            ...(BG_IMAGE
              ? {
                  backgroundImage: `url(${BG_IMAGE})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }
              : {
                  /* premium dark tech gradient — substitua quando tiver a imagem */
                  background: `
                    radial-gradient(ellipse 80% 60% at 70% 40%, rgba(20,30,60,0.95) 0%, transparent 60%),
                    radial-gradient(ellipse 60% 80% at 20% 80%, rgba(10,10,10,0.95) 0%, transparent 70%),
                    linear-gradient(135deg,
                      #040608 0%,
                      #080d18 20%,
                      #0d1525 40%,
                      #060a14 60%,
                      #020408 100%
                    )
                  `,
                }),
          }}
        />

        {/* circuit / grid lines — tech atmosphere */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(245,183,0,0.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,183,0,0.035) 1px, transparent 1px)
            `,
            backgroundSize: '52px 52px',
          }} />

        {/* golden radial glows */}
        <div className="absolute top-0 right-0 w-[55vw] h-[55vh] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(245,183,0,0.07) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vh] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at bottom left, rgba(245,183,0,0.045) 0%, transparent 65%)' }} />
        <div className="absolute top-1/2 left-1/4 w-72 h-72 -translate-y-1/2 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,183,0,0.04) 0%, transparent 70%)', filter: 'blur(40px)' }} />

        {/* dark overlay for readability — gradient from left (darker) to right */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(4,6,8,0.92) 0%, rgba(4,6,8,0.65) 50%, rgba(4,6,8,0.50) 100%)' }} />

        {/* floating particles */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
          {[
            { cx: '15%', cy: '20%', r: 1.5, o: 0.4, d: '4s' },
            { cx: '80%', cy: '15%', r: 1,   o: 0.3, d: '6s' },
            { cx: '65%', cy: '70%', r: 2,   o: 0.25, d: '5s' },
            { cx: '30%', cy: '80%', r: 1.5, o: 0.35, d: '7s' },
            { cx: '90%', cy: '55%', r: 1,   o: 0.3, d: '3.5s' },
            { cx: '45%', cy: '35%', r: 1,   o: 0.2, d: '5.5s' },
          ].map(({ cx, cy, r, o, d }, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="#F5B700" opacity={o}>
              <animate attributeName="opacity" values={`${o};${o * 0.2};${o}`} dur={d} repeatCount="indefinite" />
            </circle>
          ))}
        </svg>
      </div>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
        <Link href="/" aria-label="ViralizaHost — Página inicial" className="flex items-center shrink-0">
          <Image
            src="/logo-viraliza-yellow.png"
            alt="ViralizaHost"
            width={180}
            height={45}
            priority
            style={{ height: 40, width: 'auto' }}
          />
        </Link>
        <Link
          href="/"
          className="text-sm text-white/40 hover:text-[#F5B700] transition-colors flex items-center gap-1.5 font-medium"
        >
          <span>←</span> Voltar ao site
        </Link>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="relative z-10 text-center py-4 px-4">
        <p className="text-xs text-white/20 font-medium">
          © {new Date().getFullYear()} ViralizaHost — Todos os direitos reservados
          {' · '}
          <span className="text-white/30">SSL Seguro · Dados Protegidos · Suporte 24/7</span>
        </p>
      </footer>
    </div>
  )
}
