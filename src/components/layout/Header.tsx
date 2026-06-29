'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X, ChevronDown, Phone } from 'lucide-react'
import { Logo } from '@/components/shared/Logo'
import { CurrencySelector } from '@/components/shared/CurrencySelector'

const navLinks = [
  {
    label: 'Hospedagem',
    href: '#planos',
    children: [
      { label: 'Starter Host', href: '#planos', desc: 'Para iniciantes' },
      { label: 'Business Cloud', href: '#planos', desc: 'Para PMEs' },
      { label: 'Cloud Pro', href: '#planos', desc: 'Alta performance' },
      { label: 'Revenda WHM', href: '#planos', desc: 'Para revendedores' },
    ],
  },
  { label: 'Domínios', href: '#dominios' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Suporte', href: '/tickets' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [dropdown, setDropdown] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-slate-900/95 backdrop-blur-xl border-b border-white/10 shadow-2xl' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-18 py-4">
          <Logo variant="light" />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <div key={link.label} className="relative group"
                onMouseEnter={() => link.children && setDropdown(link.label)}
                onMouseLeave={() => setDropdown(null)}
              >
                <a href={link.href}
                  className="flex items-center gap-1 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-white/10">
                  {link.label}
                  {link.children && <ChevronDown size={14} className={`transition-transform ${dropdown === link.label ? 'rotate-180' : ''}`} />}
                </a>

                {link.children && dropdown === link.label && (
                  <div className="absolute top-full left-0 pt-2 w-56">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-2 shadow-2xl">
                      {link.children.map(child => (
                        <a key={child.label} href={child.href}
                          className="flex flex-col px-4 py-3 rounded-xl hover:bg-indigo-600/20 transition-colors group/item">
                          <span className="text-white text-sm font-semibold group-hover/item:text-indigo-400 transition-colors">{child.label}</span>
                          <span className="text-slate-500 text-xs">{child.desc}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-3">
            <CurrencySelector />
            <Link href="/login" className="text-slate-300 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-white/10">
              Entrar
            </Link>
            <Link href="/register"
              className="btn-shimmer bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 shadow-lg shadow-indigo-500/30">
              Começar Grátis →
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="lg:hidden p-2 text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/10 py-4 space-y-2 animate-fade-in">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                className="block text-slate-300 hover:text-white hover:bg-white/10 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-white/10 space-y-3">
              <CurrencySelector />
              <div className="flex gap-3">
                <Link href="/login" className="flex-1 text-center text-white border border-white/20 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/10 transition-colors">
                  Entrar
                </Link>
                <Link href="/register" className="flex-1 text-center bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
                  Registar
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
