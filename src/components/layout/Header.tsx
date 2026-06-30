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
  { label: 'E-mail Corporativo', href: '#email-plans' },
  { label: 'Suporte', href: '/tickets' },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [dropdown, setDropdown] = useState<string | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white shadow-[0_1px_24px_rgba(0,0,0,0.09)] border-b border-[#F0F0F0]'
        : 'bg-white border-b border-[#F0F0F0]'
    }`}>
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-[68px]">

          {/* Logo */}
          <Logo variant="dark" size="md" />

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center max-w-2xl mx-auto">
            {navLinks.map((link) => (
              <div key={link.label} className="relative"
                onMouseEnter={() => link.children && setDropdown(link.label)}
                onMouseLeave={() => setDropdown(null)}
              >
                <a
                  href={link.href}
                  className="flex items-center gap-1 text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-all whitespace-nowrap"
                >
                  {link.label}
                  {link.children && (
                    <ChevronDown
                      size={13}
                      className={`text-gray-400 transition-transform duration-200 ${dropdown === link.label ? 'rotate-180' : ''}`}
                    />
                  )}
                </a>

                {link.children && dropdown === link.label && (
                  <div className="absolute top-full left-0 pt-2 w-56 z-50">
                    <div className="bg-white border border-[#E8E8E8] rounded-2xl py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.10)]">
                      {link.children.map(child => (
                        <a key={child.label} href={child.href}
                          className="flex flex-col px-4 py-2.5 rounded-xl mx-1.5 hover:bg-[#FFFDF0] transition-colors group">
                          <span className="text-[#0A0A0A] text-[13px] font-semibold group-hover:text-[#B88900] transition-colors">
                            {child.label}
                          </span>
                          <span className="text-gray-400 text-xs mt-0.5">{child.desc}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <CurrencySelector />
            <Link href="/login"
              className="text-[#3D3D3D] hover:text-[#0A0A0A] px-4 py-2 rounded-xl text-sm font-medium transition-all hover:bg-[#F5F5F5]">
              Entrar
            </Link>
            <Link href="/register"
              className="btn-shimmer btn-primary px-5 py-2.5 text-sm rounded-xl shadow-[0_4px_12px_rgba(245,183,0,0.28)] hover:shadow-[0_6px_20px_rgba(245,183,0,0.38)]">
              Começar Grátis →
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 rounded-xl text-[#444] hover:bg-[#F5F5F5] transition-all"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[#F0F0F0] py-4 space-y-0.5 animate-fade-in">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href}
                className="block text-[#3D3D3D] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                onClick={() => setMobileOpen(false)}>
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-[#F0F0F0] space-y-3">
              <CurrencySelector />
              <div className="flex gap-3">
                <Link href="/login"
                  className="flex-1 text-center text-[#0A0A0A] border border-[#E8E8E8] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F8F8F8] transition-colors">
                  Entrar
                </Link>
                <Link href="/register"
                  className="flex-1 text-center btn-primary py-2.5 text-sm rounded-xl flex items-center justify-center">
                  Começar
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
