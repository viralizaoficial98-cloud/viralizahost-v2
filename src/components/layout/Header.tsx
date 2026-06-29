'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'
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
      scrolled ? 'glass-dark shadow-2xl shadow-black/50' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <Logo size="md" />
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <div key={link.label} className="relative"
                onMouseEnter={() => link.children && setDropdown(link.label)}
                onMouseLeave={() => setDropdown(null)}
              >
                <a href={link.href}
                  className="flex items-center gap-1 text-gray-400 hover:text-yellow-400 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  {link.label}
                  {link.children && <ChevronDown size={14} className={`transition-transform ${dropdown === link.label ? 'rotate-180' : ''}`} />}
                </a>
                {link.children && dropdown === link.label && (
                  <div className="absolute top-full left-0 pt-2 w-56 z-50">
                    <div className="bg-[#111111] border border-yellow-500/15 rounded-2xl p-2 shadow-2xl shadow-black">
                      {link.children.map(child => (
                        <a key={child.label} href={child.href}
                          className="flex flex-col px-4 py-3 rounded-xl hover:bg-yellow-500/8 transition-colors">
                          <span className="text-white text-sm font-semibold">{child.label}</span>
                          <span className="text-gray-500 text-xs">{child.desc}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-3">
            <CurrencySelector />
            <Link href="/login" className="text-gray-400 hover:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              Entrar
            </Link>
            <Link href="/register" className="btn-shimmer btn-primary px-6 py-2.5 text-sm rounded-xl">
              Começar Grátis →
            </Link>
          </div>
          <button className="lg:hidden p-2 text-gray-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileOpen && (
          <div className="lg:hidden border-t border-yellow-500/10 py-4 space-y-1 animate-fade-in">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                className="block text-gray-400 hover:text-yellow-400 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-yellow-500/10 space-y-3">
              <CurrencySelector />
              <div className="flex gap-3">
                <Link href="/login" className="flex-1 text-center text-white border border-white/20 py-2.5 rounded-xl text-sm font-semibold">Entrar</Link>
                <Link href="/register" className="flex-1 text-center btn-primary py-2.5 text-sm rounded-xl flex items-center justify-center">Registar</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
